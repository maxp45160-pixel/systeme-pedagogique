-- Annule le renommage `indices_utilises` → `sollicitations_assistant`.
--
-- Ce renommage venait de la branche `codex/merge-a27e584` (commit a867fd3),
-- appliqué en production le 14/08/2026 sous la version 20260814161528 sans que
-- le code correspondant soit fusionné sur master. La traduction domaine↔SQL
-- étant mécanique et sans table d'exceptions (`lib/store/supabase-backend.ts`),
-- master écrivait encore `indices_utilises` : toute insertion de tentative
-- échouait, et la lecture rendait `indicesUtilises` indéfini — donc une
-- autonomie dérivée d'une donnée absente.
--
-- La base retrouve ici l'état attendu par le code déployé. Le chantier
-- « l'assistance remplace les indices » reviendra par sa branche, avec son code
-- et son ADR, et rejouera alors son propre renommage.
--
-- Aucune donnée en jeu : la colonne ne porte que des zéros, et rien n'en dépend
-- (ni vue, ni fonction, ni index ; la policy RLS ne porte que sur `user_id`).
ALTER TABLE public.attempts
  RENAME COLUMN sollicitations_assistant TO indices_utilises;
