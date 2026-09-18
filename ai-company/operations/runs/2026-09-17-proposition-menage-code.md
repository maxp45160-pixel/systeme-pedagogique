# Proposition de ménage global du code — 17/09/2026

**Statut : proposition, aucune suppression effectuée.** Source : demande de
Maxime après les trois lots NUIT. Le code produit, PRODUCT et les ADR n'ont
pas été modifiés pour cette analyse. Les changements locaux des missions
précédentes et du chantier documentaire restent à leurs propriétaires.

## Recommandation

Commencer par retirer les anciens morceaux d'interface dont le retrait est
déjà confirmé par les parcours actuels, puis simplifier les chemins doublés.
Traiter la suppression groupée comme une correction avec reproduction, car
son état inutilisé masque un problème asynchrone. Garder les fondations gelées
hors du premier ménage. La quantité de lignes supprimées n'est pas un critère
de réussite : le gain recherché est moins de chemins concurrents à comprendre
et moins de couverture de test donnant l'illusion d'un parcours utilisé.

## Ce qui a été vérifié

- Scan AST TypeScript de **760 fichiers sources, dont 241 fichiers de tests**.
  Parcours des imports, réexports, imports dynamiques et require à argument
  littéral ; résolution avec le tsconfig réel. Racines conservatrices : fichiers
  de convention Next, proxy/instrumentation, scripts et configurations.
- **22 fichiers, 4 731 lignes brutes**, sans chemin depuis ces racines par
  imports. Ce n'est **pas** un volume supprimable : la liste contient le lanceur
  de campagne, les fixtures, le stub server-only, les figures préparées et les
  fondations de planification gelées.
- Recherche complémentaire des exports non référencés, y compris dans des
  fichiers partiellement vivants. Un helper utilisé dans son propre module ou
  uniquement pour tester un contrat n'a pas été déclaré inutile par principe.
- Deux revues ciblées indépendantes, interface et métier, puis confrontation
  des candidats au code, aux tests de composition, à PRODUCT et aux ADR.
- Index technique frais via `codebase-memory`, exposé par la commande locale
  `node ai-company/scripts/graph.mjs code callers creerDepotAction --limit 10` :
  zéro appelant retourné, recoupé avec les références source. L'index seul
  ne constitue pas une preuve d'absence.
- Contrôle renforcé, sans modification de configuration :
  `node node_modules/typescript/bin/tsc -p app --noEmit --incremental false --noUnusedLocals --noUnusedParameters`.
  Il signale **cinq déclarations inutilisées**, dont deux dans le formulaire
  de suppression groupée et trois dans des tests. Ce contrôle supplémentaire
  échoue intentionnellement sur ces constats ; la vérification normale des
  lots NUIT avait passé 2 572 tests, ainsi que le build. La suite complète n'a
  pas été relancée pour cette proposition en lecture seule.
- Scan des dépendances d'exécution et recherche de corps de fonctions
  identiques après retrait des commentaires et normalisation des espaces.

Limites : le graphe est au niveau des modules et conserve les imports de
types ; il peut donc considérer vivant un module dont seul un type est utilisé.
Les chemins calculés, alias de configuration, conventions et usages externes
nécessitent une lecture complémentaire. Aucun audit des données distantes,
des tables, des fonctions SQL ou du trafic de production n'a été effectué.

## Lot 1 — Vestiges confirmés, risque faible

Les chemins de code des tableaux et lots ci-dessous sont relatifs à `app/src`.

Estimation indicative : **2 à 4 heures**, vérifications incluses, dépendant de
la coordination avec le chantier documentaire. Petits changements séparés.

