# Spécification technique — intégration de `synthese_profil_competences_2026-07-25.md`

**Destinataire :** Claude Code, exécutant dans le dépôt `Système pédagogique/app`
(branche `feat/mvp-suivi-longitudinal`).
**Auteur de la spec :** session Cowork, 25/07/2026.
**Objectif :** faire entrer les preuves observées dans la synthèse dans le
système de preuves de l'application (`data/store/`), sans violer le principe
« rien de dérivable n'est stocké » ni le garde-fou « le tuteur n'a aucun accès
en écriture au profil ».

Cette spec ne modifie rien elle-même. Elle décrit précisément quoi écrire et
où, avec les points qui demandent un arbitrage humain avant merge.

---

## 0. Constat de départ

- `data/store/` est actuellement vide (`storeEstInitialise()` → `false`). Aucun
  événement n'existe encore.
- Le référentiel (`src/lib/domain/referentiel.ts`) contient 39 compétences
  fixes, codées en dur. **4 des 7 compétences observées dans la synthèse (C1,
  C4, C5, C6) n'ont pas d'équivalent exact dans ce référentiel.**
- `SkillEvidence.niveauPreuve` n'accepte que `"A"` ou `"B"` (le moteur rejette
  C/D). Toutes les preuves de la synthèse sont de niveau A (observation
  directe) — aucun blocage ici.
- La synthèse ne donne pas de dates précises par exercice (seulement la date
  de synthèse, 25/07/2026, et une séquence « Niveau 1 clos → Niveau 2 clos →
  Niveau 3 démarré »). **Les dates ci-dessous sont donc une approximation à
  la date de synthèse, pas des dates d'observation réelles** — à corriger si
  les dates exactes sont récupérables (historique de conversation source).

---

## 1. Décision à prendre avant d'exécuter

Deux options pour C1/C4/C5/C6, à trancher par l'utilisateur ou par toi si le
contexte le permet clairement :

**Option A (recommandée dans cette spec) — étendre le référentiel.**
Ajouter 4 compétences (`LOG-07`, `LOG-08`, `LOG-09`, `STAT-07`) à `SKILLS[]`.
Avantage : chaque preuve va sur la compétence qu'elle démontre réellement,
sans forcer une correspondance approximative. Inconvénient : modification de
code applicatif (pas juste de données), et `39 compétences` devient
`43 compétences` — il faut corriger ce chiffre partout où il apparaît en dur
(commentaire en tête de `referentiel.ts`, `README.md`).

**Option B (plus conservatrice) — ne rien ajouter au référentiel.**
Rattacher C1 à `SYSC-01`, C4 à `LOG-02` (deuxième preuve), C5 à `LOG-02`
(deuxième preuve), C6 à `STAT-02` (deuxième preuve). Avantage : zéro
modification de code. Inconvénient : les intitulés existants de ces
compétences ne correspondent pas exactement à ce qui a été observé (perte de
précision), et deux preuves de contextes proches sur le même code peuvent
artificiellement rapprocher un niveau 4 (le moteur exige 2 contextes
distincts, §4 — à vérifier que ça ne produit pas un niveau non mérité).

La suite de cette spec détaille l'option A. Si l'option B est retenue, sauter
la section 2 et rattacher les preuves de la section 3 aux codes existants
indiqués ci-dessus.

---

## 2. Option A — extension du référentiel (`referentiel.ts`)

### 2.1 Domaine LOGISTIQUE — insérer après `LOG-06`, avant le bloc PRODUCTION

```ts
{
  code: "LOG-07",
  domaine: "logistique",
  intitule:
    "Identifier et typer les sources d'incertitude d'un système de production (demande, capacité/process, approvisionnement), y compris les données de référence supposées fiables à tort",
  palier: "fondamentaux",
  prerequis: [],
  importance: 0.85, // estimation — à recalibrer sur l'ordre réel de priorité, pas une donnée dérivée d'un plan existant
},
{
  code: "LOG-08",
  domaine: "logistique",
  intitule:
    "Analyser l'arbitrage économique entre taux de service visé et stock de sécurité, et situer le modèle adapté (Wilson/EOQ en avenir certain vs newsvendor en avenir incertain)",
  palier: "avance",
  prerequis: ["LOG-02"],
  importance: 0.8, // estimation, idem
},
{
  code: "LOG-09",
  domaine: "logistique",
  intitule:
    "Calculer un stock de sécurité sous incertitude combinée (variabilité de la demande ET du délai fournisseur)",
  palier: "avance",
  prerequis: ["LOG-02"],
  importance: 0.85, // estimation, idem
},
```

