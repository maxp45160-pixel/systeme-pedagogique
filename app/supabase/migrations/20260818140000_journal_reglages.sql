-- =====================================================================
-- Journal des réglages du moteur — ADR-085
--
-- La contrepartie de l'auto-correction. `CLAUDE.md` interdit de « modifier
-- les seuils de calibration sans données justifiant le changement » : chaque
-- ligne de cette table porte donc, à côté de l'ancienne et de la nouvelle
-- valeur, LA MESURE qui l'a justifiée et son effectif.
--
-- Une ligne = un pas, sur un seul paramètre. Le rejeu du journal depuis les
-- valeurs par défaut du code reconstitue n'importe quel état passé — c'est ce
-- qui rend l'auto-correction réversible sans qu'aucune ligne soit effacée.
--
-- Append-only, comme `moteur_decisions` et `moteur_predictions` : mêmes deux
-- verrous (absence de politique de mutation, puis déclencheur).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.moteur_reglages (
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  applique_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Le nom du paramètre, pas sa valeur par défaut : celle-ci vit dans le code
  -- (`lib/engine/reglages.ts` la relit), et un journal qui la recopierait
  -- divergerait au premier changement de version.
  parametre       TEXT NOT NULL CHECK (length(btrim(parametre)) > 0),
  valeur_avant    DOUBLE PRECISION NOT NULL,
  valeur_apres    DOUBLE PRECISION NOT NULL,
  -- La mesure qui justifie. Sans elle, la ligne serait un changement arbitraire
  -- consigné — c'est-à-dire exactement ce que l'invariant interdit.
  metrique        TEXT NOT NULL CHECK (length(btrim(metrique)) > 0),
  n               INTEGER NOT NULL CHECK (n >= 0),
  valeur_metrique DOUBLE PRECISION NOT NULL,
  motif           TEXT NOT NULL CHECK (length(btrim(motif)) > 0),
  PRIMARY KEY (user_id, id),
  -- Un pas doit changer quelque chose ; une ligne sans effet encombrerait le
  -- rejeu sans rien reconstituer.
  CONSTRAINT moteur_reglages_pas_effectif CHECK (valeur_avant <> valeur_apres)
);

DROP TRIGGER IF EXISTS moteur_reglages_append_only ON public.moteur_reglages;
CREATE TRIGGER moteur_reglages_append_only
  BEFORE UPDATE OR DELETE ON public.moteur_reglages
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_journal_moteur();

ALTER TABLE public.moteur_reglages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moteur_reglages_lecture_compte" ON public.moteur_reglages;
CREATE POLICY "moteur_reglages_lecture_compte" ON public.moteur_reglages
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND public.compte_actif());

DROP POLICY IF EXISTS "moteur_reglages_ecriture_compte" ON public.moteur_reglages;
CREATE POLICY "moteur_reglages_ecriture_compte" ON public.moteur_reglages
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.compte_actif());

REVOKE ALL ON TABLE public.moteur_reglages FROM anon;
GRANT SELECT, INSERT ON TABLE public.moteur_reglages TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.moteur_reglages FROM authenticated;

-- Le rejeu lit tout le journal d'un compte, dans l'ordre.
CREATE INDEX IF NOT EXISTS moteur_reglages_user_applique_idx
  ON public.moteur_reglages (user_id, applique_le);
