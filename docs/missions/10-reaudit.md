# ⑩ — Ré-audit différentiel

## Objectif

Mesurer honnêtement si les implémentations ont augmenté la valeur et
l'intelligence de la boucle pédagogique : fonctionnalités réellement utilisées,
observations nouvelles, action suivante modifiée et capacité du produit à
apprendre de ses propres décisions.

## Entrées

`docs/audits/2026-08-audit-produit.md`, `ROADMAP.md`, les ADR et branches
fusionnées, le dépôt, les tests et les mesures d'usage à la date de l'audit.
Les audits techniques restent des annexes de fiabilité.

## Livrable

`docs/audits/<date>-reaudit.md`, avec `<date>` au format `YYYY-MM`.

## Méthode

Reprendre en différentiel les axes de l'audit produit :

1. écart carte ↔ fonctionnalité réellement disponible ;
2. construit ↔ utilisé, avec chiffres de production ;
3. niveau d'intelligence N0 à N4 par fonction ;
4. fermeture effective de la boucle intention → action → observation → action suivante ;
5. dette qui ralentit une feature de la roadmap ;
6. fonctionnalités fantômes, coquilles, affamées ou tenues ;
7. critères de sortie des lots de `ROADMAP.md` ;
8. nouvelles décisions rendues possibles par les données.

La validation Supabase, la RLS, les tests et la dette documentaire restent un
appendice court : ils ne redeviennent prioritaires que s'ils ont empêché une
feature ou faussé une observation. Évaluer aussi la méthode : les audits avaient-ils
vu ce qui a réellement empêché l'usage ?

## Critères de refus

Ne pas déclarer une dette close sans preuve dans le dépôt ou les tests, ni modifier le code, les décisions ou les statuts pendant le ré-audit.

## Vérification

Chaque gap de l'audit produit et chaque porte de la roadmap a un état
différentiel explicite. Les nouveaux constats sont distingués des anciens, les
chiffres d'usage sont datés et les limites méthodologiques sont notées.
