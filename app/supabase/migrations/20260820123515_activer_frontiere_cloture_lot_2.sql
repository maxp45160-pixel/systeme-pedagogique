BEGIN;

-- Phase d'activation, appliquée seulement après publication du code qui passe
-- par public.clore_exercice(). Les fonctions et la RPC ont été installées par
-- la migration additive précédente afin que l'ancienne version reste
-- utilisable pendant le déploiement.

DROP TRIGGER IF EXISTS attempts_cloture_atomique ON public.attempts;
CREATE TRIGGER attempts_cloture_atomique
BEFORE UPDATE ON public.attempts
FOR EACH ROW
EXECUTE FUNCTION public.verifier_cloture_tentative_atomique();

DROP TRIGGER IF EXISTS observations_source_exacte ON public.observations;
CREATE TRIGGER observations_source_exacte
BEFORE INSERT ON public.observations
FOR EACH ROW
EXECUTE FUNCTION public.verifier_source_observation_exacte();

DROP TRIGGER IF EXISTS sessions_exercice_atomique ON public.sessions;
CREATE TRIGGER sessions_exercice_atomique
BEFORE INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.verifier_session_exercice_atomique();

COMMIT;
