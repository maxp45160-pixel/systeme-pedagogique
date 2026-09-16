# DEC-0003 — Autonomie bornée, reprise et amélioration évaluée

- Identifiant : DEC-0003
- Date : 2026-09-15
- Statut : accepted
- Auteur de la proposition : coordinateur après audit CTO et QA
- Décideur : Maxime
- Validation humaine : « Vas-y implémente les améliorations que tu m'as proposé ! Puis fais moi une synthèse de ce qui a été fait. »
- Source de la validation : tâche Codex 01a0a697-72b8-7870-b03d-f887188e3eb0, réponse à l'audit du 15/09/2026 ; portée détaillée ci-dessous.
- Décisions liées / remplacées : complète DEC-0001 pour le fonctionnement natif ; ne prolonge pas DEC-0002 ; aucun ADR produit modifié.

## Contexte

L'[audit](../operations/runs/2026-09-15-audit-autonomie.md) constate une équipe
native utilisable, mais une mémoire périmée, des reprises peu structurées et
aucune évaluation générale des changements de règles. Maxime demande leur
implémentation. À la question du déclenchement, il choisit explicitement
« À la demande, le temps de vérifier la V2 » dans cette même tâche.

## Problème

Permettre aux agents de terminer et d'enchaîner le travail autorisé sans
redemander les étapes techniques, tout en conservant les arbitrages humains
et la preuve de ce qui a réellement été accompli.

## Options étudiées

- Conserver les contrats V1 : peu de code, mais reprise et état fragiles.
- Ajouter un orchestrateur permanent : infrastructure et autorité excédant le besoin établi.
- File locale, contrats natifs et contrôles Node : option retenue, sans dépendance.

## Décision

Appliquer le [mandat opérationnel](../operations/autonomy.md), le
[cycle de mission](../workflows/mission.md) et le
[cycle d'amélioration](../workflows/improvement.md).
Une fiche JSON par mission devient sa source d'état opérationnel. Le coordinateur
la maintient ; les spécialistes ne réécrivent pas les registres partagés.
Les statuts d'exécution ne sont pas des statuts produit ni des décisions humaines.

Le mandat couvre les étapes nécessaires d'une réalisation approuvée et les
corrections locales étayées qui restaurent un contrat déjà approuvé. Il autorise
l'entretien factuel de la mémoire et l'amélioration locale des outils/procédures
avec évaluation et repli, sans extension de droits ou affaiblissement des critères.
Les autres chantiers produit restent à proposer. Le démarrage est à la demande ;
aucun réveil périodique n'est activé. L'arrêt de Maxime prévaut immédiatement.

La lecture reste ciblée : signatures d'abord, puis corps nécessaires pour
comprendre, vérifier ou modifier. Les cinq profils réutilisent le contrat commun.

## Justification

Les agents natifs fournissent déjà les exécutions et la délégation. Le manque
principal porte sur les autorisations retrouvables, la reprise et la vérification,
pas sur un nouvel ensemble de rôles ou un routeur de modèles.

## Conséquences

Commandes locales de contrôle et sélection de mission, tests de ces commandes,
scénarios versionnés pour les décisions des agents. Les contrôles sont raccordés
à `npm run verify`. Ils contrôlent des déclarations et ne constituent pas une
barrière d'autorisation ni une preuve de l'accord humain.
Les permissions du runtime demeurent applicables ; pas de nouvelle dépense,
de changement produit, de publication ou de déploiement déduit de cette décision.

## Éléments de remise en cause

Questions redondantes persistantes, reprise impossible, faux succès, conflits
d'écriture ou coût d'entretien supérieur à son apport. Modifier une règle
d'autorité ou un critère obligatoire exige un nouvel arbitrage explicite.

## Historique

- 15/09/2026 : demande d'implémentation et choix du démarrage à la demande
  transcrits ; V2 réalisée dans le même chantier que ses contrats et contrôles.
  La validation technique figure dans la fiche de mission et le journal de livraison.
