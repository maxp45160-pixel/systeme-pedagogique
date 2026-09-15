-- Enveloppe d'essai Qwen : 5 USD cumulés, hors taxes, sans remise à zéro.
CREATE TABLE public.qwen_usage (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 operation uuid NOT NULL,
 reserve_micro_dollars bigint NOT NULL CHECK (reserve_micro_dollars BETWEEN 1 AND 5000000),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, operation)
);
ALTER TABLE public.qwen_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qwen_usage FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.qwen_usage TO authenticated;
GRANT ALL ON public.qwen_usage TO service_role;
CREATE POLICY qwen_usage_lire ON public.qwen_usage FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE FUNCTION public.qwen_reserver(p_user_id uuid,p_operation uuid,p_entree integer,p_sortie integer)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE utilise bigint; montant bigint;
BEGIN
 IF NOT public.est_admin(p_user_id) OR NOT public.compte_actif(p_user_id)
 OR NOT EXISTS(SELECT 1 FROM public.comptes_acces WHERE user_id=p_user_id AND depot_pilote)
 THEN RAISE EXCEPTION 'Pilote inaccessible'; END IF;
 IF now() >= timestamptz '2026-10-15 00:00:00+00' THEN RAISE EXCEPTION 'Tarifs Qwen à revérifier'; END IF;
 IF p_operation IS NULL OR p_entree IS NULL OR p_sortie IS NULL OR p_entree NOT BETWEEN 1 AND 120000 OR p_sortie NOT BETWEEN 1 AND 8192 THEN RAISE EXCEPTION 'Réservation Qwen invalide'; END IF;
 -- Borne majorée 1 USD / M entrants et 5 USD / M sortants pour Qwen3-VL-Plus <=128K.
 montant := p_entree::bigint + p_sortie::bigint*5;
 PERFORM pg_advisory_xact_lock(hashtextextended('qwen-budget:'||p_user_id::text,0));
 SELECT COALESCE(sum(reserve_micro_dollars),0) INTO utilise FROM public.qwen_usage WHERE user_id=p_user_id;
 IF utilise+montant>5000000 THEN RAISE EXCEPTION 'Budget Qwen de 5 $ épuisé'; END IF;
 INSERT INTO public.qwen_usage(user_id,operation,reserve_micro_dollars) VALUES(p_user_id,p_operation,montant);
END $$;
REVOKE ALL ON FUNCTION public.qwen_reserver(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qwen_reserver(uuid,uuid,integer,integer) TO service_role;