### 2.2 Domaine STATISTIQUES — insérer après `STAT-06`, avant le bloc LOGISTIQUE

```ts
{
  code: "STAT-07",
  domaine: "statistiques",
  intitule:
    "Relier le z-score de la loi normale centrée réduite (z = (X−μ)/σ) à une application concrète de gestion industrielle (ex. stock de sécurité)",
  palier: "intermediaire",
  prerequis: ["STAT-02"],
  importance: 0.9, // priorité #1 explicite de la synthèse (lacune reconnue par l'utilisateur)
},
```

### 2.3 Cohérence à corriger ailleurs dans le dépôt

- `referentiel.ts`, commentaire d'en-tête : « 39 compétences, 7 domaines » →
  « 43 compétences, 7 domaines ».
- `README.md` (racine `app/`) si le nombre y est répété.
- `data/01_profil/01_MATRICE_COMPETENCES.txt` : ces fichiers texte sont la
  source documentée dont `referentiel.ts` dit être la « transcription
  fidèle ». Pour qu'ils restent cohérents avec le code (même si l'app ne les
  relit plus au runtime), ajouter les 4 nouvelles entrées au même endroit que
  dans la matrice, avec la mention « Ajouté le 25/07/2026, cf. section 7 —
  élargissement justifié par l'observation ; source :
  synthese_profil_competences_2026-07-25.md ».
- Lancer `npm run verify` après modification : si un test asserte
  `SKILLS.length === 39` (à vérifier dans `src/lib/engine/*.test.ts`), le
  mettre à jour à 43 avec la même justification en commentaire.

---

## 3. Preuves à ajouter (`data/store/evidence.json`)

Créer le fichier (actuellement absent → collection vide) avec un tableau de
7 objets `SkillEvidence`. Générer les `id` avec `nouvelId("ev")` (voir
`lib/store/db.ts`) plutôt que les inventer à la main. Utiliser de préférence
`ajouter("evidence", …)` (Server Function existante) plutôt qu'une écriture
directe, pour rester dans le chemin de code déjà testé.

