-- ADR-107 — Les domaines sont des tags hiérarchiques, pas des propriétaires.
--
-- Trois gestes, tous additifs et rejouables :
--
--   1. `domaines.parent_id` — la hiérarchie récursive, sans plafond métier et
--      sans table `sous_domaines` ;
--   2. `competence_domaines` devient le porteur unique du **tag** : le domaine
--      de création (`competences.domaine`) cesse d'être un rattachement métier
--      et redevient le namespace qui a produit le code. Chaque compétence
--      existante reçoit donc un tag vers son domaine de création — sans ce
--      remplissage, tout le référentiel basculerait en « À classer » ;
--   3. `deplacer_domaine`, la commande transactionnelle qui refuse les cycles.
--
-- Ce qui n'est PAS écrit ici, et ne doit jamais l'être : la visibilité héritée.
-- Un tag posé sur un sous-domaine rend la compétence visible dans tous ses
-- ancêtres par dérivation, recalculée à chaque lecture (P1, couche 3). Aucune
-- ligne d'ancêtre n'existe en base.
--
-- ⚠️ NON APPLIQUÉE au 23/08/2026. Elle attend une autorisation explicite, et
-- l'état réel de la base doit être comparé au schéma avant de la jouer.

-- --------------------------------------------------------------------
-- 1. La hiérarchie des domaines
-- --------------------------------------------------------------------

ALTER TABLE public.domaines ADD COLUMN IF NOT EXISTS parent_id TEXT;

COMMENT ON COLUMN public.domaines.parent_id IS
  'Domaine parent, dans le même compte (ADR-107). NULL = racine. La profondeur n''a pas de plafond métier ; les cycles sont refusés par deplacer_domaine().';

