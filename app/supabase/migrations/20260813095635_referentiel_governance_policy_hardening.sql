-- Version alignee sur l'historique distant schema_migrations le 13/08/2026.
-- Durcissement post-migration ADR-065 : index de succession et politiques
-- d'écriture séparées pour ne pas doubler la politique SELECT.

CREATE INDEX IF NOT EXISTS competences_user_remplace_par_idx
  ON public.competences (user_id, remplace_par);

DROP POLICY IF EXISTS "codes_emis_commande_compte" ON public.referentiel_codes_emis;
CREATE POLICY "codes_emis_commande_compte"
  ON public.referentiel_codes_emis FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select current_setting('app.referentiel_command', true)) = 'on'
  );

DROP POLICY IF EXISTS "referentiel_changes_commande_compte" ON public.referentiel_changes;
CREATE POLICY "referentiel_changes_commande_compte"
  ON public.referentiel_changes FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select current_setting('app.referentiel_command', true)) = 'on'
  );

DROP POLICY IF EXISTS "referentiel_commande_compte" ON public.domaines;
DROP POLICY IF EXISTS "referentiel_commande_compte" ON public.competences;

CREATE POLICY "referentiel_commande_insertion" ON public.domaines
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_modification" ON public.domaines
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on')
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_suppression" ON public.domaines
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');

CREATE POLICY "referentiel_commande_insertion" ON public.competences
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_modification" ON public.competences
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on')
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_suppression" ON public.competences
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
