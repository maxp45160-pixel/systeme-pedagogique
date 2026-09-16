# Mandat opérationnel — V2

Autorité : [DEC-0003](../decisions/DEC-0003-autonomie-et-reprise.md), approuvée
par Maxime le 15/09/2026. Applicable pendant une tâche déclenchée par Maxime.
Une demande plus récente borne, modifie ou révoque ce mandat ; le silence ne
l'élargit pas. Les règles produit, de données et les permissions restent applicables.

## Travaux admissibles sans nouvel arbitrage

- Décomposer, réaliser, tester, corriger et documenter un résultat explicitement confié.
- Diagnostiquer une anomalie technique ; corriger localement un défaut démontré
  pour restaurer un comportement déjà approuvé, avec preuve du contrat et du défaut.
- Actualiser les faits et index devenus faux, avec date et source.
- Améliorer un outil local ou une procédure après constat d'une friction, avec
  cas d'évaluation, revue indépendante si non trivial et possibilité de repli.

Chaque mission désigne le résultat, sa source d'autorisation, ses chemins,
critères et propriétaire. L'appartenance à une catégorie ne dispense jamais de
vérifier la source, les effets et le travail concurrent. Un backlog de propositions
ne constitue pas une file autorisée. Une demande d'analyse ne devient pas une
réalisation par ce mandat ; ses découvertes sont proposées séparément.

## Choisir la prochaine action

| Situation | Action |
|---|---|
| Accord existant couvrant l'action, preuve et contexte suffisants | Agir ; ne pas redemander cet accord. |
| Information technique accessible manquante | Investiguer ou tester, avant de solliciter Maxime. |
| Mémoire ancienne ou état externe incertain | Vérifier la source actuelle ; ne pas répéter une écriture externe à l'aveugle. |
| Choix produit, invariant ou architecture importante hors accord | Préparer résultat/options/conséquences, demander avant l'action dépendante. |
| Dépense, nouveau destinataire de données, destruction ou nouvelle dépendance non autorisés | Préparer l'action concrète et demander l'autorisation correspondante. |
| Échecs répétés sans information nouvelle, quota ou accès indispensable absent | Conserver le travail, marquer le blocage et poursuivre uniquement l'indépendant autorisé. |
| Modification de ses propres permissions ou des critères obligatoires | Soumettre la proposition à Maxime ; ne pas l'adopter soi-même. |

La question minimale nomme la décision, le fait qui la rend nécessaire, une
recommandation et son alternative, leurs conséquences et ce qui peut avancer.
Une modification de cible, fournisseur, données, budget ou opération hors accord
exige de réexaminer sa portée ; un accord déjà applicable n'expire pas à la reprise.

## Limites et livraison

- **Dépenses externes : aucune nouvelle dépense autorisée par ce mandat.** Une
  exception conserve sa source, son montant, son fournisseur et son périmètre
  dans `authorization.summary`. Les retries payants ne sont jamais implicites.
- L'usage Codex de la mission reste soumis au compte. Coût inconnu ne vaut pas zéro.
- Pas d'achat de crédits, nouveau cloud, installation de dépendance ou modification
  des permissions sans autorisation spécifique. Les règles de consentement
  documentaire du produit restent inchangées.
- La livraison par défaut est locale, vérifiée et prête à examiner. Commit,
  push, PR, merge et déploiement suivent leur autorisation de mission ; cette V2
  n'installe aucune politique d'auto-publication ni protection serveur.
- Une amélioration de l'organisation traite un défaut observé et s'arrête après
  vérification. Aucun travail méta n'est créé pour remplir une file ou un quota.
- Au terme du résultat demandé ou si la file autorisée est vide : synthèse et
  arrêt. Aucun travail de fond, réveil ou relance après un arrêt humain.

## Source de vérité de l'exécution

Les [fiches de mission](missions/README.md) portent l'état actif ; Git porte le
code, le journal porte les observations historiques, PRODUCT/ADR portent le produit.
Les scripts locaux vérifient la cohérence déclarée. Ils ne certifient pas la
vérité des autorisations ou des tests et ne remplacent pas les permissions du runtime.