DO $$
BEGIN
  -- `ON DELETE RESTRICT` et non `CASCADE` : supprimer un parent ne doit jamais
  -- emporter une branche entière de référentiel. Un domaine se retire par
  -- archivage (ADR-065), et ses enfants se déplacent avant.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'domaines_parent_fkey' AND conrelid = 'public.domaines'::regclass
  ) THEN
    ALTER TABLE public.domaines ADD CONSTRAINT domaines_parent_fkey
      FOREIGN KEY (user_id, parent_id) REFERENCES public.domaines(user_id, id)
      ON DELETE RESTRICT;
  END IF;

  -- Le cycle de longueur 1 se refuse ici, une fois pour toutes : la commande
  -- couvre les cycles plus longs, que seule une requête récursive voit.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'domaines_parent_pas_soi' AND conrelid = 'public.domaines'::regclass
  ) THEN
    ALTER TABLE public.domaines ADD CONSTRAINT domaines_parent_pas_soi
      CHECK (parent_id IS NULL OR parent_id <> id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS domaines_parent_idx
  ON public.domaines (user_id, parent_id);

-- --------------------------------------------------------------------
-- 2. Le tag remplace le porteur
-- --------------------------------------------------------------------

-- Le trigger refusait qu'une compétence soit taguée vers son domaine de
-- création : sous ADR-081 ce rattachement l'aurait comptée deux fois dans sa
-- propre couverture. Sous ADR-107 il n'y a plus de « double » — il n'y a qu'un
-- ensemble de tags, dédupliqué par la clé primaire.
DROP TRIGGER IF EXISTS competence_domaines_hors_porteur ON public.competence_domaines;
DROP FUNCTION IF EXISTS public.rattachement_hors_porteur();

COMMENT ON TABLE public.competence_domaines IS
  'Tags de domaine d''une compétence (ADR-107). Une compétence peut en porter plusieurs, ou aucune — elle est alors « À classer ». competences.domaine reste le namespace de création du code, jamais un tag.';

COMMENT ON COLUMN public.competences.domaine IS
  'Namespace de création : c''est lui qui a produit le code (LOG-01) et il porte la gouvernance d''ADR-065. Depuis ADR-107 ce n''est PLUS un rattachement métier — la visibilité d''une compétence se lit dans competence_domaines.';

-- Remplissage : le domaine de création devient un tag explicite. Idempotent,
-- et sans effet sur un compte déjà migré. Il ne se rejoue pas non plus contre
-- l'intention d'une personne : une migration ne s'exécute qu'une fois, et un
-- tag retiré ensuite ne revient pas.
INSERT INTO public.competence_domaines (user_id, code, domaine)
SELECT c.user_id, c.code, c.domaine FROM public.competences c
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------
-- 3. Taguer — la commande d'ADR-065, débarrassée de la règle du porteur
-- --------------------------------------------------------------------

-- `rattacher_competences_domaine` appliquait la règle réfutée : elle levait dès
-- qu'on visait le domaine porteur. La laisser en place maintiendrait un second
-- chemin d'écriture appliquant un modèle abandonné.
DROP FUNCTION IF EXISTS public.rattacher_competences_domaine(text, integer, text, text, text, text[], boolean);

CREATE OR REPLACE FUNCTION public.taguer_competences_domaine(
  p_request_id text,
  p_expected_version integer,
  p_origine text,
  p_motif text,
  p_domaine_id text,
  p_codes text[],
  p_tague boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_version_avant INTEGER;
  v_version_apres INTEGER;
  v_resultat JSONB;
  v_code TEXT;
  v_touches JSONB := '[]'::JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire.'; END IF;
  IF p_origine NOT IN ('utilisateur', 'tuteur', 'migration', 'manuel') THEN RAISE EXCEPTION 'Origine inconnue : %', p_origine; END IF;
  IF length(btrim(coalesce(p_motif, ''))) = 0 THEN RAISE EXCEPTION 'Le motif est obligatoire.'; END IF;
  IF coalesce(array_length(p_codes, 1), 0) = 0 THEN RAISE EXCEPTION 'Aucune compétence à taguer.'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':request:' || p_request_id, 0));

  SELECT diff -> 'resultat' INTO v_resultat
  FROM public.referentiel_changes
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_resultat; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':' || p_domaine_id, 0));

  SELECT version INTO v_version_avant FROM public.domaines
  WHERE user_id = v_uid AND id = p_domaine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Domaine inconnu : %', p_domaine_id; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_version_avant THEN
    RAISE EXCEPTION 'Le domaine a changé depuis ta lecture (version % attendue, % en base).', p_expected_version, v_version_avant USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);

  FOREACH v_code IN ARRAY p_codes LOOP
    IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND code = v_code) THEN
      RAISE EXCEPTION 'Compétence inconnue : %', v_code;
    END IF;

    IF p_tague THEN
      INSERT INTO public.competence_domaines (user_id, code, domaine)
      VALUES (v_uid, v_code, p_domaine_id)
      ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.competence_domaines
      WHERE user_id = v_uid AND code = v_code AND domaine = p_domaine_id;
    END IF;
    v_touches := v_touches || to_jsonb(v_code);
  END LOOP;

  UPDATE public.domaines SET version = version + 1
  WHERE user_id = v_uid AND id = p_domaine_id
  RETURNING version INTO v_version_apres;

  v_resultat := jsonb_build_object(
    'domaineId', p_domaine_id,
    'version', v_version_apres,
    'taguees', CASE WHEN p_tague THEN v_touches ELSE '[]'::JSONB END,
    'detaguees', CASE WHEN p_tague THEN '[]'::JSONB ELSE v_touches END
  );

  INSERT INTO public.referentiel_changes (user_id, request_id, domaine_id, type, version_avant, version_apres, origine, motif, diff)
  VALUES (
    v_uid, p_request_id, p_domaine_id,
    CASE WHEN p_tague THEN 'taguer_competences' ELSE 'detaguer_competences' END,
    v_version_avant, v_version_apres, p_origine, btrim(p_motif),
    jsonb_build_object('resultat', v_resultat)
  );

  RETURN v_resultat;
END;
$$;

