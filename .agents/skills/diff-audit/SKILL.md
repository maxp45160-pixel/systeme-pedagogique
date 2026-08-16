---
name: diff-audit
description: Analyse le git diff actif pour détecter le code mort, les problèmes de logique, les régressions / fallbacks d'anciennes logiques à éliminer pour unifier le code, les opportunités d'optimisation de performance, la sur-ingénierie et le respect des invariants d'architecture du projet, puis génère un rapport détaillé.
---

# Skill : Analyse et Revue de Diff Git (`diff-audit`)

Ce skill s'active lorsque l'utilisateur demande une analyse du git diff, une revue de code, une détection de code mort ou d'optimisations, une traque des régressions / fallbacks d'anciennes logiques à éliminer pour converger vers une logique unifiée, une vérification des simplifications / sur-ingénierie, ou une vérification des modifications en cours avant commit ou PR.

---

## Protocoles et Étapes d'Exécution

### 1. Extraction et ciblage des modifications
1. Récupérer les modifications non commitées et staggées à l'aide de la commande git appropriée :
   - `git diff HEAD` (ou `git diff` et `git diff --cached`).
   - Si l'utilisateur précise une branche cible (ex: `main`), utiliser `git diff main...HEAD`.
2. Lister explicitement les fichiers modifiés, créés ou supprimés.

