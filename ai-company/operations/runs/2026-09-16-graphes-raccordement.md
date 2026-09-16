# Raccordement des graphes — GRAPH-0001

## Mandat

Demande explicite de Maxime le 16/09/2026 : « les graphes sont-ils mis à jour
automatiquement ? Si oui, on fait ce que tu as dit, si non on bosse déjà à les
rendre fonctionnels ». Suite de l'[enquête](2026-09-16-graphes.md).

Périmètre : accès local borné aux scanners existants, consultation technique
avec codebase-memory déjà installé, fraîcheur vérifiée, tests sans API,
instructions ciblées et documentation. Pas d'installation, de serveur
permanent, de configuration globale ou de modification produit. Les fichiers
de vision et de cadrage en cours d'édition appartiennent à une autre tâche.

## Plan avant réalisation

1. Vérifier le recalcul des graphes : chaque scan relit le code ; la synthèse
   macro manuelle et l'écran déjà affiché ne sont pas un flux temps réel.
2. Rendre les graphes consultables par une commande locale compacte ; garder
   les conditions, les heuristiques et toute troncature visibles.
3. Interroger un index technique fraîchement construit sur une copie
   temporaire des sources courantes. Aucun ancien index ne sert de secours.
   Vérifier l'empreinte des sources avant de restituer la réponse.
4. Tester ajouts/modifications/suppressions, limites, erreurs et nettoyage ;
   faire une revue indépendante puis documenter les commandes utilisables.

## Résultats

`npm run agents:graph -- ...` est raccordé dans `package.json`. Le
[guide](../../workflows/graphes.md) est accessible depuis les workflows et le
contrat commun des cinq profils. Aucun AGENTS.md global ou produit modifié.

- `graph-workflow.mjs` réutilise les cinq modules TypeScript existants et
  TypeScript déjà installé ; chargement limité, sans hook global ni changement
  du répertoire courant, cache neuf à chaque scan. Aucun nouveau moteur de
  parcours. Conditions, heuristiques, bornes et omissions sont conservées.
- `graph-code.mjs` copie les sources sélectionnées dans un dossier temporaire,
  indexe avec le binaire existant, consulte puis nettoie. UI/surveillance sont
  désactivées dans sa configuration isolée. Le résultat est rejeté si le
  corpus a changé pendant la consultation. Aucun daemon ou index permanent.
- `graph.mjs` sélectionne la vue et valide les paramètres. Les sorties JSON
  sont compactes ; la taille est bornée en éléments, pas en tokens.

## Vérifications exécutées

`npm run agents:test` : **48 tests réussis**, dont 11 nouveaux tests graphes.
Les contrôles incluent : ajout/modification/suppression de sources, modification
à mtime conservée pour les parcours, appels aux trois scanners, exclusion de
cadre avant parcours, conditions et heuristiques conservées, limites et
troncature, alias refusés/omis, erreurs, nettoyage et mutation concurrente de
l'instantané technique. Les tests techniques utilisent un exécuteur simulé ;
aucune dépendance au binaire local dans la suite automatique, aucun appel API.

`npm run agents:check` : **57 documents et 4 missions**, liens locaux contrôlés,
sans erreur. Les avertissements DIR-0001 indiquent que ses preuves historiques
ne valent plus pour tout le checkout actuel ; ils ne sont pas présentés comme
un échec de ses anciens tests ni remplacés par ceux de GRAPH-0001.

Essais CLI réels sur le dépôt :

| Commande après `node ai-company/scripts/graph.mjs` | Résultat |
|---|---|
| `ux` | 20 racines, demande d'une racine explicite |
| `ux page:/seances --depth 1` | 40 nœuds, 67 liens, omissions annoncées |
| `macro page:/seances` | 3 nœuds, 2 liens, limites annoncées |
| `architecture page:/seances` | 40 nœuds, 100 liens, omissions annoncées |
| `code callers envTuteur` | 517 fichiers sélectionnés, huit appelants ; chemins, lignes et confiance fournis |

Fraîcheur également éprouvée avec le **binaire réel 0.9.0** sur une fixture Git
isolée : création de `alpha` → 1 résultat ; remplacement par `beta` à mtime
conservée → 1 résultat ; suppression de son fichier → 0 résultat pour `beta`.
Un second fichier garde une source dans la fixture. Dossier de test supprimé.
Ces trois consultations reconstruisent chacune leur index.

Revue indépendante native QA : **aucun défaut bloquant identifié** ; 11/11
tests dédiés réussis, bornes UX éprouvées avec profondeur 0/nœuds 1/liens 0,
deux consultations réelles du binaire (`callers` et `find envTuteur`, limite 1).
QA a vérifié la suppression du répertoire temporaire propre à sa consultation
et l'absence de changement dans `config list` global avant/après.

Les contrôles de clôture sont réexécutés sur les empreintes finales et conservés
dans [la fiche](../missions/GRAPH-0001.json). Cette preuve locale n'est ni un
merge ni un déploiement. Le travail de vision/cadrage préexistant est préservé.

## Limites restantes

- Mise à jour automatique **lors de la consultation**, sans surveillance
  permanente de l'écran ou du disque. La synthèse macro reste partiellement
  manuelle. Les fichiers doivent être enregistrés sur disque.
- Les scans parcours ne sont pas atomiques face à plusieurs éditions
  concurrentes ; relancer après leur fin. Le contrôle d'empreinte technique
  ne promet pas qu'aucun fichier ne changera après la restitution.
- Index technique limité au corpus documenté ; faux liens possibles. Une
  confiance élevée n'est pas une preuve. Aucun résultat ne démontre seul
  l'absence d'un composant ou d'une dépendance.
- Adaptateurs sans appel réseau ; trafic du binaire tiers non capturé.
  Aucun appel API produit/payant déclenché. Coût Codex de la tâche inconnu.
- Configuration MCP globale inchangée : accès des agents par commande locale,
  pas par un outil MCP natif. L'instruction encourage son usage pertinent ;
  elle ne garantit pas que chaque agent l'utilisera pour toute question.
- Pas de gain total de tokens mesuré. Un index temporaire privilégie fraîcheur
  et simplicité, avec quelques secondes de calcul local par consultation.

## Mode d'emploi et reprise

Dire au copil : « Consulte le graphe actuel autour de Séances, puis vérifie
dans le code les points qui fondent ton avis. » Il dispose du
[guide de commandes](../../workflows/graphes.md) dans le contrat commun.
Une session suivante peut exécuter `npm run agents:resume -- GRAPH-0001`
puis consulter les graphes du checkout actuel : aucune réindexation manuelle
ou reprise d'un export ancien n'est nécessaire.
