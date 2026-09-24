# Mesure de fidélité après P01-0014 — 24/09/2026

## Mandat

Maxime demande « refais la mesure ». Réessai explicite du même lot public C01/C02/C04/C05/C08/C10 avec Mistral, dans le plafond cumulé de 2,80 € précédemment accepté. Conservation des documents et résultats, aucun classement ni compétence accepté pendant la mesure. Code local figé P01-0014, base 11ab9ea8176303241c7ff25406f6d5faa4bcf364, vérifié par 2 806 tests.

Budget initial relu : 3 973 468 micro-euros sur le quota mensuel de 5 €, soit 1 026 532 disponibles. Coût cumulé du corpus avant cette mesure : 1 046 351 micro-euros, dont 160 000 de réservation incertaine ancienne ; reste autorisé 1 753 649. Les réservations techniques doivent également tenir dans le quota. Aucun compteur remis à zéro ; chaque appel est vérifié séquentiellement et aucun échec n'est relancé automatiquement.

## Méthode

Réimport des mêmes octets, noms datés pour conserver les sorties précédentes ; OCR refait pour PDF/images, EPUB textuel. Comparaison avec `scratch/corpus-classification-2026-09-22/retest-results.json` et la revue `retest-qa.md`. Même première tranche et même fournisseur. Le jugement d'agent doit distinguer erreurs, omissions et défauts non évaluables ; il ne remplace pas une référence humaine et ne certifie pas les seuils.

## Exécution

Six cas exécutés par l'interface locale authentifiée, sans changement de code pendant la campagne : **cinq analyses terminées et un refus technique avant appel fournisseur**. Aucun classement ni compétence accepté. La version qualité v4 est également présente dans les modules compilés du serveur local `app/.next/dev/server/chunks/`.

| Cas | Périmètre identique au précédent | Propositions avant → après | Coût nouveau | Résultat |
| --- | --- | ---: | ---: | --- |
| C01 PDF | 4/4 pages | 15 → 14 | 0,106691 € | Transfert des paires amélioré ; mot tronqué et omissions fines persistants |
| C02 PDF | 6/6 pages | 9 → 13 | 0,129801 € | Intersection corrigée ; seuil minimal mal nommé, demandes secondaires oubliées |
| C04 PDF | 20/82 pages | 13 → 17 | 0,278176 € | MCMC mieux distingué ; cinq gestes toujours non étayés sur les pages reçues |
| C05 EPUB | Sections 2, 3, 4, 5, 7, 15 sur 54 | 12 → non évaluable | 0 € | Requête trop dense, refusée avant appel |
| C08 image imprimée | 1/1 page | 4 → 4 | 0,037790 € | Publication : geste mieux aligné avec la consigne |
| C10 image avec manuscrit | 1/1 page | 2 → 0 | 0,025388 € | Synthèse inventée supprimée, mais recopie correcte également perdue |

Coût de cette campagne : **0,577846 €**. Cumul du corpus : **1,624197 € sur les 2,80 € autorisés**, dont la réservation incertaine ancienne de 0,16 €. Compteur mensuel après campagne : **4,551314 € sur 5 €**, reste 0,448686 €. Montants issus du registre Twiny, pas d'une facture fournisseur vérifiée. Aucun nouvel appel après le refus C05.

## Mesure de fidélité

La revue indépendante d'agent porte sur les cinq sorties comparables : **43 propositions avant, 48 après**. L'EPUB en échec est exclu de cette comparaison ; compter ses douze anciennes propositions comme des erreurs corrigées serait faux. Les textes reçus sont strictement identiques avant/après pour les cinq analyses terminées. Les **88 citations des 48 compétences** sont présentes aux repères annoncés : cela confirme leur provenance textuelle, pas leur pertinence.

Au moins **5/48 propositions (10,4 %) présentent encore un geste non étayé** selon la relecture QA conservatrice, toutes dans C04 : utiliser brms, réaliser une régression linéaire, modéliser des modèles généralisés et évaluer des modèles sont déduits de titres/annonces ; « simplifier intégration Monte Carlo » substitue un geste au calcul par simulation. Ce n'est pas un taux d'erreur humain validé, ni un inventaire exhaustif des erreurs.

