# Couche 1 — Ce qu'elle connaît

Les données de cette couche sont déclarées par le compte ou par un contenu validé : aucune ne doit être dérivée. Les statuts sont recopiés de `PRODUCT_SPECIFICATION_MAP.md`.

| Brique | Entrées | Sortie stockée / déclarée | Invariant | Code | Tests | Statut |
|---|---|---|---|---|---|---|
| Référentiel | Domaines et compétences proposés ou saisis | `Referentiel` par compte, avec palier, importance et archivage | P1, P7 : le référentiel appartient au compte | `lib/domain/types.ts`, `lib/domain/referentiel-compte.ts`, `lib/store/referentiel-actions.ts` | `lib/domain/referentiel-compte.test.ts`, `lib/tutor/generation-referentiel.test.ts` | ✅ ADR-026 |
| Thèmes / sous-thèmes | Libellé, intention facultative et codes existants | `Theme` persistant, portée de séance | P1 : un thème ne porte aucune mesure | `lib/domain/theme.ts`, `lib/store/themes.ts`, `lib/store/theme-actions.ts` | `lib/domain/theme.test.ts`, `lib/tutor/conversion-theme.test.ts` | 🔬 ADR-055 |
| Notions / noties | — | Aucune entité ni persistance | Ne pas créer une granularité sans arbitrage | — | — | ❓ non construit |
| Corpus d'exercices | Énoncé, données, indices, correction, critères, difficulté, origine et intention | `Exercise` persistant | `dureeEstimeeMin` n'est pas une mesure ; édition identitaire interdite | `lib/domain/types.ts`, `lib/domain/exercice.ts`, `lib/store/actions.ts` | `lib/domain/exercice.test.ts`, `lib/tutor/conversion-exercice.test.ts` | ✅ |
| Besoin déclaré | Intention et temps déclarés par la personne | `BesoinDeclare` rattaché à la séance | P3 : déclaration distincte de l'écart dérivé | `lib/domain/types.ts`, `lib/domain/seance.ts`, `lib/store/seance-actions.ts` | `lib/domain/seance.test.ts` | ✅ ADR-050 |
| Protocoles du tuteur | Instructions versionnées | Instructions fournies au tuteur | P6 : protocole = spécification | `app/data/00_instructions/`, `lib/tutor/contexte.ts` | `lib/tutor/contexte.test.ts` | ✅ |
| Notes markdown liées | — | Aucune note liée persistée | Ne pas ouvrir un second produit sans décision | — | — | ❓ non construit |
| Widgets modulables | — | Aucune composition utilisateur de l'accueil | Ne pas construire par anticipation | — | — | ❓ non construit |
