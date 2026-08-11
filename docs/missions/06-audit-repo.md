# ⑥ — Audit indépendant du dépôt (Codex)

## Objectif

Produire un audit factuel et comparable à l'audit Claude, sans modifier le code.

## Entrées

`AGENTS.md`, `PRODUCT.md`, `PRODUCT_SPECIFICATION_MAP.md`, `ARCHITECTURE_DECISIONS.md`, `docs/MODELE.md`, le code, les tests et le schéma.

## Livrable

`docs/audits/2026-08-audit-codex.md`.

## Méthode

Auditer exactement ces axes : (a) écart code ↔ carte ; (b) les huit invariants ; (c) validation des données Supabase avant le moteur ; (d) RLS et isolation par compte ; (e) logique métier hors `lib/` ; (f) validations dupliquées ; (g) couverture des chemins de dérivation ; (h) dette documentaire. Pour chaque constat, indiquer `fichier:ligne`, gravité, invariant concerné, preuve et action à instruire. L'audit Claude est produit à l'aveugle dans `docs/audits/2026-08-audit-claude.md` : ne pas le lire avant les deux commits.

## Critères de refus

Ne corriger aucun fichier de code, ne masquer aucun doute et ne requalifier aucun statut. Une absence de preuve doit être exprimée comme telle.

## Vérification

Les huit axes ont une section, même vide et justifiée ; tous les constats sont traçables. Le livrable est commité avant de passer à ⑦.
