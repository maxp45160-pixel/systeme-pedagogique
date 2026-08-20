BEGIN;

-- Lot 2 — aucune donnée historique n'est réécrite. Les 53 observations déjà
-- présentes gardent donc leur provenance telle qu'elle a été constatée au
-- cutover du lot 1. Les gardes ci-dessous ne valent que pour les écritures
-- futures.

CREATE OR REPLACE FUNCTION public.verifier_cloture_tentative_atomique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.statut = 'en-cours'
     AND NEW.statut IN ('terminee', 'abandonnee')
     AND COALESCE(current_setting('app.cloture_exercice', true), '') <> 'on'
  THEN
    RAISE EXCEPTION
      'La clôture de la tentative % doit passer par clore_exercice().', NEW.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.verifier_cloture_tentative_atomique()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verifier_source_observation_exacte()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_tentative public.attempts%ROWTYPE;
BEGIN
  IF COALESCE(current_setting('app.cloture_exercice', true), '') <> 'on' THEN
    RAISE EXCEPTION
      'Toute nouvelle observation doit être écrite par clore_exercice().'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(NEW.source) IS DISTINCT FROM 'object'
     OR NEW.source->>'kind' IS DISTINCT FROM 'exercice'
     OR COALESCE(NEW.source->>'ref', '') = ''
     OR jsonb_typeof(NEW.source->'trace') IS DISTINCT FROM 'object'
     OR NEW.source->'trace'->>'kind' IS DISTINCT FROM 'tentative'
     OR COALESCE(NEW.source->'trace'->>'ref', '') = ''
  THEN
    RAISE EXCEPTION
      'La provenance de l''observation % ne désigne pas une tentative exacte.', NEW.id
      USING ERRCODE = '22023';
  END IF;

  SELECT a.*
  INTO v_tentative
  FROM public.attempts AS a
  WHERE a.user_id = NEW.user_id
    AND a.id = NEW.source->'trace'->>'ref';

  IF NOT FOUND
     OR v_tentative.statut IS DISTINCT FROM 'terminee'
     OR v_tentative.exercise_id IS DISTINCT FROM NEW.source->>'ref'
  THEN
    RAISE EXCEPTION
      'La provenance de l''observation % ne correspond pas à une tentative terminée du même exercice.', NEW.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.verifier_source_observation_exacte()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verifier_session_exercice_atomique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.genere_automatiquement
     AND EXISTS (
       SELECT 1
       FROM jsonb_array_elements(NEW.activites) AS activites(activite)
       WHERE activite->>'type' = 'exercice'
     )
     AND COALESCE(current_setting('app.cloture_exercice', true), '') <> 'on'
  THEN
    RAISE EXCEPTION
      'Une séance automatique d''exercice doit être écrite par clore_exercice().'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.verifier_session_exercice_atomique()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.clore_exercice(
  p_tentative JSONB,
  p_observations JSONB,
  p_seance JSONB,
  p_seance_id_contexte TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tentative public.attempts%ROWTYPE;
  v_id TEXT;
  v_exercice_id TEXT;
  v_statut TEXT;
  v_fin TEXT;
  v_duree INTEGER;
  v_resultat TEXT;
  v_seance_id TEXT;
  v_seance_hote_requise BOOLEAN := false;
  v_seance_creee BOOLEAN := false;
  v_nombre_observations INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_tentative) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_tentative doit être un objet JSON.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_observations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_observations doit être un tableau JSON.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_seance) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_seance doit être un objet JSON.' USING ERRCODE = '22023';
  END IF;

  v_id := p_tentative->>'id';
  v_exercice_id := p_tentative->>'exerciseId';
  v_statut := p_tentative->>'statut';
  v_fin := p_tentative->>'fin';

  IF COALESCE(v_id, '') = ''
     OR COALESCE(v_exercice_id, '') = ''
     OR v_statut NOT IN ('terminee', 'abandonnee')
     OR COALESCE(v_fin, '') = ''
     OR jsonb_typeof(p_tentative->'dureeMin') IS DISTINCT FROM 'number'
     OR (p_tentative->>'dureeMin') !~ '^[0-9]+$'
  THEN
    RAISE EXCEPTION 'Clôture de tentative invalide.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    PERFORM v_fin::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Date de fin de tentative invalide.' USING ERRCODE = '22007';
  END;

  v_duree := (p_tentative->>'dureeMin')::integer;
  IF v_duree < 0 THEN
    RAISE EXCEPTION 'Durée de tentative invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT a.*
  INTO v_tentative
  FROM public.attempts AS a
  WHERE a.user_id = v_uid AND a.id = v_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentative introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_tentative.exercise_id IS DISTINCT FROM v_exercice_id THEN
    RAISE EXCEPTION 'La tentative ne correspond pas à l''exercice.' USING ERRCODE = '23514';
  END IF;

  IF v_tentative.statut <> 'en-cours' THEN
    IF v_tentative.statut = 'abandonnee' AND v_statut = 'abandonnee' THEN
      RETURN jsonb_build_object(
        'appliquee', false,
        'tentativeId', v_id,
        'observations', 0,
        'seanceId', NULL,
        'seanceCreee', false
      );
    END IF;
    RAISE EXCEPTION 'Cette tentative est déjà close.' USING ERRCODE = '23514';
  END IF;

  IF p_tentative ? 'notes'
     AND p_tentative->'notes' <> 'null'::jsonb
     AND jsonb_typeof(p_tentative->'notes') IS DISTINCT FROM 'string'
  THEN
    RAISE EXCEPTION 'Les notes de tentative sont invalides.' USING ERRCODE = '22023';
  END IF;
  IF p_tentative ? 'verdictTuteur'
     AND p_tentative->'verdictTuteur' <> 'null'::jsonb
     AND jsonb_typeof(p_tentative->'verdictTuteur') IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Le verdict du tuteur est invalide.' USING ERRCODE = '22023';
  END IF;

  IF p_tentative ? 'seanceHoteRequise' THEN
    IF jsonb_typeof(p_tentative->'seanceHoteRequise') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Le marqueur de séance hôte est invalide.' USING ERRCODE = '22023';
    END IF;
    v_seance_hote_requise := (p_tentative->>'seanceHoteRequise')::boolean;
  END IF;

  IF v_statut = 'terminee' THEN
    v_resultat := p_tentative->>'resultat';
    IF v_resultat NOT IN ('reussi', 'partiel', 'echec')
       OR jsonb_typeof(p_tentative->'evaluation') IS DISTINCT FROM 'object'
       OR jsonb_array_length(p_observations) = 0
    THEN
      RAISE EXCEPTION 'Une tentative terminée exige un résultat, une évaluation et des observations.'
        USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_each(p_tentative->'evaluation') AS dimension(cle, valeur)
      WHERE cle NOT IN ('comprehension', 'application', 'transfert', 'integration', 'justification')
         OR jsonb_typeof(valeur) <> 'number'
         OR (valeur #>> '{}')::numeric < 0
         OR (valeur #>> '{}')::numeric > 1
    ) THEN
      RAISE EXCEPTION 'Une dimension de l''évaluation est invalide.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_observations) AS observations(observation)
      WHERE jsonb_typeof(observation) <> 'object'
         OR COALESCE(observation->>'id', '') = ''
         OR COALESCE(observation->>'skillCode', '') = ''
         OR observation->>'date' IS DISTINCT FROM v_fin
         OR observation->>'type' NOT IN (
              'exercice', 'explication', 'code', 'calcul', 'projet',
              'correction-erreur', 'transfert', 'etude-de-cas'
            )
         OR observation->>'niveauObservation' NOT IN ('A', 'B')
         OR observation->>'autonomie' NOT IN ('A0', 'A1', 'A2', 'A3', 'A4')
         OR observation->>'qualite' NOT IN ('faible', 'moyenne', 'forte')
         OR observation->>'resultat' IS DISTINCT FROM v_resultat
         OR COALESCE(observation->>'contexte', '') = ''
         OR jsonb_typeof(observation->'dimensions') IS DISTINCT FROM 'object'
         OR observation->'dimensions' IS DISTINCT FROM p_tentative->'evaluation'
         OR jsonb_typeof(observation->'source') IS DISTINCT FROM 'object'
         OR observation->'source'->>'kind' IS DISTINCT FROM 'exercice'
         OR observation->'source'->>'ref' IS DISTINCT FROM v_exercice_id
         OR (
              observation ? 'competencesCombinees'
              AND jsonb_typeof(observation->'competencesCombinees') IS DISTINCT FROM 'array'
            )
         OR (
              observation ? 'commentaire'
              AND observation->'commentaire' <> 'null'::jsonb
              AND jsonb_typeof(observation->'commentaire') IS DISTINCT FROM 'string'
            )
    ) THEN
      RAISE EXCEPTION 'Une observation obligatoire est invalide.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_observations) AS observations(observation),
           LATERAL jsonb_each(observation->'dimensions') AS dimension(cle, valeur)
      WHERE cle NOT IN ('comprehension', 'application', 'transfert', 'integration', 'justification')
         OR jsonb_typeof(valeur) <> 'number'
         OR (valeur #>> '{}')::numeric < 0
         OR (valeur #>> '{}')::numeric > 1
    ) THEN
      RAISE EXCEPTION 'Une dimension d''observation est invalide.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_observations) AS observations(observation)
      WHERE observation ? 'competencesCombinees'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(observation->'competencesCombinees') AS codes(code)
          WHERE jsonb_typeof(code) <> 'string' OR COALESCE(code #>> '{}', '') = ''
        )
    ) THEN
      RAISE EXCEPTION 'Une compétence combinée est invalide.' USING ERRCODE = '22023';
    END IF;

    IF (
      SELECT count(*)
      FROM jsonb_array_elements(p_observations) AS observations(observation)
    ) <> (
      SELECT count(DISTINCT observation->>'skillCode')
      FROM jsonb_array_elements(p_observations) AS observations(observation)
    ) THEN
      RAISE EXCEPTION 'Une compétence ne peut recevoir deux observations dans la même clôture.'
        USING ERRCODE = '23505';
    END IF;
  ELSE
    IF jsonb_array_length(p_observations) <> 0 THEN
      RAISE EXCEPTION 'Une tentative abandonnée ne produit aucune observation.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF COALESCE(p_seance->>'id', '') = ''
     OR p_seance->>'date' IS DISTINCT FROM v_fin
     OR jsonb_typeof(p_seance->'dureeMin') IS DISTINCT FROM 'number'
     OR (p_seance->>'dureeMin') !~ '^[0-9]+$'
     OR (p_seance->>'dureeMin')::integer IS DISTINCT FROM v_duree
     OR jsonb_typeof(p_seance->'domaines') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_seance->'skillCodes') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_seance->'activites') IS DISTINCT FROM 'array'
     OR p_seance->'genereAutomatiquement' IS DISTINCT FROM 'true'::jsonb
  THEN
    RAISE EXCEPTION 'La séance de journal est invalide.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_seance->'activites') AS activites(activite)
    WHERE activite->>'type' = 'exercice'
      AND activite->>'ref' = v_exercice_id
      AND COALESCE(activite->>'libelle', '') <> ''
  ) THEN
    RAISE EXCEPTION 'La séance ne journalise pas l''exercice clos.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_seance->'domaines') AS domaines(domaine)
    WHERE jsonb_typeof(domaine) <> 'string' OR COALESCE(domaine #>> '{}', '') = ''
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_seance->'skillCodes') AS codes(code)
    WHERE jsonb_typeof(code) <> 'string' OR COALESCE(code #>> '{}', '') = ''
  ) THEN
    RAISE EXCEPTION 'Les rattachements de la séance sont invalides.' USING ERRCODE = '22023';
  END IF;

  IF v_statut = 'terminee' AND (
    jsonb_array_length(p_observations) <> jsonb_array_length(p_seance->'skillCodes')
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_seance->'skillCodes') AS codes(code)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_observations) AS observations(observation)
        WHERE observation->>'skillCode' = code
      )
    )
  ) THEN
    RAISE EXCEPTION 'Les observations obligatoires ne couvrent pas toutes les compétences de la séance.'
      USING ERRCODE = '23514';
  END IF;

  IF v_seance_hote_requise THEN
    IF COALESCE(p_seance_id_contexte, '') = '' THEN
      RAISE EXCEPTION 'La séance hôte explicite est requise.' USING ERRCODE = '22023';
    END IF;

    SELECT s.id
    INTO v_seance_id
    FROM public.sessions AS s
    WHERE s.user_id = v_uid
      AND s.id = p_seance_id_contexte
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.activites) AS activites(activite)
        WHERE activite->>'type' = 'exercice'
          AND activite->>'ref' = v_exercice_id
      )
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La séance hôte explicite est introuvable ou incohérente.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT s.id
    INTO v_seance_id
    FROM public.sessions AS s
    WHERE s.user_id = v_uid
      AND s.statut = 'en-cours'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.activites) AS activites(activite)
        WHERE activite->>'type' = 'exercice'
          AND activite->>'ref' = v_exercice_id
      )
    ORDER BY (s.id = p_seance_id_contexte) DESC, s.date DESC, s.id DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  PERFORM set_config('app.cloture_exercice', 'on', true);

  UPDATE public.attempts
  SET fin = v_fin,
      duree_min = v_duree,
      evaluation = CASE
        WHEN v_statut = 'terminee' THEN p_tentative->'evaluation'
        ELSE evaluation
      END,
      resultat = CASE
        WHEN v_statut = 'terminee' THEN v_resultat
        ELSE resultat
      END,
      statut = v_statut,
      notes = CASE
        WHEN p_tentative ? 'notes' THEN p_tentative->>'notes'
        ELSE notes
      END,
      verdict_tuteur = CASE
        WHEN p_tentative ? 'verdictTuteur' THEN p_tentative->'verdictTuteur'
        ELSE verdict_tuteur
      END
  WHERE user_id = v_uid AND id = v_id;

  IF v_statut = 'terminee' THEN
    INSERT INTO public.observations (
      id, user_id, skill_code, date, type, niveau_observation, autonomie,
      qualite, resultat, contexte, dimensions, competences_combinees, source,
      commentaire
    )
    SELECT
      observation->>'id',
      v_uid,
      observation->>'skillCode',
      observation->>'date',
      observation->>'type',
      observation->>'niveauObservation',
      observation->>'autonomie',
      observation->>'qualite',
      observation->>'resultat',
      observation->>'contexte',
      observation->'dimensions',
      CASE
        WHEN observation ? 'competencesCombinees'
        THEN ARRAY(
          SELECT jsonb_array_elements_text(observation->'competencesCombinees')
        )
        ELSE NULL
      END,
      jsonb_set(
        observation->'source',
        '{trace}',
        jsonb_build_object('kind', 'tentative', 'ref', v_id),
        true
      ),
      observation->>'commentaire'
    FROM jsonb_array_elements(p_observations) AS observations(observation);

    GET DIAGNOSTICS v_nombre_observations = ROW_COUNT;
  END IF;

  IF v_seance_id IS NULL THEN
    v_seance_id := p_seance->>'id';
    INSERT INTO public.sessions (
      id, user_id, date, duree_min, domaines, skill_codes, activites,
      resultat, difficulte, apprentissage_principal, prochaine_action,
      note_personnelle, genere_automatiquement, statut, planifiee_pour,
      besoin_declare, blueprint
    ) VALUES (
      v_seance_id,
      v_uid,
      p_seance->>'date',
      (p_seance->>'dureeMin')::integer,
      ARRAY(SELECT jsonb_array_elements_text(p_seance->'domaines')),
      ARRAY(SELECT jsonb_array_elements_text(p_seance->'skillCodes')),
      p_seance->'activites',
      p_seance->>'resultat',
      p_seance->>'difficulte',
      p_seance->>'apprentissagePrincipal',
      p_seance->>'prochaineAction',
      p_seance->>'notePersonnelle',
      true,
      p_seance->>'statut',
      p_seance->>'planifieePour',
      p_seance->'besoinDeclare',
      p_seance->'blueprint'
    );
    v_seance_creee := true;
  END IF;

  RETURN jsonb_build_object(
    'appliquee', true,
    'tentativeId', v_id,
    'observations', v_nombre_observations,
    'seanceId', v_seance_id,
    'seanceCreee', v_seance_creee
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clore_exercice(JSONB, JSONB, JSONB, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clore_exercice(JSONB, JSONB, JSONB, TEXT)
  TO authenticated;

-- Cette RPC existante vérifie déjà auth.uid(), mais elle avait gardé le droit
-- EXECUTE implicite de PUBLIC. Le lot qui fait entrer ses données dans le
-- chargement groupé aligne aussi son exposition sur la frontière RLS.
REVOKE ALL ON FUNCTION public.rattacher_competences_domaine(
  TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT[], BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rattacher_competences_domaine(
  TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT[], BOOLEAN
) TO authenticated;

-- Le chargement groupé doit porter exactement la même charge que le chemin
-- lent, dont les rattachements secondaires du référentiel (ADR-081).
CREATE OR REPLACE FUNCTION public.charger_tout()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  resultat json;
BEGIN
  SELECT json_build_object(
    'profile',     (SELECT row_to_json(p) FROM profiles p WHERE p.id = uid),
    'observations',    COALESCE((SELECT json_agg(row_to_json(e)) FROM observations e WHERE e.user_id = uid), '[]'::json),
    'exercises',   COALESCE((SELECT json_agg(row_to_json(x)) FROM exercises x WHERE x.user_id = uid), '[]'::json),
    'attempts',    COALESCE((SELECT json_agg(row_to_json(a)) FROM attempts a WHERE a.user_id = uid), '[]'::json),
    'sessions',    COALESCE((SELECT json_agg(row_to_json(s)) FROM sessions s WHERE s.user_id = uid), '[]'::json),
    'refus_recommandations',
                   COALESCE((SELECT json_agg(row_to_json(r)) FROM refus_recommandations r WHERE r.user_id = uid), '[]'::json),
    'domaines',    COALESCE((SELECT json_agg(row_to_json(d)) FROM domaines d WHERE d.user_id = uid), '[]'::json),
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json),
    'competence_domaines',
                   COALESCE((SELECT json_agg(row_to_json(cd)) FROM competence_domaines cd WHERE cd.user_id = uid), '[]'::json),
    'themes',      COALESCE((SELECT json_agg(row_to_json(t)) FROM themes t WHERE t.user_id = uid), '[]'::json),
    'moteur_reglages',
                   COALESCE((SELECT json_agg(row_to_json(m)) FROM (SELECT * FROM public.moteur_reglages WHERE user_id = uid ORDER BY applique_le ASC) m), '[]'::json)
  ) INTO resultat;

  RETURN resultat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated;

COMMIT;
