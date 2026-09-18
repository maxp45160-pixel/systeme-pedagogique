# Fiabilisation nocturne — mandat du 17/09/2026

Source humaine : dans la tâche Codex courante, Maxime accepte les trois sujets
proposés : « vas-y fais ça. Traite les sujets 1 par 1. Tu as l'autonomie pour la nuit ».

Ordre : NUIT-0001 interruptions/reprises des séances et tentatives ; NUIT-0002
robustesse du moteur pédagogique ; NUIT-0003 accessibilité des parcours essentiels.
Réaliser les diagnostics, scénarios reproductibles, corrections minimales,
tests de non-régression et rapports. Arrêter une tranche lorsque ses critères
sont vérifiés ; ne pas remplir artificiellement une durée.

Livraison locale uniquement. Aucun appel fournisseur payant, nouvelle dépendance,
modification de base distante, publication ou changement de seuil pédagogique.
Les données synthétiques de test ne sont jamais des observations réelles.
Les choix produit et architecture importants non couverts restent à arbitrer.

Base initiale : e9c6fc76c1866a4dee876e541bda8394abc0bd60, checkout partagé master.
Les changements préexistants de P01/UX dans le documentaire, les migrations,
PRODUCT et les ADR restent à leurs propriétaires. Isolation par chemins réservés,
aucune modification de branche ni intégration des travaux concurrents.

Les liens P02 décrivent uniquement la contribution de fiabilisation des contrats
déjà construits ; ils n'autorisent pas la construction du parcours futur P02.
Le coordinateur est la tâche 01a0ac86-510b-77f3-b6e0-69c527682bb2.

Plan de NUIT-0001 : comparer contrats et tests existants ; éprouver sauvegarde
et navigation côté client avec une revue indépendante de la clôture serveur ;
reproduire avant correction ; vérifier les régressions et consigner les limites.
Les deux sujets suivants commencent après clôture ou blocage documenté du précédent.
