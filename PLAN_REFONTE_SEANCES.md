# Plan de refonte — Séances, Tableau de bord, Compétences, Réglages

**Date :** 10/08/2026 · **Destinataires :** Cline (exécute les lots de surface), Claude Code (exécute les lots de cœur)
**Statut :** 🔬 plan validé en discussion, non encore implémenté. Aucune ligne de ce document n'est une décision d'architecture tant qu'elle n'est pas passée en ADR (voir §7).

---

## 0. Décisions actées

| # | Question | Décision |
|---|---|---|
| D1 | Ordre de traitement | **Le stock d'abord.** Le scoring passe en avant-dernier. |
| D2 | Entité séance | **Étendre `LearningSession`**, pas de nouvelle table. |
| D3 | Composition CAF à stock insuffisant | **Elle génère le manquant, l'utilisateur valide** avant écriture. |
| D4 | Navigation | **3 pôles** — Tableau de bord · Séances · Compétences — **+ carte Profil** au tableau de bord. |
| D5 | Pomodoro | **Outil de confort seul.** Aucun lien avec `attempts.duree_min`. |
| D6 | Besoin utilisateur | **Déclaration stockée verbatim + écart dérivé.** Aucun score de biais fabriqué. |
| D7 | Répartition | **Cline = surface** (écrans, navigation, suppressions, libellés) · **Claude Code = cœur** (`lib/domain`, `lib/engine`, `lib/store`, migrations, tests). |
| D8 | « auto-évaluation » | Renommé en « évaluation » **partout** : libellés, champ TS, colonne DB. |

---

## 1. Les faits qui commandent ce plan

Relevés dans Supabase le 10/08/2026 :

| | |
|---|---|
| Exercices | 23 (0 archivé) |
| Compétences actives | 77 (2 comptes : 39 + 38) |
| **Compétences couvertes par un exercice** | **11** (8 + 3) — **86 % à sec** |
| Tentatives | 47 · 40 terminées (18 réussi / 16 partiel / 6 échec) · 3 `en-cours` qui traînent · 4 abandons |
| Preuves | 50 |
| `sessions` | 46 lignes, dont **45 auto-générées** |

Trois conséquences directes :

**a) Le scoring n'est pas le goulot.** [`recommend.ts:118`](app/src/lib/engine/recommend.ts) donne jusqu'à **+70** au jamais-évalué (30 base + 30 palier + 10 rang) contre +40 « due pour révision » et **−15** « pratiquée récemment ». Le classement des compétences pousse déjà vers le non-couvert. Le défaut est en aval : [`choisirExercice`](app/src/lib/engine/recommend.ts) rend `null` pour 66 compétences sur 77, la carte bascule alors sur « Générer un exercice » ([`prochaine-action.tsx:146`](app/src/components/dashboard/prochaine-action.tsx)). Les seuls « Commencer » cliquables sont les 11 compétences couvertes — celles déjà travaillées. **L'impression rapportée est juste ; la cause supposée ne l'est pas.** Refondre la formule avant de remplir le corpus ne changerait rien à l'écran.

**b) La séance existe déjà.** `LearningSession` ([`types.ts:405`](app/src/lib/domain/types.ts)) est écrite automatiquement à chaque exercice terminé ([`actions.ts:198`](app/src/lib/store/actions.ts), `:260`, `:379`), avec un tableau `activites[]` qui n'en contient qu'une. Les 45 séances auto-générées sont donc déjà des séances mono-exercice, datées, avec durée, compétence et résultat. Une séance CAF, c'est la même entité avec *N* activités et un état `planifiee`. **Aucune reprise de données, aucune table neuve.**

**c) Deux des trois modèles du CAF sont déjà là.** Conceptual Assessment Framework (Mislevy) :

| Modèle CAF | Dans ce dépôt | État |
|---|---|---|
| **Student model** — ce qu'on croit savoir de la personne | `SkillState` (niveau, confiance, robustesse, `contextesTestes`) | ✅ existe |
| **Evidence model** — ce qui compte comme preuve | `criteres`, `Dimension`, `lib/engine/preuve.ts`, `maitrise.ts` | ✅ existe |
| **Task model** — ce qu'est une tâche | `Exercise` (type, difficulté, compétences, durée) | ✅ existe |
| **Assembly model** — quelles tâches assembler, en quelle quantité | *rien* | ❌ **c'est le seul manquant** |

