BEGIN;

-- Boucle projet — périmètre minimal : générer, réaliser, évaluer.
--
-- Extrait de `20260813150000_adaptive_learning_loop.sql` (restée locale, jamais
-- déployée) réduit à ce que la modale de projet exige réellement. Sont écartés,
-- volontairement :
--
--   * `learning_goals`, `learning_goal_targets` et leur commande — les objectifs
--     déclarés sont un autre chantier ;
--   * `activity_templates` — aucun modèle configurable par compte n'est requis
--     pour générer un projet ;
--   * `recommendation_checkins`, `recommendation_interactions` — le contexte
--     d'instant vit dans l'URL et n'est pas persisté (amendement ADR-066) ;
--   * `evidence_status_events` et `rectifier_preuve` — la rectification d'une
--     preuve est un geste distinct ;
--   * `cloturer_exercice` et la réécriture des policies de `evidence` — elles
--     casseraient la soumission d'exercice, qui écrit encore ses preuves en
--     insertion directe. `isolation_par_compte` reste donc en place.
--
-- Est écarté aussi, et c'est une décision de produit : **le lien aux séances**.
-- Un projet n'est pas une séance. Il ne réclame pas de séance ouverte, n'en
-- crée pas, n'en clôt pas. Son déroulé est la suite de ses propres événements,
-- et sa durée s'en dérive — rien n'a besoin d'être stocké pour cela.

-- ---------------------------------------------------------------------------
-- 1. Colonnes additives sur l'existant
-- ---------------------------------------------------------------------------

-- Drapeau de bêta par compte. `legacy` par défaut : appliquer cette migration
-- ne change le comportement d'aucun compte tant qu'il n'est pas basculé.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learning_loop_mode TEXT NOT NULL DEFAULT 'legacy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_learning_loop_mode_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_learning_loop_mode_check
      CHECK (learning_loop_mode IN ('legacy', 'adaptive-v1'));
  END IF;
END;
$$;

-- Provenance exacte d'une preuve de projet. Les lignes historiques restent
-- lisibles avec `provenance_version` NULL ; une preuve v2 doit porter son
-- exécution et son snapshot, sans quoi sa source ne serait pas vérifiable.
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS provenance_version INTEGER,
  ADD COLUMN IF NOT EXISTS activity_run_id TEXT,
  ADD COLUMN IF NOT EXISTS artifact_snapshot_id TEXT;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.learning_activities (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  family TEXT NOT NULL CHECK (family IN ('explorer', 'entrainer', 'produire')),
  target JSONB NOT NULL CHECK (jsonb_typeof(target) = 'object'),
  estimated_duration_minutes INTEGER NOT NULL CHECK (estimated_duration_minutes BETWEEN 1 AND 480),
  minimum_segment_minutes INTEGER CHECK (
    minimum_segment_minutes BETWEEN 1 AND 480
    AND minimum_segment_minutes <= estimated_duration_minutes
  ),
  cognitive_demand TEXT NOT NULL CHECK (cognitive_demand IN ('faible', 'standard', 'elevee')),
  proof_mode TEXT NOT NULL CHECK (
    proof_mode IN ('support-seul', 'soumission-finale', 'jalons-contractuels')
  ),
  workspace TEXT NOT NULL CHECK (
    workspace IN ('exploration-guidee', 'exercice-trois-actes', 'mini-projet')
  ),
  required_tools TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  authorized_resources JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(authorized_resources) = 'array'),
  evaluation_contract JSONB NOT NULL CHECK (jsonb_typeof(evaluation_contract) = 'object'),
  workspace_content JSONB CHECK (workspace_content IS NULL OR jsonb_typeof(workspace_content) = 'object'),
  origin TEXT NOT NULL CHECK (origin IN ('application', 'tuteur', 'utilisateur', 'legacy-adapter')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archivee')),
  archived_at TIMESTAMPTZ,
  archived_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id, version),
  CONSTRAINT learning_activities_exploration_support_check CHECK (
    family <> 'explorer' OR proof_mode = 'support-seul'
  ),
  CONSTRAINT learning_activities_archive_check CHECK (
    status <> 'archivee' OR archived_at IS NOT NULL
  )
);

CREATE TABLE public.activity_runs (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  activity_version INTEGER NOT NULL CHECK (activity_version > 0),
  status TEXT NOT NULL DEFAULT 'planifiee' CHECK (
    status IN ('planifiee', 'en-cours', 'en-pause', 'terminee', 'abandonnee')
  ),
  current_artifact JSONB,
  active_milestone_id TEXT,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, activity_id, activity_version)
    REFERENCES public.learning_activities(user_id, id, version)
);

