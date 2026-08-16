-- ============================================================================
-- Migration : Autorisation de suppression des snapshots pour la purge de compte
--
-- Permet la suppression des instantanés documentaires (document_snapshots)
-- par leur propriétaire (rôle authenticated) afin que la réinitialisation
-- et la purge totale du compte puissent vider les tables documentaires dans
-- l'ordre requis par la contrainte FK ON DELETE RESTRICT.
-- ============================================================================

GRANT DELETE ON TABLE public.document_snapshots TO authenticated;

DROP POLICY IF EXISTS "snapshots_suppression_compte" ON public.document_snapshots;
CREATE POLICY "snapshots_suppression_compte"
  ON public.document_snapshots FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
