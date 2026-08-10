# Vue Graphe des Compétences — style Obsidian

## Contexte

La page `/competences` affiche aujourd'hui une **vue liste** par domaine (cartes avec stats agrégées). L'objectif est d'ajouter une **vue graphe interactive** inspirée d'Obsidian, sans toucher à la vue existante. La vue graphe sera accessible via un sélecteur segmenté (`SelecteurSegmente`) sur la page, exactement comme le fait `/seances` avec ses onglets Historique / Progression / Journal / Bibliothèque.

## Principes de design

Le graphe aura **trois niveaux de profondeur**, zoomables :

| Niveau | Nœuds affichés | Arêtes | Interaction |
|--------|----------------|--------|-------------|
| **1 — Catégories** (domaines) | Un gros nœud par `Domaine` | Arêtes inter-domaines dérivées des `prerequis` croisés + thèmes partagés | Clic → zoom sur le domaine (niveau 2) |
| **2 — Compétences** d'un domaine (ou tous) | Un nœud par `Skill` active | Arêtes = `skill.prerequis` + co-appartenance à un même `Theme` | Clic → zoom sur la compétence (niveau 3) |
| **3 — Exercices** liés à une compétence | Nœud central = la compétence, petits nœuds = `Exercise` liés via `exercise.competences` | Arêtes compétence → exercice | Clic sur exercice → lien vers `/exercices` (modale) |

### Visuels des nœuds

