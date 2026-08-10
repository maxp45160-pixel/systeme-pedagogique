-- --------------------------------------------------------------------
-- Migration — la séance composée, et la fin du mot « auto-évaluation »
--
-- Date : 10/08/2026, lot 1 du chantier de refonte (ADR-048).
--
-- ## Ce que cette migration fait
--
-- 1. Quatre colonnes additives sur `sessions`, qui font d'une séance
--    mono-exercice une séance composable : statut, date prévue, besoin
--    déclaré, blueprint.
-- 2. Un **renommage** de `attempts.auto_evaluation` en `attempts.evaluation`.
--
-- ## Pourquoi il n'y a pas de nouvelle table
--
-- `LearningSession` existe depuis l'origine et est écrite automatiquement à
-- chaque exercice terminé. Au 10/08/2026, 45 des 46 séances en base sont des
-- séances auto-générées à **une seule activité**. Une séance composée, c'est la
-- même chose avec N activités et un statut. Créer une table `seances` aurait
-- coupé l'historique en deux et laissé 45 lignes hors du nouvel écran.
--
-- Les séances existantes gardent un `statut` à NULL, et le domaine lit cette
-- absence comme « terminée » (`statutSeance`, lib/domain/seance.ts). On ne
-- fabrique pas rétroactivement un statut que personne n'a posé (P2).
--
-- ## ⚠️ Ordre d'application — la seule partie non additive du chantier
--
-- Le §2 est un RENAME. Il préserve les données, il n'est pas rejouable une
-- seconde fois (la garde s'en charge), mais il **casse le code déployé** entre
-- son exécution et la mise en ligne de la version correspondante : l'ancienne
-- version écrit `auto_evaluation`, qui n'existe plus, et lit `autoEvaluation`,
-- qui arrive désormais sous un autre nom.
--
--   ➜ Appliquer cette migration ET déployer dans la même fenêtre.
--
-- Le §1, lui, est sans urgence : tant qu'il n'est pas passé, aucune séance
-- composée ne peut être écrite, et le reste de l'application tourne à
-- l'identique.
--
-- ## Application
--
-- Supabase Studio › SQL Editor › coller ce fichier › Run.
-- `schema.sql` porte les mêmes définitions pour une installation neuve.
-- --------------------------------------------------------------------

-- --------------------------------------------------------------------
-- 1. Les colonnes de séance
--
-- `besoin_declare` et `blueprint` sont en JSONB et non éclatés en colonnes :
-- leur forme appartient au domaine (`BesoinDeclare`, `BlueprintSeance`), elle
-- n'est jamais interrogée champ par champ en SQL, et l'élargir ne doit pas
-- demander une migration à chaque fois. Même raisonnement que
-- `attempts.verdict_tuteur` (ADR-046).
-- --------------------------------------------------------------------

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS statut          TEXT,
  ADD COLUMN IF NOT EXISTS planifiee_pour  TEXT,
  ADD COLUMN IF NOT EXISTS besoin_declare  JSONB,
  ADD COLUMN IF NOT EXISTS blueprint       JSONB;

-- La contrainte n'a pas d'`IF NOT EXISTS` en PostgreSQL : la garde est
-- explicite, sinon un second passage échouerait et l'idempotence serait perdue.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_statut_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_statut_check
      CHECK (statut IS NULL OR statut IN ('planifiee', 'en-cours', 'terminee'));
  END IF;
END $$;

COMMENT ON COLUMN public.sessions.statut IS
  'Où en est la séance (ADR-048). NULL = séance historique auto-générée, donc terminée : '
  'lu par statutSeance() dans lib/domain/seance.ts, jamais interprété ailleurs.';

COMMENT ON COLUMN public.sessions.besoin_declare IS
  'Ce que la personne a DÉCLARÉ vouloir avant la séance (ADR-050) : intention, codes visés, '
  'temps disponible, date. Fait observé et daté, stocké verbatim. Ce n''est PAS une mesure : '
  'l''écart avec le réalisé est dérivé à la lecture, jamais écrit, et jamais agrégé en score.';

COMMENT ON COLUMN public.sessions.blueprint IS
  'Le cahier des charges qui a produit la composition (ADR-049) : durée cible, nombre '
  'd''exercices, portée, cibles retenues avec leur raison. Traçabilité seule — le moteur ne '
  'le relit jamais pour en dériver quoi que ce soit.';

-- --------------------------------------------------------------------
-- 2. attempts.auto_evaluation → attempts.evaluation
--
-- Le préfixe promettait ce que le produit ne fait plus : depuis ADR-046 le
-- tuteur propose un verdict critère par critère, et ce que la personne valide
-- est une évaluation assistée. Le mot tombe de l'interface, du champ TypeScript
-- et de la colonne dans le même geste — un vocabulaire renommé à moitié est
-- pire que celui qu'il remplace.
--
-- RENAME et non ADD + copie + DROP : le renommage préserve les 47 lignes sans
-- fenêtre pendant laquelle deux colonnes diraient la même chose.
--
-- Le mapping camelCase ↔ snake_case de `supabase-backend.ts` n'a pas de table
-- d'exceptions, volontairement. C'est ce qui oblige la colonne à suivre le
-- champ : `evaluation` ↔ `evaluation`, sans cas particulier à maintenir.
-- --------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts'
      AND column_name = 'auto_evaluation'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts'
      AND column_name = 'evaluation'
  ) THEN
    ALTER TABLE public.attempts RENAME COLUMN auto_evaluation TO evaluation;
    RAISE NOTICE 'attempts.auto_evaluation renommée en attempts.evaluation.';
  ELSE
    RAISE NOTICE 'attempts.evaluation : renommage déjà effectué, rien à faire.';
  END IF;
