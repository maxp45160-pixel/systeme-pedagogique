# État courant — points de reprise

Actualisé le 15/09/2026 pendant la V2 de l'organisation. Ce fichier est un index
de sources actives, pas un deuxième journal. Vérifier Git à chaque reprise :
dernier relevé local `60c8617`, sur `master`, avec un chantier applicatif concurrent
non committé. Ce relevé n'établit ni déploiement ni réussite du diff courant.

## Où reprendre

Complément du 16/09 : [DIR-0001](../operations/missions/DIR-0001.json) consolide
la direction locale. `npm run agents:resume -- DIR-0001` retrouve mandat,
décisions et preuves. Le [cadrage critique](../product/cadrage-direction.md)
prépare le cahier des charges demandé ; ses arbitrages restent proposés.
UX-0001 reste au propriétaire indiqué dans sa [fiche](../operations/missions/UX-0001.json),
y compris ses effets externes incertains. Ne pas les rejouer depuis cet index.

| Sujet | Source active et limite |
|---|---|
| Organisation des agents V2 | [Fiche ORG-0001](../operations/missions/ORG-0001.json), [mandat](../operations/autonomy.md), [cycle de mission](../workflows/mission.md). L'état d'exécution est dans la fiche. |
| Parcours assistant → confirmation → priorités | [Mission USE-0005](../operations/metrics.md#use-0005--réaliser-le-parcours-assistant--confirmation--priorités). Travail sous la responsabilité de sa tâche existante ; pas de transfert implicite à la V2. |
| Analyse documentaire et fournisseur Mistral | [Registre pilote](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md#reprise-mistral--15092026). Première analyse réelle réussie consignée ; parcours complet et fidélité sur corpus varié restent à éprouver. Ne pas reprendre l'ancien blocage Qwen comme état actuel. |
| Produit et arbitrages | [PRODUCT](../../PRODUCT.md) pour le contrat courant ; [ADR](../../ARCHITECTURE_DECISIONS.md) pour ses décisions et amendements. Les textes en cours d'édition ne prouvent pas le déploiement. |
| Prochain travail autorisé | [Fiches de mission](../operations/missions/README.md) et `npm run agents:next` ; [backlog](../operations/backlog.md) pour les seules propositions. |

## Vérification et historique

Les résultats détaillés appartiennent aux fiches et à leurs preuves. Lire un
test historique ne le réexécute pas. L'état distant se vérifie si le chantier
l'exige ; ce fichier ne transforme pas une inconnue technique en question produit.

L'[audit initial](../CURRENT_SYSTEM_AUDIT.md) et le
[bilan initial](../operations/situation-initiale.md) conservent le relevé ancien
`e0c591a`. Ils ne décrivent plus à eux seuls le checkout actuel. Le défaut de
mémoire périmée est documenté dans l'[audit d'autonomie](../operations/runs/2026-09-15-audit-autonomie.md).

Plan global, calendrier et autres cibles se lisent avec leurs statuts dans
PRODUCT ; l'existence de fichiers ne les réactive pas. Aucun statut humain n'est
promu par cet index. Déclenchement des agents à la demande, choisi par Maxime.
