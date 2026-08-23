-- ---------------------------------------------------------------------
-- Quota mensuel du tuteur — la clé serveur devient partageable (ADR-116)
--
-- Jusqu'ici, un compte neuf devait aller chercher une clé d'API chez un
-- tiers avant de pouvoir générer quoi que ce soit : la landing promettait
-- « gratuit, sans engagement », le premier écran demandait un compte
-- Mistral. Une clé serveur partagée règle cela — et ouvre aussitôt la
-- question qu'elle pose : sans plafond, tout compte inscrit peut vider le
-- crédit.
--
-- Trois colonnes sur `comptes_acces`, pas une table de plus. Cette table
-- porte déjà exactement les politiques qu'un compteur de quota réclame :
-- SELECT soi-ou-admin (un compte lit son solde) et UPDATE administrateur
-- seul (il ne peut pas le remettre à zéro). Une table dédiée obligerait à
-- réécrire ces deux politiques, le trigger de création à l'inscription et
-- la révocation d'INSERT/DELETE — quatre occasions de se tromper pour zéro
-- gain.
-- ---------------------------------------------------------------------

ALTER TABLE public.comptes_acces
  ADD COLUMN IF NOT EXISTS quota_mensuel INTEGER NOT NULL DEFAULT 150
    CHECK (quota_mensuel >= 0),
  ADD COLUMN IF NOT EXISTS quota_periode DATE,
  ADD COLUMN IF NOT EXISTS quota_appels INTEGER NOT NULL DEFAULT 0
    CHECK (quota_appels >= 0);

COMMENT ON COLUMN public.comptes_acces.quota_mensuel IS
  'Generations offertes par mois sur la cle serveur. Par compte : un administrateur peut en accorder plus, ou zero.';
COMMENT ON COLUMN public.comptes_acces.quota_periode IS
  'Premier jour du mois en cours de decompte. NULL tant qu''aucune generation n''a ete consommee.';
COMMENT ON COLUMN public.comptes_acces.quota_appels IS
  'Generations consommees sur quota_periode. Remis a zero par consommer_quota_tuteur au changement de mois.';

-- ---------------------------------------------------------------------
-- La consommation — SECURITY DEFINER, et SANS ARGUMENT
--
-- Le plafond se lit en base, il n'est jamais passé en paramètre. La clé
-- anon et le JWT vivent dans le navigateur : une fonction
-- `consommer_quota_tuteur(plafond INTEGER)` serait appelable depuis la
-- console avec `{ plafond: 999999 }`, et le quota ne vaudrait rien. C'est
-- la même raison qui fait que `est_admin()` lit la base plutôt que de
-- croire son appelant.
--
-- SECURITY DEFINER parce que la politique UPDATE de `comptes_acces` est
-- réservée aux administrateurs — c'est précisément ce qu'on veut garder.
-- La fonction n'écrit que `quota_periode` et `quota_appels` : jamais
-- `role`, jamais `suspendu_le`, donc le trigger `garde_comptes_acces` la
-- laisse passer sans avoir à être assoupli.
--
-- La remise à zéro mensuelle est portée par la lecture, pas par un cron :
-- une période distincte du mois courant est réinitialisée au premier appel
-- qui la constate.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consommer_quota_tuteur()
RETURNS TABLE (autorise BOOLEAN, restant INTEGER, plafond INTEGER)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_mois DATE := date_trunc('month', NOW())::DATE;
  v_ligne public.comptes_acces%ROWTYPE;
  v_consommes INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0;
    RETURN;
  END IF;

  -- Un administrateur n'est jamais décompté. Une ligne ici plutôt qu'un
  -- plafond géant posé en donnée : rien à maintenir, rien à oublier de
  -- remettre après un test.
  IF public.est_admin(v_uid) THEN
    RETURN QUERY SELECT TRUE, 2147483647, 2147483647;
    RETURN;
  END IF;

  -- `FOR UPDATE` : deux générations lancées en même temps par le même
  -- compte doivent compter deux fois. Sans le verrou, elles liraient le
  -- même `quota_appels` et n'en écriraient qu'un.
  SELECT * INTO v_ligne FROM public.comptes_acces a
    WHERE a.user_id = v_uid FOR UPDATE;

  -- Pas de ligne d'accès : le trigger d'inscription n'a pas tourné, ou le
  -- compte est antérieur à la table. `lireAccesCourant` traite ce cas comme
  -- « membre actif » ; on fait pareil, et on ouvre le quota par défaut.
  IF NOT FOUND THEN
    INSERT INTO public.comptes_acces (user_id, quota_periode, quota_appels)
      VALUES (v_uid, v_mois, 1)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_ligne FROM public.comptes_acces a WHERE a.user_id = v_uid;
    RETURN QUERY SELECT TRUE, GREATEST(v_ligne.quota_mensuel - 1, 0), v_ligne.quota_mensuel;
    RETURN;
  END IF;

  IF v_ligne.suspendu_le IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0, v_ligne.quota_mensuel;
    RETURN;
  END IF;

  v_consommes := CASE
    WHEN v_ligne.quota_periode IS DISTINCT FROM v_mois THEN 0
    ELSE v_ligne.quota_appels
  END;

  IF v_consommes >= v_ligne.quota_mensuel THEN
    RETURN QUERY SELECT FALSE, 0, v_ligne.quota_mensuel;
    RETURN;
  END IF;

  UPDATE public.comptes_acces a
    SET quota_periode = v_mois,
        quota_appels = v_consommes + 1
    WHERE a.user_id = v_uid;

  RETURN QUERY
    SELECT TRUE, v_ligne.quota_mensuel - (v_consommes + 1), v_ligne.quota_mensuel;