Avec le même décompte conservateur sur les cinq anciennes sorties, **9/43 (20,9 %) → 5/48 (10,4 %)** : sept anciens gestes C04 (implémenter MCMC, convergence, brms, régression linéaire, GLMM, comparaison de modèles, simplification d'intégrale), l'intersection C02 et la synthèse C10. Les cas discutables, tels que la publication C08 et le seuil C02, restent exclus de ce compteur avant comme après. Les mots tronqués passent de **3 à 1**. Il s'agit d'un progrès descriptif sur les sorties, pas d'une estimation causale ou d'un gain humain démontré ; l'abstention totale C10 contribue à la baisse sans préserver toute sa couverture.

D'autres défauts sont comptés séparément pour ne pas confondre leurs causes : un mot tronqué dans C01 ; deux sélections de citations faibles dans C04 pour des gestes réellement enseignés ailleurs (priors et tracé) ; deux associations de compétences au domaine `logistique`, une dans C01 et une dans C04, incohérentes avec leur matière. L'intitulé de C02 sur la loi géométrique ne désigne toujours pas le nombre minimal d'achats recherché, bien que sa nouvelle justification le mentionne correctement.

Améliorations constatées :

- C01 : « bises » devient un dénombrement de paires ; permutations et suites ordonnées sont mieux dégagées du récit. Les tenues restent trop contextuelles et un nouvel intitulé se termine par « en combin ».
- C02 : l'intersection déjà donnée n'est plus traitée comme résultat demandé ; la probabilité conditionnelle correspondante est reconnue. La troncature disparaît et les permutations avec contraintes sont mieux sourcées.
- C04 : l'ancienne implémentation MCMC improprement appuyée sur du tirage direct devient une explication des algorithmes ; la normalisation numérique est séparée. Les extrapolations depuis le sommaire restent cependant présentes.
- C08 : « évaluer le risque » devient « appliquer les règles de confidentialité », plus proche du geste prescrit ; les quatre thèmes sont préservés.

La couverture ne s'améliore pas systématiquement : C10 ne propose plus aucune compétence, donc sa précision est **non évaluable (0/0)** ; la recopie pourtant demandée a disparu avec la synthèse inventée. Dans C01, la généralisation au-delà de deux enfants est moins explicite. Dans C02, le terme général des récurrences, la matrice et la contrainte de nombres consécutifs au loto ne sont pas explicitement couverts. Aucun taux d'omission n'est calculé faute de référence humaine exhaustive.

Aucune réserve produite par le filtre d'ancrage n'apparaît dans les cinq sorties réussies. Les champs temporaires n'étant pas persistés, on ne peut pas reconstituer ici leurs déclarations brutes ni attribuer chaque évolution au filtre. Une seule génération par version ne sépare pas l'effet du contrat de la variabilité du modèle.

## Régression EPUB

Le nouveau C05 conserve les mêmes six sections extraites, mais le contrôle précédant l'appel Mistral refuse la requête avec : « Ces pages sont trop denses pour une restitution unique. Choisissez une tranche plus courte. » Aucune ligne de consommation fournisseur n'est enregistrée pour cette analyse. Le succès de la version précédente ne se reproduit donc pas avec le nouveau contrat à périmètre égal. Le diagnostic local de taille est conservé dans `scratch/corpus-classification-2026-09-22/mesure-fidelite-taille.md`.

Mesure locale du constructeur, sans appel : 49 637 octets de texte et 472 passages. Avec un référentiel vide, le corps actuel atteint **99 657 octets** contre **90 320** pour le constructeur HEAD, soit +9 337 (+6 408 de schéma et +2 929 de consignes). La seule borne vide ne dépasse pas 100 000 ; elle ne reproduit donc pas à elle seule le refus réel. Un référentiel minimal de test contenant un domaine et une compétence porte le corps à **107 146 octets**. L'enum des 472 repères est recopié dans les variantes d'ancrage en plus des sources. Une déduplication simulée par référence de schéma, sans retrait de contrainte, ramène le corps vide à **93 600 octets**. Le référentiel exact de l'appel n'étant pas conservé, ces valeurs sont des diagnostics locaux clairement distincts de la taille de la requête réelle refusée. Aucun correctif ni réessai ajouté pendant la mesure.

## Conclusion et suite

**Le gain est partiel et le jalon inférieur à 5 % n'est pas atteint par cette recette d'agent.** Le contrôle de la déclaration d'appui ne suffit pas : des gestes non enseignés restent proposés, des propositions correctes disparaissent et le contrat plus volumineux bloque l'EPUB. Cette campagne ne permet pas d'annoncer une amélioration globale chiffrée de la précision ou du rappel humain.

Les corrections suivantes doivent d'abord traiter la taille de requête à périmètre constant, puis la correspondance entre geste proposé et résultat effectivement enseigné/demandé, tout en contrôlant les pertes de couverture. Ces corrections ne sont pas réalisées au milieu de cette campagne. Le manuscrit doublé par son texte imprimé ne permet toujours pas d'isoler la reconnaissance manuscrite ; le dialogue de contexte personnel n'est pas évalué ici.

## Preuves conservées

Résultats complets et coûts : `scratch/corpus-classification-2026-09-22/mesure-fidelite-results.json`. Revue : `mesure-fidelite-qa.md`. Les originaux et les résultats précédents sont conservés.

| Cas | Analyse | Ressource |
| --- | --- | --- |
| C01 | `e5232a78-9d61-4c76-945a-3ed3d4843238` | `depot-395d157cbf9aeb3b5c937305d2e86eab` |
| C02 | `f38eb00f-fad6-4d69-a6d1-2cbd11243907` | `depot-55afc2883bf90b1f449b56f2501cb780` |
| C04 | `f0e7e71e-b648-4983-a5c9-cbef9dae753c` | `depot-d02cae4b100b1bb4193702d450855980` |
| C05 | `386523d3-58d4-4811-b5f1-07128574b888` | `depot-e5860a365c3c9e41dd9c8da195484179` |
| C08 | `ff6ec657-33ba-48a2-ae10-f5dd83574530` | `depot-a7185054c546307d44363918b1216a58` |
| C10 | `22081693-cd36-415a-b79b-c516b8b325c2` | `depot-5575bfb3bb4de40ff5d20879f93e2873` |
