-- Lot 1 — contrat canonique des interventions d'une LearningSession.
--
-- Migration additive et réversible par compatibilité : aucune ligne existante
-- n'est réécrite, `activites` reste lisible par l'adaptateur historique et
-- l'absence de valeur ne devient jamais un tableau fabriqué.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS interventions JSONB;
