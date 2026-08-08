# Composants primitifs — Phase 2 (1/3)

Trois composants : `Bouton`, `Carte` (étendue), `Champ`/`ChampSelect`.
Fichiers source : [`app/src/components/ui/primitives.tsx`](../../app/src/components/ui/primitives.tsx)
(`Bouton`, `Carte`, `classesLienBouton`) et
[`app/src/components/ui/champ.tsx`](../../app/src/components/ui/champ.tsx)
(`Champ`, `ChampSelect`, `classesChamp`).

Périmètre de cette phase : tout `src/` hors `src/components/dev/**`
(outillage debug/profilage, hors du produit — ADR-019). Ces fichiers gardent
leur code d'avant la phase.

---

## Bouton

Remplace la factory `classesBouton` (87 appels, 27 fichiers) et les boutons
bruts d'action des fichiers en périmètre.

### Variantes

| Variante | Aspect | Usage |
|---|---|---|
| `principal` | fond `--primaire`, texte contrasté | l'action mise en avant de l'écran |
| `secondaire` | fond `--surface`, bordure `--bordure-forte` | action par défaut |
| `discret` | transparent, texte atténué | action secondaire, faible poids visuel |
| `danger` | bordure et fond `--danger-faible`, texte `--danger` | action destructive |

`danger` est nouveau : trois recettes coexistaient sans source commune
(pleine, faible, transparente). Standardisé sur la recette **faible**, déjà
majoritaire hors dev/ (3 sites sur 3 pour « Vider »/« Effacer »). La recette
pleine (`bg-danger text-white`) n'est offerte nulle part — plus alarmante que
toute action destructive réelle du produit.

### Tailles

| Taille | Hauteur | Origine |
|---|---|---|
| `normale` | `h-9` | défaut, inchangé |
| `compacte` | `h-8` | nouveau, calé sur les 6 boutons réels de `compte.tsx` — pas une invention |
| `petite` | `h-7` | inchangé |

### Props

```tsx
interface ProprietesBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "principal" | "secondaire" | "discret" | "danger"; // défaut "secondaire"
  taille?: "normale" | "compacte" | "petite";                   // défaut "normale"
  enChargement?: boolean;                                        // défaut false
  children: ReactNode;                                           // requis
}
```

Tout le reste (`onClick`, `aria-*`, `form`, `title`…) passe par `...reste`.

### États

| État | Applicable | Mécanisme |
|---|---|---|
| default | oui | classes de la variante et de la taille |
| hover | oui | `hover:*` par variante |
| focus | oui | **aucune classe dédiée** — la règle globale `:focus-visible` de `globals.css` s'en charge |
| disabled | oui | `disabled` natif + `disabled:opacity-50` |
| chargement | oui | `enChargement` → icône `animate-spin`, `disabled` forcé, `aria-busy` posé — le libellé reste affiché, jamais remplacé |
| active/pressé | **sans objet, gap déclaré** | 0 classe `active:` dans l'historique du composant, aucun jeton de « primaire plus foncé » n'existe pour ce cran — à poser sur des données réelles, pas maintenant |
| erreur | **sans objet** | un bouton n'a pas d'état d'erreur propre ; l'échec de l'action est de la responsabilité de l'appelant (bandeau, message) |
| vide | **sans objet** | `children` est requis — il n'existe pas de bouton sans contenu |

### Accessibilité et clavier

- **`type="button"` par défaut.** Un `<button>` natif dans un `<form>` vaut
  `submit` sinon — c'est exactement le piège qu'un composant wrapper peut
  cacher. `type="submit"` reste explicite là où il est voulu.
- Chargement : `disabled` natif (sort le bouton de la navigation clavier,
  empêche la double soumission) + `aria-busy` (signale « en cours », distinct
  de « indisponible ») + `<span className="sr-only" aria-live="polite">` pour
  annoncer le changement d'état sans dépendre d'un texte que chaque appelant
  devrait retaper.
