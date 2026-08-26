-- ADR-138 — L'usage d'un domaine est déclaré : module académique, progression
-- continue, ou à préciser.
--
-- ✅ APPLIQUÉE le 26/08/2026, sur validation explicite de Maxime, après
-- vérification de l'état réel de la base (dernière migration appliquée :
-- engagement_module_domaine ; 8 domaines en production). Historique Supabase :
-- `20260825221304_usage_domaine_declare`. Relevé après application :
-- contrainte `domaines_usage_complete` et fonction `declarer_usage_domaine`
-- présentes ; les 8 domaines existants portent usage_type NULL (« à
-- préciser »), sans aucun backfill.
--
-- Quatre colonnes additives et idempotentes sur `public.domaines`, plus la
-- commande transactionnelle qui les écrit. AUCUN backfill : tout domaine
-- existant naît « à préciser » (usage_type NULL) — sa nature n'est jamais
-- déduite de son nom, de son parent, de ses documents ou de ses échéances.
-- C'est la protection des données existantes : déclarer reste un geste humain.
--
-- Le domaine reste l'unique brique de classement (héritage d'ADR-137) :
-- aucune table `modules`, aucune copie de compétence, d'échéance ou de séance.
-- L'usage est un cadre déclaré (couche 1), jamais une mesure ; tout ce qui se
-- lit sur un module — échéances, documents, couverture, séances — se dérive à
-- la lecture (couche 3), comme le reste du référentiel.

-- --------------------------------------------------------------------
-- 1. Les colonnes de l'usage déclaré
-- --------------------------------------------------------------------

ALTER TABLE public.domaines ADD COLUMN IF NOT EXISTS usage_type TEXT;
ALTER TABLE public.domaines ADD COLUMN IF NOT EXISTS annee_academique TEXT;
ALTER TABLE public.domaines ADD COLUMN IF NOT EXISTS periode TEXT;
ALTER TABLE public.domaines ADD COLUMN IF NOT EXISTS module_clos_le TIMESTAMPTZ;

COMMENT ON COLUMN public.domaines.usage_type IS
  'Usage déclaré du domaine (ADR-138) : NULL = à préciser, ''continu'' = progression durable hors cours, ''module'' = cadre académique temporel. Jamais déduit du nom, du parent, des documents ou des échéances.';
COMMENT ON COLUMN public.domaines.annee_academique IS
  'Année académique déclarée du module (ADR-138), ex. « 2026-2027 ». Obligatoire quand usage_type = ''module'', interdite sinon.';
COMMENT ON COLUMN public.domaines.periode IS
  'Période déclarée facultative du module (ADR-138), ex. « S1 ». Uniquement quand usage_type = ''module''.';
COMMENT ON COLUMN public.domaines.module_clos_le IS
  'Clôture déclarée du module (ADR-138). Fait daté : l''historique, les observations et la progression restent intacts. Uniquement quand usage_type = ''module''.';

