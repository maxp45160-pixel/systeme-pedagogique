-- Correction additive issue de l'état réellement déployé sous
-- 20260829075048_corriger_somme_intervalle_acceptation_plan.
--
-- `accepter_plan_lot3_legacy` prend déjà un verrou consultatif par compte.
-- Le `FOR UPDATE` posé sur le reçu append-only rendait toutefois la lecture
-- invisible sous RLS : la table n'a volontairement aucune politique UPDATE.
-- Un rejeu identique retombait donc sur l'INSERT et levait une collision de
-- clé primaire, au lieu de renvoyer le reçu.
--
-- La forme déployée est exigée exactement. La réécriture ne touche qu'une occurrence
-- littérale, sans réécriture par expression régulière, et échoue si l'état distant a
-- dérivé. La migration est idempotente ; elle n'est pas appliquée à distance
-- par ce fichier.

DO $$
DECLARE
  v_signature TEXT := 'public.accepter_plan_lot3_legacy(text,jsonb)';
  v_definition TEXT;
  v_eol TEXT := chr(13) || chr(10);
  v_ancien TEXT;
  v_nouveau TEXT;
  v_occurrences INTEGER;
BEGIN
  IF to_regprocedure(v_signature) IS NULL THEN
    RAISE EXCEPTION 'La définition déployée % est absente.', v_signature;
  END IF;

  v_ancien := '    FROM public.orchestration_command_receipts'
    || v_eol
    || '   WHERE user_id = v_uid AND request_id = p_request_id'
    || v_eol
    || '   FOR UPDATE;';
  v_nouveau := '    FROM public.orchestration_command_receipts'
    || v_eol
    || '   WHERE user_id = v_uid AND request_id = p_request_id;';

  SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_definition;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_nouveau, ''))
  ) / length(v_nouveau);
  IF v_occurrences = 1 THEN
    RETURN;
  END IF;
  IF v_occurrences <> 0 THEN
    RAISE EXCEPTION
      'La définition déployée % contient % formes corrigées, pas une.',
      v_signature, v_occurrences;
  END IF;

  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_ancien, ''))
  ) / length(v_ancien);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION
      'La définition déployée % ne contient pas exactement le verrou de reçu attendu.',
      v_signature;
  END IF;

  v_definition := replace(v_definition, v_ancien, v_nouveau);
  IF (
    length(v_definition) - length(replace(v_definition, v_nouveau, ''))
  ) / length(v_nouveau) <> 1
  OR v_definition = pg_get_functiondef(to_regprocedure(v_signature)) THEN
    RAISE EXCEPTION 'La correction d''idempotence de % n''est pas vérifiable.', v_signature;
  END IF;

  EXECUTE v_definition;
END;
$$;
