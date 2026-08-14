BEGIN;

-- Boucle adaptative v1 : modèle additif, provenance exacte et commandes
-- transactionnelles. Les lignes historiques de `evidence` restent lisibles
-- avec une provenance_version NULL ; toute nouvelle preuve passe par une RPC.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learning_loop_mode TEXT NOT NULL DEFAULT 'legacy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_learning_loop_mode_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_learning_loop_mode_check
      CHECK (learning_loop_mode IN ('legacy', 'adaptive-v1'));
  END IF;
END;
$$;

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS structured_help JSONB NOT NULL DEFAULT '[]'::JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attempts_structured_help_array_check'
  ) THEN
    ALTER TABLE public.attempts
      ADD CONSTRAINT attempts_structured_help_array_check
      CHECK (jsonb_typeof(structured_help) = 'array');
  END IF;
END;
$$;

CREATE TABLE public.learning_goals (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  declared_priority INTEGER NOT NULL CHECK (declared_priority BETWEEN 1 AND 5),
  horizon TEXT CHECK (horizon IS NULL OR horizon IN ('court-terme', 'moyen-terme', 'long-terme')),
  target_date TIMESTAMPTZ,
  success_criteria JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(success_criteria) = 'array'),
  declared_state TEXT NOT NULL CHECK (
    declared_state IN ('brouillon', 'actif', 'en-pause', 'atteint', 'abandonne')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE public.learning_goal_targets (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('skill', 'theme')),
  target_ref TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origin TEXT NOT NULL DEFAULT 'utilisateur' CHECK (origin IN ('utilisateur', 'diff-tuteur')),
  PRIMARY KEY (user_id, goal_id, target_kind, target_ref),
  FOREIGN KEY (user_id, goal_id)
    REFERENCES public.learning_goals(user_id, id) ON DELETE CASCADE
);

CREATE TABLE public.activity_templates (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  workspace TEXT NOT NULL CHECK (
    workspace IN ('exploration-guidee', 'exercice-trois-actes', 'mini-projet')
  ),
  families TEXT[] NOT NULL CHECK (
    cardinality(families) > 0
    AND families <@ ARRAY['explorer', 'entrainer', 'produire']::TEXT[]
  ),
  default_mode JSONB NOT NULL,
  enabled_tools TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  origin TEXT NOT NULL CHECK (origin IN ('application', 'compte')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archivee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id, version)
);

CREATE TABLE public.learning_activities (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  template_id TEXT,
  template_version INTEGER,
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
  FOREIGN KEY (user_id, template_id, template_version)
    REFERENCES public.activity_templates(user_id, id, version),
  CONSTRAINT learning_activities_template_pair_check CHECK (
    (template_id IS NULL) = (template_version IS NULL)
  ),
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

CREATE TABLE public.activity_run_sessions (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, run_id, session_id),
  FOREIGN KEY (user_id, run_id)
    REFERENCES public.activity_runs(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, session_id)
    REFERENCES public.sessions(user_id, id) ON DELETE RESTRICT
);

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

CREATE TABLE public.artifact_snapshots (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('markdown', 'structure', 'fichier', 'export', 'commit', 'copie')),
  attempt_id TEXT,
  activity_run_id TEXT,
  document_snapshot_id TEXT,
  storage_path TEXT,
  commit_ref TEXT,
  content_hash TEXT,
  content JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, attempt_id)
    REFERENCES public.attempts(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, activity_run_id)
    REFERENCES public.activity_runs(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, document_snapshot_id)
    REFERENCES public.document_snapshots(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT artifact_snapshots_source_check CHECK (num_nonnulls(attempt_id, activity_run_id) = 1),
  CONSTRAINT artifact_snapshots_frozen_check CHECK (
    document_snapshot_id IS NOT NULL
    OR storage_path IS NOT NULL
    OR commit_ref IS NOT NULL
    OR content IS NOT NULL
  )
);

CREATE TABLE public.activity_events (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  session_id TEXT,
  request_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN ('demarrage', 'pause', 'reprise', 'jalon', 'aide', 'changement-mode', 'cloture', 'abandon')
  ),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id, type),
  FOREIGN KEY (user_id, run_id)
    REFERENCES public.activity_runs(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, session_id)
    REFERENCES public.sessions(user_id, id) ON DELETE RESTRICT
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

CREATE TABLE public.recommendation_checkins (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  available_time_minutes INTEGER NOT NULL CHECK (available_time_minutes BETWEEN 1 AND 480),
  mental_capacity TEXT NOT NULL CHECK (mental_capacity IN ('faible', 'standard', 'elevee')),
  intent TEXT NOT NULL CHECK (intent IN ('systeme', 'reprendre', 'explorer', 'pratiquer', 'produire')),
  target JSONB,
  verbatim_note TEXT,
  declared_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE public.recommendation_interactions (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  checkin_id TEXT,
  candidate_id TEXT NOT NULL,
  family TEXT NOT NULL CHECK (family IN ('explorer', 'entrainer', 'produire')),
  interaction TEXT NOT NULL CHECK (
    interaction IN ('affichee', 'acceptee', 'passee', 'demarree', 'terminee', 'abandonnee', 'feedback')
  ),
  reason TEXT,
  usefulness INTEGER CHECK (usefulness BETWEEN 1 AND 5),
  perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 5),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, checkin_id)
    REFERENCES public.recommendation_checkins(user_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.evidence_status_events (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('invalider', 'restaurer', 'remplacer')),
  replacement_evidence_id TEXT,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id),
  FOREIGN KEY (user_id, evidence_id)
    REFERENCES public.evidence(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, replacement_evidence_id)
    REFERENCES public.evidence(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT evidence_status_replacement_check CHECK (
    (action = 'remplacer') = (replacement_evidence_id IS NOT NULL)
    AND replacement_evidence_id IS DISTINCT FROM evidence_id
  )
);

