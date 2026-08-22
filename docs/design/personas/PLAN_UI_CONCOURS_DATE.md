# Plan d'implémentation UI/UX — persona concours daté (Thomas)

**Version 1.0 — 22/08/2026. Proposition, aucune décision validée.**

> Marquage : **[S]** sans nouvelle entité ni décision · **[D]** décision humaine
> requise. **Ce persona est le seul dont le chantier central est bloqué sur un
> arbitrage produit** (le fait daté, retiré par ADR-096, position « pas un outil
> de révision » PRODUCT.md §2). Tant que cet arbitrage n'est pas rendu, la
> seule action légitime est C0.

## Vue d'ensemble

| Chantier | Couvre | Type | Effort |
|---|---|---|---|
| C0. Refus explicite et orienté | S2/S3/S4 | [S] | faible |
| C1. Concours blanc outillé | S5 | [S] | moyen |
| C2. Fait daté minimal | S2/S3/S6 | [D] | lourd |

## C0 — Refus explicite [S] — à faire dans tous les cas

**Problème.** Aujourd'hui la date est reconnue puis jetée silencieusement :
Thomas croit avoir déclaré son examen, rien ne le lui dit.

**UI.**
- Dans `capture-intention.tsx`, quand `extraireEcheanceBesoin` reconnaît une
  échéance : bandeau d'honnêteté sous le champ — « J'ai repéré une échéance
  ({date}). Je ne retiens pas les dates : je te propose de travailler ce que tu
  choisis maintenant. »
- Le besoin s'ouvre comme aujourd'hui ; aucune écriture.
- Même bandeau à l'amorçage si la phrase d'intention porte une date.

**Pourquoi c'est prioritaire.** P7 (l'honnêteté prime sur la complétude) exige
que le refus soit visible. Coût minime, aucune donnée, aucun contrat changé —
et il transforme un bug perçu en position assumée, testable par l'usage.

## C1 — Séance « conditions réelles » [S]

**Problème.** Impossible de passer un blanc chronométré sans correction
intermédiaire.

**UI.**
- Dans l'étape composition (`etape-composition.tsx`), troisième option discrète
  après thème + temps : bascule « Mode épreuve » — chrono plein écran
  (réutiliser `seances/pomodoro.tsx`), indices masqués, correction unique à la
  fin.
- Le bilan (`formulaire-bilan.tsx`) reste identique : même dérive d'autonomie
  observée, pas de note inventée.
- Le journal distingue visuellement la séance en mode épreuve (badge icône,
  `icones.tsx`) — c'est une caractéristique de séance déclarée au départ, donc
  stockée sur `LearningSession`, pas dérivée.

**Garde-fou.** Le mode épreuve ne crée aucune nouvelle entité et n'ajoute
aucune dimension au moteur ; c'est un habillage du même épisode
(`LearningSession` reste l'épisode unique).

## C2 — Fait daté minimal [D — ne rien coder]

Ce que la décision doit trancher, présenté pour arbitrage :

1. **Question produit.** Le produit retient-il un fait daté ? Contredit
   directement la position « pas un outil de révision » et l'invariant
   d'intention (« un besoin ouvre, il ne devient pas un fait »). Répondre non =
   garder C0 seul, définitivement.
2. **Si oui, forme minimale défendable.** Un objet unique par compte
   (« échéance nommée + date »), écrit uniquement après confirmation explicite
   case par case (jamais extraite et stockée en silence), consommé :
   - par la carte d'action : affichage contextuel « {nom} — dans 21 jours » ;
   - par l'ordonnanceur interne (`parcours-interne.ts`) comme **contexte de
     priorisation**, pas comme générateur de plan ;
   - jamais sous forme de plan jour-par-jour (ce serait recréer le parcours
     retiré).
3. **Hypothèse testable avant tout code.** Une échéance visible change-t-elle
   l'acceptation des recommandations ? Mesurable avec C0 seul : compter les
   besoins porteurs d'échéance et leur suite.

**Ce qui reste interdit même si arbitré favorablement** : objectifs structurés
par compétence (ADR-096), rappels/push, planification calendaire, score de
préparation.

## Vérification

- C0 : tests unitaires sur l'affichage conditionnel (échéance reconnue /
  non reconnue) ; aucune écriture DB à couvrir.
- C1 : tests du flux séance en mode épreuve (chrono, bilan inchangé) ;
  vérifier qu'une seule séance `en-cours` reste garantie.
