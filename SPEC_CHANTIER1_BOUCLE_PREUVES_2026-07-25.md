# Spécification technique — chantier 1 : fermer la boucle de preuves

**Destinataire :** Claude Code, exécutant dans le dépôt `Système pédagogique/app`.
**Auteur de la spec :** session Cowork, 25/07/2026.
**Objectif :** aujourd'hui, la boucle self-service (agir → preuve enregistrée →
niveau recalculé → recommandation mise à jour) ne fonctionne que pour les 10
exercices de diagnostic pré-écrits. Dès qu'on en sort — script Python fait
seul, échange avec le tuteur, exercice papier — il n'existe aucun chemin dans
l'interface pour enregistrer ce qui vient d'être observé. Ce chantier ajoute
ce chemin, sans toucher au moteur (`lib/engine/`) ni affaiblir aucun
garde-fou du protocole anti-hallucination.

**Hors périmètre de ce chantier** (à ne pas traiter ici) : la friction de
configuration de la clé `ANTHROPIC_API_KEY`, et l'intégration Google Calendar
pour les relances. Les deux sont des chantiers séparés, à traiter après
celui-ci.

---

## 0. Constat de départ

- `terminerExercice()` (`lib/store/actions.ts`) est aujourd'hui le **seul**
  chemin d'écriture d'une `SkillEvidence` depuis l'interface. Il dépend d'un
  `Exercise` existant dans `data/store/exercises.json` ou dans
  `lib/seed/exercises.ts`.
- `choisirExercice()` (`lib/engine/recommend.ts`) exclut définitivement un
  exercice une fois réussi (`!reussis.has(ex.id)`). Avec 10 exercices pour 43
  compétences, la plupart des compétences n'ont pas ou plus de candidat une
  fois le pool épuisé : la fonction retourne `null`, et l'écran retombe sur
  `etat.prochaineEtape`, un texte générique et statique (`skill-state.ts`,
  fonction `prochaineEtape()`) qui ne varie que par le niveau, jamais par la
  compétence réelle.
- Le tuteur (`app/api/tutor/route.ts`, `lib/tutor/contexte.ts`) émet déjà des
  blocs texte au gabarit fixe `PROPOSITION DE MISE À JOUR` (défini dans
  `CONSIGNES_INTERFACE`), mais rien ne les exploite : l'utilisateur doit
  aujourd'hui les recopier à la main.
- Aucune Server Function n'existe pour créer un `Exercise` depuis
  l'interface — seul `lib/seed/exercises.ts` (code) et une intervention
  manuelle sur `data/store/exercises.json` le permettent.
- Le moteur (`lib/engine/`) et ses 20 tests ne sont pas concernés par ce
  chantier : aucune règle de dérivation ne change, seule l'**offre de
  matière à dériver** s'élargit.

---

## 1. Décisions à trancher avant d'exécuter

Quatre points d'arbitrage, dans l'esprit de la spec du 25/07 précédente
(trancher plutôt que deviner) :

**1.1 — Autonomie d'une preuve manuelle : déclarée, pas déduite.**
Le flux exercice déduit l'autonomie du nombre d'indices consultés
(`autonomieDepuisIndices`). Une preuve manuelle n'a pas cet ancrage : il n'y
a pas d'équivalent possible sans inventer une mesure. Décision proposée :
laisser l'utilisateur déclarer l'autonomie (A0-A4, avec l'intitulé de
`AUTONOMIE[...]` affiché), mais préfixer systématiquement le `commentaire`
stocké par `"Autonomie auto-déclarée (non déduite)."` — pour que la
distinction reste visible en aval (fiche compétence, contexte tuteur),
cohérent avec le protocole anti-fausse-précision (§14).

**1.2 — Niveau de preuve : A ou B, jamais imposé à A par défaut.**
Le moteur n'accepte que `"A"` (directe) ou `"B"` (indirecte). Proposition :
champ à choix explicite avec aide contextuelle — *« A : tu as toi-même fait
ou vécu l'action décrite. B : tu rapportes une observation indirecte (ex.
relayée par le tuteur, un tiers) »* — défaut **A** pour une preuve saisie
directement par l'utilisateur sur sa propre fiche compétence, défaut **B**
pour une preuve pré-remplie depuis une proposition du tuteur (voir §3).

