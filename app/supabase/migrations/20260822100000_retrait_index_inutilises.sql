-- Retrait des deux index jamais utilisés depuis leur création
-- (advisor lint 0005, relevé du 22/08/2026, décision humaine du même jour) :
--
-- - competences_user_created_idx (user_id, created_at) : aucune requête ne
--   lit les compétences par date de création ; l'entrée se fait par code.
--   Note : absent de schema.sql, il ne vivait qu'en base (dérive corrigée).
-- - moteur_predictions_user_type_emise_idx (user_id, type, emise_le DESC) :
--   les lectures du journal filtrent par cible ou par décision, jamais par
--   type ; les index user_cible et user_decision couvrent déjà les chemins
--   réels.

DROP INDEX IF EXISTS public.competences_user_created_idx;
DROP INDEX IF EXISTS public.moteur_predictions_user_type_emise_idx;