### 2. Inspection du contexte complet (Anti Snippet Tunnel Vision)
- Ne jamais se baser uniquement sur les snippets fournis par `git diff`.
- Pour chaque fichier modifié, inspecter le contexte environnant dans le fichier source ([view_file](file:///...)) afin de comprendre le type des variables, la signature des fonctions, les imports et les sites d'appel.

### 3. Grille d'Analyse Multi-Axes

#### A. 🗑️ Code Mort & Nettoyage (Dead Code)
- **Imports inutilisés** ou devenus obsolètes après modification.
- **Variables, constantes, paramètres de fonction ou types** déclarés mais jamais lus.
- **Fonctions / Composants orphelins** dont plus aucun appel n'existe.
- **Code temporaire** : `console.log`, `debugger`, `alert`, ou blocs de code commentés laissés par inadvertance.

#### B. 🔄 Régressions, Fallbacks d'Anciennes Logiques & Logique Unifiée
- **Élimination des fallbacks d'anciennes logiques** : Détecter les branches de secours (`fallback`, `compat`, `legacyMode`, conditions ternaires de repli) qui maintiennent artificiellement d'anciens comportements périmés ou obsolètes.
- **Éradication des doubles chemins (Split / Dual Logic)** : Refuser les solutions hybrides où l'ancienne et la nouvelle logique coexistent en parallèle ; exiger et proposer la suppression complète de l'ancien chemin pour converger vers une **seule logique unifiée**.
- **Traque des régressions silencieuses** : Repérer les retours en arrière involontaires, les valeurs par défaut qui réactivent des comportements dépréciés, ou les catch-all qui masquent les erreurs au lieu d'appliquer la nouvelle logique canonique.
- **Migration intégrale des appelants** : S'assurer que tous les points d'entrée et sites d'appel sont migrés vers la nouvelle logique unifiée plutôt que de conserver des couches d'adaptation intermédiaires / béquilles techniques.
- **Règle d'or** : *Toute validation ou règle métier partagée doit avoir une seule implémentation canonique.*

#### C. 🐛 Erreurs Logiques, Edge Cases & Robustesse
- **Null Safety & Undefined** : Propriétés accédées sans optional chaining (`?.`) ou sans vérification préalable.
- **Conditions aux limites** : Erreurs d'indices (off-by-one), inversions logiques (`!` mal placé), comparaisons de types (`==` vs `===`).
- **Gestion de l'asynchronisme** : Promesses non attendues (`await` manquant), absence de `try/catch` sur les appels réseau / I/O.
- **Mutations d'état** : Mutations directes d'objets ou tableaux dans React / Zustand / Redux.
- **Rupture de contrats** : Modification d'une signature de fonction sans mise à jour de l'ensemble de ses sites d'appel.

#### D. ⚡ Optimisations & Performance
- **Rendus React superflus** : Manque de `useCallback`/`useMemo` sur des fonctions/objets complexes passés en props, ou tableaux de dépendances instables dans `useEffect`.
- **Calculs redondants** : Traitements lourds exécutés à chaque rendu ou au sein de boucles sans mémoïsation.
- **Requêtes I/O & Allocations** : Requêtes DB/API répétées inutilement ou création d'objets volumineux en boucle.

#### E. 🧩 Simplicité & Sur-Ingénierie (Over-engineering / Simplifications)
- **Abstractions prématurées & Sur-généralisation** : Création d'interfaces, types génériques, wrappers ou indirection pour des besoins uniques ou non encore requis ("YAGNI / Don't build for anticipation").
- **Complexité excessive** : Traitements ou structures de contrôle inutilement tortueux (ex: conditionnelles imbriquées exagérées, gestionnaires d'état lourds pour une valeur locale simple).
- **Réinvention de la roue** : Code custom réécrivant des utilitaires déjà existants dans le projet (`lib/`) ou dans les APIs natives / bibliothèques du projet.
- **Simplification syntaxique & Lisibilité** : Code verbeux qui gagne à être rationalisé (ex: simplification de ternaires, destructuring, fonctions fléchées directes) sans perte de clarté ni de sûreté.

#### F. 🏛️ Conformité aux Invariants du Projet (`AGENTS.md`)
- **Règle des 6 Couches** :
  - Couche 1 (*Connaît*) & Couche 2 (*Observe*) : Stocké, jamais calculé.
  - Couche 3 (*Décide*) : Dérivé, recalculable — **NE SE STOCKE JAMAIS**.
  - Frontière stricte : 1 et 2 ne se recalculent pas, 3 ne se stocke pas.
- **Organisation des modules** :
  - `lib/domain/` → logique métier pure.
  - `lib/engine/` → calculs et recommandations.
  - `lib/store/` → persistance.
  - `lib/tutor/` → tuteur IA.
- **Sécurité Supabase & RLS** : Ne jamais exposer `service_role` au client.
- **Validation des données** : Les données venant de l'extérieur ou de Supabase doivent être validées avant d'entrer dans le moteur.
- **Unicité des règles métier** : Toute validation métier partagée doit avoir une seule implémentation.

---

## Format du Rapport Restitué

Générer un rapport clair, structuré et directement exploitable. Le rapport doit utiliser des liens cliquables vers les fichiers (`file:///...#LX-LY`) pour chaque remarque.

### Structure du Rapport

```markdown
# 🔍 Rapport de Revue de Diff (`diff-audit`)

## 📊 Résumé Exécutif
- **Fichiers impactés** : X fichiers
- **Niveau de risque** : 🟢 Faible / 🟡 Moyen / 🔴 Élevé
- **Synthèse** : [Courte phrase résumant l'état des modifications]

## 🔴 Problèmes Logiques & Bugs Potentiels
- **[NomComposant/Fichier](file:///path/to/file.tsx#L42)** : Explication du problème et du risque de crash/comportement inattendu.

## 🔄 Régressions, Fallbacks & Logiques Hybrides à Éliminer
- **[Fichier](file:///path/to/file.ts#L18-L30)** : Détection d'un fallback/double chemin issu d'une ancienne logique, proposition concrète pour l'éliminer et basculer sur la logique unifiée.

## 🏛️ Invariants Métier & Architecture (`AGENTS.md`)
- **[Fichier](file:///path/to/file.ts#L12)** : Respect des 6 couches, non-stockage de données dérivées, typage strict.

## 🧩 Simplicité & Sur-Ingénierie (Over-engineering)
- **[Fichier](file:///path/to/file.ts#L25-L40)** : Abstractions superflues, indirection inutile ou simplification possible.

## 🗑️ Code Mort & Nettoyage
- **[Fichier](file:///path/to/file.ts#L10-L15)** : Imports inutilisés, variables mortes, console.log restant.

## ⚡ Opportunités d'Optimisation
- **[Fichier](file:///path/to/file.tsx#L80)** : Optimisations de rendu, réallocations ou mémoïsation.

## 💡 Propositions de Correctifs (Diffs Recommandés)
```diff
// Exemple de suppression de fallback au profit d'une logique unifiée
- const data = legacyFallback ? oldCalculation(store) : newCalculation(store);
+ const data = unifiedCalculation(store);
```
```

---

## Consignes Générales
- Si aucun problème n'est détecté sur un axe donné, l'indiquer brièvement (ex: "✅ Aucun fallback d'ancienne logique ou code mort détecté.").
- Prioriser les remarques par ordre de criticité :
  1. Bugs logiques, erreurs & crashes potentiels.
  2. Régressions, fallbacks d'anciennes logiques & unification de la logique.
  3. Invariants métier et architecture (`AGENTS.md`).
  4. Sur-ingénierie et simplifications.
  5. Code mort et nettoyage.
  6. Optimisations de performance.