DO $$
BEGIN
  -- Tout ou rien, sur le modèle de `domaines_carte_complete` : une nature
  -- s'accompagne de ses attributs ou d'aucun. « À préciser » et « continu » ne
  -- portent rien ; « module » exige son année académique — un module sans
  -- cadre temporel déclaré serait un module deviné.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'domaines_usage_complete' AND conrelid = 'public.domaines'::regclass
  ) THEN
    ALTER TABLE public.domaines ADD CONSTRAINT domaines_usage_complete CHECK (
      (
        usage_type IS NULL
        AND annee_academique IS NULL AND periode IS NULL AND module_clos_le IS NULL
      )
      OR
      (
        usage_type = 'continu'
        AND annee_academique IS NULL AND periode IS NULL AND module_clos_le IS NULL
      )
      OR
      (
        usage_type = 'module'
        AND annee_academique IS NOT NULL AND btrim(annee_academique) <> ''
      )
    );
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 2. Déclarer — la commande d'ADR-065 pour l'usage d'un domaine
-- --------------------------------------------------------------------
--
-- Elle ne rejoint pas `appliquer_commande_referentiel`, pour la raison déjà
-- retenue par ADR-081 puis ADR-107 : cette fonction déclare ses types dans un
-- bloc unique de plus de 13 Ko, et l'étendre ferait porter à un ajout
-- périphérique le risque de réécrire tout le chemin d'écriture du référentiel.
-- Les garanties d'ADR-065 sont reprises telles quelles : idempotence par
-- `request_id`, version optimiste (`40001`), journal append-only, drapeau de
-- commande, `SECURITY INVOKER`.
--
-- Déclarer un usage ne touche AUCUNE compétence, AUCUNE observation, AUCUNE
-- échéance, AUCUN score : seul le cadre déclaré change, et les vues qui en
-- dépendent se recalculent à la lecture.
CREATE OR REPLACE FUNCTION public.declarer_usage_domaine(
  p_request_id text,
  p_expected_version integer,
  p_origine text,
  p_motif text,
  p_domaine_id text,
  p_usage_type text,
  p_annee_academique text,
  p_periode text
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
  v_usage_avant JSONB;
  v_resultat JSONB;
  v_annee TEXT := nullif(btrim(coalesce(p_annee_academique, '')), '');
  v_periode TEXT := nullif(btrim(coalesce(p_periode, '')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire.'; END IF;
  IF p_origine NOT IN ('utilisateur', 'tuteur', 'migration', 'manuel') THEN RAISE EXCEPTION 'Origine inconnue : %', p_origine; END IF;
  IF length(btrim(coalesce(p_motif, ''))) = 0 THEN RAISE EXCEPTION 'Le motif est obligatoire.'; END IF;
  IF p_usage_type IS NOT NULL AND p_usage_type NOT IN ('continu', 'module') THEN
    RAISE EXCEPTION 'Usage inconnu : %', p_usage_type;
  END IF;

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

  -- Cohérence déclarée, miroir de `domaines_usage_complete` : refus bruyant
  -- avant toute écriture, jamais de correction silencieuse.
  IF p_usage_type IS DISTINCT FROM 'module' AND (v_annee IS NOT NULL OR v_periode IS NOT NULL) THEN
    RAISE EXCEPTION 'Une année ou une période ne se déclare que pour un module.';
  END IF;
  IF p_usage_type = 'module' AND v_annee IS NULL THEN
    RAISE EXCEPTION 'Un module académique exige son année académique déclarée.';
  END IF;

  SELECT to_jsonb(d) - 'user_id' INTO v_usage_avant
  FROM public.domaines d WHERE d.user_id = v_uid AND d.id = p_domaine_id;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);

  UPDATE public.domaines SET
    usage_type = p_usage_type,
    annee_academique = CASE WHEN p_usage_type = 'module' THEN v_annee ELSE NULL END,
    periode = CASE WHEN p_usage_type = 'module' THEN v_periode ELSE NULL END,
    -- La clôture reste attachée au cadre module : redevenir « continu » ou « à
    -- préciser » l'efface ; redéclarer « module » la conserve. Aucun geste de
    -- clôture n'expose ce champ avant ADR-138, lot « parcourir ».
    module_clos_le = CASE WHEN p_usage_type = 'module' THEN module_clos_le ELSE NULL END,
    version = version + 1
  WHERE user_id = v_uid AND id = p_domaine_id
  RETURNING version INTO v_version_apres;

  v_resultat := jsonb_build_object(
    'domaineId', p_domaine_id,
    'version', v_version_apres,
    'usageAvant', jsonb_build_object(
      'type', v_usage_avant ->> 'usage_type',
      'anneeAcademique', v_usage_avant ->> 'annee_academique',
      'periode', v_usage_avant ->> 'periode'
    ),
    'usageApres', jsonb_build_object(
      'type', p_usage_type,
      'anneeAcademique', CASE WHEN p_usage_type = 'module' THEN to_jsonb(v_annee) ELSE 'null'::JSONB END,
      'periode', CASE WHEN p_usage_type = 'module' THEN to_jsonb(v_periode) ELSE 'null'::JSONB END
    )
  );

  INSERT INTO public.referentiel_changes (user_id, request_id, domaine_id, type, version_avant, version_apres, origine, motif, diff)
  VALUES (
    v_uid, p_request_id, p_domaine_id, 'declarer_usage',
    v_version_avant, v_version_apres, p_origine, btrim(p_motif),
    jsonb_build_object('resultat', v_resultat)
  );

  RETURN v_resultat;
END;
$$;

REVOKE ALL ON FUNCTION public.declarer_usage_domaine(text, integer, text, text, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.declarer_usage_domaine(text, integer, text, text, text, text, text, text) TO authenticated;
