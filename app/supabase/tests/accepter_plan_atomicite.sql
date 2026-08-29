-- Réfutation de la frontière d'acceptation du plan.
--
-- À jouer SUR UNE BASE ISOLÉE :
--   psql "$URL_BASE_ISOLEE" -v ON_ERROR_STOP=1 -f accepter_plan_atomicite.sql
--
-- Le script exerce les fonctions réellement installées sous le rôle
-- `authenticated`. Il se termine par ROLLBACK et ne laisse ni compte, ni
-- séance, ni reçu derrière lui.

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_uid UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES (v_uid, 'accepter-plan-atomicite@test.invalid');
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid)::TEXT,
    true
  );
  INSERT INTO public.domaines (user_id, id, nom, prefixe)
  VALUES (v_uid, 'proof-domaine', 'Domaine de preuve', 'PRF');
  INSERT INTO public.referentiel_codes_emis (user_id, code, domaine_id)
  VALUES (v_uid, 'PRF-01', 'proof-domaine');
  INSERT INTO public.competences (user_id, code, domaine, intitule)
  VALUES (v_uid, 'PRF-01', 'proof-domaine', 'Compétence de preuve');
END;
$$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_uid UUID := auth.uid();
  v_item JSONB;
  v_payload JSONB;
  v_invalid_payload JSONB;
  v_result JSONB;
  v_replay JSONB;
  v_sessions_before INTEGER;
  v_receipts_before INTEGER;
  v_observations_before INTEGER;
  v_invalid_rejected BOOLEAN := false;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid)::TEXT,
    true
  );

  SELECT count(*) INTO v_sessions_before
    FROM public.sessions WHERE user_id = v_uid;
  SELECT count(*) INTO v_receipts_before
    FROM public.orchestration_command_receipts WHERE user_id = v_uid;
  SELECT count(*) INTO v_observations_before
    FROM public.observations WHERE user_id = v_uid;

  v_item := jsonb_build_object(
    'sessionId', 'proof-session-accepted',
    'candidateId', 'proof-candidate-accepted',
    'source', 'existing-activity',
    'plannedFor', '2099-08-29T09:00:00.000Z',
    'durationMinutes', 30,
    'domaines', jsonb_build_array('proof-domaine'),
    'skillCodes', jsonb_build_array('PRF-01'),
    'activites', jsonb_build_array(),
    'interventions', jsonb_build_array(jsonb_build_object(
      'id', 'proof-intervention-accepted',
      'type', 'resolve',
      'label', 'Résoudre',
      'estimatedDurationMinutes', 30,
      'source', jsonb_build_object('kind', 'exercise', 'ref', 'proof-exercise'),
      'expectedEffect', 'measurement'
    )),
    'origineProposition', jsonb_build_object(
      'propositionRef', 'proof-proposition',
      'candidateId', 'proof-candidate-accepted',
      'source', 'existing-activity'
    )
  );
  v_payload := jsonb_build_object(
    'propositionRef', 'proof-proposition',
    'accepted', jsonb_build_array(v_item),
    'ignoredCandidateIds', jsonb_build_array('proof-candidate-ignored'),
    'adjustments', jsonb_build_array()
  );

  v_result := public.accepter_plan('proof-request', v_payload);

  ASSERT v_result->'acceptedSessionIds' = '["proof-session-accepted"]'::JSONB,
    'la séance cochée doit être la seule séance retournée';
  ASSERT v_result->'ignoredCandidateIds' = '["proof-candidate-ignored"]'::JSONB,
    'la candidate ignorée doit rester dans le résultat comme ignorée';
  ASSERT jsonb_array_length(v_result->'adjustedSessionIds') = 0,
    'aucun ajustement ne devait être demandé';
  ASSERT (SELECT count(*) FROM public.sessions WHERE user_id = v_uid)
    = v_sessions_before + 1,
    'une acceptation doit créer exactement une séance';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.sessions
     WHERE user_id = v_uid AND id = 'proof-candidate-ignored'
  ), 'une candidate ignorée ne doit créer aucune séance';
  ASSERT EXISTS (
    SELECT 1 FROM public.sessions
     WHERE user_id = v_uid
       AND id = 'proof-session-accepted'
       AND statut = 'planifiee'
       AND blueprint IS NULL
       AND duree_min IS NULL
       AND duree_planifiee_min = 30
       AND origine_proposition = v_item->'origineProposition'
  ), 'la séance acceptée ne doit porter ni plan dérivé ni durée mesurée';
  ASSERT (SELECT count(*) FROM public.observations WHERE user_id = v_uid)
    = v_observations_before,
    'l''acceptation ne doit créer aucune observation';

  v_replay := public.accepter_plan('proof-request', v_payload);
  ASSERT v_replay = v_result,
    'un rejeu identique doit renvoyer le même reçu';
  ASSERT (SELECT count(*) FROM public.sessions WHERE user_id = v_uid)
    = v_sessions_before + 1,
    'un rejeu identique ne doit pas créer de séance';
  ASSERT (SELECT count(*) FROM public.orchestration_command_receipts WHERE user_id = v_uid)
    = v_receipts_before + 1,
    'un rejeu identique ne doit pas créer de second reçu';

  v_invalid_payload := jsonb_build_object(
    'propositionRef', 'proof-proposition-invalid',
    'accepted', jsonb_build_array(
      jsonb_set(v_item, '{sessionId}', to_jsonb('proof-session-invalid-first'::TEXT)),
      jsonb_set(
        jsonb_set(v_item, '{sessionId}', to_jsonb('proof-session-invalid-second'::TEXT)),
        '{durationMinutes}', to_jsonb(0)
      )
    ),
    'ignoredCandidateIds', jsonb_build_array(),
    'adjustments', jsonb_build_array()
  );

  BEGIN
    PERFORM public.accepter_plan('proof-request-invalid', v_invalid_payload);
  EXCEPTION WHEN OTHERS THEN
    v_invalid_rejected := true;
  END;
  ASSERT v_invalid_rejected,
    'une durée nulle doit invalider la commande';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.sessions
     WHERE user_id = v_uid
       AND id IN ('proof-session-invalid-first', 'proof-session-invalid-second')
  ), 'une commande invalide ne doit laisser aucune écriture partielle';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.orchestration_command_receipts
     WHERE user_id = v_uid AND request_id = 'proof-request-invalid'
  ), 'une commande invalide ne doit pas laisser de reçu';

  RAISE NOTICE 'PASS accepter_plan : sélection, ignorée, idempotence, tout-ou-rien, absence de plan et absence d''observation';
END;
$$;

ROLLBACK;
