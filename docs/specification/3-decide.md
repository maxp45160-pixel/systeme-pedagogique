# Couche 3 — Ce qu'elle décide

Les sorties de cette couche sont dérivées et recalculables : elles ne sont pas des données à persister. Les statuts sont recopiés de `PRODUCT_SPECIFICATION_MAP.md`.

| Brique | Entrées | Sortie dérivée | Invariant | Code | Tests | Statut |
|---|---|---|---|---|---|---|
| Mise à jour du modèle | Compétence, preuves et date de calcul | `SkillState` : niveau, confiance, robustesse, couverture et dimensions | P1, P2, P3 | `lib/engine/skill-state.ts` | `lib/engine/moteur.test.ts` | ✅ |
| Maîtrise | États par compétence et historique de preuves | Prédicat de maîtrise et évolution proposée | P4 : aucune évolution sans démonstration | `lib/engine/maitrise.ts` | `lib/engine/maitrise.test.ts` | 🔬 ADR-042 |
| Calibration | Tentatives terminées, preuves et date | Verdict, durée de référence, dimension faible et difficulté visée | Ne pas fabriquer une calibration depuis une donnée invalide | `lib/engine/calibration.ts` | `lib/engine/calibration.test.ts` | 🔬 ADR-045 |
| Révision espacée | `SkillState` et date courante | Échéance, facteurs et liste des révisions dues | P1 : heuristique recalculable | `lib/engine/spaced.ts` | `lib/engine/spaced.test.ts` | 🔬 |
| Recommandation expliquée | États, exercices, tentatives, calibrations et refus | `Recommandation` avec `Facteur[]`, ou refus motivé | P3, P7 : chaque conseil porte son pourquoi | `lib/engine/recommend.ts` | `lib/engine/moteur.test.ts`, `lib/engine/calibration.test.ts` | ✅ ADR-054 |
| Plan de séance | Portée, besoin, états, exercices, tentatives, calibrations et thèmes | Blueprint composé ; séances étendues sans recréation | P1 ; une séance ne double pas le journal | `lib/domain/seance.ts`, `lib/engine/caf.ts` | `lib/domain/seance.test.ts`, `lib/engine/caf.test.ts` | ✅ ADR-048 / ADR-049 |
| Graphe de connaissances | Référentiel, états, thèmes et exercices | Nœuds typés et liens réels, dont similarité textuelle dérivée | P6 : aucune arête fabriquée | `lib/domain/graphe.ts`, `lib/engine/similarite-textuelle.ts` | `lib/domain/graphe.test.ts`, `lib/engine/similarite-textuelle.test.ts` | ✅ ADR-056 |
| Tendances longitudinales | Tentatives, preuves et date | Activité et événements récents | P1 : vue calculée | `lib/engine/historique.ts`, `lib/engine/progression.ts` | `lib/engine/moteur.test.ts` (couverture moteur) | 🔬 partiel |
| Replanification automatique | — | Aucune décision automatique | « proposé, jamais appliqué » | — | — | ❓ non construit |
| Rapports hebdomadaires | — | Aucune synthèse périodique poussée | P8 : finalité et consentement avant partage | — | — | ❓ non construit |