| Cible | Constat | Proposition et précaution |
|---|---|---|
| `components/dashboard/activite.tsx:14`, `carte-seance-active.tsx:13`, `bloc-echeance-prioritaire.tsx:26`, `passer-seance.tsx` | Trois anciens blocs sans appelant ; PasserSeance n'est appelé que par CarteSeanceActive. Les tests de composition de `/app` imposent l'absence des deux derniers blocs. **386 lignes dans ces quatre fichiers**, avant nettoyage des imports. | Retirer les quatre fichiers. Garder les actions serveur éventuellement utilisées ailleurs et les tests attestant le parcours actuel. |
| `components/intention/bouton-intention.tsx:114,251` | BoutonIntentionDashboard et VoiesApprentissageDashboard ne sont rendus que dans leurs tests ; la composition de `/app` impose leur absence. | Retirer les deux branches et leurs helpers exclusifs, environ 234 lignes. **Conserver** RappelNouveauBesoin, BoutonIntentionRail et BoutonIntentionMobile. |
| `components/atelier/vues-synthese-atelier.tsx:5` | CarteCreationPointillee n'a aucun appelant ; un test de composition vérifie son absence. | Retirer ce composant, environ 40 lignes. Garder le fichier et ses exports vivants. |
| `lib/store/candidats-referentiel.ts:33` | Façade sans appelant ; l'assemblage utile est exécuté dans `relecture-referentiel.ts:127`. | Supprimer les 49 lignes du fichier, conserver les détecteurs et le chemin de relecture actif. |
| `lib/store/declencheurs-relecture.ts:48` | dernierDeclencheurDeclare n'est pas appelé ; la relecture consomme declencheursDeclaresDepuis. | Retirer seulement l'ancienne fonction. Garder le type partagé et la fonction de lecture active. |
| `components/ui/explication.tsx:43`, `icones.tsx:275,281` | Reserves, IconeAgrandir et IconeReduire ne sont référencés ni dans l'application ni dans les scripts. | Retirer ces exports et leurs dépendances exclusives ; conserver les fichiers partagés. |
| `components/exercices/zone-reponse.tsx:70` | Aucun appelant ne fournit onDemanderCorrection ; le parcours utilise urlCorrection. | Réduire la prop et ses branches. Repasser la recette de sauvegarde avant navigation, ce code venant d'être fiabilisé. |

Le potentiel est déjà de plusieurs centaines de lignes sans toucher aux
fondations gelées. Les chiffres sont des tailles de source, commentaires
compris, pas une économie de bundle démontrée.

## Lot 2 — Ancien accueil et chemin de création remplacé

Estimation : **2 à 4 heures**. Risque modéré, car des morceaux vivants et des
données historiques cohabitent dans les mêmes fichiers.

- `components/depot/accueil-depot.tsx:27` : AccueilDepot n'est plus appelé,
  et lui seul appelle AccueilDuJour (`accueil-du-jour.tsx:26`). La route `/app`
  utilise AccueilAssistant. Retirer cette composition puis ses dépendances
  exclusives. **DepotsRecents reste utilisé dans `atelier/page.tsx`** ; ne pas
  supprimer le fichier en bloc. Examiner les descendants un par un : VueDepot
  peut servir à la réouverture d'un dépôt depuis l'assistant.
- `lib/store/depot-actions.ts:27` et `depot-documents.ts:39` : la façade
  creerDepotAction et l'écrivain V1 creerDepotDocumentaire ne sont plus appelés
  par l'interface. Le chemin courant passe par creerRessourceDepotAction et
  creerRessourceDocumentaire. Retirer uniquement ce chemin de **création**.
  Conserver les lecteurs, la reprise, la correction et la suppression des
  dépôts historiques. Aucune migration ni destruction de données proposée.
- `components/tuteur/ressources-conversation.tsx:56` : lectureAProposer n'a
  que des appelants de test. Retirer ce helper si la revue finale confirme
  qu'il ne représente plus une règle attendue ; transférer les assertions
  utiles vers les sélections réellement exécutées. Ne pas supprimer des tests
  d'invariants sous prétexte que leur helper a disparu.

Ces fichiers appartiennent au chantier documentaire actif : faire le ménage
après stabilisation de son diff, sans mélanger corrections produit et retraits.

## Lot 3 — Simplification qui corrige un problème

Estimation : **1 à 2 heures**. Priorité fonctionnelle élevée, à traiter dans
un changement distinct des suppressions mécaniques.

Dans `components/atelier/vues-ressources-atelier.tsx:68-69`, les valeurs
suppressionGroupeeEnCours et erreurGroupee ne sont jamais affichées.
Le callback onConfirmer, vers la ligne 344, démarre une transition puis retourne
sans attendre sa tâche asynchrone. La modale de confirmation attend ce retour,
puis appelle onFermer (`modale-confirmation-suppression.tsx:107`). Le catch du
parent range un éventuel échec dans l'état invisible. **La fermeture peut donc
précéder le résultat et l'échec peut rester silencieux.**

Proposition : donner à la modale une promesse représentant réellement
supprimerArchivesAction ; retirer la deuxième gestion d'attente/erreur du
parent et laisser la modale gérer ces états. Conserver les résultats partiels
et le rafraîchissement. Constat confirmé par lecture du flux, **pas encore par
reproduction navigateur**. La réalisation commence par deux scénarios avec
action simulée : succès différé et rejet différé. Aucune suppression réelle
n'est nécessaire pour prouver le comportement.

## Lot 4 — Doublons exacts, après les retraits

Estimation : **2 à 3 heures** ; intérêt secondaire, risque modéré.

