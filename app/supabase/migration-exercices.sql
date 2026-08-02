-- ====================================================================
-- Migration — table `exercises`
--
-- Idempotente et ADDITIVE : aucun DROP TABLE, aucune perte de donnée.
-- À appliquer dans Supabase Studio › SQL Editor, AVANT de redéployer.
-- `schema.sql` porte les mêmes définitions pour une installation neuve ;
-- ce fichier existe pour les bases déjà en service.
--
-- Deux changements, indépendants :
--
--   1. `difficulte` TEXT → INTEGER (correctif, 02/08/2026)
--   2. `archive` BOOLEAN (cycle de vie d'un exercice, calque ADR-027)
-- ====================================================================


-- --------------------------------------------------------------------
-- 1. `difficulte` : TEXT → INTEGER
--
-- La colonne était déclarée TEXT alors que le domaine vaut 1..5
-- (`Difficulte`, src/lib/domain/types.ts). `ligneVersEntite` ne coerce
-- pas : un exercice relu depuis la base portait donc `difficulte` en
-- CHAÎNE, et `calibration.ts` faisait `"1" + 0` → `"10"` → borné à 5.
-- Sur DEV-03 / DEV-04, un partiel sur un exercice de difficulté 1
-- conseillait ainsi une difficulté 5. La branche `trop-difficile`
-- donnait `"1" + (-1)` → `"1-1"` → NaN.
--
-- Le cast échoue bruyamment si une ligne n'est pas numérique — c'est
-- voulu : mieux vaut une erreur lisible qu'une conversion silencieuse.
-- --------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'exercises'
      AND column_name  = 'difficulte'
      AND data_type   <> 'integer'
  ) THEN
    ALTER TABLE public.exercises
      ALTER COLUMN difficulte TYPE INTEGER USING difficulte::integer;
    RAISE NOTICE 'exercises.difficulte converti en INTEGER.';
  ELSE
    RAISE NOTICE 'exercises.difficulte est déjà INTEGER — rien à faire.';
  END IF;
END $$;

-- Le domaine est borné côté base, plus seulement côté TypeScript : c'est
-- la même garantie que `competences.importance BETWEEN 0 AND 1`.
ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_difficulte_bornes;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_difficulte_bornes CHECK (difficulte BETWEEN 1 AND 5);


-- --------------------------------------------------------------------
-- 2. `archive` : retrait d'un exercice sans perte de preuves
--
-- Même règle que pour les compétences (ADR-027) : un exercice SANS
-- tentative se supprime franchement, un exercice qui en porte s'archive.
-- Un exercice archivé sort de la recommandation et de la calibration ;
-- les preuves qu'il a produites restent au journal.
-- --------------------------------------------------------------------

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS archive BOOLEAN NOT NULL DEFAULT FALSE;