Le lot 1 n'ajoute donc qu'une pièce : `lib/engine/caf.ts`. Le reste du CAF est déjà en production sous d'autres noms.

**Point de vigilance à traiter en passant :** 3 tentatives sont en statut `en-cours` depuis des jours. Le tableau de bord les signale déjà ([`page.tsx:117`](app/src/app/(app)/page.tsx)), mais rien ne permet de les clore autrement qu'en les rouvrant. `abandonnerExercice` existe (ADR-040) — l'exposer depuis le bandeau est un ajout d'une ligne.

---

## 2. Ce qui ne bouge pas

Garde-fous à ne franchir sous aucun prétexte pendant cette refonte :

- **Le process d'exercice à l'unité est intact.** Seul le vocabulaire change (D8). `terminerExercice`, `abandonnerExercice`, `reponseSuffisante`, `motifRefusExercice`, `tentativeMenee` : aucune signature, aucun seuil.
- **Ne pas toucher `lib/engine/spaced.ts`.** Supprimer le widget « À réviser » ≠ supprimer la répétition espacée : `estDue` pondère le scoring ([`recommend.ts:146`](app/src/lib/engine/recommend.ts)) et `prochaineRevision` alimente l'étiquette « Révision due » ([`prochaine-action.tsx:78`](app/src/components/dashboard/prochaine-action.tsx)).
- **Ne pas déplacer `FRACTION_NON_TENTEE` ni `FRACTION_TROP_FACILE`** (ADR-028/045). Aucune donnée nouvelle ne les met en cause.
- **Les bornes de `difficulte` et `dureeEstimeeMin` restent dans `lib/domain/exercice.ts`** (ADR-045). Le blueprint CAF les lit, il n'en repose pas.
- **Le tuteur n'écrit aucune mesure** (ADR-037). Il rédige des énoncés. Le besoin déclaré est saisi par l'utilisateur, jamais rédigé par le modèle.
- **Aucun code de compétence frappé par le tuteur** (ADR-043). La génération en lot passe par les schémas existants.
- **`motifRefusExercice` reste l'unique validation** d'un contenu d'exercice (ADR-047). La génération de séance l'appelle, elle n'en recopie pas la règle.
- **Toute clé de stockage navigateur passe par `cleParCompte`** — y compris l'état du pomodoro et le brouillon de blueprint.
- **Pas de nouvelle dépendance** sans validation explicite. Le pomodoro s'écrit à la main, comme les graphiques SVG.

---

## 3. Lots, dans l'ordre

### Lot 0 — Suppressions et vocabulaire · **Cline** · aucune dépendance

Objectif : retirer ce qui ne sert pas, avant d'ajouter.

**0.1 — Supprimer le widget « À réviser »**
- Supprimer le fichier `app/src/components/dashboard/revisions-dues.tsx`.
- Retirer l'import [`page.tsx:15`](app/src/app/(app)/page.tsx) et le bloc `<RevisionsDues …>` `:162-169`, commentaire compris.
- ⚠️ **Ne pas toucher `lib/engine/spaced.ts`** (voir §2).

**0.2 — Supprimer « + Compétence » de la carte de domaine**
- Retirer le bloc `<BoutonAjouterCompetence …>` [`competences/page.tsx:274-279`](app/src/app/(app)/competences/page.tsx) et l'import `:17`.
- Le composant `app/src/components/referentiel/bouton-ajouter.tsx` devient orphelin (aucun autre appelant) : **le supprimer aussi**. L'ajout d'une compétence reste possible par « Réviser avec le tuteur » sur `/competences/domaine/[id]`, déjà en place, et par « Créer un référentiel » en tête de page.

**0.3 — Supprimer le lien « Référentiel » des réglages**
- Retirer le `<Link href="/competences">Référentiel</Link>` [`compte.tsx:254-260`](app/src/components/layout/compte.tsx). Le lien « Formation, objectifs et préférences » reste (il sera retravaillé au lot 4).

**0.4 — ✅ FAIT au lot 1, ne rien reprendre ici**

