-- Migration : 20260822160000_engagements_fait_date.sql
-- Description : le fait daté — table `engagements` (chantier A du persona
--               académique, arbitrage rendu le 22/08/2026).
--
-- Un engagement est un fait DÉCLARÉ (couche 2) : un événement extérieur daté
-- (« examen le … », « rendu le … »), jamais une mesure de la personne ni un
-- objectif structuré (ADR-096 reste debout). Tout le reste — J-x, urgence,
-- couverture — est dérivé à la lecture et ne se stocke pas.
--
-- Append-only en pratique : archivage par `cloture_le`, jamais suppression.
-- Les `codes` ciblés sont validés applicativement contre le référentiel du
-- compte avant l'écriture (refus bruyant, pas d'ignorance silencieuse).
-- Statut : APPLIQUÉE le 22/08/2026 sur le projet distant vxkjzzshlqulexydgfpc.

CREATE TABLE IF NOT EXISTS public.engagements (
  id            TEXT NOT NULL,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Type d'engagement : deux valeurs max pour commencer (A0.3).
  type          TEXT NOT NULL CHECK (type IN ('examen', 'rendu')),

  -- Verbatim de la personne.
  libelle       TEXT NOT NULL CHECK (btrim(libelle) <> ''),

  -- La seule donnée dure : la date déclarée, ISO locale YYYY-MM-DD
  -- (même convention TEXT que sessions.date / planifiee_pour).
  echeance_le   TEXT NOT NULL CHECK (echeance_le ~ '^\d{4}-\d{2}-\d{2}$'),

  -- Codes facultatifs du référentiel du compte (A0.4) — jamais inventés par
  -- le tuteur ; validation applicative contre referentiel_codes_emis.
  codes         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  cloture_le    TIMESTAMPTZ,
  -- Nature de la clôture : « passe » (l'événement a eu lieu) ou « reporte »
  -- (un NOUVEL engagement porte la nouvelle date ; celui-ci n'est jamais
  -- réécrit — append-only).
  cloture_type  TEXT CHECK (cloture_type IS NULL OR cloture_type IN ('passe', 'reporte')),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  CONSTRAINT engagements_cloture_coherente
    CHECK ((cloture_le IS NULL) = (cloture_type IS NULL))
);

ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "isolation_par_compte" ON public.engagements;
CREATE POLICY "isolation_par_compte" ON public.engagements
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id AND (select public.compte_actif()))
  WITH CHECK ((select auth.uid()) = user_id AND (select public.compte_actif()));

CREATE INDEX IF NOT EXISTS engagements_user_echeance_idx
  ON public.engagements (user_id, echeance_le);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.engagements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.engagements TO service_role;

-- Intégration au chargement groupé : tri par échéance, clôturés inclus
-- (le domaine décide quoi afficher ; rien ne se fabrique ici).
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
    'profile',     (SELECT row_to_json(p) FROM profiles p WHERE p.id = uid),
    'observations',    COALESCE((SELECT json_agg(row_to_json(e)) FROM observations e WHERE e.user_id = uid), '[]'::json),
    'exercises',   COALESCE((SELECT json_agg(row_to_json(x)) FROM exercises x WHERE x.user_id = uid), '[]'::json),
    'attempts',    COALESCE((SELECT json_agg(row_to_json(a)) FROM attempts a WHERE a.user_id = uid), '[]'::json),
    'sessions',    COALESCE((SELECT json_agg(row_to_json(s)) FROM sessions s WHERE s.user_id = uid), '[]'::json),
    'refus_recommandations',
                   COALESCE((SELECT json_agg(row_to_json(r)) FROM refus_recommandations r WHERE r.user_id = uid), '[]'::json),
    'domaines',    COALESCE((SELECT json_agg(row_to_json(d)) FROM domaines d WHERE d.user_id = uid), '[]'::json),
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json),
    'competence_domaines',
                   COALESCE((SELECT json_agg(row_to_json(cd)) FROM competence_domaines cd WHERE cd.user_id = uid), '[]'::json),
    'moteur_reglages',
                   COALESCE((SELECT json_agg(row_to_json(m)) FROM (SELECT * FROM public.moteur_reglages WHERE user_id = uid ORDER BY applique_le ASC) m), '[]'::json),
    'engagements',
                   COALESCE((SELECT json_agg(row_to_json(g)) FROM (SELECT * FROM public.engagements WHERE user_id = uid ORDER BY echeance_le ASC, created_at ASC) g), '[]'::json)
  ) INTO resultat;

  RETURN resultat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated;
