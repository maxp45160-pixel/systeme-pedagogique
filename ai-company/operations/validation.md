# Validation de la V1

Pour la V2 du 15/09, voir le [rapport de livraison](runs/2026-09-15-v2-agents.md)
et la [fiche ORG-0001](missions/ORG-0001.json). Les preuves V1 ci-dessous restent
historiques et ne remplacent pas les nouveaux contrôles.

> Cette première vérification porte sur la livraison documentaire initiale.
> L'intégration native et ses exécutions sont consignées dans le complément
> en fin de fichier ; les résultats historiques ci-dessous restent datés.

Date : 15/09/2026. Auteur : Codex. Contrôle effectué dans une seule session,
sans évaluation indépendante ni affirmation d'utilité mesurée.

## Parcours des six usages — avant automatisation

| Usage | Exécution / preuve | Résultat et limite |
|---|---|---|
| État du projet | Workflow Situation appliqué aux lectures réelles de Git/docs/types ; [rapport](situation-initiale.md) | Objectif, changements, état, dette, risques, arbitrages et prochaines actions sourcés. Déploiement/DB/parcours utilisateur laissés inconnus. |
| Nouvelle idée sans code | Cas fictif de contrôle : « Ajouter des points XP pour chaque séance » ; Product confronté à PRODUCT §2 et ADR-017 | Problème : engagement supposé ; hypothèse : XP utile ; solution : points ; preuve : aucune nouvelle preuve d'usage ; incertitude : effet réel. Incompatibilité avec le retrait décidé. Coût d'une mécanique score/UI non estimé précisément sans inspection. Risque QA : transformer présence en progrès. Recommandation : écarter ou enquêter sur le problème réel ; aucun code, aucune décision de rejet humain inventée. CTO/Research approfondis non pertinents à ce stade. |
| Choix technique CTO | Question réelle du chantier : nouveau registre ADR ou réutilisation ? Audit, ADR et DEC-0001 lus | Recommandation : garder les ADR et borner DEC à l'organisation. Alternatives, conséquences et remise en cause dans [DEC-0001](../decisions/DEC-0001-memoire-et-roles-documentaires.md). Statut proposed ; aucune architecture produit changée. |
| Critique QA | Attaque : « Des fichiers complets prouvent-ils que l'organisation fonctionne ? » | Non : liens/sections ne prouvent ni vérité ni indépendance ni utilité. Risque : prendre une proposition implémentée pour une décision acceptée. Réponse : statuts explicites, provenance, revue humaine et métriques encore non renseignées. Aucun consensus de plusieurs agents revendiqué. |
| Retrouver une décision | Recherche du retrait de gamification : PRODUCT §2 puis ADR-017 ; recherche de la convention interne : index DEC | Motif historique retrouvé sans créer un deuxième ADR. Le registre décrit les transitions et la conservation des décisions remplacées. |
| Nouvelle session | Parcours statique AGENTS → README/état/priorités → rôle et sources pertinentes | Compréhension de Twiny, chantier local, raisons, décisions et inconnues sans dépendre du fichier joint. Routage documentaire vérifié ; découverte automatique dans une nouvelle instance Codex non testée. Les chemins explicites restent utilisables. |

Ces exercices vérifient la cohérence des définitions. Ils ne sont pas des demandes
réelles supplémentaires du fondateur et n'alimentent pas les métriques d'utilité.

## Vérifications par phase

- Phase 0 : liens de l'audit contrôlés, sources et limites identifiées.
- Phase 1 : 16 documents et 119 liens locaux vérifiés à cette étape.
- Phase 2 : registre/template/DEC proposés relus ; pas de promotion de statut.
- Phase 3 : quatre contrats contrôlés sur les sept rubriques exigées. Une première
  commande de contrôle a échoué sur le quoting PowerShell ; corrigée puis relancée
  avec succès, sans modification des contrats pour masquer l'échec.
- Phase 4 : routage et structure du bilan vérifiés ; clôture Markdown d'AGENTS réparée.
- Phase 5 : quatre workflows ajoutés ; 179 liens locaux vérifiés à cette étape.
- Phase 6 : cinquième contrat contrôlé ; aucune recherche externe revendiquée.
- Phase 7 : six tests du contrôleur passent, dont liens/ancre absents,
  sortie du dépôt, contrat incomplet, provenance humaine manquante et index
  incohérent. Collecteur Git exécuté avec succès. À la relecture, son `trim()`
  pouvait supprimer l'espace significatif du premier statut Git ; remplacé par
  `trimEnd()` et sortie vérifiée. La branche détachée a un libellé explicite.
- Phase 8 : condition de valeur non satisfaite, report documenté sans orchestration.
- Phase 9 : registre et définitions relus ; aucune donnée d'utilité inventée.

## Contrôle du périmètre final

Comparaison SHA-256 des 870 fichiers existants relevés avant édition : seul
AGENTS est différent. Les 41 nouveaux fichiers sont tous sous `ai-company/`.
PRODUCT, ADR, code applicatif, schéma, protocoles, dépendances et configurations
préexistants sont inchangés par ce chantier. Le diff AGENTS passe `git diff --check`.
Les liens et formats des fichiers ajoutés sont contrôlés par le script local.
Dernier contrôle : 38 documents et 209 liens locaux, aucune erreur signalée.

Les sections courantes de PRODUCT et les règles de statut des ADR ont été
relues avant clôture : aucun contrat produit retiré/remplacé par cette V1,
donc aucune modification de ces autorités n'était nécessaire. Le registre DEC
porte uniquement une proposition d'organisation réversible et son origine.

## Limites de cette preuve

Les fichiers applicatifs n'ont pas été modifiés pour cette V1 ; aucune nouvelle
suite produit, build, requête DB ou expérimentation payante n'est nécessaire à
la validation de ces contrats. Les résultats applicatifs restent ceux de leurs
registres datés, pas ceux de ce chantier. Une validation syntaxique ne certifie
pas les sources externes, les décisions humaines ni la justesse des synthèses.

## Complément du 15/09 — intégration native demandée

- Cinq profils `.codex/agents/twiny_*.toml` créés au format officiel ; syntaxe
  parsée avec `tomllib`, noms/description/instructions présents, aucune surcharge
  de modèle, de permissions ou d'outil externe.
- Les cinq rôles sont exposés par le runtime actuel. Une mission Chief a été
  effectivement lancée avec sélection du profil `twiny_chief_of_staff`.
- QA a inspecté les contradictions documentaires ; ses constats ont été appliqués.
- Product a lu son profil et ses sources, puis écrit un livrable proposé, relu
  par le coordinateur. Première tentative interrompue par quota, reprise terminée.
  Les erreurs fournisseur citées ont été retrouvées dans les registres sources.
- Chief a relu le guide et le livrable Product ; distinction entre profils
  disponibles et missions exécutées, et absence d'archivage automatique précisée.
- CTO et Research : configuration reconnue, exécution non testée dans ce chantier.
- Le contrôle des liens a détecté une ancre ADR-145 absente dans le livrable
  Product ; lien corrigé vers le registre réel avant clôture.

Les sorties sont des analyses d'agents, pas une validation de la vision. Aucun
fichier applicatif, fournisseur produit, déploiement, base ou calendrier de
travail automatique n'a été modifié. Voir [exécution native](native-agents.md)
et [métriques](metrics.md) pour l'état courant.
