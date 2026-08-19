# Déploiement — Optimisation Contexte & RPC `charger_tout` (Branche `opti-cyril`)

Cette branche optimise les performances de chargement des pages en intégrant la table `moteur_reglages` dans la fonction SQL `charger_tout()`. Cela élimine un aller-retour réseau séquentiel (~70 ms) à chaque navigation.

---

## ⚠️ Actions obligatoires AVANT de fusionner / pousser en production

### 1. Appliquer la migration SQL dans Supabase

Ouvrir l'éditeur SQL de votre instance Supabase (ou exécuter via Supabase CLI `supabase db push`) et exécuter le script contenu dans [`app/supabase/migrations/20260820000000_charger_tout_reglages.sql`](./app/supabase/migrations/20260820000000_charger_tout_reglages.sql) :

```sql
-- Migration : 20260820000000_charger_tout_reglages.sql
-- Description : Intégration de la table `moteur_reglages` dans la RPC `charger_tout`

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
    'themes',      COALESCE((SELECT json_agg(row_to_json(t)) FROM themes t WHERE t.user_id = uid), '[]'::json),
    'moteur_reglages',
                   COALESCE((SELECT json_agg(row_to_json(m)) FROM (SELECT * FROM public.moteur_reglages WHERE user_id = uid ORDER BY applique_le ASC) m), '[]'::json)
  ) INTO resultat;

  RETURN resultat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated;
```

---

### 2. Merger et Déployer

Une fois la migration exécutée sur la base de données distante :
1. Fusionner la branche `opti-cyril` sur `master` (ou pousser la branche).
2. Vérifier le déploiement sur Vercel / environnement de production.

---

## Garantie de résilience (Garde-fou)

Si le code applicatif est déployé **avant** l'application de la fonction SQL sur Supabase :
- L'application **ne plantera pas**.
- La fonction `convertirResultatRPC()` détectera l'absence de la clé `moteur_reglages` et basculera automatiquement en mode dégradé (lectures séparées).
- Dès l'exécution du SQL sur Supabase, le système bascule instantanément sur le mode optimisé (**~70 ms gagnées par page**).