- `components/competences/graphe/graphe-competences.tsx:449,464` et
  `components/dev/graphe-workflow.tsx:803,818` ont des gestionnaires pointer
  down/move identiques. La sortie de drag diffère : navigation d'un côté,
  sélection de l'autre. Extraire seulement la mécanique commune, en s'appuyant
  sur `lib/ui/graphe-d3.ts` déjà partagé ; préserver les comportements propres
  et tester drag, pan, zoom, clic et nettoyage des listeners.
- `lib/dev/workflow-ast-parser.ts:1328,1410` répète le même parcours récursif
  d'import et sa construction d'index. Extraire un helper interne explicite,
  sans cache global supplémentaire. Vérifier cycles, réexports et résultats
  des deux scanners avec les tests des graphes.

Ne pas transformer ces deux duplications en refonte des graphes : la réduction
de surface doit rester supérieure à la complexité de l'abstraction ajoutée.

## À préserver ou à arbitrer séparément

- **Planification gelée** : tableau-bord-orchestration, carte-preparation-periode,
  carte-proposition-plan, modale-revue-plan, seances-a-venir, dashboard-orchestration,
  revision-plan, acceptation-plan et plan-actions constituent le principal îlot
  non raccordé repéré, environ 3 300 lignes. PRODUCT, notamment lignes 83 et
  953, conserve explicitement ces fondations. Ma recommandation est de les
  laisser hors du ménage immédiat. Une décision de retrait devrait mettre à
  jour PRODUCT/ADR et préserver les fonctions voisines encore appelées par
  les protocoles de cours. Ne pas supprimer sur la seule absence d'import.
- **Figures d'exercice** : le composant et son contrat sont explicitement
  préparés en attente de raccordement dans `docs/architecture/MATHEMATIQUES_FIGURES.md:74`.
  Leur statut doit être tranché avant retrait.
- **Tests et simulation** : garder campagne.run, catalogue, execution,
  jeu-donnees, referentiel.fixture et server-only-stub. Le lanceur et le stub
  sont reliés par configuration Vitest, pas par un import applicatif ordinaire.
- **promptComplet** (`lib/tutor/prompt.ts:45`) est explicitement un utilitaire
  pour quatre suites de tests. La production sépare contexte stable et variable
  conformément à ADR-097. Le déplacer éventuellement vers les tests apporte
  peu ; sa suppression ferait perdre de la couverture utile.
- **Dépendances** : les grosses dépendances d'exécution examinées ont un usage
  réel (LLM, OCR, graphes, maths, Supabase). @types/d3-force pourrait être rangé
  en devDependencies, mais ce n'est pas du code mort. Aucun désinstalleur ni
  nouveau détecteur à installer pour ce premier ménage.
- **Migrations, protocoles, compatibilité de données et fichiers publics** :
  leur absence d'import TypeScript n'autorise pas leur suppression. Les
  migrations appliquées et les lectures historiques sont hors de ces lots.
- **Exports de types et fichiers volumineux** : leur nombre ou leur taille
  ne prouve pas une inutilité. Pas de découpage général de l'éditeur, du corpus
  ou des prompts simplement pour raccourcir des fichiers.

## Exécution et critères de réussite proposés

Ordre recommandé : **lot 1**, **lot 3**, **lot 2**, puis **lot 4 seulement si le
bénéfice reste net**. Les durées sont des estimations, pas un budget engagé.

Avant chaque petit lot : refaire les références sur le checkout courant et
vérifier les propriétaires des changements partagés. Pour une branche
réellement retirée, enlever ses tests de rendu obsolètes mais conserver les
tests des comportements vivants et ceux qui imposent son absence du parcours.

Après chaque lot : TypeScript/ESLint, tests concernés, recette du parcours
touché ; vérification globale et build à la livraison. Pour ZoneReponse et
Modale, conserver les recettes navigateur des lots NUIT. Un résultat attendu
est zéro nouvelle alerte de code inutilisé, pas une baisse forcée du nombre
de tests ni un pourcentage arbitraire de lignes supprimées.

Quand les cinq diagnostics renforcés sont traités, proposer d'intégrer
noUnusedLocals/noUnusedParameters au contrôle ordinaire. Ils ne détectent pas
les exports morts ; garder en complément une revue des points d'entrée et des
références. Aucun outil ne doit autoriser seul une suppression automatique.

Livraison attendue : petits diffs lisibles, contrats documentaires exacts,
aucun parcours actif retiré, aucune compatibilité historique cassée, aucun
changement de seuil pédagogique, aucune opération sur la base distante.
