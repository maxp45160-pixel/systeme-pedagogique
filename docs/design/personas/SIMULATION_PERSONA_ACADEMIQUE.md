# Simulation persona — étudiante académique multi-classes

**Version 1.2 — 22/08/2026. Simulation d'évaluation, aucune décision validée.**

> **v1.2.** Régénération du graphe après le commit `4cd3323` (« hub rail,
> seuil de surface ») : les chiffres et la lecture de §4 ont été recalculés ;
> l'entrée de la modale référentiel depuis l'Atelier (chantier du même jour)
> corrige une phrase devenue fausse en §2/S2. Les verdicts ne bougent pas.
>
> **v1.1.** Relecture complète après les chantiers du 21–22/08/2026 :
> retrait du lot 4 (ADR-096 — objectifs, parcours et `resumerPilotageTwiny`
> supprimés), retrait des thèmes (ADR-104), Bureau/Cahier (ADR-101/103),
> restructuration de l'Atelier. Les chiffres du graphe avaient été régénérés
> et les écarts réécrits, pas seulement renumérotés.

Ce document simule le parcours complet d'une personne nouvelle utilisant le
produit pour un semestre académique, et évalue si la carte de navigation
(rail + surfaces) est optimisée pour ce parcours. Il ne tranche rien : chaque
écart remonté est une hypothèse à arbitrer, pas un chantier ouvert.

Méthode :

1. scénario formalisé en onze gestes (§2) ;
2. relecture du code pour chaque geste, avec références (§3) ;
3. lecture mécanique par les scanners de workflow existants
   (`lib/dev/workflow-scanner.ts`, `lib/dev/workflow-ux-scanner.ts`) —
   graphe UX atomique régénéré le 22/08/2026 après `4cd3323` :
   138 nœuds / 436 arêtes, toutes atteignables depuis `/` (§4) ;
4. scorecard et écarts classés (§5–6).

---

## 1. Persona

Léa, étudiante en L2 économie-gestion. Trois cours ce semestre :
macroéconomie, statistiques, développement web. Pour chaque cours : un PDF
global (syllabus + plan de cours), puis chaque semaine un PDF de séance
(polycopié du cours magistral), des devoirs à rendre, et des matières à
travailler. Un examen partiel dans trois semaines pour statistiques. Elle veut
aussi pouvoir s'entraîner ponctuellement sur un sujet imprévu.

## 2. Scénario en onze gestes

| # | Geste |
|---|---|
| S0 | Créer un compte, arriver dans l'app |
| S1 | Déclarer son intention (« réussir mon semestre ») → référentiel proposé |
| S2 | Organiser trois classes distinctes |
| S3 | Déposer le PDF global de chaque classe |
| S4 | Déposer chaque semaine le PDF de séance de chaque classe |
| S5 | Noter les devoirs à rendre par classe |
| S6 | Produire exercices/entraînement sur ce qu'une séance a couvert |
| S7 | Déclarer un examen daté (« partiel de stats dans 3 semaines ») |
| S8 | Obtenir un plan personnalisé : date × compétences × classes |
| S9 | Besoin ponctuel : « quiz demain sur les intervalles de confiance » |
| S10 | Laisser le tableau de bord arbitrer quoi faire maintenant |

Verdicts : ✅ fluide · 🟡 faisable avec friction · ❌ bloqué.

---

## 3. Walkthrough détaillé

### S0 — Arrivée — ✅

Un compte sans référentiel est redirigé de `/` vers `/demarrer`
(`app/src/app/(app)/page.tsx:76`). Le tableau de bord reste vide tant que rien
n'existe — pas de grille de tirets.

### S1 — Déclaration d'intention → référentiel — ✅

`/demarrer` (`formulaire-amorcage.tsx`) propose deux modes (diagnostic guidé /
saisie directe), enregistre sujet + intention + préférences, puis ouvre la
modale référentiel qui fait proposer les branches par le tuteur
(`outilReferentielComplet`, `lib/tutor/outils.ts:756`). Rien n'est écrit avant
validation case par case ; les codes sont attribués par l'application
(`referentiel-compte.ts:15`).

### S2 — Trois classes distinctes — 🟡