**1.3 — Portée du chantier « exercices » : création manuelle seulement, pas
de parsing automatique de proposition d'exercice par le tuteur.**
Construire un second parseur (proposition d'exercice complète : énoncé,
indices, correction, critères) est plus risqué et plus gros que le parseur
de proposition de preuve (§3), pour un besoin non encore confirmé. Proposition
retenue ici : un formulaire de création manuelle (§4), alimenté à la main à
partir de ce que le tuteur a produit en conversation (copier-coller dans les
champs). Le parsing automatique d'exercice devient un chantier ultérieur,
seulement si la copie manuelle s'avère être une vraie friction récurrente —
cohérent avec le principe de l'audit du 25/07 (ne pas construire par
anticipation).

**1.4 — Un exercice créé ici n'est jamais `diagnostic: true`.**
Le champ `diagnostic` reste réservé aux 10 exercices du plan d'évaluation
initiale (`ORDRE_DIAGNOSTIC`). Un exercice créé via ce chantier a
`origine: "manuel"`.

Si l'un de ces points doit être tranché autrement, corriger la spec avant
d'implémenter plutôt que de trancher silencieusement en cours de route.

---

## 2. Formulaire « Enregistrer une preuve manuelle »

### 2.1 Server Function — `src/lib/store/actions.ts`

Ajouter, à côté de `terminerExercice` :

```ts
export interface SoumissionPreuveManuelle {
  skillCode: string;
  date?: string; // ISO ; défaut : maintenant
  type: SkillEvidence["type"];
  niveauPreuve: "A" | "B";
  autonomie: Autonomie;
  qualite: QualitePreuve;
  resultat: "reussi" | "partiel" | "echec";
  contexte: string;
  dimensions: Partial<Record<Dimension, number>>;
  competencesCombinees?: string[];
  sourceRef: string; // description vérifiable : "Script Python exécuté le 26/07", etc.
  commentaire?: string;
}

/**
 * Deuxième chemin d'écriture d'une preuve, à côté de `terminerExercice`.
 * Couvre tout travail qui ne passe pas par un `Exercise` du store : script
 * exécuté seul, exercice papier, synthèse d'un échange avec le tuteur.
 * Mêmes garde-fous : refusé en mode démo, source toujours renseignée,
 * dimensions non observées simplement omises (jamais un 0 par défaut).
 */
export async function enregistrerPreuveManuelle(
  soumission: SoumissionPreuveManuelle,
): Promise<void> {
  await refuserSiDemo();
  if (!soumission.contexte.trim()) throw new Error("Le contexte est obligatoire.");
  if (!soumission.sourceRef.trim()) throw new Error("La source est obligatoire.");

  const { SKILL_PAR_CODE } = await import("@/lib/domain/referentiel");
  const skill = SKILL_PAR_CODE.get(soumission.skillCode);
  if (!skill) throw new Error(`Compétence inconnue : ${soumission.skillCode}`);

  const date = soumission.date ?? new Date().toISOString();

  const preuve: SkillEvidence = {
    id: nouvelId("ev"),
    skillCode: soumission.skillCode,
    date,
    type: soumission.type,
    niveauPreuve: soumission.niveauPreuve,
    autonomie: soumission.autonomie,
    qualite: soumission.qualite,
    resultat: soumission.resultat,
    contexte: soumission.contexte.trim(),
    dimensions: soumission.dimensions,
    competencesCombinees: soumission.competencesCombinees?.length
      ? soumission.competencesCombinees
      : undefined,
    source: { kind: "manuel", ref: soumission.sourceRef.trim() },
    commentaire: ["Autonomie auto-déclarée (non déduite).", soumission.commentaire?.trim()]
      .filter(Boolean)
      .join(" — "),
  };
  await ajouter("evidence", preuve);

  // Même logique que `terminerExercice` : une entrée de journal automatique
  // (instructions §15 — la maintenance se fait en arrière-plan).
  const session: LearningSession = {
    id: nouvelId("ses"),
    date,
    domaines: [skill.domaine],
    skillCodes: [soumission.skillCode],
    activites: [
      { type: "preuve-manuelle", ref: preuve.id, libelle: soumission.contexte.trim() },
    ],
    resultat:
      soumission.resultat === "reussi"
        ? "Preuve enregistrée manuellement — réussie"
        : soumission.resultat === "partiel"
          ? "Preuve enregistrée manuellement — partielle"
          : "Preuve enregistrée manuellement — non aboutie",
    notePersonnelle: soumission.commentaire,
    genereAutomatiquement: true,
  };
  await ajouter("sessions", session);

  revalidatePath("/", "layout");
}
```

