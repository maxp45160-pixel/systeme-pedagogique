-- ADR-143 : sortie V2 à 8192 jetons, V1 reste 2500 côté application.
-- Tarifs, habilitations et plafond de 5 EUR/mois inchangés.
CREATE OR REPLACE FUNCTION public.depot_reserver(p_user_id uuid,p_operation text,p_pages integer,p_entree_octets integer,p_sortie_max integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE montant bigint; utilise bigint; existant public.document_depot_usage;
BEGIN
  IF NOT public.est_admin(p_user_id) OR NOT public.compte_actif(p_user_id) THEN RAISE EXCEPTION 'Pilote inaccessible'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.comptes_acces WHERE user_id=p_user_id AND depot_pilote) THEN RAISE EXCEPTION 'Pilote non activé'; END IF;
  IF now() >= timestamptz '2026-10-06 00:00:00+00' THEN RAISE EXCEPTION 'Tarifs documentaires à revérifier'; END IF;
  IF p_pages IS NULL OR p_entree_octets IS NULL OR p_sortie_max IS NULL OR p_operation IS NULL
    OR length(p_operation) NOT BETWEEN 1 AND 200 OR p_pages NOT BETWEEN 0 AND 20
    OR p_entree_octets NOT BETWEEN 0 AND 100000 OR p_sortie_max NOT BETWEEN 0 AND 8192
    OR NOT ((p_pages>0 AND p_entree_octets=0 AND p_sortie_max=0) OR (p_pages=0 AND p_entree_octets>0 AND p_sortie_max>0))
    THEN RAISE EXCEPTION 'Réservation documentaire invalide'; END IF;
  -- Tarifs du 06/09/2026 majorés : 2 EUR/USD, incluant marge de change/taxes.
  montant := p_pages::bigint*8000 + p_entree_octets::bigint*3 + p_sortie_max::bigint*15;
  PERFORM pg_advisory_xact_lock(hashtextextended('depot-budget:'||p_user_id::text,0));
  SELECT * INTO existant FROM public.document_depot_usage WHERE user_id=p_user_id AND operation=p_operation;
  IF FOUND THEN
    IF existant.reserve_micro_euros<>montant THEN RAISE EXCEPTION 'Réservation différente'; END IF;
    RETURN jsonb_build_object('nouvelle',false,'reserve',montant);
  END IF;
  SELECT COALESCE(sum(COALESCE(facture_micro_euros,reserve_micro_euros)),0) INTO utilise
    FROM public.document_depot_usage WHERE user_id=p_user_id AND periode=date_trunc('month',now() AT TIME ZONE 'UTC')::date;
  IF utilise+montant>5000000 THEN RAISE EXCEPTION 'Budget documentaire de 5 € épuisé'; END IF;
  INSERT INTO public.document_depot_usage(user_id,operation,reserve_micro_euros) VALUES(p_user_id,p_operation,montant);
  RETURN jsonb_build_object('nouvelle',true,'reserve',montant);
END $$;
