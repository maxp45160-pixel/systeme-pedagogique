# Couche 0 — Ce qu'elle ignore

Fiches établies par la mission ③ à partir du code et des tests existants. Les statuts ci-dessous sont recopiés de `PRODUCT_SPECIFICATION_MAP.md` ; ils ne constituent pas une requalification.

| Brique | Entrées | Sortie / refus | Invariant | Code | Tests | Statut |
|---|---|---|---|---|---|---|
| Non mesuré ≠ zéro | Compétences et preuves recevables | État global et couverture calculés sur le seul mesuré | P2 : absence de preuve ≠ zéro | `lib/engine/skill-state.ts`, `lib/engine/progression.ts` | `lib/engine/moteur.test.ts` | ✅ ADR-006 |
| Incertitude affichée | Preuves, leurs contextes et dimensions | `SkillState` sépare niveau, confiance et robustesse | P1, P7 : ne pas condenser le doute | `lib/domain/types.ts`, `lib/engine/skill-state.ts` | `lib/engine/moteur.test.ts` | ✅ |
| Refus de recommander | États, exercices, tentatives, calibrations et refus | Recommandation ou `RefusRecommandation` motivé | P7 : le moteur peut ne rien conclure | `lib/domain/types.ts`, `lib/engine/recommend.ts` | `lib/engine/moteur.test.ts`, `lib/engine/calibration.test.ts` | ✅ ADR-054 |
| Une faiblesse survit | Historique de preuves et nouvelle démonstration | Niveau / robustesse dérivés sans effacer un échec sans preuve postérieure | P4 | `lib/engine/preuve.ts`, `lib/engine/skill-state.ts`, `lib/engine/maitrise.ts` | `lib/engine/moteur.test.ts`, `lib/engine/maitrise.test.ts` | ✅ P4 |
| Abandon ≠ mesure | Tentative et soumission de bilan | Aucun `SkillEvidence` issu d'une tentative abandonnée | P2, P3 | `lib/domain/tentative.ts`, `lib/store/actions.ts` | `lib/domain/tentative.test.ts` | ✅ ADR-030 |
| Aucune comparaison entre comptes | Données du seul compte courant | Aucun classement ni benchmark produit | P8 : pas de partage sans consentement | absence assumée ; `lib/store/db.ts` est centré sur le compte | — (absence de fonctionnalité) | ✅ |
