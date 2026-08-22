-- ============================================================================
-- Rattachement d'un domaine de compte à la carte des savoirs
--
-- ÉTAT : APPLIQUÉE le 22/08/2026 par le titulaire du dépôt.
--
-- ----------------------------------------------------------------------------
-- Pourquoi quatre colonnes et aucune table
--
-- ADR-099 a retiré six tables `carte_globale_*` vides, faute de contenu et de
-- chemin d'écriture. La leçon retenue : ne créer une structure qu'une fois
-- qu'on sait ce qu'on y écrit et qui l'écrit.
--
-- Ici, ce qu'on écrit est connu et minuscule : un domaine porte AU PLUS un
-- rattachement, vers un nœud d'une carte qui vit en constante versionnée
-- (`src/lib/domain/carte-savoirs.ts`). Une table dédiée n'ajouterait qu'une
-- jointure, une politique RLS de plus à maintenir, et une clé étrangère
-- impossible à poser — la cible n'est pas en base.
--
-- Les colonnes héritent de la politique `isolation_par_compte` de
-- `public.domaines` : aucune nouvelle surface d'autorisation.
--
-- ----------------------------------------------------------------------------
-- Ce que chaque colonne garantit
--
-- `carte_noeud`     l'identifiant du nœud, validé côté application contre
--                   l'énumération fermée `enumNoeudsCarte()`. Pas de contrainte
--                   CHECK en dur listant les nœuds : la carte évolue en dépôt,
--                   une liste figée en base divergerait au premier ajout.
-- `carte_version`   la version de carte au moment de l'arbitrage. Sans elle,
--                   un rattachement devient inintelligible dès que la carte
--                   bouge : on saurait « où », plus « selon quelle carte ».
-- `carte_origine`   ce que la personne a validé : `tuteur` (proposition
--                   réellement formulée par le tuteur) ou `manuel` (choix de la
--                   personne, liste complète ou suggestion lexicale acceptée).
--                   Jamais `lexical` : un calcul ne rattache rien, il propose
--                   (couche 3). Ce qui est écrit est toujours un fait déclaré
--                   par une personne (couche 1).
-- `carte_valide_le` quand la personne a validé. Une provenance sans date n'en
--                   est pas une (TWINY_MODEL §17).
--
-- Les quatre vont ensemble ou pas du tout : la contrainte le rend impossible
-- à moitié.
-- ============================================================================

ALTER TABLE public.domaines
  ADD COLUMN IF NOT EXISTS carte_noeud     TEXT,
  ADD COLUMN IF NOT EXISTS carte_version   TEXT,
  ADD COLUMN IF NOT EXISTS carte_origine   TEXT,
  ADD COLUMN IF NOT EXISTS carte_valide_le TIMESTAMPTZ;

-- Seule une personne rattache. `lexical` est volontairement absent : ce serait
-- un calcul enregistré, donc une valeur dérivée stockée (P1).
ALTER TABLE public.domaines
  DROP CONSTRAINT IF EXISTS domaines_carte_origine_valide;
ALTER TABLE public.domaines
  ADD CONSTRAINT domaines_carte_origine_valide
  CHECK (carte_origine IS NULL OR carte_origine IN ('tuteur', 'manuel'));

-- Tout ou rien : un rattachement sans provenance ni date serait une
-- affirmation sans source (invariant 2).
ALTER TABLE public.domaines
  DROP CONSTRAINT IF EXISTS domaines_carte_complete;
ALTER TABLE public.domaines
  ADD CONSTRAINT domaines_carte_complete
  CHECK (
    (carte_noeud IS NULL
      AND carte_version IS NULL
      AND carte_origine IS NULL
      AND carte_valide_le IS NULL)
    OR
    (carte_noeud IS NOT NULL
      AND carte_version IS NOT NULL
      AND carte_origine IS NOT NULL
      AND carte_valide_le IS NOT NULL)
  );

COMMENT ON COLUMN public.domaines.carte_noeud IS
  'Nœud de la carte des savoirs auquel ce domaine est rattaché. Fait déclaré par une personne, jamais écrit par un calcul. Validé contre enumNoeudsCarte().';
COMMENT ON COLUMN public.domaines.carte_version IS
  'Version de carte au moment de l''arbitrage (VERSION_CARTE).';
COMMENT ON COLUMN public.domaines.carte_origine IS
  'Ce que la personne a validé : tuteur (proposition du tuteur) | manuel (choix de la personne, suggestion lexicale comprise).';
COMMENT ON COLUMN public.domaines.carte_valide_le IS
  'Date de la validation humaine.';