END;
$$;

REVOKE ALL ON FUNCTION public.consommer_quota_tuteur() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consommer_quota_tuteur() TO authenticated;

-- ---------------------------------------------------------------------
-- Le panneau d'administration doit pouvoir constater la consommation :
-- c'est de là qu'on décide d'accorder plus à un compte, ou de couper.
-- Trois colonnes de plus, aucun contenu pédagogique (P8).
--
-- `DROP` avant `CREATE OR REPLACE` : PostgreSQL refuse de remplacer une
-- fonction dont le type de retour change.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_comptes();
CREATE OR REPLACE FUNCTION public.admin_comptes()
RETURNS TABLE (
  user_id UUID, email TEXT, prenom TEXT, role TEXT,
  suspendu_le TIMESTAMPTZ, motif TEXT, cree_le TIMESTAMPTZ,
  observations BIGINT, exercices BIGINT, seances BIGINT, competences BIGINT,
  derniere_activite TIMESTAMPTZ,
  quota_mensuel INTEGER, quota_appels INTEGER, quota_periode DATE
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.est_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.user_id, p.email, p.prenom, a.role, a.suspendu_le, a.motif, a.created_at,
    (SELECT COUNT(*) FROM public.observations e WHERE e.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.exercises x WHERE x.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.sessions s WHERE s.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.competences c WHERE c.user_id = a.user_id),
    GREATEST(
      (SELECT MAX(e.created_at) FROM public.observations e WHERE e.user_id = a.user_id),
      (SELECT MAX(t.created_at) FROM public.attempts t WHERE t.user_id = a.user_id),
      (SELECT MAX(s.created_at) FROM public.sessions s WHERE s.user_id = a.user_id)),
    a.quota_mensuel,
    -- Une période périmée vaut zéro consommé : le compteur repart au
    -- premier appel du mois, l'écran ne doit pas afficher le reliquat du
    -- mois précédent comme s'il courait encore.
    CASE WHEN a.quota_periode IS DISTINCT FROM date_trunc('month', NOW())::DATE
      THEN 0 ELSE a.quota_appels END,
    a.quota_periode
  FROM public.comptes_acces a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_comptes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_comptes() TO authenticated;
