-- Test de la migration ADR-107, à jouer SUR UNE BASE ISOLÉE.
--
-- Pourquoi un script et non un test Vitest : ce qui est vérifié ici n'existe
-- qu'en base — le refus des cycles par requête récursive, l'idempotence par
-- `request_id`, le verrou optimiste, l'écriture append-only du journal. Les
-- reproduire en TypeScript testerait une imitation de PostgreSQL, pas
-- PostgreSQL. C'est le même régime que le test de réfutation d'ADR-065 :
-- « sur une base isolée ».
--
-- Emploi :
--   psql "$URL_BASE_ISOLEE" -v ON_ERROR_STOP=1 -f adr_107_hierarchie_tags.sql
--
-- Le script se termine par un ROLLBACK : il ne laisse rien derrière lui.
-- Il suppose le schéma appliqué, migration `20260823090000` comprise.

\set ON_ERROR_STOP on

BEGIN;

-- ------------------------------------------------------------------
-- Un compte de test, et l'usurpation d'identité qui va avec.
--
-- Les commandes sont `SECURITY INVOKER` et lisent `auth.uid()` : sans ce
-- réglage, elles lèveraient « Authentification requise » et le script
-- passerait pour vert sans avoir rien exercé.
-- ------------------------------------------------------------------

CREATE TEMP TABLE t_compte AS SELECT gen_random_uuid() AS uid;

DO $$
DECLARE v_uid UUID := (SELECT uid FROM t_compte);
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'adr107@test.invalid')
  ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
END;
$$;

-- Le référentiel de départ, semé comme propriétaire : Sciences › Physique ›
-- Thermodynamique, et le tag que la migration pose pour chaque compétence.
DO $$
DECLARE v_uid UUID := (SELECT uid FROM t_compte);
BEGIN
  INSERT INTO public.domaines (user_id, id, nom, prefixe) VALUES
    (v_uid, 'sciences', 'Sciences', 'SCI'),
    (v_uid, 'physique', 'Physique', 'PHY'),
    (v_uid, 'thermo', 'Thermodynamique', 'THE');
  INSERT INTO public.referentiel_codes_emis (user_id, code, domaine_id) VALUES
    (v_uid, 'THE-01', 'thermo'), (v_uid, 'PHY-01', 'physique');
  INSERT INTO public.competences (user_id, code, domaine, intitule) VALUES
    (v_uid, 'THE-01', 'thermo', 'Calculer un transfert de chaleur'),
    (v_uid, 'PHY-01', 'physique', 'Décomposer un système de forces');
  INSERT INTO public.competence_domaines (user_id, code, domaine)
  SELECT c.user_id, c.code, c.domaine FROM public.competences c WHERE c.user_id = v_uid;
END;
$$;

-- À partir d'ici, le script est un compte ordinaire. Sans ce changement de
-- rôle, RLS serait contournée par le propriétaire et l'assertion 7 passerait
-- pour une raison fausse.
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_uid UUID := (SELECT uid FROM t_compte);
  v_erreur TEXT;
  v_resultat JSONB;
  v_avant JSONB;
  v_n INTEGER;
