# Couche 2 — Ce qu'elle observe

Une observation a une source et reste absente quand elle n'est pas constatée. Les statuts sont recopiés de `PRODUCT_SPECIFICATION_MAP.md`.

| Brique | Entrées | Sortie stockée / constatée | Invariant | Code | Tests | Statut |
|---|---|---|---|---|---|---|
| Tentative | Début, fin, réponse, indices et statut de l'exercice | `ExerciseAttempt` | P3 : la tentative est un fait, pas une note | `lib/domain/types.ts`, `lib/domain/tentative.ts`, `lib/store/actions.ts` | `lib/domain/tentative.test.ts` | ✅ |
| Évaluation assistée validée | Proposition du tuteur et validation critère par critère | Bilan validé, jamais simple auto-évaluation | P5 : le tuteur propose, la personne valide | `lib/domain/bilan.ts`, `components/exercices/bilan-assiste.tsx`, `components/exercices/formulaire-bilan.tsx` | `lib/tutor/conversion-correction.test.ts`, `lib/tutor/correction.test.ts` | ✅ ADR-046 |
| Aide extérieure reçue | Traces internes d'abord, puis déclaration des aides invisibles | Aide observée ; autonomie dérivée lors du bilan | P8 : absence de trace ≠ absence d'aide | `lib/domain/bilan.ts`, `lib/store/actions.ts`, `components/exercices/formulaire-bilan.tsx` | `lib/domain/tentative.test.ts` | 🔬 ADR-033 / ADR-057 — barème à confronter |
| Verdict du tuteur archivé | Proposition de correction avant validation | `VerdictTuteur` attaché à la tentative | P3, P5 : conserver la proposition sans la confondre avec la mesure | `lib/domain/types.ts`, `lib/store/actions.ts`, `lib/tutor/correction.ts` | `lib/tutor/correction.test.ts`, `lib/tutor/conversion-correction.test.ts` | 🔬 ADR-046 |
| Preuve | Bilan validé, contexte et source obligatoire | `SkillEvidence` par compétence et dimension | P3 : toute mesure a une source | `lib/domain/types.ts`, `lib/engine/preuve.ts`, `lib/store/actions.ts` | `lib/engine/moteur.test.ts`, `lib/domain/tentative.test.ts` | ✅ P3 |
| Hésitations / stratégies | — | Aucune observation produite ; le principe de recueillir les faits pertinents est décidé | P2, P3 : l'absence ne devient pas une valeur et toute trace a une source | — | — | ❓ non construit — ADR-060 |
| Détection de triche | — | Aucune observation ni accusation produite | P7 : ne pas affirmer ce qui n'est pas prouvé | — | — | ❓ |
| Erreurs récurrentes / motifs | Verdicts archivés | Pas encore de détection de motif | P3 : un motif futur devra remonter à des observations | `lib/tutor/correction.ts` (verdict) | `lib/tutor/correction.test.ts` | ❓ partiellement construit |
