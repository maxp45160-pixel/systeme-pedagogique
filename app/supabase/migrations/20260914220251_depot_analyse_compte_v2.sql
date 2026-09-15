CREATE OR REPLACE FUNCTION public.depot_demarrer(p_user_id uuid, p_document_id text, p_empreinte text, p_reprise boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE a public.document_depot_analyses; nouvelle boolean := false;
BEGIN
  IF NOT public.est_admin(p_user_id) OR NOT public.compte_actif(p_user_id)
    OR NOT EXISTS (SELECT 1 FROM public.comptes_acces WHERE user_id=p_user_id AND depot_pilote) OR NOT EXISTS (
    SELECT 1 FROM public.documents WHERE user_id=p_user_id AND id=p_document_id AND frontmatter->>'depot_version' IN ('1','2')
  ) THEN RAISE EXCEPTION 'Dépôt inaccessible'; END IF;
  INSERT INTO public.document_depot_analyses(user_id,document_id,empreinte)
    VALUES(p_user_id,p_document_id,p_empreinte) ON CONFLICT DO NOTHING RETURNING * INTO a;
  IF FOUND THEN nouvelle := true;
  ELSE
    SELECT * INTO a FROM public.document_depot_analyses WHERE user_id=p_user_id AND document_id=p_document_id AND empreinte=p_empreinte FOR UPDATE;
    IF p_reprise AND (a.statut IN ('echec','interrompue') OR (a.statut='en-cours' AND a.updated_at < now()-interval '5 minutes')) THEN
      UPDATE public.document_depot_analyses SET statut='en-cours',tentative=gen_random_uuid(),erreur=NULL,updated_at=now()
        WHERE id=a.id RETURNING * INTO a;
      nouvelle := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('analyse',to_jsonb(a),'nouvelle',nouvelle);
END $function$
;
CREATE FUNCTION public.depot_demarrer_compte(p_document_id text,p_empreinte text,p_reprise boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Compte non authentifié'; END IF;
 RETURN public.depot_demarrer(auth.uid(),p_document_id,p_empreinte,p_reprise);
END $$;
REVOKE ALL ON FUNCTION public.depot_demarrer_compte(text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.depot_demarrer_compte(text,text,boolean) TO authenticated;

CREATE FUNCTION public.depot_modifier_analyse_compte(p_id uuid,p_tentative uuid,p_valeurs jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); resultat uuid;
BEGIN
 IF u IS NULL OR NOT public.est_admin(u) OR NOT public.compte_actif(u)
 OR NOT EXISTS(SELECT 1 FROM public.comptes_acces WHERE user_id=u AND depot_pilote)
 THEN RAISE EXCEPTION 'Pilote inaccessible'; END IF;
 IF p_valeurs IS NULL OR jsonb_typeof(p_valeurs)<>'object' OR octet_length(p_valeurs::text)>10000000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_valeurs) AS k WHERE k NOT IN ('pages','couvertures','restitution','statut','erreur','note_source'))
 THEN RAISE EXCEPTION 'Modification invalide'; END IF;
 IF (p_valeurs ? 'pages' AND jsonb_typeof(p_valeurs->'pages')<>'array')
 OR (p_valeurs ? 'couvertures' AND jsonb_typeof(p_valeurs->'couvertures')<>'array')
 OR (p_valeurs ? 'restitution' AND jsonb_typeof(p_valeurs->'restitution')<>'object')
 OR (p_valeurs ? 'statut' AND (p_valeurs->>'statut' IS NULL OR p_valeurs->>'statut' NOT IN ('en-cours','terminee','interrompue','echec')))
 OR (p_valeurs ? 'erreur' AND (jsonb_typeof(p_valeurs->'erreur')<>'string' OR length(p_valeurs->>'erreur')>2000))
 OR (p_valeurs ? 'note_source' AND jsonb_typeof(p_valeurs->'note_source')<>'string')
 THEN RAISE EXCEPTION 'Modification invalide'; END IF;
 UPDATE public.document_depot_analyses SET
 pages=CASE WHEN p_valeurs ? 'pages' THEN p_valeurs->'pages' ELSE pages END,
 couvertures=CASE WHEN p_valeurs ? 'couvertures' THEN p_valeurs->'couvertures' ELSE couvertures END,
 restitution=CASE WHEN p_valeurs ? 'restitution' THEN p_valeurs->'restitution' ELSE restitution END,
 statut=CASE WHEN p_valeurs ? 'statut' THEN p_valeurs->>'statut' ELSE statut END,
 erreur=CASE WHEN p_valeurs ? 'erreur' THEN p_valeurs->>'erreur' ELSE erreur END,
 note_source=CASE WHEN p_valeurs ? 'note_source' THEN p_valeurs->>'note_source' ELSE note_source END,
 updated_at=now()
 WHERE id=p_id AND user_id=u AND tentative=p_tentative AND statut='en-cours'
 RETURNING id INTO resultat;
 RETURN resultat IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.depot_modifier_analyse_compte(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.depot_modifier_analyse_compte(uuid,uuid,jsonb) TO authenticated;