BEGIN
  -- ----------------------------------------------------------------
  -- 1. Un déplacement écrit le parent, incrémente la version, journalise.
  -- ----------------------------------------------------------------
  v_resultat := public.deplacer_domaine(
    'req-deplacement-1', 1, 'utilisateur', 'Physique sous Sciences', 'physique', 'sciences');
  ASSERT v_resultat ->> 'parentApres' = 'sciences', 'le parent devrait être écrit';
  ASSERT (v_resultat ->> 'version')::INT = 2, 'la version devrait être incrémentée';
  ASSERT (SELECT parent_id FROM public.domaines WHERE user_id = v_uid AND id = 'physique') = 'sciences',
    'la colonne parent_id devrait porter le parent';
  ASSERT (SELECT count(*) FROM public.referentiel_changes
          WHERE user_id = v_uid AND type = 'deplacer_domaine') = 1,
    'le journal devrait porter une entrée par mutation';

  PERFORM public.deplacer_domaine(
    'req-deplacement-2', 2, 'utilisateur', 'Thermo sous Physique', 'thermo', 'physique');

  -- ----------------------------------------------------------------
  -- 2. Les cycles sont refusés — celui de longueur 1, et les autres.
  -- ----------------------------------------------------------------
  BEGIN
    PERFORM public.deplacer_domaine(
      'req-cycle-soi', NULL, 'utilisateur', 'Cycle sur soi', 'physique', 'physique');
    RAISE EXCEPTION 'ÉCHEC : un domaine a pu devenir son propre parent.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%propre parent%', 'message inattendu : ' || v_erreur;
  END;

  BEGIN
    -- Sciences sous Thermodynamique fermerait la boucle : Thermo en descend.
    PERFORM public.deplacer_domaine(
      'req-cycle-long', NULL, 'utilisateur', 'Cycle long', 'sciences', 'thermo');
    RAISE EXCEPTION 'ÉCHEC : une parenté circulaire a été acceptée.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%circulaire%', 'message inattendu : ' || v_erreur;
  END;

  BEGIN
    PERFORM public.deplacer_domaine(
      'req-parent-inconnu', NULL, 'utilisateur', 'Parent inconnu', 'physique', 'nexiste-pas');
    RAISE EXCEPTION 'ÉCHEC : un parent inconnu a été accepté.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%parent inconnu%', 'message inattendu : ' || v_erreur;
  END;

  -- Un refus n'écrit rien : ni parent, ni version, ni journal.
  ASSERT (SELECT parent_id FROM public.domaines WHERE user_id = v_uid AND id = 'sciences') IS NULL,
    'un cycle refusé ne doit laisser aucune écriture';
  ASSERT (SELECT count(*) FROM public.referentiel_changes
          WHERE user_id = v_uid AND type = 'deplacer_domaine') = 2,
    'un refus ne doit pas journaliser';

  -- ----------------------------------------------------------------
  -- 3. Le verrou optimiste refuse un écran périmé.
  -- ----------------------------------------------------------------
  BEGIN
    PERFORM public.deplacer_domaine(
      'req-version-perimee', 1, 'utilisateur', 'Écran périmé', 'physique', NULL);
    RAISE EXCEPTION 'ÉCHEC : une version périmée a été acceptée.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%a changé depuis ta lecture%', 'message inattendu : ' || v_erreur;
  END;

  -- ----------------------------------------------------------------
  -- 4. Le tag : plusieurs par compétence, le domaine de création compris.
  -- ----------------------------------------------------------------
  -- La migration a déjà posé le tag du domaine de création ; on ajoute.
  v_resultat := public.taguer_competences_domaine(
    'req-tag-1', NULL, 'utilisateur', 'THE-01 sert aussi la physique',
    'physique', ARRAY['THE-01'], true);
  ASSERT v_resultat -> 'taguees' = '["THE-01"]'::JSONB, 'le tag devrait être rendu';
  SELECT count(*) INTO v_n FROM public.competence_domaines
  WHERE user_id = v_uid AND code = 'THE-01';
  ASSERT v_n = 2, 'THE-01 devrait porter deux tags, pas ' || v_n;

  -- Taguer vers le domaine de création est désormais permis : c'est même ce
  -- que la migration écrit. ADR-081 le refusait par trigger.
  PERFORM public.taguer_competences_domaine(
    'req-tag-creation', NULL, 'utilisateur', 'Retag du domaine de création',
    'thermo', ARRAY['THE-01'], true);
  SELECT count(*) INTO v_n FROM public.competence_domaines
  WHERE user_id = v_uid AND code = 'THE-01';
  ASSERT v_n = 2, 'un tag déjà posé ne doit pas se dédoubler, trouvé ' || v_n;

  -- Retirer le dernier tag est permis : la compétence part « À classer ».
  PERFORM public.taguer_competences_domaine(
    'req-detag-1', NULL, 'utilisateur', 'Détag physique', 'physique', ARRAY['THE-01'], false);
  PERFORM public.taguer_competences_domaine(
    'req-detag-2', NULL, 'utilisateur', 'Détag thermo', 'thermo', ARRAY['THE-01'], false);
  SELECT count(*) INTO v_n FROM public.competence_domaines
  WHERE user_id = v_uid AND code = 'THE-01';
  ASSERT v_n = 0, '« À classer » doit être un état atteignable, trouvé ' || v_n || ' tags';
  ASSERT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND code = 'THE-01'),
    'une compétence sans tag reste un fait du référentiel';

  -- ----------------------------------------------------------------
  -- 5. Idempotence : le même request_id rend le même résultat, sans
  --    seconde écriture (ADR-065).
  -- ----------------------------------------------------------------
  SELECT count(*) INTO v_n FROM public.referentiel_changes WHERE user_id = v_uid;
  v_avant := public.deplacer_domaine(
    'req-deplacement-1', NULL, 'utilisateur', 'Rejoué', 'physique', 'sciences');
  ASSERT v_avant ->> 'domaineId' = 'physique', 'le résultat mémorisé devrait être rendu';
  ASSERT (SELECT count(*) FROM public.referentiel_changes WHERE user_id = v_uid) = v_n,
    'un request_id rejoué ne doit pas produire de seconde entrée';

  -- ----------------------------------------------------------------
  -- 6. Le journal reste append-only, y compris pour ces commandes.
  -- ----------------------------------------------------------------
  BEGIN
    UPDATE public.referentiel_changes SET motif = 'réécrit' WHERE user_id = v_uid;
    RAISE EXCEPTION 'ÉCHEC : le journal a accepté un UPDATE.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%append-only%', 'message inattendu : ' || v_erreur;
  END;

  -- ----------------------------------------------------------------
  -- 7. La frontière de commande tient : hors commande, aucune écriture.
  -- ----------------------------------------------------------------
  PERFORM set_config('app.referentiel_command', 'off', true);
  UPDATE public.domaines SET parent_id = NULL WHERE user_id = v_uid AND id = 'thermo';
  ASSERT (SELECT parent_id FROM public.domaines WHERE user_id = v_uid AND id = 'thermo') = 'physique',
    'un UPDATE hors commande ne doit correspondre à aucune ligne';

  RAISE NOTICE 'ADR-107 : toutes les assertions passent.';
END;
$$;

ROLLBACK;