- Activation Entrée/Espace, association du libellé : comportement natif de
  `<button>`, rien à réimplémenter.

### `classesLienBouton` — pour les `<Link>`

`Bouton` rend un `<button>` ; certains liens de navigation doivent pourtant
avoir l'apparence d'une action (« Commencer », « Réaliser un diagnostic »).
`classesLienBouton(variante, taille)` expose les mêmes classes ; `Bouton`
l'utilise en interne. Aucun appelant ne doit retaper la chaîne à la main.

### Do / Don't

- Faire : passer `enChargement` plutôt que remplacer le libellé par un texte
  d'attente — c'était le patron répété avant ce composant.
- Faire : utiliser `classesLienBouton` pour un `<Link>`, jamais dupliquer les
  classes.
- Ne pas faire : forcer dans `Bouton` une case à cocher déguisée, une ligne de
  menu déroulant, un bouton icône seul (fermer, FAB) ou un sélecteur
  segmenté — ce sont des formes différentes, aucune n'est au programme de
  cette phase (pas de `IconButton`/`Toggle`). Ils restent du `<button>` brut.
- Ne pas faire : ajouter une classe `focus:` — la règle globale suffit et
  diverger la casserait silencieusement pour ce seul composant.

---

## Carte

Extension d'un composant déjà largement adopté (55 usages / 17 fichiers) —
un seul prop ajouté, rien redessiné.

### Props

```tsx
interface ProprietesCarte {
  children: ReactNode;
  className?: string;
  accent?: boolean;      // existant — liseré supérieur
  interactive?: boolean; // nouveau
  id?: string;            // existant
}
```

