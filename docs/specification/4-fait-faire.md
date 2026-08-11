# Couche 4 — Ce qu'elle fait faire

Cette couche décrit les gestes rendus possibles dans l'interface, pas une nouvelle logique métier. Les statuts sont recopiés de `PRODUCT_SPECIFICATION_MAP.md`.

| Brique | Entrées | Geste / sortie d'interface | Invariant | Code | Tests | Statut |
|---|---|---|---|---|---|---|
| Dashboard — Piloter | Contexte dérivé du compte | Voir l'état global et déclencher la prochaine action | Le niveau affiché reste distingué de sa couverture | `app/(app)/page.tsx`, `components/dashboard/etat-global.tsx`, `components/dashboard/prochaine-action.tsx` | `lib/engine/moteur.test.ts` (données affichées) | ✅ |
| Session d'apprentissage — Travailler | Demande, portée et corpus | Composer, planifier et dérouler une séance | Une séance ne crée pas de double journal | `app/(app)/seances/`, `components/seances/concepteur-seance.tsx`, `lib/store/seance-actions.ts` | `lib/domain/seance.test.ts`, `lib/engine/caf.test.ts` | ✅ |
| Profil & progression — Suivre | Référentiel, états et profil | Consulter l'état et gérer le référentiel | Le référentiel reste propre au compte | `app/(app)/competences/`, `app/(app)/profil/`, `components/referentiel/` | `lib/domain/referentiel-compte.test.ts`, `lib/domain/profil.test.ts` | ✅ |
| Exercice puis bilan | Exercice, tentative et bilan validé | Répondre, demander un indice, terminer ou abandonner | Abandon ≠ preuve ; aide extérieure observée | `app/(app)/exercices/`, `components/exercices/`, `lib/store/actions.ts` | `lib/domain/tentative.test.ts`, `lib/domain/exercice.test.ts` | ✅ |
| Demander au tuteur | Message, contexte borné et enum serveur | Proposer contenu, branche, correction ou thème | P5 : aucune mesure écrite par le tuteur | `app/(app)/tuteur/`, `components/tuteur/`, `app/api/tutor/route.ts`, `lib/tutor/` | `lib/tutor/contexte.test.ts`, `lib/tutor/outils.test.ts` | ✅ ADR-004 / ADR-037 |
| Workspace focus | Séance créée | Destination continue du geste composer → créer → travailler | Étendre `LearningSession`, ne pas créer une entité concurrente | `components/exercices/focus-acte.tsx` (acte ponctuel, pas encore le workspace) | — | ❓ non construit — geste décidé ADR-059 |
| Reporting long terme | Redirections de routes historiques | Pas d'écran dédié ; `/progression` redirige ; hors prochaine roadmap | Ne pas présenter une vue absente comme construite | `app/(app)/progression/page.tsx`, `app/(app)/journal/page.tsx` | — | ❓ réouverture sur données nouvelles |
| Graphe navigable / éditable | Graphe dérivé | Lecture et filtrage dans la vue compétences ; pas d'édition par le graphe | Aucune arête inventée | `components/competences/graphe/`, `app/(app)/competences/page.tsx` | `lib/domain/graphe.test.ts` | 🔬 lecture seule |