CREATE TABLE public.learning_command_receipts (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  command TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, request_id)
);

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS provenance_version INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_id TEXT,
  ADD COLUMN IF NOT EXISTS activity_run_id TEXT,
  ADD COLUMN IF NOT EXISTS artifact_snapshot_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attempt_provenance_fkey') THEN
    ALTER TABLE public.evidence ADD CONSTRAINT evidence_attempt_provenance_fkey
      FOREIGN KEY (user_id, attempt_id)
      REFERENCES public.attempts(user_id, id) ON DELETE RESTRICT;
  END IF;
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
        AND attempt_id IS NULL
        AND activity_run_id IS NULL
        AND artifact_snapshot_id IS NULL
      )
      OR (
        provenance_version = 2
        AND num_nonnulls(attempt_id, activity_run_id) = 1
        AND artifact_snapshot_id IS NOT NULL
      )
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT user_id FROM public.sessions
    WHERE statut = 'en-cours'
    GROUP BY user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Plusieurs séances en cours existent pour un même compte';
  END IF;
END;
$$;

CREATE UNIQUE INDEX sessions_one_active_per_account_uidx
  ON public.sessions(user_id) WHERE statut = 'en-cours';
CREATE INDEX learning_goals_user_state_idx
  ON public.learning_goals(user_id, declared_state, declared_priority DESC, target_date);
CREATE INDEX learning_activities_user_family_status_idx
  ON public.learning_activities(user_id, family, status, created_at DESC);
CREATE INDEX activity_runs_user_status_idx
  ON public.activity_runs(user_id, status, created_at DESC);
CREATE INDEX activity_events_user_run_date_idx
  ON public.activity_events(user_id, run_id, created_at);
CREATE INDEX activity_assessments_user_run_date_idx
  ON public.activity_assessments(user_id, run_id, created_at);
CREATE INDEX recommendation_checkins_user_date_idx
  ON public.recommendation_checkins(user_id, declared_at DESC);
CREATE INDEX evidence_status_events_user_evidence_idx
  ON public.evidence_status_events(user_id, evidence_id, created_at);

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

CREATE OR REPLACE FUNCTION public.proteger_competences_exercice()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.competences IS DISTINCT FROM OLD.competences
    AND EXISTS (
      SELECT 1 FROM public.attempts
      WHERE user_id = OLD.user_id AND exercise_id = OLD.id
    )
  THEN
    RAISE EXCEPTION 'Les compétences d’un exercice ayant des tentatives sont immuables';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.valider_learning_goal_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.target_kind = 'skill' AND NOT EXISTS (
    SELECT 1 FROM public.competences
    WHERE user_id = NEW.user_id AND code = NEW.target_ref
  ) THEN
    RAISE EXCEPTION 'Compétence cible inconnue : %', NEW.target_ref;
  END IF;
  IF NEW.target_kind = 'theme' AND NOT EXISTS (
    SELECT 1 FROM public.themes
    WHERE user_id = NEW.user_id AND id = NEW.target_ref
  ) THEN
    RAISE EXCEPTION 'Thème cible inconnu : %', NEW.target_ref;
  END IF;
  RETURN NEW;
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

