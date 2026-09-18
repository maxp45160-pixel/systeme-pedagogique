# P01-0003 — Activation SQL et documents retrouvables

Source humaine, 16/09/2026, tâche 01a0ab48-a27f-7453-ac53-3b8d3407eae7 : après demande d'application de la migration préparée P01-0002, Maxime répond « oui j'autorise. Une fois que c fait, bosse la tranche 3 ».
Autorisation : appliquer cette migration distante, vérifier son effet, puis réaliser localement la troisième tranche dans la priorité classification/organisation. Aucune publication, dépense fournisseur, modification de permissions ou nouvelle dépendance. Base Git propre au démarrage : e9c6fc76c1866a4dee876e541bda8394abc0bd60.

## Confrontation et tranche bornée

La lecture de P-01, PRODUCT, ADR-145 et la confrontation native en lecture seule confirment trois défauts dans la restitution existante :

1. `VueRessources` et `ResultatsRecherche` choisissent le domaine de la première compétence avant la métadonnée de domaine explicitement enregistrée.
2. La recherche exclut des autres résultats tous les éléments groupés, mais ne rend que les groupes dont le nom est connu. Les supports sans domaine reconnu disparaissent.
3. Lorsque Ressources affiche au moins un groupe nommé, seul le premier groupe sans nom est rendu ; plusieurs domaines inconnus entraînent une perte visuelle.

Plan avant code : mutualiser la résolution du domaine d'affichage dans `corpus-groupe`, appliquer le domaine déclaré en priorité, conserver le repli historique vers la première compétence seulement sans domaine déclaré ; restituer tous les éléments sans groupe nommé une seule fois ; vérifier les deux interfaces avec des fixtures mixtes. Aucun rangement ni lien persistant n'est réécrit par la consultation.

## Critères d'acceptation

- Domaine explicite A + première compétence B : affiché en A dans Ressources et recherche.
- Domaine d'organisation vide : le document est retrouvé sous ce domaine sans compétence obligatoire.
- Domaine absent ou introuvable, plusieurs groupes sans nom et un groupe nommé : chaque résultat reste visible une seule fois.
- Correction A vers B puis retrait de la métadonnée : les lectures suivent les données courantes sans écriture cachée ; le repli historique éventuel reste dérivé.
- Les éléments hors corpus/projections restent présents dans leurs résultats habituels.
- Pas d'appel IA ni mutation pour rechercher, afficher ou regrouper.

## Autorité et limites

Cette tranche restaure les contrats existants (domaine principal explicite, absence de classement ne masque pas une source). Elle contribue à P01-07 sans valider toute l'exigence. Recherche dans le contenu intégral, relations notionnelles, carte, qualité sémantique du classement et P-02 restent hors tranche. Aucun nouvel arbitrage produit important n'est pris. UX-0001 conserve analyse/fournisseurs et essais payants ; aucun chevauchement actif avec les fichiers ciblés.

Application SQL autorisée suivie dans [la preuve dédiée](2026-09-16-p01-domaines-activation.md). La livraison locale P01-0002 et ses réserves restent un historique daté.
