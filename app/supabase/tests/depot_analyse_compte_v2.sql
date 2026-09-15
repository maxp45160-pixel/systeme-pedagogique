BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT d.user_id::text FROM public.documents d JOIN public.comptes_acces c USING(user_id) WHERE d.frontmatter->>'depot_version'='2' AND c.role='admin' AND c.depot_pilote AND c.suspendu_le IS NULL LIMIT 1),true);
SELECT set_config('test.depot',(SELECT id FROM public.documents WHERE user_id=auth.uid() AND frontmatter->>'depot_version'='2' LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE a jsonb; b jsonb; id uuid; tentative uuid;
BEGIN
 a:=public.depot_demarrer_compte(current_setting('test.depot'),repeat('a',64),false);
 IF (a->>'nouvelle')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'V2 non démarrée'; END IF;
 id:=(a->'analyse'->>'id')::uuid; tentative:=(a->'analyse'->>'tentative')::uuid;
 b:=public.depot_demarrer_compte(current_setting('test.depot'),repeat('a',64),false);
 IF (b->>'nouvelle')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'Double démarrage'; END IF;
 IF public.depot_modifier_analyse_compte(id,gen_random_uuid(),'{"statut":"echec"}') THEN RAISE EXCEPTION 'Ancienne tentative acceptée'; END IF;
 IF NOT public.depot_modifier_analyse_compte(id,tentative,'{"pages":[],"couvertures":[],"statut":"echec"}') THEN RAISE EXCEPTION 'Sauvegarde refusée'; END IF;
 b:=public.depot_demarrer_compte(current_setting('test.depot'),repeat('a',64),true);
 IF b->'analyse'->>'tentative'=tentative::text THEN RAISE EXCEPTION 'Tentative non renouvelée'; END IF;
 IF public.depot_modifier_analyse_compte(id,tentative,'{"statut":"terminee"}') THEN RAISE EXCEPTION 'Ancien écrivain accepté'; END IF;
 BEGIN
 PERFORM public.depot_modifier_analyse_compte(id,(b->'analyse'->>'tentative')::uuid,'{"user_id":"autre"}');
 RAISE EXCEPTION 'Propriété interdite acceptée';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Modification invalide' THEN RAISE; END IF; END;
 PERFORM set_config('test.analyse',id::text,true);
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
DO $$ BEGIN
 BEGIN PERFORM public.depot_demarrer_compte(current_setting('test.depot'),repeat('b',64),false); RAISE EXCEPTION 'Autre compte accepté';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Dépôt inaccessible' THEN RAISE; END IF; END;
 BEGIN PERFORM public.depot_modifier_analyse_compte(current_setting('test.analyse')::uuid,gen_random_uuid(),'{}'); RAISE EXCEPTION 'Autre compte peut modifier';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Pilote inaccessible' THEN RAISE; END IF; END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.depot_demarrer_compte('x',repeat('a',64),false); RAISE EXCEPTION 'Anonyme accepté'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
