# ③ — Remplir les fiches de briques

## Objectif

Décrire factuellement chaque brique de `PRODUCT_SPECIFICATION_MAP.md`, une fois et dans sa couche, afin de rendre la carte vérifiable par le dépôt.

## Entrées

`AGENTS.md`, `PRODUCT.md`, `PRODUCT_SPECIFICATION_MAP.md`, `ARCHITECTURE_DECISIONS.md`, le code et les tests qu'ils désignent.

## Livrable

`docs/specification/0-ignore.md`, `1-connait.md`, `2-observe.md`, `3-decide.md`, `4-fait-faire.md`, `5-donnees.md`.

## Méthode

Pour chaque brique de sa couche, consigner : entrées, sorties, invariant ou garantie, fichiers de code, tests qui la couvrent et statut actuel. Vérifier chaque affirmation dans le code et les tests ; conserver les références ADR. Les lacunes restent des lacunes et les comportements incertains restent 🔬 ou ❓.

## Critères de refus

Refuser de décrire une brique ❓ comme si elle existait, d'inventer un comportement non lisible dans le dépôt, de déplacer une brique entre couches sans décision humaine, ou de faire monter un statut.

## Vérification

Chaque brique de la carte apparaît une seule fois ; chaque référence de code et de test est vérifiable ; les frontières 1/2 stockées et 3 dérivée sont respectées.
