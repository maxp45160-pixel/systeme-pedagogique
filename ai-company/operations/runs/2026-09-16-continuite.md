# CONT-0001 — Continuité entre copil et réalisation

## Mandat et état initial

Demande de Maxime le 16/09/2026 : « Fais le raccordement de sorte à ce que
chaque chat sache quoi chercher, où et quoi actualiser. » Il veut qu'un copil
relancé après les travaux retrouve l'avancement réel face au cahier des charges,
sans récit manuel de toutes les conversations.

Défaut observé : `resumeContext` omet les missions closes hors identifiant
explicitement demandé. P01-0001 possède une livraison et des preuves mais peut
donc disparaître de la reprise générale. Les liens exigences/missions ne sont
pas structurés et le compte rendu dépend d'une recherche manuelle.

## Premier lot autorisé

1. Indexer les sources d'exigences existantes, sans recopier leur contenu ni
   inventer de nouvelles exigences ou de décisions humaines.
2. Relier les missions à ces exigences ; une livraison décrit contribution,
   reste à faire, preuves et état de déploiement distinct. Relier les anciennes
   missions par un index de lecture sans modifier leurs fiches ni preuves.
3. Calculer l'avancement à chaque reprise, y compris missions closes et
   travaux sans lien identifié. Aucun statut produit validé automatiquement.
4. Raccorder les instructions communes, mission, livraison et reprise copil ;
   contrôler les chemins, références et données, puis tester une session neuve.

Les chantiers P01-0002 et UX-0001 conservent leurs propriétaires. Aucun code
produit, AGENTS.md réservé par UX-0001, configuration globale, permission,
installation, publication ou appel API payant dans ce lot.

## Livraison et vérifications

Le [contrat de continuité](../../workflows/continuity.md) décrit pour chaque rôle
où chercher et quoi actualiser. Il est raccordé au contrat commun, aux workflows
mission, feature, copil et à leurs index. Le routage existant dans AGENTS.md
vers ces workflows est réutilisé ; son fichier réservé à UX-0001 est préservé.

`agents:progress` calcule la vue depuis l'[index des sources](../../product/plan-index.json),
les tables d'exigences et les fiches. L'index ne recopie pas les exigences et
ne stocke pas un statut produit. Les nouveaux champs `planLinks` et `handoff`
relient une contribution bornée, ses preuves, le reste et le déploiement distinct.
Une clôture liée sans transmission est refusée ; sources et transmission
participent aux empreintes de preuve. Les anciennes fiches restent compatibles.

`agents:resume` expose désormais `progress` et `closedMissions` même sans
identifiant. Il ne cache plus les livraisons terminées lors de la reprise générale.
`agents:check` contrôle les références du plan en plus des contrats existants.
Les liens historiques de P01-0001 et P01-0002 sont ajoutés dans l'index de lecture,
sans modifier leurs fiches, propriétaires, périmètres ou preuves.

## Preuves de fonctionnement

Processus neuf, sans historique du chat : `context.mjs --resume` retrouve les
14 exigences P01/P02 ; P01-0001 déclarée terminée et partiellement contributrice
à P01-05/P01-06, ses deux rapports et ses preuves historiques périmées ; P01-0002
en cours lors de cette vérification, avec son mandat. Les douze exigences sans
contribution reliée restent visibles, sans affirmation de code absent.

Test synthétique en processus neuf : une mission liée terminée revient avec
`remaining: ["Usage acceptance"]`, déploiement `not-deployed`, tandis qu'une
autre exigence reste sans livraison. Aucune consultation des chats nécessaire.

Les nouveaux tests couvrent aussi absence d'index, reprise des anciennes fiches,
contribution partielle, priorité des liens structurés sur la transition historique,
chemins/alias et références invalides, exigences ou sources dupliquées, relecture
après changement d'une source/mission, preuve périmée, lecture seule, transmission
manquante et refus de remplacer silencieusement les liens d'exigence.

Revue QA indépendante : défaut reproduit d'extraction d'exemples de tables
dans un bloc Markdown. Correctif : ignorer les blocs backticks/tildes avec
délimiteurs conformes, en conservant les numéros de ligne d'origine. Test de
régression avec faux identifiant, faux doublon, mauvaises fermetures et bloc
non fermé. Les contrôles finaux et leur date figurent dans
[CONT-0001](../missions/CONT-0001.json). Aucun appel API payant dans les tests.
QA a rejoué sa reproduction après correction : défaut levé, numéros de ligne
conservés et 10/10 tests dédiés réussis. Suite complète : 61/61 tests réussis ;
contrôle des 14 exigences sans erreur.

## Limites et mode d'emploi

- Une fiche, un test déclaré ou un `verified` ne certifie pas la vérité humaine
  ou distante : le copil doit lire les preuves et vérifier les points décisifs.
- Un `done` ne valide pas une exigence entière. Aucune exigence n'est promue,
  aucun pourcentage n'est calculé, aucun déploiement n'est inféré.
- Un oubli complet de `planLinks` dans une nouvelle mission produit ne se
  déduit pas de son seul nom : il reste visible dans les travaux non rattachés.
- Un chat déjà actif doit relire le contrat à son prochain point de reprise ;
  aucune injection automatique de nouvelles instructions dans sa conversation.
- Le périmètre est le checkout accessible. Une autre branche, un autre worktree
  ou des modifications non partagées ne sont pas visibles par magie ; les retrouver
  et partager/intégrer selon autorisation, sans merge automatique.
- Les avertissements sur les preuves historiques des autres missions sont
  conservés ; ils ne sont ni effacés ni présentés comme des tests réexécutés.

Pour la réalisation : lire `agents:resume`, renseigner les liens vers les
exigences, tenir la fiche après avancée, puis transmettre livré/reste/preuves/
déploiement avant clôture. Pour le copil : lire `agents:resume` ou `agents:progress`,
rapports des livraisons closes compris, confronter les contributions aux exigences
et rendre le bilan des écarts avant de proposer une nouvelle tranche.

Repli local : retirer les ajouts de CONT-0001 en préservant les fichiers des autres
tâches. Aucun produit, migration appliquée, service permanent ou configuration
globale à restaurer. Aucun commit, push ou déploiement dans ce chantier.
