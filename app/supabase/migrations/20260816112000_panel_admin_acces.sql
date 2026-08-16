-- Panel admin : rôle applicatif et suspension d'accès (ADR-074)
--
-- Le produit n'avait aucune notion de rôle : sept comptes, tous égaux, chacun
-- isolé par `user_id`. Rien ne permettait de savoir qui existe, ni de couper
-- l'accès à quelqu'un — la seule action possible était de supprimer le compte
-- dans le tableau de bord Supabase, ce qui emporte ses preuves avec lui.
--
-- Deux notions, une seule table : `role` dit ce qu'un compte peut administrer,
-- `suspendu_le` dit s'il peut encore entrer. Les séparer aurait produit deux
-- tables jointes systématiquement.
--
-- La suspension est portée par **RLS**, pas par l'interface : un compte
-- suspendu dont le jeton est encore valide ne lit plus une seule ligne
-- métier, quel que soit le chemin d'accès. C'est le sens de « RLS est la
-- barrière d'autorisation de confiance ».

-- --------------------------------------------------------------------
-- 1. La table
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.comptes_acces (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('membre', 'admin')),
  suspendu_le TIMESTAMPTZ,
  suspendu_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motif TEXT CHECK (motif IS NULL OR btrim(motif) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.comptes_acces IS
  'Rôle applicatif et état d''accès d''un compte. Une ligne par compte auth, créée au signup.';
COMMENT ON COLUMN public.comptes_acces.suspendu_le IS
  'Non nul = accès coupé. Les politiques RLS des tables métier lisent cet état via public.compte_actif().';

-- Les comptes déjà créés n'ont pas déclenché le trigger ci-dessous.
INSERT INTO public.comptes_acces (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- --------------------------------------------------------------------
-- 2. Une ligne d'accès naît avec le compte
--
-- Trigger distinct de `handle_new_user` plutôt qu'ajout dans son corps : les
-- deux écrivent dans des tables différentes, et un échec d'insertion du profil
-- ne doit pas laisser un compte sans ligne d'accès — ni l'inverse.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user_acces()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.comptes_acces (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_acces() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_acces ON auth.users;
CREATE TRIGGER on_auth_user_created_acces
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_acces();

DROP TRIGGER IF EXISTS comptes_acces_touch ON public.comptes_acces;
CREATE TRIGGER comptes_acces_touch
  BEFORE UPDATE ON public.comptes_acces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- --------------------------------------------------------------------
-- 3. Les deux prédicats
--
-- `SECURITY DEFINER` : appelées depuis les politiques de `comptes_acces`
-- elle-même, des fonctions soumises à RLS produiraient une récursion infinie.
-- `search_path` figé, exécution retirée à `anon` : ces fonctions ne répondent
-- qu'à un porteur de jeton.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.est_admin(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comptes_acces a
    WHERE a.user_id = p_uid AND a.role = 'admin' AND a.suspendu_le IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.compte_actif(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comptes_acces a
    WHERE a.user_id = p_uid AND a.suspendu_le IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.est_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.compte_actif(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compte_actif(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 4. Ce qu'un admin ne peut pas faire
--
-- Deux verrous, en base et non dans l'interface : se couper soi-même l'accès
-- par mégarde, et retirer le dernier administrateur — après quoi plus personne
-- ne peut rendre le rôle, et il faut repasser par SQL.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.garde_comptes_acces()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_autres_admins INTEGER;
BEGIN
  IF OLD.user_id = auth.uid()
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR (NEW.suspendu_le IS NOT NULL AND OLD.suspendu_le IS NULL)) THEN
    RAISE EXCEPTION 'Un administrateur ne peut pas modifier son propre accès.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.role = 'admin' AND OLD.suspendu_le IS NULL
     AND (NEW.role <> 'admin' OR NEW.suspendu_le IS NOT NULL) THEN
    SELECT COUNT(*) INTO v_autres_admins
    FROM public.comptes_acces
    WHERE role = 'admin' AND suspendu_le IS NULL AND user_id <> OLD.user_id;

    IF v_autres_admins = 0 THEN
      RAISE EXCEPTION 'Le dernier administrateur ne peut pas être retiré.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comptes_acces_garde ON public.comptes_acces;
CREATE TRIGGER comptes_acces_garde
  BEFORE UPDATE ON public.comptes_acces
  FOR EACH ROW EXECUTE FUNCTION public.garde_comptes_acces();

-- --------------------------------------------------------------------
-- 5. RLS de la table d'accès
--
-- Lecture : son propre accès — un compte suspendu doit pouvoir lire pourquoi —
-- ou tous, si l'on est admin. Écriture : admin seulement, et uniquement en
-- UPDATE. La création vient du trigger, la suppression de la cascade sur
-- `auth.users` : aucun client n'a de raison de faire l'une ou l'autre.
-- --------------------------------------------------------------------

ALTER TABLE public.comptes_acces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acces_lecture_soi_ou_admin" ON public.comptes_acces;
CREATE POLICY "acces_lecture_soi_ou_admin" ON public.comptes_acces
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.est_admin());

DROP POLICY IF EXISTS "acces_commande_admin" ON public.comptes_acces;
CREATE POLICY "acces_commande_admin" ON public.comptes_acces
  FOR UPDATE TO authenticated
  USING (public.est_admin())
  WITH CHECK (public.est_admin());

REVOKE ALL ON TABLE public.comptes_acces FROM anon;
GRANT SELECT, UPDATE ON TABLE public.comptes_acces TO authenticated;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.comptes_acces FROM authenticated;

-- --------------------------------------------------------------------
-- 6. Un admin lit l'identité des comptes — rien de leur travail
--
-- `profiles` seulement : nom, courriel, plan, dates. Les preuves, les
-- exercices, les documents et les séances restent hors d'atteinte, y compris
-- pour un administrateur (P8 : les données personnelles ne sont jamais
-- partagées sans consentement explicite). Ce que le panel montre d'un compte
-- au-delà de son identité, ce sont des **compteurs**, produits par la fonction
-- du point 8 — jamais du contenu.
-- --------------------------------------------------------------------

DROP POLICY IF EXISTS "profil_admin_lecture" ON public.profiles;
CREATE POLICY "profil_admin_lecture" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.est_admin());

-- --------------------------------------------------------------------
-- 7. La suspension entre dans les politiques métier
--
-- Les politiques existantes sont réécrites, pas remplacées : chacune est
-- relue depuis `pg_policies` et recréée à l'identique, avec
-- `AND public.compte_actif()` ajouté à ses deux clauses. Réécrire à la main
-- vingt politiques serait vingt occasions d'en changer une par accident.
--
-- Idempotent : une politique qui mentionne déjà `compte_actif` est sautée.
-- --------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  v_using TEXT;
  v_check TEXT;
  v_sql TEXT;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE (schemaname = 'public' AND tablename IN (
             'domaines', 'competences', 'evidence', 'exercises', 'attempts',
             'sessions', 'refus_recommandations', 'themes', 'documents',
             'document_links', 'document_snapshots', 'document_attachments',
             'referentiel_codes_emis', 'referentiel_changes'))
       OR (schemaname = 'storage' AND tablename = 'objects'
           AND policyname LIKE 'document_support_pdfs_%')
  LOOP
    CONTINUE WHEN COALESCE(r.qual, '') LIKE '%compte_actif%'
                OR COALESCE(r.with_check, '') LIKE '%compte_actif%';

    v_using := CASE WHEN r.qual IS NULL THEN NULL
                    ELSE '(' || r.qual || ') AND public.compte_actif()' END;
    v_check := CASE WHEN r.with_check IS NULL THEN NULL
                    ELSE '(' || r.with_check || ') AND public.compte_actif()' END;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    v_sql := format('CREATE POLICY %I ON %I.%I FOR %s TO authenticated',
                    r.policyname, r.schemaname, r.tablename, r.cmd);
    IF v_using IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_using || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;

    EXECUTE v_sql;
  END LOOP;
END;
$$;

-- --------------------------------------------------------------------
-- 8. Ce que le panel lit
--
-- Une fonction, pas une vue : la vue aurait dû être protégée par ses propres
-- politiques, alors que l'unique règle utile tient en une ligne — n'y répondre
-- qu'à un administrateur. Les compteurs sont calculés ici parce que RLS
-- interdit, à raison, de lire les tables d'autrui depuis le client.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_comptes()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  prenom TEXT,
  plan TEXT,
  role TEXT,
  suspendu_le TIMESTAMPTZ,
  motif TEXT,
  cree_le TIMESTAMPTZ,
  preuves BIGINT,
  exercices BIGINT,
  seances BIGINT,
  competences BIGINT,
  derniere_activite TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.est_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.user_id,
    p.email,
    p.prenom,
    p.plan,
    a.role,
    a.suspendu_le,
    a.motif,
    a.created_at,
    (SELECT COUNT(*) FROM public.evidence e WHERE e.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.exercises x WHERE x.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.sessions s WHERE s.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.competences c WHERE c.user_id = a.user_id),
    GREATEST(
      (SELECT MAX(e.created_at) FROM public.evidence e WHERE e.user_id = a.user_id),
      (SELECT MAX(t.created_at) FROM public.attempts t WHERE t.user_id = a.user_id),
      (SELECT MAX(s.created_at) FROM public.sessions s WHERE s.user_id = a.user_id)
    )
  FROM public.comptes_acces a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_comptes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_comptes() TO authenticated;
