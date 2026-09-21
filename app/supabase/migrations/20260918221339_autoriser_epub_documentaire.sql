-- P01-0011 : autoriser l'original EPUB, sans changer RLS, droits ou plafond.
-- Préparée le 19/09/2026 ; application distante à autoriser séparément.
BEGIN;
ALTER TABLE public.document_attachments
  DROP CONSTRAINT document_attachments_mime_type_check;
ALTER TABLE public.document_attachments
  ADD CONSTRAINT document_attachments_mime_type_check
  CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/epub+zip'));
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'application/epub+zip')
WHERE id = 'document-support'
  AND allowed_mime_types IS NOT NULL
  AND NOT ('application/epub+zip' = ANY(allowed_mime_types));
COMMIT;
