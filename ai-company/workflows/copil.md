# Copil — direction critique et cahier des charges

Point d'entrée : « Copil, challenge la direction de Twiny », « construisons le
cahier des charges », « pourquoi ce choix ? ». Fonction du Chief of Staff
existant, avec Product puis QA seulement quand leur examen apporte une preuve
distincte. Le [mandat](../operations/autonomy.md) et le
[cycle de mission](mission.md) restent applicables.

## Reprendre sans le chat

1. Exécuter `npm run agents:resume` ; avec un dossier connu :
   `npm run agents:resume -- DIR-0001`. Lire le mandat référencé, la fiche et sa
   prochaine action. La commande charge les décisions déclarées, travaux ouverts,
   inconnues, effets externes incertains et fraîcheur des preuves ; elle n'agit pas.
2. Lire PRODUCT, les corps des décisions pertinentes et leurs amendements. Un
   statut retourné est déclaré, pas authentifié. Une ancienne décision remplacée
   reste dans l'historique ; une proposition n'a aucune autorité supplémentaire.
3. Vérifier Git, les propriétaires actifs et les sources évolutives. Une preuve
   ancienne est datée, pas transposée au checkout courant. Ne pas relancer un effet
   externe incertain. En cas de contradiction, conserver les deux sources,
   distinguer cible et implémentation et proposer le traitement.
4. Pour DIR-0001, ouvrir le [dossier critique](../product/cadrage-direction.md)
   puis le [rapport](../operations/runs/2026-09-16-direction.md). Ce sont des
   analyses et des preuves datées, pas une nouvelle vision approuvée.

## Prendre position

Le copil doit produire un avis propre, même s'il recommande de réduire une
surface, différer une idée ou rouvrir une promesse. Chaque avis important contient :

- résultat humain recherché et décision actuelle applicable ;
- faits **déclarés / branchés / observés / testés**, avec sources et inconnues ;
- thèse précise, conséquence si elle est juste, meilleure objection ;
- alternative minimale, coût de ne rien changer et niveau de confiance ;
- observation qui ferait changer d'avis et arbitrage exact réservé à Maxime.

Une critique forte n'est ni une posture systématiquement négative ni l'écho de
la colère du fondateur. Ni votes d'agents ni nombre de tests ne tranchent la valeur.
Conserver les désaccords. Une petite correction reste dans la tâche courante.

## Du désaccord au cahier des charges

Un dossier produit a un emplacement canonique ; commencer par le
[cadrage en cours](../product/cadrage-direction.md), indexé depuis la carte produit.
Ne pas recopier PRODUCT/ADR. Pour chaque besoin, documenter :

1. personne, situation, problème et preuve disponible ;
2. objectif, résultat observable, limites et non-objectifs ;
3. parcours nominal, entrées/sorties, règles et dépendances ;
4. erreurs, refus, interruption, reprise, consentement et écritures ;
5. existant réutilisable, écart réel, critères de recette positifs et négatifs ;
6. décisions ouvertes, options et recommandation ;
7. statut proposé/arbitré, source humaine si arbitrage, prochaine tranche autorisée.

Détailler le prochain parcours utile avant les domaines lointains. Une exigence
non arbitrée peut être précise ; elle n'est pas pour autant prête à développer.
Après arbitrage humain, mettre à jour PRODUCT/ADR dans le chantier concerné,
puis créer les missions exécutables et leurs tests. Aucun code produit ne part
automatiquement de ce dossier.

## Déléguer et vérifier

Contrat compact : id, résultat utilisateur, sources/décisions, critères,
fichiers lus/possédés, rôle, modèle/effort hérités, livrable, limites et arrêt.
Un seul écrivain du dossier ; pas de sous-délégation sans allocation explicite
du coordinateur. Par défaut local : une proposition et deux corrections au plus,
puis diagnostic/blocage si aucune preuve nouvelle. Ces limites sont des consignes
de mission, pas des compteurs imposés au moteur Codex.

QA reçoit besoin, sources, critères et diff, pas seulement le résumé Product.
Il cherche citation trompeuse, hypothèse transformée en fait, alternative absente,
proposition invérifiable et développement prématuré. Une revue native observée
n'est pas un benchmark général. Le jugement humain de pertinence reste ouvert.

## Mémoire et sortie

Le coordinateur consigne un delta sourcé dans le dossier et la fiche existants.
Une décision durable va au registre approprié après événement humain identifiable.
Pas d'import automatique des statuts depuis une note externe, aucune auto-approbation.
Corriger un fait avec date/source ; conserver la décision remplacée et son lien.
Garder mandats, décisions et preuves finales ; supprimer les traces temporaires
de test, ne pas archiver les transcriptions complètes ni les secrets.

Restituer avis, résultat, preuves, limites, consommation mesurée/inconnue et un
prochain pas. Le déclenchement reste à la demande, sans watcher ni dépense nouvelle.
