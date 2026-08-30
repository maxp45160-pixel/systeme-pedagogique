# Audit UI/UX du tableau de bord et plan d’implémentation

Date : 29/08/2026  
Périmètre : diff actif, tableau de bord `/app`, proposition de plan, journée,
créneaux, échéances et revue de replanification.  
Statut : analyse Codex — aucune décision produit n’est validée par ce document.

## 1. Sources et méthode

- lecture de `PRODUCT.md`, des contrats d’orchestration et du plan d’interface ;
- audit du diff actif : 48 fichiers suivis modifiés, environ 2 460 ajouts et
  336 suppressions, plus 19 fichiers non suivis avant les trois artefacts de
  cet audit ;
- recherche des appelants, routes, tests et contrats documentaires des anciens
  composants ;
- exécution de `tsc`, ESLint et Vitest ;
- capture authentifiée du tableau de bord, puis contrôle après défilement.

Captures acceptées :

1. [`01-dashboard-current.png`](./01-dashboard-current.png) — premier écran ;
2. [`03-dashboard-scroll.png`](./03-dashboard-scroll.png) — proposition vide
   et « Votre journée » dans le même état réel.

## 2. Verdict

Le problème principal n’est pas une incohérence de style. C’est une incohérence
d’état et de hiérarchie : le tableau de bord présente simultanément une
proposition ignorée, une recommandation à « commencer maintenant » et « 0
séance acceptée ». L’interface transforme donc une recommandation dérivée en
élément de journée alors que la frontière produit dit que seules les séances
acceptées deviennent des `LearningSession`.

Le deuxième problème est la place donnée à l’administration du contexte. La
carte de créneaux et d’échéances occupe presque tout le premier écran, avant la
réponse à « que faire maintenant ? ». Les mêmes échéances sont ensuite relues
dans une seconde grande carte, avec plusieurs états vides peu informatifs.

Le niveau de risque du diff actif est **élevé pour l’expérience** et **moyen
pour la logique de replanification**. Les tests passent, mais certains tests
figent précisément les comportements contestés au lieu de protéger le contrat
utilisateur.

## 3. Parcours observé

| Étape | Ce que voit la personne | Santé |
|---|---|---|
| 1 | Salutation, puis carte complète « Vos créneaux et échéances » | Mauvaise : la configuration prend la priorité sur le travail |
| 2 | « Aucune séance à confirmer » après une proposition ignorée | Fragile : état utile, mais surdimensionné et encore présent après le refus |
| 3 | « Votre journée » contient une recommandation avec « Commencer » | Critique : ce n’est pas une séance acceptée |
| 4 | « Voir la suite de la semaine · 0 séance acceptée » | Mauvaise : contrôle sans contenu et contradiction visible |
| 5 | Grande carte d’échéance « Non estimable », puis deux sous-sections vides | Mauvaise : la page répète l’absence au lieu d’aider à agir |

## 4. Constats prioritaires

### P0 — une recommandation est affichée comme une séance acceptée

`recommendationEntry` fabrique une entrée de journée sans `sessionId` et la
branche comme repli lorsque la journée ne contient aucune séance acceptée.
Cette entrée reçoit ensuite l’état `current` et le bouton « Commencer ».

Conséquence : « proposition » et « séance acceptée » deviennent
indiscernables à l’écran, même si la persistance respecte encore la frontière.

Preuve :

- `app/src/lib/engine/dashboard-orchestration.ts:148`
- `app/src/lib/engine/dashboard-orchestration.ts:254`
- `app/src/components/dashboard/tableau-bord-orchestration.tsx:157`

### P0 — trois états concurrents décrivent le même plan

La proposition vide, la recommandation immédiate et le compteur de séances
acceptées sont calculés par trois chemins distincts. Ils peuvent donc être
tous vrais techniquement tout en étant contradictoires pour la personne.

Le test de rendu exige aujourd’hui « Voir la suite de la semaine » et
« Changer l’ordre » même dans l’état sans séance acceptée. Il protège la
présence des contrôles, pas la cohérence de l’état.

Preuve :

- `app/src/lib/engine/dashboard-orchestration.test.ts:105`
- `app/src/lib/engine/dashboard-orchestration.test.ts:152`

### P1 — la hiérarchie met les entrées du moteur avant la tâche

La page compose `CartePreparationPeriode` avant `TableauBordOrchestration`.
Sur le viewport observé, presque tout le premier écran est donc occupé par un
créneau et une échéance déjà déclarés. Le plan, la journée et la préparation
sont repoussés sous la ligne de flottaison.

Preuve : `app/src/app/(app)/app/page.tsx:99`.

### P1 — l’ancien parcours d’échéance n’a pas de parité fonctionnelle

La nouvelle carte permet d’ajouter une échéance et de lire les échéances
ouvertes. L’ancien couple `CarteEcheances` / `ActionsEcheance` permet aussi de
marquer une échéance comme passée et de la reporter sans réécrire l’original.
Ces actions ne sont pas présentes dans le nouveau parcours.

La documentation impose explicitement la parité des informations utiles avant
la fusion et interdit tout retrait avant relève fonctionnelle.

