-- ====================================================================
-- Migration — `exercises.intention`
--
-- Idempotente et ADDITIVE : aucun DROP, aucune perte de donnée.
-- À appliquer dans Supabase Studio › SQL Editor. Sans urgence : la colonne
-- est nullable et le code lit `undefined` en son absence — rien ne casse
-- avant son application, rien ne casse après (contrairement au §2 de
-- `migration-seances.sql`, qui renomme une colonne lue par le code déployé).
-- `schema.sql` porte la même définition pour une installation neuve ; ce
-- fichier existe pour les bases déjà en service.
--
-- Pourquoi cet exercice a été écrit — découverte / consolidation /
-- transfert / révision — pas une mesure, pas un signal lu par le moteur
-- (`recommend.ts`, `calibration.ts` l'ignorent). Les exercices existants
-- restent à NULL : aucune valeur n'est déduite après coup.
-- ====================================================================

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS intention TEXT;

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_intention_valeurs;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_intention_valeurs
  CHECK (intention IS NULL OR intention IN ('decouverte', 'consolidation', 'transfert', 'revision'));