Import à ajouter en tête du fichier : `LearningSession` (déjà importé),
`Autonomie`, `Dimension`, `QualitePreuve` (déjà importés pour
`terminerExercice`) — vérifier qu'aucun de ces types ne manque.

### 2.2 Composant — `src/components/competences/formulaire-preuve.tsx` (nouveau, client)

Sur le même modèle que `formulaire-bilan.tsx` (mêmes primitives UI, même
ton : annoncer ce qui sera enregistré avant d'écrire). Props :

```ts
{
  skillCode: string;
  skillsDisponibles: { code: string; intitule: string }[]; // pour "compétences combinées"
  valeursInitiales?: Partial<{
    contexte: string;
    commentaire: string;
    niveauPreuve: "A" | "B";
    type: SkillEvidence["type"];
  }>; // pré-remplissage depuis une proposition du tuteur, voir §3
}
```

Champs :
- **Résultat** : mêmes 3 boutons que `formulaire-bilan.tsx` (réussi / partiel
  / non abouti).
- **Type** : select parmi les 8 valeurs de `SkillEvidence["type"]`.
- **Niveau de preuve (A/B)** : boutons radio avec l'aide contextuelle de la
  décision 1.2, défaut selon `valeursInitiales` sinon `"A"`.
- **Autonomie (A0-A4)** : select affichant `AUTONOMIE[x].libelle`, avec la
  mention *"déclarée, pas déduite"* toujours visible sous le champ.
- **Qualité** : select `faible | moyenne | forte`, avec les libellés de
  `QUALITE_PREUVE`.
- **Dimensions** : pour chacune des 5 dimensions, 4 boutons — *Non observée*
  (défaut), *Non* (0), *En partie* (0,5), *Oui* (1). Seules les dimensions
  sorties de *Non observée* sont incluses dans l'objet envoyé — ne jamais
  forcer une valeur pour une dimension non réellement observée.
- **Contexte** (texte, obligatoire) — pré-rempli si `valeursInitiales`.
- **Compétences combinées** (multi-select optionnel parmi
  `skillsDisponibles`, hors la compétence courante) — utile pour documenter
  une preuve de niveau 5.
- **Source** (texte, obligatoire) : *"D'où vient cette preuve, vérifiable ?"*
  — placeholder `"Script Python exécuté le 26/07"`.
- **Commentaire** (texte libre, optionnel) — pré-rempli si
  `valeursInitiales`.
- Bloc récapitulatif "Ce qui sera enregistré" avant le bouton, comme dans
  `formulaire-bilan.tsx`.

Le bouton appelle `enregistrerPreuveManuelle` via `useTransition`, même
gestion d'erreur que `formulaire-bilan.tsx`.

### 2.3 Intégration — `src/app/competences/[code]/page.tsx`

- Étendre la signature pour lire les `searchParams` (voir §3.3) :
  `props: { params: Promise<{ code: string }>; searchParams: Promise<{ proposition?: string }> }`.
- Ajouter, en bas de la grille existante, un `<Depliant resume="Enregistrer une preuve manuelle">`
  (import déjà présent ailleurs via `@/components/ui/explication`) contenant
  `<FormulairePreuveManuelle />`, **uniquement si `ctx.mode !== "demo"`**
  (même garde que `CarteObjectifs`).
- `skillsDisponibles` : dériver de `ctx.etats.map(e => ({ code: e.skill.code, intitule: e.skill.intitule }))`.

---

## 3. Propositions du tuteur → formulaire pré-rempli

### 3.1 Parseur — `src/lib/tutor/proposition.ts` (nouveau, fonction pure, testable)

```ts
export interface PropositionTuteur {
  competence: string;
  niveauActuel: string;
  niveauPropose: string;
  preuve: string;
  autonomieObservee: string;
  qualitePreuve: string;
  reserve: string;
}

const CHAMPS: { cle: keyof PropositionTuteur; etiquette: string }[] = [
  { cle: "competence", etiquette: "Compétence" },
  { cle: "niveauActuel", etiquette: "Niveau actuel" },
  { cle: "niveauPropose", etiquette: "Niveau proposé" },
  { cle: "preuve", etiquette: "Preuve" },
  { cle: "autonomieObservee", etiquette: "Autonomie observée" },
  { cle: "qualitePreuve", etiquette: "Qualité de la preuve" },
  { cle: "reserve", etiquette: "Réserve" },
];

/**
 * Extrait les blocs « PROPOSITION DE MISE À JOUR » du texte du tuteur
 * (gabarit fixé dans `CONSIGNES_INTERFACE`, `lib/tutor/contexte.ts`).
 * Parsing texte volontairement tolérant : si le modèle dévie du gabarit,
 * un champ manque simplement (chaîne vide) plutôt que de lever une erreur —
 * dégradation silencieuse et sans risque, le texte brut reste lisible dans
 * le chat de toute façon.
 */
export function extrairePropositions(texte: string): PropositionTuteur[] {
  const blocs = texte.split(/PROPOSITION DE MISE À JOUR/).slice(1);
  return blocs
    .map((bloc) => {
      const valeurs = {} as PropositionTuteur;
      for (const { cle, etiquette } of CHAMPS) {
        const m = bloc.match(new RegExp(`${etiquette}\\s*:\\s*(.+)`));
        valeurs[cle] = m?.[1]?.trim() ?? "";
      }
      return valeurs;
    })
    .filter((p) => p.competence.length > 0);
}
```

Test — `src/lib/tutor/proposition.test.ts` : cas nominal (un bloc complet),
cas absent (texte normal sans proposition → tableau vide), cas deux
propositions dans un même message.

### 3.2 Intégration dans le chat — `src/components/tuteur/chat.tsx`

- `PageTuteur` (`src/app/tuteur/page.tsx`) passe une nouvelle prop
  `codesCompetences={ctx.etats.map((e) => e.skill.code)}` à `<ChatTuteur />`
  — sert à valider qu'une compétence citée par le tuteur existe réellement
  avant de proposer un lien (ne jamais faire confiance au code renvoyé par le
  modèle sans vérification).
- Dans le rendu de chaque message assistant (bloc `Markdown`), appeler
  `extrairePropositions(m.content)`. Pour chaque proposition dont
  `competence.toUpperCase()` est dans `codesCompetences` : afficher une
  petite carte sous le message (`Etiquette ton="info"` + résumé
  compétence/niveau proposé) avec un bouton **« Revoir et enregistrer »**.
- Le bouton construit
  `/competences/${competence}?proposition=${encodeURIComponent(JSON.stringify({ contexte: "Proposition du tuteur — " + preuve, commentaire: reserve, niveauPreuve: "B" }))}`
  et navigue (Next `<Link>` ou `router.push`).
- Si `competence` n'est pas reconnue : ne rien ajouter — le texte brut reste
  visible dans le chat, pas de lien cassé.

**Garde-fou à préserver explicitement** : ce mécanisme ne donne à aucun
moment d'accès en écriture au tuteur. Il pré-remplit un formulaire côté
client ; seule l'action explicite de l'utilisateur sur le bouton « Enregistrer
la preuve » du formulaire (§2.2) déclenche l'écriture. Ne pas introduire de
soumission automatique.

### 3.3 Lecture du pré-remplissage — `src/app/competences/[code]/page.tsx`

```ts
const { proposition } = await props.searchParams;
let valeursInitiales;
if (proposition) {
  try {
    valeursInitiales = JSON.parse(decodeURIComponent(proposition));
  } catch {
    valeursInitiales = undefined; // JSON invalide : formulaire vide, pas d'erreur bloquante
  }
}
```

Passer `valeursInitiales` à `<FormulairePreuveManuelle />` et, si présent,
ouvrir le `<Depliant>` déplié par défaut (`ouvertParDefaut` à ajouter à
`Depliant` si ce prop n'existe pas déjà — vérifier `ui/explication.tsx`).

---

## 4. Création manuelle d'exercice

### 4.1 Server Function — `src/lib/store/actions.ts`

```ts
export interface SoumissionExerciceManuel {
  titre: string;
  domaine: DomaineId;
  type: TypeExercice;
  difficulte: Difficulte;
  competences: string[];
  dureeEstimeeMin: number;
  enonce: string;
  indices: string[];
  correction: string;
  criteres: { dimension: Dimension; libelle: string }[];
}

export async function creerExercice(soumission: SoumissionExerciceManuel): Promise<string> {
  await refuserSiDemo();
  if (!soumission.titre.trim()) throw new Error("Le titre est obligatoire.");
  if (!soumission.enonce.trim()) throw new Error("L'énoncé est obligatoire.");
  if (!soumission.correction.trim()) throw new Error("La correction est obligatoire.");
  if (soumission.competences.length === 0) throw new Error("Au moins une compétence est requise.");
  if (soumission.criteres.length === 0) throw new Error("Au moins un critère est requis.");

  const exercice: Exercise = {
    id: nouvelId("ex"),
    titre: soumission.titre.trim(),
    domaine: soumission.domaine,
    type: soumission.type,
    difficulte: soumission.difficulte,
    competences: soumission.competences,
    dureeEstimeeMin: soumission.dureeEstimeeMin,
    enonce: soumission.enonce,
    indices: soumission.indices.filter((i) => i.trim().length > 0),
    correction: soumission.correction,
    criteres: soumission.criteres,
    diagnostic: false,
    origine: "manuel",
  };
  await ajouter("exercises", exercice);
  revalidatePath("/exercices");
  return exercice.id;
}
```

### 4.2 Composant — `src/components/exercices/formulaire-creation.tsx` (nouveau, client)

Formulaire simple : titre, domaine (select `DOMAINES`), type, difficulté
(1-5), compétences ciblées (multi-select), durée estimée, énoncé (textarea),
indices (liste dynamique, ajout/retrait de lignes, peut rester vide),
correction (textarea), critères (liste dynamique de `{ dimension, libelle }`,
au moins un). Pas de mode démo (même garde que le reste).

### 4.3 Intégration — `src/app/exercices/page.tsx`

Ajouter un `<Depliant resume="Ajouter un exercice">` en tête ou en pied de
la liste existante, hors mode démo.

---

## 5. Ce qui ne change pas (à vérifier, pas à modifier)

- `lib/engine/` (aucun fichier) — le moteur de dérivation n'est pas touché.
  `npm run test` doit rester vert sans aucune modification de
  `moteur.test.ts`.
- Le tuteur n'obtient à aucun moment un accès en écriture — vérifier que
  rien dans `lib/tutor/` n'importe `lib/store/actions.ts` ou `lib/store/db.ts`
  en écriture.
- Le mode démonstration n'écrit toujours rien (`refuserSiDemo()` sur les
  deux nouvelles Server Functions).

---

## 6. Validation avant merge

- `npm run verify` (types + lint + tests) vert.
- Test manuel : depuis une fiche compétence sans preuve, enregistrer une
  preuve manuelle de niveau A, résultat "réussi", et vérifier que le niveau
  affiché change (ou reste `null` si les seuils de `skill-state.ts` ne sont
  pas atteints — comportement attendu, pas un bug).
- Test manuel : dans le chat tuteur, provoquer une réponse contenant un bloc
  `PROPOSITION DE MISE À JOUR` (ex. mode "Évalue-moi"), vérifier qu'un bouton
  « Revoir et enregistrer » apparaît et pré-remplit correctement le
  formulaire de la fiche compétence ciblée.
- Test manuel : vérifier qu'un message du tuteur sans proposition ne fait
  apparaître aucun bouton, et qu'une compétence citée mais inconnue du
  référentiel n'en fait pas apparaître non plus.
- Test manuel : créer un exercice via le nouveau formulaire, vérifier qu'il
  apparaît dans `/exercices`, qu'il peut être commencé, et qu'une fois
  réussi il est bien exclu des candidats suivants par `choisirExercice`
  (comportement déjà existant, à confirmer non régressé).
- Vérifier qu'en mode démonstration, aucun des trois nouveaux formulaires
  n'est visible ou actionnable.
