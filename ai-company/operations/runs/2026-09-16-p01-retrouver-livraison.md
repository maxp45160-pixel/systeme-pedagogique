# P01-0003 — Livraison et transmission

Base Git : `e9c6fc76c1866a4dee876e541bda8394abc0bd60` + diff local P01-0003.
Autorisation, confrontation et critères : [mandat](2026-09-16-p01-retrouver-mandat.md).

## Ce qui change

La garde SQL P01-0002 est appliquée et relue en base, conformément à l'accord humain : [preuve distante](2026-09-16-p01-domaines-activation.md). Le frontend n'a pas été publié.

Dans le code local, le domaine explicitement déclaré prime désormais sur celui de la première compétence liée, dans Ressources et recherche. Le repli historique vers une compétence n'intervient que sans domaine déclaré. Le helper `domaineAffichageCorpus` mutualise cette règle de lecture.

`separerGroupesNommes` ne retire des autres résultats que les éléments effectivement affichés dans un groupe nommé. Les supports sans domaine reconnu, plusieurs domaines inconnus et les éléments hors corpus ne disparaissent plus. Leur ordre courant est préservé. Un domaine vide de compétences peut servir de groupe nommé. Aucun stockage, appel IA ni nouvelle politique de classement.

## Vérification et limites

Cas couverts par tests unitaires et rendu React statique : domaine explicite contre première compétence, correction puis retrait, domaine sans compétence, plusieurs inconnus mélangés à un groupe nommé, aucun groupe nommé, non-classé, projections de lecture seule, archives et ordre alphabétique. La QA indépendante a également exécuté 100 jeux mixtes : aucune perte, duplication ajoutée ni mutation d'entrée.

Les callbacks de navigation et le filtrage ont été relus ; les lecteurs serveur conservent leur isolation par compte. Ce contrôle ne constitue ni une recette interactive navigateur, ni un nouvel audit RLS distant. Les résultats exacts du contrôle global final figurent dans la fiche et `2026-09-16-p01-retrouver-verification.md`.

La recherche conserve son périmètre antérieur : titre, identifiant, type, tags. Contenu intégral, recherche sémantique, carte et relations notionnelles ne sont pas implémentés par cette tranche. Elle ne valide pas toute l'exigence P01-07, la qualité sémantique du classement ou P-01 en entier. P-02 reste ultérieur à une classification fiable.

## Reprise

L'autorisation d'application SQL a été consommée avec succès : ne pas redemander ni rejouer cette migration. La version distante 20260916183753 correspond au fichier local préparé 20260916183000 ; le corps et les permissions ont été contrôlés. Les réserves historiques « en attente » de la livraison P01-0002 décrivent son état avant cet accord.

Restent une recette utilisateur dans le navigateur et l'évaluation de pertinence sur corpus réel. Aucun essai fournisseur payant ni publication n'est autorisé par la présente mission. Les fichiers et le travail fournisseur réservés à UX-0001 sont conservés.
