# Architecture — orientation rapide

Relevé : 15/09/2026. [Audit](../CURRENT_SYSTEM_AUDIT.md) pour le périmètre observé.

- Application Next App Router/React/TypeScript strict dans `app/`.
- Métier pur : [domain](../../app/src/lib/domain/).
- États et recommandations dérivés : [engine](../../app/src/lib/engine/).
- Commandes et persistance : [store](../../app/src/lib/store/).
- Tuteur, contexte et fournisseurs : [tutor](../../app/src/lib/tutor/).
- Documents et projections : [documents](../../app/src/lib/documents/).
- Routes/composants : [app](../../app/src/app/), [components](../../app/src/components/).
- Supabase : [schéma de référence](../../app/supabase/schema.sql) et migrations ;
  RLS constitue la barrière d'autorisation. Vercel est la cible d'exploitation
  documentée ; le déploiement courant n'a pas été inspecté.
- Tests existants : Vitest, scripts SQL, campagne de simulation dédiée.
  Commandes exactes : [manifestes](../../app/package.json).

Avant modification structurante : [ADR](../../ARCHITECTURE_DECISIONS.md),
[modèle cible](../../docs/architecture/TWINY_MODEL.md),
[contrats proposés](../../ENGINE_CONTRACTS.md), puis types/imports et appelants
réels. Charger les corps lorsqu'une modification les exige.

L'AI Company reste hors `app/`, sans branchement au tuteur, nouvelle base,
dépendance applicative ni service. Les profils natifs sont dans `.codex/agents/` ;
AGENTS déclenche les sous-missions utiles et leurs contrats dans `ai-company/`.
Codex fournit exécutions, outils et isolation de contexte. Le runtime décide
des capacités/permissions réelles ; les contrats ne sont pas une barrière de sécurité.
