-- ADR-108, complément — le genre `rattachement`.
--
-- ## Le trou qu'il bouche
--
-- Une scission incomplète était irrattrapable. Le sous-domaine créé, la
-- scission n'est plus reproposable — et c'est correct, elle a eu lieu. Mais
-- rien ne permettait d'y rattacher les compétences oubliées :
--
--   - `rangement` est déterministe et exige des observations venant
--     d'exercices de ce domaine ; une compétence peu travaillée n'y entre
--     jamais ;
--   - `proposer_tags_competence` (ADR-107) couvre le cas, mais par fiche et
--     sur clic — exactement le geste que la relecture existe pour éviter.
--
-- Constaté au premier usage réel, le 24/08/2026 : après la création de
-- « Gestion des stocks », deux compétences de stock sont restées dans le
-- parent, sans aucun chemin automatique pour les y rattacher.
--
-- ## Ce qu'il autorise, et ce qu'il n'autorise pas
--
-- Le tuteur DÉSIGNE une compétence existante et un domaine existant — les deux
-- par `enum` fermé, revérifiés par `validerRelecture` (ADR-031). Il ne crée ni
-- code, ni domaine, ni compétence. L'écriture reste `taguer_competences_domaine`,
-- la commande gouvernée d'ADR-107, déclenchée par un clic.
--
-- Additive et idempotente. Dépend de `20260824090000_relecture_referentiel`.

-- La contrainte énumère les genres : un `rattachement` serait refusé sans
-- cette reprise. `DROP` puis `ADD` plutôt qu'un `ALTER` — PostgreSQL ne sait
-- pas modifier une contrainte CHECK en place, et les deux gestes tiennent dans
-- la même transaction implicite de la migration.
ALTER TABLE public.propositions_referentiel
  DROP CONSTRAINT IF EXISTS propositions_referentiel_genre_check;

ALTER TABLE public.propositions_referentiel
  ADD CONSTRAINT propositions_referentiel_genre_check
  CHECK (genre IN (
    'arete', 'dormance', 'reformulation', 'rangement',
    'scission', 'relation', 'manque', 'rattachement'));

COMMENT ON COLUMN public.propositions_referentiel.genre IS
  'Genre de proposition (ADR-108). Quatre déterministes — arete, dormance, reformulation, rangement — et quatre du tuteur — scission, relation, manque, rattachement. Vocabulaire de maintenance : aucun de ces mots n''atteint l''écran, la traduction vit dans lib/domain/propositions-lisibles.ts.';