END $$;

COMMENT ON COLUMN public.attempts.evaluation IS
  'Évaluation par critère, après lecture de la correction. Nommée auto_evaluation jusqu''au '
  '10/08/2026. C''est LA mesure de la tentative — ce que la personne a validé, à distinguer '
  'de verdict_tuteur, qui n''est que ce qui lui a été proposé.';

-- --------------------------------------------------------------------
-- 3. La fonction charger_tout n'a rien à changer
--
-- Elle renvoie `row_to_json(s)` pour chaque table : les colonnes ajoutées ou
-- renommées y apparaissent d'elles-mêmes. C'est aussi pour cela qu'elle ne
-- casse pas ici, alors qu'une liste de colonnes écrite à la main l'aurait fait.
-- --------------------------------------------------------------------

-- --------------------------------------------------------------------
-- 4. Vérification
--
-- À lire après exécution.
-- --------------------------------------------------------------------

DO $$
DECLARE
  colonnes_seance INTEGER;
  evaluation_posee BOOLEAN;
  ancienne_restante BOOLEAN;
  seances_sans_statut INTEGER;
BEGIN
  SELECT COUNT(*) INTO colonnes_seance
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'sessions'
    AND column_name IN ('statut', 'planifiee_pour', 'besoin_declare', 'blueprint');

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'evaluation'
  ) INTO evaluation_posee;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'auto_evaluation'
  ) INTO ancienne_restante;

  SELECT COUNT(*) INTO seances_sans_statut FROM public.sessions WHERE statut IS NULL;

  IF colonnes_seance = 4 THEN
    RAISE NOTICE 'sessions : 4 colonnes de séance posées. % séance(s) historique(s) sans statut, lues comme terminées.', seances_sans_statut;
  ELSE
    RAISE WARNING 'sessions : % colonne(s) sur 4 seulement — vérifier les droits.', colonnes_seance;
  END IF;

  IF evaluation_posee AND NOT ancienne_restante THEN
    RAISE NOTICE 'attempts.evaluation : renommage effectif, auto_evaluation absente.';
  ELSIF evaluation_posee AND ancienne_restante THEN
    RAISE WARNING 'attempts : les DEUX colonnes existent. Le code écrit dans evaluation ; auto_evaluation est orpheline et doit être traitée à la main.';
  ELSE
    RAISE WARNING 'attempts.evaluation : ABSENTE. Le code déployé ne pourra ni lire ni écrire les évaluations.';
  END IF;
END $$;
