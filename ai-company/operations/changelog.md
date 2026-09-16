# Changelog de l'organisation interne

Ce journal suit l'AI Company. Les changements produit restent dans leurs registres
actifs et Git ; ils ne sont pas attribués à ce chantier.

## 16/09/2026 — Graphes consultables par les agents

[GRAPH-0001](runs/2026-09-16-graphes-raccordement.md) expose les scanners existants
et le binaire codebase-memory installé via `agents:graph`. Chaque consultation
recalcule sa vue ; l'index technique utilise une copie temporaire et refuse
les changements de sources détectés pendant la requête. Sorties bornées,
heuristiques explicites, [guide](../workflows/graphes.md) dans le contrat commun.
Aucune installation, API payante, configuration globale ou modification produit.
Les preuves de livraison et limites restent dans le rapport et la fiche.

## 16/09/2026 — Direction critique et reprise contrôlée

Mandat [DIR-0001](runs/2026-09-16-direction-mandat.md) : consolider l'équipe
existante et préparer un cahier des charges exigeant. `agents:resume` retrouve
décisions et missions ; les nouvelles fiches peuvent lier leurs contrôles à
des empreintes et utiliser une mise à jour conditionnelle. Les droits hérités
et leurs limites restent explicites. Le [copil](../workflows/copil.md) conduit
au [dossier proposé](../product/cadrage-direction.md), sans pivot auto-validé.
Revue QA et reprise Chief sans historique réalisées ; résultats et limites
dans le [rapport](runs/2026-09-16-direction.md) et la
[fiche](missions/DIR-0001.json). Aucun produit ou réglage global modifié.

## 15/09/2026 — V2 : mandat, reprise et amélioration évaluée

Maxime demande l'implémentation de l'audit puis choisit le déclenchement à la
demande. [DEC-0003](../decisions/DEC-0003-autonomie-et-reprise.md) conserve cet accord.
Les cinq profils accèdent au mandat et aux workflows de reprise/amélioration
via le contrat commun. Une fiche d'exécution unique porte le point de reprise ;
les index périmés sont réconciliés. La lecture ciblée autorise aussi la vérification.

Commandes de missions, scénarios et scoreur sans dépendance ; raccordement des
contrôles agents à `npm run verify`. Revue QA : deux collisions reproduites puis
corrigées. Les tests et l'évaluation indépendante sont détaillés dans le
[rapport de livraison](runs/2026-09-15-v2-agents.md) ; état dans
[ORG-0001](missions/ORG-0001.json). Aucun gain comparatif, statut produit ou
travail permanent déduit de ces résultats. Aucun changement applicatif par cette mission.

## 15/09/2026 — essai manuel compute autorisé

Après revue native Product/CTO/QA de la spec Compute Router, Maxime accepte
l'essai limité sur cinq missions : « parfait faisons ça ». [DEC-0002](../decisions/DEC-0002-essai-manuel-compute.md)
conserve l'accord, les règles de choix et le bilan attendu. AGENTS, le contrat
commun, les guides natifs et le [registre](metrics.md#essai-manuel-compute--dec-0002)
intègrent le protocole. Aucun routeur logiciel créé ; les missions pilotes
commencent après cette mise en place, sans observation ni économie inventée.

## 15/09/2026 — collègues Codex natifs, après précision de Maxime

La demande complémentaire remplace le report initial de phase 8 pour des
missions natives. Cinq profils TOML ajoutés dans `.codex/agents/`, reconnus par
le runtime ; aucun nouveau service ou modèle imposé. AGENTS, les contrats et
les documents courants ont été synchronisés ; l'ancienne proposition DEC-0001
reste traçable et son statut n'a pas été promu.

QA a réalisé une enquête indépendante sur les contradictions du guide. Product
a produit son premier livrable après une interruption de quota et une reprise.
Chief a été lancé avec sélection explicite du profil natif et a relu le guide
et l'analyse. Leurs corrections sont intégrées et les limites consignées dans
[validation](validation.md) et [métriques](metrics.md).

Les profils CTO et Research sont disponibles, sans mission de test exécutée.
Aucune cadence automatique ou nouvelle autorisation produit n'est créée.
Le compte rendu d'utilisation vit dans [agents natifs](native-agents.md).

Les sections ci-dessous décrivent la livraison documentaire antérieure ; leur
report de phase 8 est historique et a été levé par la demande complémentaire.

## 15/09/2026 — Fondations V1 réalisées localement

- Phase 0 : inventaire transversal, instructions, sources, stack, tests, logs,
  outils et limites inspectés. Audit créé et liens locaux vérifiés.
- Phase 1 : mémoire sourcée créée ; vision/ADR conservés comme autorités ;
  état local séparé des preuves historiques et de l'état distant inconnu.
- Phase 2 : registre interne DEC, template et DEC-0001 proposée ; le registre
  ADR produit reste canonique. Mandat humain conservé pour la reprise.
- Phase 3 : Chief of Staff, Product, CTO et QA avec sept rubriques et contrat
  commun de mémoire, contexte, désaccord et délégation proportionnée.
- Phase 4 : point d'entrée AGENTS, workflow Situation et premier bilan sourcé.
  Le bloc de commandes Markdown non fermé d'AGENTS a été clôturé.
- Phase 5 : workflows idée, feature approuvée, bug et revue. Une idée ne déclenche
  pas de code ; une autorisation explicite permet d'avancer dans son périmètre.
- Phase 6 : Research / Learning Scientist et registre de recherche sans données
  inventées. Aucune recherche externe réalisée pour ce chantier.
- Phase 7 : contrôleur documentaire et collecte Git à la demande, sans dépendance,
  écriture automatique ni appel IA. Six tests du contrôleur réussis.
- Phase 8 : condition examinée, orchestration native différée faute de valeur
  comparative observée ; aucune infrastructure créée par anticipation.
- Phase 9 : registre manuel d'utilité, définitions et règles de calcul ; non mesuré.

### Périmètre et vérification

41 fichiers ajoutés sous `ai-company/` (38 Markdown, 3 scripts Node).
Seul AGENTS a été modifié parmi les 870 fichiers existants dont les empreintes
ont été relevées au démarrage. Les changements produit préexistants, PRODUCT,
ADR, schéma, protocoles, dépendances et configurations ont été préservés.
Aucun commit, push, déploiement ou appel fournisseur effectué.

Les six usages ont été parcourus dans une seule session ; voir
[validation](validation.md). Liens/contrats/décisions contrôlés et collecte Git
exécutée avec succès. Les tests applicatifs et l'état distant n'ont pas été
revérifiés pour cette infrastructure séparée du produit.

### Suite recommandée

Essayer un bilan, une idée et une critique sur des demandes réelles ; consigner
leur apport dans les métriques. Réduire les rôles ou fiches qui ajoutent de
l'entretien sans améliorer une décision. Ne rouvrir la phase 8 que sur des
éléments observés. Ces recommandations ne sont pas des priorités validées.
