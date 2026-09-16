# Contrôles locaux — V2

La V2 conserve les contrôles documentaires de la phase 7 et ajoute les fiches
de mission et les évaluations. Le [cycle](../workflows/mission.md) utilise les
agents natifs ; ces commandes ne sont pas un orchestrateur d'exécution.

Depuis la racine, avec Node déjà disponible :

```powershell
npm run agents:check
npm run agents:test
npm run agents:next
npm run agents:resume
npm run agents:resume -- DIR-0001
node ai-company/scripts/context.mjs
node ai-company/evals/score.mjs --inputs
```

- **check** : vérifie liens Markdown locaux en ligne hors blocs de code,
  ancres Markdown courantes, clôtures de blocs, cinq contrats de rôle,
  identifiants/statuts/index DEC et présence déclarée de provenance humaine
  lorsqu'un statut est accepté/refusé/remplacé. Échec : code de sortie 1.
- **context** sans option : date, branche, HEAD, statut incluant non suivis, huit commits
  et statistiques des diff indexés/non indexés. Sortie console seulement.
  Ne lit pas les fichiers de configuration personnelle, données ou secrets.
  Échec Git : sortie non nulle, aucune synthèse inventée.
- **resume** : références canoniques, décisions avec leur statut déclaré et
  provenance, missions ouvertes et dossier demandé, effets externes incertains,
  vérifications et consommation disponible. Aucun test relancé ni appel externe.
- **tests du contrôleur** : cas cassés et valides dans des dossiers temporaires ;
  aucune dépendance npm ajoutée. Six tests réussis le 15/09/2026.
- **missions check/next** : structure des fiches, accord et preuves référencés,
  chemins, collisions `running`/`blocked` et sélection d'une mission `ready`
  indépendante. Refus des alias de périmètre et chemins hors dépôt. Lecture seule,
  aucun verrou ni lancement automatique ; détails dans le [contrat](missions/README.md).
- **agents:test** : contrôleur documentaire, missions et scoreur. Les fixtures
  ne sont pas des observations de missions réelles.
- **évaluation** : [huit scénarios](../evals/README.md), attendus séparés et
  scoreur des réponses déclarées. La revue de l'argumentation reste indépendante.

Le contrôleur n'est pas un parseur Markdown complet : liens de référence et
syntaxes complexes ne sont pas couverts. Il ne vérifie pas les URLs distantes,
le sens des phrases, la réalité d'une validation humaine, la réussite de tests
produit ou l'application de migrations. Un statut bien formé peut encore être faux.
Le rapport Git peut contenir des noms de fichiers/commits : il reste local.

## Usage

Après édition de cette mémoire, lancer `npm run agents:check`. Avant un bilan, context fournit
des constats à interpréter avec [Situation](../workflows/situation.md).
Les commandes de lecture ne modifient aucun document. L'extension
`missions.mjs update` écrit seulement une fiche existante avec comparaison de
révision et verrou coopératif ; [contrat et preuves](missions/README.md).
Aucun appel IA, hook Git/CI, service
ou tâche planifiée n'est installé.
`npm run verify` à la racine exécute maintenant `agents:check`, `agents:test`,
puis la vérification applicative existante. Aucun pipeline distant ni protection
de branche n'est installé par ce raccordement local.

## Routines candidates, non activées

| Routine | Réutilisation | Condition avant automatisation supplémentaire |
|---|---|---|
| Revue après gros changement | Workflow D + diff-audit | Périmètre clair et erreurs récurrentes observées |
| Documentation obsolète / décisions impactées | Git + rôle QA | Inspection du sens et des sources actuelles ; un diff n'est pas une preuve d'obsolescence |
| Contrôle applicatif | npm run verify / build existants | Changement qui le justifie, pas relance permanente |
| Brouillon changelog / classification dette | Git + Chief of Staff/CTO | Conserver comme proposition, relecture avant écriture |

Maxime a choisi le déclenchement à la demande pour vérifier la V2 : pas de rappel
ni d'automatisation Codex créée. Un arbitrage, un merge, un déploiement, une opération
destructive ou une extension de contrat ne se décide pas dans ces scripts.
