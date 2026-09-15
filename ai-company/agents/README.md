# Rôles disponibles

Les cinq profils [Codex natifs](../../.codex/agents/) rendent ces contrats
exécutables comme sous-agents, avec outils et contexte séparés.
Lire le [contrat commun](common.md) puis le rôle et les sources nécessaires.

| Demande | Rôle |
|---|---|
| « Où en est Twiny ? » | [Chief of Staff](chief-of-staff.md), `twiny_chief_of_staff` |
| « Product, prends en charge cette idée : … » | [Product](product.md), `twiny_product` |
| « CTO, analyse ce choix technique : … » | [CTO / Architect](cto.md), `twiny_cto` |
| « QA, attaque cette proposition : … » | [QA / Critic](qa.md), `twiny_qa` |
| « Research, enquête sur cette hypothèse : … » | [Research / Learning Scientist](research.md), `twiny_research` |

La demande d'un rôle déclenche une mission native bornée lorsque les outils
sont disponibles. Le coordinateur donne le dossier au collègue, poursuit le
travail indépendant utile, récupère le résultat et le vérifie. Un agent peut
chercher, utiliser les outils et écrire les livrables qui lui sont confiés.
Une analyse d'idée seule ne donne toujours pas d'autorisation de coder.

Les agents héritent par défaut du modèle, de l'effort et des permissions de la tâche :
aucun modèle imposé ou permission élargie par les profils. L'[essai compute](../decisions/DEC-0002-essai-manuel-compute.md)
autorise le coordinateur à sélectionner modèle/effort au lancement quand l'outil
le permet, avec justification et suivi. Ils restent disponibles
pour des suites pendant la vie de leur exécution ; ils ne tournent pas en permanence.
Les fichiers portent la définition durable ; les faits utiles de la mission
rejoignent la mémoire avec provenance. Voir [exécution native](../operations/native-agents.md).