Conclusion : les anciens composants sont statiquement orphelins, mais ne sont
pas supprimables aujourd’hui.

### P1 — « Modifier » et « Garder mon plan » n’ont plus de comportement

Le diff rend `onModifier` et `onGarder` optionnels, puis les gestionnaires se
contentent de fermer la modale. Les callbacks restent dans le type de
compatibilité mais ne sont plus exécutés. Les tests ne font qu’un rendu
statique de la modale et ne vérifient pas ces actions.

Preuve :

- `app/src/components/dashboard/tableau-bord-orchestration.tsx:341`
- `app/src/components/dashboard/tableau-bord-orchestration.tsx:349`

### P1 — l’absence de slot a deux significations incompatibles

Le commentaire de `replanifierSession` dit que le planificateur retire les
séances acceptées de ses slots. Pourtant, si le plan recalculé ne contient
aucun slot, le diff propose directement `annuler`. La page masque ensuite
cette annulation lorsque `plan.slots.length === 0`.

Le moteur produit donc un changement que l’interface sait potentiellement
faux et choisit de cacher. Ce contrat doit être résolu dans le moteur, pas par
une condition de présentation.

Preuve :

- `app/src/lib/engine/revision-plan.ts:273`
- `app/src/app/(app)/app/page.tsx:75`

### P2 — contrôles et informations sans utilité dans l’état courant

- « Changer l’ordre » est visible avec une seule entrée — qui n’est même pas
  acceptée ;
- « Voir la suite de la semaine » est visible avec zéro séance ;
- `acceptedWeekCount` compte toutes les séances actives, sans borner la semaine
  affichée ;
- la carte d’échéance affiche « Vos preuves récentes » puis « À éclaircir »
  même quand les deux sections sont vides.

### P2 — risques d’accessibilité à vérifier

Les titres, listes et libellés textuels sont globalement présents. En revanche :

- la cohérence sémantique du CTA « Commencer » est incorrecte ;
- les changements de plan et la fermeture des actions de revue ne sont pas
  prouvés au clavier ;
- le bandeau de sept jours impose un défilement horizontal sur petit écran ;
- les captures ne permettent pas de conclure sur le focus, le contraste AA,
  le zoom à 200 % ou l’annonce des recalculs aux technologies d’assistance.

## 5. Audit du diff actif et du code mort

### Vérification automatique

- TypeScript : réussi ;
- ESLint : 0 erreur, 9 avertissements ;
- Vitest : 174 fichiers, 2 016 tests réussis ;
- `git diff --check` : aucune erreur d’espacement.

Les avertissements de variables inutilisées visibles dans
`espace-documentaire.tsx` et `vues-ressources-atelier.tsx` existaient déjà dans
`HEAD` ; ils ne sont pas introduits par le diff actuel.

### Code statiquement orphelin, mais protégé contre la suppression

Onze composants d’entrée de l’ancien tableau de bord n’ont plus d’importeur de
production direct. Leurs composants auxiliaires ne restent atteignables que
depuis ce groupe. Les principaux contrats concernés sont :

- `AbandonnerExerciceCarte` ;
- `ActionsEcheance` ;
- `Activite` ;
- `AvisPropositions` ;
- `BandeauRepriseBienveillante` ;
- `BlocEcheancePrioritaire` ;
- `CarteEcheances` ;
- `CarteSeanceActive` ;
- `MiniActivite` ;
- `PistesAlternatives` ;
- `ProchaineAction` et ses actions de refus / feedback.

Ils ne doivent pas être supprimés :

1. la parité fonctionnelle n’est pas démontrée ;
2. la documentation dit encore « conserver et étendre » ou conditionne le
   retrait à une reprise de calculs, de tests, d’informations ou d’état local ;
3. aucune documentation courante ne décrit explicitement leur retrait achevé.

### Code nouveau sans appelant de production

- `FigureExercice` et `estFigureExercice` ne sont appelés que par leurs tests ;
  le document d’architecture dit en parallèle que le modèle `Exercise` ne
  porte pas encore de figure structurée ;
- `actionCandidatesDepuisRecommandations` n’a plus d’appelant après le passage
  à `composerCandidatsPlan` ;
- les alias `DiffPlan`, `ChangementPlan` et `diffPlan` n’ont pas d’appelant ;
- les callbacks optionnels `onModifier` et `onGarder` sont conservés dans le
  type, mais ne servent plus au comportement.

Ces éléments doivent être classés avant merge : branche volontairement
préparatoire, compatibilité encore requise, ou code à retirer dans un commit
documenté. Ils ne doivent pas rester implicitement « peut-être utiles ».

## 6. Conditions de retrait à appliquer

Pour chaque ancien composant ou parcours, produire un tableau de preuve avant
suppression :

| Preuve | Attendu |
|---|---|
| Parité | matrice action / information / état vide / erreur / clavier, ancien contre nouveau |
| Dépendances | zéro importeur de production, zéro route, zéro test contractuel non migré, zéro donnée ou clé navigateur dépendante |
| Documentation | `PRODUCT.md` et/ou ADR courante décrivent le retrait dans le même commit |
| Vérification | tests migrés, captures des états équivalents, parcours clavier, mobile et bureau |

