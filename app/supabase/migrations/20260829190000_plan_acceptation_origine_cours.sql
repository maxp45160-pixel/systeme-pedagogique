-- Lot 8 — conserver la commande documentaire lors d'une acceptation globale.
--
-- Etat de départ vérifié dans Supabase le 29/08/2026 : accepter_plan(text,jsonb)
-- est la version idempotente de 20260829145745 et délègue les insertions à
-- accepter_plan_lot3_legacy(text,jsonb). La fonction héritée ne connaît pas
-- encore le blueprint ; cette correction reste donc additive et ne rejoue
-- aucune migration historique.

CREATE OR REPLACE FUNCTION public.accepter_plan(p_request_id text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_replayed BOOLEAN := false;
  v_adjustments JSONB := coalesce(p_payload->'adjustments', '[]'::JSONB);
  v_normalized JSONB := '[]'::JSONB;
  v_shortens JSONB := '[]'::JSONB;
  v_item JSONB;
  v_normalized_item JSONB;
  v_session_id TEXT;
  v_planned TEXT;
  v_duration INTEGER;
  v_current_duration INTEGER;
  v_statut TEXT;
  v_result JSONB;
BEGIN
  IF v_uid IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_uid::TEXT || ':orchestration', 0)
    );
    SELECT EXISTS (
      SELECT 1
        FROM public.orchestration_command_receipts
       WHERE user_id = v_uid AND request_id = p_request_id
    ) INTO v_replayed;
  END IF;

  IF jsonb_typeof(v_adjustments) IS DISTINCT FROM 'array' THEN
    RETURN public.accepter_plan_lot3_legacy(p_request_id, p_payload);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_adjustments)
  LOOP
    IF coalesce(v_item->>'action', '') = 'shorten' THEN
      v_session_id := btrim(coalesce(v_item->>'sessionId', ''));
      IF v_session_id = ''
         OR coalesce(v_item->>'durationMinutes', '') !~ '^[1-9][0-9]*$'
      THEN
        RAISE EXCEPTION 'Raccourcissement de séance invalide.' USING ERRCODE = '22023';
      END IF;
      v_duration := (v_item->>'durationMinutes')::INTEGER;

      SELECT coalesce(planifiee_pour, date) INTO v_planned
        FROM public.sessions
       WHERE user_id = auth.uid() AND id = v_session_id;
      IF NOT FOUND OR v_planned IS NULL THEN
        RAISE EXCEPTION 'Séance introuvable ou sans créneau : %.', v_session_id USING ERRCODE = '42501';
      END IF;

      v_normalized_item := jsonb_set(v_item, '{action}', to_jsonb('move'::TEXT));
      IF NOT (v_normalized_item ? 'plannedFor') THEN
        v_normalized_item := jsonb_set(v_normalized_item, '{plannedFor}', to_jsonb(v_planned));
      END IF;
      v_shortens := v_shortens || jsonb_build_array(jsonb_build_object(
        'sessionId', v_session_id,
        'durationMinutes', v_duration
      ));
    ELSE
      v_normalized_item := v_item;
    END IF;
    v_normalized := v_normalized || jsonb_build_array(v_normalized_item);
  END LOOP;

  v_result := public.accepter_plan_lot3_legacy(
    p_request_id,
    jsonb_set(p_payload, '{adjustments}', v_normalized)
  );

  -- Le lot 3 écrit la séance ; le lot 8 rattache ici la commande de
  -- préparation différée. Tout reste dans la transaction et le même compte.
  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'accepted', '[]'::JSONB))
  LOOP
    IF v_item->>'source' = 'course-protocol' THEN
      IF jsonb_typeof(v_item->'blueprint') IS DISTINCT FROM 'object'
         OR jsonb_typeof(v_item->'blueprint'->'origine') IS DISTINCT FROM 'object'
         OR v_item->'blueprint'->'origine'->>'genre' IS DISTINCT FROM 'protocole-cours'
         OR btrim(coalesce(v_item->'blueprint'->'origine'->>'ficheId', '')) = ''
         OR btrim(coalesce(v_item->'blueprint'->'origine'->>'pieceId', '')) = ''
         OR btrim(coalesce(v_item->'blueprint'->'origine'->>'titre', '')) = ''
         OR v_item->'blueprint'->'origine'->>'dimension' NOT IN ('comprehension', 'application', 'contextualisation', 'memorisation')
         OR jsonb_typeof(v_item->'blueprint'->'origine'->'codes') IS DISTINCT FROM 'array'
         OR jsonb_array_length(v_item->'blueprint'->'origine'->'codes') = 0
         OR btrim(coalesce(v_item->'blueprint'->'origine'->>'consigne', '')) = ''
         OR coalesce(v_item->'blueprint'->>'dureeCibleMin', '') !~ '^[1-9][0-9]*$'
         OR coalesce(v_item->'blueprint'->>'nombreExercices', '') !~ '^[1-9][0-9]*$'
         OR jsonb_typeof(v_item->'blueprint'->'cibles') IS DISTINCT FROM 'array'
      THEN
        RAISE EXCEPTION 'Commande de préparation du cours invalide.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.sessions
         SET blueprint = v_item->'blueprint'
       WHERE user_id = v_uid AND id = btrim(coalesce(v_item->>'sessionId', ''));
    END IF;
  END LOOP;

  IF v_replayed THEN
    RETURN v_result;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_shortens)
  LOOP
    v_session_id := v_item->>'sessionId';
    v_duration := (v_item->>'durationMinutes')::INTEGER;
    SELECT statut, coalesce(
      duree_planifiee_min,
      duree_min,
      (SELECT sum((intervention->>'estimatedDurationMinutes')::INTEGER)::INTEGER
         FROM jsonb_array_elements(coalesce(sessions.interventions, '[]'::JSONB)) AS interventions(intervention))
    ) INTO v_statut, v_current_duration
      FROM public.sessions
     WHERE user_id = auth.uid() AND id = v_session_id
     FOR UPDATE;
    IF NOT FOUND OR v_statut IS DISTINCT FROM 'planifiee' THEN
      RAISE EXCEPTION 'La séance % n''est plus planifiée et reste protégée.', v_session_id USING ERRCODE = '40001';
    END IF;
    IF v_current_duration IS NULL OR v_duration > v_current_duration THEN
      RAISE EXCEPTION 'La séance % ne peut pas être allongée par ce raccourcissement.', v_session_id USING ERRCODE = '40001';
    END IF;
    UPDATE public.sessions
       SET duree_planifiee_min = v_duration
     WHERE user_id = auth.uid() AND id = v_session_id;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'accepted', '[]'::JSONB))
  LOOP
    v_session_id := btrim(coalesce(v_item->>'sessionId', ''));
    IF v_session_id <> '' AND coalesce(v_item->>'durationMinutes', '') ~ '^[1-9][0-9]*$' THEN
      UPDATE public.sessions
         SET duree_planifiee_min = (v_item->>'durationMinutes')::INTEGER
       WHERE user_id = auth.uid() AND id = v_session_id;
    END IF;
  END LOOP;

  IF EXISTS (
    WITH cibles AS (
      SELECT btrim(value->>'sessionId') AS session_id
        FROM jsonb_array_elements(v_normalized) AS items(value)
       WHERE coalesce(value->>'action', '') IN ('move', 'shorten')
      UNION
      SELECT btrim(value->>'sessionId') AS session_id
        FROM jsonb_array_elements(coalesce(p_payload->'accepted', '[]'::JSONB)) AS items(value)
    )
    SELECT 1
      FROM cibles
      JOIN public.sessions cible
        ON cible.user_id = v_uid AND cible.id = cibles.session_id
      JOIN public.sessions autre
        ON autre.user_id = v_uid AND autre.id <> cible.id
       AND autre.statut IN ('planifiee', 'en-cours')
       AND autre.planifiee_pour IS NOT NULL
     WHERE cible.statut IN ('planifiee', 'en-cours')
       AND cible.planifiee_pour IS NOT NULL
       AND cible.planifiee_pour::TIMESTAMPTZ < autre.planifiee_pour::TIMESTAMPTZ
         + make_interval(mins => coalesce(
           autre.duree_planifiee_min,
           autre.duree_min,
           (SELECT sum((intervention->>'estimatedDurationMinutes')::INTEGER)::INTEGER
              FROM jsonb_array_elements(coalesce(autre.interventions, '[]'::JSONB)) AS interventions(intervention)),
           0
         ))
       AND autre.planifiee_pour::TIMESTAMPTZ < cible.planifiee_pour::TIMESTAMPTZ
         + make_interval(mins => coalesce(
           cible.duree_planifiee_min,
           cible.duree_min,
           (SELECT sum((intervention->>'estimatedDurationMinutes')::INTEGER)::INTEGER
              FROM jsonb_array_elements(coalesce(cible.interventions, '[]'::JSONB)) AS interventions(intervention)),
           0
         ))
  ) THEN
    RAISE EXCEPTION 'Créneau révisé en conflit.' USING ERRCODE = '40001';
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.accepter_plan(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepter_plan(TEXT, JSONB) TO authenticated;
