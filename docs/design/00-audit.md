# Audit design system — Phase 0

Lecture seule. Périmètre : `app/src` (164 fichiers `.ts`/`.tsx`, 37 194 lignes).
Aucune modification de code dans cette phase.

Base technique : Tailwind v4 (config CSS-first, pas de `tailwind.config.*`),
tokens dans `src/app/globals.css` (373 lignes), aucune librairie UI tierce,
graphiques SVG écrits à la main. Couche « design system » actuelle :
`src/components/ui/` (873 lignes) face à 11 729 lignes de composants
consommateurs — **7,4 %** du code composants est primitive partagée.

---

## 1. Inventaire des composants

| Élément | Composant partagé | Usages du composant | Copies divergentes trouvées |
|---|---|---|---|
| Carte | `Carte` (`ui/primitives.tsx:12`) | 55 / 17 fichiers | 26 divs « carte » non typées (`competences/page.tsx:220`, `login/page.tsx:47`, `dev/profil-contenu.tsx` ×6, `layout/squelette.tsx:27`) |
| Bouton | pas de composant — factory `classesBouton()` (`primitives.tsx:366`), 3 variantes × 2 tailles | 87 appels / 27 fichiers ; 142 balises `<button>` / 32 fichiers | 7 fichiers en `<button>` brut ; `layout/compte.tsx` invente une 4ᵉ variante « danger » et une hauteur `h-8` hors échelle (`h-7`/`h-9`) ; `login/formulaire.tsx:106` retype à la main la variante « secondaire » |
| Badge / pastille | `Etiquette` (6 tons), `TagConfiance`, `CodeCompetence` | 46 / 14 fichiers | pastille de statut `animate-pulse` dupliquée verbatim dans 8 fichiers ; badge de compteur dupliqué (`dev-todo.tsx:575` / `profil-flottant.tsx:155`, chaînes identiques) ; pilule de filtre `Puce`, locale à `exercices/page.tsx:482`, non partagée |
| Modale | aucun composant | 9 implémentations indépendantes | 6 fichiers partagent une chaîne d'overlay identique retapée à la main (`modale-evolution.tsx:208`, `modale-exercice.tsx:209`, `compte.tsx:228`, `modale-competence.tsx:134`, `modale-referentiel.tsx:189`, `modale-revision.tsx:203`) ; `dev-todo.tsx` diverge avec 2 opacités/flous différents et `z-[100]` au lieu de `z-50` ; couleur d'overlay `bg-black/*` non tokenée (seule couleur de l'app sans variante clair/sombre) |
| Onglets | **inexistant** — 0 occurrence de `role="tab"` | 0 | 2 « sélecteurs segmentés » remplissent ce rôle sans le déclarer : `competences/page.tsx:56` et `panneau-progression.tsx:47`, classes identiques, écrites deux fois |
| Barre de progression | `BarreProgression` (`primitives.tsx:256`) | 1 usage (`competences/[code]/page.tsx:177`) | second système de barre empilée indépendant dans `charts/index.tsx:448` |
| Jauge de niveau | `JaugeNiveau` (`primitives.tsx:229`) | 3 usages | aucune |
| Infobulle | définie localement dans `charts/index.tsx:30`, non exportée de `ui/` | usage interne aux graphiques uniquement | aucun composant partagé pour un usage hors graphique |
| Alerte / bandeau | `BandeauInfo` (3 tons : info/primaire/alerte — **pas de ton succès ni danger**) | 4 / 2 fichiers | **33 occurrences** dans ~20 fichiers d'un paragraphe d'alerte retapé à la main au même patron (`rounded-* border … bg-*-faible … text-*`) sans passer par `BandeauInfo` ; 1 seule sur 33 pose `role="alert"` |
| Champ texte | aucun composant — 6 constantes locales `champ = "…"` | 40 balises `<input>` / 15 fichiers | 3 valeurs littérales divergentes (bordure, fond, taille de texte, présence d'un `focus:ring`) réparties sur 6 fichiers ; une 4ᵉ variante inline (non même constante) dans `compte.tsx` ×3 |
| Tableau | aucun composant | 2 fichiers (`dev/profil-contenu.tsx`, rendu markdown) | sans objet |
| État vide | `EtatVide` (`primitives.tsx:328`) | 5 / 5 fichiers | 52 occurrences du mot « Aucun » au total ; la majorité en `<p>` brut hors du composant |
| Chargement | pas de spinner (0 occurrence `animate-spin`) — squelette partagé `layout/squelette.tsx` | squelette utilisé comme `loading.tsx` de `(app)` | motif « points qui pulsent » (`animate-pulse`) redupliqué dans 12 fichiers |
| Icônes | `Svg` + 15 `Icone*` (`ui/icones.tsx`), style cohérent (`strokeWidth=1.5`, `viewBox 24×24`) | 15 composants | tailles d'appel fragmentées : 8 paliers distincts en usage (`size-1` à `size-8` + 6 valeurs `size-[…]` arbitraires) sans échelle documentée |
| Élément de navigation | aucun composant partagé — `sidebar.tsx` et `nav-mobile.tsx` réimplémentent chacun leurs états | — | sidebar : 2 rayons/paddings/tailles de police différents entre groupe primaire et secondaire, dans le même composant |

---

## 2. Couverture des tokens

Tokens existants dans `globals.css` : couleur (jeu complet clair/sombre + échelle
séquentielle `--niveau-0`…`--niveau-5`), 2 ombres (`--ombre-carte`,
`--ombre-surcouche`), 3 familles de police. **Un seul rayon tokené**
(`--radius-carte`). **Aucune échelle d'espacement ni de taille de texte
tokenée.**

| Catégorie | Compte | Détail |
|---|---|---|
| Hex bruts (`.tsx`) | 5, dans 2 fichiers | 4 sont les couleurs de marque Google (`login/formulaire.tsx`) ; 1 est `compte.tsx:183` `bg-[#d99a3f]` — duplique littéralement le token sombre `--alerte` au lieu de le référencer |
| `rgba()`/`hsl()` bruts (`.tsx`) | 0 | tout passe par les modificateurs d'opacité Tailwind sur token |
| `style={{...}}` inline | 9, dans 2 fichiers | `primitives.tsx` (jauge, barre), `charts/index.tsx` (positions/segments SVG) |
| Valeurs arbitraires entre crochets (`text-[…]`, `size-[…]`, etc.) | **197, dans 44 fichiers** | dominées par `text-[0.6875rem]` (11px, **133 occurrences**) et `text-[0.625rem]` (10px, **34 occurrences**) — deux paliers de texte non nommés utilisés partout en lieu de token |
| Rayons arbitraires (`rounded-[…]`) | 3 | `charts/index.tsx` ×2, `primitives.tsx:244` |
| Répartition `rounded-*` | `rounded-md` 133 · `rounded-full` 33 · `rounded-carte` (le token) 19 · `rounded-xl` 10 · `rounded-lg` 10 · `rounded-sm` 1 | le token dédié est minoritaire face à `rounded-xl` non tokené utilisé pour la même forme « panneau de carte/modale » |
| Ombres arbitraires (`shadow-[…]`) | 13, tous référencent `var(--ombre-*)` | aucune valeur d'ombre brute hors token |
| `font-weight` | `font-medium` 156 · `font-semibold` 43 · `font-normal` 4 · `font-bold` 3 | toutes via classes nommées, aucune valeur numérique arbitraire |
| Opacité `disabled:` | 3 valeurs différentes pour le même état | `opacity-50` (5 fichiers), `opacity-40` (1), `opacity-60` (1) |

---

## 3. Complétude des états

Règle globale unique (`globals.css:237`) : `:focus-visible { outline: 2px solid
var(--primaire) }` appliquée par défaut à tout élément.

| Composant | default | hover | focus (au-delà de la règle globale) | active | disabled | loading | error | empty |
|---|---|---|---|---|---|---|---|---|
| `classesBouton` | ✅ 3 variantes | ✅ par variante | ❌ | ❌ | ✅ `opacity-50` | ❌ pas de variante intégrée, aucun spinner n'existe | — | — |
| `<button>` hors `classesBouton` (7 fichiers) | ✅ | ✅ (retapé à la main) | ❌ (0/7) | 4 occurrences au total, 3 fichiers | présent dans 2/7 fichiers seulement | — | — | — |
| `<input>` (constantes `champ`) | ✅ | sans objet | ✅ dans 4 variantes sur 6 ; 1 variante ajoute `focus:ring-1` que les autres n'ont pas | — | 1 seul usage sur 40 balises `<input>` définit un style disabled | — | ❌ aucun style d'erreur porté par le champ lui-même (le retour d'erreur est un `<p>` frère, cf. le patron d'alerte à 33 occurrences) | — |
| `Etiquette` | ✅ 6 tons | non applicable (span non interactif) | — | — | — | — | ton `danger` disponible | — |
| `Carte` cliquable | ✅ | dépend de chaque appelant, rien d'intégré | ❌ | ❌ | — | — | — | — |
| `LigneListe` | ✅ | ✅ intégré | ❌ | ❌ | — | — | — | — |
| Nav sidebar | ✅ | implicite | ❌ | `aria-current`, pas de `:active` | — | — | — | — |
| Nav mobile | ✅ | ✅ (inactif seulement) | ❌ | `aria-current` + barre positionnée | — | — | — | — |

Faits transverses : `focus-visible:` explicite présent dans **1 fichier sur
164** ; `active:` présent dans **3 fichiers, 4 occurrences** ; aucun composant
ne porte de classe d'état « chargement » dédiée (`aria-busy` : 2 occurrences,
toutes dans `squelette.tsx`).

---

## 4. Incohérences de nommage et duplications entre pages

Pages sous `src/app/(app)/` : accueil, `exercices/` (+ `[id]`), `competences/`
(+ `[code]`, `domaine/[id]`, `referentiel`), `demarrer/`, `journal/`,
`profil/`, `progression/`, `tuteur/`.

1. **Sélecteur segmenté écrit deux fois**, classes strictement identiques,
   sans composant commun : `competences/page.tsx:56` (bascule de vue) et
   `panneau-progression.tsx:47` (`SelecteurPeriode`).
2. **Pilule de filtre divergente par page** : `exercices/page.tsx` définit son
   propre `Puce` local (non exporté, ligne 482) ; `competences/page.tsx`
   n'en hérite pas et réécrit une forme différente (bordure par item vs
   wrapper segmenté, `text-[0.6875rem]` vs `text-xs`).
