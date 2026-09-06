-- À exécuter comme postgres sur une base possédant deux comptes administrateurs.
-- Tout est annulé ; aucun fournisseur IA ni fichier Storage n'est sollicité.
BEGIN;
DO $$
DECLARE
  u uuid; autre uuid; d text := 'test-depot-'||gen_random_uuid()::text;
  a jsonb; b jsonb; c jsonb; refuse boolean; n integer; total bigint;
  prefixe text := 'test-'||gen_random_uuid()::text;
BEGIN
  SELECT user_id INTO u FROM public.comptes_acces WHERE role='admin' AND suspendu_le IS NULL ORDER BY user_id LIMIT 1;
  SELECT user_id INTO autre FROM public.comptes_acces WHERE role='admin' AND suspendu_le IS NULL AND user_id<>u ORDER BY user_id LIMIT 1;
  IF u IS NULL OR autre IS NULL THEN RAISE EXCEPTION 'Deux comptes de test actifs requis'; END IF;
  UPDATE public.comptes_acces SET depot_pilote=true WHERE user_id=u;
  INSERT INTO public.documents(user_id,id,contenu_md,frontmatter)
    VALUES(u,d,'Note de test','{"role":"support","depot_version":1}'),(autre,d,'Autre note de test','{"role":"support","depot_version":1}');
  EXECUTE 'SET LOCAL ROLE service_role';
  a := public.depot_demarrer(u,d,repeat('a',64));
  b := public.depot_demarrer(u,d,repeat('a',64));
  IF NOT (a->>'nouvelle')::boolean OR (b->>'nouvelle')::boolean OR a->'analyse'->>'id'<>b->'analyse'->>'id' THEN RAISE EXCEPTION 'Double lancement'; END IF;
  b := public.depot_demarrer(u,d,repeat('a',64),true);
  IF (b->>'nouvelle')::boolean THEN RAISE EXCEPTION 'Reprise trop tôt'; END IF;
  UPDATE public.document_depot_analyses SET statut='echec' WHERE id=(a->'analyse'->>'id')::uuid;
  b := public.depot_demarrer(u,d,repeat('a',64),true);
  IF NOT (b->>'nouvelle')::boolean OR a->'analyse'->>'tentative'=b->'analyse'->>'tentative' THEN RAISE EXCEPTION 'Reprise non isolée'; END IF;
  UPDATE public.document_depot_analyses SET statut='terminee' WHERE id=(a->'analyse'->>'id')::uuid AND tentative=(a->'analyse'->>'tentative')::uuid;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Ancienne tentative encore autorisée'; END IF;
  INSERT INTO public.document_depot_analyses(user_id,document_id,empreinte) VALUES(autre,d,repeat('b',64));

  -- Budget : réserve inconnue conservée, répétition idempotente, aucun dépassement.
  -- On isole le test des dépenses réelles, uniquement dans cette transaction annulée.
  DELETE FROM public.document_depot_usage WHERE user_id=u;
  FOR n IN 1..31 LOOP PERFORM public.depot_reserver(u,prefixe||n,20,0,0); END LOOP;
  c := public.depot_reserver(u,prefixe||1,20,0,0);
  IF (c->>'nouvelle')::boolean THEN RAISE EXCEPTION 'Double réservation'; END IF;
  refuse:=false;
  BEGIN PERFORM public.depot_reserver(u,prefixe||32,20,0,0);
  EXCEPTION WHEN raise_exception THEN refuse:=SQLERRM LIKE 'Budget%'; END;
  IF NOT refuse THEN RAISE EXCEPTION 'Plafond dépassé'; END IF;
  PERFORM public.depot_finaliser_cout(u,prefixe||1,8000);
  PERFORM public.depot_finaliser_cout(u,prefixe||1,8000);
  PERFORM public.depot_reserver(u,prefixe||32,20,0,0);
  SELECT sum(coalesce(facture_micro_euros,reserve_micro_euros)) INTO total FROM public.document_depot_usage WHERE user_id=u;
  IF total<>4968000 THEN RAISE EXCEPTION 'Décompte inattendu : %',total; END IF;
  refuse:=false;
  BEGIN PERFORM public.depot_finaliser_cout(u,prefixe||1,0);
  EXCEPTION WHEN raise_exception THEN refuse:=true; END;
  IF NOT refuse THEN RAISE EXCEPTION 'Remboursement réécrit'; END IF;

  -- Le JWT d'un administrateur reste limité à ses propres contenus.
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.document_depot_analyses WHERE document_id=d;
  IF n<>1 THEN RAISE EXCEPTION 'Fuite intercomptes'; END IF;
  INSERT INTO public.document_depot_corrections(id,user_id,document_id,texte) VALUES(gen_random_uuid(),u,d,'Précision humaine');
  refuse:=false;
  BEGIN INSERT INTO public.document_depot_corrections(id,user_id,document_id,texte) VALUES(gen_random_uuid(),autre,d,'Interdit');
  EXCEPTION WHEN insufficient_privilege THEN refuse:=true; END;
  IF NOT refuse THEN RAISE EXCEPTION 'Correction étrangère autorisée'; END IF;
  refuse:=false;
  BEGIN PERFORM public.depot_reserver(u,prefixe||'navigateur',1,0,0);
  EXCEPTION WHEN insufficient_privilege THEN refuse:=true; END;
  IF NOT refuse THEN RAISE EXCEPTION 'RPC serveur exposée'; END IF;
  IF has_table_privilege('authenticated','public.document_depot_usage','UPDATE')
    OR has_table_privilege('authenticated','public.document_depot_analyses','INSERT') THEN RAISE EXCEPTION 'Écriture IA exposée'; END IF;
  EXECUTE 'RESET ROLE';
  DELETE FROM public.documents WHERE user_id=u AND id=d;
  IF EXISTS(SELECT 1 FROM public.document_depot_analyses WHERE user_id=u AND document_id=d)
    OR EXISTS(SELECT 1 FROM public.document_depot_corrections WHERE user_id=u AND document_id=d) THEN RAISE EXCEPTION 'Purge documentaire incomplète'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.document_depot_usage WHERE user_id=u) THEN RAISE EXCEPTION 'Purge source efface le budget'; END IF;
  UPDATE public.comptes_acces SET depot_pilote=false WHERE user_id=u;
  refuse:=false;
  BEGIN PERFORM public.depot_reserver(u,prefixe||'inactif',1,0,0);
  EXCEPTION WHEN raise_exception THEN refuse:=SQLERRM LIKE 'Pilote%'; END;
  IF NOT refuse THEN RAISE EXCEPTION 'Pilote désactivé autorisé'; END IF;
END $$;
ROLLBACK;
SELECT 'Dépôt : idempotence, reprise, budget, RLS et purge vérifiés ; transaction annulée' AS resultat;