REVOKE ALL ON FUNCTION public.taguer_competences_domaine(text, integer, text, text, text, text[], boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.taguer_competences_domaine(text, integer, text, text, text, text[], boolean) TO authenticated;

-- --------------------------------------------------------------------
-- 4. Déplacer — la commande qui refuse les cycles
-- --------------------------------------------------------------------

-- Elle ne rejoint pas `appliquer_commande_referentiel`, pour la raison déjà
-- retenue par ADR-081 : cette fonction déclare ses types dans un bloc unique de
-- plus de 13 Ko, et l'étendre ferait porter à un ajout périphérique le risque
-- de réécrire tout le chemin d'écriture du référentiel. Les garanties d'ADR-065
-- sont reprises telles quelles : idempotence par `request_id`, version
-- optimiste, journal append-only, drapeau de commande, `SECURITY INVOKER`.
--
-- Déplacer un domaine ne touche AUCUNE compétence, AUCUNE observation, AUCUN
-- score : seule la visibilité dérivée change, et elle se recalcule.
CREATE OR REPLACE FUNCTION public.deplacer_domaine(
  p_request_id text,
  p_expected_version integer,
  p_origine text,
  p_motif text,
  p_domaine_id text,
  p_parent_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_version_avant INTEGER;
  v_version_apres INTEGER;
  v_parent_avant TEXT;
  v_resultat JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire.'; END IF;
  IF p_origine NOT IN ('utilisateur', 'tuteur', 'migration', 'manuel') THEN RAISE EXCEPTION 'Origine inconnue : %', p_origine; END IF;
  IF length(btrim(coalesce(p_motif, ''))) = 0 THEN RAISE EXCEPTION 'Le motif est obligatoire.'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':request:' || p_request_id, 0));

  SELECT diff -> 'resultat' INTO v_resultat
  FROM public.referentiel_changes
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_resultat; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':' || p_domaine_id, 0));

  SELECT version, parent_id INTO v_version_avant, v_parent_avant
  FROM public.domaines
  WHERE user_id = v_uid AND id = p_domaine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Domaine inconnu : %', p_domaine_id; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_version_avant THEN
    RAISE EXCEPTION 'Le domaine a changé depuis ta lecture (version % attendue, % en base).', p_expected_version, v_version_avant USING ERRCODE = '40001';
  END IF;

  IF p_parent_id IS NOT NULL THEN
    IF p_parent_id = p_domaine_id THEN
      RAISE EXCEPTION 'Un domaine ne peut pas être son propre parent.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.domaines WHERE user_id = v_uid AND id = p_parent_id) THEN
      RAISE EXCEPTION 'Domaine parent inconnu : %', p_parent_id;
    END IF;
    -- Le parent visé ne doit pas descendre du domaine déplacé : la branche se
    -- refermerait sur elle-même et toute lecture d'ancêtres boucherait.
    IF EXISTS (
      WITH RECURSIVE descendance AS (
        SELECT d.id FROM public.domaines d WHERE d.user_id = v_uid AND d.id = p_domaine_id
        UNION
        SELECT enfant.id FROM public.domaines enfant
        JOIN descendance parent ON enfant.parent_id = parent.id
        WHERE enfant.user_id = v_uid
      )
      SELECT 1 FROM descendance WHERE id = p_parent_id
    ) THEN
      RAISE EXCEPTION 'Parenté circulaire refusée : « % » descend de « % ».', p_parent_id, p_domaine_id;
    END IF;
  END IF;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);

  UPDATE public.domaines SET parent_id = p_parent_id, version = version + 1
  WHERE user_id = v_uid AND id = p_domaine_id
  RETURNING version INTO v_version_apres;

  v_resultat := jsonb_build_object(
    'domaineId', p_domaine_id,
    'version', v_version_apres,
    'parentAvant', v_parent_avant,
    'parentApres', p_parent_id
  );

  INSERT INTO public.referentiel_changes (user_id, request_id, domaine_id, type, version_avant, version_apres, origine, motif, diff)
  VALUES (
    v_uid, p_request_id, p_domaine_id, 'deplacer_domaine',
    v_version_avant, v_version_apres, p_origine, btrim(p_motif),
    jsonb_build_object('resultat', v_resultat)
  );

  RETURN v_resultat;
END;
$$;

REVOKE ALL ON FUNCTION public.deplacer_domaine(text, integer, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deplacer_domaine(text, integer, text, text, text, text) TO authenticated;
