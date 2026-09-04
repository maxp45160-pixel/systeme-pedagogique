-- Suppression explicite d'un domaine déjà archivé (ADR-142).
--
-- L'archivage reste le geste conservateur. Cette commande distincte ne retire
-- le domaine et ses compétences de namespace que lorsqu'aucune donnée
-- pédagogique, relation extérieure ou trace de relecture ne les désigne.
-- Le registre des codes émis et le journal du référentiel restent append-only.
CREATE OR REPLACE FUNCTION public.supprimer_domaine_archive(
  p_request_id TEXT,
  p_expected_version INTEGER,
  p_domaine_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_version INTEGER;
  v_archive BOOLEAN;
  v_codes TEXT[] := ARRAY[]::TEXT[];
  v_blocages TEXT[] := ARRAY[]::TEXT[];
  v_before JSONB;
  v_resultat JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN
    RAISE EXCEPTION 'request_id obligatoire.';
  END IF;
  IF length(btrim(coalesce(p_domaine_id, ''))) = 0 THEN
    RAISE EXCEPTION 'Identifiant de domaine obligatoire.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':request:' || p_request_id, 0)
  );

  SELECT diff -> 'resultat'
    INTO v_resultat
    FROM public.referentiel_changes
   WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN
    RETURN v_resultat;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':' || p_domaine_id, 0)
  );

  SELECT version, archive
    INTO v_version, v_archive
    FROM public.domaines
   WHERE user_id = v_uid AND id = p_domaine_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Domaine inconnu : %', p_domaine_id USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_version THEN
    RAISE EXCEPTION 'Le domaine a changé depuis ta lecture (version % attendue, % en base).',
      p_expected_version, v_version USING ERRCODE = '40001';
  END IF;
  IF NOT v_archive THEN
    RAISE EXCEPTION 'Mettez d''abord ce domaine de côté avant de le supprimer.';
  END IF;

  SELECT coalesce(array_agg(code ORDER BY code), ARRAY[]::TEXT[])
    INTO v_codes
    FROM public.competences
   WHERE user_id = v_uid AND domaine = p_domaine_id;

  SELECT jsonb_build_object(
    'domaine', to_jsonb(d) - 'user_id',
    'competences', coalesce((
      SELECT jsonb_agg(to_jsonb(c) - 'user_id' ORDER BY c.code)
        FROM public.competences c
       WHERE c.user_id = v_uid AND c.domaine = p_domaine_id
    ), '[]'::JSONB)
  )
    INTO v_before
    FROM public.domaines d
   WHERE d.user_id = v_uid AND d.id = p_domaine_id;

  IF EXISTS (
    SELECT 1 FROM public.domaines
     WHERE user_id = v_uid AND parent_id = p_domaine_id
  ) THEN
    v_blocages := array_append(v_blocages, 'un sous-domaine');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.competences
     WHERE user_id = v_uid AND domaine = p_domaine_id
       AND (NOT archive OR active)
  ) THEN
    v_blocages := array_append(v_blocages, 'des compétences encore actives');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.competence_domaines cd
     WHERE cd.user_id = v_uid
       AND (
         (cd.domaine = p_domaine_id AND NOT (cd.code = ANY(v_codes)))
         OR (cd.code = ANY(v_codes) AND cd.domaine <> p_domaine_id)
       )
  ) THEN
    v_blocages := array_append(v_blocages, 'des rattachements de compétences hors du domaine');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.observations
     WHERE user_id = v_uid AND skill_code = ANY(v_codes)
  ) OR EXISTS (
    SELECT 1 FROM public.competences
     WHERE user_id = v_uid AND domaine <> p_domaine_id
       AND (prerequis && v_codes OR remplace_par = ANY(v_codes))
  ) THEN
    v_blocages := array_append(v_blocages, 'des observations ou relations entre compétences');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.exercises
     WHERE user_id = v_uid
       AND (domaine = p_domaine_id OR competences && v_codes)
  ) OR EXISTS (
    SELECT 1 FROM public.sessions
     WHERE user_id = v_uid
       AND (domaines @> ARRAY[p_domaine_id] OR skill_codes && v_codes)
  ) OR EXISTS (
    SELECT 1 FROM public.engagements
     WHERE user_id = v_uid
       AND (module_domaine_id = p_domaine_id OR codes && v_codes)
  ) THEN
    v_blocages := array_append(v_blocages, 'des exercices, séances ou échéances');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.documents
     WHERE user_id = v_uid
       AND (frontmatter ->> 'domaine' = p_domaine_id OR frontmatter ->> 'domain' = p_domaine_id)
  ) OR EXISTS (
    SELECT 1 FROM public.document_links
     WHERE user_id = v_uid AND cible = ANY(v_codes)
  ) THEN
    v_blocages := array_append(v_blocages, 'des documents ou liens');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.propositions_referentiel
     WHERE user_id = v_uid
       AND (domaine_id = p_domaine_id OR versions_lues ? p_domaine_id)
  ) OR EXISTS (
    SELECT 1 FROM public.relectures_referentiel
     WHERE user_id = v_uid AND versions_lues ? p_domaine_id
  ) THEN
    v_blocages := array_append(v_blocages, 'un historique de relecture');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.moteur_decisions
     WHERE user_id = v_uid AND cible_code = ANY(v_codes)
  ) OR EXISTS (
    SELECT 1 FROM public.moteur_predictions
     WHERE user_id = v_uid AND cible_code = ANY(v_codes)
  ) THEN
    v_blocages := array_append(v_blocages, 'des décisions ou prédictions du moteur');
  END IF;

  IF cardinality(v_blocages) > 0 THEN
    RAISE EXCEPTION 'Ce domaine ne peut pas être supprimé : %.',
      array_to_string(v_blocages, ', ');
  END IF;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);

  DELETE FROM public.competences
   WHERE user_id = v_uid AND domaine = p_domaine_id;

  DELETE FROM public.domaines
   WHERE user_id = v_uid AND id = p_domaine_id;

  v_resultat := jsonb_build_object(
    'domaineId', p_domaine_id,
    'version', NULL,
    'codes', '[]'::JSONB,
    'ajoutees', '[]'::JSONB,
    'modifiees', '[]'::JSONB,
    'supprimees', to_jsonb(v_codes),
    'archivees', '[]'::JSONB,
    'rattachees', '[]'::JSONB,
    'domaineSupprime', true
  );

  INSERT INTO public.referentiel_changes (
    user_id, request_id, domaine_id, type,
    version_avant, version_apres, origine, motif, diff
  ) VALUES (
    v_uid, p_request_id, p_domaine_id, 'supprimer_domaine',
    v_version, NULL, 'utilisateur', 'Suppression définitive validée',
    jsonb_build_object('avant', v_before, 'apres', NULL, 'resultat', v_resultat)
  );

  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.supprimer_domaine_archive(TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supprimer_domaine_archive(TEXT, INTEGER, TEXT)
  TO authenticated;