3. **Paragraphe d'alerte dupliqué 33 fois** au lieu de `BandeauInfo` — plus
   gros gisement de duplication trouvé (détail : voir §1, ligne Alerte).
4. **Constante `champ` dupliquée dans 6 fichiers**, 3 valeurs littérales
   différentes (voir §1, ligne Champ texte).
5. **Chrome de modale dupliqué dans 6+ fichiers** (overlay + panneau), avec
   divergence d'opacité/flou/z-index dans `dev-todo.tsx`.
6. **Pastille « en train de… » dupliquée verbatim 8 fois** au lieu d'être
   extraite.
7. **Variante bouton « danger » existe seulement dans `compte.tsx`**
   (lignes 373, 604), absente de `classesBouton` — tout futur bouton
   destructeur ailleurs devra la reconstruire de zéro comme `compte.tsx`
   l'a fait.

---

## 5. Échelle du chantier

- `src/components/**/*.tsx` : **51 fichiers, 11 729 lignes**.
- Plus gros fichiers : `tuteur/chat.tsx` (1183 lignes), `dev/dev-todo.tsx`
  (815), `layout/compte.tsx` (678), `referentiel/gestion.tsx` (649),
  `exercices/modale-exercice.tsx` (542), `referentiel/modale-revision.tsx`
  (488).
