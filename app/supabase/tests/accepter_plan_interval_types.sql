-- Vérification sans écriture du contrat PostgreSQL utilisé par accepter_plan.
-- À exécuter après la migration corrective, dans une transaction de contrôle.
-- `sum(integer)` est volontairement observé comme BIGINT : le cast porte sur
-- le résultat de l'agrégat, pas seulement sur son opérande.

DO $$
DECLARE
  v_null INTERVAL;
  v_individuelle INTERVAL;
  v_agregee INTERVAL;
BEGIN
  SELECT make_interval(mins => coalesce(NULL::INTEGER, NULL::INTEGER, 0))
    INTO v_null;
  SELECT make_interval(mins => coalesce(30::INTEGER, NULL::INTEGER, 0))
    INTO v_individuelle;
  SELECT make_interval(mins => coalesce(
    (SELECT sum(minutes)::INTEGER FROM (VALUES (30), (15)) AS durees(minutes)),
    0
  )) INTO v_agregee;

  IF v_null <> interval '0 minutes'
     OR v_individuelle <> interval '30 minutes'
     OR v_agregee <> interval '45 minutes'
  THEN
    RAISE EXCEPTION 'Contrat make_interval invalide : %, %, %', v_null, v_individuelle, v_agregee;
  END IF;
END;
$$;
