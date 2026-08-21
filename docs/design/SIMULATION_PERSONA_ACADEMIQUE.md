# Simulation persona — étudiante académique multi-classes

**Version 1.0 — 21/08/2026. Simulation d'évaluation, aucune décision validée.**

Ce document simule le parcours complet d'une personne nouvelle utilisant le
produit pour un semestre académique, et évalue si la carte de navigation
(rail + surfaces) est optimisée pour ce parcours. Il ne tranche rien : chaque
écart remonté est une hypothèse à arbitrer, pas un chantier ouvert.

Méthode :

1. scénario formalisé en onze gestes (§2) ;
2. relecture du code pour chaque geste, avec références (§3) ;
3. lecture mécanique par les scanners de workflow existants
   (`workflow-scanner.ts`, `workflow-graphe.ts`) — graphe UX atomique :
   157 nœuds / 426 arêtes, tous atteignables depuis `/`, aucun puits
   (§4) ;
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
(`app/src/app/(app)/page.tsx:63`). Le tableau de bord reste vide tant que rien
n'existe — pas de grille de tirets.

### S1 — Déclaration d'intention → référentiel — ✅

`/demarrer` (`formulaire-amorcage.tsx`) propose deux modes (diagnostic guidé /
saisie directe), enregistre sujet + intention + préférences, puis ouvre la
modale référentiel qui fait proposer les branches par le tuteur
(`outilReferentielComplet`, `lib/tutor/outils.ts:212`). Rien n'est écrit avant
validation case par case ; les codes sont attribués par l'application
(`referentiel-compte.ts:15`).

### S2 — Trois classes distinctes — 🟡

Il n'existe aucune entité « classe ». Le proxy naturel est **un domaine par
classe**. Deux chemins :

- À l'amorçage, Léa peut l'écrire dans sa phrase (« mon semestre : macro,
  stats, dev web ») — le tuteur propose plusieurs branches en un geste.
  Sans domaine existant, pas de plafond (`outils.ts:949`).
- En cours de semestre, l'ajout passe par le `+` (intention genre
  `referentiel` → modale référentiel, confirmé par le graphe : seule arête
  entrante de `modal:referentiel` hors `/demarrer`). Plafond ADR-088 :
  2 nouveaux domaines maximum par proposition quand le compte en a déjà
  (`BRANCHES_MAX_COMPTE_ETABLI = 2`, `outils.ts:936`).

Frictions relevées :

- le formulaire d'amorçage dit « Le sujet à travailler » au **singulier**
  (`formulaire-amorcage.tsx:237`) : rien n'invite à décrire plusieurs cours ;
- rien n'affiche jamais « mes classes » : les domaines vivent dans l'Atelier,
  mêlés aux compétences ;
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
  concernée (`capture-intention.tsx:343` : `domaine: "transversal"`) — la
  relier aux compétences du cours est un geste manuel supplémentaire, sinon la
  fiche atterrit en zone « à trier » (`rangement-atelier.ts:19`) ;
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
La seule notion d'échéance du produit vit dans les objectifs court terme
(voir S7) et exige de cibler des compétences existantes
(`objectifs-actions.ts:106-108` : codes invalides silencieusement ignorés).
« Rendre un TP jeudi » n'a nulle part où se poser, et rien ne le rappellera.

### S6 — Exercices sur ce qu'une séance a couvert — ✅

Le point fort du produit. Compositeur de séance à deux décisions (thème +
temps, `concepteur-seance.tsx:3`), accessible à distance 2 du tableau de bord
(Cahier → Composer). Une fiche cours rattachée à des compétences alimente le
facteur « Observation documentaire contextualisée » du classement
(`recommend.ts:234`). Le bilan d'exercice dérive l'autonomie observée
(P8/ADR-057). La boucle génération → évaluation → adaptation tourne ici sans
accroc.

### S7 — Déclarer un examen daté — 🟡 capacité réelle mais invisible

Capacité cachée : si Léa écrit « partiel de stats le 15/12 » dans le `+`,
`extraireEcheanceBesoin` (`echeance-besoin.ts`) reconnaît « demain », « dans N
jours/semaines/mois », « le JJ/MM », et `enregistrerBesoinCourtTerme`
(`objectifs-actions.ts:96`) crée automatiquement un objectif court terme **par
compétence visée** plus un parcours actif — sans aucun formulaire.

Mais : aucun objet « examen » (la phrase devient N objectifs par compétence),
aucune liste où voir ses examens, et si la traduction du besoin ne cible
aucun code valide, l'échéance est perdue sans bruit (`objectifs-actions.ts:108`).

### S8 — Plan personnalisé date × compétences × classes — ❌

C'est l'écart central du scénario. L'échéance est stockée mais presque rien
ne la consomme :

- elle sert uniquement à **trier** les objectifs entre eux
  (`vues-twiny.ts:288`, `comparerObjectifs`) ;
- le résumé de pilotage qui la porterait, `resumerPilotageTwiny`
  (`vues-twiny.ts:242`), n'a **aucun consommateur** hors son propre test ;
- les facteurs du moteur (`recommend.ts:156-287`) ignorent la proximité
  d'échéance : « Importance pour l'objectif » existe, « l'examen approche »
  n'existe pas. À J-7 d'un partiel, la prochaine action proposée est calculée
  comme un jour ordinaire ;