`interactive` applique `transition-shadow hover:shadow-levee` — remplace le
`hover:shadow-md` codé en dur à la main (ombre Tailwind par défaut, sans
rapport avec l'échelle à 3 niveaux du produit).

### Ce qui n'a pas de prop dédié

Le motif « conteneur de tableau » (`overflow-hidden`, sans padding) passe par
le `className` existant — `<Carte className="overflow-hidden">`. Aucun
nouveau prop n'était nécessaire.

### Hors périmètre, explicitement

Les panneaux de modale (`rounded-xl`/`shadow-surcouche` — aucun composant
Modale au programme) et la bannière deux tons de `competences/page.tsx`
(`bg-surface-2`, sans ombre — plus proche de `BandeauInfo`). Ni l'un ni
l'autre n'est une carte.

### États

| État | Applicable | Mécanisme |
|---|---|---|
| default | oui | `rounded-carte border bg-surface shadow-[var(--ombre-carte)]` |
| hover | seulement si `interactive` | `hover:shadow-levee` |
| focus | **sans objet** | `Carte` rend une `<section>` non focusable ; un enfant interactif (lien, bouton) porte le focus lui-même |
| active/pressé | **sans objet** | même raison que focus |
| disabled | **sans objet** | un conteneur de contenu n'a pas d'état désactivé |
| chargement | **sans objet** | un contenu en cours de chargement rend un squelette *à l'intérieur* de la carte ; la coque ne change pas |
| erreur | **sans objet** | l'erreur appartient au contenu, pas à la coque |
| vide | **sans objet** | `children` requis ; `EtatVide` est le patron pour un contenu vide, rendu en enfant |

### Do / Don't

- Faire : `interactive` seulement quand la carte enveloppe un `<Link>` ou un
  `<button>` — jamais pour signaler autre chose.
- Ne pas faire : ajouter un prop pour les modales ou pour une bannière deux
  tons — ce ne sont pas des cartes, forcer l'ajustement casserait leur forme.

---

## Champ et ChampSelect

Aucun composant n'existait. Nouveau fichier `champ.tsx`. Remplacent 6
constantes `champ` divergentes (3 valeurs littérales différentes, 5 sur 6
sans `<label htmlFor>` réel) et les `<select>` natifs hors dev/.

### Props communes

```tsx
interface ProprietesChampBase {
  label: string;                    // requis — jamais un <span> visuel
  id?: string;                      // généré via useId() si omis
  aide?: string;
  erreur?: string;                  // présence => état erreur
  requis?: boolean;
  taille?: "normale" | "compacte";
  className?: string;
}
```

`Champ` ajoute `multiligne?: boolean` (+ `rows?`) pour rendre un `<textarea>`
au lieu d'un `<input>` — un seul composant, pas un second fichier pour
l'unique usage multiligne du produit. `ChampSelect` ajoute
`options: { valeur: string; libelle: string }[]`.

### Tailles

| Taille | Hauteur | Usage |
|---|---|---|
| `normale` | `h-9` | formulaire — alignée sur `Bouton` `normale` pour qu'un champ et un bouton voisins s'alignent |
| `compacte` | `h-7` | sélecteurs denses (« Palier »), alignée sur `Bouton` `petite` |

### Ce que le composant corrige, pas seulement consolide

- **Bordure `--bordure-controle`**, pas `--bordure` : le premier jeton
  atteint 3:1 (WCAG 1.4.11), calculé en phase 1 précisément pour ce rôle ; le
  second ne l'a jamais garanti.
- **Aucune classe `focus:` personnalisée.** Les 6 constantes en portaient
  chacune une (une seule ajoutait en plus un `focus:ring-1`) — supprimées au
  profit de la règle globale `:focus-visible`, déjà le comportement de
  `Bouton`. Le contour est maintenant visible en permanence, pas seulement au
  focus, ce que le changement de couleur tentait de faire seul.
- **`label` obligatoire, jamais un `<span>`.** `<label htmlFor={idFinal}>`
  réel — `idFinal` vient de `useId()` si l'appelant n'en fournit pas.
- **État d'erreur, neuf.** Aucun champ n'en avait avant ce composant :
  `erreur` → bordure `--danger`, message `role="alert"`, `aria-invalid`,
  `aria-describedby` réunissant aide et erreur (jamais l'un à la place de
  l'autre).

### `classesChamp` — pour le seul cas composé

`layout/compte.tsx` a un champ clé API suivi d'un bouton
afficher/masquer sur la même ligne — une forme que `Champ` (label au-dessus,
un seul contrôle) ne représente pas. `classesChamp(taille, enErreur)` expose
les mêmes classes ; `Champ`/`ChampSelect` l'utilisent en interne. Même
logique que `classesLienBouton` pour `Bouton` : un seul endroit possède la
chaîne, jamais une copie locale.

### États

| État | Applicable | Mécanisme |
|---|---|---|
| default | oui | `border-bordure-controle bg-surface text-texte`, padding/hauteur selon `taille` |
| focus | oui | **aucune classe dédiée** — règle globale `:focus-visible` |
| disabled | oui | `disabled` natif + `disabled:opacity-50` — jamais modélisé avant ce composant, ajouté pour cohérence avec `Bouton` |
| erreur | oui | `erreur` → bordure danger, `aria-invalid`, message `role="alert"` |
| hover | **sans objet** | 0 classe `hover:` sur les 6 constantes d'origine ni sur les 6 `<select>` — un champ texte ne réagit pas au survol, seul le focus signale l'interactivité |
| active/pressé | **sans objet** | cliquer dans un champ le focalise, il n'existe pas d'état « pressé » distinct pour un contrôle de texte natif |
| chargement | **sans objet** | aucun champ du produit n'est validé de façon asynchrone ; l'analogue le plus proche (export dans `compte.tsx`) est un `Bouton`, pas un champ |
| vide | oui, mais pas une classe | porté par `placeholder` (natif, inchangé) — cité ici parce que le tableau le demande explicitement, pas parce qu'un style dédié existe |

### Accessibilité et clavier

- `id` toujours dérivé de `idFinal` (fourni ou généré) pour `htmlFor`,
  l'`id` du contrôle et `aria-describedby` — la chaîne tient même quand
  l'appelant ne passe rien.
- `requis` pose à la fois l'astérisque visuel et `required`/`aria-required`.
- `ChampSelect` : comportement clavier natif du `<select>` (flèches,
  recherche par frappe, Entrée/Espace pour ouvrir) — aucune surcouche.

### Do / Don't

- Faire : passer `label` même quand l'ancien code n'en avait pas — c'est la
  correction, pas une option.
- Faire : utiliser `classesChamp` pour un champ à mise en page composée,
  jamais retaper la chaîne.
- Ne pas faire : ajouter une 3ᵉ taille pour un champ qui tombe entre les
  deux — le caler sur la plus proche des deux existantes (c'est ce qui a été
  fait pour les 3 champs inline de `compte.tsx`, tous passés en `compacte`).
- Ne pas faire : remettre `focus:border-primaire` ou un `focus:ring` sur un
  champ — la bordure permanente et la règle globale suffisent, et diverger
  reproduirait l'incohérence que ce composant existe pour éliminer.

---

# Composants primitifs — Phase 2 (2/3)

Cinq pièces : `EtiquetteStatut`, `PointActif`, `BarreProgression` (étendue),
`Barre`/`SqueletteContenu`/`SquelettePage` (documentées, inchangées),
`BandeauInfo` (étendue), `TiroirRepliable`. Même périmètre que le lot
précédent — `src/components/dev/**` exclu.

## EtiquetteStatut et PointActif

### `EtiquetteStatut`

Badge des cinq jetons de statut de compétence posés en phase 1
(`inconnu`/`emergent`/`pratique`/`solide`/`a-rafraichir`). Même forme que
`Etiquette` (rôle voisin), tons dédiés.

```tsx
type StatutCompetence = "inconnu" | "emergent" | "pratique" | "solide" | "a-rafraichir";

function EtiquetteStatut({ statut, className }: { statut: StatutCompetence; className?: string })
```

**⚠️ Non câblé, délibérément.** Aucune fonction dans `lib/domain/` ou
`lib/engine/` ne dérive aujourd'hui l'un des 5 états depuis `SkillState`
(niveau, confiance, dernière preuve). L'écrire fabriquerait des seuils non
validés par des données réelles — le composant est prêt, le câblage attend
une décision produit, pas une session de refactor UI.

`inconnu`/`emergent`/`pratique`/`solide` mesurent la maîtrise ;
`a-rafraichir` mesure le temps et se superpose à n'importe lequel des
quatre — deux `EtiquetteStatut` côte à côte, jamais un état combiné.

**États** : un seul rendu, pas d'interaction — hover/focus/disabled/erreur
sans objet, comme `Etiquette`.

**Do/Don't** : ne pas ajouter de logique de dérivation dans ce fichier
(`ui/`) pour débloquer un usage — c'est une décision de `lib/domain/`, hors
du périmètre de ce composant.

### `PointActif`

```tsx
function PointActif({ className }: { className?: string })
```

Consolide 8 copies identiques (`size-1.5 animate-pulse rounded-full
bg-primaire`, dont 2 sans `aria-hidden`, corrigé). Signale une activité en
cours (réponse du tuteur en train de s'écrire). `aria-hidden` toujours posé
— le texte adjacent (« Le tuteur réfléchit… ») porte déjà l'information pour
un lecteur d'écran.

---

## ProgressIndicator (BarreProgression)

Aucun nouveau composant — `BarreProgression` existait déjà (1 usage) et
fonctionnait visuellement. Le gap était l'accessibilité : `role="presentation"`,
aucune sémantique de barre de progression pour un lecteur d'écran.

```tsx
function BarreProgression({
  fraction,
  ton?: "primaire" | "neutre" | "succes",
  libelle?: string,   // nouveau — devient l'aria-label
  className?: string,
})
```

`role="presentation"` → `role="progressbar"` + `aria-valuenow` (0-100,
arrondi) + `aria-valuemin={0}` + `aria-valuemax={100}`. `libelle` facultatif
seulement parce que l'unique usage actuel place déjà l'intitulé dans un
`<span>` juste à côté — un futur usage isolé doit le passer, sinon un
lecteur d'écran annonce « barre de progression, 43 % » sans dire de quoi.

**`JaugeNiveau`** (jauge à 6 segments, niveau 0-5) et **`RepartitionNiveaux`**
(`charts/index.tsx`, barre empilée multi-segments) restent des composants
distincts — formes différentes pour des données différentes, aucune fusion
forcée.

**États** : default (calcule la largeur) et… c'est tout. Pas de hover/focus
(non interactif), pas de disabled/erreur (une progression ne peut pas être
désactivée ou en erreur — l'appelant gère ces cas en amont, avant de décider
d'afficher la barre).

---

## Skeleton

Aucun changement de code. `Barre`, `SqueletteContenu`, `SquelettePage`
(`src/components/layout/squelette.tsx`) existaient déjà, bien formés,
sans duplication trouvée ailleurs — la recherche du lot n'a rien remonté à
corriger. Documenté ici pour mémoire du plan à 8, pas parce qu'il fallait le
changer.

```tsx
function Barre({ className }: { className?: string })                 // rectangle pulsant, primitive atomique
function SqueletteContenu({ cartes?: number })                          // grille de Carte remplies de Barre
function SquelettePage()                                                // en-tête + SqueletteContenu — loading.tsx de (app)
```

`aria-busy="true"` et `aria-label="Chargement…"` déjà posés sur les
conteneurs. `SqueletteContenu` compose `Carte` (donc hérite de
`shadow-posee`/`rounded-carte` depuis l'extension de Carte du lot précédent).

**États** : c'est lui-même l'état de chargement d'un autre composant — il n'a
pas de sous-états.

---

## BandeauInfo (étendu)

Plus gros chantier du lot : 31 paragraphes d'alerte retapés à la main dans
16 fichiers, identifiés en phase 0 comme premier gisement de duplication du
dépôt. 30 migrés ; 1 exclu (raison ci-dessous).

```tsx
type TonBandeau = "info" | "primaire" | "alerte" | "succes" | "danger"; // +2
function BandeauInfo({
  ton?: TonBandeau,
  taille?: "normale" | "compacte",  // nouveau
  children,
  className,
})
```

- **`succes`/`danger` ajoutés** — absents alors que 2 usages réels les
  hébergeaient déjà à la main (`exercices/[id]/page.tsx`, `chat.tsx`).
- **`taille="compacte"`** (`rounded-md px-3 py-2`) reprend la forme des 29
  paragraphes « plats » ; `normale` (inchangée, `rounded-carte px-4 py-2.5`)
  couvre les 2 blocs déjà plus riches.
- **`role="alert"` automatique** pour `alerte`/`danger` — la plupart
  apparaissent après une action ratée et doivent être annoncés.
  `info`/`primaire`/`succes` n'en reçoivent aucun : plusieurs sont du texte
  explicatif statique, toujours affiché (« Archivage, pas suppression »,
  ADR-027), et `role="alert"` dessus annoncerait sans raison à chaque lecture
  d'écran — un rôle live-region ne se pose que sur ce qui apparaît
  dynamiquement en réponse à une action.
- Le composant ne fixe pas de couleur de texte — chacun des 30 sites colore
  son propre texte (`text-danger`, `text-alerte`…), comme avant.

**Exclusion assumée** : `chat.tsx` (~1033-1043), l'avis de bas de panneau du
chat, garde son marquage à la main. Bordure du haut seule, aucun coin
arrondi — un avis de pied de panneau, pas un bandeau encadré. Le forcer dans
`BandeauInfo` aurait changé son rôle visuel, pas juste sa classe.

**Pas de Toast/snackbar.** Le roadmap groupait « Toast/Inline message »,
mais les 31 sites trouvés sont tous des messages en place, jamais des
notifications flottantes qui apparaissent puis s'effacent seules. Aucune
action asynchrone en arrière-plan du produit n'en aurait l'usage — en créer
un aurait été construire par anticipation.

**États** :

| État | Applicable | Mécanisme |
|---|---|---|
| default | oui | ton + taille |
| erreur/alerte | oui, c'est le sujet | `ton="alerte"`/`"danger"`, `role="alert"` auto |
| hover/focus/active | sans objet | un bandeau n'est pas interactif ; s'il contient un bouton/lien, celui-ci porte ses propres états |
| disabled | sans objet | idem |
| chargement | sans objet | un bandeau affiche un état déjà connu, il n'attend rien |
| vide | sans objet | `children` requis |

**Do/Don't** : pour un contenu multi-paragraphes, envelopper dans un
`<div>` unique comme enfant plutôt que plusieurs enfants directs — la base
`flex items-start` de `BandeauInfo` mettrait plusieurs enfants directs en
ligne côte à côte au lieu de les empiler.

---

## TiroirRepliable (Collapsible section)

Le parenthétique du plan (« la flèche ouvrir/fermer des sections de
compétences ») pointait vers un pattern précis : 3 tiroirs d'archives
dupliqués (`gestion.tsx` ×2, `gestion-domaine.tsx` ×1), pas vers
`PanneauPliable` (déjà en place, 1 seul usage, forme différente — carte
complète avec en-tête collant).

```tsx
function TiroirRepliable({
  ouvert: boolean,
  onBasculer: () => void,
  libelle: ReactNode,   // contenu du bouton, à côté de la flèche
  className?: string,    // chrome du bouton — laissé à l'appelant
  children?: ReactNode,  // rendu seulement si ouvert ; facultatif
})
```

**Contrôlé, pas de `useState` interne** — à la différence de
`PanneauPliable`. Deux des trois usages réels gèrent l'état depuis le
parent (plusieurs domaines ouverts à la fois via un `Set`, ou un état
partagé au-delà du composant) ; le troisième (`gestion-domaine.tsx`) ajoute
son propre `useState` en 2 lignes.

**`children` facultatif** — un des trois usages (le tiroir par domaine dans
`gestion.tsx`) ne bascule qu'un drapeau consulté ailleurs, comme condition
de filtre dans une liste voisine : rien à rendre dans le tiroir lui-même.

Le chrome (bordure pointillée ou pleine, fond, rayon, padding) reste au
choix de l'appelant via `className`, posé sur le `<button>` — les 3 usages
réels ont 3 habillages visuellement différents, aucune valeur par défaut
n'aurait convenu aux trois.

**États** : default/ouvert(`aria-expanded`) couverts. hover : oui, via
`className` de l'appelant (pas de valeur par défaut). focus : aucune classe
dédiée, règle globale. disabled/erreur/chargement/vide : sans objet — un
tiroir n'a que deux états, ouvert ou fermé.

**Do/Don't** : ne pas passer le chrome de `PanneauPliable` (carte,
en-tête collant) en copiant sa classe sur `TiroirRepliable` — si un futur
usage a vraiment besoin de ce chrome-là, c'est `PanneauPliable` qu'il faut
utiliser, pas répliquer sa forme ici.

---

## Suite

Reste à traiter en phase 2 : rien — le plan à 8 composants du chantier est
complet. Prochaine étape : revue globale, puis décision sur le câblage
d'`EtiquetteStatut` (dérivation de statut dans `lib/domain/`) et sur une
éventuelle phase 3 (unification des 9 implémentations de modale, relevée en
phase 0 mais explicitement hors périmètre jusqu'ici).
