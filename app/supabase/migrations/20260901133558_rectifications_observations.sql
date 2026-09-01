-- ADR-141 — rectifier la recevabilité d'une Observation sans réécrire le fait.
CREATE TABLE IF NOT EXISTS public.observation_rectifications (
  id              TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  observation_id  TEXT NOT NULL,
  date            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('invalidation', 'restauration')),
  motif           TEXT NOT NULL CHECK (length(btrim(motif)) > 0),
  origine         TEXT NOT NULL CHECK (origine IN ('administrateur', 'utilisateur')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, observation_id)
    REFERENCES public.observations(user_id, id) ON DELETE CASCADE
);

ALTER TABLE public.observation_rectifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "observation_rectifications_lecture_compte"
  ON public.observation_rectifications;
CREATE POLICY "observation_rectifications_lecture_compte"
  ON public.observation_rectifications FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND (select public.compte_actif()));

REVOKE ALL ON TABLE public.observation_rectifications FROM anon, authenticated;
GRANT SELECT ON TABLE public.observation_rectifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.observation_rectifications TO service_role;

CREATE INDEX IF NOT EXISTS observation_rectifications_user_created_idx
  ON public.observation_rectifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS observation_rectifications_observation_date_idx
  ON public.observation_rectifications (user_id, observation_id, date DESC, id DESC);

CREATE OR REPLACE FUNCTION public.verifier_observation_rectifications_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(current_setting('app.purge_compte', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Les rectifications d''Observation sont append-only.'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.verifier_observation_rectifications_append_only()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS observation_rectifications_append_only
  ON public.observation_rectifications;
CREATE TRIGGER observation_rectifications_append_only
BEFORE UPDATE OR DELETE ON public.observation_rectifications
FOR EACH ROW EXECUTE FUNCTION public.verifier_observation_rectifications_append_only();

CREATE OR REPLACE FUNCTION public.charger_tout()
RETURNS JSON
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  resultat json;
BEGIN
  SELECT json_build_object(
    'profile', (SELECT row_to_json(p) FROM profiles p WHERE p.id = uid),
    'observations', COALESCE((SELECT json_agg(row_to_json(e)) FROM observations e WHERE e.user_id = uid), '[]'::json),
    'observation_rectifications', COALESCE((SELECT json_agg(row_to_json(orx)) FROM observation_rectifications orx WHERE orx.user_id = uid), '[]'::json),
    'exercises', COALESCE((SELECT json_agg(row_to_json(x)) FROM exercises x WHERE x.user_id = uid), '[]'::json),
    'attempts', COALESCE((SELECT json_agg(row_to_json(a)) FROM attempts a WHERE a.user_id = uid), '[]'::json),
    'sessions', COALESCE((SELECT json_agg(row_to_json(s)) FROM sessions s WHERE s.user_id = uid), '[]'::json),
    'refus_recommandations', COALESCE((SELECT json_agg(row_to_json(r)) FROM refus_recommandations r WHERE r.user_id = uid), '[]'::json),
    'domaines', COALESCE((SELECT json_agg(row_to_json(d)) FROM domaines d WHERE d.user_id = uid), '[]'::json),
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json),
    'competence_domaines', COALESCE((SELECT json_agg(row_to_json(cd)) FROM competence_domaines cd WHERE cd.user_id = uid), '[]'::json),
    'moteur_reglages', COALESCE((SELECT json_agg(row_to_json(m)) FROM (SELECT * FROM public.moteur_reglages WHERE user_id = uid ORDER BY applique_le ASC) m), '[]'::json),
    'engagements', COALESCE((SELECT json_agg(row_to_json(g)) FROM (SELECT * FROM public.engagements WHERE user_id = uid ORDER BY echeance_le ASC, created_at ASC) g), '[]'::json)
  ) INTO resultat;
  RETURN resultat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated;
