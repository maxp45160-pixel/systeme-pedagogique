-- ---------------------------------------------------------------------------
-- Retrait de la boucle projet — ADR-070, 15/08/2026
--
-- Inverse exact de `20260814231505_boucle_projet_minimale`. Décision humaine,
-- prise après mesure : la famille « Produire » avait produit UNE activité, UNE
-- exécution, UN artefact, ZÉRO évaluation et ZÉRO preuve. Le code qui la
-- servait est retiré dans le même geste ; ce qui reste — l'arbitrage temps /
-- capacité de la carte d'action — n'a jamais lu ces tables.
--
-- Ce qui n'est PAS touché, et pourquoi :
--   · `touch_updated_at` porte aussi les triggers de `documents` et
--     `profiles` : la supprimer casserait deux tables vivantes.
--   · `evidence`, `attempts` et `sessions` gardent toutes leurs lignes. Aucune
--     preuve n'a été produite par cette boucle — la vérification est dans
--     l'ADR, pas dans une supposition.
--   · `20260813150000_adaptive_learning_loop.sql` n'a jamais été appliquée
--     (absente de `supabase_migrations.schema_migrations`) : rien à défaire
--     pour elle, son fichier est simplement retiré du dépôt.
-- ---------------------------------------------------------------------------

-- 1. Provenance de projet sur les preuves. Les contraintes partent avant les
--    colonnes, et les colonnes avant les tables qu'elles référencent.
ALTER TABLE public.evidence
  DROP CONSTRAINT IF EXISTS evidence_exact_provenance_check,
  DROP CONSTRAINT IF EXISTS evidence_run_provenance_fkey,
  DROP CONSTRAINT IF EXISTS evidence_artifact_snapshot_fkey;

ALTER TABLE public.evidence
  DROP COLUMN IF EXISTS activity_run_id,
  DROP COLUMN IF EXISTS artifact_snapshot_id,
  DROP COLUMN IF EXISTS provenance_version;

-- 2. Les sept tables, dans l'ordre de leurs dépendances.
DROP TABLE IF EXISTS public.activity_assessments;
DROP TABLE IF EXISTS public.activity_events;
DROP TABLE IF EXISTS public.artifact_snapshots;
DROP TABLE IF EXISTS public.activity_artifacts;
DROP TABLE IF EXISTS public.activity_runs;
DROP TABLE IF EXISTS public.learning_activities;
DROP TABLE IF EXISTS public.learning_command_receipts;

-- 3. Le drapeau de bêta par compte. Plus rien ne le lit : il n'existe plus
--    qu'un seul chemin d'apprentissage.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_learning_loop_mode_check;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS learning_loop_mode;

-- 4. Les commandes transactionnelles de la boucle.
DROP FUNCTION IF EXISTS public.accepter_activite_generee(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.planifier_execution_activite(TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.enregistrer_evenement_activite(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.enregistrer_artefact_activite(TEXT, TEXT, INTEGER, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.cloturer_execution_activite(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.abandonner_execution_activite(TEXT, TEXT, JSONB);

-- 5. Les fonctions de trigger devenues sans porteur. Leurs triggers sont partis
--    avec les tables de l'étape 2 ; vérifié avant écriture : aucune autre table
--    ne les utilisait.
DROP FUNCTION IF EXISTS public.refuser_mutation_append_only();
DROP FUNCTION IF EXISTS public.refuser_mutation_evaluation_finale();
DROP FUNCTION IF EXISTS public.proteger_execution_activite();
DROP FUNCTION IF EXISTS public.proteger_version_activite();