- aucun plan dérivé (répartition par jour, couverture des compétences de la
  classe, priorisation par poids d'examen).

Le produit assume par ailleurs ne pas être « un outil de révision »
(PRODUCT.md §2) — cette position doit être arbitrée avant tout chantier ici.

### S9 — Entraînement ponctuel — ✅

Le meilleur flux de l'app : bouton `+` sur le tableau de bord (distance 1),
phrase libre, le tuteur choisit le genre (`intention.ts` : travail / projet /
note / référentiel / clarification), et « travail » ouvre directement le
compositeur pré-ciblé (`capture-intention.tsx:303-320`). Si le sujet
n'existe pas, bascule vers une proposition de branche. Exactement le geste
attendu.

### S10 — Arbitrage du tableau de bord — ✅ / 🟡

Une seule action prioritaire, pistes alternatives, contexte instant déclaré
(temps + capacité), reprise des travaux ouverts. La boucle tient. Réserve :
l'arbitre est aveugle à tout ce qui précède (S5, S7, S8) — il arbitre entre
compétences, pas entre engagements datés.

---

## 4. Lecture par le graphe de navigation

Dump généré par `_tmp-dump-graphes.test.ts` (scanners AST du dépôt) :

| Graphe | Nœuds | Arêtes | Atteignables | Inatteignables |
|---|---|---|---|---|
| Architecture (AST) | 66 | 256 | 65 | 1 (`/suspendu`, voulu) |
| UX macro | 11 | 17 | 11 | 0 |
| UX atomique | 157 | 426 | 157 | 0 |

Distances depuis le tableau de bord (`page:/`) vers les gestes du scénario :

| Geste | Distance | Chemin |
|---|---|---|
| Besoin ponctuel (S9) | 1 | `+` → modale « De quoi as-tu besoin ? » |
| Composer une séance (S6) | 2 | Cahier → « Composer une séance » |
| Fiche note (S3/S4) | 2 | Atelier → mode note |
| Téléversement PDF (S3/S4) | 3 | Atelier → workspace/espace doc → upload |
| Modale référentiel (S2, compte établi) | 2 | `+` → intention référentiel |

Aucun puits (nœud sans sortie) : la carte est un cycle propre, conforme à la
boucle. **Les défauts détectés ne sont donc pas des défauts de navigation —
ce sont des capacités manquantes ou invisibles**, sauf friction précise : le
rangement transversal des notes créées via le `+` (S3).

## 5. Scorecard

| # | Geste | Verdict | Cause racine |
|---|---|---|---|
| S0 | Arrivée | ✅ | — |
| S1 | Intention → référentiel | ✅ | — |
| S2 | Classes multiples | 🟡 | pas d'entité classe ; cadrage singulier à l'amorçage |
| S3 | PDF global de classe | 🟡 | mécanisme OK ; rangement transversal par défaut ; PDF non lu par la boucle |
| S4 | PDFs de séance hebdo | 🟡 | corpus plat, pas de regroupement classe → séances |
| S5 | Devoirs à rendre | ❌ | aucune surface ni entité |
| S6 | Exercices sur le cours | ✅ | cœur du produit, facteur documentaire branché |
| S7 | Examen daté | 🟡 | capacité réelle mais invisible, fragile, sans restitution |
| S8 | Plan avant examen | ❌ | échéance stockée, zéro consommateur moteur/UI |
| S9 | Ponctuel | ✅ | flux le mieux huilé |
| S10 | Arbitrage du jour | ✅ | aveugle aux échéances |

**Conclusion générale.** La carte est saine structurellement (cycle complet,
zéro cul-de-sac, distances courtes) mais elle est **optimisée pour le geste
d'apprentissage seul**. Le scénario académique échoue précisément là où le
produit doit retenir des **engagements datés** (devoirs, examens) : ces faits
déclarés n'ont ni accueil, ni rappel, ni effet sur la recommandation.

## 6. Écarts classés — hypothèses à arbitrer, pas des chantiers ouverts

Conformément à PRODUCT.md §7 et AGENTS.md : rien ici ne devient code sans
décision humaine, et la grille de §9 de CLAUDE.md s'applique à chacune.

1. **Échéances inutilisées (couvre S7/S8/S10).** Le plus proche d'exister :
   la donnée est déjà écrite (`echeanceLe`), il manque un consommateur — un
   facteur moteur « échéance proche », un affichage des objectifs actifs, ou
   les deux. Question préalable : cela contredit-il « pas un outil de
   révision » (PRODUCT.md §2) ? Hypothèse testable : une échéance visible
   change-t-elle l'acceptation des recommandations ?
2. **Rangement des notes créées par intention (couvre S3/S4).** Friction
   localisée et petite : naître transversal au lieu du domaine du besoin.
   Vérifier d'abord si le tuteur pourrait proposer le rattachement plutôt que
   le dériver.
3. **Regroupement par classe (couvre S2/S4).** Peut passer par des thèmes
   (déjà prévus pour traverser les domaines) plutôt qu'une nouvelle entité —
   ou ne pas être construit du tout tant qu'aucun compte tiers n'exprime le
   besoin (test de réfutation PRODUCT.md §4 : 10 preuves sans assistance).
4. **Devoirs à rendre (couvre S5).** Écart le plus large et le moins
   certain d'être souhaitable : un tracker de rendus ressemble à ce que le
   produit refuse d'être. Ne rien construire avant arbitrage explicite.

---

## Annexe — vérifications exécutées

- Suite complète : `npm run test` → 1236/1237 verts. Seul échec :
  `_tmp-dump-graphes.test.ts` (« dump »), utilitaire d'export JSON qui dépasse
  le `testTimeout` par défaut (5 s) en suite complète et passe isolé avec
  `--testTimeout=180000`. Non corrigé (périmètre évaluation) ; à ranger ou
  doter d'un timeout dédié lors d'un prochain passage.
- Distances et puits calculés par BFS sur le dump `uxAtomique`
  (fichier temporaire `graphes.json`, non versionné).
