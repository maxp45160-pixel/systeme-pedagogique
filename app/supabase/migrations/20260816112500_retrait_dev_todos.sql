-- Retrait de `dev_todos` et de son bucket public (ADR-074, constat d'audit)
--
-- ADR-063 déclarait le widget, sa route, sa table, sa fonction et son bucket
-- supprimés. Le code l'a été ; la base, non. Restaient en production :
--
--   * `public.dev_todos`, 13 lignes, avec la politique héritée d'ADR-010 :
--     `FOR ALL TO authenticated USING (true)`. Tout compte connecté lisait,
--     modifiait et supprimait les notes de tous les autres. ADR-019 laissait
--     la question explicitement ouverte ; elle se referme ici ;
--   * le bucket `dev-todos` en `public = true` : ses images étaient lisibles
--     par URL, sans compte du tout.
--
-- Aucun code ne lit plus l'un ni l'autre : la suppression est le retrait d'une
-- surface d'attaque, pas une perte de fonction.

DROP POLICY IF EXISTS "dev_todos_images_depot" ON storage.objects;
DROP POLICY IF EXISTS "dev_todos_images_retrait" ON storage.objects;

-- Le bucket passe en privé plutôt que d'être supprimé : `storage.protect_delete`
-- interdit la suppression d'objets en SQL — elle doit passer par l'API Storage.
-- Privé + aucune politique = plus personne n'y accède, ni connecté ni anonyme.
-- Sa suppression définitive (1 objet) reste à faire depuis le tableau de bord.
UPDATE storage.buckets SET public = FALSE WHERE id = 'dev-todos';

DROP TABLE IF EXISTS public.dev_todos;
