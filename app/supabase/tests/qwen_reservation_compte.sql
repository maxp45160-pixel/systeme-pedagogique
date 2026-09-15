BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.comptes_acces WHERE role='admin' AND depot_pilote AND suspendu_le IS NULL LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE op uuid := gen_random_uuid();
BEGIN
 PERFORM public.qwen_reserver_compte(op,1000,100);
 IF NOT EXISTS(SELECT 1 FROM public.qwen_usage WHERE operation=op AND user_id=auth.uid() AND reserve_micro_dollars=1500) THEN RAISE EXCEPTION 'Réservation absente'; END IF;
 BEGIN PERFORM public.qwen_reserver_compte(op,1000,100); RAISE EXCEPTION 'Doublon accepté'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN DELETE FROM public.qwen_usage WHERE operation=op; RAISE EXCEPTION 'Effacement autorisé'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
DO $$ BEGIN
 BEGIN PERFORM public.qwen_reserver_compte(gen_random_uuid(),1000,100); RAISE EXCEPTION 'Autre compte accepté';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Pilote inaccessible' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.qwen_usage) THEN RAISE EXCEPTION 'Données autre compte visibles'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.qwen_reserver_compte(gen_random_uuid(),1000,100); RAISE EXCEPTION 'Anonyme accepté';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
