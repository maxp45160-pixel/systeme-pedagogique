-- ============================================================================
-- Migration : Unification de l'identité OAuth et mise à jour des profils
--
-- Supporte picture (standard Google/OIDC) en plus d'avatar_url, ainsi que
-- full_name, name, given_name/family_name et user_name.
-- Met à jour les profils existants lors du trigger sans écraser les prénoms
-- personnalisés par l'utilisateur.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nom text;
  v_avatar text;
BEGIN
  v_nom := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(CONCAT_WS(' ', NULLIF(NEW.raw_user_meta_data->>'given_name', ''), NULLIF(NEW.raw_user_meta_data->>'family_name', '')), ''),
    NULLIF(NEW.raw_user_meta_data->>'user_name', ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar', '')
  );

  INSERT INTO public.profiles (id, email, prenom, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    v_nom,
    v_avatar
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    prenom = CASE
      WHEN public.profiles.prenom IS NULL OR public.profiles.prenom = '' OR public.profiles.prenom = 'Utilisateur'
      THEN EXCLUDED.prenom
      ELSE public.profiles.prenom
    END,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

  RETURN NEW;
END;
$$;
