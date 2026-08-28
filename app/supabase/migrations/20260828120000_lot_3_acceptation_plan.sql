-- Lot 3 — acceptation atomique d'un plan temporel éphémère.
--
-- Migration additive préparée le 28/08/2026. Les objets qu'elle décrit sont
-- désormais présents dans Supabase réel (vérification du 28/08/2026), mais les
-- versions `20260828110000` et `20260828120000` n'apparaissent pas dans
-- l'historique distant. Ne pas rejouer ce fichier : réconcilier l'historique
-- par le workflow d'infrastructure approuvé avant toute nouvelle DDL.
--
-- Le reçu est une infrastructure de commande, pas une entité de travail. Le
-- plan complet n'entre jamais dans la base : seules les séances acceptées,
-- leur provenance compacte et les ajustements explicites sont écrits.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS origine_proposition JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_origine_proposition_forme'
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_origine_proposition_forme CHECK (
        origine_proposition IS NULL
        OR (
          jsonb_typeof(origine_proposition) = 'object'
          AND btrim(coalesce(origine_proposition->>'propositionRef', '')) <> ''
          AND btrim(coalesce(origine_proposition->>'candidateId', '')) <> ''
          AND btrim(coalesce(origine_proposition->>'source', '')) <> ''
        )
      );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.orchestration_command_receipts (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL CHECK (btrim(request_id) <> '' AND length(request_id) <= 200),
  command TEXT NOT NULL CHECK (command = 'accepter_plan'),
  payload_hash TEXT NOT NULL CHECK (btrim(payload_hash) <> ''),
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, request_id)
);

ALTER TABLE public.orchestration_command_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orchestration_receipts_read_own
  ON public.orchestration_command_receipts;
CREATE POLICY orchestration_receipts_read_own
  ON public.orchestration_command_receipts
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND (select public.compte_actif()));

DROP POLICY IF EXISTS orchestration_receipts_insert_own
  ON public.orchestration_command_receipts;
CREATE POLICY orchestration_receipts_insert_own
  ON public.orchestration_command_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.compte_actif())
    AND (select current_setting('app.orchestration_command', true)) = 'on'
  );

GRANT SELECT, INSERT ON public.orchestration_command_receipts TO authenticated;
GRANT SELECT, INSERT ON public.orchestration_command_receipts TO service_role;

