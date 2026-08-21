-- Migration : rendre l'archivage d'un domaine persistant.
--
-- Le contrôle Supabase du 21/08/2026 a révélé que la fonction distante
-- appliquait encore une ancienne définition : elle consultait public.themes,
-- alors que cette table a été supprimée, et supprimait le domaine sans
-- historique au lieu de l'archiver. La définition locale canonique ne porte
-- plus ces deux comportements.
--
-- Le patch est volontairement chirurgical : il conserve toute autre évolution
-- éventuellement présente dans la fonction distante et devient un no-op si la
-- définition canonique a déjà été appliquée sur une base neuve.

DO $migration$
DECLARE
  v_definition TEXT;
  v_original TEXT;
  v_ancienne_branche TEXT := $ancienne_branche$
    IF v_preserver THEN
      UPDATE public.competences SET archive = true, active = false WHERE user_id = v_uid AND domaine = v_domaine_id;
      UPDATE public.domaines SET archive = true WHERE user_id = v_uid AND id = v_domaine_id;
    ELSE
      DELETE FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id;
      DELETE FROM public.domaines WHERE user_id = v_uid AND id = v_domaine_id;
      v_domaine_supprime := true;
    END IF;
$ancienne_branche$;
  v_nouvelle_branche TEXT := $nouvelle_branche$
    UPDATE public.competences SET archive = true, active = false WHERE user_id = v_uid AND domaine = v_domaine_id;
    UPDATE public.domaines SET archive = true WHERE user_id = v_uid AND id = v_domaine_id;
$nouvelle_branche$;
BEGIN
  SELECT pg_get_functiondef(
    'public.appliquer_commande_referentiel(text,integer,text,text,jsonb)'::regprocedure
  ) INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Fonction appliquer_commande_referentiel introuvable.';
  END IF;

  v_original := v_definition;

  v_definition := replace(
    v_definition,
    '        OR EXISTS (SELECT 1 FROM public.themes WHERE user_id = v_uid AND v_code = ANY(codes))',
    ''
  );
  v_definition := replace(
    v_definition,
    '        OR EXISTS (SELECT 1 FROM public.themes t WHERE t.user_id = v_uid AND c.code = ANY(t.codes))',
    ''
  );
  v_definition := replace(v_definition, v_ancienne_branche, v_nouvelle_branche);

  IF v_definition <> v_original THEN
    EXECUTE v_definition;
  END IF;

  IF strpos(v_definition, 'public.themes') > 0 THEN
    RAISE EXCEPTION 'La fonction d''archivage référence encore public.themes.';
  END IF;
  IF strpos(v_definition, 'DELETE FROM public.domaines') > 0 THEN
    RAISE EXCEPTION 'La fonction d''archivage peut encore supprimer un domaine.';
  END IF;
END
$migration$;
