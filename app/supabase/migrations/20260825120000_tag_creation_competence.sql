-- Migration: 20260825120000_tag_creation_competence.sql
-- Description : la creation d'une competence pose son tag initial dans
-- competence_domaines (ADR-107).
--
-- Le défaut corrigé : depuis ADR-107, la visibilité d'une compétence dans un
-- domaine se lit exclusivement dans `competence_domaines`, mais aucune commande
-- de `appliquer_commande_referentiel` n'y écrivait. La migration du 23/08
-- (20260822224009) avait comblé l'écart UNE FOIS pour les compétences
-- existantes ; toute création postérieure naissait donc sans tag — son domaine
-- n'était pas « vivant » à la lecture et disparaissait des vues, les
-- compétences tombant toutes en « À classer ». Constaté sur un compte neuf le
-- 25/08/2026 : le premier axe validé produisait un référentiel invisible.
--
-- Le correctif : la boucle commune des ajouts (`creer_domaine`,
-- `ajouter_competences`, ajouts de `reviser_domaine`, successeur de
-- `remplacer_competence`) pose désormais le tag initial, avec la même sémantique
-- que le remplissage one-shot — créer dans un domaine est le geste de rangement
-- initial. Idempotent (`ON CONFLICT DO NOTHING`), exécuté sous le drapeau
-- `app.referentiel_command` déjà posé par la fonction.
--
CREATE OR REPLACE FUNCTION public.appliquer_commande_referentiel(
  p_request_id TEXT,
  p_expected_version INTEGER,
  p_origine TEXT,
  p_motif TEXT,
  p_commande JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_type TEXT := p_commande ->> 'type';
  v_domaine_id TEXT;
  v_version_avant INTEGER;
  v_version_apres INTEGER;
  v_prefixe TEXT;
  v_numero INTEGER;
  v_code TEXT;
  v_item JSONB;
  v_ajouts JSONB := '[]'::JSONB;
  v_codes_ajoutes JSONB := '[]'::JSONB;
  v_modifiees JSONB := '[]'::JSONB;
  v_supprimees JSONB := '[]'::JSONB;
  v_archivees JSONB := '[]'::JSONB;
  v_before JSONB;
  v_after JSONB;
  v_resultat JSONB;
  v_preserver BOOLEAN;
  v_domaine_supprime BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire.'; END IF;
  IF p_origine NOT IN ('utilisateur', 'tuteur', 'migration', 'manuel') THEN RAISE EXCEPTION 'Origine inconnue : %', p_origine; END IF;
  IF length(btrim(coalesce(p_motif, ''))) = 0 THEN RAISE EXCEPTION 'Le motif est obligatoire.'; END IF;
  IF v_type NOT IN ('creer_domaine', 'ajouter_competences', 'reviser_domaine', 'activer_competences', 'archiver_competence', 'desarchiver_competence', 'retirer_competences', 'archiver_domaine', 'restaurer_domaine', 'remplacer_competence') THEN
    RAISE EXCEPTION 'Commande inconnue : %', coalesce(v_type, 'NULL');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':request:' || p_request_id, 0));

  SELECT diff -> 'resultat' INTO v_resultat
  FROM public.referentiel_changes
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_resultat; END IF;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);
  v_domaine_id := CASE WHEN v_type = 'creer_domaine' THEN p_commande #>> '{domaine,id}' ELSE p_commande ->> 'domaineId' END;
  IF length(btrim(coalesce(v_domaine_id, ''))) = 0 THEN RAISE EXCEPTION 'Identifiant de domaine obligatoire.'; END IF;

  IF v_type = 'creer_domaine' THEN
    IF p_expected_version IS NOT NULL THEN RAISE EXCEPTION 'Une création ne porte pas de version attendue.'; END IF;
    IF jsonb_array_length(coalesce(p_commande -> 'competences', '[]'::JSONB)) = 0 THEN RAISE EXCEPTION 'Un domaine doit naître avec au moins une compétence.'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':' || v_domaine_id, 0));
    INSERT INTO public.domaines (user_id, id, nom, prefixe, description, ordre, version, archive, origine)
    VALUES (
      v_uid, v_domaine_id, btrim(p_commande #>> '{domaine,nom}'), upper(btrim(p_commande #>> '{domaine,prefixe}')),
      coalesce(p_commande #>> '{domaine,description}', ''), coalesce((p_commande #>> '{domaine,ordre}')::INTEGER, 0),
      1, false, coalesce(p_commande #>> '{domaine,origine}', p_origine)
    );
    v_version_avant := NULL;
    v_version_apres := 1;
    v_ajouts := p_commande -> 'competences';
  ELSE
    SELECT version, prefixe INTO v_version_avant, v_prefixe
    FROM public.domaines
    WHERE user_id = v_uid AND id = v_domaine_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Domaine inconnu : %', v_domaine_id; END IF;
    IF p_expected_version IS NULL OR p_expected_version <> v_version_avant THEN
      RAISE EXCEPTION 'Le domaine a changé depuis son affichage (version attendue %, version actuelle %). Recharge la page.', p_expected_version, v_version_avant USING ERRCODE = '40001';
    END IF;
    SELECT jsonb_build_object(
      'domaine', to_jsonb(d) - 'user_id',
      'competences', coalesce((SELECT jsonb_agg(to_jsonb(c) - 'user_id' ORDER BY c.code) FROM public.competences c WHERE c.user_id = v_uid AND c.domaine = v_domaine_id), '[]'::JSONB)
    ) INTO v_before FROM public.domaines d WHERE d.user_id = v_uid AND d.id = v_domaine_id;
  END IF;

  SELECT prefixe INTO v_prefixe FROM public.domaines WHERE user_id = v_uid AND id = v_domaine_id;

  IF v_type = 'ajouter_competences' THEN v_ajouts := coalesce(p_commande -> 'competences', '[]'::JSONB); END IF;

  IF v_type = 'reviser_domaine' THEN
    UPDATE public.domaines SET
      nom = coalesce(nullif(btrim(p_commande #>> '{domaine,nom}'), ''), nom),
      description = CASE WHEN p_commande #> '{domaine,description}' IS NULL THEN description ELSE coalesce(p_commande #>> '{domaine,description}', '') END,
      ordre = coalesce((p_commande #>> '{domaine,ordre}')::INTEGER, ordre)
    WHERE user_id = v_uid AND id = v_domaine_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_commande -> 'modifications', '[]'::JSONB)) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id AND code = v_item ->> 'code') THEN
        RAISE EXCEPTION '% n''appartient pas au domaine %.', v_item ->> 'code', v_domaine_id;
      END IF;
      UPDATE public.competences SET
        intitule = coalesce(nullif(btrim(v_item ->> 'intitule'), ''), intitule),
        palier = coalesce(v_item ->> 'palier', palier),
        importance = coalesce((v_item ->> 'importance')::REAL, importance),
        prerequis = CASE WHEN v_item ? 'prerequis' THEN ARRAY(SELECT jsonb_array_elements_text(v_item -> 'prerequis')) ELSE prerequis END,
        ordre = coalesce((v_item ->> 'ordre')::INTEGER, ordre)
      WHERE user_id = v_uid AND code = v_item ->> 'code';
      v_modifiees := v_modifiees || jsonb_build_array(v_item ->> 'code');
    END LOOP;
    v_ajouts := coalesce(p_commande -> 'ajouts', '[]'::JSONB);
  END IF;

  IF v_type = 'remplacer_competence' THEN
    IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id AND code = p_commande ->> 'code') THEN
      RAISE EXCEPTION 'Compétence inconnue dans ce domaine : %', p_commande ->> 'code';
    END IF;
    v_ajouts := jsonb_build_array(p_commande -> 'successeur');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_ajouts) LOOP
    IF length(btrim(coalesce(v_item ->> 'intitule', ''))) < 10 THEN RAISE EXCEPTION 'Intitulé de compétence trop court.'; END IF;
    IF (v_item ->> 'palier') NOT IN ('fondamentaux', 'intermediaire', 'avance') THEN RAISE EXCEPTION 'Palier inconnu.'; END IF;
    IF (v_item ->> 'importance')::REAL NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Importance hors bornes.'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(coalesce(v_item -> 'prerequis', '[]'::JSONB)) p(code)
      WHERE NOT EXISTS (SELECT 1 FROM public.competences c WHERE c.user_id = v_uid AND c.code = p.code)
    ) THEN RAISE EXCEPTION 'Un prérequis de « % » est inconnu.', v_item ->> 'intitule'; END IF;

    SELECT coalesce(max(substring(code FROM length(v_prefixe) + 2)::INTEGER), 0) + 1 INTO v_numero
    FROM public.referentiel_codes_emis
    WHERE user_id = v_uid AND code ~ ('^' || v_prefixe || '-[0-9]+$');
    v_code := v_prefixe || '-' || lpad(v_numero::TEXT, 2, '0');
    INSERT INTO public.referentiel_codes_emis (user_id, code, domaine_id) VALUES (v_uid, v_code, v_domaine_id);
    INSERT INTO public.competences (user_id, code, domaine, intitule, palier, prerequis, importance, ordre, active, archive, origine)
    VALUES (
      v_uid, v_code, v_domaine_id, btrim(v_item ->> 'intitule'), v_item ->> 'palier',
      ARRAY(SELECT jsonb_array_elements_text(coalesce(v_item -> 'prerequis', '[]'::JSONB))),
      (v_item ->> 'importance')::REAL, coalesce((v_item ->> 'ordre')::INTEGER, 0), true, false,
      coalesce(v_item ->> 'origine', p_origine)
    );
    -- Le namespace de création devient le tag initial (ADR-107), comme le
    -- remplissage one-shot du 23/08 l'a fait pour les compétences existantes :
    -- sans cette ligne, une compétence fraîchement créée naissait sans aucun
    -- tag, son domaine n'était pas « vivant » à la lecture, et tout tombait
    -- en « À classer ». Créer dans un domaine EST le geste de rangement initial.
    INSERT INTO public.competence_domaines (user_id, code, domaine)
    VALUES (v_uid, v_code, v_domaine_id)
    ON CONFLICT DO NOTHING;
    v_codes_ajoutes := v_codes_ajoutes || jsonb_build_array(v_code);
  END LOOP;

  IF v_type = 'remplacer_competence' THEN
    UPDATE public.competences SET remplace_par = v_code, archive = true, active = false
    WHERE user_id = v_uid AND domaine = v_domaine_id AND code = p_commande ->> 'code';
    v_archivees := jsonb_build_array(p_commande ->> 'code');
  END IF;

  IF v_type = 'activer_competences' THEN
    FOR v_item IN SELECT to_jsonb(value) FROM jsonb_array_elements_text(coalesce(p_commande -> 'codes', '[]'::JSONB)) LOOP
      v_code := v_item #>> '{}';
      IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id AND code = v_code) THEN RAISE EXCEPTION '% n''appartient pas au domaine %.', v_code, v_domaine_id; END IF;
      IF coalesce((p_commande ->> 'active')::BOOLEAN, false) AND EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND code = v_code AND archive) THEN RAISE EXCEPTION '% est archivée : désarchive-la d''abord.', v_code; END IF;
      UPDATE public.competences SET active = (p_commande ->> 'active')::BOOLEAN WHERE user_id = v_uid AND code = v_code;
    END LOOP;
  END IF;

  -- Mettre de côté SANS jamais supprimer.
  --
  -- `retirer_competences` décide seul entre archivage et suppression : il
  -- supprime dès que rien ne dépend de la compétence. C'est ce qu'il faut pour
  -- un retrait d'erreur de saisie, et c'est exactement ce qu'il ne faut pas
  -- pour une mise de côté : une compétence dormante n'a par définition ni
  -- observation, ni exercice, ni relation — donc la mise de côté la
  -- SUPPRIMAIT, et la reprise promise à l'écran était impossible par
  -- construction (constaté le 24/08/2026).
  --
  -- Cette commande archive, point. Symétrique exacte de
  -- `desarchiver_competence`.
  IF v_type = 'archiver_competence' THEN
    UPDATE public.competences SET archive = true, active = false
    WHERE user_id = v_uid AND domaine = v_domaine_id AND code = p_commande ->> 'code';
    IF NOT FOUND THEN RAISE EXCEPTION 'Compétence inconnue dans ce domaine.'; END IF;
    v_archivees := v_archivees || jsonb_build_array(p_commande ->> 'code');
  END IF;

  IF v_type = 'desarchiver_competence' THEN
    UPDATE public.competences SET archive = false, active = true
    WHERE user_id = v_uid AND domaine = v_domaine_id AND code = p_commande ->> 'code';
    IF NOT FOUND THEN RAISE EXCEPTION 'Compétence inconnue dans ce domaine.'; END IF;
  END IF;

  IF v_type IN ('retirer_competences', 'reviser_domaine') THEN
    FOR v_item IN SELECT to_jsonb(value) FROM jsonb_array_elements_text(
      CASE WHEN v_type = 'retirer_competences' THEN coalesce(p_commande -> 'codes', '[]'::JSONB) ELSE coalesce(p_commande -> 'retraits', '[]'::JSONB) END
    ) LOOP
      v_code := v_item #>> '{}';
      IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id AND code = v_code) THEN RAISE EXCEPTION '% n''appartient pas au domaine %.', v_code, v_domaine_id; END IF;
      v_preserver :=
        EXISTS (SELECT 1 FROM public.observations WHERE user_id = v_uid AND skill_code = v_code)
        OR EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND (v_code = ANY(prerequis) OR remplace_par = v_code))
        OR EXISTS (SELECT 1 FROM public.exercises WHERE user_id = v_uid AND v_code = ANY(competences))
        OR EXISTS (SELECT 1 FROM public.sessions WHERE user_id = v_uid AND v_code = ANY(skill_codes));
      v_preserver := v_preserver OR EXISTS (SELECT 1 FROM public.document_links WHERE user_id = v_uid AND cible = v_code);
      IF v_preserver THEN
        UPDATE public.competences SET archive = true, active = false WHERE user_id = v_uid AND code = v_code;
        v_archivees := v_archivees || jsonb_build_array(v_code);
      ELSE
        DELETE FROM public.competences WHERE user_id = v_uid AND code = v_code;
        v_supprimees := v_supprimees || jsonb_build_array(v_code);
      END IF;
    END LOOP;
  END IF;

  IF v_type = 'archiver_domaine' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.competences c WHERE c.user_id = v_uid AND c.domaine = v_domaine_id AND (
        EXISTS (SELECT 1 FROM public.observations e WHERE e.user_id = v_uid AND e.skill_code = c.code)
        OR EXISTS (SELECT 1 FROM public.competences d WHERE d.user_id = v_uid AND (c.code = ANY(d.prerequis) OR d.remplace_par = c.code))
        OR EXISTS (SELECT 1 FROM public.exercises x WHERE x.user_id = v_uid AND c.code = ANY(x.competences))
        OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.user_id = v_uid AND c.code = ANY(s.skill_codes))
        OR EXISTS (SELECT 1 FROM public.document_links l WHERE l.user_id = v_uid AND l.cible = c.code)
      )
    ) INTO v_preserver;
    IF v_preserver THEN
      UPDATE public.competences SET archive = true, active = false WHERE user_id = v_uid AND domaine = v_domaine_id;
      UPDATE public.domaines SET archive = true WHERE user_id = v_uid AND id = v_domaine_id;
    ELSE
      -- Ne jamais supprimer le domaine : il doit rester archivable.
      -- On marque seulement les competences comme archivées s'ils ne sont plus actifs.
      UPDATE public.competences SET archive = true, active = false WHERE user_id = v_uid AND domaine = v_domaine_id;
      -- Le domaine reste en base avec archive=true, il pourra toujours être restauré.
      -- On ne supprime pas le domaine (pas de v_domaine_supprime).
    END IF;
  END IF;

  IF v_type = 'restaurer_domaine' THEN
    UPDATE public.domaines SET archive = false WHERE user_id = v_uid AND id = v_domaine_id;
    UPDATE public.competences SET archive = false, active = true
    WHERE user_id = v_uid AND domaine = v_domaine_id;
  END IF;

  IF NOT v_domaine_supprime AND v_type <> 'creer_domaine' THEN
    UPDATE public.domaines SET version = version + 1 WHERE user_id = v_uid AND id = v_domaine_id RETURNING version INTO v_version_apres;
  ELSIF v_domaine_supprime THEN
    v_version_apres := NULL;
  END IF;

  IF NOT v_domaine_supprime THEN
    SELECT jsonb_build_object(
      'domaine', to_jsonb(d) - 'user_id',
      'competences', coalesce((SELECT jsonb_agg(to_jsonb(c) - 'user_id' ORDER BY c.code) FROM public.competences c WHERE c.user_id = v_uid AND c.domaine = v_domaine_id), '[]'::JSONB)
    ) INTO v_after FROM public.domaines d WHERE d.user_id = v_uid AND d.id = v_domaine_id;
  END IF;

  v_resultat := jsonb_build_object(
    'domaineId', v_domaine_id, 'version', v_version_apres, 'codes', v_codes_ajoutes,
    'ajoutees', v_codes_ajoutes, 'modifiees', v_modifiees, 'supprimees', v_supprimees,
    'archivees', v_archivees, 'domaineSupprime', v_domaine_supprime
  );
  IF v_type = 'remplacer_competence' THEN v_resultat := v_resultat || jsonb_build_object('successeur', v_code); END IF;

  INSERT INTO public.referentiel_changes (user_id, request_id, domaine_id, type, version_avant, version_apres, origine, motif, diff)
  VALUES (v_uid, p_request_id, v_domaine_id, v_type, v_version_avant, v_version_apres, p_origine, btrim(p_motif), jsonb_build_object('avant', v_before, 'apres', v_after, 'resultat', v_resultat));
  RETURN v_resultat;
END;
$$;

-- Remplissage one-shot : les compétences créées entre la migration ADR-107
-- (23/08) et celle-ci sont nées sans tag — victimes exactes du défaut corrigé
-- ci-dessus. Même précédent que le remplissage du 23/08. Une compétence
-- délibérément détaguée par un geste manuel n'existe pas parmi elles : aucune
-- n'a jamais reçu de tag (le chemin d'écriture était absent), et aucune ne
-- porte d'observation qui justifierait de les traiter autrement.
INSERT INTO public.competence_domaines (user_id, code, domaine)
SELECT c.user_id, c.code, c.domaine
FROM public.competences c
WHERE c.archive = false
  AND EXISTS (
    SELECT 1 FROM public.domaines d
    WHERE d.user_id = c.user_id AND d.id = c.domaine AND d.archive = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.competence_domaines cd
    WHERE cd.user_id = c.user_id AND cd.code = c.code
  )
ON CONFLICT DO NOTHING;