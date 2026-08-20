-- Lot 1 Twiny (ADR-090) : rupture complete du concept historique
-- `evidence` vers `observations`, sans alias ni coexistence.
--
-- Le renommage conserve l'OID de la table, donc ses lignes, droits, RLS et
-- politique. Les controles avant/apres utilisent un tableau JSON ordonne dont
-- les positions sont independantes des noms de table et de colonne.

BEGIN;

LOCK TABLE public.evidence IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE twiny_lot1_observations_audit (
  total BIGINT NOT NULL,
  distinct_keys BIGINT NOT NULL,
  min_date TEXT,
  max_date TEXT,
  min_created_at TIMESTAMPTZ,
  max_created_at TIMESTAMPTZ,
  fingerprint_md5 TEXT NOT NULL,
  orphan_profiles BIGINT NOT NULL,
  orphan_competences BIGINT NOT NULL
) ON COMMIT DROP;

INSERT INTO twiny_lot1_observations_audit
SELECT
  count(*),
  count(DISTINCT (e.user_id, e.id)),
  min(e.date),
  max(e.date),
  min(e.created_at),
  max(e.created_at),
  md5(coalesce(jsonb_agg(
    jsonb_build_array(
      e.user_id, e.id, e.skill_code, e.date, e.type, e.niveau_preuve,
      e.autonomie, e.qualite, e.resultat, e.contexte, e.dimensions,
      e.competences_combinees, e.source, e.commentaire, e.created_at
    ) ORDER BY e.user_id, e.id
  )::TEXT, '[]')),
  count(*) FILTER (WHERE p.id IS NULL),
  count(*) FILTER (WHERE c.code IS NULL)
FROM public.evidence e
LEFT JOIN public.profiles p ON p.id = e.user_id
LEFT JOIN public.competences c
  ON c.user_id = e.user_id AND c.code = e.skill_code;

ALTER TABLE public.evidence RENAME TO observations;
ALTER TABLE public.observations RENAME COLUMN niveau_preuve TO niveau_observation;

ALTER TABLE public.observations
  RENAME CONSTRAINT evidence_pkey TO observations_pkey;
ALTER TABLE public.observations
  RENAME CONSTRAINT evidence_user_id_fkey TO observations_user_id_fkey;
ALTER TABLE public.observations
  RENAME CONSTRAINT evidence_competence_fk TO observations_competence_fk;

ALTER INDEX public.evidence_user_created_idx
  RENAME TO observations_user_created_idx;
ALTER INDEX public.evidence_user_skill_idx
  RENAME TO observations_user_skill_idx;

-- La definition distante de cette fonction a diverge du schema de reference
-- sur un comportement sans rapport avec ce lot. On preserve donc exactement
-- la definition effectivement active et on ne remplace que sa table lue.
DO $migration$
DECLARE
  definition_active TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.appliquer_commande_referentiel(text,integer,text,text,jsonb)'::regprocedure
  ) INTO definition_active;

  definition_active := replace(
    definition_active,
    'public.evidence',
    'public.observations'
  );

  IF position('public.evidence' IN definition_active) > 0
     OR position('public.observations' IN definition_active) = 0 THEN
    RAISE EXCEPTION
      'La definition de appliquer_commande_referentiel n''a pas ete adaptee.';
  END IF;

  EXECUTE definition_active;
END;
$migration$;

-- `charger_tout()` conserve toutes ses cles actuelles et rompt uniquement le
-- contrat historique : table et cle JSON deviennent `observations`.
DO $migration$
DECLARE
  definition_active TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.charger_tout()'::regprocedure)
  INTO definition_active;

  definition_active := replace(definition_active, 'evidence', 'observations');

  IF position('evidence' IN definition_active) > 0
     OR position('observations' IN definition_active) = 0 THEN
    RAISE EXCEPTION 'La definition de charger_tout n''a pas ete adaptee.';
  END IF;

  EXECUTE definition_active;
END;
$migration$;

-- Le nom d'une colonne OUT appartient au type de retour PostgreSQL : la
-- fonction doit etre supprimee puis recreee. La definition active porte avec
-- elle SECURITY DEFINER, STABLE et son search_path securise.
DO $migration$
DECLARE
  definition_active TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.admin_comptes()'::regprocedure)
  INTO definition_active;

  definition_active := replace(definition_active, 'preuves bigint', 'observations bigint');
  definition_active := replace(definition_active, 'public.evidence', 'public.observations');

  IF position('preuves bigint' IN definition_active) > 0
     OR position('public.evidence' IN definition_active) > 0
     OR position('observations bigint' IN definition_active) = 0
     OR position('public.observations' IN definition_active) = 0 THEN
    RAISE EXCEPTION 'La definition de admin_comptes n''a pas ete adaptee.';
  END IF;

  DROP FUNCTION public.admin_comptes();
  EXECUTE definition_active;
END;
$migration$;

REVOKE ALL ON FUNCTION public.appliquer_commande_referentiel(TEXT, INTEGER, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appliquer_commande_referentiel(TEXT, INTEGER, TEXT, TEXT, JSONB)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_comptes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_comptes() TO authenticated, service_role;

DO $verification$
DECLARE
  avant twiny_lot1_observations_audit%ROWTYPE;
  apres twiny_lot1_observations_audit%ROWTYPE;
BEGIN
  SELECT * INTO avant FROM twiny_lot1_observations_audit;

  SELECT
    count(*),
    count(DISTINCT (o.user_id, o.id)),
    min(o.date),
    max(o.date),
    min(o.created_at),
    max(o.created_at),
    md5(coalesce(jsonb_agg(
      jsonb_build_array(
        o.user_id, o.id, o.skill_code, o.date, o.type, o.niveau_observation,
        o.autonomie, o.qualite, o.resultat, o.contexte, o.dimensions,
        o.competences_combinees, o.source, o.commentaire, o.created_at
      ) ORDER BY o.user_id, o.id
    )::TEXT, '[]')),
    count(*) FILTER (WHERE p.id IS NULL),
    count(*) FILTER (WHERE c.code IS NULL)
  INTO apres
  FROM public.observations o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  LEFT JOIN public.competences c
    ON c.user_id = o.user_id AND c.code = o.skill_code;

  IF apres IS DISTINCT FROM avant THEN
    RAISE EXCEPTION
      'Conservation des observations invalide. Avant: %, apres: %', avant, apres;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'observations'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS inactive ou table observations absente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'observations'
      AND policyname = 'isolation_par_compte'
  ) THEN
    RAISE EXCEPTION 'Politique isolation_par_compte absente des observations.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evidence'
  ) THEN
    RAISE EXCEPTION 'L''ancienne relation public.evidence existe encore.';
  END IF;
END;
$verification$;

COMMIT;