Pour chaque entrée : `source.kind = "manuel"`, `source.ref =
"synthese_profil_competences_2026-07-25.md"` (aucune tentative d'exercice ni
session n'existe encore dans le store pour ces preuves).

⚠️ **Les valeurs de `dimensions` ci-dessous sont une traduction qualitative →
numérique faite par moi à partir du texte de la synthèse, pas une mesure
directe.** Aucune grille chiffrée n'existait dans le document source. À
sanity-checker avant de considérer le score macro dérivé comme fiable — un
score dérivé de dimensions mal calibrées serait une fausse précision, ce que
le protocole anti-hallucination interdit explicitement (§14).

### 3.1 → `LOG-07` (C1)

```json
{
  "skillCode": "LOG-07",
  "date": "2026-07-25",
  "type": "exercice",
  "niveauPreuve": "A",
  "autonomie": "A2",
  "qualite": "moyenne",
  "resultat": "partiel",
  "contexte": "Niveau 1, Exercice 1 — classification de 6 paramètres de planification (déterministe/incertain) + discussion takt time / temps de cycle",
  "dimensions": { "comprehension": 0.6, "application": 0.6 },
  "commentaire": "Classification initiale correcte et autonome (6 paramètres, typologie demande/capacité-process/approvisionnement). Confusion initiale takt time / temps de cycle, corrigée après échange puis reformulée seule ensuite. Le paramètre-piège visé par l'exercice (nomenclature traitée à tort comme fiable) n'a pas été identifié — angle 'données de référence supposées fiables' à retester. Robustesse faible : 1 seul contexte testé."
}
```

### 3.2 → `STAT-01` (C2)

```json
{
  "skillCode": "STAT-01",
  "date": "2026-07-25",
  "type": "calcul",
  "niveauPreuve": "A",
  "autonomie": "A3",
  "qualite": "moyenne",
  "resultat": "reussi",
  "contexte": "Niveau 1, Exercice 2 — série de demande hebdomadaire",
  "dimensions": { "comprehension": 0.75, "application": 0.8 },
  "commentaire": "Erreur initiale sur la moyenne (104 au lieu de 116,9), détectée et corrigée seule après invitation à vérifier. Interprétation qualitative du coefficient de variation correcte, avec anticipation spontanée du lien variabilité/stock de sécurité. Point de vigilance (erreur isolée, pas encore récurrente) : propager une valeur intermédiaire erronée sans la revérifier. Distinction écart-type population/échantillon non testée — INFORMATION NON DISPONIBLE."
}
```

### 3.3 → `LOG-02` (C3)

```json
{
  "skillCode": "LOG-02",
  "date": "2026-07-25",
  "type": "calcul",
  "niveauPreuve": "A",
  "autonomie": "A3",
  "qualite": "moyenne",
  "resultat": "reussi",
  "contexte": "Niveau 2, Exercice 1 — stock de sécurité, taux de service 90/95/99 %",
  "dimensions": { "comprehension": 0.7, "application": 0.85 },
  "commentaire": "Calculs corrects pour z=1,65 et z=2,33 (arrondi à revoir sur le second). Comparaison correcte des stocks aux 3 taux de service, conclusion juste sur la non-proportionnalité après un indice. Point de vigilance (erreur isolée) : arrondi effectué en cours de calcul plutôt qu'à la fin, avec impact en cascade sur une question suivante."
}
```

### 3.4 → `LOG-08` (C4)

```json
{
  "skillCode": "LOG-08",
  "date": "2026-07-25",
  "type": "transfert",
  "niveauPreuve": "A",
  "autonomie": "A4",
  "qualite": "forte",
  "resultat": "reussi",
  "contexte": "Niveau 2, Exercice 1, questions 3-4 — arbitrage taux de service / stock de sécurité",
  "dimensions": { "comprehension": 0.65, "transfert": 0.7, "justification": 0.5 },
  "commentaire": "Quantification et interprétation correctes de la non-proportionnalité (+5 puis +10 unités pour des sauts de service décroissants). Tentative spontanée non demandée de relier ce résultat au modèle de Wilson (EOQ) — bonne initiative de connexion interdisciplinaire, mais modèle exact pertinent différent (newsvendor, avenir incertain vs Wilson en avenir certain). Vocabulaire mathématique approximatif ('exponentiel' sans preuve formelle). Preuve unique — robustesse faible."
}
```

### 3.5 → `LOG-09` (C5)

```json
{
  "skillCode": "LOG-09",
  "date": "2026-07-25",
  "type": "calcul",
  "niveauPreuve": "A",
  "autonomie": "A2",
  "qualite": "faible",
  "resultat": "partiel",
  "contexte": "Niveau 2, Exercice 2 — stock de sécurité, incertitude combinée demande + délai fournisseur",
  "dimensions": { "application": 0.55, "comprehension": 0.4 },
  "commentaire": "Calculs numériques corrects dès le premier essai (Q1: 122,5 ; Q2: +435 %). Erreur d'attribution des termes croisés en Q3 (comparaison de D² et σ_D² au lieu des termes réellement combinés L×σ_D² et D²×σ_L²) — deux relances pédagogiques nécessaires avant conclusion correcte et argumentée. Compréhension intuitive de la formule combinée non vérifiée sans support du tuteur — fragile, prioritaire pour un retest rapproché."
}
```

### 3.6 → `STAT-07` (C6)

```json
{
  "skillCode": "STAT-07",
  "date": "2026-07-25",
  "type": "explication",
  "niveauPreuve": "A",
  "autonomie": "A2",
  "qualite": "faible",
  "resultat": "partiel",
  "contexte": "Rappel actif — z-score et application au stock de sécurité",
  "dimensions": { "comprehension": 0.35 },
  "commentaire": "A retrouvé seul, après recherche externe, la formule z=(X−μ)/σ et le terme 'loi normale centrée réduite'. Interprétation correcte de l'aire sous la courbe (95 % / 5 %). N'a pas reformulé ce que représente concrètement X dans le contexte du stock de sécurité — a explicitement indiqué avoir oublié ce point. Lacune ouverte et reconnue par l'utilisateur lui-même : priorité #1 de la synthèse."
}
```

### 3.7 → `ALGO-05` (C7) — **ne rien créer**

Aucune preuve n'existe (script fourni, non exécuté au moment de la synthèse).
Créer une `SkillEvidence` ici serait une invention interdite par le
protocole (§7 — ne jamais inventer un résultat non observé). `ALGO-05`
continuera d'afficher `niveau: null` (« — »), ce qui est le comportement
correct. Reprendre l'exécution du script au prochain contact avec
l'utilisateur ; créer la preuve seulement une fois le code réellement produit
et évalué.

---

## 4. Erreurs récurrentes (`data/store/errors.json`) — **ne rien créer non plus**

Les 5 erreurs mentionnées dans la synthèse (takt time/temps de cycle,
propagation d'erreur de calcul, arrondi en cours de calcul, vocabulaire
approximatif/confusion Wilson-newsvendor, comparaison de grandeurs qui se
ressemblent visuellement) sont **chacune observée une seule fois**. Le
protocole (anti-hallucination §11) exige une répétition, plusieurs contextes,
ou une persistance après correction avant de qualifier une erreur de
« récurrente ». Aucune ne remplit ce critère pour l'instant.

Elles sont déjà tracées dans le champ `commentaire` de chaque `SkillEvidence`
correspondante (section 3) — c'est suffisant pour qu'une répétition future
soit détectable. Ne pas créer d'entrée dans `errors.json` avant une deuxième
occurrence.

---

## 5. Session d'apprentissage (`data/store/sessions.json`) — recommandé, non bloquant

Ajouter une `LearningSession` récapitulative pour ancrer l'ensemble dans le
journal :

```json
{
  "date": "2026-07-25",
  "dureeMin": null,
  "domaines": ["logistique", "statistiques", "algorithmique"],
  "skillCodes": ["LOG-02", "LOG-07", "LOG-08", "LOG-09", "STAT-01", "STAT-07", "ALGO-05"],
  "activites": [
    { "type": "sequence", "ref": "synthese_profil_competences_2026-07-25.md", "libelle": "Séquence 'Concevoir et piloter un système de production sous incertitude' — Niveaux 1-2 clos, Niveau 3 démarré" }
  ],
  "resultat": "Niveaux 1 et 2 clos, Niveau 3 en cours (script Python non exécuté)",
  "apprentissagePrincipal": "Bonne intuition transversale (variabilité → stock de sécurité, connexion spontanée aux modèles économiques) ; le lien z-score / stock de sécurité reste la lacune ouverte prioritaire.",
  "prochaineAction": "Reprendre STAT-07 (lien z-score) en priorité, puis retester LOG-09 sans accompagnement, puis exécuter le script Python (ALGO-05).",
  "genereAutomatiquement": false
}
```

`dureeMin` : `INFORMATION NON DISPONIBLE` dans la synthèse — mettre `0` ou
rendre le champ optionnel plutôt que d'inventer une durée (vérifier si le
type autorise `null`, sinon omettre le champ si `dureeMin?` est optionnel —
c'est le cas dans `types.ts`, donc l'omettre proprement).

