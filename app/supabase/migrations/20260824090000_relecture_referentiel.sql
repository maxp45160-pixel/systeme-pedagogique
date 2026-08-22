-- ADR-108 — Le référentiel se relit en entier, et ne se réécrit jamais tout seul.
--
-- Deux gestes, tous deux additifs et rejouables :
--
--   1. `propositions_referentiel` — le fait daté qu'une relecture a proposé
--      quelque chose, et le fait daté de son arbitrage. Aucun état dérivé n'y
--      entre : ni score, ni niveau, ni classement, ni « ce domaine est mal
--      découpé ». On y lit ce qui a été proposé le J, rien de plus ;
--   2. `scinder_domaine` — la commande transactionnelle qui crée un
--      sous-domaine, le rattache à son parent et y transfère les tags EN UN
--      SEUL APPEL. En trois commandes successives, une erreur au milieu
--      laisserait un sous-domaine vide et des compétences à moitié déplacées :
--      exactement le défaut qu'ADR-065 existe pour empêcher.
--
-- Ce qui n'est PAS écrit ici, et ne doit jamais l'être :
--
--   - la péremption d'une proposition. Elle se dérive de `versions_lues`
--     comparé aux versions courantes des domaines, à chaque lecture (couche 3) ;
--   - le taux de rétention par genre. Il se recalcule depuis les arbitrages ;
--   - la visibilité héritée. Inchangé depuis ADR-107 : un tag posé sur le
--     sous-domaine rend la compétence visible dans tous ses ancêtres par
--     dérivation, et c'est précisément ce qui fait qu'une scission ne perd rien.
--
-- Dépend de `20260823090000_domaines_hierarchiques_tags`, appliquée.

-- --------------------------------------------------------------------
-- 1. Les propositions et leurs arbitrages
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.propositions_referentiel (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id            TEXT NOT NULL,
  -- Le lot qui l'a produite. C'est l'unité que mesure le test de réfutation
  -- d'ADR-108 : « sur les trois premiers lots produits ».
  lot_id        TEXT NOT NULL,
  genre         TEXT NOT NULL CHECK (genre IN (
                  'arete', 'dormance', 'reformulation', 'rangement',
                  'scission', 'relation', 'manque')),
  -- Le domaine visé, quand la proposition en vise un. NULL sinon.
  --
  -- Volontairement SANS clé étrangère, à la différence de tout le reste du
  -- référentiel. Une proposition est un fait daté : « le J, un découpage de
  -- LOG a été proposé » reste vrai même si LOG disparaît ensuite, et une
  -- cascade détruirait en silence l'historique dont le taux de rétention est
  -- tiré. Le même raisonnement que `domaines.carte_noeud`, pour une raison
  -- différente : là c'était l'absence de table, ici c'est l'immutabilité du
  -- fait. La validité de l'identifiant se vérifie à la lecture.
  domaine_id    TEXT,
  -- Identité stable, indépendante du lot. Deux relectures qui proposent la
  -- même chose avec deux phrases différentes partagent cette empreinte : c'est
  -- ce qui permet à un refus de valoir pour les deux, et empêche le lot de se
  -- rallumer indéfiniment.
  empreinte     TEXT NOT NULL,
  -- Les versions des domaines lus à la production, `{"log": 12, "stat": 3}`.
  -- La péremption s'en DÉDUIT ; elle ne s'écrit nulle part.
  versions_lues JSONB NOT NULL DEFAULT '{}'::jsonb,
  contenu       JSONB NOT NULL,
  -- Les faits qui la motivent. Jamais un texte rédigé d'avance (P3) : sans
  -- motif, une personne ne peut pas arbitrer en connaissance de cause.
  motifs        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- L'arbitrage : un second fait daté, écrit une fois. NULL = pas encore
  -- regardée, ce qui n'est ni un succès ni un échec.
  arbitrage     TEXT CHECK (arbitrage IS NULL OR arbitrage IN ('retenue', 'refusee')),
  arbitre_le    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  -- Tout ou rien : un arbitrage sans date serait une affirmation sans source
  -- (invariant 2). Même contrainte que `domaines_carte_complete`.
  CONSTRAINT propositions_arbitrage_complet CHECK (
    (arbitrage IS NULL AND arbitre_le IS NULL)
    OR (arbitrage IS NOT NULL AND arbitre_le IS NOT NULL)
  )
);

