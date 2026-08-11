# Couche 5 — Ce qu'elle fait des données

Cette couche fixe la persistance, les autorisations et les frontières de données. Les statuts sont recopiés de `PRODUCT_SPECIFICATION_MAP.md`.

| Brique | Entrées | Sortie / règle de données | Invariant | Code | Tests | Statut |
|---|---|---|---|---|---|---|
| Source de vérité | Entités validées du compte | Tables Supabase/PostgreSQL ; schéma de référence | Supabase est la source de vérité | `app/supabase/schema.sql`, `lib/store/db.ts`, `lib/supabase/` | `lib/store/supabase-backend.test.ts` | ✅ |
| Autorisation | Session authentifiée et politiques SQL | Accès contraint par RLS ; aucune clé service côté client | RLS est la barrière de confiance | `app/supabase/schema.sql`, `lib/supabase/client.ts`, `lib/supabase/server.ts` | — (politiques SQL non exercées en Vitest) | ✅ |
| Isolation par compte | Identifiant de compte et usage de stockage | Clé navigateur préfixée par compte ; requêtes du compte courant | P8 : pas de fuite entre comptes | `lib/ui/stockage-session.ts`, `lib/store/db.ts`, `lib/tutor/proposition.ts` | `lib/tutor/contexte.test.ts`, `lib/tutor/proposition.test.ts` | ✅ |
| Journal immuable | Existence de preuve ou tentative avant retrait | Archivage au lieu de suppression dans les cas protégés | Preuve / tentative non orpheline | `lib/domain/exercice.ts`, `lib/domain/referentiel-compte.ts`, `lib/store/actions.ts`, `lib/store/referentiel-actions.ts` | `lib/domain/exercice.test.ts`, `lib/domain/referentiel-compte.test.ts` | ✅ ADR-027 / ADR-047 |
| Validation d'entrée | Lignes Supabase et résultats RPC | Entités converties puis vérifiées avant moteur | Ne pas fabriquer une valeur depuis une donnée invalide | `lib/store/supabase-backend.ts`, `lib/store/db.ts` | `lib/store/supabase-backend.test.ts` | ✅ |
| Contexte du tuteur | Historique, référentiel, exercice et données pertinentes | Fenêtre bornée et contexte conditionnel | P5, P8 : contexte utile sans fuite ni mesure inventée | `lib/tutor/fenetre.ts`, `lib/tutor/contexte.ts` | `lib/tutor/contexte.test.ts` | ✅ ADR-007 |
| Export du compte | Collections du compte courant | Export complet des données du compte | P8 : sortie de ses propres données | `lib/store/export.ts` | — (pas de test dédié localisé) | ✅ |
| Analytics / modèles prédictifs | — | Aucune collecte ou modèle construit | Consentement et finalité requis avant partage | — | — | ❓ non construit |
| Import / export Obsidian, PDF | — | Aucun import/export de ces formats | Ne pas construire sans besoin observé | — | — | ❓ non construit |