- Couche primitives (`ui/`) : 873 lignes, soit 7,4 % du code composants.
- `src/app` (routes) : 3057 lignes ; `src/lib` : 20 397 lignes.

---

## Score : 38/100

Base de tokens couleur/ombre/police réelle et globalement respectée (peu de
hex bruts, aucune ombre brute, poids de police 100 % tokené). Le score est
tiré vers le bas par trois choses mesurées, pas esthétiques : la couche
partagée ne pèse que 7,4 % du code composants, l'état focus/disabled/loading
n'est géré que par une poignée de fichiers sur 164, et le motif le plus
fréquent de l'interface (l'alerte, 37 occurrences totales) n'utilise le
composant partagé que dans 4 cas sur 37.

---

## 3 actions prioritaires (impact / effort)

1. **Faire passer les 33 alertes inline par `BandeauInfo`.** Composant déjà
   écrit et déjà testé en production sur 4 sites ; il manque un ton
   `danger`/`succes` (2 lignes) puis un remplacement mécanique dans ~20
   fichiers. Plus gros gisement de duplication du dépôt, gain immédiat sur
   `role="alert"` (1 seul cas sur 33 le pose aujourd'hui).
2. **Unifier les 6 constantes `champ` en un seul composant `<Champ>` dans
   `ui/primitives.tsx`.** 6 fichiers à toucher, 3 valeurs divergentes à
   trancher (bordure, fond, présence du `focus:ring`) puis import partagé.
   Effort borné et localisé, élimine une divergence visuelle vérifiable au
   clavier (focus incohérent d'un formulaire à l'autre).
3. **Extraire un composant Modale commun aux 9 implémentations
   actuelles.** Effort plus élevé (9 fichiers, dont `dev-todo.tsx` qui
   diverge le plus) mais c'est le seul des trois où la duplication porte un
   risque fonctionnel, pas seulement visuel : rien n'indique qu'Échap, le
   piège de focus ou `aria-modal` sont posés de façon uniforme sur les 9
   copies — à vérifier composant par composant avant refonte.
