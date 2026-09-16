# Priorités et autorisations

Actualisé le 15/09/2026. Maxime conserve les priorités produit. Le coordinateur
ordonne les étapes à l'intérieur d'un mandat déjà approuvé.

## Missions identifiées

- **Organisation :** réaliser les améliorations de l'audit, puis en rendre compte.
  Accord dans [DEC-0003](../decisions/DEC-0003-autonomie-et-reprise.md), état unique
  dans [ORG-0001](../operations/missions/ORG-0001.json).
- **Produit, autre tâche :** réalisation du parcours assistant → confirmation →
  priorités, autorisée et suivie dans [USE-0005](../operations/metrics.md#use-0005--réaliser-le-parcours-assistant--confirmation--priorités).
  Ne pas réattribuer ce chantier ni supposer sa clôture depuis cet index.

## Sélection

Pour une continuation demandée, `npm run agents:next` propose le premier travail
admissible ; relire son accord et le [mandat](../operations/autonomy.md) avant
d'agir. Les entrées du [backlog](../operations/backlog.md) qui restent proposées
ne deviennent pas autorisées par leur présence dans ce fichier.

L'ordre des futurs chantiers produit n'est pas fixé ici. Le contexte récent ne
vaut pas priorité humaine. Quand aucune mission admissible ne reste, restituer
le résultat et arrêter. Pas de veille ni de réveil périodique pendant cette V2.
