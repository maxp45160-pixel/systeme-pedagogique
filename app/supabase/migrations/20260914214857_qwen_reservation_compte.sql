-- Réservation personnelle : identité issue du JWT, jamais fournie par le client.
CREATE FUNCTION public.qwen_reserver_compte(p_operation uuid,p_entree integer,p_sortie integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Compte non authentifié'; END IF;
 -- La fonction existante conserve les contrôles pilote, compte actif, tarifs,
 -- bornes, verrou concurrent, plafond et unicité. Aucun droit de remise à zéro.
 PERFORM public.qwen_reserver(u,p_operation,p_entree,p_sortie);
END $$;
REVOKE ALL ON FUNCTION public.qwen_reserver_compte(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qwen_reserver_compte(uuid,integer,integer) TO authenticated;
