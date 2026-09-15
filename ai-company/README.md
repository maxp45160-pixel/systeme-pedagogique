# AI Company — Twiny

Mémoire de travail interne, versionnée avec le dépôt. Maxime conserve l'autorité
sur la vision, les priorités et les décisions importantes. Cinq profils Codex
natifs prennent en charge des missions avec leurs outils et un contexte séparé.
Les Markdown portent leur mémoire et leurs contrats ; les exécutions sont réelles.

## Utiliser maintenant

Dans une tâche Codex ouverte sur ce dépôt, demander par exemple :

- « Où en est Twiny ? » — [bilan Chief of Staff](workflows/situation.md).
- « Analyse cette idée : … » — [nouvelle idée](workflows/new-idea.md), sans code automatique.
- « CTO, analyse ce choix technique : … » — [contrat CTO](agents/cto.md).
- « QA, attaque cette proposition : … » — [contrat QA](agents/qa.md).
- « Research, quelles preuves soutiennent cette hypothèse : … ? » — [contrat Research](agents/research.md).

[AGENTS](../AGENTS.md) contient le routage vers les [profils natifs](../.codex/agents/).
Exemple : « Product, prends en charge cette idée, confronte-la à la vision et
fais challenger ta conclusion par QA. Reviens avec ta recommandation. »
Le coordinateur lance les sous-agents utiles, vérifie leurs résultats et vous
restitue les désaccords. Les détails et limites sont dans [exécution native](operations/native-agents.md).
Un [premier bilan sourcé](operations/situation-initiale.md) illustre la sortie.

## Reprendre en quelques minutes

1. Lire [les instructions](../AGENTS.md), puis [l'état courant](company/current-state.md).
2. Lire [les priorités](company/priorities.md) et les seules sources pertinentes.
3. Vérifier Git avant de parler du code actuel ; distinguer travail local,
   committé, déployé, testé et validé humainement.
4. Formuler les inconnues et une prochaine action vérifiable.

L'[audit initial](CURRENT_SYSTEM_AUDIT.md) décrit la provenance de cette V1.
Il est daté : il ne remplace pas une nouvelle inspection.

## Autorité des sources

| Question | Référence canonique |
|---|---|
| Vision, public, limites, arbitrages produit | [PRODUCT](../PRODUCT.md) |
| Décisions architecturales, amendements et retraits | [ADR](../ARCHITECTURE_DECISIONS.md) |
| État effectivement implémenté | Code courant et tests exécutés sur ce code |
| État distant / migrations | Inspection réelle de Supabase et du déploiement ; registres comme preuves datées |
| Modèle cible et contrats proposés | [TWINY_MODEL](../docs/architecture/TWINY_MODEL.md), [ENGINE_CONTRACTS](../ENGINE_CONTRACTS.md), avec leurs statuts |
| Instruction du chantier en cours | Demande explicite de Maxime ; une sortie d'agent n'en tient jamais lieu |
| Mémoire de coordination | Ce dossier : synthèses sourcées, propositions et traces internes |

Les fiches ci-dessous sont des index, pas une nouvelle norme produit. Si elles
contredisent une source, signaler l'écart et vérifier les amendements ; ne pas
choisir silencieusement la version la plus commode.

## Carte de lecture

- Entreprise : [vision](company/vision.md), [principes](company/principles.md),
  [état](company/current-state.md), [priorités](company/priorities.md).
- Produit : [modèle](product/product-model.md), [public](product/user-model.md),
  [pédagogie](product/pedagogical-model.md).
- Ingénierie : [architecture](engineering/architecture.md), [dette](engineering/technical-debt.md).
- Recherche : [hypothèses](research/hypotheses.md), [journal](research/research-log.md).
- Opérations : [backlog](operations/backlog.md), [problèmes](operations/known-problems.md),
  [changelog](operations/changelog.md).
- [Rôles](agents/README.md) et [contrat commun](agents/common.md).
- [Workflows](workflows/README.md) : situation, idée, feature approuvée, bug et revue.
- [Décisions](decisions/README.md) : registre, template et proposition interne.
- [Contrôles locaux](operations/automation.md), [validation V1](operations/validation.md),
  [métriques d'utilité](operations/metrics.md), [agents natifs](operations/native-agents.md).
- [Mandat initial](operations/mandate.md) : demandes humaines et périmètre autorisé.

## Entretien et contexte

Chaque fait durable porte source et date ; chaque inférence reste nommée.
TEMPORAIRE désigne une sortie de travail ; HYPOTHÈSE une affirmation à éprouver ;
PROPOSÉE une recommandation ; VALIDÉE requiert une décision humaine traçable ;
REMPLACÉE conserve le lien vers ce qui la remplace. Un constat technique
reproductible peut être ajouté par un agent sans devenir une validation produit.

Après un changement pertinent, relire les sources concernées, corriger l'index
courant et noter la raison dans le changelog. Les détails restent au document
canonique. Ne pas recopier chaque patch dans chaque fiche, ni charger tout ce
dossier à chaque tâche. Ne pas versionner secrets, transcriptions privées ou
données personnelles d'apprenants. Préférer références et constats minimaux.
