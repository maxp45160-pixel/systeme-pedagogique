# Simulation persona — préparation de concours à date fixe

**Version 1.0 — 22/08/2026. Simulation d'évaluation, aucune décision validée.**

> Persona dérivé de la méthode du persona académique (v1.1, même jour). Les
> verdicts s'appuient sur la relecture de code commune ; les étapes qui
> dépendent d'une sortie du tuteur sont des hypothèses non réfutées.

## 1. Persona

Thomas, 26 ans, préparateur en pharmacie, prépare le concours d'entrée en
école d'infirmier (IFSI), **épreuve le 15 avril**, dans un peu plus de quatre
mois. Il travaille et ne peut réviser que 45 min en semaine, plus le samedi.
Matières : culture générale (méthodologie d'argumentation), mathématiques
(dosages, proportionnalité), tests psychotechniques. Sa question quotidienne
est unique : « qu'est-ce qui me rapproche le plus du concours ? ».

C'est le persona pour lequel le fait daté n'est pas une commodité mais la
colonne vertébrale de l'usage — et précisément ce que le produit ne retient pas.

## 2. Scénario en sept gestes

| # | Geste |
|---|---|
| S0 | Créer un compte, déclarer l'intention (« réussir le concours IFSI le 15 avril ») |
| S1 | Obtenir un référentiel couvrant les trois épreuves |
| S2 | Déclarer la date du 15 avril comme fait premier |
| S3 | Obtenir une répartition du travail jusqu'à la date |
| S4 | Travailler 45 min avec l'arbitre du jour conscient de la deadline |
| S5 | Faire des concours blancs chronométrés |
| S6 | Accélérer dans les deux dernières semaines |

Verdicts : ✅ fluide · 🟡 faisable avec friction · ❌ bloqué · 🔬 hypothèse non testable sans exécution du tuteur.

## 3. Walkthrough détaillé

### S0/S1 — Intention → référentiel — 🔬 / 🟡

La phrase porte la date (« le 15 avril ») : `extraireEcheanceBesoin`
(`lib/domain/echeance-besoin.ts`) sait la reconnaître — mais elle n'a **plus
aucun consommateur en production** (constat central S7 académique). Le
référentiel proposé couvrira vraisemblablement les matières citées (hypothèse
non réfutée), sans notion de poids relatif des épreuves ni de barème.

### S2 — Déclarer la date comme fait — ❌

Depuis ADR-096, aucun objet, aucune table, aucune surface ne retient un fait
daté : les tables `objectifs`, `parcours`, `evenements` sont supprimées. La
date est reconnue puis jetée (`capture-intention.tsx:332-338` : le besoin ouvre
la composition et ne laisse rien derrière lui). Le 14 avril, rien dans les
données ne saura qu'un concours a eu lieu le 15.

### S3 — Répartition jusqu'à la date — ❌

Rien à partir de quoi dériver : ni date stockée (S2), ni poids d'épreuve, ni
plan dérivé jour × compétence. `engine/parcours-interne.ts` ordonne des actions
dérivées à court terme uniquement. Le produit assume ne pas être « un outil de
révision » (PRODUCT.md §2) — pour Thomas, c'est exactement la promesse qu'il
cherche.

### S4 — Arbitre du jour — ✅ mécanique / ❌ sémantique

L'arbitre fonctionne : action prioritaire, pistes alternatives, contexte
45 min. Mais il est **aveugle au calendrier** (déjà constaté S10 académique) :
en février comme le 13 avril, il recommande sur les mêmes critères. Pour ce
persona, la qualité mécanique ne compense pas l'aveuglement sémantique.

### S5 — Concours blanc chronométré — 🟡 / ❌

Il peut composer une séance dense de type « travail », mais :
- aucune notion de conditions d'examen (chronomètre, sans correction intermédiaire) ;
- le bilan dérive une autonomie pédagogique (P8/ADR-057), pas une note ou un
  score comparable dans le temps — Thomas ne pourra pas suivre « mes scores de
  blancs progressent ».

### S6 — Sprint final — ❌

Un sprint suppose de moduler l'intensité selon la distance à la date : aucune
donnée ne porte la distance. Le comportement du tableau de bord sera identique
à J-120 et J-3.

## 4. Scorecard

| # | Geste | Verdict | Cause racine |
|---|---|---|---|
| S0/S1 | Intention → référentiel | 🔬 / 🟡 | tuteur non vérifié ; pas de poids d'épreuve |
| S2 | Date en fait premier | ❌ | capacité retirée (ADR-096) ; extracteur orphelin |
| S3 | Plan jusqu'à la date | ❌ | rien à partir de quoi dériver |
| S4 | Arbitre conscient du calendrier | ✅ / ❌ | arbitre aveugle aux faits datés |
| S5 | Concours blanc | 🟡 / ❌ | pas de conditions d'examen ni de score |
| S6 | Sprint final | ❌ | distance à la date inexistante dans les données |

**Conclusion générale.** Pire verdict des cinq personas : son usage entier
dépend d'un fait daté que le produit refuse structurellement de retenir. Ce
n'est pas une friction, c'est l'hypothèse produit elle-même qui est en cause :
soit le produit décide de retenir un fait daté (arbitrage lourd touchant
l'invariant d'intention et PRODUCT.md §2), soit il doit assumer d'exclure cet
usage — et alors ne rien construire.

## 5. Écarts classés — hypothèses à arbitrer, pas des chantiers ouverts

1. **Fait daté (couvre tout le scénario).** Identique à l'écart 1 du persona
   académique, mais ici décisif et non périphérique. Question unique :
   « le produit retient-il un fait daté, et sous quelle forme ? » Aucun code
   avant arbitrage explicite. Hypothèse testable : une échéance visible
   change-t-elle l'acceptation des recommandations ?
2. **Extracteur orphelin (S2).** `extraireEcheanceBesoin` vit avec ses tests,
   sans consommateur. Le garder coûte peu ; le supprimer ferme une porte.
   À arbitrer avec l'écart 1, pas avant.
3. **Score longitudinal (S5).** Une note de séance contredirait plusieurs
   invariants (mesure = preuve observée, pas fabriquée) ; ne pas traiter comme
   un simple ajout de champ.
