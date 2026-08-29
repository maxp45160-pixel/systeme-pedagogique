-- Correction postérieure à l'état réellement déployé.
--
-- La version distante 20260828212629 a remplacé les casts DOUBLE PRECISION
-- par des casts INTEGER dans les deux frontières. Elle laisse toutefois
-- `sum(integer)` produire un BIGINT ; la résolution nommée de
-- make_interval(mins => ...) échoue donc encore avant toute écriture.
--
-- Cette migration ne rejoue ni le lot 1, ni le lot 3, ni le lot 5. Elle exige
-- leurs deux signatures réellement présentes et transforme exactement les
-- trois sommes de chaque définition. `replace` est volontairement littéral
-- et borné par un comptage ; aucune regexp ne peut réécrire une définition
-- différente silencieusement.

DO $$
DECLARE
  v_signature TEXT;
  v_definition TEXT;
  v_ancien TEXT := 'sum((intervention->>''estimatedDurationMinutes'')::INTEGER)';
  v_nouveau TEXT := 'sum((intervention->>''estimatedDurationMinutes'')::INTEGER)::INTEGER';
  v_occurrences INTEGER;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.accepter_plan_lot3_legacy(text,jsonb)',
    'public.accepter_plan(text,jsonb)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'La définition déployée % est absente.', v_signature;
    END IF;

    SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_definition;
    v_occurrences := (
      length(v_definition) - length(replace(v_definition, v_nouveau, ''))
    ) / length(v_nouveau);
    IF v_occurrences = 3 THEN
      CONTINUE;
    END IF;
    IF v_occurrences <> 0 THEN
      RAISE EXCEPTION
        'La définition déployée % contient % corrections partielles, pas 3.',
        v_signature, v_occurrences;
    END IF;

    v_occurrences := (
      length(v_definition) - length(replace(v_definition, v_ancien, ''))
    ) / length(v_ancien);
    IF v_occurrences <> 3 THEN
      RAISE EXCEPTION
        'La définition déployée % contient % occurrences attendues de la somme, pas 3.',
        v_signature, v_occurrences;
    END IF;

    v_definition := replace(v_definition, v_ancien, v_nouveau);
    v_occurrences := (
      length(v_definition) - length(replace(v_definition, v_nouveau, ''))
    ) / length(v_nouveau);
    IF v_definition = pg_get_functiondef(to_regprocedure(v_signature))
       OR v_occurrences <> 3
    THEN
      RAISE EXCEPTION 'La correction de % n''a pas produit une définition vérifiable.', v_signature;
    END IF;

    EXECUTE v_definition;
  END LOOP;
END;
$$;
