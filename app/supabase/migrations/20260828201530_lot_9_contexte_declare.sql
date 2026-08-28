-- Lot 9 — contexte progressif déclaré, sans nouvelle entité de travail.
--
-- Migration additive appliquée le 28/08/2026 après vérification Supabase réelle.
-- Version distante enregistrée par Supabase : 20260828201530.
-- Les faits restent rattachés au profil (RLS existant) : la période est un
-- texte déclaré et les disponibilités sont des fenêtres JSONB portant une
-- source explicite. Aucun plan, score de préparation ou état dérivé n'est
-- écrit. L'assistant peut mémoriser son étape côté navigateur, mais jamais
-- les faits pédagogiques à la place de Supabase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS periode_declaree TEXT,
  ADD COLUMN IF NOT EXISTS disponibilites_declarees JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'profiles_periode_declaree_non_vide'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_periode_declaree_non_vide
      CHECK (periode_declaree IS NULL OR btrim(periode_declaree) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'profiles_disponibilites_declarees_tableau'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_disponibilites_declarees_tableau
      CHECK (
        disponibilites_declarees IS NULL
        OR jsonb_typeof(disponibilites_declarees) = 'array'
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.profiles.periode_declaree IS
  'Période ou horizon déclaré explicitement par la personne ; jamais dérivé.';
COMMENT ON COLUMN public.profiles.disponibilites_declarees IS
  'Fenêtres de disponibilité déclarées, validées côté domaine, avec startsAt, endsAt et sourceRef.';
