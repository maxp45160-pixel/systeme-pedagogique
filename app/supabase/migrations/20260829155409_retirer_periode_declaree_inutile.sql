-- Lot 9 — retrait de la période textuelle non utilisée.
--
-- Prérequis : 20260828201530_lot_9_contexte_declare.sql est déjà appliquée.
-- La période n'alimente ni le planificateur ni le moteur ; elle ne servait
-- qu'à faire avancer l'ancien assistant local. Sa suppression évite de
-- conserver un fait que l'application ne relit plus.
--
-- Cette migration est préparée localement et doit être appliquée après
-- validation de la perte éventuelle des valeurs existantes.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_periode_declaree_non_vide,
  DROP COLUMN IF EXISTS periode_declaree;
