# Plan d'implémentation UI/UX — persona loisir adulte (Claire)

**Version 1.0 — 22/08/2026. Proposition, aucune décision validée.**

> Marquage : **[S]** sans nouvelle entité ni décision · **[D]** décision humaine
> requise. Ce persona est le mieux servi : son plan est volontairement court —
> l'essentiel est de **ne pas sur-construire** (AGENTS.md : ne pas construire par
> anticipation).

## Vue d'ensemble

| Chantier | Couvre | Type | Effort |
|---|---|---|---|
| L1. Protocole de test tuteur hors scolaire | S0/S1/S3 | [S] — pas du code | nul |
| L2. Ressource-lien | S3 | [D léger] | partagé avec R2 |
| L3. Ancrage au répertoire personnel | S3 | [D] | à ne pas ouvrir sans fait |

## L1 — Protocole de test tuteur hors scolaire [S, pas du code]

**Principe.** Les deux hypothèses centrales du persona (qualité du référentiel
non scolaire, pertinence des exemples musicaux) se réfutent par l'usage, pas par
du code. Avant toute retouche UI :

1. Créer un compte de test, amorcer « comprendre la théorie musicale pour la
   guitare » ; consigner les branches proposées.
2. Lancer trois besoins ciblés (« accords de ce morceau », « lecture rythmique
   en 6/8 », « entendre les intervalles ») ; consigner exercices produits.
3. Répéter sur deux autres domaines non scolaires (ex. œnologie, astronomie).
4. Critère : le référentiel proposé est-il crédible et à granularité loisir ?
   Les exercices sont-ils génériques ou ancrés ?

Si le résultat est bon : ne rien coder, documenter le constat. Si mauvais :
l'écart est dans les protocoles tuteur (`app/data/00_instructions/`) — fichier
sous protection, modification interdite sans validation explicite.

## L2 — Ressource-lien [D léger]

Identique au chantier R2 du persona reconversion (`PLAN_UI_RECONVERSION.md`) :
même type stocké, même formulaire, même arbitrage. Pour Claire il couvre
l'enregistrement d'un enregistrement audio ou d'une tablature externe. Un seul
arbitrage pour les deux personas.

## L3 — Ancrage au répertoire [D — ne pas ouvrir]

Le besoin réel derrière « travailler les accords de ce morceau » est
l'ancrage à un contenu propriétaire (partition, audio). Toute réponse sérieuse
(hébergement de médias, transcription) est hors périmètre actuel et contredit
« pas un générateur de contenu de référence ». Le couvert partiel par L2 suffit
tant qu'aucun compte tiers n'exprime ce besoin en 10 preuves sans assistance
(test PRODUCT.md §4).

Ce qui reste possible en [S] sans arbitrage : la fiche note texte existe déjà ;
la micro-copie de l'amorçage peut suggérer « décris ton morceau dans une note »
— mais même cela attend le résultat de L1.

## Vérification

- Aucun code produit par ce plan avant L1. La seule sortie attendue est un
  constat documenté, ajouté au persona si l'hypothèse est réfutée ou confirmée.
