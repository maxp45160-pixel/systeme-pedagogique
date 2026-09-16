# P01-0002 — Livraison locale et transmission

Base : bb5aaa7fe0af28cc6e0b8a14ef73ffd216aca61f + diff local P01-0002.
Accord et critères : [mandat](2026-09-16-p01-domaines.md).

## Réalisation

- Gouvernance et classement humain acceptent un domaine d'organisation vide sans usage fabriqué. Module avec année et refus du domaine continu vide conservés.
- La première analyse explicite, sourcée et sans incertitude signalée peut créer un domaine nouveau puis rattacher la source. Collisions de nom, identifiant et préfixe (archives comprises) demandent un contrôle.
- La réservation documentaire protège les choix humains. Une clé stable compte/document/analyse/proposition retrouve la création dans le journal SQL ; les reprises ne relancent aucune analyse IA.
- La fenêtre propose le domaine d'organisation sans compétence obligatoire, conserve les corrections/refus et permet le retrait du lien sans suppression du domaine ni de l'original.
- Une réservation ne prouve pas une création SQL. Les erreurs relisent l'état conservé ; une création aboutissant pendant un choix humain est signalée et ne remplace pas ce choix. Les résultats partiels restent visibles à la réouverture.

Points d'entrée : `evaluerDelegationClassement`, `rattacherDomaineDelegueAction`, `annulerRattachementDelegueAction`, `rattacherApresPremiereLecture`, `RelectureRessources`, `preparerCreationDomaine`.

## Vérification et réserves

Tests ciblés de gouvernance, création humaine, délégation, reçus et rendu : passés lors de la réalisation. Revue indépendante QA : défaut de création partielle silencieuse reproduit puis corrigé ; dernier ajustement du mock de relecture vérifié (32 tests interface passent). La vérification globale finale et ses résultats exacts seront consignés dans `2026-09-16-p01-domaines-verification.md` et dans la fiche de mission.

La persistance est simulée dans les tests ; le rendu interface est testé sans parcours navigateur interactif. Aucune preuve transactionnelle PostgreSQL ni recette sémantique sur corpus réel. Création SQL et rattachement documentaire restent deux opérations distinctes ; un domaine peut subsister sans document attaché après interruption ou choix humain.

## État distant et reste à faire

Migration `20260916183000_domaines_organisation_vides.sql` préparée, non appliquée. Elle change uniquement la garde existante, vérifie sa présence exacte et préserve les permissions. Le contrat distant a été relu en lecture seule (référence dans le mandat). Ni application distante ni publication effectuées ; aucun appel fournisseur payant.

L'activation demande une autorisation distincte pour la migration distante, puis une recette adaptée. Les compétences proposées, la pertinence sémantique et le reste de P-01 ne sont pas validés par cette livraison. P01-07 et P-02 restent hors tranche. Les modifications concurrentes CONT-0001 et le périmètre fournisseur UX-0001 sont préservés.
