-- Migration: retrait du système d'objectifs structurés (lot 4 Twiny).
--
-- Décision produit : le système d'objectifs proposés ne convient pas. Les
-- objectifs structurés, les parcours stockés et leur journal d'événements sont
-- retirés. La notion de parcours est refondue en file d'attente de
-- recommandations d'actions, dérivée et non persistée (couche Décide).
--
-- Données supprimées, relevées avant retrait : 1 objectif brouillon
-- « Progresser en gestion de stock » (cible domaine-local `developpement`,
-- créé le 20/08/2026), 1 parcours brouillon rattaché, 2 événements de création.
-- Aucune Observation, tentative, séance, compétence ou document n'est touché.
--
-- Le cluster est autonome : aucune autre table ni fonction ne dépend de ces
-- trois tables. Les clés étrangères sortantes pointent vers profiles, domaines,
-- competences, sessions, carte_globale_elements et carte_globale_relations,
-- qui restent intacts.

DROP FUNCTION IF EXISTS public.executer_commande_lot4(TEXT, JSONB, JSONB, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.inscrire_evenement_lot4(UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID, UUID, TEXT, JSONB, JSONB);

DROP TABLE IF EXISTS public.evenements;
DROP TABLE IF EXISTS public.parcours;
DROP TABLE IF EXISTS public.objectifs;

-- Fonctions auxiliaires devenues orphelines après le retrait des trois tables :
-- plus aucune contrainte CHECK, aucun trigger et aucune autre fonction ne les
-- référence.
DROP FUNCTION IF EXISTS public.refuser_mutation_evenements_lot4();
DROP FUNCTION IF EXISTS public.provenance_lot4_valide(JSONB);
DROP FUNCTION IF EXISTS public.cible_lot4_valide(JSONB);
