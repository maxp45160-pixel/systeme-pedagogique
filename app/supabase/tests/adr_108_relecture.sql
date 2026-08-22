-- Test de la migration ADR-108 (`20260824090000_relecture_referentiel.sql`),
-- à jouer SUR UNE BASE ISOLÉE. Même régime que `adr_107_hierarchie_tags.sql` :
-- ce qui est vérifié ici n'existe qu'en base — l'atomicité de la commande,
-- l'idempotence par `request_id`, le verrou optimiste (`40001`), le journal,
-- et l'immutabilité du fait proposé dans `propositions_referentiel`.
--
-- Emploi :
--   psql "$URL_BASE_ISOLEE" -v ON_ERROR_STOP=1 -f adr_108_relecture.sql
--
-- Le script se termine par un ROLLBACK : il ne laisse rien derrière lui.
-- Il suppose le schéma appliqué, migrations 20260823090000 ET 20260824090000
-- comprises.

\set ON_ERROR_STOP on

BEGIN;

-- ------------------------------------------------------------------
-- Un compte de test, et l'usurpation d'identité qui va avec.
-- ------------------------------------------------------------------

CREATE TEMP TABLE t_compte AS SELECT gen_random_uuid() AS uid;

DO $$
DECLARE v_uid UUID := (SELECT uid FROM t_compte);
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'adr108@test.invalid')
  ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
END;
$$;

-- Référentiel de départ : LOG (parent), deux compétences taguées dessus,
-- une troisième taguée ailleurs (elle sera AJOUTÉE à la scission, pas
-- transférée).
DO $$
DECLARE v_uid UUID := (SELECT uid FROM t_compte);
BEGIN
  INSERT INTO public.domaines (user_id, id, nom, prefixe) VALUES
    (v_uid, 'log', 'Logistique', 'LOG'),
    (v_uid, 'sta', 'Statistiques', 'STA');
  INSERT INTO public.referentiel_codes_emis (user_id, code, domaine_id) VALUES
    (v_uid, 'LOG-01', 'log'), (v_uid, 'LOG-02', 'log'), (v_uid, 'STA-01', 'sta');
  INSERT INTO public.competences (user_id, code, domaine, intitule) VALUES
    (v_uid, 'LOG-01', 'log', 'Poser un tableau kanban'),
    (v_uid, 'LOG-02', 'log', 'Dimensionner un supermarché de pièces'),
    (v_uid, 'STA-01', 'sta', 'Lire un tableau de données');
  INSERT INTO public.competence_domaines (user_id, code, domaine)
  SELECT c.user_id, c.code, c.domaine FROM public.competences c WHERE c.user_id = v_uid;