- **Domaines** : grands cercles colorés (une teinte par domaine, dérivée de l'indice), libellé centré, taille proportionnelle au nombre de compétences actives.
- **Compétences** : cercles moyens, couleur selon le niveau (palette `--st-*` existante : inconnu, débutant, intermédiaire, avancé, expert, maître), code affiché, halo de pulsation si dernière preuve < 7 jours.
- **Exercices** : petits losanges, couleur selon difficulté (1-5), titre tronqué.

### Physique du graphe

Force-directed layout (simulation de forces) implémenté en **Canvas 2D pur** (pas de lib externe) :
- Répulsion Coulomb entre tous les nœuds
- Attraction ressort sur chaque arête
- Gravité légère vers le centre
- Amortissement progressif → le graphe se stabilise en ~2 secondes
- Drag & drop d'un nœud
- Zoom molette + pan click-drag sur le fond

> [!IMPORTANT]
> **Pas de dépendance externe.** Le projet est minimaliste (React, Next.js, Supabase, Tailwind). Le graphe sera rendu sur un `<canvas>` avec un moteur de forces écrit à la main (~300 lignes). C'est volontaire : d3-force pèserait ~30 kB gzippé et ne serait utilisé que pour un écran.

## User Review Required

> [!IMPORTANT]
> **Pas de nouvelle table en base.** Toutes les données nécessaires existent déjà :
> - Domaines → `Referentiel.domaines`
> - Compétences → `Referentiel.actifs` (avec `prerequis`, `palier`, `importance`)
> - Exercices → `Collections.exercises` (avec `competences[]`, `difficulte`)
> - Thèmes → `chargerThemes()` (avec `codes[]`)
> - États → `SkillState[]` (avec `niveau`, `score`, `preuves`)
>
> Le graphe est purement dérivé — il ne stocke rien, conformément au P1 du protocole.

> [!WARNING]
> **Performance.** Le graphe tourne entièrement côté client (`"use client"`). Les données sont sérialisées en props par le Server Component parent. Avec ~80 compétences et ~60 exercices, la simulation force-directed reste fluide sur un `requestAnimationFrame` sans Web Worker.

## Open Questions

> [!IMPORTANT]
> **Couleurs des domaines.** Aujourd'hui les domaines n'ont pas de couleur attitrée. Faut-il :
> 1. Attribuer les couleurs automatiquement par index (teinte HSL tournante) — recommandé
> 2. Ajouter un champ `couleur` au type `Domaine` (nécessiterait une migration)
>
> Le plan ci-dessous part sur l'option 1.

> [!IMPORTANT]
> **Interactions croisées liste ↔ graphe.** Le clic sur un nœud compétence dans le graphe pourrait :
> 1. Naviguer vers `/competences/[code]` (page détail existante) — recommandé
> 2. Ouvrir un panneau latéral superposé au graphe
>
> Le plan part sur l'option 1 avec un simple `router.push`.

## Proposed Changes

### Route — page Compétences

#### [MODIFY] [page.tsx](file:///c:/Users/hupch/Documents/max/app/src/app/(app)/competences/page.tsx)

Ajouter le `SelecteurSegmente` dans l'en-tête de page pour basculer entre `?vue=liste` (défaut) et `?vue=graphe`. Le pattern est calqué sur [page.tsx de seances](file:///c:/Users/hupch/Documents/max/app/src/app/(app)/seances/page.tsx) :

```diff
+import { SelecteurSegmente } from "@/components/ui/primitives";
+
+type Vue = "liste" | "graphe";
+const VUES: { cle: Vue; libelle: string }[] = [
+  { cle: "liste", libelle: "Liste" },
+  { cle: "graphe", libelle: "Graphe" },
+];
+
 export default async function PageCompetences(
+  props: { searchParams: Promise<{ vue?: string }> }
 ) {
+  const { vue: vueBrute } = await props.searchParams;
+  const vue: Vue = vueBrute === "graphe" ? "graphe" : "liste";
   ...
   <EntetePage
     titre="Compétences"
     sousTitre="..."
+    actions={<SelecteurSegmente ... />}
   />
-  <Suspense><ContenuCompetences /></Suspense>
+  <Suspense>
+    {vue === "graphe"
+      ? <ContenuGraphe />
+      : <ContenuCompetences />}
+  </Suspense>
```

Le composant `ContenuGraphe` (nouveau, Server Component) charge le contexte et passe les données sérialisées au composant client `GrapheCompetences`.

---

### Composant principal — moteur du graphe

#### [NEW] [graphe-competences.tsx](file:///c:/Users/hupch/Documents/max/app/src/components/competences/graphe-competences.tsx)

Composant **client** (`"use client"`) — le cœur du graphe. Environ 600 lignes.

**Props** (données sérialisables depuis le serveur) :
```ts
interface NoeudDomaine {
  id: string;
  nom: string;
  prefixe: string;
  nombreCompetences: number;
  scoreMoyen: number | null;
}

interface NoeudCompetence {
  code: string;
  intitule: string;
  domaineId: string;
  palier: Palier;
  niveau: NiveauCompetence | null;
  score: number | null;
  nombrePreuves: number;
  prerequis: string[];
  dernierePreuve: string | null;
}

interface NoeudExercice {
  id: string;
  titre: string;
  difficulte: Difficulte;
  competences: string[];
  domaineId: string;
}

interface LienTheme {
  themeId: string;
  libelle: string;
  codes: string[];
}

interface PropsGraphe {
  domaines: NoeudDomaine[];
  competences: NoeudCompetence[];
  exercices: NoeudExercice[];
  themes: LienTheme[];
}
```

**Structure interne :**

1. **État React** : `niveauZoom: "categories" | "competences" | "exercices"`, `focusId: string | null` (domaine ou compétence en focus), `camera: { x, y, zoom }`.

2. **Moteur de forces** (dans un `useRef`) :
   - Tableau de nœuds `{ id, x, y, vx, vy, rayon, type, data }`.
   - Tableau d'arêtes `{ source, target, force }`.
   - Boucle `requestAnimationFrame` :
     - Calcul des forces (répulsion N², attraction linéaire, gravité).
     - Intégration Verlet.
     - Dessin Canvas.
   - Amortissement `velocity *= 0.92` → convergence en ~120 frames.

3. **Rendu Canvas** :
   - Fond : grille de points subtile (style Obsidian).
   - Arêtes : lignes courbes (quadratic Bézier) avec opacité variable.
   - Nœuds : cercles avec dégradé radial, libellé en texte Canvas.
   - Nœud survolé : halo lumineux, info-bulle.
   - Transition zoom : interpolation linéaire de la caméra sur 300ms.

4. **Interactions** :
   - **Molette** → zoom.
   - **Clic-drag fond** → pan.
   - **Clic-drag nœud** → déplace le nœud (fixé le temps du drag).
   - **Clic nœud domaine** → zoom niveau 2 (filtre sur ce domaine).
   - **Clic nœud compétence** → zoom niveau 3 (montre exercices liés) OU double-clic → navigation `/competences/[code]`.
   - **Clic nœud exercice** → navigation interne (le composant appelant peut décider).
   - **Bouton « Retour »** flottant → remonte d'un niveau de zoom.

5. **Disposition initiale** :
   - Niveau catégories : nœuds placés en cercle, puis 30 itérations de simulation.
   - Niveau compétences : groupées par domaine, positions initiales en cluster, puis simulation.
   - Niveau exercices : étoile autour de la compétence centrale.

---

### Logique de construction du graphe

#### [NEW] [graphe-donnees.ts](file:///c:/Users/hupch/Documents/max/app/src/components/competences/graphe-donnees.ts)

Fichier **pur** (pas de React), importé côté serveur par `ContenuGraphe` pour sérialiser les props.

```ts
export function construireGraphe(
  referentiel: Referentiel,
  etats: SkillState[],
  exercices: Exercise[],
  themes: Theme[],
): PropsGraphe { ... }
```

Dérive les arêtes :
- **Prerequis** : `skill.prerequis` → arête directionnelle compétence → compétence.
- **Thèmes** : pour chaque `Theme`, crée des arêtes entre toutes les paires de `codes` (clique complète, ou simplement un hub-nœud « thème » relié à chaque code).
- **Exercice ↔ Compétence** : `exercise.competences` → arêtes.
- **Inter-domaines** : si deux domaines partagent un thème ou un lien de prérequis croisé → arête domaine ↔ domaine.

---

### Styles

#### [MODIFY] [globals.css](file:///c:/Users/hupch/Documents/max/app/src/app/globals.css)

Ajout minimal : le conteneur du canvas doit être `position: relative` et prendre toute la hauteur disponible. Un `min-height: 500px` évite un canvas aplati.

```css
.graphe-conteneur {
  position: relative;
  width: 100%;
  min-height: 500px;
  height: calc(100vh - 12rem);
  border-radius: var(--rayon-carte);
  border: 1px solid var(--bordure);
  background: var(--surface);
  overflow: hidden;
}
```

---

### Palette de couleurs domaines

#### [NEW] [couleurs-domaines.ts](file:///c:/Users/hupch/Documents/max/app/src/lib/ui/couleurs-domaines.ts)

Petit utilitaire qui attribue une teinte HSL à chaque domaine par index :

```ts
export function couleurDomaine(index: number, total: number): string {
  const hue = (index / total) * 360;
  return `hsl(${hue}, 55%, 55%)`;
}

export function couleurDomaineClaire(index: number, total: number): string {
  const hue = (index / total) * 360;
  return `hsl(${hue}, 45%, 85%)`;
}
```

Utilisé par le moteur Canvas pour colorer les nœuds par domaine.

---

## Résumé des fichiers

| Action | Fichier | Rôle |
|--------|---------|------|
| MODIFY | `app/(app)/competences/page.tsx` | Ajoute le sélecteur de vue liste/graphe, le Server Component `ContenuGraphe` |
| NEW | `components/competences/graphe-competences.tsx` | Composant client — canvas, moteur de forces, interactions |
| NEW | `components/competences/graphe-donnees.ts` | Construction pure des données du graphe depuis le contexte |
| NEW | `lib/ui/couleurs-domaines.ts` | Attribution automatique de couleurs par domaine |
| MODIFY | `app/globals.css` | Classe `.graphe-conteneur` |

## Verification Plan

### Automated Tests

```bash
cd app && npx vitest run --reporter=verbose
```

Le fichier `graphe-donnees.ts` étant pur, il sera testable unitairement (vérification des arêtes dérivées des prérequis et des thèmes). Le composant Canvas sera vérifié manuellement.

### Manual Verification

1. `npm run dev` → naviguer sur `/competences`.
2. Vérifier que la vue **Liste** (défaut) est intacte.
3. Cliquer sur « Graphe » → le canvas s'affiche, les nœuds-domaines apparaissent et se stabilisent.
4. Cliquer sur un domaine → zoom sur ses compétences, arêtes de prérequis visibles.
5. Cliquer sur une compétence → zoom sur ses exercices liés.
6. Bouton retour → remonte d'un niveau.
7. Drag & drop d'un nœud.
8. Zoom molette, pan clic-drag sur le fond.
9. Double-clic sur une compétence → navigation vers `/competences/[code]`.
10. Vérifier sur mobile : le canvas prend toute la largeur, le touch fonctionne.
