-- ====================================================================
-- Migration : 20260816134000_charger_tout_themes.sql
-- Description : Intégration de la table `themes` dans la RPC `charger_tout`
-- ====================================================================

CREATE OR REPLACE FUNCTION public.charger_tout()
RETURNS JSON
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  resultat json;
BEGIN
  SELECT json_build_object(
    'profile',     (SELECT row_to_json(p) FROM profiles p WHERE p.id = uid),
    'evidence',    COALESCE((SELECT json_agg(row_to_json(e)) FROM evidence e WHERE e.user_id = uid), '[]'::json),
    'exercises',   COALESCE((SELECT json_agg(row_to_json(x)) FROM exercises x WHERE x.user_id = uid), '[]'::json),
    'attempts',    COALESCE((SELECT json_agg(row_to_json(a)) FROM attempts a WHERE a.user_id = uid), '[]'::json),
    'sessions',    COALESCE((SELECT json_agg(row_to_json(s)) FROM sessions s WHERE s.user_id = uid), '[]'::json),
    'refus_recommandations',
                   COALESCE((SELECT json_agg(row_to_json(r)) FROM refus_recommandations r WHERE r.user_id = uid), '[]'::json),
    'domaines',    COALESCE((SELECT json_agg(row_to_json(d)) FROM domaines d WHERE d.user_id = uid), '[]'::json),
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json),
    'themes',      COALESCE((SELECT json_agg(row_to_json(t)) FROM themes t WHERE t.user_id = uid), '[]'::json)
  ) INTO resultat;

  RETURN resultat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated;