CREATE INDEX IF NOT EXISTS orchestration_receipts_user_created_idx
  ON public.orchestration_command_receipts (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.accepter_plan(
  p_request_id TEXT,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_payload_hash TEXT;
  v_stored_hash TEXT;
  v_result JSONB;
  v_item JSONB;
  v_session_id TEXT;
  v_planned TIMESTAMPTZ;
  v_duration INTEGER;
  v_statut TEXT;
  v_accepted_ids JSONB := '[]'::JSONB;
  v_adjusted_ids JSONB := '[]'::JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.compte_actif(v_uid) THEN
    RAISE EXCEPTION 'Compte suspendu ou inexistant.' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_request_id, '')) = '' OR length(p_request_id) > 200 THEN
    RAISE EXCEPTION 'request_id obligatoire et limité à 200 caractères.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'La commande d''acceptation doit être un objet JSON.' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'plan' OR p_payload ? 'slots' OR p_payload ? 'readiness' THEN
    RAISE EXCEPTION 'Le plan complet ne peut pas être envoyé à la persistance.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce(p_payload->'accepted', '[]'::JSONB)) IS DISTINCT FROM 'array'
     OR jsonb_typeof(coalesce(p_payload->'adjustments', '[]'::JSONB)) IS DISTINCT FROM 'array'
     OR jsonb_typeof(coalesce(p_payload->'ignoredCandidateIds', '[]'::JSONB)) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'La commande d''acceptation porte des tableaux invalides.' USING ERRCODE = '22023';
  END IF;
  IF btrim(coalesce(p_payload->>'propositionRef', '')) = '' THEN
    RAISE EXCEPTION 'propositionRef obligatoire.' USING ERRCODE = '22023';
  END IF;

  -- Verrou par compte : deux lots concurrents ne peuvent pas réserver le même
  -- temps entre la vérification et l'insertion.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':orchestration', 0)
  );
  PERFORM pg_catalog.set_config('app.orchestration_command', 'on', true);

  v_payload_hash := md5(p_payload::TEXT);
  SELECT payload_hash, result
    INTO v_stored_hash, v_result
    FROM public.orchestration_command_receipts
   WHERE user_id = v_uid AND request_id = p_request_id
   FOR UPDATE;
  IF FOUND THEN
    IF v_stored_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'request_id déjà utilisé pour une autre commande.' USING ERRCODE = '40001';
    END IF;
    RETURN v_result;
  END IF;

  -- Les ajustements sont appliqués dans la même transaction. Seules les
  -- séances planifiées sont déplaçables ou annulables : une séance en cours,
  -- terminée ou historique reste protégée.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_payload->'adjustments', '[]'::JSONB))
  LOOP
    v_session_id := btrim(coalesce(v_item->>'sessionId', ''));
    IF v_session_id = '' OR coalesce(v_item->>'action', '') NOT IN ('move', 'cancel') THEN
      RAISE EXCEPTION 'Ajustement de séance invalide.' USING ERRCODE = '22023';
    END IF;

    SELECT statut INTO v_statut
      FROM public.sessions
     WHERE user_id = v_uid AND id = v_session_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Séance introuvable pour ce compte : %.', v_session_id USING ERRCODE = '42501';
    END IF;
    IF v_statut IS DISTINCT FROM 'planifiee' THEN
      RAISE EXCEPTION 'La séance % n''est plus planifiée et reste protégée.', v_session_id USING ERRCODE = '40001';
    END IF;

    IF v_item->>'action' = 'cancel' THEN
      IF v_item ? 'plannedFor' THEN
        RAISE EXCEPTION 'Une annulation ne porte pas de créneau.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.sessions
         SET statut = 'abandonnee', renoncee_le = coalesce(renoncee_le, now()::TEXT)
       WHERE user_id = v_uid AND id = v_session_id;
    ELSE
      IF btrim(coalesce(v_item->>'plannedFor', '')) = '' THEN
        RAISE EXCEPTION 'Un déplacement exige plannedFor.' USING ERRCODE = '22023';
      END IF;
      v_planned := (v_item->>'plannedFor')::TIMESTAMPTZ;
      IF EXISTS (
        SELECT 1
          FROM public.sessions s
         WHERE s.user_id = v_uid
           AND s.id <> v_session_id
           AND s.statut IN ('planifiee', 'en-cours')
           AND s.planifiee_pour IS NOT NULL
           AND s.planifiee_pour::TIMESTAMPTZ < v_planned + make_interval(mins => coalesce(
             (s.duree_min)::DOUBLE PRECISION,
             (SELECT sum((intervention->>'estimatedDurationMinutes')::DOUBLE PRECISION)
                FROM jsonb_array_elements(coalesce(s.interventions, '[]'::JSONB)) AS interventions(intervention)),
             0
           ))
           AND v_planned < s.planifiee_pour::TIMESTAMPTZ + make_interval(mins => coalesce(
             (s.duree_min)::DOUBLE PRECISION,
             (SELECT sum((intervention->>'estimatedDurationMinutes')::DOUBLE PRECISION)
                FROM jsonb_array_elements(coalesce(s.interventions, '[]'::JSONB)) AS interventions(intervention)),
             0
           ))
      ) THEN
        RAISE EXCEPTION 'Créneau de déplacement en conflit pour la séance %.', v_session_id USING ERRCODE = '40001';
      END IF;
      UPDATE public.sessions
         SET date = v_item->>'plannedFor', planifiee_pour = v_item->>'plannedFor'
       WHERE user_id = v_uid AND id = v_session_id;
    END IF;
    v_adjusted_ids := v_adjusted_ids || jsonb_build_array(v_session_id);
  END LOOP;

  -- Chaque insertion porte une provenance compacte et les interventions
  -- acceptées. Aucun champ de résultat, de preuve ou d'observation n'est écrit.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_payload->'accepted', '[]'::JSONB))
  LOOP
    v_session_id := btrim(coalesce(v_item->>'sessionId', ''));
    IF v_session_id = ''
       OR btrim(coalesce(v_item->>'candidateId', '')) = ''
       OR coalesce(v_item->>'source', '') NOT IN ('existing-activity', 'resume', 'generation', 'legacy-exercise', 'course-protocol', 'resource', 'declared-need')
       OR btrim(coalesce(v_item->>'plannedFor', '')) = ''
       OR coalesce(v_item->>'durationMinutes', '') !~ '^[1-9][0-9]*$'
    THEN
      RAISE EXCEPTION 'Séance acceptée invalide.' USING ERRCODE = '22023';
    END IF;
    v_planned := (v_item->>'plannedFor')::TIMESTAMPTZ;
    v_duration := (v_item->>'durationMinutes')::INTEGER;
    IF jsonb_typeof(v_item->'skillCodes') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_item->'domaines') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_item->'activites') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_item->'interventions') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_item->'interventions') = 0
    THEN
      RAISE EXCEPTION 'Composition de séance acceptée invalide.' USING ERRCODE = '22023';
    END IF;
    IF v_item ? 'observations' OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_item->'interventions') AS interventions(intervention)
       WHERE jsonb_typeof(intervention) IS DISTINCT FROM 'object'
          OR btrim(coalesce(intervention->>'id', '')) = ''
          OR coalesce(intervention->>'type', '') NOT IN ('resolve', 'explain', 'recall', 'read', 'synthesize', 'produce', 'diagnose', 'ask-for-help')
          OR btrim(coalesce(intervention->>'label', '')) = ''
          OR coalesce(intervention->>'expectedEffect', '') NOT IN ('measurement', 'preparation', 'support')
          OR jsonb_typeof(intervention->'source') IS DISTINCT FROM 'object'
          OR coalesce(intervention->'source'->>'kind', '') NOT IN ('exercise', 'course', 'document', 'engagement', 'declared-need', 'session')
          OR btrim(coalesce(intervention->'source'->>'ref', '')) = ''
    ) THEN
      RAISE EXCEPTION 'Intervention acceptée invalide.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_item->'origineProposition') IS DISTINCT FROM 'object'
       OR v_item->'origineProposition'->>'propositionRef' IS DISTINCT FROM p_payload->>'propositionRef'
       OR v_item->'origineProposition'->>'candidateId' IS DISTINCT FROM v_item->>'candidateId'
       OR v_item->'origineProposition'->>'source' IS DISTINCT FROM v_item->>'source'
    THEN
      RAISE EXCEPTION 'Provenance de séance incohérente.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements_text(v_item->'skillCodes') AS codes(code)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.competences c
          WHERE c.user_id = v_uid AND c.code = codes.code
            AND c.active AND NOT c.archive
       )
    ) THEN
      RAISE EXCEPTION 'Une compétence de la séance est inconnue, inactive ou archivée.' USING ERRCODE = '40001';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements_text(v_item->'domaines') AS domaines(domaine)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.domaines d
          WHERE d.user_id = v_uid AND d.id = domaines.domaine AND NOT d.archive
       )
    ) THEN
      RAISE EXCEPTION 'Un domaine de la séance est inconnu ou archivé.' USING ERRCODE = '40001';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM public.competences c
       WHERE c.user_id = v_uid
         AND c.code IN (SELECT code FROM jsonb_array_elements_text(v_item->'skillCodes') AS codes(code))
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(v_item->'domaines') AS domaines(domaine)
            WHERE domaines.domaine = c.domaine
         )
    ) THEN
      RAISE EXCEPTION 'Les domaines ne couvrent pas les compétences acceptées.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM public.sessions s
       WHERE s.user_id = v_uid
         AND s.id <> v_session_id
         AND s.statut IN ('planifiee', 'en-cours')
         AND s.planifiee_pour IS NOT NULL
         AND s.planifiee_pour::TIMESTAMPTZ < v_planned + make_interval(mins => v_duration::DOUBLE PRECISION)
         AND v_planned < s.planifiee_pour::TIMESTAMPTZ + make_interval(mins => coalesce(
           (s.duree_min)::DOUBLE PRECISION,
           (SELECT sum((intervention->>'estimatedDurationMinutes')::DOUBLE PRECISION)
              FROM jsonb_array_elements(coalesce(s.interventions, '[]'::JSONB)) AS interventions(intervention)),
           0
         ))
    ) THEN
      RAISE EXCEPTION 'Créneau de séance en conflit : %.', v_session_id USING ERRCODE = '40001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.sessions WHERE user_id = v_uid AND id = v_session_id) THEN
      RAISE EXCEPTION 'Une séance porte déjà l''identité %.', v_session_id USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.sessions (
      id, user_id, date, domaines, skill_codes, activites, interventions,
      genere_automatiquement, statut, planifiee_pour, origine_proposition
    ) VALUES (
      v_session_id,
      v_uid,
      v_item->>'plannedFor',
      ARRAY(SELECT jsonb_array_elements_text(v_item->'domaines')),
      ARRAY(SELECT jsonb_array_elements_text(v_item->'skillCodes')),
      v_item->'activites',
      v_item->'interventions',
      false,
      'planifiee',
      v_item->>'plannedFor',
      v_item->'origineProposition'
    );
    v_accepted_ids := v_accepted_ids || jsonb_build_array(v_session_id);
  END LOOP;

  v_result := jsonb_build_object(
    'acceptedSessionIds', v_accepted_ids,
    'adjustedSessionIds', v_adjusted_ids,
    'ignoredCandidateIds', coalesce(p_payload->'ignoredCandidateIds', '[]'::JSONB)
  );
  INSERT INTO public.orchestration_command_receipts (
    user_id, request_id, command, payload_hash, result
  ) VALUES (
    v_uid, p_request_id, 'accepter_plan', md5(p_payload::TEXT), v_result
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.accepter_plan(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepter_plan(TEXT, JSONB) TO authenticated;