Le renommage « auto-évaluation » → « évaluation » a été exécuté **en entier** au
lot 1 (libellés, champ TypeScript, colonne DB), et non scindé comme prévu : le
mapping `versColonne` n'a pas de table d'exceptions, donc le champ et la colonne
devaient bouger ensemble — et laisser les libellés en arrière aurait produit un
vocabulaire renommé à moitié. Le conflit annoncé sur `exercices/[id]/page.tsx`
est ainsi évité plutôt que coordonné.

**Critères d'acceptation :** `cd app && npm run verify` vert. Le tableau de bord ne montre plus « À réviser ». Aucune occurrence de « auto-évaluation » dans du texte affiché.

---

### Lot 1 — La séance dans le domaine · **Claude Code** · ✅ FAIT le 10/08/2026

> Branche `lot1-seance-domaine`. `npm run verify` vert — 611 tests, 26 fichiers.
> Livré : `lib/domain/seance.ts`, `lib/engine/caf.ts`,
> `lib/store/seance-actions.ts`, les quatre champs sur `LearningSession`, le
> renommage complet `evaluation`, `supabase/migration-seances.sql`, ADR-048 à
> 050. **La migration reste à appliquer** — voir CLAUDE.md §4, le §2 est un
> RENAME qui doit partir avec le déploiement.
>
> **Trois écarts au plan, tous documentés** :
> 1. le 0.4 de Cline a été absorbé ici (voir ci-dessus) ;
> 2. `EXERCICES_PAR_LOT_MAX` a été remonté de `exercices/page.tsx` vers
>    `lib/domain/exercice.ts` — la séance bute sur la même borne, deux copies
>    auraient divergé. La page importe désormais la constante (2 lignes) ;
> 3. un défaut que le lot introduisait a été corrigé dans la foulée : une séance
>    planifiée comptait comme activité mesurée. `seanceALieu` filtre
>    `calculerActivite`, `activiteSurFenetre` et `panneau-journal.tsx`. Ce
>    dernier est un fichier de Cline — c'était moins cher que la régression.

Objectif : poser l'entité, le modèle d'assemblage CAF et la migration. Aucun écran.

**1.1 — Étendre `LearningSession`** ([`types.ts:405`](app/src/lib/domain/types.ts))

Champs ajoutés, tous optionnels pour que les 46 lignes existantes restent valides :

```ts
/** État de la séance. Absent = séance auto-générée historique, donc terminée. */
statut?: "planifiee" | "en-cours" | "terminee";
/** Date/heure prévue (ISO). Absente pour une séance non planifiée. */
planifieePour?: string;
/** Ce que la personne a DÉCLARÉ vouloir, avant la séance. Fait daté, jamais dérivé. */
besoinDeclare?: BesoinDeclare;
/** Le cahier des charges qui a produit la composition. Traçabilité (P3). */
blueprint?: BlueprintSeance;
```

**1.2 — `lib/domain/seance.ts`** (pur, testé)

```ts
export interface BesoinDeclare {
  /** Saisi par la personne, verbatim. Jamais rédigé par le tuteur. */
  intention: string;
  /** Codes que la personne dit vouloir travailler. Peut diverger du blueprint. */
  codesVises: string[];
  /** Minutes disponibles, déclarées. */
  tempsDisponibleMin: number;
  /** Date de la déclaration (ISO). C'est ce qui en fait un fait observé. */
  declareLe: string;
}

export interface BlueprintSeance {
  dureeCibleMin: number;
  nombreExercices: number;
  /** Transverse = plusieurs domaines ; sinon, le domaine unique visé. */
  portee: { type: "mono"; domaine: string } | { type: "transverse"; domaines: string[] };
  /** Codes retenus par l'assemblage, avec la raison de chacun. */
  cibles: { code: string; difficulte: Difficulte; raison: string }[];
}
```

Plus les fonctions pures : `motifRefusBlueprint` (bornes, cohérence durée/nombre), `ecartBesoinRealise(besoin, seance, tentatives)` → écart **dérivé**, jamais stocké.

⚠️ **`ecartBesoinRealise` ne produit aucun score.** Elle rend des faits comparés : codes déclarés vs codes réellement travaillés, temps déclaré vs temps réellement passé, avec les deux valeurs et leurs dates. L'interprétation (« tu surestimes ton temps ») est une phrase construite à partir de ces faits, avec sa source affichée — jamais un indice agrégé (D6, P3).

