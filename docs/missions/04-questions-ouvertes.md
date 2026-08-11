# ④ — Registre des questions ouvertes

## Objectif

Rendre explicites les arbitrages qui bloquent ou orientent le produit, sans les résoudre.

## Entrées

`docs/specification/0-ignore.md` à `docs/specification/5-donnees.md`, `PRODUCT.md`, `PRODUCT_SPECIFICATION_MAP.md`, `ARCHITECTURE_DECISIONS.md`.

## Livrable

`docs/QUESTIONS_OUVERTES.md`.

## Méthode

Créer un registre avec : question, ce qu'elle bloque, le fait observable qui y répondrait et la personne qui tranche. Inclure au minimum : la confrontation à l'usage de `PLAFOND_AIDE` (P8), les arbitrages ADR-006 et ADR-008 encore ouverts, les hésitations et la triche dessinées mais non observables, et la granularité thème / sous-thème / notion. Relier chaque entrée à sa couche et à son ADR.

## Critères de refus

Ne pas proposer de réponse, de plan de mise en œuvre, ni de statut ✅. Un avis ou une intuition n'est pas un fait observable.

## Vérification

Chaque question nomme son bloqueur, une condition de réponse observable et son décideur. Arrêt obligatoire : une personne choisit celles à traiter avant ⑤.