-- Un seul artefact courant par exécution, versionné pour refuser l'écrasement
-- concurrent. L'historique n'est pas ici : il est dans les snapshots.
CREATE TABLE public.activity_artifacts (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(content) = 'object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, run_id),
  FOREIGN KEY (user_id, run_id)
    REFERENCES public.activity_runs(user_id, id) ON DELETE RESTRICT
);

-- Un artefact gelé. Sans lui, aucune preuve : une production encore modifiable
-- ne démontre rien de vérifiable.
CREATE TABLE public.artifact_snapshots (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('markdown', 'structure', 'fichier', 'export', 'commit', 'copie')),
  activity_run_id TEXT NOT NULL,
  document_snapshot_id TEXT,
  storage_path TEXT,
  commit_ref TEXT,
  content_hash TEXT,
  content JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, activity_run_id)
    REFERENCES public.activity_runs(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, document_snapshot_id)
    REFERENCES public.document_snapshots(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT artifact_snapshots_frozen_check CHECK (
    document_snapshot_id IS NOT NULL
    OR storage_path IS NOT NULL
    OR commit_ref IS NOT NULL
    OR content IS NOT NULL
  )
);

-- Le déroulé du projet, append-only. Aucune colonne de séance : un projet
-- n'emprunte pas le conteneur d'un autre geste de travail.
CREATE TABLE public.activity_events (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN ('demarrage', 'pause', 'reprise', 'jalon', 'aide', 'changement-mode', 'cloture', 'abandon')
  ),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id, type),
  FOREIGN KEY (user_id, run_id)
    REFERENCES public.activity_runs(user_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.activity_assessments (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  activity_version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('proposition-tuteur', 'validation-humaine')),
  proposed_assessment_id TEXT,
  scope JSONB NOT NULL CHECK (jsonb_typeof(scope) = 'object'),
  criteria JSONB NOT NULL CHECK (jsonb_typeof(criteria) = 'array'),
  result TEXT CHECK (result IS NULL OR result IN ('reussi', 'partiel', 'echec')),
  autonomy TEXT CHECK (autonomy IS NULL OR autonomy IN ('A0', 'A1', 'A2', 'A3', 'A4')),
  artifact_snapshot_id TEXT,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id),
  FOREIGN KEY (user_id, run_id)
    REFERENCES public.activity_runs(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, activity_id, activity_version)
    REFERENCES public.learning_activities(user_id, id, version),
  FOREIGN KEY (user_id, proposed_assessment_id)
    REFERENCES public.activity_assessments(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, artifact_snapshot_id)
    REFERENCES public.artifact_snapshots(user_id, id) ON DELETE RESTRICT,
  -- Une proposition du tuteur ne porte ni résultat ni autonomie : elle ne mesure
  -- rien. Seule la validation humaine en porte.
  CONSTRAINT activity_assessments_proposal_check CHECK (
    (
      kind = 'proposition-tuteur'
      AND proposed_assessment_id IS NULL
      AND result IS NULL
      AND autonomy IS NULL
    )
    OR (
      kind = 'validation-humaine'
      AND result IS NOT NULL
      AND autonomy IS NOT NULL
    )
  )
);

