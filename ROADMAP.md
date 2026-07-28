# ROADMAP.md — Système pédagogique

**Version 2.0 — 28/07/2026.** Réécrite autour de la boucle après le chantier de
décomplexification (ADR-013). La version 1.0, organisée autour de 12 souhaits
recensés, est dans l'historique git.

> **Ce document fixe l'ordre de travail et les conditions de déclenchement.**
> Il ne décide rien : les décisions sont dans `ARCHITECTURE_DECISIONS.md`.

---

## Le fait qui commande l'ordre

```
génération d'exercices  →  évaluation de la compétence  →  ajustement
       ⛔ arrêtée                  ✅ fonctionne             ❌ n'existe pas
```

En production au 28/07 : **0 exercice créé**, les 11 diagnostics tous
consommés, 20 preuves enregistrées. L'appareil de mesure marche. Il n'y a plus
rien à mesurer.

**Rien ne passe avant de rouvrir le premier maillon.**

---

## Ordre de travail

### 1. Faire tourner la boucle sur le périmètre pilote — *en cours*

**Objectif :** qu'un exercice proposé par le tuteur soit validé, fait, et
produise une preuve qui déplace un niveau de LOG.

**Conditions déjà remplies** (chantier du 28/07) :
- le terrain est dégagé — 6 entités mortes, la gamification, le mode démo et la
  dorsale locale ont été retirés ;
- l'écran de création est devenu un écran de **validation** d'une proposition ;
- le périmètre est borné à 9 compétences ;
- les marqueurs de proposition ne peuvent plus se désynchroniser en silence.

**Ce qui reste à faire :** exécuter la boucle en vrai, plusieurs fois.

⚠️ **Condition de sortie — une mesure, pas une impression :** 5 exercices
générés par le tuteur, validés et faits, produisant 5 preuves sur au moins
3 compétences distinctes de LOG. Tant que ce n'est pas atteint, rien d'autre ne
commence.

### 2. Choisir le moteur gratuit — *en parallèle de 1*

❓ ADR-007 laisse ouverte la question du fournisseur. Elle se résout **par
mesure**, avec le test de réfutation inscrit dans l'ADR : 10 échanges réels,
plus d'une violation du protocole disqualifie le moteur.

**Condition de déclenchement :** dès que l'étape 1 produit des échanges réels.
Les deux avancent ensemble — c'est en générant des exercices qu'on mesure si un
moteur tient le protocole.

**Fait acquis :** le contexte tourne autour de 28 Ko (~7 K jetons) et reste
dominé par les 20 Ko de protocole. C'est le budget à respecter dans le choix.

### 3. Poser le 3ᵉ maillon — *déclenché par 1*

Le maillon « ajustement des exercices » n'existe nulle part. ADR-014 inscrit la
condition de sa reprise : la difficulté doit être **dérivée des preuves**,
conformément à ADR-001, et non ressaisie à la main — c'est précisément ce qui
n'a jamais fonctionné avec l'entité `ErrorItem`, restée vide.

**Condition de déclenchement :** l'étape 1 est atteinte, donc il existe des
preuves récentes sur lesquelles dériver quelque chose.

**Ne pas anticiper le modèle de données** avant d'avoir vu, sur des preuves
réelles, ce qui distingue un exercice bien calibré d'un autre.

### 4. Trancher les deux principes en défaut — *sans blocage, mais avant 6*

❓ **ADR-006** — le score global compte les non-mesurées comme des zéros. Le
périmètre pilote fait passer le rapport de 12/43 à 6/9 : l'écart persiste mais
n'est plus dominant. **Corriger un indicateur est trivial aujourd'hui et devient
un changement observable par tous une fois le produit généralisé.**

❓ **ADR-008** — l'autonomie ignore l'aide externe. C'est le défaut le plus
grave identifié : il touche l'entrée de la chaîne, pas son agrégation. Une
question posée au bilan (« aide extérieure utilisée ? ») suffirait, mais elle
amende le protocole d'évaluation §5 — donc elle se décide, elle ne s'improvise
pas.

### 5. Élargir le périmètre — *déclenché par 1 et 3*

Ajouter un domaine, puis les autres. **Condition :** la boucle produit du
contenu plus vite qu'il n'est consommé. L'élargir avant ramènerait exactement la
situation du 28/07 — 31 compétences sur 43 sans support de travail.

### 6. Généraliser le référentiel — *reporté*

❓ ADR-009. Volontairement non traité : généraliser figerait simultanément trois
modèles non validés — la granularité du référentiel, le calcul du score
(ADR-006) et le barème de recommandation (ADR-005).

**Ordre imposé :** ADR-004 (contenu) → ADR-006 (score) → ADR-009.

**Prérequis matériel non contesté :** l'édition du profil utilisateur
(`formation`, objectifs, préférences). Les colonnes existent en base, **rien
dans l'interface ne les renseigne**.

---

## Ce qui n'est pas au programme, et pourquoi

| Idée | Statut |
|---|---|
| Rétablir XP, paliers, badges | 🗑️ Supprimés le 28/07 (ADR-017). Ne pas reproposer sans fait nouveau sur la motivation. |
| Rétablir le mode démonstration | 🗑️ Supprimé (ADR-016) : il conditionnait la moitié de la surface interactive. |
| Rétablir la dorsale JSON locale | 🗑️ Supprimée (ADR-015) : source documentée d'analyses fausses, et seul chemin d'écriture non authentifié. |
| Rendre aux filtres d'exercices leur richesse | ⏳ Quand le stock dépassera ~20 exercices, pas avant. |
| Écrire des exercices seed à la main | 🗑️ Écarté le 27/07 : coût récurrent, non transférable à un autre référentiel. |
| Restreindre le widget de TODOs dev | ❓ ADR-019, côté RLS uniquement. Aucune urgence côté rendu depuis qu'il est hors du produit. |

---

## Comment ce document se met à jour

Une étape ne passe à « faite » que si **sa condition de sortie chiffrée** est
atteinte, vérifiée dans Supabase. Une impression de progrès n'est pas une
condition de sortie.
