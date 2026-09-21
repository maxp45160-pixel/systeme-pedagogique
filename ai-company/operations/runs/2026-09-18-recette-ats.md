# Recette ATS — 18/09/2026

## Mandat

Maxime répond « vas-y fais ça ! » à la proposition : contrôler les 16 propositions
et leurs sources, lui faire retenir/corriger/écarter les propositions, puis vérifier
l'application, la conservation et la retrouvabilité du document. Analyse existante
uniquement, aucun nouvel appel payant. Aucune publication ni validation générale
du produit. Coordinateur : tâche 01a0b62a-497b-7af2-8106-3ffd62751d19.

Base : master 536340d1e4fa6bcb35858258a2e71cea009169ed, propre au démarrage.
Le coordinateur possède ce rapport et P01-0009 ; QA travaille en lecture seule.

## Point de reprise

**Recadrage ultérieur de Maxime :** « le livret ATS c un test, on s'en fout.
Faut traiter le générique pas le spécifique. C quoi la suite ». La demande de
sélection des compétences ATS est retirée ; P01-0009 est annulée à ce stade,
sans application. Les observations ci-dessous restent des preuves de test,
pas une liste de compétences à faire accepter. La suite demandée est une
recommandation sur le traitement documentaire générique.

L'interface locale retrouve le livret ATS, ses 13 pages et 16 propositions.
Mathématiques est conservé comme choix à confirmer. Les 16 propositions sont
précochées ; aucune action d'application n'a été effectuée dans cette mission.
Les sources des 16 propositions ont été dépliées et relues dans l'interface.
Une question de choix est présentée à Maxime avant application.

## Contrôle des propositions

| Proposition | Page PDF | Témoin affiché | Avis QA |
| --- | --- | --- | --- |
| Simplifier fractions | 2 | Fraction irréductible ; produit 4/3 × 7/5 | Retenable |
| Calculer puissances | 3 | Puissance de 10 ; produit de puissances | Retenable |
| Développer expressions algébriques | 4 | Développer, réduire et ordonner ; expression distributive | Retenable |
| Factoriser expressions algébriques | 4 | Exercice 2 ; facteur commun 8x−3 | Retenable |
| Appliquer identités remarquables | 5 | Développement explicitement demandé par identité remarquable | Retenable |
| Simplifier racines carrées | 6 | Écrire sous forme a√b ; √20 | Retenable |
| Résoudre équations | 7 | 3x+2=0 | Retenable |
| Résoudre inéquations | 8 | 5x−3 > 7x−95 | Retenable |
| Calculer dérivées | 9 | Expression de f′ ; f(x)=x⁴+x² | Retenable |
| Évaluer valeurs trigonométriques | 10 | Valeur exacte de cos(3π/4) | Retenable |
| Simplifier expressions exponentielles | 11 | Résultat sous forme eᵃ ; produit d'exponentielles | Retenable |
| Résoudre équations exponentielles | 11 | eˣ=e³ | Retenable pour les équations seulement |
| Calculer logarithmes | 12 | ln16 en fonction de ln2 et ln3 | Retenable |
| Résoudre équations logarithmiques | 12 | ln x=−1 | Retenable pour les équations seulement |
| Calculer coordonnées de vecteurs | 13 | Coordonnées de u/v données ; calcul de 2u | Retenable pour coordonnées, pas normes |
| Décrire propriétés des vecteurs | 13 | Égalité des coordonnées et calcul de coordonnées des points M/E | À écarter : geste annoncé non étayé |

Avis indépendant du sous-agent QA : accord sur cette sélection proposée.
Les témoins sont les citations affichées de l'analyse conservée ; leur lecture
ne constitue pas une nouvelle comparaison exhaustive avec le PDF original.
La provenance textuelle n'atteste pas une extraction exhaustive ni l'atomicité
de tous les intitulés. Aucune mesure de compétence n'est produite.

## Limite de l'interface

Le domaine se modifie ; les propositions de compétences peuvent seulement être
cochées/décochées dans cette fenêtre. Aucun champ ne permet de corriger leur
intitulé avant création. Écarter la proposition 16 est donc l'action proposée.

## Vérifications

Le contrôle initial `npm run agents:check` passe (avertissements historiques
de fraîcheur conservés). QA a exécuté les contrôles suivants le 18/09, sur
536340d et les seuls ajouts documentaires de cette mission :

- 22:21:39 Europe/Paris, 49 tests / 4 fichiers passent :
  `npm run test --workspace=app -- src/components/tuteur/modale-ressources.test.ts src/lib/store/classement-ressources-actions.test.ts src/lib/store/brouillon-classement-actions.test.ts src/lib/documents/classement-atelier.test.ts`
- 22:22:18 Europe/Paris, 31 tests / 3 fichiers passent :
  `npm run test --workspace=app -- src/components/atelier/retrouver-ressources.test.ts src/lib/documents/corpus-groupe.test.ts src/lib/documents/corpus-groupe.proprietes.test.ts`

Ces 80 tests utilisent des simulations ; ils ne prouvent pas la persistance distante.
Le lien visible vers Mes cours ouvre bien le document ATS avant application.
Dans Ressources, le livret figure une seule fois sous À trier, sans domaine
effectivement rattaché. La recherche du titre donne exactement un résultat.
Les choix humains, leur application et le contrôle après application restent à faire.
