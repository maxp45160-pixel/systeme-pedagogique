# A — Nouvelle idée

## Entrée

Idée libre du fondateur. Une idée est une demande d'analyse, aucune autorisation
de code, migration, expérimentation payante ou changement de roadmap.

## Déroulement proportionné

1. **Product** lit son [contrat](../agents/product.md), PRODUCT et les décisions
   pertinentes. Distinguer problème, hypothèse, solution envisagée, preuve et incertitude.
2. **[Research](../agents/research.md), si utile** : formuler une question bornée lorsqu'une affirmation
   scientifique/technique conditionne la valeur. Consulter des sources primaires,
   consigner leurs limites ; ne pas lancer de recherche décorative.
3. **CTO**, si l'idée implique un changement : rechercher l'existant, les points
   de raccordement et les dépendances ; comparer ne rien faire, une solution
   minimale et l'option proposée. Donner une complexité qualitative motivée ;
   une estimation calendaire non étayée reste inconnue.
4. **QA** cherche contre-exemple, régression, hypothèse faible et coût caché.
5. **Chief of Staff** synthétise bénéfice, coût, désaccords et prochaine décision.
6. **Maxime** arbitre. Une recommandation de rejet reste une recommandation.
   Si l'idée est approuvée avec un périmètre clair, passer à [B](approved-feature.md).

Confier des missions réelles aux collègues pertinents ; une idée sans impact
technique peut s'arrêter après Product avec justification explicite.
Aucun appel systématique de spécialistes ; noter quelle étape est non pertinente.

## Sortie

- PROBLÈME et personne/contexte concernés, sans besoin inventé.
- HYPOTHÈSE et PREUVE DISPONIBLE, date/source.
- SOLUTION ENVISAGÉE et alternative minimale, y compris ne rien construire.
- Bénéfice attendu et critère observable.
- Compatibilité avec la vision et décisions/retraits concernés.
- INCERTITUDE, risques et désaccords avec confiance.
- Coût technique approximatif, dépendances, ce qui reste à inspecter.
- Recommandation : poursuivre l'enquête, réduire, différer, écarter ou construire
  sous périmètre proposé ; décision nécessaire et moyen de vérifier la valeur.

## Fin et mémoire

Aucun code produit par ce workflow. Si demandé, conserver l'analyse comme
proposée dans le backlog ou une DEC/ADR au bon endroit, selon
[le registre](../decisions/README.md). Ne pas copier une proposition dans la vision.