**1.3 — `lib/engine/caf.ts`** (pur, testé) — l'assembly model

```ts
composerSeance(
  blueprint: BlueprintSeance,
  etats: SkillState[],
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
  calibrations: Map<string, Calibration>,
): { activites: ActiviteSeance[]; manquants: Manquant[]; explication: string[] }
```

Règles :
- **Réutilise le classement de `recommander()`**, ne le recopie pas. Un second classement divergerait en silence.
- **Réutilise `recommandable()`** pour l'éligibilité d'un exercice existant.
- Chaque activité retenue porte sa raison (P3).
- Un `Manquant` = `{ code, difficulteCible, raison }` : une compétence retenue par l'assemblage pour laquelle aucun exercice éligible n'existe. **C'est la liste que le lot 2 envoie à la génération.**
- Si le blueprint demande plus que ce qui est composable, la fonction **le dit** dans `explication` et rend moins d'activités. Elle ne complète jamais avec un remplissage arbitraire.
- Aucune écriture, aucune horloge lue : `now` en paramètre, comme `recommander`.

**1.4 — Renommage `autoEvaluation` → `evaluation`**

Le seul changement non additif du plan. Champ TS + colonne, dans le même geste, sinon `versColonne` casse.
- `types.ts:329`, `actions.ts:65,100,188,241`, `calibration.ts:354`, `formulaire-bilan.tsx:124-135`, `seed/exercises.ts:1111`, et les tests correspondants.
- Migration : `ALTER TABLE attempts RENAME COLUMN auto_evaluation TO evaluation;` sous garde d'existence (§4).
- Mettre à jour aussi les commentaires qui disent « auto-évaluation » dans `lib/` (contexte.ts:518, bilan.ts:27, types.ts:290,328, calibration.ts:8,15,339,500, actions.ts:116,145,334) : le vocabulaire du code doit suivre celui du produit.

**1.5 — Écritures** — `lib/store/seance-actions.ts` (`server-only`)
`planifierSeance`, `demarrerSeance`, `terminerSeance`, `annulerSeance`. Une séance planifiée qu'on démarre passe `en-cours` ; les tentatives d'exercice restent gouvernées par le chemin unitaire existant, inchangé.

⚠️ **Ne pas dupliquer l'écriture auto de séance.** `actions.ts:198/260/379` écrit déjà une séance à chaque exercice terminé. Si l'exercice appartient à une séance en cours, il doit **s'y rattacher** au lieu d'en créer une nouvelle — sinon un exercice de séance produira deux lignes. Un test doit lier les deux chemins, comme `tentativeMenee` (ADR-030).

**Critères d'acceptation :** tests écrits en même temps que le code (règle CLAUDE.md §10). `npm run verify` vert. Migration appliquée et vérifiée en base.

---

### Lot 2 — Planificateur et déroulé de séance · **Cline, complété par Claude Code** · ✅ FAIT le 10/08/2026

> Livré par Cline : `components/seances/concepteur-seance.tsx` (3 étapes
> conformes au plan), `app/seances/[id]/page.tsx` (déroulé + écart
> besoin/réalisé), `demarrerSeance`/`terminerSeance`/`annulerSeance` câblées en
> Server Actions, `abandonnerExercice` exposé au bandeau du tableau de bord
> (2.4), export `.ics` pur (`lib/engine/ics.ts`).
>
> **Un manque trouvé et corrigé** : le concepteur n'était monté que sous
> `/seances`. La demande explicite de Maxime — « je veux un bouton sur le
> tableau de bord qui ouvre un formulaire » — n'était pas satisfaite : ouvrir
> `/seances` puis cliquer un bouton n'est pas la même chose qu'un bouton *sur*
> le tableau de bord. `ConcepteurSeance` est maintenant aussi monté sur `/`
> ([`page.tsx`](app/src/app/(app)/page.tsx)), avec les mêmes données que
> `/seances` — aucune logique recopiée, un second point de montage du même
> composant.
>
> **Deux corrections mineures** : (a) le nombre d'exercices restait à `3` par
> défaut au lieu de suivre `nombreExercicesConseille` — il s'applique
> maintenant au passage vers l'étape de composition, sauf si la personne l'a
> déjà modifié à la main ou si un preset (« Refaire cette séance ») impose le
> sien ; (b) un avertissement ESLint (`demande` recréé à chaque rendu, cassant
> la mémoïsation de `composerSeance`) — corrigé en construisant `demande` à
> l'intérieur du `useMemo`.

