-- Lot 1 — contrat canonique des interventions d'une LearningSession.
--
-- Migration additive et réversible par compatibilité : aucune ligne existante
-- n'est réécrite, `activites` reste lisible par l'adaptateur historique et
-- l'absence de valeur ne devient jamais un tableau fabriqué.
-- Vérification du 28/08/2026 : la colonne est présente dans Supabase réel, mais
-- cette version n'est pas inscrite dans l'historique distant. Ne pas rejouer.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS interventions JSONB;
