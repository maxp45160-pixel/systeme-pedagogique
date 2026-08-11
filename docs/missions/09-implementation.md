# ⑨ — Implémenter une brique validée

## Objectif

Réaliser une seule brique de la roadmap avec ses preuves, sans élargir le périmètre ni convertir une analyse en décision.

## Entrées

`ROADMAP.md`, la décision humaine et l'ADR applicables, les éléments concernés de `docs/QUESTIONS_OUVERTES.md`, `docs/MODELE.md`, de la synthèse d'audit, et le code/tests/schéma réels.

## Livrable

Une branche par brique, avec code, tests et ADR ; documentation mise à jour uniquement après validation humaine d'une éventuelle montée de statut.

## Méthode

Dans cet ordre : comprendre ; vérifier code et données réelles ; proposer un plan ; obtenir validation humaine ; coder et tester ; vérifier ; documenter. Lire les ADR avant tout changement architectural. Pour une base de données, vérifier Supabase, les dépendances, puis créer/appliquer la migration et la documenter. Ne pas pousser directement sur `master`.

## Critères de refus

Refuser une brique ❓ non tranchée, un changement de seuil sans données, une dépendance sans confirmation, ou une modification silencieuse de `.env.local`, `app/supabase/schema.sql` ou `app/data/00_instructions/`.

## Vérification

Les tests pertinents et le build passent ; l'ADR, les invariants et les migrations éventuelles sont vérifiés. Toute montée en ✅ est explicitement validée par une personne.