Objectif : les écrans qui pilotent une séance. Toute la logique vient du lot 1 ; ce lot ne calcule rien.

**2.1 — Concepteur de séance** — un bouton au tableau de bord ouvre une modale en 3 temps :

1. **Besoin déclaré** — quatre champs, et rien de plus :
   - *intention* libre (`INTENTION_MAX` = 500) ;
   - *temps disponible* en minutes (5 à `TEMPS_DECLARE_MAX` = 480) ;
   - *compétences visées* — pré-cochées depuis `ctx.recommandations`, modifiables ;
   - *date/heure prévue*, facultative (vide = « pour maintenant »).

   Validation par `motifRefusBesoin` — la même fonction que le serveur, jamais une copie.

   **Le nombre d'exercices est dérivé du temps, affiché et modifiable.**
   `nombreExercicesConseille(temps, exercices, tentatives)` rend
   `{ nombre, reference, explication }`. **Afficher l'explication à côté du
   champ** : c'est le « Pourquoi ? » du nombre (P3), et elle dit laquelle des
   deux sources a servi — durées observées, ou estimations du corpus.
   ⚠️ Elle rend `null` quand il n'y a ni tentative menée ni corpus : le champ
   est alors vide et l'utilisateur saisit lui-même. Ne pas y mettre un 3 par
   défaut.

2. **Blueprint proposé** — `composerSeance` rend `activites`, `manquants`,
   `dureeEstimeeTotaleMin` et `explication`. Chaque ligne porte sa raison ;
   afficher `explication` en entier, elle dit ce qui n'a pas pu être fait.
   L'utilisateur retire ou remplace. Le blueprint rendu passe déjà
   `motifRefusBlueprint` — un test le vérifie.

3. **Manquants** — bouton unique « Générer les *N* exercices manquants ».
   Réutilise `/api/exercices/generer` et `BoutonGenerer`, avec le `code` et la
   `difficulteCible` de chaque manquant. Les énoncés s'affichent pour relecture ;
   **rien n'est écrit avant validation** (D3, ADR-037). Puis `planifierSeance`.

**2.2 — Planification** — date/heure optionnelle. Une séance planifiée apparaît au tableau de bord. **Pas d'intégration calendrier dans ce lot** : export `.ics` au plus, et seulement s'il tient en une fonction pure.

**2.3 — Déroulé** — enchaîne les activités. Chaque exercice ouvre l'écran unitaire existant, **sans modification du process** ; au retour, la séance avance d'un cran. Le bilan de séance affiche l'écart besoin/réalisé (`ecartBesoinRealise`), avec les deux valeurs et leurs sources.

**2.4 — Clore une tentative qui traîne** — exposer `abandonnerExercice` depuis le bandeau « exercices en cours » ([`page.tsx:117`](app/src/app/(app)/page.tsx)). 3 tentatives sont concernées aujourd'hui.

**Critères d'acceptation :** une séance de 3 exercices transverses se compose, se planifie, se déroule et se clôt. Aucun exercice de séance ne produit deux lignes dans `sessions`.

---

### Lot 3 — L'onglet Séances · **Cline** · ✅ FAIT le 10/08/2026

