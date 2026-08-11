# ⑦ — Fusion des audits indépendants

## Objectif

Comparer les audits Codex et Claude sans effacer les désaccords.

## Entrées

`docs/audits/2026-08-audit-codex.md`, `docs/audits/2026-08-audit-claude.md`, `PRODUCT_SPECIFICATION_MAP.md`, `PRODUCT.md` et `ARCHITECTURE_DECISIONS.md`.

## Livrable

`docs/audits/2026-08-synthese.md`.

## Méthode

Classer chaque constat dans trois sections : **concordants** (vu par les deux, priorité haute), **divergents** (vu par un seul, à instruire), et **contradictoires** (désaccord explicite). Conserver les références, éléments de preuve et arguments originaux. Pour toute contradiction, formuler le choix qui doit être fait par une personne.

## Critères de refus

Ne pas résoudre silencieusement une contradiction, ni moyenner une divergence en un constat imprécis, ni modifier le code ou les statuts.

## Vérification

Chaque entrée des deux audits est retrouvable dans une des trois sections. Arrêt obligatoire : une personne tranche les contradictions avant ⑧.