COMMENT ON TABLE public.propositions_referentiel IS
  'Propositions de relecture du référentiel et leurs arbitrages (ADR-108). Faits datés — précédent ADR-004. Aucun état dérivé : la péremption et le taux de rétention se recalculent à la lecture.';

-- Le lot ouvert se lit en excluant les arbitrées : l''index partiel évite de
-- parcourir un historique qui ne fait que grossir.
CREATE INDEX IF NOT EXISTS propositions_referentiel_ouvertes_idx
  ON public.propositions_referentiel (user_id, created_at DESC)
  WHERE arbitrage IS NULL;

-- Le filtrage des refus se fait à la lecture, par empreinte.
CREATE INDEX IF NOT EXISTS propositions_referentiel_empreinte_idx
  ON public.propositions_referentiel (user_id, empreinte);

/*
 * Un arbitrage s'écrit UNE fois et ne se réécrit pas.
 *
 * Ce n'est pas une table de gouvernance au sens d'ADR-065 — elle n'est pas
 * append-only, puisque arbitrer EST une écriture attendue. Ce que ce trigger
 * refuse est plus étroit : réécrire ce qui a été proposé, et revenir sur un
 * arbitrage déjà posé. Sans lui, « moins d'une proposition sur deux est
 * retenue » cesserait d'être mesurable — il suffirait de repasser sur ses
 * refus pour effacer le signal que le test de réfutation cherche.
 */
CREATE OR REPLACE FUNCTION public.refuser_reecriture_proposition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.arbitrage IS NOT NULL THEN
    RAISE EXCEPTION 'Cette proposition a déjà été arbitrée le %.', OLD.arbitre_le;
  END IF;
  IF NEW.genre IS DISTINCT FROM OLD.genre
     OR NEW.contenu IS DISTINCT FROM OLD.contenu
     OR NEW.empreinte IS DISTINCT FROM OLD.empreinte
     OR NEW.versions_lues IS DISTINCT FROM OLD.versions_lues
     OR NEW.lot_id IS DISTINCT FROM OLD.lot_id
     OR NEW.motifs IS DISTINCT FROM OLD.motifs
     OR NEW.domaine_id IS DISTINCT FROM OLD.domaine_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Une proposition est un fait daté : seul son arbitrage peut être écrit.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propositions_referentiel_arbitrage_unique
  ON public.propositions_referentiel;
CREATE TRIGGER propositions_referentiel_arbitrage_unique
  BEFORE UPDATE ON public.propositions_referentiel
  FOR EACH ROW EXECUTE FUNCTION public.refuser_reecriture_proposition();

ALTER TABLE public.propositions_referentiel ENABLE ROW LEVEL SECURITY;

-- ADR-074 : chaque politique porte `compte_actif()`, en plus de l'isolation.
--
-- Pas de drapeau `app.referentiel_command` ici, et c'est délibéré : ADR-108
-- exige que la relecture tourne HORS du chemin d'écriture du référentiel.
-- Écrire une proposition ne mute aucun agrégat, ne consomme aucune version et
-- ne peut faire échouer aucune commande. Le drapeau protège les tables que la
-- commande transactionnelle possède ; celle-ci n'en est pas.
DROP POLICY IF EXISTS "propositions_lecture_compte" ON public.propositions_referentiel;
CREATE POLICY "propositions_lecture_compte" ON public.propositions_referentiel
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND (select public.compte_actif()));

DROP POLICY IF EXISTS "propositions_insertion_compte" ON public.propositions_referentiel;
CREATE POLICY "propositions_insertion_compte" ON public.propositions_referentiel
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select public.compte_actif()));

DROP POLICY IF EXISTS "propositions_arbitrage_compte" ON public.propositions_referentiel;
CREATE POLICY "propositions_arbitrage_compte" ON public.propositions_referentiel
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id AND (select public.compte_actif()))
  WITH CHECK ((select auth.uid()) = user_id AND (select public.compte_actif()));

