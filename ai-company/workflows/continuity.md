# Continuité entre direction et terrain

Ce contrat s'applique à chaque tâche qui cadre, réalise ou vérifie Twiny.
Il complète les [missions](mission.md) et le [copil](copil.md). Les fiches et
preuves partagées assurent la transmission, même sans accès aux anciens chats.
Les autorisations et frontières produit restent inchangées.

## Où chercher et quoi actualiser

| Moment / responsable | Chercher | Actualiser |
|---|---|---|
| Toute tâche au démarrage ou à la reprise | `npm run agents:resume`, puis exigences et décisions pertinentes, Git et propriétaire de la mission | Sa fiche : propriétaire, prochaine action, blocage ; ne pas reprendre le périmètre d'une autre tâche |
| Copil qui cadre | [Dossier de direction](../product/cadrage-direction.md), PRODUCT/ADR et sources humaines | Le document canonique d'exigences ; ajouter sa source à l'[index du plan](../product/plan-index.json) si nécessaire |
| Tâche de réalisation | `npm run agents:progress`, exigence précise et mandat de la tranche | `planLinks` dans sa nouvelle fiche, avant travail ; contribution bornée, pas « tout le parcours » |
| Réalisation après avancée significative | Code/diff et vérifications de sa tranche | `nextAction`, blocage, résultats et rapport ; préparer `handoff` pour la livraison ou le transfert |
| Réalisation à la livraison | Critères de la mission, tests, état local/distant réellement vérifié | `handoff`, rapport et `completion` ; synchroniser les documents concernés ; clore par mise à jour conditionnelle |
| Copil relancé après les travaux | `progress`, `closedMissions`, rapports et preuves actuelles ; pas uniquement les tâches ouvertes | Un bilan sourcé : livré, partiel, à éprouver, déployé ou inconnu, reste à faire et prochaines missions autorisées |

Un sous-agent remet ses résultats au coordinateur propriétaire de la fiche ;
il ne concurrence pas son écriture. Les chats déjà en cours doivent relire ce
contrat à leur prochain point de reprise. Une instruction versionnée n'est pas
une notification injectée rétroactivement dans un chat actif.

## Exigences et liens

Les exigences restent dans leurs documents actuels, avec leurs arbitrages et
critères. L'index sélectionne ces documents, sans les recopier et sans stocker
un pourcentage d'avancement. Le format déjà présent est une table :

```text
| P01-05 | Organiser | Description et critères dans le document canonique |
```

Les identifiants `Pxx-xx` sont stables dans leur document. Ne pas réutiliser un
identifiant retiré pour une autre exigence. Si une source ou un identifiant
change, actualiser les liens dans la même intervention, en respectant les
propriétaires ; le contrôle signale les références rompues. Ajouter une source
à l'index ne valide aucune exigence et n'autorise aucun développement.

Chaque **nouvelle mission produit liée à ce plan** déclare sa contribution :

```json
{
  "planLinks": [
    {
      "source": "ai-company/product/parcours-depot-memoire.md",
      "requirement": "P01-05",
      "scope": "Rattachement aux domaines existants ; les domaines nouveaux et relations notionnelles restent hors tranche"
    }
  ]
}
```

Ce lien entre dans le contrat et les empreintes de preuve. La commande de
mise à jour ne le remplace pas silencieusement : un changement de périmètre
requiert de relire le mandat et les décisions pertinentes.
Une mission d'organisation sans exigence produit utilise `planLinks: []` ou
omet le champ ; elle reste visible dans les travaux sans rattachement.

## Transmission à la livraison

Une mission liée ne peut être déclarée `done` sans `handoff` :

```json
{
  "handoff": {
    "delivered": "Ce qui est effectivement livré dans cette tranche",
    "remaining": ["Recette sur corpus réel", "Reste de l'exigence hors tranche"],
    "evidence": ["chemin/du/rapport-de-livraison.md"],
    "deployment": {
      "status": "not-deployed",
      "evidence": []
    }
  }
}
```

Les chemins sont relatifs au dépôt et pointent vers des fichiers existants.
`remaining: []` est admis si rien ne reste à signaler pour la contribution,
mais ne valide pas toute l'exigence. Un transfert ou blocage peut déjà porter
un `handoff` partiel ; `delivered` doit alors indiquer explicitement ses limites.

Déploiement : `not-deployed`, `unknown` ou `verified`. `verified` exige une
preuve décrivant la cible, la révision et l'observation réelle. La structure
est contrôlée ; la vérité de cette preuve doit toujours être relue. Un commit,
des tests locaux ou un fichier de migration ne prouvent pas un déploiement.
L'application distante d'une migration garde sa propre autorisation.

Le rapport détaille faits déclarés / branchés / observés / testés, fichiers ou
symboles utiles, résultats exacts, révision, limites et effets externes. Il
peut réutiliser le rapport de livraison existant ; pas de seconde mémoire à créer.
Renseigner la transmission **avant** les contrôles finaux : la modifier ensuite,
modifier une preuve ou modifier la source d'exigence périme leur empreinte.

## Reprise du copil

`npm run agents:resume` fournit désormais les missions closes et une vue du
plan calculée à la lecture. `npm run agents:progress` donne cette vue seule.
Le calcul relit exigences et fiches : aucune table d'avancement à régénérer
manuellement, aucune dépendance à une ancienne conversation.

Pour chaque exigence, confronter les contributions, leurs rapports, les réserves,
les tests et leur fraîcheur. Les travaux non rattachés restent visibles : vérifier
s'ils concernent le plan avant de conclure qu'il ne s'est rien passé. Une exigence
sans livraison reliée signifie **couverture non documentée**, pas « code absent ».
Un `done` signifie la fin d'une mission bornée, jamais l'acceptation humaine
automatique d'une exigence ou de tout P-01.

Le copil rend un bilan compréhensible avec source et reste à faire. Il peut
actualiser les faits et proposer une suite ; il ne transforme pas ces propositions
en priorités validées. Il ne relance pas les effets externes ou les tests payants
pour reconstituer un historique.

## Compatibilité, contrôles et limites

P01-0001 et P01-0002 étaient déjà suivies avant ce contrat. `legacyLinks` dans
l'index relie leurs mandats/rapports à P01-05/P01-06 sans éditer leurs fiches ni
réécrire leurs preuves. Le statut et les rapports actuels viennent toujours de
la mission. La couverture est partielle ; les autres exigences restent visibles.
Ces liens historiques ne remplacent pas la transmission structurée des nouvelles
missions. Le propriétaire peut préparer celle-ci quand il reprend son travail.

`npm run agents:check` contrôle aussi les références du plan. Les anciennes
fiches sans lien restent compatibles ; le contrôle ne peut pas deviner qu'un
chat a oublié de rattacher une mission produit. Les instructions et la lecture
des travaux non rattachés couvrent cette limite, sans promettre une surveillance.
Tests synthétiques via `npm run agents:test`, sans API payante.

Cette continuité porte sur les fichiers accessibles dans le checkout courant.
Une autre branche, un autre worktree ou un travail non enregistré doit être
retrouvé puis partagé/intégré selon son autorisation ; ne jamais prétendre que
la vue locale connaît tous les travaux externes. Aucun merge automatique,
écoute permanente ou synchronisation distante n'est ajouté.