En l’état, aucun ancien parcours du tableau de bord ne franchit les quatre
preuves.

## 7. Plan d’implémentation proposé

### Lot 0 — verrouiller les états et les scénarios avant le visuel

Décider et tester quatre états exclusifs :

1. aucune proposition et aucune séance acceptée ;
2. proposition disponible, non encore acceptée ;
3. proposition ignorée ;
4. une ou plusieurs séances acceptées, aujourd’hui ou plus tard.

Critère de passage : pour chaque état, une phrase unique répond à « que dois-je
faire maintenant ? » et aucun CTA ne contredit le compteur de séances
acceptées.

### Lot 1 — rendre la frontière d’acceptation impossible à violer dans la vue

Séparer dans le modèle de vue :

- `acceptedTodayEntries` : uniquement des entrées possédant un `sessionId` ;
- `planProposal` : candidats dérivés, jamais injectés dans la journée ;
- `acceptedWeekSessions` : séances acceptées bornées aux jours affichés.

Supprimer le repli `recommendationEntry` de la journée seulement après avoir
branché la recommandation au composant de proposition ou à une action
secondaire clairement nommée.

Tests requis : aucune recommandation ne peut produire « Maintenant » ou
« Commencer » dans « Votre journée » sans `LearningSession` acceptée.

### Lot 2 — prototyper la hiérarchie avant de coder

Produire et faire valider trois captures bureau + trois captures mobile pour
les états 1, 2 et 4. Direction recommandée :

1. journée / prochaine action réellement engagée ;
2. proposition à confirmer lorsqu’elle existe ;
3. échéance prioritaire, avec seulement les informations non vides ;
4. configuration des disponibilités et échéances en second plan, réouvrable.

La question produit à trancher avant implémentation est le sens de
« disponibilité » : créneau ponctuel destiné au prochain plan, ou récurrence
hebdomadaire. Le code et `PRODUCT.md` décrivent actuellement des créneaux
ponctuels ; l’interface ne doit pas laisser croire à un emploi du temps
récurrent sans décision et sans modèle correspondant.

### Lot 3 — simplifier l’ajout de séances sans nouvelle entité

Conserver `LearningSession` comme seul épisode de travail et la proposition
comme donnée dérivée. Construire un parcours à divulgation progressive :

1. l’état vide explique pourquoi rien n’est planifié ;
2. une seule action primaire mène au fait manquant le plus proche
   (temps disponible, échéance ciblée ou proposition à relire) ;
3. « Préparer autre chose » reste l’entrée secondaire du concepteur manuel ;
4. après acceptation, la séance apparaît immédiatement dans la journée et
   dans `/seances`.

Ne pas créer de route Plan, de nouveau calendrier ni de nouvelle entité.

### Lot 4 — démontrer la parité des anciens parcours

Créer la matrice de parité avant tout retrait :

- échéances : ajouter, passer, reporter, états passés et erreurs ;
- prochaine action : commencer, changer, alternatives, refus et feedback ;
- séance active : reprendre, passer / annuler selon le contrat actuel ;
- reprise bienveillante : migrer ou abandonner explicitement la clé
  navigateur par compte.

Implémenter les éléments manquants dans la nouvelle composition. Faire valider
la matrice, puis seulement proposer les suppressions avec mise à jour de la
documentation courante dans le même commit.

### Lot 5 — corriger la replanification au niveau moteur

Définir explicitement ce que signifie l’absence d’un candidat dans les slots
recalculés lorsque les séances acceptées occupent déjà ces slots. Le moteur
doit produire `conserver`, `déplacer`, `raccourcir` ou `annuler` sans que la
page ait à masquer un résultat supposé faux.

Ensuite :

- donner un comportement réel à « Modifier » ;
- définir si « Garder mon plan » est un simple acquittement local ou un fait
  durable, sans stocker le plan dérivé ;
- tester les changements de disponibilité vide, de créneau déplacé, de
  séance en cours et de conflit concurrent.

### Lot 6 — nettoyage conditionnel

Une fois les lots précédents validés :

1. relancer la recherche d’appelants et de routes ;
2. migrer les tests qui protègent encore l’ancien parcours ;
3. mettre à jour `PRODUCT.md` / ADR dans le même commit ;
4. supprimer uniquement les composants dont les quatre preuves sont vertes ;
5. classer séparément les figures d’exercice et les alias de compatibilité,
   qui ne relèvent pas directement du chantier tableau de bord.

## 8. Gate de vérification finale

- tests unitaires des quatre états exclusifs ;
- tests d’intégration de l’acceptation et de la replanification ;
- aucun CTA « Commencer » sans séance acceptée dans la journée ;
- aucun compteur « 0 séance » accompagné d’un contrôle de réordonnancement ;
- parité documentée des actions d’échéance et de recommandation ;
- capture bureau et mobile, clair et sombre ;
- parcours clavier, retour de focus des modales, zoom 200 % et annonces de
  changement ;
- `npm run verify` et `npm run build` ;
- relecture finale de `PRODUCT.md` et des ADR touchées avant merge.
