-- Index couvrant les deux clés étrangères signalées par les advisors
-- (lint 0001 unindexed_foreign_keys, relevé du 22/08/2026) :
--
-- - comptes_acces.suspendu_par : FK vers auth.users(id) ON DELETE SET NULL ;
--   sans index, chaque suppression de compte utilisateur déclenche un scan.
-- - moteur_predictions (user_id, decision_id) : FK composite vers le journal
--   moteur ; les lectures par décision n'ont aucun index qui commence par
--   decision_id.
--
-- Additif pur : aucune donnée touchée.

CREATE INDEX IF NOT EXISTS comptes_acces_suspendu_par_idx
  ON public.comptes_acces (suspendu_par);

CREATE INDEX IF NOT EXISTS moteur_predictions_user_decision_idx
  ON public.moteur_predictions (user_id, decision_id);
