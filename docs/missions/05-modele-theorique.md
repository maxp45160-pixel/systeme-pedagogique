# ⑤ — Modèle théorique et modèle de mesure

## Objectif

Documenter la théorie réellement assumée par le produit et les dérivations du moteur, en distinguant décisions, hypothèses et questions.

## Entrées

`docs/specification/0-ignore.md` à `docs/specification/5-donnees.md`, `docs/QUESTIONS_OUVERTES.md`, `PRODUCT.md`, `ARCHITECTURE_DECISIONS.md`, `app/src/lib/engine/` et ses tests.

## Livrable

`docs/MODELE.md`, avec partie A (théorie pédagogique) et partie B (mesure).

## Méthode

Partie A : répétition espacée, transfert par contexte, autonomie et difficulté ajustée, uniquement quand le code les implémente ; citer les modules concernés. Partie B : niveau, confiance, robustesse et couverture, avec leurs sources et fonctions de dérivation. Recenser les seuils, notamment `NIVEAU_MAITRISE`, `FACTEUR_NIVEAU`, `FRACTION_TROP_FACILE`, `SIGNAUX_CONCORDANTS` et `PLAFOND_AIDE`, avec source, effet, tests et test de réfutation.

## Critères de refus

Ne pas attribuer au produit une théorie absente du code ; ne pas justifier un seuil par « raisonnable ». Un seuil sans test de réfutation est 🔬.

## Vérification

Toute variable dérivée remonte à des observations identifiées et tout seuil a une référence de code/test ou est signalé comme lacune.
