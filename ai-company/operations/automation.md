# Routines locales — phase 7

Les parcours de la [validation](validation.md) ont été exercés avant cet ajout.
L'automatisation couvre la mécanique répétée pendant ce chantier.

Depuis la racine, avec Node déjà disponible :

```powershell
node ai-company/scripts/check.mjs
node --test ai-company/scripts/check.test.mjs
node ai-company/scripts/context.mjs
```

- **check** : vérifie liens Markdown locaux en ligne hors blocs de code,
  ancres Markdown courantes, clôtures de blocs, cinq contrats de rôle,
  identifiants/statuts/index DEC et présence déclarée de provenance humaine
  lorsqu'un statut est accepté/refusé/remplacé. Échec : code de sortie 1.
- **context** : date, branche, HEAD, statut incluant non suivis, huit commits
  et statistiques des diff indexés/non indexés. Sortie console seulement.
  Ne lit pas les fichiers de configuration personnelle, données ou secrets.
  Échec Git : sortie non nulle, aucune synthèse inventée.
- **tests du contrôleur** : cas cassés et valides dans des dossiers temporaires ;
  aucune dépendance npm ajoutée. Six tests réussis le 15/09/2026.

Le contrôleur n'est pas un parseur Markdown complet : liens de référence et
syntaxes complexes ne sont pas couverts. Il ne vérifie pas les URLs distantes,
le sens des phrases, la réalité d'une validation humaine, la réussite de tests
produit ou l'application de migrations. Un statut bien formé peut encore être faux.
Le rapport Git peut contenir des noms de fichiers/commits : il reste local.

## Usage

Après édition de cette mémoire, lancer check. Avant un bilan, context fournit
des constats à interpréter avec [Situation](../workflows/situation.md).
Ces scripts ne modifient aucun document ; aucun appel IA, hook Git/CI, service
ou tâche planifiée n'est installé.

## Routines candidates, non activées

| Routine | Réutilisation | Condition avant automatisation supplémentaire |
|---|---|---|
| Revue après gros changement | Workflow D + diff-audit | Périmètre clair et erreurs récurrentes observées |
| Documentation obsolète / décisions impactées | Git + rôle QA | Inspection sémantique humaine ; un diff n'est pas une preuve d'obsolescence |
| Contrôle applicatif | npm run verify / build existants | Changement qui le justifie, pas relance permanente |
| Brouillon changelog / classification dette | Git + Chief of Staff/CTO | Conserver comme proposition, relecture avant écriture |

Aucune périodicité demandée ni utilité récurrente mesurée : pas de rappel ni
d'automatisation Codex créée. Un arbitrage, un merge, un déploiement, une opération
destructive ou une extension de contrat ne se décide pas dans ces scripts.
