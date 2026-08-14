-- Pieces jointes PDF privees pour les notes support.
-- Version alignee sur l'historique distant schema_migrations le 13/08/2026.

CREATE TABLE IF NOT EXISTS public.document_attachments (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id           UUID NOT NULL DEFAULT gen_random_uuid(),
  document_id  TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  mime_type    TEXT NOT NULL DEFAULT 'application/pdf'
    CHECK (mime_type = 'application/pdf'),
  size_bytes   BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, storage_path),
  FOREIGN KEY (user_id, document_id)
    REFERENCES public.documents(user_id, id) ON DELETE CASCADE
);

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pieces_jointes_lecture_compte" ON public.document_attachments;
CREATE POLICY "pieces_jointes_lecture_compte"
  ON public.document_attachments FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "pieces_jointes_creation_note_support" ON public.document_attachments;
CREATE POLICY "pieces_jointes_creation_note_support"
  ON public.document_attachments FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.user_id = (select auth.uid())
        AND documents.id = document_attachments.document_id
        AND documents.frontmatter ->> 'role' = 'support'
    )
  );

DROP POLICY IF EXISTS "pieces_jointes_suppression_compte" ON public.document_attachments;
CREATE POLICY "pieces_jointes_suppression_compte"
  ON public.document_attachments FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('document-support', 'document-support', false, 10485760, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "document_support_pdfs_insert" ON storage.objects;
CREATE POLICY "document_support_pdfs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
    AND EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.user_id = (select auth.uid())
        AND documents.id = (storage.foldername(name))[2]
        AND documents.frontmatter ->> 'role' = 'support'
    )
  );

DROP POLICY IF EXISTS "document_support_pdfs_select" ON storage.objects;
CREATE POLICY "document_support_pdfs_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "document_support_pdfs_delete" ON storage.objects;
CREATE POLICY "document_support_pdfs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

CREATE INDEX IF NOT EXISTS document_attachments_user_document_idx
  ON public.document_attachments (user_id, document_id, created_at DESC);

REVOKE ALL ON TABLE public.document_attachments FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.document_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_attachments TO service_role;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.document_attachments FROM authenticated;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.document_attachments FROM service_role;
REVOKE MAINTAIN ON TABLE public.document_attachments FROM authenticated;
REVOKE MAINTAIN ON TABLE public.document_attachments FROM service_role;