-- Idempotence des commandes : une même requête rejouée rend son premier
-- résultat au lieu d'écrire deux fois.
CREATE TABLE public.learning_command_receipts (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  command TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, request_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_run_provenance_fkey') THEN
    ALTER TABLE public.evidence ADD CONSTRAINT evidence_run_provenance_fkey
      FOREIGN KEY (user_id, activity_run_id)
      REFERENCES public.activity_runs(user_id, id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_artifact_snapshot_fkey') THEN
    ALTER TABLE public.evidence ADD CONSTRAINT evidence_artifact_snapshot_fkey
      FOREIGN KEY (user_id, artifact_snapshot_id)
      REFERENCES public.artifact_snapshots(user_id, id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_exact_provenance_check') THEN
    ALTER TABLE public.evidence ADD CONSTRAINT evidence_exact_provenance_check CHECK (
      (
        provenance_version IS NULL
        AND activity_run_id IS NULL
        AND artifact_snapshot_id IS NULL
      )
      OR (
        provenance_version = 2
        AND activity_run_id IS NOT NULL
        AND artifact_snapshot_id IS NOT NULL
      )
    );
  END IF;
END;
$$;

CREATE INDEX learning_activities_user_family_status_idx
  ON public.learning_activities(user_id, family, status, created_at DESC);
CREATE INDEX activity_runs_user_status_idx
  ON public.activity_runs(user_id, status, created_at DESC);
CREATE INDEX activity_events_user_run_date_idx
  ON public.activity_events(user_id, run_id, created_at);
CREATE INDEX activity_assessments_user_run_date_idx
  ON public.activity_assessments(user_id, run_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. Gardes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refuser_mutation_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- La suppression explicite d'un compte doit pouvoir cascader ses données.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% est append-only', TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION public.refuser_mutation_evaluation_finale()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.kind = 'validation-humaine' THEN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = OLD.user_id
    ) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Une évaluation humaine finale est append-only';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_execution_activite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.activity_id IS DISTINCT FROM OLD.activity_id
    OR NEW.activity_version IS DISTINCT FROM OLD.activity_version
  THEN
    RAISE EXCEPTION 'La version d’activité d’une exécution est immuable';
  END IF;
  IF OLD.status IN ('terminee', 'abandonnee') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Une exécution terminale est immuable';
  END IF;
  IF (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.started_at IS DISTINCT FROM OLD.started_at
    OR NEW.paused_at IS DISTINCT FROM OLD.paused_at
    OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
    OR NEW.abandoned_at IS DISTINCT FROM OLD.abandoned_at
    OR NEW.active_milestone_id IS DISTINCT FROM OLD.active_milestone_id
    OR NEW.current_artifact IS DISTINCT FROM OLD.current_artifact
  ) AND current_setting('app.learning_command', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Les transitions d’exécution passent par une commande transactionnelle';
  END IF;
  RETURN NEW;
END;
$$;

-- Une version d'activité déjà ouverte ne se réécrit pas : le travail fait
-- l'a été sous ce contrat-là. Seul l'archivage reste permis.
CREATE OR REPLACE FUNCTION public.proteger_version_activite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.activity_runs
    WHERE user_id = OLD.user_id AND activity_id = OLD.id AND activity_version = OLD.version
  ) AND (
    to_jsonb(NEW) - ARRAY['status', 'archived_at', 'archived_reason', 'updated_at']::TEXT[]
    IS DISTINCT FROM
    to_jsonb(OLD) - ARRAY['status', 'archived_at', 'archived_reason', 'updated_at']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'Une version d''activité utilisée est immuable ; créez une nouvelle version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER artifact_snapshots_append_only
  BEFORE UPDATE OR DELETE ON public.artifact_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER activity_events_append_only
  BEFORE UPDATE OR DELETE ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER learning_command_receipts_append_only
  BEFORE UPDATE OR DELETE ON public.learning_command_receipts
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER activity_assessments_final_append_only
  BEFORE UPDATE OR DELETE ON public.activity_assessments
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_evaluation_finale();
CREATE TRIGGER activity_runs_protected
  BEFORE UPDATE ON public.activity_runs
  FOR EACH ROW EXECUTE FUNCTION public.proteger_execution_activite();
CREATE TRIGGER learning_activities_version_protected
  BEFORE UPDATE ON public.learning_activities
  FOR EACH ROW EXECUTE FUNCTION public.proteger_version_activite();
CREATE TRIGGER learning_activities_touch_updated_at
  BEFORE UPDATE ON public.learning_activities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER activity_artifacts_touch_updated_at
  BEFORE UPDATE ON public.activity_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'learning_activities', 'activity_runs', 'activity_artifacts',
    'artifact_snapshots', 'activity_events', 'activity_assessments',
    'learning_command_receipts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)',
      t || '_select_own', t
    );
  END LOOP;
END;
$$;

CREATE POLICY learning_activities_insert_own
  ON public.learning_activities FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY learning_activities_update_own
  ON public.learning_activities FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY activity_runs_insert_own
  ON public.activity_runs FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND status = 'planifiee');
CREATE POLICY activity_runs_update_own
  ON public.activity_runs FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Les écritures qui engagent une trace ne passent que par une commande :
-- `app.learning_command` n'est posé que dans une RPC, et seulement pour la
-- durée de sa transaction.
CREATE POLICY activity_artifacts_command_insert
  ON public.activity_artifacts FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select current_setting('app.learning_command', true)) = 'on'
  );
CREATE POLICY activity_artifacts_command_update
  ON public.activity_artifacts FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND (select current_setting('app.learning_command', true)) = 'on'
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select current_setting('app.learning_command', true)) = 'on'
  );
CREATE POLICY artifact_snapshots_command_insert
  ON public.artifact_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select current_setting('app.learning_command', true)) = 'on'
  );
CREATE POLICY activity_events_command_insert
  ON public.activity_events FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select current_setting('app.learning_command', true)) = 'on'
  );
CREATE POLICY activity_assessments_command_insert
  ON public.activity_assessments FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select current_setting('app.learning_command', true)) = 'on'
  );
CREATE POLICY learning_command_receipts_command_insert
  ON public.learning_command_receipts FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select current_setting('app.learning_command', true)) = 'on'
  );

