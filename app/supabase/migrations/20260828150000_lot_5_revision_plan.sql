-- Lot 5 — revue groupée des changements d'un plan recalculé.
--
-- État au 28/08/2026 : migration préparée, NON appliquée. Les objets du lot 3
-- existent dans Supabase mais leurs versions ne figurent pas dans l'historique
-- distant ; ne pas rejouer ni appliquer cette migration sans le workflow
-- d'autorisation prévu. Elle ne crée aucune table et ne stocke pas le plan.
--
-- Compatibilité additive : l'ancienne fonction est conservée sous un nom
-- interne et la nouvelle frontière ne transforme que `shorten` en déplacement
-- technique avant de réduire la durée dans la même transaction. Le reçu du
-- lot 3 reste la clé d'idempotence ; un second envoi remet la même durée.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS duree_planifiee_min INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_duree_planifiee_min_positive'
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_duree_planifiee_min_positive
      CHECK (duree_planifiee_min IS NULL OR duree_planifiee_min > 0);
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.accepter_plan_lot3_legacy(text,jsonb)') IS NULL THEN
    IF to_regprocedure('public.accepter_plan(text,jsonb)') IS NULL THEN
      RAISE EXCEPTION 'La fonction accepter_plan du lot 3 est absente.';
    END IF;
    ALTER FUNCTION public.accepter_plan(TEXT, JSONB) RENAME TO accepter_plan_lot3_legacy;
  END IF;
END;
$$;

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
  -- Le reçu est la frontière d'idempotence : un rejeu identique doit rester
  -- un no-op, y compris pour l'enrichissement de durée ci-dessous. Le verrou
  -- est le même que celui pris par la fonction héritée.
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

  -- Une forme invalide doit garder les diagnostics de la frontière lot 3.
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

  IF v_replayed THEN
    RETURN v_result;
  END IF;

  -- La fonction legacy a déjà verrouillé et validé le statut. On reprend le
  -- verrou avant la réduction ; tout reste dans la transaction appelante.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_shortens)
  LOOP
    v_session_id := v_item->>'sessionId';
    v_duration := (v_item->>'durationMinutes')::INTEGER;
    SELECT statut, coalesce(
      duree_planifiee_min,
      duree_min,
      (SELECT sum((intervention->>'estimatedDurationMinutes')::INTEGER)
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

  -- Les séances acceptées par la fonction legacy sont enrichies avec leur
  -- durée de créneau déclarée ; `duree_min` reste réservé au réel observé.
  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'accepted', '[]'::JSONB))
  LOOP
    v_session_id := btrim(coalesce(v_item->>'sessionId', ''));
    IF v_session_id <> '' AND coalesce(v_item->>'durationMinutes', '') ~ '^[1-9][0-9]*$' THEN
      UPDATE public.sessions
         SET duree_planifiee_min = (v_item->>'durationMinutes')::INTEGER
       WHERE user_id = auth.uid() AND id = v_session_id;
    END IF;
  END LOOP;

  -- La fonction héritée ne connaît pas encore la durée de créneau du lot 5.
  -- Cette vérification après son écriture (toujours dans la même transaction)
  -- protège donc aussi les séances existantes dont `duree_min` est absente ou
  -- représente une durée réellement observée différente du créneau annoncé.
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
           (SELECT sum((intervention->>'estimatedDurationMinutes')::DOUBLE PRECISION)
              FROM jsonb_array_elements(coalesce(autre.interventions, '[]'::JSONB)) AS interventions(intervention)),
           0
         ))
       AND autre.planifiee_pour::TIMESTAMPTZ < cible.planifiee_pour::TIMESTAMPTZ
         + make_interval(mins => coalesce(
           cible.duree_planifiee_min,
           cible.duree_min,
           (SELECT sum((intervention->>'estimatedDurationMinutes')::DOUBLE PRECISION)
              FROM jsonb_array_elements(coalesce(cible.interventions, '[]'::JSONB)) AS interventions(intervention)),
           0
         ))
  ) THEN
    RAISE EXCEPTION 'Créneau révisé en conflit.' USING ERRCODE = '40001';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.accepter_plan(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepter_plan(TEXT, JSONB) TO authenticated;
