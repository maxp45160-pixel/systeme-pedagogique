-- ADR-108, révisée le 24/08/2026.
--
-- Une version de domaine ne dit ni POURQUOI le référentiel a bougé, ni quelle
-- famille de propositions doit être rouverte. Déclencher toutes les familles
-- sur cette version fabriquait une boucle. Les faits déclarés sont donc séparés
-- des relectures, et chaque relecture nomme les familles qu'elle a consommées.

CREATE TABLE IF NOT EXISTS public.declencheurs_relecture_referentiel (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id         UUID NOT NULL DEFAULT gen_random_uuid(),
  famille    TEXT NOT NULL CHECK (famille IN ('structure', 'progression')),
  cause      TEXT NOT NULL CHECK (cause IN ('croissance_referentiel', 'intention_moyen', 'intention_long')),
  nombre     INTEGER NOT NULL CHECK (nombre > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

COMMENT ON TABLE public.declencheurs_relecture_referentiel IS
  'Faits append-only déclarés : croissance du référentiel ou intention modifiée. La maîtrise reste dérivée et n entre pas ici.';

CREATE INDEX IF NOT EXISTS declencheurs_relecture_referentiel_recents_idx
  ON public.declencheurs_relecture_referentiel (user_id, famille, created_at DESC);

ALTER TABLE public.declencheurs_relecture_referentiel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "declencheurs_relecture_lecture_compte" ON public.declencheurs_relecture_referentiel;
CREATE POLICY "declencheurs_relecture_lecture_compte"
  ON public.declencheurs_relecture_referentiel
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND (select public.compte_actif()));

DROP POLICY IF EXISTS "declencheurs_relecture_insertion_compte" ON public.declencheurs_relecture_referentiel;
CREATE POLICY "declencheurs_relecture_insertion_compte"
  ON public.declencheurs_relecture_referentiel
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select public.compte_actif()));

REVOKE ALL ON TABLE public.declencheurs_relecture_referentiel FROM anon;
GRANT SELECT, INSERT ON TABLE public.declencheurs_relecture_referentiel TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.declencheurs_relecture_referentiel FROM authenticated;

ALTER TABLE public.relectures_referentiel
  ADD COLUMN IF NOT EXISTS familles TEXT[] NOT NULL
  DEFAULT ARRAY['structure', 'progression', 'maintenance']::TEXT[];

ALTER TABLE public.relectures_referentiel
  DROP CONSTRAINT IF EXISTS relectures_referentiel_familles_valides;
ALTER TABLE public.relectures_referentiel
  ADD CONSTRAINT relectures_referentiel_familles_valides CHECK (
    cardinality(familles) > 0
    AND familles <@ ARRAY['structure', 'progression', 'maintenance']::TEXT[]
  );

COMMENT ON COLUMN public.relectures_referentiel.familles IS
  'Familles effectivement analysées par ce lot. Un échec du tuteur ne consomme pas structure/progression.';