---

## 6. Préférences pédagogiques déclarées — gap de modélisation à signaler, pas à corriger silencieusement

La synthèse contient deux préférences explicitement déclarées par
l'utilisateur :

- approche mixte calcul manuel + Python (pas d'automatisation intégrale) ;
- rappels réguliers, recalcul/reformulation plutôt que rappel passif.

Le type `User` actuel (`lib/domain/types.ts`) n'a pas de champ pour ça
(`id, prenom, formation, objectifMoyenTerme, objectifLongTerme,
debutSuivi`). Deux options, à trancher avec l'utilisateur plutôt qu'à
décider seul :

1. Ajouter `preferencesPedagogiques?: string[]` à `User` — modification de
   type minimale, cohérente avec l'esprit du modèle (fait observé, pas
   dérivé).
2. Les laisser en dehors du store structuré et les garder uniquement dans le
   markdown de contexte lu par le tuteur (`lib/tutor/`), si un tel fichier de
   contexte libre existe déjà.

`user.prenom` est également vide (`""`) dans `UTILISATEUR_PAR_DEFAUT` — le
renseigner à `"Maxime"` est cohérent avec les infos déjà connues et ne viole
aucune règle (fait déclaratif, pas une compétence).

---

## 7. Validation avant merge

- `npm run verify` (types + lint + tests du moteur) doit rester vert après
  l'ajout des 4 compétences.
- Vérifier dans l'UI (`npm run dev`) que les 4 nouvelles compétences
  apparaissent dans la grille/l'arbre/le radar, et que `LOG-02` et `STAT-01`
  affichent bien un niveau dérivé non-`null` après ajout des preuves.
- Vérifier que `ALGO-05` affiche toujours `—` (pas de niveau).
- Confirmer avec l'utilisateur les valeurs de `dimensions` (section 3) et
  `importance` (section 2) avant de les considérer comme définitives — ce
  sont des estimations de traduction, pas des mesures.