Il n'existe aucune entité « classe ». Le proxy naturel est **un domaine par
classe**. Deux chemins :

- À l'amorçage, Léa peut l'écrire dans sa phrase (« mon semestre : macro,
  stats, dev web ») — le tuteur propose plusieurs branches en un geste.
  Sans domaine existant, pas de plafond (`outils.ts:767` : `maxItems` posé
  seulement si le compte a déjà un domaine vivant).
- En cours de semestre, l'ajout passe par le `+` (intention genre
  `referentiel` → modale référentiel) ou directement depuis l'Atelier — la
  modale a désormais plusieurs points d'entrée confirmés par le graphe
  (`page:/atelier`, capture d'intention, modale de définition). Plafond : 2
  nouveaux domaines maximum par proposition quand le compte en a déjà
  (`BRANCHES_MAX_COMPTE_ETABLI = 2`, `outils.ts:754`). Initialement justifié
  par ADR-088, le plafond est désormais porté par ADR-104 (les thèmes
  persistants sont retirés ; il reste une protection contre l'inflation des
  domaines).

Frictions relevées :

- le formulaire d'amorçage dit « Le sujet à travailler » au **singulier**
  (`formulaire-amorcage.tsx:253`) : rien n'invite à décrire plusieurs cours ;
- les domaines sont visibles — l'Atelier restructurée expose une Carte des
  domaines et un Arbre par domaine (`atelier/vues/`) — mais rien ne les
  présente comme « mes classes » ni ne porte leur rythme ;
- aucun calendrier, aucun horaire : la récurrence hebdomadaire des séances de
  classe est invisible pour le système.

### S3 — Dépôt du PDF global de classe — ✅ mécanique / 🟡 rangement

Le mécanisme existe : une fiche note (type `cours`,
`types-documents.ts:154`) accepte des pièces jointes PDF ≤ 10 Mo
(`televersement-pdf.ts`, bucket `pieces-jointes`). Chemin depuis le tableau de
bord : `+` (1 clic) → phrase → fiche créée → téléversement (graphe :
distance 3 jusqu'au nœud de téléversement).

Deux frictions :

- une note créée via le `+` naît **transversale**, non rattachée à la classe
  concernée (`capture-intention.tsx:369` : `domaine: "transversal"`) — la
  relier aux compétences du cours est un geste manuel supplémentaire. Le
  rangement a au moins été fiabilisé : une ressource sans rattachement est
  explicitement **à trier** et l'Atelier demande à quoi la relier
  (`rangement-atelier.ts`, `estATrier`) — elle ne se perd plus dans un
  pseudo-dossier ;
- le tuteur ne lit pas le PDF déposé : le syllabus n'influence ni le
  référentiel ni les exercices. Le dépôt documente, il ne nourrit pas la
  boucle.

### S4 — PDFs hebdomadaires de séance — 🟡

Même mécanique, mais aucune structure classe → séance de cours → document :
chaque semaine produit une nouvelle fiche plate, ou des pièces jointes
cumulées à la même fiche. Sur douze semaines × trois cours, le corpus devient
une pile chronologique sans regroupement par classe. La recherche du Cahier ne
porte que sur les séances de travail, pas sur le corpus.

### S5 — Devoirs à rendre — ❌

Aucune trace : ni type de document, ni entité, nœud de navigation, ni champ.
La seule notion d'échéance que le produit ait portée vivait dans les objectifs
court terme — **retirés avec le lot 4** (ADR-096, 21/08/2026 : tables
`objectifs`, `parcours`, `evenements` supprimées, `objectifs-actions.ts`
supprimé). « Rendre un TP jeudi » n'a nulle part où se poser, et rien ne le
rappellera.

### S6 — Exercices sur ce qu'une séance a couvert — ✅

Le point fort du produit. Compositeur de séance à deux décisions (thème +
temps ; le fichier a été scindé en `etape-besoin.tsx` / `etape-composition.tsx`
le 22/08/2026, refactor mécanique sans changement de comportement), accessible
à distance 2 du tableau de bord (Cahier → Composer). Une fiche cours rattachée
à des compétences alimente l'hypothèse documentaire du classement
(`recommend.ts:161`, `PENALITE_OBSERVATION_DOCUMENTAIRE_SOLIDE`, ADR-064).
Le bilan d'exercice dérive l'autonomie observée (P8/ADR-057). La boucle
génération → évaluation → adaptation tourne ici sans accroc.

### S7 — Déclarer un examen daté — ❌ (régressé depuis la v1.0)

En v1.0, c'était une capacité cachée : « partiel de stats le 15/12 » dans le
`+` créait automatiquement un objectif court terme par compétence visée. Cette
conversion a été **retirée** avec le lot 4 : elle contredisait l'invariant
d'intention (« un besoin ouvre, il ne devient pas un fait »). Désormais le
besoin ouvre la composition et **ne laisse aucun fait derrière lui**
(`capture-intention.tsx:332-338`).

L'extraction d'échéance survit — `extraireEcheanceBesoin`
(`lib/domain/echeance-besoin.ts`) reconnaît toujours « demain », « dans N
jours/semaines/mois », « le JJ/MM » — mais elle n'a **plus aucun consommateur
en production**, seulement son test. Un examen déclaré n'existe nulle part :
aucun objet, aucune liste, aucune trace.

### S8 — Plan personnalisé date × compétences × classes — ❌

C'est l'écart central du scénario, et il s'est creusé : en v1.0 l'échéance était
stockée mais peu consommée ; elle n'est **plus stockée du tout**.

- les objectifs et parcours structurés n'existent plus (ADR-096) ;
  `resumerPilotageTwiny` et ses consommateurs ont été supprimés de
  `vues-twiny.ts` ;
- `engine/parcours-interne.ts` subsiste comme ordonnanceur interne des actions
  dérivées, sans exposition propre : la seule surface de pilotage est la file
  des trois actions recommandées du tableau de bord (ADR-096) ;
- aucun plan dérivé (répartition par jour, couverture des compétences de la
  classe, priorisation par poids d'examen), et désormais rien à partir de quoi
  le dériver — la date d'un examen n'existe nulle part.

Le produit assume par ailleurs ne pas être « un outil de révision »
(PRODUCT.md §2) — cette position doit être arbitrée avant tout chantier ici.

### S9 — Entraînement ponctuel — ✅

Le meilleur flux de l'app : bouton `+` sur le tableau de bord (distance 1),
phrase libre, le tuteur choisit le genre (`intention.ts:49` : travail / projet /
note / référentiel / clarification), et « travail » ouvre directement le
compositeur pré-ciblé (`capture-intention.tsx:330-345`). Si le sujet
n'existe pas, bascule vers une proposition de branche. Exactement le geste
attendu.

### S10 — Arbitrage du tableau de bord — ✅ / 🟡

Une seule action prioritaire, pistes alternatives, contexte instant déclaré
(temps + capacité), reprise des travaux ouverts. La boucle tient. Réserve :
l'arbitre est aveugle à tout ce qui précède (S5, S7, S8) — il arbitre entre
compétences, pas entre engagements datés.

---

## 4. Lecture par le graphe de navigation

Dump régénéré le 22/08/2026 via `scannerUxJourney({ mode: "atomique" })`
(`lib/dev/workflow-ux-scanner.ts`, mécanique partagée avec le scanner AST) :

| Graphe | Nœuds | Arêtes | Atteignables | Inatteignables |
|---|---|---|---|---|
| UX atomique | 138 | 436 | 138 | 0 |

Distances depuis le tableau de bord (`page:/`) vers les surfaces du scénario :

| Surface | Distance |
|---|---|
| Besoin ponctuel — modale « De quoi as-tu besoin ? » (S9) | 1 (`+`) |
| Cahier / Bureau (S6, S10) | 1 |
| Atelier (S3/S4) | 1 |
| Modale référentiel (S2, compte établi) | 2 |

Toutes les surfaces sont atteignables depuis `/`. Depuis `4cd3323`, le scanner
applique un **seuil de surface** : un composant sans signal d'interaction
propre n'est plus monté comme destination — les feuilles muettes qui encombraient
le dump v1.1 ont disparu, et les rares sous-vues restées sans sortie sont
marquées heuristiques (affordances de lecture) au lieu d'être comptées comme
puits. **Les défauts détectés ne sont donc pas des défauts de navigation — ce
sont des capacités manquantes ou invisibles**, sauf friction précise : le
rangement transversal des notes créées via le `+` (S3).

## 5. Scorecard

| # | Geste | Verdict | Cause racine |
|---|---|---|---|
| S0 | Arrivée | ✅ | — |
| S1 | Intention → référentiel | ✅ | — |
| S2 | Classes multiples | 🟡 | pas d'entité classe ; cadrage singulier à l'amorçage |
| S3 | PDF global de classe | 🟡 | mécanisme OK ; rangement transversal par défaut (à trier explicite) ; PDF non lu par la boucle |
| S4 | PDFs de séance hebdo | 🟡 | corpus plat, pas de regroupement classe → séances |
| S5 | Devoirs à rendre | ❌ | aucune surface ni entité |
| S6 | Exercices sur le cours | ✅ | cœur du produit, hypothèse documentaire branchée |
| S7 | Examen daté | ❌ | capacité retirée avec le lot 4 ; extraction d'échéance sans consommateur |
| S8 | Plan avant examen | ❌ | plus de fait daté du tout à consommer |
| S9 | Ponctuel | ✅ | flux le mieux huilé |
| S10 | Arbitrage du jour | ✅ | aveugle aux échéances |

**Conclusion générale.** La carte est saine structurellement (cycle complet,
distances courtes) mais elle est **optimisée pour le geste d'apprentissage
seul**. Le scénario académique échoue précisément là où le produit doit
retenir des **engagements datés** (devoirs, examens) : depuis le retrait du
lot 4, ces faits déclarés n'ont ni accueil, ni stockage, ni rappel, ni effet
sur la recommandation — la v1.0 notait « stockée, peu consommée » ; c'est
désormais « non retenue ».

## 6. Écarts classés — hypothèses à arbitrer, pas des chantiers ouverts

Conformément à PRODUCT.md §7 et AGENTS.md : rien ici ne devient code sans
décision humaine, et la grille de §9 de CLAUDE.md s'applique à chacune.

1. **Fait daté inexistant (couvre S5/S7/S8/S10).** En v1.0, l'écart était
   « échéance stockée, zéro consommateur ». Depuis ADR-096, la donnée elle-même
   n'est plus écrite : la question n'est plus « qui consomme `echeanceLe` »
   mais « le produit doit-il retenir un fait daté, et sous quelle forme ? » —
   ce qui touche directement l'invariant d'intention et la position « pas un
   outil de révision » (PRODUCT.md §2). Ne rien construire avant arbitrage
   explicite. Hypothèse testable : une échéance visible change-t-elle
   l'acceptation des recommandations ?
2. **Rangement des notes créées par intention (couvre S3/S4).** Friction
   localisée et petite : naître transversal au lieu du domaine du besoin. Le
   côté restitution a progressé (zone « à trier » explicite, demande de
   rattachement) ; reste la naissance sans rattachement.
3. **Regroupement par classe (couvre S2/S4).** L'option « passer par des
   thèmes » a disparu : les thèmes persistants sont retirés (ADR-104). Restent
   l'entité classe — nouvelle entité, donc décision lourde — ou rien, tant
   qu'aucun compte tiers n'exprime le besoin (test de réfutation PRODUCT.md §4 :
   10 preuves sans assistance).
4. **Devoirs à rendre (couvre S5).** Écart le plus large et le moins
   certain d'être souhaitable : un tracker de rendus ressemble à ce que le
   produit refuse d'être. Ne rien construire avant arbitrage explicite.

---

## Annexe — vérifications exécutées

- Suite complète : `npm run test` → 1354/1354 verts (22/08/2026, après
  `4cd3323`). L'utilitaire d'audit `lib/dev/__tmp-audit.test.ts` signalé en
  v1.1 a été supprimé depuis ; il n'y a plus d'échec connu.
- Chiffres du graphe régénérés le 22/08/2026 par BFS direct sur la sortie de
  `scannerUxJourney({ mode: "atomique" })` (138 nœuds / 436 arêtes,
  distances ci-dessus), dump temporaire exécuté puis retiré.
