# Simulation persona — adulte en loisir intellectuel

**Version 1.0 — 22/08/2026. Simulation d'évaluation, aucune décision validée.**

> Persona dérivé de la méthode du persona académique (v1.1, même jour). Les
> verdicts s'appuient sur la relecture de code commune ; les étapes qui
> dépendent d'une sortie du tuteur sont des hypothèses non réfutées.

## 1. Persona

Claire, 41 ans, chef de projet, apprend le solfège et la théorie musicale par
plaisir, pour comprendre ce qu'elle joue à la guitare. Aucune échéance, aucun
examen, aucune institution : elle veut simplement ne pas stagner et comprendre
ce qu'elle entend. Rythme irrégulier, souvent deux fois par semaine le soir,
parfois un mois sans toucher l'app.

C'est le persona témoin : il teste le produit **hors de tout cadre scolaire**.
Si la boucle tient ici sans contournement, elle tient par elle-même.

## 2. Scénario en six gestes

| # | Geste |
|---|---|
| S0 | Créer un compte, déclarer l'intention (« comprendre la théorie musicale ») |
| S1 | Obtenir un référentiel d'un domaine non scolaire |
| S2 | Travailler par micro-sessions du soir |
| S3 | Relier les notions au concret (un morceau qu'elle joue) |
| S4 | Reprendre après un mois sans utiliser l'app |
| S5 | Sentir sa progression sans note ni classement |

Verdicts : ✅ fluide · 🟡 faisable avec friction · ❌ bloqué · 🔬 hypothèse non testable sans exécution du tuteur.

## 3. Walkthrough détaillé

### S0 — Intention de loisir — 🔬

Le formulaire d'amorçage ne présuppose pas un cadre scolaire (sujet + intention
libres). Hypothèse centrale non réfutée : le tuteur sait-il proposer des
branches crédibles pour « théorie musicale » (intervalles, lecture rythmique,
harmonisation…) ? Rien dans le code ne limite le référentiel à un domaine — le
référentiel appartient au compte (invariant 7) — mais la qualité de la
proposition hors scolaire n'est pas démontrée.

### S1 — Référentiel non scolaire — 🔬

Même mécanique (`outilReferentielComplet`, `outils.ts:756`). Deux sous-hypothèses :
- le vocabulaire proposé est-il adapté (pas de jargon scolaire plaqué) ?
- la granularité convient-elle à un loisir (ni sur-découpée façon programme,
  ni trop grossière) ? Le plafond de 2 nouveaux domaines en compte établi est
  indifférent ici : Claire n'a besoin que d'un domaine.

### S2 — Micro-sessions du soir — ✅

Le meilleur cas d'usage de l'arbitre : une action unique, pistes alternatives,
contexte 15–20 min. Identique au constat S3 du persona reconversion.

### S3 — Relier au concret — 🟡 / 🔬

Claire veut travailler « les accords de ce morceau précis ». Elle peut écrire le
besoin dans le `+` et obtenir une séance pré-ciblée (flux le mieux huilé,
S9 académique). Mais :
- le morceau lui-même n'a pas de place : pas de partition, pas de lien audio ;
- la fiche note peut documenter le morceau en texte, rattachée aux compétences
  — l'hypothèse documentaire du classement s'en nourrit (`recommend.ts:161`,
  ADR-064) — mais c'est de la saisie manuelle pure ;
- 🔬 : le tuteur produit-il des exemples musicaux plausibles, ou générique ?

### S4 — Reprise après un mois — ✅

Invariants favorables : une faiblesse ne disparaît pas sans nouvelle
démonstration (invariant 4), donc rien n'est « perdu » ; absence de preuve ≠
zéro (invariant 3), donc rien n'est « remis à zéro » non plus. Les travaux
ouverts sont repris depuis le tableau de bord. Pour un rythme irrégulier, c'est
structurellement juste.

### S5 — Progression sans note — ✅

Aucune note, aucun classement, aucune comparaison : le produit n'en produira
pas (mesure = preuve observée). La restitution se limite au tableau de bord et
à l'Atelier (arbre par domaine, séances passées) — suffisant pour ce persona,
qui n'a pas besoin de métriques, seulement de ne pas revoir indéfiniment la
même chose. La dérive d'autonomie observée (P8/ADR-057) fait exactement ce
qu'il faut.

## 4. Scorecard

| # | Geste | Verdict | Cause racine |
|---|---|---|---|
| S0/S1 | Loisir → référentiel | 🔬 | qualité tuteur hors scolaire non démontrée |
| S2 | Micro-sessions | ✅ | cœur du produit |
| S3 | Ancrage au répertoire personnel | 🟡 / 🔬 | corpus limité au texte/PDF ; exemples tuteur inconnus |
| S4 | Rythme irrégulier | ✅ | invariants 3 et 4 structurellement adaptés |
| S5 | Progression sans note | ✅ | autonomie observée suffit |

**Conclusion générale.** Verdict le plus favorable des cinq personas — et c'est
le résultat le plus utile de cette simulation : là où aucun engagement daté,
aucune institution, aucun tiers n'est requis, la boucle tient sans
contournement. Les écarts restants sont mineurs et portent sur l'ancrage aux
contenus personnels, déjà identifié chez Sofia.

## 5. Écarts classés — hypothèses à arbitrer, pas des chantiers ouverts

1. **Qualité du référentiel hors scolaire (S0/S1).** Ne rien retoucher au code :
   tester réellement le tuteur sur trois ou quatre domaines non scolaires avant
   toute conclusion. Si la qualité tient, c'est un argument produit fort.
2. **Ancrage au contenu personnel (S3).** Même écart que persona reconversion
   (ressources non-PDF) : un document-lien couvrirait partiellement le besoin
   (lien vers un enregistrement, une tablature). Arbitrage commun aux deux
   personas.
