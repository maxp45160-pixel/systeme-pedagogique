-- ====================================================================
-- Migration : 20260821000000_suppression_themes.sql
-- Description : Suppression complète de la table themes et alignement
--               de charger_tout() sur le schéma canonique.
--
-- CORRIGÉE le 21/08/2026 : la version d'origine recréait aussi
-- appliquer_commande_referentiel avec une signature divergente et une
-- posture SECURITY DEFINER / search_path = public, contredisant le
-- durcissement du 20-21/08 (INVOKER, search_path = ''). La fonction
-- canonique de schema.sql ne référence jamais themes : cette migration
-- n'a donc pas à la toucher. charger_tout() est ici recopiée à
-- l'identique du schéma de référence (INVOKER implicite,
-- search_path = public, pg_temp).
-- ====================================================================

-- 1. Suppression de la table themes
DROP TABLE IF EXISTS public.themes CASCADE;

-- 2. Mise à jour de charger_tout pour retirer la clé themes —
--    définition identique à app/supabase/schema.sql.
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
    'observations',    COALESCE((SELECT json_agg(row_to_json(e)) FROM observations e WHERE e.user_id = uid), '[]'::json),
    'exercises',   COALESCE((SELECT json_agg(row_to_json(x)) FROM exercises x WHERE x.user_id = uid), '[]'::json),
    'attempts',    COALESCE((SELECT json_agg(row_to_json(a)) FROM attempts a WHERE a.user_id = uid), '[]'::json),
    'sessions',    COALESCE((SELECT json_agg(row_to_json(s)) FROM sessions s WHERE s.user_id = uid), '[]'::json),
    'refus_recommandations',
                   COALESCE((SELECT json_agg(row_to_json(r)) FROM refus_recommandations r WHERE r.user_id = uid), '[]'::json),
    'domaines',    COALESCE((SELECT json_agg(row_to_json(d)) FROM domaines d WHERE d.user_id = uid), '[]'::json),
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json),
    'competence_domaines',
                   COALESCE((SELECT json_agg(row_to_json(cd)) FROM competence_domaines cd WHERE cd.user_id = uid), '[]'::json),
    'moteur_reglages',
                   COALESCE((SELECT json_agg(row_to_json(m)) FROM (SELECT * FROM public.moteur_reglages WHERE user_id = uid ORDER BY applique_le ASC) m), '[]'::json)
  ) INTO resultat;

  RETURN resultat;
END;
$$;

-- NOTE. Aucune recréation d'appliquer_commande_referentiel ici :
-- la version canonique (SECURITY INVOKER, search_path = '',
-- signature (TEXT, INTEGER, TEXT, TEXT, JSONB)) ne consulte pas
-- public.themes. Recréer la fonction sous un autre nom ou posture
-- réintroduirait la dérive corrigée par
-- 20260820213000_restaurer_domaine_active_perimetre.