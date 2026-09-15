BEGIN;
SELECT set_config('test.qwen_user',(SELECT user_id::text FROM public.comptes_acces WHERE role='admin' AND depot_pilote AND suspendu_le IS NULL LIMIT 1),true);
SET LOCAL ROLE service_role;
DO $$
DECLARE u uuid:=current_setting('test.qwen_user')::uuid; op uuid:=gen_random_uuid(); avant bigint; apres bigint; refuse boolean:=false;
BEGIN
 SELECT coalesce(sum(reserve_micro_dollars),0) INTO avant FROM public.qwen_usage WHERE user_id=u;
 PERFORM public.qwen_reserver(u,op,120000,8192);
 BEGIN PERFORM public.qwen_reserver(u,op,120000,8192); RAISE EXCEPTION 'Doublon accepté'; EXCEPTION WHEN unique_violation THEN NULL; END;
 FOR i IN 1..40 LOOP
   BEGIN PERFORM public.qwen_reserver(u,gen_random_uuid(),120000,8192);
   EXCEPTION WHEN raise_exception THEN
     IF SQLERRM NOT LIKE 'Budget%' THEN RAISE; END IF;
     refuse:=true; EXIT;
   END;
 END LOOP;
 SELECT coalesce(sum(reserve_micro_dollars),0) INTO apres FROM public.qwen_usage WHERE user_id=u;
 IF NOT refuse OR apres>5000000 OR apres<=avant THEN RAISE EXCEPTION 'Plafond invalide'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('test.qwen_user'),true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.qwen_usage) THEN RAISE EXCEPTION 'Lecture propre compte refusée'; END IF;
 BEGIN PERFORM public.qwen_reserver(current_setting('test.qwen_user')::uuid,gen_random_uuid(),1,1); RAISE EXCEPTION 'RPC publique'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.qwen_usage) THEN RAISE EXCEPTION 'RLS invalide'; END IF; END $$;
ROLLBACK;