REVOKE ALL ON TABLE public.propositions_referentiel FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.propositions_referentiel TO authenticated;
-- Une proposition ne s'efface pas : le fait qu'elle a été produite reste vrai,
-- et le taux de rétention le compte.
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.propositions_referentiel
  FROM authenticated;

-- --------------------------------------------------------------------
-- 2. Scinder — créer le sous-domaine et y transférer les tags, en une fois
-- --------------------------------------------------------------------

-- Elle ne rejoint pas `appliquer_commande_referentiel`, pour la raison déjà
-- retenue par ADR-081 puis ADR-107 : cette fonction déclare ses types dans un
-- bloc unique de plus de 13 Ko, et l'étendre ferait porter à un ajout
-- périphérique le risque de réécrire tout le chemin d'écriture du référentiel.
-- Les garanties d'ADR-065 sont reprises telles quelles : `SECURITY INVOKER`,
-- drapeau `app.referentiel_command`, verrou d'avis, idempotence par
-- `request_id`, version optimiste (`40001` sur écran périmé), entrée dans
-- `referentiel_changes`.
--
-- L'identifiant, le préfixe et le nom sont CALCULÉS PAR L'APPLICATION et
-- passés en paramètre — jamais frappés par le tuteur (ADR-026, ADR-031). Cette
-- fonction ne les invente pas non plus : elle les vérifie et refuse les
-- collisions.
--
-- Ce qu'elle ne touche pas : aucune compétence n'est créée, modifiée,
-- déplacée ni recodée ; aucune observation n'est écrite ; aucun score ne
-- bouge. Seuls des tags se déplacent d'un domaine vers son enfant, et la
-- visibilité dans le parent se recalcule par héritage.
CREATE OR REPLACE FUNCTION public.scinder_domaine(
  p_request_id text,
  p_expected_version integer,
  p_origine text,
  p_motif text,
  p_parent_id text,
  p_sous_domaine_id text,
  p_nom text,
  p_prefixe text,
  p_description text,
  p_codes text[]
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
  v_ordre INTEGER;
  v_resultat JSONB;
  v_code TEXT;
  v_transferes JSONB := '[]'::JSONB;
  v_ajoutes JSONB := '[]'::JSONB;
  v_detag INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN
    RAISE EXCEPTION 'request_id obligatoire.';
  END IF;
  IF p_origine NOT IN ('utilisateur', 'tuteur', 'migration', 'manuel') THEN
    RAISE EXCEPTION 'Origine inconnue : %', p_origine;
  END IF;
  IF length(btrim(coalesce(p_motif, ''))) = 0 THEN
    RAISE EXCEPTION 'Le motif est obligatoire.';
  END IF;
  IF length(btrim(coalesce(p_sous_domaine_id, ''))) = 0
     OR length(btrim(coalesce(p_nom, ''))) = 0
     OR length(btrim(coalesce(p_prefixe, ''))) = 0 THEN
    RAISE EXCEPTION 'Un sous-domaine a besoin d''un identifiant, d''un nom et d''un préfixe.';
  END IF;
  -- Un sous-domaine sans compétence n'est pas une scission : c'est une branche
  -- vide, exactement ce que le test de réfutation d'ADR-107 demande de
  -- surveiller (« les branches ne sont pas créées artificiellement »).
  IF coalesce(array_length(p_codes, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Une scission doit emporter au moins une compétence.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':request:' || p_request_id, 0));

  SELECT diff -> 'resultat' INTO v_resultat
  FROM public.referentiel_changes
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_resultat; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_uid::TEXT || ':' || p_parent_id, 0));

  SELECT version INTO v_version_avant FROM public.domaines
  WHERE user_id = v_uid AND id = p_parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Domaine parent inconnu : %', p_parent_id;
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_version_avant THEN
    RAISE EXCEPTION 'Le domaine a changé depuis ta lecture (version % attendue, % en base).',
      p_expected_version, v_version_avant USING ERRCODE = '40001';
  END IF;

  -- Refus des cycles. Le sous-domaine est neuf, donc un cycle est impossible
  -- par construction — mais seulement TANT QUE l'identifiant est réellement
  -- neuf. Les deux contrôles ci-dessous sont ce qui rend cette prémisse vraie
  -- plutôt que supposée, et ils sont la barrière qui compte : le contrôle
  -- côté application ne sert qu'à rendre un message avant l'aller-retour.
  IF p_sous_domaine_id = p_parent_id THEN
    RAISE EXCEPTION 'Un domaine ne peut pas être son propre parent.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.domaines
             WHERE user_id = v_uid AND id = p_sous_domaine_id) THEN
    RAISE EXCEPTION 'Le domaine « % » existe déjà : une scission crée un domaine neuf.',
      p_sous_domaine_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.domaines
             WHERE user_id = v_uid AND upper(prefixe) = upper(btrim(p_prefixe))) THEN
    RAISE EXCEPTION 'Le préfixe « % » est déjà pris : deux domaines qui le partagent produiraient des codes en collision.',
      p_prefixe;
  END IF;

  -- Toutes les compétences sont vérifiées AVANT la moindre écriture : une
  -- scission est complète ou n'a pas lieu.
  FOREACH v_code IN ARRAY p_codes LOOP
    IF NOT EXISTS (SELECT 1 FROM public.competences
                   WHERE user_id = v_uid AND code = v_code AND NOT archive) THEN
      RAISE EXCEPTION 'Compétence inconnue ou archivée : %', v_code;
    END IF;
  END LOOP;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);

  SELECT coalesce(max(ordre), -1) + 1 INTO v_ordre
  FROM public.domaines WHERE user_id = v_uid;

  INSERT INTO public.domaines (user_id, id, nom, prefixe, description, ordre, origine, parent_id)
  VALUES (v_uid, p_sous_domaine_id, btrim(p_nom), upper(btrim(p_prefixe)),
          coalesce(btrim(p_description), ''), v_ordre, p_origine, p_parent_id);

  /*
   * Le transfert.
   *
   * Poser le tag sur l'enfant SUFFIT à garder la compétence visible dans le
   * parent : la visibilité héritée se dérive (ADR-107). Retirer le tag du
   * parent n'enlève donc rien — c'est ce qui distingue une scission d'une
   * duplication, et ce qui fait qu'aucun score ne bouge.
   *
   * Une compétence qui n'était PAS taguée sur le parent est simplement
   * ajoutée : le DELETE ne trouve rien, et `v_ajoutes` le dit au journal
   * plutôt que de laisser croire à un transfert qui n'a pas eu lieu (P2).
   */
  FOREACH v_code IN ARRAY p_codes LOOP
    INSERT INTO public.competence_domaines (user_id, code, domaine)
    VALUES (v_uid, v_code, p_sous_domaine_id)
    ON CONFLICT DO NOTHING;

    DELETE FROM public.competence_domaines
    WHERE user_id = v_uid AND code = v_code AND domaine = p_parent_id;
    GET DIAGNOSTICS v_detag = ROW_COUNT;

    IF v_detag > 0 THEN
      v_transferes := v_transferes || to_jsonb(v_code);
    ELSE
      v_ajoutes := v_ajoutes || to_jsonb(v_code);
    END IF;
  END LOOP;

  UPDATE public.domaines SET version = version + 1
  WHERE user_id = v_uid AND id = p_parent_id
  RETURNING version INTO v_version_apres;

  v_resultat := jsonb_build_object(
    'parentId', p_parent_id,
    'sousDomaineId', p_sous_domaine_id,
    'nom', btrim(p_nom),
    'prefixe', upper(btrim(p_prefixe)),
    'version', v_version_apres,
    'transferees', v_transferes,
    'ajoutees', v_ajoutes
  );

  INSERT INTO public.referentiel_changes (
    user_id, request_id, domaine_id, type,
    version_avant, version_apres, origine, motif, diff)
  VALUES (
    v_uid, p_request_id, p_parent_id, 'scinder_domaine',
    v_version_avant, v_version_apres, p_origine, btrim(p_motif),
    jsonb_build_object('resultat', v_resultat));

  RETURN v_resultat;
END;
$$;

REVOKE ALL ON FUNCTION public.scinder_domaine(
  text, integer, text, text, text, text, text, text, text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.scinder_domaine(
  text, integer, text, text, text, text, text, text, text, text[]) TO authenticated;
