-- Migration : 20260822183000_pieces_jointes_images.sql
-- Description : photos de cahier — pièces jointes image en acceptation
--               passive (chantier P2, arbitrage validé : l'application
--               n'affirme rien sur l'image, elle la conserve).
--
-- 1. `document_attachments.mime_type` : le CHECK mono-valeur PDF cède la
--    place à une liste fermée de quatre types. Aucune autre contrainte ne
--    change : taille ≤ 10 Mo, PK composite (user_id, id), FK vers documents.
-- 2. Le bucket privé `document-support` élargit ses `allowed_mime_types`
--    (l'upsert SQL INSERT … ON CONFLICT DO UPDATE exige les privilèges
--    INSERT + SELECT + UPDATE sur storage.buckets ; la migration s'exécute
--    avec les droits du propriétaire, comme les autres upserts du schéma).
-- 3. Les policies storage gardent leur logique à l'identique (chemin
--    {auth.uid}/{document_id}/…, parent frontmatter->>'role'='support') ;
--    elles sont renommées *_fichiers_* pour ne plus dire « pdfs ».
--
-- Statut : APPLIQUÉE le 22/08/2026 sur le projet distant vxkjzzshlqulexydgfpc.

ALTER TABLE public.document_attachments
  DROP CONSTRAINT IF EXISTS document_attachments_mime_type_check;

ALTER TABLE public.document_attachments
  ADD CONSTRAINT document_attachments_mime_type_check
  CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-support',
  'document-support',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "document_support_pdfs_insert" ON storage.objects;
CREATE POLICY "document_support_fichiers_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
    AND EXISTS (
      SELECT 1
      FROM public.documents
      WHERE documents.user_id = (select auth.uid())
        AND documents.id = (storage.foldername(name))[2]
        AND documents.frontmatter ->> 'role' = 'support'
    )
  );

DROP POLICY IF EXISTS "document_support_pdfs_select" ON storage.objects;
CREATE POLICY "document_support_fichiers_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "document_support_pdfs_delete" ON storage.objects;
CREATE POLICY "document_support_fichiers_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
