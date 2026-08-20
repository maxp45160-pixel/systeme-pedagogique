-- ====================================================================
-- Migration : Durcissement des politiques RLS (InitPlan & deduplication)
--
-- Corrige les alertes du linter de performance Supabase :
--   - 0003_auth_rls_initplan sur profiles, attempts, refus_recommandations,
--     exercises, sessions, themes, observations
--   - 0006_multiple_permissive_policies sur profiles (consolidation SELECT)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Table public.profiles
-- Remplacement de la politique ALL + SELECT par des politiques
-- distinctes par action, avec InitPlan (select auth.uid()).
-- --------------------------------------------------------------------

DROP POLICY IF EXISTS "profil_proprietaire" ON public.profiles;
DROP POLICY IF EXISTS "profil_admin_lecture" ON public.profiles;
DROP POLICY IF EXISTS "profil_lecture" ON public.profiles;
DROP POLICY IF EXISTS "profil_insertion" ON public.profiles;
DROP POLICY IF EXISTS "profil_modification" ON public.profiles;
DROP POLICY IF EXISTS "profil_suppression" ON public.profiles;

CREATE POLICY "profil_lecture" ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id OR (select public.est_admin()));

CREATE POLICY "profil_insertion" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profil_modification" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profil_suppression" ON public.profiles
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = id);

-- --------------------------------------------------------------------
-- 2. Tables metier (attempts, refus_recommandations, exercises,
--    sessions, themes, observations)
-- Optimisation InitPlan : (select auth.uid()) et (select public.compte_actif())
-- --------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'attempts', 'refus_recommandations', 'exercises', 'sessions', 'themes', 'observations'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "isolation_par_compte" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "isolation_par_compte" ON public.%I FOR ALL TO authenticated '
      || 'USING ((select auth.uid()) = user_id AND (select public.compte_actif())) '
      || 'WITH CHECK ((select auth.uid()) = user_id AND (select public.compte_actif()))',
      t
    );
  END LOOP;
END;
$$;