-- ---------------------------------------------------------------------------
-- 5. Commandes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accepter_activite_generee(
  p_request_id TEXT,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire'; END IF;
  IF p_payload #>> '{activity,family}' NOT IN ('explorer', 'produire') THEN
    RAISE EXCEPTION 'Seules les générations Explorer et Produire sont acceptées ici';
  END IF;
  IF p_payload #>> '{run,status}' <> 'planifiee' THEN
    RAISE EXCEPTION 'Une exécution acceptée commence planifiée';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  INSERT INTO public.learning_activities (
    user_id, id, version, title, description, family, target,
    estimated_duration_minutes, minimum_segment_minutes, cognitive_demand,
    proof_mode, workspace, required_tools, authorized_resources,
    evaluation_contract, workspace_content, origin, status
  ) VALUES (
    v_uid, p_payload #>> '{activity,id}', (p_payload #>> '{activity,version}')::INTEGER,
    p_payload #>> '{activity,title}', p_payload #>> '{activity,description}',
    p_payload #>> '{activity,family}', p_payload #> '{activity,target}',
    (p_payload #>> '{activity,estimatedDurationMinutes}')::INTEGER,
    (p_payload #>> '{activity,minimumSegmentMinutes}')::INTEGER,
    p_payload #>> '{activity,cognitiveDemand}', p_payload #>> '{activity,proofMode}',
    p_payload #>> '{activity,workspace}',
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload #> '{activity,requiredTools}', '[]'::JSONB))),
    coalesce(p_payload #> '{activity,authorizedResources}', '[]'::JSONB),
    p_payload #> '{activity,evaluationContract}', p_payload #> '{activity,workspaceContent}',
    'tuteur', 'active'
  );
  INSERT INTO public.activity_runs (
    user_id, id, activity_id, activity_version, status
  ) VALUES (
    v_uid, p_payload #>> '{run,id}', p_payload #>> '{activity,id}',
    (p_payload #>> '{activity,version}')::INTEGER, 'planifiee'
  );
  INSERT INTO public.activity_artifacts (user_id, run_id, content)
    VALUES (v_uid, p_payload #>> '{run,id}', '{}'::JSONB);

  v_result := jsonb_build_object(
    'activityId', p_payload #>> '{activity,id}',
    'activityVersion', p_payload #>> '{activity,version}',
    'runId', p_payload #>> '{run,id}'
  );
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'accepter_activite_generee', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.planifier_execution_activite(
  p_request_id TEXT,
  p_activity_id TEXT,
  p_activity_version INTEGER,
  p_run_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0
    OR length(btrim(coalesce(p_activity_id, ''))) = 0
    OR length(btrim(coalesce(p_run_id, ''))) = 0
    OR p_activity_version IS NULL
    OR p_activity_version < 1
  THEN
    RAISE EXCEPTION 'Paramètres de planification invalides';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.learning_activities
    WHERE user_id = v_uid AND id = p_activity_id
      AND version = p_activity_version AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Version d’activité active introuvable';
  END IF;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  INSERT INTO public.activity_runs (user_id, id, activity_id, activity_version, status)
    VALUES (v_uid, p_run_id, p_activity_id, p_activity_version, 'planifiee');
  INSERT INTO public.activity_artifacts (user_id, run_id, content)
    VALUES (v_uid, p_run_id, '{}'::JSONB)
    ON CONFLICT DO NOTHING;

  v_result := jsonb_build_object(
    'runId', p_run_id, 'activityId', p_activity_id,
    'activityVersion', p_activity_version, 'status', 'planifiee'
  );
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'planifier_execution_activite', v_result);
  RETURN v_result;
END;
$$;

-- Les événements non terminaux d'un projet. Aucune séance n'est requise,
-- créée ni close : le projet porte son propre déroulé.
CREATE OR REPLACE FUNCTION public.enregistrer_evenement_activite(
  p_request_id TEXT,
  p_run_id TEXT,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_run public.activity_runs%ROWTYPE;
  v_type TEXT := p_payload ->> 'type';
  v_result JSONB;
  v_existing_event_id TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0
    OR length(btrim(coalesce(p_payload ->> 'eventId', ''))) = 0
  THEN
    RAISE EXCEPTION 'request_id et eventId obligatoires';
  END IF;
  IF v_type NOT IN ('demarrage', 'pause', 'reprise', 'jalon', 'aide', 'changement-mode') THEN
    RAISE EXCEPTION 'Type d’événement non terminal invalide';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  SELECT * INTO v_run FROM public.activity_runs
    WHERE user_id = v_uid AND id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exécution introuvable'; END IF;

  IF (v_type = 'demarrage' AND v_run.status <> 'planifiee')
    OR (v_type = 'reprise' AND v_run.status <> 'en-pause')
    OR (v_type = 'pause' AND v_run.status <> 'en-cours')
    OR (v_type IN ('jalon', 'aide', 'changement-mode') AND v_run.status <> 'en-cours')
  THEN
    RAISE EXCEPTION 'Transition incompatible avec l’état de l’exécution';
  END IF;

  IF v_type = 'jalon' THEN
    IF length(btrim(coalesce(p_payload #>> '{event,milestoneId}', ''))) = 0
      OR coalesce(p_payload #>> '{event,state}', '') NOT IN ('atteint', 'soumis')
      OR NOT EXISTS (
        SELECT 1
        FROM public.learning_activities activity,
          jsonb_array_elements(coalesce(activity.workspace_content -> 'milestones', '[]'::JSONB)) milestone
        WHERE activity.user_id = v_uid
          AND activity.id = v_run.activity_id
          AND activity.version = v_run.activity_version
          AND milestone ->> 'id' = p_payload #>> '{event,milestoneId}'
      )
    THEN
      RAISE EXCEPTION 'Le jalon n’appartient pas à la version de l’activité';
    END IF;
    -- Un jalon déjà observé ne se réobserve pas : on rend la trace d'origine.
    SELECT id INTO v_existing_event_id
    FROM public.activity_events
    WHERE user_id = v_uid AND run_id = p_run_id AND type = 'jalon'
      AND payload ->> 'milestoneId' = p_payload #>> '{event,milestoneId}'
    ORDER BY created_at
    LIMIT 1;
    IF FOUND THEN
      PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
      v_result := jsonb_build_object(
        'runId', p_run_id, 'eventId', v_existing_event_id,
        'type', v_type, 'alreadyObserved', true
      );
      INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
        VALUES (v_uid, p_request_id, 'enregistrer_evenement_activite', v_result);
      RETURN v_result;
    END IF;
  END IF;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  UPDATE public.activity_runs SET
    status = CASE
      WHEN v_type IN ('demarrage', 'reprise') THEN 'en-cours'
      WHEN v_type = 'pause' THEN 'en-pause'
      ELSE status
    END,
    started_at = CASE
      WHEN v_type = 'demarrage' THEN coalesce((p_payload ->> 'occurredAt')::TIMESTAMPTZ, NOW())
      ELSE started_at END,
    paused_at = CASE
      WHEN v_type = 'pause' THEN coalesce((p_payload ->> 'occurredAt')::TIMESTAMPTZ, NOW())
      WHEN v_type = 'reprise' THEN NULL
      ELSE paused_at END,
    active_milestone_id = CASE
      WHEN v_type = 'jalon' THEN p_payload #>> '{event,milestoneId}'
      ELSE active_milestone_id END,
    current_artifact = coalesce(p_payload -> 'currentArtifact', current_artifact)
  WHERE user_id = v_uid AND id = p_run_id;

  INSERT INTO public.activity_events (user_id, id, run_id, request_id, type, payload, created_at)
  VALUES (
    v_uid, p_payload ->> 'eventId', p_run_id, p_request_id, v_type,
    coalesce(p_payload -> 'event', '{}'::JSONB),
    coalesce((p_payload ->> 'occurredAt')::TIMESTAMPTZ, NOW())
  );

  v_result := jsonb_build_object('runId', p_run_id, 'eventId', p_payload ->> 'eventId', 'type', v_type);
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'enregistrer_evenement_activite', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.enregistrer_artefact_activite(
  p_request_id TEXT,
  p_run_id TEXT,
  p_expected_version INTEGER,
  p_content JSONB,
  p_current_artifact JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_run_status TEXT;
  v_current_version INTEGER;
  v_next_version INTEGER;
  v_has_artifact BOOLEAN;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0
    OR p_expected_version IS NULL
    OR p_expected_version < 0
    OR jsonb_typeof(p_content) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_current_artifact) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Sauvegarde d’artefact invalide';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  SELECT status INTO v_run_status FROM public.activity_runs
    WHERE user_id = v_uid AND id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exécution introuvable'; END IF;
  IF v_run_status <> 'en-cours' THEN
    RAISE EXCEPTION 'Seule une exécution en cours accepte une sauvegarde';
  END IF;

  SELECT version INTO v_current_version FROM public.activity_artifacts
    WHERE user_id = v_uid AND run_id = p_run_id FOR UPDATE;
  v_has_artifact := FOUND;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  IF v_has_artifact THEN
    IF v_current_version <> p_expected_version THEN
      RAISE EXCEPTION 'Conflit de version de l’artefact';
    END IF;
    v_next_version := v_current_version + 1;
    UPDATE public.activity_artifacts SET content = p_content, version = v_next_version
      WHERE user_id = v_uid AND run_id = p_run_id;
  ELSE
    IF p_expected_version <> 0 THEN RAISE EXCEPTION 'Conflit de version de l’artefact'; END IF;
    v_next_version := 1;
    INSERT INTO public.activity_artifacts (user_id, run_id, content, version)
      VALUES (v_uid, p_run_id, p_content, v_next_version);
  END IF;

  UPDATE public.activity_runs SET current_artifact = p_current_artifact
    WHERE user_id = v_uid AND id = p_run_id;

  v_result := jsonb_build_object('runId', p_run_id, 'artifactVersion', v_next_version);
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'enregistrer_artefact_activite', v_result);
  RETURN v_result;
END;
$$;

/*
 * Clôture d'un projet.
 *
 * Une preuve n'existe qu'à quatre conditions réunies : une production, un
 * artefact gelé dans un snapshot, une validation humaine, et un critère du
 * contrat effectivement démontré pour la compétence visée.
 *
 * Cette dernière condition est le changement de fond par rapport au chantier
 * d'origine, qui distribuait la même qualité à toutes les compétences de la
 * cible. Un projet mobilisant cinq compétences ne les démontre pas toutes du
 * seul fait d'avoir été rendu : chaque preuve doit pointer un critère porteur
 * de son code. Une compétence non couverte ne reçoit rien — absence de preuve
 * n'est pas zéro.
 */
CREATE OR REPLACE FUNCTION public.cloturer_execution_activite(
  p_request_id TEXT,
  p_run_id TEXT,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_run public.activity_runs%ROWTYPE;
  v_activity public.learning_activities%ROWTYPE;
  v_snapshot_id TEXT := p_payload #>> '{snapshot,id}';
  v_assessment_id TEXT := p_payload #>> '{assessment,id}';
  v_item JSONB;
  v_code TEXT;
  v_expected_quality TEXT;
  v_result JSONB;
  v_artifact_content JSONB;
  v_evidence_count INTEGER := jsonb_array_length(coalesce(p_payload -> 'evidence', '[]'::JSONB));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0
    OR length(btrim(coalesce(p_payload ->> 'eventId', ''))) = 0
  THEN
    RAISE EXCEPTION 'request_id et eventId obligatoires';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  SELECT * INTO v_run FROM public.activity_runs
    WHERE user_id = v_uid AND id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exécution introuvable'; END IF;
  IF v_run.status NOT IN ('en-cours', 'en-pause') THEN
    RAISE EXCEPTION 'L’exécution n’est pas clôturable';
  END IF;

  SELECT * INTO v_activity FROM public.learning_activities
    WHERE user_id = v_uid AND id = v_run.activity_id AND version = v_run.activity_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version d’activité introuvable'; END IF;
  IF v_activity.family = 'explorer' AND v_evidence_count > 0 THEN
    RAISE EXCEPTION 'Une exploration ne produit aucune preuve';
  END IF;
  IF v_evidence_count > 0 AND (
    v_activity.family <> 'produire'
    OR v_activity.proof_mode = 'support-seul'
    OR p_payload #>> '{assessment,kind}' <> 'validation-humaine'
    OR v_snapshot_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Une preuve exige une production, un snapshot et une validation humaine';
  END IF;
  IF p_payload ? 'assessment' AND (
    p_payload #>> '{assessment,activityId}' <> v_run.activity_id
    OR (p_payload #>> '{assessment,activityVersion}')::INTEGER <> v_run.activity_version
  ) THEN
    RAISE EXCEPTION 'L’évaluation ne vise pas la version exacte de l’activité';
  END IF;

  IF v_evidence_count > 0 AND (
    p_payload #>> '{assessment,artifactSnapshotId}' <> v_snapshot_id
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
      WHERE assessed ->> 'demonstration' <> 'non-observee'
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
      WHERE assessed ->> 'demonstration' NOT IN ('non-observee', 'insuffisante', 'partielle', 'pleine')
    )
    OR (
      SELECT count(*) FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB))
    ) <> (
      SELECT count(DISTINCT assessed ->> 'criterionId')
      FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(v_activity.evaluation_contract -> 'criteria', '[]'::JSONB)) contracted
        WHERE contracted ->> 'id' = assessed ->> 'criterionId'
      )
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(v_activity.evaluation_contract -> 'criteria', '[]'::JSONB)) contracted
      WHERE coalesce((contracted ->> 'required')::BOOLEAN, false)
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
          WHERE assessed ->> 'criterionId' = contracted ->> 'id'
        )
    )
  ) THEN
    RAISE EXCEPTION 'La preuve exige le snapshot exact et une validation complète des critères contractuels';
  END IF;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);

  IF p_payload ? 'snapshot' THEN
    IF p_payload #>> '{snapshot,kind}' IN ('markdown', 'structure', 'copie') THEN
      SELECT content INTO v_artifact_content FROM public.activity_artifacts
        WHERE user_id = v_uid AND run_id = p_run_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Artefact courant introuvable'; END IF;
      IF v_evidence_count > 0 AND (
        length(btrim(coalesce(v_artifact_content ->> 'body', ''))) = 0
        OR coalesce((v_artifact_content ->> 'supportOnly')::BOOLEAN, false)
        OR (
          v_run.current_artifact ->> 'kind' = 'lien-externe'
          AND NOT coalesce((v_run.current_artifact ->> 'immutable')::BOOLEAN, false)
        )
      ) THEN
        RAISE EXCEPTION 'Un support externe modifiable ou vide ne peut pas devenir une preuve';
      END IF;
    ELSE
      v_artifact_content := p_payload #> '{snapshot,content}';
    END IF;
    INSERT INTO public.artifact_snapshots (
      user_id, id, kind, activity_run_id, document_snapshot_id, storage_path,
      commit_ref, content_hash, content, metadata, captured_at
    ) VALUES (
      v_uid, v_snapshot_id, p_payload #>> '{snapshot,kind}', p_run_id,
      p_payload #>> '{snapshot,documentSnapshotId}', p_payload #>> '{snapshot,storagePath}',
      p_payload #>> '{snapshot,commitRef}', p_payload #>> '{snapshot,contentHash}',
      v_artifact_content, coalesce(p_payload #> '{snapshot,metadata}', '{}'::JSONB),
      (p_payload #>> '{snapshot,capturedAt}')::TIMESTAMPTZ
    );
  END IF;

  IF p_payload ? 'assessment' THEN
    IF p_payload ? 'proposedAssessment' THEN
      IF p_payload #>> '{assessment,proposedAssessmentId}' <> p_payload #>> '{proposedAssessment,id}' THEN
        RAISE EXCEPTION 'La validation humaine ne référence pas la proposition fournie';
      END IF;
      INSERT INTO public.activity_assessments (
        user_id, id, run_id, activity_id, activity_version, kind,
        scope, criteria, artifact_snapshot_id, request_id
      ) VALUES (
        v_uid, p_payload #>> '{proposedAssessment,id}', p_run_id,
        v_run.activity_id, v_run.activity_version, 'proposition-tuteur',
        p_payload #> '{proposedAssessment,scope}',
        coalesce(p_payload #> '{proposedAssessment,criteria}', '[]'::JSONB),
        v_snapshot_id, p_request_id || ':proposal'
      );
    END IF;
    INSERT INTO public.activity_assessments (
      user_id, id, run_id, activity_id, activity_version, kind,
      proposed_assessment_id, scope, criteria, result, autonomy,
      artifact_snapshot_id, request_id
    ) VALUES (
      v_uid, v_assessment_id, p_run_id, v_run.activity_id, v_run.activity_version,
      p_payload #>> '{assessment,kind}', p_payload #>> '{assessment,proposedAssessmentId}',
      p_payload #> '{assessment,scope}', coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB),
      p_payload #>> '{assessment,result}', p_payload #>> '{assessment,autonomy}',
      v_snapshot_id, p_request_id || ':assessment'
    );
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_payload -> 'evidence', '[]'::JSONB))
  LOOP
    v_code := v_item ->> 'skillCode';
    IF NOT (coalesce(v_activity.target -> 'skillCodes', '[]'::JSONB) ? v_code)
      OR v_item ->> 'type' <> 'projet'
    THEN
      RAISE EXCEPTION 'Une preuve de projet doit viser une compétence du contrat de l''activité';
    END IF;

    -- Le critère porteur du code est ce qui rend la compétence démontrée.
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
      JOIN jsonb_array_elements(coalesce(v_activity.evaluation_contract -> 'criteria', '[]'::JSONB)) contracted
        ON contracted ->> 'id' = assessed ->> 'criterionId'
      WHERE contracted ->> 'skillCode' = v_code
        AND assessed ->> 'demonstration' IN ('partielle', 'pleine')
    ) THEN
      RAISE EXCEPTION 'Aucun critère démontré ne porte la compétence % : elle ne reçoit pas de preuve', v_code;
    END IF;

    IF p_payload #>> '{assessment,autonomy}' IN ('A0', 'A1') THEN
      v_expected_quality := 'faible';
    ELSIF p_payload #>> '{assessment,result}' = 'reussi'
      AND p_payload #>> '{assessment,autonomy}' IN ('A3', 'A4')
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
        JOIN jsonb_array_elements(coalesce(v_activity.evaluation_contract -> 'criteria', '[]'::JSONB)) contracted
          ON contracted ->> 'id' = assessed ->> 'criterionId'
        WHERE assessed ->> 'demonstration' = 'pleine'
          AND contracted ->> 'skillCode' = v_code
          AND contracted ->> 'dimension' IN ('transfert', 'integration')
      )
    THEN
      v_expected_quality := 'forte';
    ELSE
      v_expected_quality := 'moyenne';
    END IF;
    IF v_item ->> 'qualite' <> v_expected_quality THEN
      RAISE EXCEPTION 'La compétence % attend une preuve % au regard de son contrat', v_code, v_expected_quality;
    END IF;

    INSERT INTO public.evidence (
      user_id, id, skill_code, date, type, niveau_preuve, autonomie,
      qualite, resultat, contexte, dimensions, competences_combinees,
      source, commentaire, provenance_version, activity_run_id, artifact_snapshot_id
    ) VALUES (
      v_uid, v_item ->> 'id', v_code, v_item ->> 'date',
      v_item ->> 'type', v_item ->> 'niveauPreuve', p_payload #>> '{assessment,autonomy}',
      v_item ->> 'qualite', p_payload #>> '{assessment,result}', v_item ->> 'contexte',
      coalesce(v_item -> 'dimensions', '{}'::JSONB),
      CASE WHEN v_item ? 'competencesCombinees'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_item -> 'competencesCombinees'))
        ELSE NULL END,
      jsonb_build_object('kind', 'projet', 'ref', p_run_id),
      v_item ->> 'commentaire', 2, p_run_id, v_snapshot_id
    );
  END LOOP;

  UPDATE public.activity_runs SET
    status = 'terminee',
    current_artifact = coalesce(p_payload -> 'artifact', current_artifact),
    completed_at = coalesce((p_payload ->> 'completedAt')::TIMESTAMPTZ, NOW()),
    paused_at = NULL
  WHERE user_id = v_uid AND id = p_run_id;

  INSERT INTO public.activity_events (user_id, id, run_id, request_id, type, payload)
  VALUES (
    v_uid, p_payload ->> 'eventId', p_run_id, p_request_id, 'cloture',
    jsonb_strip_nulls(jsonb_build_object(
      'assessmentId', v_assessment_id, 'artifactSnapshotId', v_snapshot_id
    ))
  );

  v_result := jsonb_build_object(
    'runId', p_run_id, 'status', 'terminee', 'assessmentId', v_assessment_id,
    'snapshotId', v_snapshot_id, 'evidenceCount', v_evidence_count
  );
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'cloturer_execution_activite', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.abandonner_execution_activite(
  p_request_id TEXT,
  p_run_id TEXT,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_status TEXT;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0
    OR length(btrim(coalesce(p_payload ->> 'eventId', ''))) = 0
  THEN
    RAISE EXCEPTION 'request_id et eventId obligatoires';
  END IF;
  -- Un travail abandonné ne démontre rien.
  IF p_payload ? 'evidence' THEN RAISE EXCEPTION 'Un abandon ne reçoit aucune preuve'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  SELECT status INTO v_status FROM public.activity_runs
    WHERE user_id = v_uid AND id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exécution introuvable'; END IF;
  IF v_status IN ('terminee', 'abandonnee') THEN RAISE EXCEPTION 'L’exécution est déjà terminale'; END IF;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  UPDATE public.activity_runs SET
    status = 'abandonnee',
    abandoned_at = coalesce((p_payload ->> 'abandonedAt')::TIMESTAMPTZ, NOW()),
    paused_at = NULL
  WHERE user_id = v_uid AND id = p_run_id;

  INSERT INTO public.activity_events (user_id, id, run_id, request_id, type, payload)
  VALUES (
    v_uid, p_payload ->> 'eventId', p_run_id, p_request_id, 'abandon',
    jsonb_strip_nulls(jsonb_build_object('reason', p_payload ->> 'reason'))
  );

  v_result := jsonb_build_object('runId', p_run_id, 'status', 'abandonnee');
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'abandonner_execution_activite', v_result);
  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Droits
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE
  public.learning_activities,
  public.activity_runs,
  public.activity_artifacts,
  public.artifact_snapshots,
  public.activity_events,
  public.activity_assessments,
  public.learning_command_receipts
FROM anon;

GRANT SELECT, INSERT, UPDATE
  ON public.learning_activities,
     public.activity_runs,
     public.activity_artifacts
  TO authenticated;
GRANT SELECT, INSERT
  ON public.artifact_snapshots,
     public.activity_events,
     public.activity_assessments,
     public.learning_command_receipts
  TO authenticated;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.artifact_snapshots,
     public.activity_events,
     public.learning_command_receipts
  FROM authenticated;
REVOKE UPDATE, DELETE ON public.activity_assessments FROM authenticated;

REVOKE ALL ON FUNCTION public.accepter_activite_generee(TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.planifier_execution_activite(TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enregistrer_evenement_activite(TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enregistrer_artefact_activite(TEXT, TEXT, INTEGER, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cloturer_execution_activite(TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.abandonner_execution_activite(TEXT, TEXT, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accepter_activite_generee(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planifier_execution_activite(TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_evenement_activite(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_artefact_activite(TEXT, TEXT, INTEGER, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cloturer_execution_activite(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandonner_execution_activite(TEXT, TEXT, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION
  public.refuser_mutation_append_only(),
  public.refuser_mutation_evaluation_finale(),
  public.proteger_execution_activite(),
  public.proteger_version_activite()
FROM PUBLIC, anon, authenticated;

COMMIT;
