-- ADR-143 : comme le quota du tuteur, la dépense survit au reset pédagogique.
-- Aucune note, citation ni production n'est conservée dans ce compteur.
ALTER TABLE public.document_depot_usage DROP CONSTRAINT document_depot_usage_user_id_fkey;
ALTER TABLE public.document_depot_usage ADD CONSTRAINT document_depot_usage_user_id_fkey
  FOREIGN KEY(user_id) REFERENCES public.comptes_acces(user_id) ON DELETE CASCADE;
