-- Correction historique appliquée sous la version distante 20260828212629.
--
-- Elle a bien remplacé les casts DOUBLE PRECISION incompatibles avec
-- make_interval(mins => integer), mais elle n'a pas corrigé le type de retour
-- de sum(integer), qui reste BIGINT. La correction complète est additive dans
-- `20260829072035_corriger_somme_intervalle_acceptation_plan.sql` et exige cet
-- état précis avant de poursuivre. Ne pas rejouer cette migration.

DO $$
DECLARE
  v_signature TEXT;
  v_definition TEXT;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.accepter_plan_lot3_legacy(text,jsonb)',
    'public.accepter_plan(text,jsonb)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT regexp_replace(pg_get_functiondef(p.oid), '::double precision', '::INTEGER', 'gi')
      INTO v_definition
      FROM pg_proc p
     WHERE p.oid = to_regprocedure(v_signature);

    IF v_definition IS NULL OR v_definition = pg_get_functiondef(to_regprocedure(v_signature)) THEN
      RAISE EXCEPTION 'La définition de % ne contient pas le cast attendu.', v_signature;
    END IF;

    EXECUTE v_definition;
  END LOOP;
END;
$$;
