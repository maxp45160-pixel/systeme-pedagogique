-- --------------------------------------------------------------------
-- Migration — thèmes (chantier « thèmes », 10/08/2026, ADR-053)
--
-- Additive, idempotente, aucun DROP. Peut être rejouée sans risque.
--
-- Un thème est un regroupement de compétences nommé, traversant librement
-- les domaines — voir `app/src/lib/domain/theme.ts` pour le raisonnement
-- complet. `codes` n'a PAS de FK vers `competences` : un code retiré du
-- référentiel après coup doit rester lisible dans un thème passé, et
-- `themeVersThemeSeance` (domaine pur) filtre les codes disparus à la
-- lecture — même précédent que `competences.prerequis`.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.themes (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id           TEXT NOT NULL,
  libelle      TEXT NOT NULL,
  intention    TEXT,
  codes        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  origine      TEXT NOT NULL DEFAULT 'utilisateur' CHECK (origine IN ('utilisateur', 'tuteur')),
  cree_le      TEXT NOT NULL,
  modifie_le   TEXT,
  archive      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "isolation_par_compte" ON public.themes;
CREATE POLICY "isolation_par_compte" ON public.themes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS themes_user_created_idx
  ON public.themes (user_id, created_at DESC);