> Les quatre vues, les trois redirections, `/competences` allégée, navigation
> à 3 pôles renommée — tout conforme au plan. Voir [ADR-053](ARCHITECTURE_DECISIONS.md#adr-053)
> pour la décision, et sa note de numérotation (le code citait un ADR-051 qui
> appartient à un autre sujet — corrigé).

**3.1 — `/exercices` → `/seances`.** Nouvelle route, ancienne conservée en redirection (même geste que `/progression` et `/journal` aujourd'hui).

**3.2 — Quatre vues** dans un `SelecteurSegmente`, le composant utilisé aujourd'hui par `/competences` :
- **Historique** — les séances, de la plus récente à la plus ancienne. Les 45 séances auto-générées y apparaissent comme séances à 1 exercice. Chaque séance : date, durée, compétences, résultats, **et « Refaire cette séance »** (recompose un blueprint identique).
- **Progression** — `PanneauProgression`, déplacé tel quel depuis `/competences`.
- **Journal** — `PanneauJournal`, déplacé tel quel.
- **Bibliothèque** — la liste d'exercices actuelle, allégée : le regroupement par domaine, « Acquis », « Archivés », le retrait, l'édition, le panneau « compétences sans exercice ». **Le sélecteur de statut disparaît** (le pilotage n'est plus ici) et aucun filtre ne le remplace (interdit CLAUDE.md §8).

**3.3 — Retirer de `/competences`** le `SelecteurSegmente` et les vues `progression`/`journal` ([`competences/page.tsx:30-36,134-140`](app/src/app/(app)/competences/page.tsx)). Retargeter les redirections `/progression` et `/journal` vers `/seances?vue=…`.

**3.4 — Navigation** ([`navigation.ts`](app/src/components/layout/navigation.ts)) : `Piloter → Tableau de bord` · `Travailler → Séances` · `Suivre → Compétences`. Mettre à jour le JSDoc — il décrit l'ancienne répartition, et ce fichier a déjà divergé une fois de sa propre documentation.

**Critères d'acceptation :** aucun lien mort. `/exercices`, `/progression`, `/journal` redirigent. `/competences` n'affiche plus que les domaines.

---

### Lot 4 — Pomodoro et carte Profil · **Cline (4.2, 4.3), Claude Code (4.1)** · ✅ FAIT le 10/08/2026

> **4.2 et 4.3 par Cline** : `CarteProfil` écrite conforme au plan — mais
> **jamais montée nulle part**, ni au tableau de bord ni ailleurs (composant
> mort). Corrigé : montée sur `/` avec `ctx.donnees.user`.
>
> **4.1 par Claude Code**, absent du travail de Cline. `components/dashboard/pomodoro.tsx` :
> minuteur focus/pause (25/5), état en `sessionStorage` via `cleParCompte`,
> lu dans un initialiseur paresseux derrière `useEstHydrate`. Un premier jet
> appelait `setState` en corps d'effet pour la bascule focus↔pause à zéro —
> `react-hooks/set-state-in-effect` l'a détecté (`npm run verify` est passé du
> rouge au vert seulement après correction) ; la bascule vit maintenant dans le
> callback du `setInterval`, pas dans le corps de l'effet.
> ⚠️ **Aucun lien avec `attempts.duree_min`** (D5) : vérifié, aucune écriture,
> aucun calcul ne le lit.

**4.1 — Pomodoro.** Composant client au tableau de bord. Écrit à la main, aucune dépendance. État persisté via `cleParCompte` ([`lib/ui/stockage-session.ts`](app/src/lib/ui/stockage-session.ts)), lu dans un **initialiseur paresseux** derrière `useEstHydrate`, jamais dans un `useEffect`.
⚠️ **Aucun lien avec `attempts.duree_min`** (D5). Le pomodoro ne pré-remplit rien, n'écrit rien en base, et n'apparaît dans aucun calcul. C'est un minuteur.

**4.2 — Carte Profil au tableau de bord.** Ce que le profil déclaré contient, ce qui manque, lien direct vers `/profil`. Pas de nouvelle entrée de navigation (D4).

**4.3 — Réglages.** Le lien « Formation, objectifs et préférences » reste dans la modale mais cesse d'être le seul chemin.

---

### Lot 5 — Scoring de la prochaine action · **Claude Code** · ✅ FAIT le 10/08/2026

> `BONUS_ACTIONNABLE = 10` (5.1) et `recommandable()` unifiée échec/partiel
> (5.2), tous deux vérifiés sur les cas réels observés en base (deux
> exercices diagnostics « tournaient en rond » sur des partiels répétés). Voir
> [ADR-054](ARCHITECTURE_DECISIONS.md#adr-054) pour le détail et les deux tests
> qui protègent le bonus contre un renversement d'écart réel.
>
> **5.3 explicitement non fait** — le plan le disait déjà : « à trancher sur
> données, pas avant ». Aucune séance composée n'a encore tourné en
> production ; le implémenter maintenant aurait été construire par
> anticipation (CLAUDE.md §8). Le test de réfutation à surveiller est dans
> l'ADR.
>
> `npm run verify` vert — 629 tests.

Trois corrections, dans `lib/engine/recommend.ts`, chacune avec son test :

**5.1 — L'actionnabilité entre au score.** Une compétence sans exercice éligible ne peut pas occuper le rang 1 si une compétence actionnable est proche. Le repli « Générer » reste offert, mais cesse d'être la face par défaut de la carte centrale.
⚠️ Ce n'est pas une pénalité sur le non-couvert — ce serait l'inverse du besoin. C'est un **départage** : à écart de score réduit, l'actionnable passe devant.

**5.2 — Un `partiel` ne revient pas indéfiniment.** Aujourd'hui [`recommandable()`](app/src/lib/engine/recommend.ts) le laisse candidat sans condition (16 partiels sur 40 tentatives). Comme pour l'échec — P4 lu à l'envers, cf. le JSDoc de `recommandable()` — la reproposition doit tenir à une **condition**, pas à un délai.

**5.3 — Relire les facteurs à la lumière des séances.** Une séance introduit une notion que le scoring ignore : une compétence peut avoir été travaillée *dans* une séance transverse sans être la cible. À trancher sur données, pas avant.

⚠️ **Aucun seuil de `calibration.ts` ne bouge dans ce lot** (ADR-028/045).

---

### Lot 6 — Recalibrage de la page Compétences · **Claude Code + Cline** · ❓ ÉVALUÉ le 10/08/2026, pas de travail à mener pour l'instant

> **Ce qui a été vérifié, pas supposé.**
>
> 1. **Dépendance scoring** — `Compétences` et sa sous-page domaine affichent un
>    « Score moyen » et un radar dérivés de `SkillState.score` (niveau/maîtrise,
>    `lib/engine/maitrise.ts`). Ce n'est **pas** la `valeur` de `recommander()`
>    que le lot 5 a modifiée — les deux sont des scores différents qui ne se
>    croisent nulle part dans ce fichier. **Conclusion : rien à recalibrer ici,
>    le lot 5 ne touche pas cette page.** Vérifié en lisant le code, pas deviné.
> 2. **Dépendance séances CAF** — `migration-seances.sql` n'est pas encore
>    appliquée en base (voir CLAUDE.md §4) : **zéro séance composée existe en
>    production**. Recalibrer l'affichage d'une page contre un usage qui n'a
>    pas encore eu lieu serait construire par anticipation (CLAUDE.md §8) —
>    précisément l'erreur que ce chantier corrige ailleurs (referentiel avant
>    contenu, 6 entités mortes du 28/07).
>
> **Le seul item concret du brief initial pour cette page**
> (« Supprimer le bouton + compétence intégré à chaque compétence ») **était
> déjà fait au lot 0** (0.2, Cline) — `BoutonAjouterCompetence` retiré de la
> carte de domaine et le composant supprimé.
>
> **Conclusion : il n'y a aujourd'hui aucun travail justifié par des données
> réelles à mener sur cette page.** La forcer maintenant produirait une
> refonte sans matière à recalibrer contre — le défaut inverse de celui que ce
> lot devait corriger. Statut ❓ et non 🗑️ : la question reste ouverte, elle
> attend un signal, pas un abandon.
>
> **Qui doit trancher, et ce qui débloque.** Maxime, une fois que des séances
> composées auront réellement tourné (migration appliquée + quelques séances
> jouées) : c'est alors, et alors seulement, qu'on saura si la page Compétences
> a besoin de refléter un historique de séances plutôt que le seul flux de
> preuves qu'elle montre aujourd'hui.

Une fois le scoring et les séances en place : revoir ce que la page affiche et comment elle l'agrège. À spécifier à ce moment-là, sur ce que les données diront — pas maintenant.

---

## 4. Migration

Fichier : `app/supabase/migration-seances.sql`. Additif et idempotent **sauf le renommage 1.4**, qui est un `RENAME` sous garde (préserve les données, ne se rejoue pas).

À ajouter aux mêmes définitions dans `schema.sql` pour une installation neuve.

Contenu attendu :
- `sessions.statut TEXT` avec `CHECK (statut IN ('planifiee','en-cours','terminee'))`, nullable.
- `sessions.planifiee_pour TEXT`, nullable.
- `sessions.besoin_declare JSONB`, nullable.
- `sessions.blueprint JSONB`, nullable.
- `ALTER TABLE attempts RENAME COLUMN auto_evaluation TO evaluation` — dans un `DO $$ … $$` qui vérifie d'abord que `auto_evaluation` existe et que `evaluation` n'existe pas.

⚠️ **Aucun `DROP`.** Les 46 séances existantes doivent rester lisibles avec `statut` à `NULL` (= terminée, historique).

**Note sur la documentation :** `CLAUDE.md` §4 annonce `migration-verdict.sql` et `migration-exercice-edition.sql` comme « À APPLIQUER ». Vérification en base le 10/08/2026 : `attempts.verdict_tuteur` et `exercises.modifie_le` **sont présentes**. Les deux migrations sont appliquées ; la documentation est périmée et doit être corrigée dans le même geste.

---

## 5. Ce qui est explicitement hors périmètre

- **Intégration Google Calendar.** OAuth, RGPD, périmètre. `.ics` au plus (2.2).
- **Score de biais utilisateur.** Écart dérivé et affiché avec ses sources, jamais un indice (D6).
- **Filtres dans la bibliothèque.** Interdit CLAUDE.md §8, et le stock ne le justifie toujours pas.
- **Toucher aux seuils de `calibration.ts`.** ADR-028/045.
- **Widget de TODOs dev.** ADR-019.

---

## 6. Ordre d'exécution et points de synchronisation

```
Lot 0 ✅ (Cline)  ──────────────┐
                                ├──► Lot 2 ✅ ──► Lot 3 ✅ ──► Lot 4 ✅
Lot 1 ✅ (Claude Code) ─────────┘                    │
                                                     ▼
                                         Lot 5 (Claude Code) ──► Lot 6
```

Lots 0 à 4 terminés le 10/08/2026. Reste : lot 5 (scoring), lot 6 (recalibrage
Compétences), et l'application de `migration-seances.sql` +
`migration-intention-exercice.sql` avant la prochaine mise en ligne.

- Les lots 0 et 1 sont **parallélisables** : ils ne touchent aucun fichier commun. Vérifier tout de même que 0.4 (libellés) et 1.4 (champ + colonne) n'entrent pas en conflit dans `exercices/[id]/page.tsx` — coordonner ou séquencer.
- **Une branche par lot**, merge dans `master` après `cd app && npm run verify` vert.
- **Vérifier `git log -1 --format="%an <%ae>"` avant tout push** : Vercel refuse les déploiements dont l'auteur n'est pas membre de l'équipe.

---

## 7. ADR à écrire

Aucune de ces décisions n'est ✅ tant qu'elle n'est pas consignée et validée humainement :

| ADR | Sujet | État |
|---|---|---|
| ADR-048 | La séance comme extension de `LearningSession` ; les 45 séances mono-exercice rétroactives | ✅ écrite |
| ADR-049 | Le modèle d'assemblage CAF ; pourquoi seul l'assembly model manquait | ✅ écrite |
| ADR-050 | Le besoin déclaré : fait stocké verbatim, écart dérivé, refus d'un score de biais | ✅ écrite |
| ~~ADR-051~~ | ~~Séparation pilotage / analyse~~ — **numéro déjà pris**, voir note ci-dessous | — |
| ADR-053 | Séparation pilotage (tableau de bord) / analyse (séances) ; navigation à 3 pôles | ✅ écrite |
| ADR-054 | Actionnabilité et fin de la reproposition indéfinie des partiels (lot 5) | ✅ écrite |

⚠️ **051 et 052 étaient réservées à ce plan mais ont été prises par deux ADR
sans rapport**, écrites en parallèle du lot 1/2 sur un autre fil de discussion
(« Le moteur travaille sur `importance`… » et « Le moteur dérive sans
validation… »). Le sujet « séparation pilotage/analyse » a donc été écrit sous
**ADR-053**, et six citations dans le code qui disaient « ADR-051 »
(`navigation.ts`, les trois redirections, `ics.ts`) ont été corrigées vers ce
numéro. La leçon : **vérifier le tableau d'index avant de citer un numéro
d'ADR dans un commentaire de code**, surtout quand plusieurs sessions
travaillent le même dépôt — une citation qui pointe vers la mauvaise entrée
est pire qu'absente.

Statuts : ✅ décision tranchée · 🔬 hypothèse non vérifiée · ❓ question ouverte · 🗑️ abandonnée.
