-- Retrait de la carte globale Twiny (lot 3) et de la succession de compétence.
--
-- Décision du 21/08/2026, vérifiée contre la base live :
-- les six tables `carte_globale_*` et la table `competence_succession` n'ont
-- jamais reçu une seule ligne (0 ligne chacune au moment du retrait), aucun
-- chemin d'écriture applicatif ne subsiste (les actions serveur ont été
-- retirées le même jour), et aucune voie de nomination de curateur n'existe.
-- Le chemin de lecture (`store/carte-globale.ts` et l'overlay privé du lot 5)
-- est retiré dans le même commit.
--
-- Le *concept* métier reste décrit dans `docs/architecture/TWINY_MODEL.md` :
-- un retour éventuel se fera à partir du modèle cible, pas de ce schéma.

drop table if exists public.carte_globale_selections cascade;
drop table if exists public.carte_globale_correspondances cascade;
drop table if exists public.carte_globale_curateurs cascade;
drop table if exists public.carte_globale_changes cascade;
drop table if exists public.carte_globale_relations cascade;
drop table if exists public.carte_globale_elements cascade;
drop table if exists public.competence_succession cascade;

drop function if exists public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb);
drop function if exists public.refuser_mutation_carte_globale_changes();
drop function if exists public.provenance_carte_globale_valide(jsonb);
