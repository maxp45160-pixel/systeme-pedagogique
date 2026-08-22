-- Vérification de l'état réel de la base avant le chantier ADR-108.
--
-- Lecture seule. N'écrit rien, ne crée rien, ne joue aucune migration.
-- À exécuter dans le SQL editor Supabase, sur le projet réel.
--
-- Chaque ligne rend `attendu` = true si l'objet décrit par la migration
-- 20260823090000_domaines_hierarchiques_tags est bien en place.
-- Une seule ligne à false = la migration n'est pas (entièrement) appliquée.

WITH controles AS (

  SELECT 1 AS rang, 'domaines.parent_id existe' AS objet,
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'domaines'
        AND column_name = 'parent_id') AS attendu

  UNION ALL SELECT 2, 'contrainte domaines_parent_fkey',
    EXISTS (SELECT 1 FROM pg_constraint
      WHERE conname = 'domaines_parent_fkey'
        AND conrelid = 'public.domaines'::regclass)

  UNION ALL SELECT 3, 'contrainte domaines_parent_pas_soi',
    EXISTS (SELECT 1 FROM pg_constraint
      WHERE conname = 'domaines_parent_pas_soi'
        AND conrelid = 'public.domaines'::regclass)

  UNION ALL SELECT 4, 'index domaines_parent_idx',
    EXISTS (SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'domaines_parent_idx')

  UNION ALL SELECT 5, 'fonction taguer_competences_domaine',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'taguer_competences_domaine')

  UNION ALL SELECT 6, 'fonction deplacer_domaine',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'deplacer_domaine')

  -- Les deux suivantes doivent avoir DISPARU : la migration les retire.
  UNION ALL SELECT 7, 'ancienne rattacher_competences_domaine retiree',
    NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'rattacher_competences_domaine')

  UNION ALL SELECT 8, 'trigger competence_domaines_hors_porteur retire',
    NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgname = 'competence_domaines_hors_porteur' AND NOT tgisinternal)

  -- Le remplissage : chaque compétence doit porter au moins le tag de son
  -- domaine de création. À false, le référentiel migré partirait « À classer ».
  UNION ALL SELECT 9, 'chaque competence est taguee vers son domaine de creation',
    NOT EXISTS (
      SELECT 1 FROM public.competences c
      WHERE NOT EXISTS (
        SELECT 1 FROM public.competence_domaines cd
        WHERE cd.user_id = c.user_id AND cd.code = c.code AND cd.domaine = c.domaine))

  -- Objets dont dépend le chantier ADR-108, indépendamment de la migration.
  UNION ALL SELECT 10, 'table referentiel_changes',
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'referentiel_changes')

  UNION ALL SELECT 11, 'table refus_recommandations',
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'refus_recommandations')

  UNION ALL SELECT 12, 'fonction compte_actif',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'compte_actif')

  -- Doit être false aujourd'hui : c'est ce que ce chantier ajoute.
  UNION ALL SELECT 13, 'fonction scinder_domaine DEJA presente (false attendu)',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'scinder_domaine')

  UNION ALL SELECT 14, 'table propositions_referentiel DEJA presente (false attendu)',
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'propositions_referentiel')
)
SELECT rang, objet, attendu FROM controles ORDER BY rang;

-- Comptes bruts, pour lire l'ampleur du remplissage.
--
-- `parent_id` est lu par `to_jsonb(d)` et non en dur : la colonne peut ne pas
-- exister encore, et une reference directe ferait echouer tout le script au
-- parsing, avant meme que les controles ci-dessus ne rendent leur resultat.
SELECT
  (SELECT count(*) FROM public.competences)         AS competences,
  (SELECT count(*) FROM public.competence_domaines) AS tags_poses,
  (SELECT count(*) FROM public.domaines)            AS domaines,
  (SELECT count(*) FROM public.domaines d
     WHERE coalesce(to_jsonb(d) ->> 'parent_id', '') <> '') AS domaines_avec_parent;
