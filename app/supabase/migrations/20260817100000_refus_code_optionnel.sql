-- Un refus peut porter sur une activité seule, sans compétence.
--
-- « Passer » une action classique (exercice, note, ressource) écarte la
-- suggestion. Une activité sans code de compétence existe : une note posée
-- hors référentiel, une ressource libre. Avant, le bouton « Passer » n'était
-- même pas rendu pour elle — impossible d'écarter la suggestion, elle
-- revenait en boucle.
--
-- `code` devient nullable : un refus est désormais identifié par
-- `exercice_id` OU `code`. Les cas existants restent intacts — refus
-- d'exercice (`exercice_id` renseigné) et refus de compétence entière
-- (`exercice_id` NULL). La lecture (store/context.ts) ne change pas de sens :
-- elle distribue par `exercice_id` présent ou absent. Aucune ligne existante
-- n'est touchée : au 17/08/2026, toutes les lignes portent un `code`.
--
-- La garde « ni code ni exercice_id » reste celle du store
-- (`refuserRecommandation`), qui est le seul chemin d'écriture : la
-- validation a une seule implémentation.

ALTER TABLE public.refus_recommandations
  ALTER COLUMN code DROP NOT NULL;