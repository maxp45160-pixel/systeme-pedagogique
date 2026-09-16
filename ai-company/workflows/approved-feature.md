# B — Feature approuvée

## Entrée et autorité

Demande explicite, périmètre et critères attendus. Retrouver la source de l'accord
et les décisions existantes ; ne pas demander une deuxième validation d'un accord clair.
Si un choix important manque, préparer ses options et poursuivre l'indépendant.
Ouvrir ou reprendre la [fiche de mission](mission.md) ; elle conserve l'accord,
les critères, les chemins possédés et la prochaine action.
Suivre la [continuité](continuity.md) : déclarer `planLinks` vers les exigences
concernées ; décrire la tranche exacte, sans prétendre couvrir tout le parcours.

## Déroulement

1. Product précise problème, critères testables, hors-périmètre et hypothèses.
2. CTO compare code actuel et cible, lit les ADR et les signatures/dépendances.
   Proposer le plan avant de coder : étapes minimales, fichiers, tests et repli.
3. Développer dans le périmètre autorisé. Respecter AGENTS et les règles locales.
   Ne pas mélanger les changements préexistants. Pas de dépendance sans confirmation.
4. Exécuter les tests pertinents. Pour un chantier applicatif significatif,
   utiliser `npm run verify` ; compléter par build, navigateur ou contrôles SQL
   lorsque la nature du changement les exige. Respecter consentement/coût.
5. QA suit [D — revue](review-change.md), cherche régressions et limites ;
   corriger et ne répéter que les vérifications rendues nécessaires.
6. Mettre à jour la documentation touchée et l'éventuelle décision structurante
   **dans le même commit que le code**, conformément à AGENTS. Si un arbitrage
   était nécessaire avant implementation, il devait être obtenu à l'étape 2,
   pas régularisé après coup.
7. Mettre à jour le registre actif/changelog ; Chief of Staff actualise les index
   uniquement si objectif, état, risque ou décision ont changé.
8. Clore la fiche avec preuves et contrôles liés à la version ; vérifier la
   cohérence avec `npm run agents:check`, puis poursuivre seulement si le mandat
   couvre une autre mission admissible. Une vérification indispensable bloquée
   ne devient pas une réussite.
   Préparer `handoff` avant les contrôles finaux : contribution livrée, reste à
   faire, rapports et déploiement distinct. Cette transmission permet au prochain
   copil de reprendre le bilan sans lire la conversation de réalisation.

Avant toute DB : inspection réelle Supabase, ADR, dépendances, migration adaptée
et état d'application documenté. Jamais de rejeu déduit du seul fichier local.

## Sortie et fin

Résultat observable, fichiers/périmètre, validations réellement exécutées avec
résultats, réserves, documentation et décision liée. Un test bloqué reste bloqué ;
un échec préexistant est distingué sans être ignoré. Aucun push direct d'un
chantier non vérifié sur master, aucune livraison prétendue sans preuve.