CREATE OR REPLACE FUNCTION public.proteger_version_modele_activite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.learning_activities
    WHERE user_id = OLD.user_id AND template_id = OLD.id AND template_version = OLD.version
  ) AND (
    to_jsonb(NEW) - ARRAY['status', 'updated_at']::TEXT[]
    IS DISTINCT FROM
    to_jsonb(OLD) - ARRAY['status', 'updated_at']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'Une version de modèle utilisée est immuable ; créez une nouvelle version';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_append_only ON public.evidence;
CREATE TRIGGER evidence_append_only
  BEFORE UPDATE OR DELETE ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();

DROP TRIGGER IF EXISTS document_snapshots_append_only ON public.document_snapshots;
CREATE TRIGGER document_snapshots_append_only
  BEFORE UPDATE OR DELETE ON public.document_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();

CREATE TRIGGER artifact_snapshots_append_only
  BEFORE UPDATE OR DELETE ON public.artifact_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER activity_events_append_only
  BEFORE UPDATE OR DELETE ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER evidence_status_events_append_only
  BEFORE UPDATE OR DELETE ON public.evidence_status_events
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER recommendation_checkins_append_only
  BEFORE UPDATE OR DELETE ON public.recommendation_checkins
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER recommendation_interactions_append_only
  BEFORE UPDATE OR DELETE ON public.recommendation_interactions
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER learning_command_receipts_append_only
  BEFORE UPDATE OR DELETE ON public.learning_command_receipts
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_append_only();
CREATE TRIGGER activity_assessments_final_append_only
  BEFORE UPDATE OR DELETE ON public.activity_assessments
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_evaluation_finale();

DROP TRIGGER IF EXISTS exercises_competences_immutables ON public.exercises;
CREATE TRIGGER exercises_competences_immutables
  BEFORE UPDATE OF competences ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION public.proteger_competences_exercice();
CREATE TRIGGER learning_goal_target_valid
  BEFORE INSERT OR UPDATE ON public.learning_goal_targets
  FOR EACH ROW EXECUTE FUNCTION public.valider_learning_goal_target();
CREATE TRIGGER activity_runs_protected
  BEFORE UPDATE ON public.activity_runs
  FOR EACH ROW EXECUTE FUNCTION public.proteger_execution_activite();
CREATE TRIGGER learning_activities_version_protected
  BEFORE UPDATE ON public.learning_activities
  FOR EACH ROW EXECUTE FUNCTION public.proteger_version_activite();
CREATE TRIGGER activity_templates_version_protected
  BEFORE UPDATE ON public.activity_templates
  FOR EACH ROW EXECUTE FUNCTION public.proteger_version_modele_activite();
CREATE TRIGGER learning_goals_touch_updated_at
  BEFORE UPDATE ON public.learning_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER activity_templates_touch_updated_at
  BEFORE UPDATE ON public.activity_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER learning_activities_touch_updated_at
  BEFORE UPDATE ON public.learning_activities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER activity_artifacts_touch_updated_at
  BEFORE UPDATE ON public.activity_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'learning_goals', 'learning_goal_targets', 'activity_templates',
    'learning_activities', 'activity_runs', 'activity_run_sessions',
    'activity_artifacts', 'artifact_snapshots', 'activity_events', 'activity_assessments',
    'recommendation_checkins', 'recommendation_interactions',
    'evidence_status_events', 'learning_command_receipts'
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

CREATE POLICY learning_goals_insert_own
  ON public.learning_goals FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY learning_goals_update_own
  ON public.learning_goals FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY learning_goal_targets_insert_own
  ON public.learning_goal_targets FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY learning_goal_targets_delete_own
  ON public.learning_goal_targets FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY activity_templates_insert_own
  ON public.activity_templates FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY activity_templates_update_own
  ON public.activity_templates FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
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

CREATE POLICY activity_run_sessions_command_insert
  ON public.activity_run_sessions FOR INSERT TO authenticated
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
CREATE POLICY recommendation_checkins_insert_own
  ON public.recommendation_checkins FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY recommendation_interactions_insert_own
  ON public.recommendation_interactions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY evidence_status_events_command_insert
  ON public.evidence_status_events FOR INSERT TO authenticated
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

DROP POLICY IF EXISTS "isolation_par_compte" ON public.evidence;
CREATE POLICY evidence_select_own
  ON public.evidence FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY evidence_command_insert
  ON public.evidence FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND provenance_version = 2
    AND (select current_setting('app.learning_command', true)) = 'on'
  );

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
  v_session_id TEXT := p_payload ->> 'sessionId';
  v_result JSONB;
  v_existing_event_id TEXT;
  v_existing_session_id TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
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
  SELECT result INTO v_result
  FROM public.learning_command_receipts
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  SELECT * INTO v_run
  FROM public.activity_runs
  WHERE user_id = v_uid AND id = p_run_id
  FOR UPDATE;
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
    SELECT id INTO v_existing_event_id
    FROM public.activity_events
    WHERE user_id = v_uid
      AND run_id = p_run_id
      AND type = 'jalon'
      AND payload ->> 'milestoneId' = p_payload #>> '{event,milestoneId}'
    ORDER BY created_at
    LIMIT 1;
    IF FOUND THEN
      PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
      v_result := jsonb_build_object(
        'runId', p_run_id,
        'eventId', v_existing_event_id,
        'type', v_type,
        'sessionId', v_session_id,
        'alreadyObserved', true
      );
      INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
        VALUES (v_uid, p_request_id, 'enregistrer_evenement_activite', v_result);
      RETURN v_result;
    END IF;
  END IF;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);

  IF v_type IN ('demarrage', 'reprise') THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_uid::TEXT || ':active-learning-session', 0)
    );
    SELECT id INTO v_existing_session_id
    FROM public.sessions
    WHERE user_id = v_uid AND statut = 'en-cours'
    ORDER BY date, id
    LIMIT 1
    FOR UPDATE;
    IF FOUND THEN v_session_id := v_existing_session_id; END IF;
    IF v_session_id IS NULL AND p_payload ? 'session' THEN
      v_session_id := p_payload #>> '{session,id}';
      INSERT INTO public.sessions (
        user_id, id, date, duree_min, domaines, skill_codes, activites,
        besoin_declare, genere_automatiquement, statut
      ) VALUES (
        v_uid,
        v_session_id,
        p_payload #>> '{session,date}',
        NULL,
        ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload #> '{session,domainIds}', '[]'::JSONB))),
        ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload #> '{session,skillCodes}', '[]'::JSONB))),
        coalesce(p_payload #> '{session,activities}', '[]'::JSONB),
        p_payload #> '{session,declaredNeed}',
        true,
        'en-cours'
      );
    END IF;
    IF v_session_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.sessions
      WHERE user_id = v_uid AND id = v_session_id AND statut = 'en-cours'
    ) THEN
      RAISE EXCEPTION 'Une séance en cours est requise';
    END IF;
    INSERT INTO public.activity_run_sessions (user_id, run_id, session_id)
      VALUES (v_uid, p_run_id, v_session_id) ON CONFLICT DO NOTHING;
    IF p_payload ? 'sessionActivity' THEN
      UPDATE public.sessions SET
        activites = CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(coalesce(activites, '[]'::JSONB)) item
            WHERE item ->> 'ref' = p_run_id
          ) THEN activites
          ELSE coalesce(activites, '[]'::JSONB) || jsonb_build_array(p_payload -> 'sessionActivity')
        END,
        domaines = ARRAY(
          SELECT DISTINCT value FROM unnest(
            coalesce(domaines, ARRAY[]::TEXT[])
            || ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload -> 'sessionDomainIds', '[]'::JSONB)))
          ) value
        ),
        skill_codes = ARRAY(
          SELECT DISTINCT value FROM unnest(
            coalesce(skill_codes, ARRAY[]::TEXT[])
            || ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload -> 'sessionSkillCodes', '[]'::JSONB)))
          ) value
        )
      WHERE user_id = v_uid AND id = v_session_id;
    END IF;
  ELSIF v_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.activity_run_sessions
    WHERE user_id = v_uid AND run_id = p_run_id AND session_id = v_session_id
  ) THEN
    RAISE EXCEPTION 'La séance n’est pas rattachée à cette exécution';
  END IF;

  UPDATE public.activity_runs SET
    status = CASE
      WHEN v_type IN ('demarrage', 'reprise') THEN 'en-cours'
      WHEN v_type = 'pause' THEN 'en-pause'
      ELSE status
    END,
    started_at = CASE WHEN v_type = 'demarrage' THEN coalesce((p_payload ->> 'occurredAt')::TIMESTAMPTZ, NOW()) ELSE started_at END,
    paused_at = CASE WHEN v_type = 'pause' THEN coalesce((p_payload ->> 'occurredAt')::TIMESTAMPTZ, NOW()) WHEN v_type = 'reprise' THEN NULL ELSE paused_at END,
    active_milestone_id = CASE WHEN v_type = 'jalon' THEN p_payload #>> '{event,milestoneId}' ELSE active_milestone_id END,
    current_artifact = coalesce(p_payload -> 'currentArtifact', current_artifact)
  WHERE user_id = v_uid AND id = p_run_id;

  IF v_type = 'pause' AND v_session_id IS NOT NULL THEN
    UPDATE public.sessions SET statut = 'terminee'
    WHERE user_id = v_uid AND id = v_session_id AND statut = 'en-cours'
      AND NOT EXISTS (
        SELECT 1
        FROM public.activity_run_sessions link
        JOIN public.activity_runs other_run
          ON other_run.user_id = link.user_id AND other_run.id = link.run_id
        WHERE link.user_id = v_uid
          AND link.session_id = v_session_id
          AND other_run.status = 'en-cours'
      );
  END IF;

  INSERT INTO public.activity_events (
    user_id, id, run_id, session_id, request_id, type, payload, created_at
  ) VALUES (
    v_uid, p_payload ->> 'eventId', p_run_id, v_session_id,
    p_request_id, v_type, coalesce(p_payload -> 'event', '{}'::JSONB),
    coalesce((p_payload ->> 'occurredAt')::TIMESTAMPTZ, NOW())
  );

  v_result := jsonb_build_object(
    'runId', p_run_id,
    'eventId', p_payload ->> 'eventId',
    'type', v_type,
    'sessionId', v_session_id
  );
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
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
  SELECT result INTO v_result
  FROM public.learning_command_receipts
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  SELECT status INTO v_run_status
  FROM public.activity_runs
  WHERE user_id = v_uid AND id = p_run_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exécution introuvable'; END IF;
  IF v_run_status <> 'en-cours' THEN
    RAISE EXCEPTION 'Seule une exécution en cours accepte une sauvegarde';
  END IF;

  SELECT version INTO v_current_version
  FROM public.activity_artifacts
  WHERE user_id = v_uid AND run_id = p_run_id
  FOR UPDATE;
  v_has_artifact := FOUND;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  IF v_has_artifact THEN
    IF v_current_version <> p_expected_version THEN
      RAISE EXCEPTION 'Conflit de version de l’artefact';
    END IF;
    v_next_version := v_current_version + 1;
    UPDATE public.activity_artifacts
    SET content = p_content, version = v_next_version
    WHERE user_id = v_uid AND run_id = p_run_id;
  ELSE
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION 'Conflit de version de l’artefact';
    END IF;
    v_next_version := 1;
    INSERT INTO public.activity_artifacts (user_id, run_id, content, version)
      VALUES (v_uid, p_run_id, p_content, v_next_version);
  END IF;

  UPDATE public.activity_runs
  SET current_artifact = p_current_artifact
  WHERE user_id = v_uid AND id = p_run_id;

  v_result := jsonb_build_object(
    'runId', p_run_id,
    'artifactVersion', v_next_version
  );
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'enregistrer_artefact_activite', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cloturer_exercice(
  p_request_id TEXT,
  p_attempt_id TEXT,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_attempt public.attempts%ROWTYPE;
  v_snapshot_id TEXT := p_payload #>> '{artifactSnapshot,id}';
  v_document_id TEXT := p_payload #>> '{document,id}';
  v_document_snapshot_id TEXT := p_payload #>> '{documentSnapshot,id}';
  v_item JSONB;
  v_result JSONB;
  v_session_id TEXT := p_payload ->> 'sessionId';
  v_evidence_count INTEGER := jsonb_array_length(coalesce(p_payload -> 'evidence', '[]'::JSONB));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN
    RAISE EXCEPTION 'request_id obligatoire';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  SELECT * INTO v_attempt FROM public.attempts
    WHERE user_id = v_uid AND id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentative introuvable'; END IF;
  IF v_attempt.statut <> 'en-cours' THEN RAISE EXCEPTION 'La tentative est déjà close'; END IF;
  IF v_attempt.exercise_id <> p_payload ->> 'exerciseId' THEN
    RAISE EXCEPTION 'La tentative ne correspond pas à cet exercice';
  END IF;
  IF (p_payload ->> 'status') NOT IN ('terminee', 'abandonnee') THEN
    RAISE EXCEPTION 'Statut terminal invalide';
  END IF;
  IF (p_payload ->> 'status') = 'abandonnee' AND v_evidence_count > 0 THEN
    RAISE EXCEPTION 'Une tentative abandonnée ne produit pas de preuve';
  END IF;
  IF v_evidence_count > 0 AND (
    v_snapshot_id IS NULL OR v_document_id IS NULL OR v_document_snapshot_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Document, snapshot documentaire et snapshot d’artefact obligatoires';
  END IF;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  UPDATE public.attempts SET
    fin = p_payload ->> 'finishedAt',
    duree_min = (p_payload ->> 'durationMinutes')::INTEGER,
    evaluation = CASE
      WHEN p_payload ? 'evaluation' THEN p_payload -> 'evaluation'
      ELSE evaluation
    END,
    resultat = coalesce(p_payload ->> 'result', resultat),
    statut = p_payload ->> 'status',
    notes = p_payload ->> 'notes',
    verdict_tuteur = p_payload -> 'tutorVerdict',
    structured_help = coalesce(p_payload -> 'structuredHelp', '[]'::JSONB)
  WHERE user_id = v_uid AND id = p_attempt_id;

  IF v_evidence_count > 0 THEN
    INSERT INTO public.documents (
      user_id, id, contenu_md, titre, type, tags, schema_version, frontmatter
    ) VALUES (
      v_uid, v_document_id, p_payload #>> '{document,contentMd}',
      p_payload #>> '{document,title}', coalesce(p_payload #>> '{document,type}', 'preuve'),
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload #> '{document,tags}', '[]'::JSONB))),
      p_payload #>> '{document,schemaVersion}', coalesce(p_payload #> '{document,frontmatter}', '{}'::JSONB)
    );
    INSERT INTO public.document_snapshots (
      user_id, id, document_id, version, contenu_md, capture_reason, captured_at
    ) VALUES (
      v_uid, v_document_snapshot_id, v_document_id,
      (p_payload #>> '{documentSnapshot,version}')::INTEGER,
      p_payload #>> '{document,contentMd}',
      p_payload #>> '{documentSnapshot,captureReason}',
      p_payload #>> '{documentSnapshot,capturedAt}'
    );
    INSERT INTO public.artifact_snapshots (
      user_id, id, kind, attempt_id, document_snapshot_id, content, metadata, captured_at
    ) VALUES (
      v_uid, v_snapshot_id, 'markdown', p_attempt_id, v_document_snapshot_id,
      jsonb_build_object('documentId', v_document_id),
      coalesce(p_payload #> '{artifactSnapshot,metadata}', '{}'::JSONB),
      (p_payload #>> '{artifactSnapshot,capturedAt}')::TIMESTAMPTZ
    );

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'evidence') LOOP
      IF EXISTS (
        SELECT 1 FROM public.exercises WHERE user_id = v_uid AND id = v_attempt.exercise_id
      ) AND NOT EXISTS (
        SELECT 1 FROM public.exercises
        WHERE user_id = v_uid AND id = v_attempt.exercise_id
          AND v_item ->> 'skillCode' = ANY(competences)
      ) THEN
        RAISE EXCEPTION 'La preuve vise une compétence absente de l''exercice';
      END IF;
      INSERT INTO public.evidence (
        user_id, id, skill_code, date, type, niveau_preuve, autonomie,
        qualite, resultat, contexte, dimensions, competences_combinees,
        source, commentaire, provenance_version, attempt_id, artifact_snapshot_id
      ) VALUES (
        v_uid, v_item ->> 'id', v_item ->> 'skillCode', v_item ->> 'date',
        v_item ->> 'type', v_item ->> 'niveauPreuve', v_item ->> 'autonomie',
        v_item ->> 'qualite', v_item ->> 'resultat', v_item ->> 'contexte',
        coalesce(v_item -> 'dimensions', '{}'::JSONB),
        CASE WHEN v_item ? 'competencesCombinees'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_item -> 'competencesCombinees'))
          ELSE NULL END,
        jsonb_build_object(
          'kind', 'exercice', 'ref', p_attempt_id,
          'document', jsonb_build_object('documentId', v_document_id, 'snapshotId', v_document_snapshot_id)
        ),
        v_item ->> 'commentaire', 2, p_attempt_id, v_snapshot_id
      );
    END LOOP;
  END IF;

  IF v_session_id IS NULL AND p_payload ? 'session' THEN
    v_session_id := p_payload #>> '{session,id}';
    INSERT INTO public.sessions (
      user_id, id, date, duree_min, domaines, skill_codes, activites,
      resultat, difficulte, apprentissage_principal, prochaine_action,
      note_personnelle, genere_automatiquement, statut
    ) VALUES (
      v_uid, v_session_id, p_payload #>> '{session,date}',
      (p_payload #>> '{session,durationMinutes}')::INTEGER,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload #> '{session,domainIds}', '[]'::JSONB))),
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload #> '{session,skillCodes}', '[]'::JSONB))),
      coalesce(p_payload #> '{session,activities}', '[]'::JSONB),
      p_payload #>> '{session,result}', p_payload #>> '{session,difficulty}',
      p_payload #>> '{session,mainLearning}', p_payload #>> '{session,nextAction}',
      p_payload #>> '{session,note}', true, 'terminee'
    );
  ELSIF v_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sessions WHERE user_id = v_uid AND id = v_session_id
  ) THEN
    RAISE EXCEPTION 'Séance introuvable';
  END IF;

  v_result := jsonb_build_object(
    'attemptId', p_attempt_id, 'status', p_payload ->> 'status',
    'snapshotId', v_snapshot_id, 'sessionId', v_session_id,
    'evidenceCount', v_evidence_count
  );
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'cloturer_exercice', v_result);
  RETURN v_result;
END;
$$;

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
  v_session_id TEXT := p_payload ->> 'sessionId';
  v_item JSONB;
  v_result JSONB;
  v_artifact_content JSONB;
  v_evidence_count INTEGER := jsonb_array_length(coalesce(p_payload -> 'evidence', '[]'::JSONB));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
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
      SELECT 1
      FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(v_activity.evaluation_contract -> 'criteria', '[]'::JSONB)) contracted
        WHERE contracted ->> 'id' = assessed ->> 'criterionId'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_activity.evaluation_contract -> 'criteria', '[]'::JSONB)) contracted
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
      SELECT content INTO v_artifact_content
      FROM public.activity_artifacts
      WHERE user_id = v_uid AND run_id = p_run_id
      FOR UPDATE;
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
    IF NOT (coalesce(v_activity.target -> 'skillCodes', '[]'::JSONB) ? (v_item ->> 'skillCode'))
      OR v_item ->> 'type' <> 'projet'
    THEN
      RAISE EXCEPTION 'Une preuve de projet doit viser une compétence du contrat de l''activité';
    END IF;
    IF p_payload #>> '{assessment,autonomy}' IN ('A0', 'A1') THEN
      IF v_item ->> 'qualite' <> 'faible' THEN
        RAISE EXCEPTION 'Une autonomie A0/A1 impose une preuve faible';
      END IF;
    ELSIF p_payload #>> '{assessment,result}' = 'reussi'
      AND p_payload #>> '{assessment,autonomy}' IN ('A3', 'A4')
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(p_payload #> '{assessment,criteria}', '[]'::JSONB)) assessed
        JOIN jsonb_array_elements(coalesce(v_activity.evaluation_contract -> 'criteria', '[]'::JSONB)) contracted
          ON contracted ->> 'id' = assessed ->> 'criterionId'
        WHERE assessed ->> 'demonstration' = 'pleine'
          AND contracted ->> 'dimension' IN ('transfert', 'integration')
      )
    THEN
      IF v_item ->> 'qualite' <> 'forte' THEN
        RAISE EXCEPTION 'Réussite, autonomie A3/A4 et transfert ou intégration imposent une preuve forte';
      END IF;
    ELSIF v_item ->> 'qualite' <> 'moyenne' THEN
      RAISE EXCEPTION 'Les autres projets probants imposent une preuve moyenne';
    END IF;
    INSERT INTO public.evidence (
      user_id, id, skill_code, date, type, niveau_preuve, autonomie,
      qualite, resultat, contexte, dimensions, competences_combinees,
      source, commentaire, provenance_version, activity_run_id, artifact_snapshot_id
    ) VALUES (
      v_uid, v_item ->> 'id', v_item ->> 'skillCode', v_item ->> 'date',
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

  IF v_session_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions WHERE user_id = v_uid AND id = v_session_id
    ) THEN RAISE EXCEPTION 'Séance introuvable'; END IF;
    INSERT INTO public.activity_run_sessions (user_id, run_id, session_id)
      VALUES (v_uid, p_run_id, v_session_id) ON CONFLICT DO NOTHING;
    UPDATE public.sessions SET
      statut = CASE WHEN EXISTS (
        SELECT 1
        FROM public.activity_run_sessions link
        JOIN public.activity_runs other_run
          ON other_run.user_id = link.user_id AND other_run.id = link.run_id
        WHERE link.user_id = v_uid
          AND link.session_id = v_session_id
          AND other_run.status = 'en-cours'
      ) THEN statut ELSE 'terminee' END,
      duree_min = coalesce((p_payload #>> '{session,durationMinutes}')::INTEGER, duree_min),
      resultat = coalesce(p_payload #>> '{session,result}', resultat),
      apprentissage_principal = coalesce(p_payload #>> '{session,mainLearning}', apprentissage_principal),
      prochaine_action = coalesce(p_payload #>> '{session,nextAction}', prochaine_action),
      note_personnelle = coalesce(p_payload #>> '{session,note}', note_personnelle)
    WHERE user_id = v_uid AND id = v_session_id;
  END IF;

  INSERT INTO public.activity_events (
    user_id, id, run_id, session_id, request_id, type, payload
  ) VALUES (
    v_uid, p_payload ->> 'eventId', p_run_id, v_session_id,
    p_request_id, 'cloture',
    jsonb_strip_nulls(jsonb_build_object('assessmentId', v_assessment_id, 'artifactSnapshotId', v_snapshot_id))
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
  v_session_id TEXT := p_payload ->> 'sessionId';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0
    OR length(btrim(coalesce(p_payload ->> 'eventId', ''))) = 0
  THEN RAISE EXCEPTION 'request_id et eventId obligatoires'; END IF;
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
  IF v_session_id IS NOT NULL THEN
    INSERT INTO public.activity_run_sessions (user_id, run_id, session_id)
      VALUES (v_uid, p_run_id, v_session_id) ON CONFLICT DO NOTHING;
    UPDATE public.sessions SET statut = 'terminee'
      WHERE user_id = v_uid AND id = v_session_id AND statut = 'en-cours'
        AND NOT EXISTS (
          SELECT 1
          FROM public.activity_run_sessions link
          JOIN public.activity_runs other_run
            ON other_run.user_id = link.user_id AND other_run.id = link.run_id
          WHERE link.user_id = v_uid
            AND link.session_id = v_session_id
            AND other_run.status = 'en-cours'
        );
  END IF;
  INSERT INTO public.activity_events (
    user_id, id, run_id, session_id, request_id, type, payload
  ) VALUES (
    v_uid, p_payload ->> 'eventId', p_run_id, v_session_id,
    p_request_id, 'abandon', jsonb_strip_nulls(jsonb_build_object('reason', p_payload ->> 'reason'))
  );
  v_result := jsonb_build_object('runId', p_run_id, 'status', 'abandonnee');
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'abandonner_execution_activite', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rectifier_preuve(
  p_request_id TEXT,
  p_event_id TEXT,
  p_evidence_id TEXT,
  p_action TEXT,
  p_reason TEXT,
  p_replacement_evidence_id TEXT DEFAULT NULL
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
  IF p_action NOT IN ('invalider', 'restaurer', 'remplacer') THEN RAISE EXCEPTION 'Action inconnue'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Motif obligatoire'; END IF;
  IF (p_action = 'remplacer') <> (p_replacement_evidence_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Une preuve de remplacement est requise uniquement pour remplacer';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;
  PERFORM 1 FROM public.evidence
    WHERE user_id = v_uid AND id = p_evidence_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preuve introuvable'; END IF;
  IF p_replacement_evidence_id IS NOT NULL THEN
    IF p_replacement_evidence_id = p_evidence_id THEN
      RAISE EXCEPTION 'Une preuve ne peut pas se remplacer elle-même';
    END IF;
    PERFORM 1 FROM public.evidence
      WHERE user_id = v_uid AND id = p_replacement_evidence_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Preuve de remplacement introuvable'; END IF;
  END IF;
  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  INSERT INTO public.evidence_status_events (
    user_id, id, evidence_id, action, replacement_evidence_id, reason, request_id
  ) VALUES (
    v_uid, p_event_id, p_evidence_id, p_action,
    p_replacement_evidence_id, btrim(p_reason), p_request_id
  );
  v_result := jsonb_build_object(
    'eventId', p_event_id, 'evidenceId', p_evidence_id,
    'action', p_action, 'replacementEvidenceId', p_replacement_evidence_id
  );
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'rectifier_preuve', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.enregistrer_objectif_apprentissage(
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
  v_goal_id TEXT := p_payload ->> 'id';
  v_target TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire'; END IF;
  IF length(btrim(coalesce(v_goal_id, ''))) = 0 THEN RAISE EXCEPTION 'Identifiant d''objectif obligatoire'; END IF;
  IF jsonb_typeof(coalesce(p_payload -> 'successCriteria', 'null'::JSONB)) <> 'array'
    OR jsonb_typeof(coalesce(p_payload -> 'confirmedSkillCodes', 'null'::JSONB)) <> 'array'
    OR jsonb_typeof(coalesce(p_payload -> 'confirmedThemeIds', 'null'::JSONB)) <> 'array'
  THEN
    RAISE EXCEPTION 'Listes d''objectif invalides';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':learning:' || p_request_id, 0)
  );
  SELECT result INTO v_result FROM public.learning_command_receipts
    WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  INSERT INTO public.learning_goals (
    user_id, id, title, description, declared_priority, horizon,
    target_date, success_criteria, declared_state
  ) VALUES (
    v_uid, v_goal_id, p_payload ->> 'title', coalesce(p_payload ->> 'description', ''),
    (p_payload ->> 'declaredPriority')::INTEGER, p_payload ->> 'horizon',
    (p_payload ->> 'targetDate')::TIMESTAMPTZ,
    p_payload -> 'successCriteria', p_payload ->> 'declaredState'
  )
  ON CONFLICT (user_id, id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    declared_priority = EXCLUDED.declared_priority,
    horizon = EXCLUDED.horizon,
    target_date = EXCLUDED.target_date,
    success_criteria = EXCLUDED.success_criteria,
    declared_state = EXCLUDED.declared_state;

  DELETE FROM public.learning_goal_targets
    WHERE user_id = v_uid AND goal_id = v_goal_id;
  FOR v_target IN SELECT jsonb_array_elements_text(p_payload -> 'confirmedSkillCodes') LOOP
    INSERT INTO public.learning_goal_targets (
      user_id, goal_id, target_kind, target_ref, origin
    ) VALUES (v_uid, v_goal_id, 'skill', v_target, 'utilisateur');
  END LOOP;
  FOR v_target IN SELECT jsonb_array_elements_text(p_payload -> 'confirmedThemeIds') LOOP
    INSERT INTO public.learning_goal_targets (
      user_id, goal_id, target_kind, target_ref, origin
    ) VALUES (v_uid, v_goal_id, 'theme', v_target, 'utilisateur');
  END LOOP;
  v_result := jsonb_build_object('goalId', v_goal_id);
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'enregistrer_objectif_apprentissage', v_result);
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
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
  SELECT result INTO v_result
  FROM public.learning_command_receipts
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_result; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.learning_activities
    WHERE user_id = v_uid
      AND id = p_activity_id
      AND version = p_activity_version
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Version d’activité active introuvable';
  END IF;

  PERFORM pg_catalog.set_config('app.learning_command', 'on', true);
  INSERT INTO public.activity_runs (
    user_id, id, activity_id, activity_version, status
  ) VALUES (
    v_uid, p_run_id, p_activity_id, p_activity_version, 'planifiee'
  );

  v_result := jsonb_build_object(
    'runId', p_run_id,
    'activityId', p_activity_id,
    'activityVersion', p_activity_version,
    'status', 'planifiee'
  );
  INSERT INTO public.learning_command_receipts (user_id, request_id, command, result)
    VALUES (v_uid, p_request_id, 'planifier_execution_activite', v_result);
  RETURN v_result;
END;
$$;

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
  IF p_payload #>> '{run,status}' <> 'planifiee' THEN RAISE EXCEPTION 'Une exécution acceptée commence planifiée'; END IF;
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
  INSERT INTO public.recommendation_interactions (
    user_id, id, checkin_id, candidate_id, family, interaction
  ) VALUES (
    v_uid, p_payload #>> '{interaction,id}', p_payload #>> '{interaction,checkinId}',
    p_payload #>> '{interaction,candidateId}', p_payload #>> '{activity,family}', 'acceptee'
  );
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

REVOKE ALL ON TABLE
  public.learning_goals,
  public.learning_goal_targets,
  public.activity_templates,
  public.learning_activities,
  public.activity_runs,
  public.activity_run_sessions,
  public.activity_artifacts,
  public.artifact_snapshots,
  public.activity_events,
  public.activity_assessments,
  public.recommendation_checkins,
  public.recommendation_interactions,
  public.evidence_status_events,
  public.learning_command_receipts
FROM anon;

GRANT SELECT, INSERT, UPDATE
  ON public.learning_goals,
     public.activity_templates,
     public.learning_activities,
     public.activity_runs,
     public.activity_artifacts
  TO authenticated;
GRANT SELECT, INSERT, DELETE
  ON public.learning_goal_targets
  TO authenticated;
GRANT SELECT, INSERT
  ON public.activity_run_sessions,
     public.artifact_snapshots,
     public.activity_events,
     public.activity_assessments,
     public.recommendation_checkins,
     public.recommendation_interactions,
     public.evidence_status_events,
     public.learning_command_receipts
  TO authenticated;

-- Les commandes SECURITY INVOKER conservent les droits minimaux nécessaires.
GRANT SELECT, INSERT ON public.evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sessions TO authenticated;
GRANT SELECT ON public.exercises TO authenticated;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.evidence,
     public.document_snapshots,
     public.artifact_snapshots,
     public.activity_events,
     public.evidence_status_events,
     public.learning_command_receipts
  FROM authenticated;
REVOKE UPDATE, DELETE ON public.activity_assessments FROM authenticated;

REVOKE ALL ON FUNCTION public.enregistrer_evenement_activite(TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enregistrer_artefact_activite(TEXT, TEXT, INTEGER, JSONB, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.planifier_execution_activite(TEXT, TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accepter_activite_generee(TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enregistrer_objectif_apprentissage(TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cloturer_exercice(TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cloturer_execution_activite(TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.abandonner_execution_activite(TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rectifier_preuve(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.enregistrer_evenement_activite(TEXT, TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_artefact_activite(TEXT, TEXT, INTEGER, JSONB, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.planifier_execution_activite(TEXT, TEXT, INTEGER, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.accepter_activite_generee(TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_objectif_apprentissage(TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cloturer_exercice(TEXT, TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cloturer_execution_activite(TEXT, TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandonner_execution_activite(TEXT, TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rectifier_preuve(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION
  public.refuser_mutation_append_only(),
  public.refuser_mutation_evaluation_finale(),
  public.proteger_competences_exercice(),
  public.valider_learning_goal_target(),
  public.proteger_execution_activite(),
  public.proteger_version_activite(),
  public.proteger_version_modele_activite()
FROM PUBLIC, anon, authenticated;

COMMIT;
