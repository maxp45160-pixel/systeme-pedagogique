-- --------------------------------------------------------------------
-- Migration — un exercice se corrige sans se perdre (ADR-047)
--
-- Date : 09/08/2026, lot 6 du chantier de stabilisation.
--
-- ## Ce que cette migration permet
--
-- Il n'existait aucun chemin de modification d'un exercice : `creerExercice`
-- était la seule écriture. Un énoncé ambigu ou une correction fausse n'avaient
-- qu'une issue — l'archivage, c'est-à-dire la mise au rebut du seul contenu
-- disponible pour une compétence qui, le plus souvent, n'en a aucun autre. On
-- jetait au lieu de réparer, sur un corpus produit par un LLM que personne ne
-- relit avant usage.
--
-- `modifie_le` n'est pas décoratif. Une preuve mesure une tentative sur
-- l'énoncé **d'alors** ; corriger le texte ne rend pas cette mesure fausse,
-- mais rend l'exercice affiché différent de celui qui a été fait. Sans cette
-- date, le journal paraît cohérent alors qu'il ne l'est plus.
--
-- ## Propriétés
--
-- **Additive et idempotente.** Aucun `DROP`, aucune donnée touchée, rejouable
-- sans effet. Les exercices existants gardent `modifie_le` à `NULL` : on ne
-- fabrique pas une date de modification pour un exercice que personne n'a
-- modifié (P2).
--
-- **Sans urgence.** Tant qu'elle n'est pas appliquée, l'édition écrit tout sauf
-- cette date, et l'application signale simplement l'absence de trace.
--
-- ## Application
--
-- Supabase Studio › SQL Editor › coller ce fichier › Run.
-- Peut être collée à la suite de `migration-verdict.sql` : les deux sont
-- idempotentes, l'ordre n'a pas d'importance.
-- --------------------------------------------------------------------

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS modifie_le TEXT;

COMMENT ON COLUMN public.exercises.modifie_le IS
  'Date ISO de la dernière correction du contenu (ADR-047). '
  'NULL si l''exercice n''a jamais été retouché. '
  'Sert à signaler qu''une preuve ancienne porte sur un énoncé qui a changé depuis.';

-- --------------------------------------------------------------------
-- Vérification
-- --------------------------------------------------------------------

DO $$
DECLARE
  colonne_posee BOOLEAN;
  retouches INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'exercises'
      AND column_name = 'modifie_le'
  ) INTO colonne_posee;

  SELECT COUNT(*) INTO retouches
  FROM public.exercises WHERE modifie_le IS NOT NULL;

  IF colonne_posee THEN
    RAISE NOTICE 'exercises.modifie_le : posée. % exercice(s) déjà retouché(s).', retouches;
  ELSE
    RAISE WARNING 'exercises.modifie_le : ABSENTE après migration — vérifier les droits.';
  END IF;
END $$;
