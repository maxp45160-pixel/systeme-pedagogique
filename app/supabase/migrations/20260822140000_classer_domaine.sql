-- ============================================================================
-- Classement d'un domaine : un chemin d'écriture, un seul
--
-- ÉTAT : EN ATTENTE D'APPLICATION au 22/08/2026.
--
-- ----------------------------------------------------------------------------
-- Le défaut que cette migration corrige
--
-- La migration `20260822120000_rattachement_carte_savoirs` a ajouté quatre
-- colonnes à `public.domaines`, et l'application les écrivait par un `UPDATE`
-- direct. Elle avait tort, et le symptôme était le pire possible : **rien ne se
-- passait, sans erreur**.
--
-- `public.domaines` ne porte pas la politique uniforme `isolation_par_compte`.
-- Elle porte `referentiel_commande_modification`, qui exige
-- `current_setting('app.referentiel_command') = 'on'` — un drapeau que seule
-- `appliquer_commande_referentiel` pose. Sans lui, l'`UPDATE` ne correspond à
-- aucune ligne : PostgREST rend un succès, zéro ligne modifiée, aucun message.
-- Le référentiel n'a qu'un chemin d'écriture, et il n'était pas emprunté.
--
-- ----------------------------------------------------------------------------
-- Pourquoi une fonction dédiée et non une commande de plus
--
-- `appliquer_commande_referentiel` gouverne ce qui touche aux codes, aux
-- compétences et aux observations : elle verrouille, versionne l'agrégat et
-- journalise. Un classement ne touche rien de tout cela — il range un domaine
-- dans un tiroir partagé. Lui faire incrémenter `version` ferait échouer, sans
-- raison, toute commande concurrente ayant lu la version d'avant.
--
-- Cette fonction est donc étroite par construction : elle n'écrit QUE les
-- quatre colonnes de classement, sur le domaine du seul compte appelant, et
-- elle lève si la ligne n'existe pas. C'est le « chemin d'écriture défini
-- avant le schéma » qu'ADR-099 exige, appliqué à la lettre.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.classer_domaine(
  p_domaine_id TEXT,
  p_noeud      TEXT,
  p_version    TEXT,
  p_origine    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.compte_actif(v_uid) THEN
    RAISE EXCEPTION 'Compte authentifie actif requis.' USING ERRCODE = '42501';
  END IF;

  -- Le detachement : les quatre colonnes repartent ensemble, comme elles sont
  -- venues. La contrainte `domaines_carte_complete` l'impose de toute façon ;
  -- on l'exprime ici pour que l'appel soit lisible.
  IF p_noeud IS NULL THEN
    UPDATE public.domaines
       SET carte_noeud = NULL,
           carte_version = NULL,
           carte_origine = NULL,
           carte_valide_le = NULL
     WHERE user_id = v_uid AND id = p_domaine_id;
  ELSE
    IF p_origine IS NULL OR p_origine NOT IN ('tuteur', 'manuel') THEN
      RAISE EXCEPTION 'Origine de classement invalide : %', coalesce(p_origine, 'NULL')
        USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(p_version, ''))) = 0 THEN
      RAISE EXCEPTION 'Version de carte obligatoire.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.domaines
       SET carte_noeud = p_noeud,
           carte_version = p_version,
           carte_origine = p_origine,
           carte_valide_le = NOW()
     WHERE user_id = v_uid AND id = p_domaine_id;
  END IF;

  -- Zéro ligne n'est pas un succès : c'est un domaine qui n'existe pas, ou qui
  -- appartient à quelqu'un d'autre. Le taire reproduirait le défaut d'origine.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Domaine introuvable : %', p_domaine_id USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.classer_domaine(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classer_domaine(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.classer_domaine(TEXT, TEXT, TEXT, TEXT) IS
  'Écrit le classement d''un domaine sur la carte des savoirs. Seul chemin d''écriture des colonnes carte_* : la politique referentiel_commande_modification interdit l''UPDATE direct. p_noeud NULL retire le classement.';
