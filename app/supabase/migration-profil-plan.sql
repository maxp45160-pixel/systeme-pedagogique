-- ====================================================================
-- Migration — plan de travail déclaré (profiles.plan)
--
-- Additive et idempotente : aucun DROP, aucune donnée touchée. À jouer
-- dans Supabase Studio › SQL Editor. `schema.sql` porte la même colonne
-- pour une installation neuve ; les deux peuvent être rejoués sans effet.
--
-- Pourquoi nullable et sans DEFAULT : un plan non déclaré doit rester
-- absent. Une valeur de repli serait une intention prêtée à la personne,
-- exactement ce que le protocole anti-hallucination interdit — comme
-- « l'absence de mesure n'est pas un zéro » pour les niveaux.
-- ====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT;

-- Aucune politique RLS à ajouter : `profil_proprietaire` porte sur la
-- table entière (FOR ALL), la nouvelle colonne en hérite.
