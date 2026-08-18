-- Gouvernance transactionnelle du référentiel (proposition ADR-065).
-- Version alignee sur l'historique distant schema_migrations le 13/08/2026.
-- Migration additive : aucune donnée de domaine, compétence ou preuve n'est réécrite.

ALTER TABLE public.domaines
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE public.competences
  ADD COLUMN IF NOT EXISTS remplace_par TEXT;

ALTER TABLE public.competences
  DROP CONSTRAINT IF EXISTS competences_archive_active_check;
ALTER TABLE public.competences
  ADD CONSTRAINT competences_archive_active_check CHECK (NOT (archive AND active));

ALTER TABLE public.competences
  DROP CONSTRAINT IF EXISTS competences_remplace_par_check;
ALTER TABLE public.competences
  ADD CONSTRAINT competences_remplace_par_check CHECK (remplace_par IS NULL OR remplace_par <> code);

ALTER TABLE public.competences
  DROP CONSTRAINT IF EXISTS competences_remplace_par_fkey;
ALTER TABLE public.competences
  ADD CONSTRAINT competences_remplace_par_fkey
  FOREIGN KEY (user_id, remplace_par)
  REFERENCES public.competences(user_id, code)
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE UNIQUE INDEX IF NOT EXISTS domaines_user_nom_normalise_uidx
  ON public.domaines (user_id, lower(btrim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS competences_user_domaine_intitule_normalise_uidx
  ON public.competences (user_id, domaine, lower(btrim(intitule)));

CREATE TABLE IF NOT EXISTS public.referentiel_codes_emis (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  domaine_id  TEXT NOT NULL,
  emis_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, code)
);

INSERT INTO public.referentiel_codes_emis (user_id, code, domaine_id, emis_le)
SELECT user_id, code, domaine, created_at
FROM public.competences
ON CONFLICT (user_id, code) DO NOTHING;

ALTER TABLE public.competences
  DROP CONSTRAINT IF EXISTS competences_code_emis_fkey;
ALTER TABLE public.competences
  ADD CONSTRAINT competences_code_emis_fkey
  FOREIGN KEY (user_id, code)
  REFERENCES public.referentiel_codes_emis(user_id, code);

CREATE TABLE IF NOT EXISTS public.referentiel_changes (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  request_id    TEXT NOT NULL,
  domaine_id    TEXT NOT NULL,
  type          TEXT NOT NULL,
  version_avant INTEGER,
  version_apres INTEGER,
  origine       TEXT NOT NULL CHECK (origine IN ('utilisateur', 'tuteur', 'migration', 'manuel')),
  motif         TEXT NOT NULL CHECK (length(btrim(motif)) > 0),
  diff          JSONB NOT NULL,
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id)
);

ALTER TABLE public.referentiel_codes_emis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referentiel_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "codes_emis_lecture_compte" ON public.referentiel_codes_emis;
CREATE POLICY "codes_emis_lecture_compte"
  ON public.referentiel_codes_emis FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "codes_emis_commande_compte" ON public.referentiel_codes_emis;
CREATE POLICY "codes_emis_commande_compte"
  ON public.referentiel_codes_emis FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND current_setting('app.referentiel_command', true) = 'on'
  );

DROP POLICY IF EXISTS "referentiel_changes_lecture_compte" ON public.referentiel_changes;
CREATE POLICY "referentiel_changes_lecture_compte"
  ON public.referentiel_changes FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "referentiel_changes_commande_compte" ON public.referentiel_changes;
CREATE POLICY "referentiel_changes_commande_compte"
  ON public.referentiel_changes FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND current_setting('app.referentiel_command', true) = 'on'
  );

-- Les domaines et compétences ne sont plus mutables directement par la Data API.
-- La fonction SECURITY INVOKER ci-dessous active ce marqueur uniquement pendant
-- sa transaction ; RLS continue donc d'appliquer l'isolation par compte.
DROP POLICY IF EXISTS "isolation_par_compte" ON public.domaines;
DROP POLICY IF EXISTS "isolation_par_compte" ON public.competences;
DROP POLICY IF EXISTS "referentiel_lecture_compte" ON public.domaines;
DROP POLICY IF EXISTS "referentiel_lecture_compte" ON public.competences;
DROP POLICY IF EXISTS "referentiel_commande_compte" ON public.domaines;
DROP POLICY IF EXISTS "referentiel_commande_compte" ON public.competences;
CREATE POLICY "referentiel_lecture_compte" ON public.domaines
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "referentiel_lecture_compte" ON public.competences
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "referentiel_commande_compte" ON public.domaines
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id AND current_setting('app.referentiel_command', true) = 'on')
  WITH CHECK ((select auth.uid()) = user_id AND current_setting('app.referentiel_command', true) = 'on');
