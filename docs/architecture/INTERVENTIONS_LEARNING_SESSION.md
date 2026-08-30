# Matrice des interventions d'une `LearningSession`

État vérifié le 29/08/2026. `LearningSession` est l'épisode de travail unique.
Une intervention est un geste porté dans `sessions.interventions` ; elle ne
crée ni séance parallèle ni nouvelle entité de travail. Son statut d'exécution
est un fait de séance, distinct d'une Observation.

| Intervention | Intention et entrée | Interface actuelle | Résultat attendu et fin | Provenance | Contrat de preuve |
|---|---|---|---|---|---|
| `resoudre` | Traiter un exercice concret ; entrée : énoncé, critères et source exercice. | `VueExercice` intégré au déroulé, avec réponse, correction et bilan. | Une tentative terminée ou abandonnée ; la séance enchaîne l'exercice suivant, puis se clôt quand tout est traité. | `InterventionSeance.source` vers l'exercice, puis tentative exacte dans l'Observation éventuelle ; `origineProposition` reste sur la séance. | La correction recevable du parcours exercice peut produire l'Observation ; aucune mesure n'est créée à l'acceptation ou à l'abandon. |
| `expliquer` | Reformuler une notion avec ses propres mots ; entrée : compétence ciblée et consigne relue. | Espace Feynman existant, ouvert avec le contexte `session` + `intervention` et un retour direct à la séance. | Retour formatif, puis « Terminer l'intervention sans mesure » ou fin après relecture ; la même séance est mise à jour. | Compétence et éventuel cours portés par l'intervention ; le lien de retour conserve l'identité de la séance. | Aucun contrat dans les interventions de préparation actuelles : l'évaluation affichée reste formative et ne crée pas d'Observation. Le parcours autonome `/expliquer` est un geste distinct et explicitement validé. |
| `rappeler` | Récupérer une notion de mémoire avant vérification ; entrée : consigne déterministe et source réelle du cours ou document. | Carte de rappel avec zone de restitution locale et lien explicite vers la source. | La restitution peut être relue contre la source, puis l'intervention est déclarée terminée ; aucun texte local n'est transformé en fait de mesure. | `InterventionSeance.source` et, pour un cours, `blueprint.origine.ficheId`/`pieceId`. | Pas de contrat automatique ; aucune Observation par défaut. |
| `lire` | Prendre connaissance d'un support ; entrée : document explicitement désigné. | Atelier documentaire existant, ouvert seulement par le lien choisi par la personne. | Retour à la séance après lecture, puis statut `completed`. | Source document ou cours conservée sur l'intervention et, si disponible, sur le blueprint. | `none` : lire ne produit jamais de mesure par défaut. |
| `synthetiser` | Organiser l'essentiel d'un support ; entrée : document ou cours désigné. | Atelier documentaire existant, avec retour à la séance. | Production relue par la personne, puis intervention terminée ; aucune séance supplémentaire n'est créée. | Source document/cours de l'intervention ; les faits de corpus restent dans les documents existants. | `none` dans le parcours actuel. Une production ne pourra devenir preuve que par un contrat explicite de correction et sa validation. |
| `produire` | Réaliser un artefact ou une application ; entrée : objectif et source déclarés. | Atelier ou espace documentaire existant quand une source ouvrable est disponible, sinon consigne et fin explicites dans la carte de séance. | Artefact terminé ou geste déclaré terminé, puis retour au déroulé. | `InterventionSeance.source`, `origineProposition` et éventuellement source documentaire. | `none` dans le parcours actuel ; aucune preuve n'est déduite de l'existence d'un document. |
| `diagnostiquer` | Établir ce qui est effectivement maîtrisé sur un exercice diagnostic ; entrée : exercice, critères et compétences du référentiel actif. | Même `VueExercice` intégré que `resoudre`, avec le parcours de correction et de bilan diagnostic. | Tentative et correction recevables, puis observation sourcée ; sinon abandon/fin sans observation et accès au déroulé. | Source exercice, tentative exacte et trace de correction ; les codes viennent du référentiel actif. | Le contrat du parcours exercice est le seul chemin de mesure ; l'absence de correction recevable ne produit rien. |
| `demander-aide` | Obtenir un soutien contextualisé ; entrée : objectif de l'intervention et compétence éventuelle. | `TiroirTuteur` ouvert par une action explicite, avec amorce relue avant envoi ; aucun document n'est transmis automatiquement. | Réponse du tuteur, puis la personne déclare le geste terminé ou quitte sans mesure. | Intervention et compétence cible ; le contenu du tuteur n'est pas une Observation. | `none` : demander de l'aide ne mesure jamais par défaut. |

## Règles communes

- L'acceptation du plan matérialise uniquement la `LearningSession` acceptée.
  Les interventions restent dans sa composition canonique et les exercices
  manquants sont générés au démarrage prévu, pas à la validation du plan.
- Le statut `completed` ou `abandoned` d'une intervention ne modifie pas une
  compétence. Une Observation exige son chemin de preuve et sa provenance
  exacte ; terminer une intervention sans preuve laisse une séance terminée
  sans observation.
- Un document n'atteint le tuteur qu'après ouverture explicite et relecture
  humaine. Les liens documentaires portent un retour vers la séance, afin de
  ne pas transformer un changement d'écran en perte de contexte.
- Les composants d'exercice, d'Atelier, de Feynman, du tuteur et d'action de
  séance restent les primitives de parcours. Aucun composant n'introduit une
  entité de travail parallèle.

## Vérification

`app/src/components/seances/rendu-intervention.test.ts` déroule les huit types
dans le registre de rendu et vérifie leur sortie dédiée. Les tests de domaine
protègent les contrats d'exécution et l'absence d'Observation implicite ; les
tests de store protègent la clôture Feynman et non probante dans la séance
existante. Le scénario combiné associe une intervention `explain` et une
intervention `read` dans deux séances de la même semaine : chacune conserve
son identité, sa source, son retour et son statut sans créer d'épisode
parallèle. Le contrat de preuve explicite de `produce` est également vérifié.
