-- ====================================================================
-- Migration — refus de recommandation (R1)
--
-- Additive et idempotente, sans DROP TABLE. À exécuter dans
-- Supabase Studio › SQL Editor. `schema.sql` porte les mêmes définitions
-- pour une installation neuve.
--
-- Deux corrections :
--
-- 1. `charger_tout` ne renvoyait pas `refus_recommandations`. Le chemin
--    rapide (une RPC pour tout) est celui qu'emprunte l'application ; la
--    clé absente devenait un `[]` côté TypeScript, et le moteur n'excluait
--    jamais rien. « Passer une suggestion » écrivait bien en base et
--    n'avait aucun effet. La fonction n'était versionnée nulle part dans
--    le dépôt — elle a dérivé du schéma sans que rien ne le voie ; elle
--    vit désormais ici et dans `schema.sql`.
--
-- 2. Colonne `exercice_id` : un refus porte maintenant sur l'exercice
--    proposé, pas sur la compétence entière. `NULL` = refus de compétence,
--    ce que sont les lignes antérieures à cette migration et ce que reste
--    un refus posé quand aucun exercice n'était proposé.
-- ====================================================================

ALTER TABLE public.refus_recommandations
  ADD COLUMN IF NOT EXISTS exercice_id TEXT;

-- --------------------------------------------------------------------
-- Chargement groupé : les huit tables du compte en un aller-retour.
--
-- SECURITY INVOKER (défaut) : la fonction s'exécute avec les droits de
-- l'appelant et reste donc soumise à RLS. Le filtre `user_id = uid` est
-- redondant avec la politique, et volontairement conservé — il rend la
-- lecture explicite et permet à l'index (user_id, created_at) de servir.
-- --------------------------------------------------------------------

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
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json)
  ) INTO resultat;

  RETURN resultat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated;