CREATE POLICY "referentiel_commande_compte" ON public.competences
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id AND current_setting('app.referentiel_command', true) = 'on')
  WITH CHECK ((select auth.uid()) = user_id AND current_setting('app.referentiel_command', true) = 'on');

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
  IF v_type NOT IN ('creer_domaine', 'ajouter_competences', 'reviser_domaine', 'activer_competences', 'desarchiver_competence', 'retirer_competences', 'archiver_domaine', 'restaurer_domaine', 'remplacer_competence') THEN
    RAISE EXCEPTION 'Commande inconnue : %', coalesce(v_type, 'NULL');
  END IF;

  -- Deux livraisons concurrentes du même geste doivent converger vers la
  -- première entrée, pas échouer sur l'unicité du journal.
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

  IF v_type = 'desarchiver_competence' THEN
    UPDATE public.competences SET archive = false
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
        EXISTS (SELECT 1 FROM public.evidence WHERE user_id = v_uid AND skill_code = v_code)
        OR EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND (v_code = ANY(prerequis) OR remplace_par = v_code))
        OR EXISTS (SELECT 1 FROM public.exercises WHERE user_id = v_uid AND v_code = ANY(competences))
        OR EXISTS (SELECT 1 FROM public.themes WHERE user_id = v_uid AND v_code = ANY(codes))
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
        EXISTS (SELECT 1 FROM public.evidence e WHERE e.user_id = v_uid AND e.skill_code = c.code)
        OR EXISTS (SELECT 1 FROM public.competences d WHERE d.user_id = v_uid AND (c.code = ANY(d.prerequis) OR d.remplace_par = c.code))
        OR EXISTS (SELECT 1 FROM public.exercises x WHERE x.user_id = v_uid AND c.code = ANY(x.competences))
        OR EXISTS (SELECT 1 FROM public.themes t WHERE t.user_id = v_uid AND c.code = ANY(t.codes))
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
    -- Restaurer rend la branche à nouveau gérable, sans la remettre au
    -- périmètre de travail : l'activation reste un second geste explicite.
    UPDATE public.competences SET archive = false, active = false
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

REVOKE ALL ON TABLE public.referentiel_codes_emis, public.referentiel_changes FROM anon;
GRANT SELECT, INSERT ON TABLE public.referentiel_codes_emis, public.referentiel_changes TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.referentiel_codes_emis, public.referentiel_changes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.domaines, public.competences TO authenticated;
REVOKE ALL ON FUNCTION public.appliquer_commande_referentiel(TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appliquer_commande_referentiel(TEXT, INTEGER, TEXT, TEXT, JSONB) TO authenticated;

CREATE INDEX IF NOT EXISTS referentiel_changes_user_domaine_date_idx
  ON public.referentiel_changes (user_id, domaine_id, cree_le DESC);

-- L'append-only est structurel, y compris pour les rôles privilégiés : toute
-- correction passe par une nouvelle entrée compensatrice, jamais par UPDATE.
CREATE OR REPLACE FUNCTION public.refuser_mutation_gouvernance_referentiel()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- L'immutabilité vaut pendant la vie du compte. La suppression explicite du
  -- compte doit néanmoins pouvoir cascader ses données personnelles.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Le registre et le journal du référentiel sont append-only';
END;
$$;

DROP TRIGGER IF EXISTS referentiel_codes_emis_append_only ON public.referentiel_codes_emis;
CREATE TRIGGER referentiel_codes_emis_append_only
  BEFORE UPDATE OR DELETE ON public.referentiel_codes_emis
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_gouvernance_referentiel();

DROP TRIGGER IF EXISTS referentiel_changes_append_only ON public.referentiel_changes;
CREATE TRIGGER referentiel_changes_append_only
  BEFORE UPDATE OR DELETE ON public.referentiel_changes
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_gouvernance_referentiel();

REVOKE ALL ON FUNCTION public.refuser_mutation_gouvernance_referentiel() FROM PUBLIC, anon, authenticated;