END;
$$;

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
  -- 1. Une scission complète : domaine créé, rattaché, tags transférés.
  -- ----------------------------------------------------------------
  v_resultat := public.scinder_domaine(
    'req-scission-1', 1, 'utilisateur',
    'Le pilotage visuel forme un sujet à part',
    'log', 'kanban', 'Gestion kanban', 'KAN',
    'Cartes, flux tirés et WIP.',
    ARRAY['LOG-01', 'STA-01']);

  ASSERT v_resultat ->> 'sousDomaineId' = 'kanban', 'le sous-domaine devrait être créé';
  ASSERT v_resultat ->> 'prefixe' = 'KAN', 'le préfixe devrait être rendu en majuscules';
  ASSERT (v_resultat ->> 'version')::INT = 2, 'la version du parent devrait bouger';
  ASSERT v_resultat -> 'transferees' = '["LOG-01"]'::JSONB,
    'LOG-01 était tagué sur log : il devrait être TRANSFÉRÉ';
  ASSERT v_resultat -> 'ajoutees' = '["STA-01"]'::JSONB,
    'STA-01 n''était pas tagué sur log : elle devrait être AJOUTÉE';

  ASSERT (SELECT parent_id FROM public.domaines
          WHERE user_id = v_uid AND id = 'kanban') = 'log',
    'le sous-domaine devrait porter son parent';
  ASSERT (SELECT count(*) FROM public.competence_domaines
          WHERE user_id = v_uid AND code = 'LOG-01' AND domaine = 'kanban') = 1,
    'LOG-01 devrait porter le tag de kanban';
  ASSERT NOT EXISTS (SELECT 1 FROM public.competence_domaines
          WHERE user_id = v_uid AND code = 'LOG-01' AND domaine = 'log'),
    'l''ancien tag devrait partir avec le transfert';
  ASSERT (SELECT count(*) FROM public.referentiel_changes
          WHERE user_id = v_uid AND type = 'scinder_domaine') = 1,
    'la mutation devrait apparaître au journal';

  -- ----------------------------------------------------------------
  -- 2. Une scission ne change AUCUNE mesure.
  --
  -- La compétence n'est ni créée, ni recodée, ni déplacée ; aucune
  -- observation n'est écrite ; la colonne `domaine`, namespace de création,
  -- reste intacte. C'est ce qui rend la scission sans effet sur les scores.
  -- ----------------------------------------------------------------
  ASSERT (SELECT count(*) FROM public.competences WHERE user_id = v_uid) = 3,
    'une scission ne doit créer aucune compétence';
  ASSERT (SELECT domaine FROM public.competences
          WHERE user_id = v_uid AND code = 'LOG-01') = 'log',
    'competences.domaine est le namespace de création : il ne bouge pas';
  ASSERT (SELECT count(*) FROM public.observations WHERE user_id = v_uid) = 0,
    'une scission ne doit produire aucune observation';

  -- ----------------------------------------------------------------
  -- 3. Tout ou rien : un code inconnu refuse TOUTE la commande.
  -- ----------------------------------------------------------------
  BEGIN
    PERFORM public.scinder_domaine(
      'req-scission-invalide', NULL, 'utilisateur', 'Motif',
      'log', 'flux', 'Flux tirés', 'FLU', '', ARRAY['LOG-02', 'INCONNU-99']);
    RAISE EXCEPTION 'ÉCHEC : un code inconnu a été accepté.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%inconnue ou archivée%', 'message inattendu : ' || v_erreur;
  END;

  SELECT count(*) INTO v_n FROM public.domaines WHERE user_id = v_uid AND id = 'flux';
  ASSERT v_n = 0, 'un échec ne doit laisser aucun sous-domaine derrière lui';

  -- Un sous-domaine vide n'est pas une scission : c'est une branche créée
  -- pour classer, exactement ce que le test de réfutation d'ADR-107 surveille.
  BEGIN
    PERFORM public.scinder_domaine(
      'req-scission-vide', NULL, 'utilisateur', 'Motif',
      'log', 'vide', 'Vide', 'VID', '', ARRAY[]::TEXT[]);
    RAISE EXCEPTION 'ÉCHEC : une scission sans compétence a été acceptée.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%au moins une compétence%', 'message inattendu : ' || v_erreur;
  END;

  -- ----------------------------------------------------------------
  -- 4. Les collisions sont refusées : identifiant existant, parent égal,
  --    préfixe déjà pris.
  -- ----------------------------------------------------------------
  BEGIN
    PERFORM public.scinder_domaine(
      'req-collision-id', NULL, 'utilisateur', 'Motif',
      'log', 'sta', 'Doublon', 'DBL', '', ARRAY['LOG-02']);
    RAISE EXCEPTION 'ÉCHEC : un identifiant existant a été accepté.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%existe déjà%', 'message inattendu : ' || v_erreur;
  END;

  BEGIN
    PERFORM public.scinder_domaine(
      'req-cycle-soi', NULL, 'utilisateur', 'Cycle sur soi',
      'log', 'log', 'Logistique bis', 'LGB', '', ARRAY['LOG-02']);
    RAISE EXCEPTION 'ÉCHEC : un domaine a pu devenir son propre parent.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%propre parent%', 'message inattendu : ' || v_erreur;
  END;

  BEGIN
    PERFORM public.scinder_domaine(
      'req-prefixe-pris', NULL, 'utilisateur', 'Motif',
      'log', 'autres', 'Autres flux', 'STA', '', ARRAY['LOG-02']);
    RAISE EXCEPTION 'ÉCHEC : un préfixe déjà pris a été accepté.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%déjà pris%', 'message inattendu : ' || v_erreur;
  END;

  -- ----------------------------------------------------------------
  -- 5. Le verrou optimiste : un écran périmé lève `40001`.
  -- ----------------------------------------------------------------
  BEGIN
    PERFORM public.scinder_domaine(
      'req-version-perimee', 1, 'utilisateur', 'Écran périmé',
      'log', 'tardif', 'Tardif', 'TAR', '', ARRAY['LOG-02']);
    RAISE EXCEPTION 'ÉCHEC : une version périmée a été acceptée.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%a changé depuis ta lecture%', 'message inattendu : ' || v_erreur;
  END;

  -- ----------------------------------------------------------------
  -- 6. Idempotence par request_id : rejouer rend le même résultat sans
  --    seconde écriture.
  -- ----------------------------------------------------------------
  SELECT count(*) INTO v_n FROM public.referentiel_changes WHERE user_id = v_uid;
  v_avant := public.scinder_domaine(
    'req-scission-1', NULL, 'utilisateur', 'Rejoué',
    'log', 'kanban', 'Gestion kanban', 'KAN', '',
    ARRAY['LOG-01', 'STA-01']);
  ASSERT v_avant ->> 'sousDomaineId' = 'kanban', 'le résultat mémorisé devrait être rendu';
  ASSERT (SELECT count(*) FROM public.referentiel_changes WHERE user_id = v_uid) = v_n,
    'un request_id rejoué ne doit pas produire de seconde entrée';

  -- ----------------------------------------------------------------
  -- 7. `propositions_referentiel` : un fait daté, un arbitrage unique.
  -- ----------------------------------------------------------------
  INSERT INTO public.propositions_referentiel
    (user_id, id, lot_id, genre, domaine_id, empreinte, versions_lues, contenu, motifs)
  VALUES (
    v_uid, 'prop-1', 'lot-1', 'scission', 'log', 'empreinte-1',
    '{"log": 1}'::JSONB,
    '{"genre":"scission","parentId":"log","nom":"Gestion kanban","description":"","codes":["LOG-01"]}'::JSONB,
    ARRAY['un motif']);

  -- L'arbitrage s'écrit une fois, avec sa date.
  UPDATE public.propositions_referentiel
  SET arbitrage = 'retenue', arbitre_le = NOW()
  WHERE user_id = v_uid AND id = 'prop-1';

  -- ... et jamais une seconde fois.
  BEGIN
    UPDATE public.propositions_referentiel
    SET arbitrage = 'refusee', arbitre_le = NOW()
    WHERE user_id = v_uid AND id = 'prop-1';
    RAISE EXCEPTION 'ÉCHEC : un arbitrage a pu être réécrit.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%déjà été arbitrée%', 'message inattendu : ' || v_erreur;
  END;

  -- Ce qui a été proposé est figé : seul l'arbitrage peut être écrit.
  BEGIN
    UPDATE public.propositions_referentiel
    SET contenu = '{"genre":"scission","parentId":"log","nom":"Autre","description":"","codes":[]}'::JSONB
    WHERE user_id = v_uid AND id = 'prop-1';
    RAISE EXCEPTION 'ÉCHEC : le contenu d''une proposition a été réécrit.';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_erreur = MESSAGE_TEXT;
    ASSERT v_erreur LIKE '%fait daté%', 'message inattendu : ' || v_erreur;
  END;

  -- Tout ou rien sur l'arbitrage : une décision sans date n'existe pas.
  BEGIN
    INSERT INTO public.propositions_referentiel
      (user_id, id, lot_id, genre, empreinte, versions_lues, contenu, motifs,
       arbitrage, arbitre_le)
    VALUES (
      v_uid, 'prop-2', 'lot-1', 'manque', 'empreinte-2', '{}'::JSONB,
      '{"genre":"manque","domaineId":"log","intitule":"A","palier":"fondamentaux","ancrage":"cité"}'::JSONB,
      ARRAY['motif'], 'retenue', NULL);
    RAISE EXCEPTION 'ÉCHEC : un arbitrage sans date a été accepté.';
  EXCEPTION WHEN check_violation THEN
    NULL; -- `propositions_arbitrage_complet` : exactement le refus attendu.
  END;

  RAISE NOTICE 'ADR-108 : toutes les assertions passent.';
END;
$$;

ROLLBACK;
