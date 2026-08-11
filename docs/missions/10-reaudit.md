# ⑩ — Ré-audit différentiel

## Objectif

Mesurer honnêtement ce que les implémentations ont fermé, ce qui résiste et ce qui est apparu depuis l'audit initial.

## Entrées

`docs/audits/2026-08-audit-codex.md`, `docs/audits/2026-08-audit-claude.md`, `docs/audits/2026-08-synthese.md`, `ROADMAP.md`, les ADR et branches fusionnées, ainsi que le dépôt et les tests à la date de l'audit.

## Livrable

`docs/audits/<date>-reaudit.md`, avec `<date>` au format `YYYY-MM`.

## Méthode

Reprendre les huit axes de ⑥ en différentiel : écart carte/code, invariants, validation Supabase, RLS/isolation, logique hors `lib/`, duplication, couverture des dérivations et dette documentaire. Distinguer ce qui est fermé, ce qui a résisté et les nouveaux constats. Évaluer aussi la méthode : l'audit ⑥ avait-il vu ce qui a effectivement cassé ? Chaque constat reste sourcé par `fichier:ligne`, gravité et invariant.

## Critères de refus

Ne pas déclarer une dette close sans preuve dans le dépôt ou les tests, ni modifier le code, les décisions ou les statuts pendant le ré-audit.

## Vérification

Chaque constat de la synthèse a un état différentiel explicite ; les nouveaux constats sont distingués des anciens et les limites méthodologiques sont notées.
