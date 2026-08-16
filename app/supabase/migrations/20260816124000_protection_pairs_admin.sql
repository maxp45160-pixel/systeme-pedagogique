-- Migration : protection des pairs administrateurs contre la rétrogradation et la suspension
--
-- Un administrateur ne peut ni modifier son propre accès, ni rétrograder ou suspendre
-- un autre administrateur depuis l'application authentifiée (auth.uid() IS NOT NULL).

CREATE OR REPLACE FUNCTION public.garde_comptes_acces()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- 1. Interdit de modifier son propre accès depuis l'application
  IF OLD.user_id = auth.uid()
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR (NEW.suspendu_le IS NOT NULL AND OLD.suspendu_le IS NULL)) THEN
    RAISE EXCEPTION 'Un administrateur ne peut pas modifier son propre accès.' USING ERRCODE = '42501';
  END IF;

  -- 2. Interdit formellement de rétrograder ou suspendre un administrateur depuis l'application
  IF auth.uid() IS NOT NULL AND OLD.role = 'admin'
     AND (NEW.role <> 'admin' OR (NEW.suspendu_le IS NOT NULL AND OLD.suspendu_le IS NULL)) THEN
    RAISE EXCEPTION 'Un administrateur ne peut pas être rétrogradé ou suspendu depuis l''application.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
