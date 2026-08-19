# Contrats du moteur pédagogique

> Statut : **proposition de travail — non validée**.
>
> Ce document ne modifie aucun statut de `PRODUCT.md` ou
> `ARCHITECTURE_DECISIONS.md`. Il rassemble les contrats nécessaires pour
> rendre la refonte testable et réversible.

## 1. But et périmètre

Le moteur doit répondre à une seule question :

> Quelle est la meilleure action étayée maintenant, compte tenu des faits
> disponibles, du contexte déclaré et des actions réellement faisables ?

La boucle cible est :

```text
faits observés
  → preuves recevables
  → état dérivé de l'apprenant
  → actions candidates
  → politique pédagogique
  → intervention
  → nouveaux faits observés
```

Ce document couvre le noyau métier. Il ne tranche pas :

- un modèle probabiliste particulier (Bayes, IRT, Knowledge Tracing, FSRS) ;
- les seuils de calibration pédagogique ;
- le contrat de preuve d'un projet ;
- une migration SQL ou une nouvelle entité de persistance ;
- l'efficacité pédagogique de la politique actuelle.

Les interfaces TypeScript ci-dessous sont des contrats cibles. Elles ne sont
pas encore des types à ajouter tels quels dans le code.

## 2. Frontière des couches

| Couche | Contrat | Persistance |
|---|---|---|
| 0 — Ignore | ce que le moteur refuse d'affirmer | jamais comme fait |
| 1 — Connaît | déclarations confirmées, référentiel, exercices, ressources | oui |
| 2 — Observe | événements, tentatives, productions, évaluations validées, preuves | oui |
| 3 — Décide | états, candidats, classement, explications, prédictions | recalculé |
| 4 — Fait faire | activité, consigne, aide, workspace, tuteur | interface |
| 5 — Fait des données | stockage, validation d'entrée, RLS, transactions | infrastructure |

Règle absolue : les couches 1 et 2 ne sont pas reconstruites à partir des
couches 3 et 4 ; la couche 3 ne devient pas une source persistée de vérité.

## 3. Conventions communes

Chaque contrat métier doit préciser :

1. sa source de vérité ;
2. ses entrées et sorties ;
3. ce qui est stocké ou recalculé ;
4. son comportement face à l'absence ou à l'invalidité ;
5. sa provenance et sa version de règle, si nécessaire.

Règles communes :

- une donnée invalide est rejetée ou mise en réserve ; elle ne devient jamais
  `0`, `false` ou une valeur par défaut présentée comme un fait ;
- l'absence de preuve produit `null`, `unknown` ou une réserve explicite ;
- toute mesure possède une source vérifiable ;
- le tuteur peut produire du contenu ou une proposition, jamais une mesure ;
- une tentative abandonnée ne produit pas de preuve ;
- une preuve originale n'est pas réécrite ;
- toute fonction du moteur est pure et sans accès à Supabase, à l'horloge ou
  aux variables d'environnement ;
- les données entrantes sont validées avant l'appel au moteur.

## 4. Contrat A — Observation

Une observation est un fait daté, attribué à un compte et rattaché à une
source. Elle décrit ce qui s'est passé ; elle ne conclut pas ce que la personne
sait.

```ts
interface Observation {
  id: string;
  accountId: string;
  occurredAt: string;
  kind:
    | "attempt-started"
    | "attempt-submitted"
    | "attempt-abandoned"
    | "help-used"
    | "tutor-requested"
    | "activity-event"
    | "production-submitted"
    | "assessment-validated"
    | "recommendation-interaction";
  source: {
    kind: "attempt" | "activity-run" | "session" | "document" | "system";
    ref: string;
  };
  context?: {
    situationFamily?: string;
    label?: string;
    declaredAt?: string;
  };
  payload: Record<string, unknown>;
}
```

### Garanties

- `payload` contient uniquement des faits validés par le chemin qui les a
  recueillis ;
- `attempt-abandoned` est conservée comme observation, mais n'est pas une
  observation probante ;
- une observation ne porte ni `niveau`, ni `score`, ni `confiance`, ni
  `robustesse` ;
- `source.ref` doit identifier l'événement ou la tentative exacte quand cette
  granularité existe.

### Compatibilité actuelle

Le contrat est actuellement réparti entre `ExerciseAttempt`,
`ActivityEvent`, `LearningSession`, `VerdictTuteur` et les interactions de
recommandation. La provenance historique de `SkillEvidence` référence encore
souvent l'exercice plutôt que la tentative : cette limite doit rester visible,
et ne doit pas être corrigée par une association inventée.

## 5. Contrat B — Preuve recevable

Une preuve est une observation évaluative validée qui peut contribuer à l'état
d'une compétence. Elle ne contient pas l'état global de la compétence.

Le contrat existant est `SkillEvidence`. La cible est de lui conserver cette
forme, avec les obligations suivantes :

```ts
interface SkillEvidenceContract {
  id: string;
  skillCode: string;
  observedAt: string;
  result: "reussi" | "partiel" | "echec";
  evidenceLevel: "A" | "B";
  autonomy: "A0" | "A1" | "A2" | "A3" | "A4";
  quality: "faible" | "moyenne" | "forte";
  dimensions: Partial<Record<Dimension, number>>;
  source: {
    kind: "attempt" | "activity-run" | "session" | "project" | "manual";
    ref: string;
    snapshotId?: string;
  };
}
```

Les noms de champs restent ceux de `SkillEvidence` tant qu'aucune migration
n'est décidée. Le contrat décrit leur rôle, pas un renommage obligatoire.

### Garanties

- seuls les niveaux de preuve A et B entrent dans le moteur de maîtrise ;
- une évaluation proposée par le tuteur n'est pas une preuve ;
- une source historique marquée `tuteur` peut être relue comme donnée ancienne,
  mais aucune nouvelle preuve ne peut être créée avec le tuteur comme autorité
  de mesure ;
- une preuve n'est créée qu'à partir d'une tentative ou d'une validation
  effectivement réalisée ;
- `familleSituation` est une vue dérivée lorsqu'elle est reconstruite depuis
  l'exercice source ; elle ne doit pas devenir une nouvelle affirmation
  persistée ;
- les compétences concernées viennent du référentiel fourni par le serveur ;
- une correction ultérieure de l'exercice ne réécrit pas la preuve produite
  avec sa version précédente.

## 6. Contrat C — Modèle de l'apprenant

Le modèle de l'apprenant est entièrement dérivé des compétences, des preuves
et de la date de calcul. Il n'est pas persisté.

La première version ne doit pas créer un score général qui remplacerait la
robustesse. Elle expose des dimensions séparées :

```ts
interface LearnerSkillState {
  skill: Skill;
  status: "non-evalue" | "hypothese" | "evalue";
  level: NiveauCompetence | null;
  score: number | null;
  dimensions: Record<Dimension, number>;

  evidenceSupport: {
    acceptedCount: number;
    successfulCount: number;
    independentSituationFamilies: number;
    contradictoryCount: number;
  } | null;

  transfer: {
    status: "unknown" | "single-family" | "multi-family";
    situationFamilyCount: number;
    successfulSituationFamilyCount: number;
  } | null;

  retention: {
    status: "unknown" | "not-tested" | "supported";
    delayedSuccessCount: number;
    lastDelayedSuccessAt: string | null;
  } | null;

  autonomy: {
    level: Autonomie | null;
    sourceKinds: string[];
    externalHelpUnknown: boolean;
  } | null;

  confidence: Confiance;
  reservations: string[];
  evidence: SkillEvidence[];
}
```

### Sémantique des dimensions

- `level` est une conclusion ordinale du protocole, pas une mesure brute ;
- `score` est une projection numérique du niveau et des dimensions, jamais une
  preuve indépendante ;
- `evidenceSupport` décrit la quantité et la diversité des appuis ;
- `transfer` ne compte que les familles de situation définies par le moteur,
  pas les titres d'exercices ;
- `retention` ne peut être `supported` qu'à partir d'observations séparées dans
  le temps ; une date de révision prévue n'est pas une réussite différée ;
- `autonomy` est dérivée des traces d'aide puis des aides externes déclarées,
  selon ADR-057 ; absence de trace ne signifie pas `A4` ;
- `confidence` exprime la solidité épistémique de la conclusion, pas la
  probabilité de réussite au prochain exercice ;
- `metacognition` n'est pas encore une dimension calculée : elle demande un
  protocole d'observation explicite.

### Point de compatibilité

`SkillState.robustesse` reste présent tant que ses consommateurs n'ont pas été
remplacés. Dans la cible, il devient au maximum un indicateur de présentation
ou une agrégation dérivée versionnée ; il ne doit plus être la seule entrée
silencieuse de l'espacement, de la recommandation et de la prédiction.

## 7. Contrat D — Action candidate

Une action candidate décrit ce que le système peut réellement faire maintenant
et ce qu'elle pourrait permettre d'observer. Elle ne constitue pas encore une
décision.

```ts
interface ActionCandidate {
  candidateId: string;
  source: "existing-activity" | "resume" | "generation" | "legacy-exercise";
  target: {
    skillCodes: string[];
    themeIds: string[];
    goalIds: string[];
    label?: string;
  };
  /** `explorer` reste seulement un ancien discriminant d'adaptateur. */
  family: "entrainer" | "produire";
  durationMinutes: number;
  minimumSegmentMinutes?: number;
  cognitiveDemand: MentalCapacity;
  workspace: ActivityWorkspace;
  requiredTools: WorkspaceTool[];
  proofMode: "none" | "support-only" | "validated-submission";
  expectedObservations: Array<
    | "production"
    | "response"
    | "assessment"
    | "help"
    | "delayed-recall"
    | "recommendation-interaction"
  >;
  constraints: string[];
  reservations: string[];
  sourceVersion?: number;
}
```

### Garanties

- une durée estimée n'est jamais une durée observée ;
- une activité qui ne produit pas de preuve peut tout de même être proposée,
  mais son effet est décrit comme soutien ou préparation ;
- une candidate indisponible, invalide ou sans cible recevable est exclue avec
  une réserve explicite ;
- les propriétés de l'activité, les prédictions avant action et les résultats
  après action restent trois choses distinctes.

Le modèle actuel se mappe principalement sur `Exercise`, `LearningActivity`,
`ActivityRun`, `Calibration` et le modèle de répétition espacée.

Le type historique `ActivityFamily` contient encore `explorer`. Tant que cet
adaptateur existe, une donnée ancienne peut être lue, mais la politique cible
ne doit plus sélectionner cette famille : la branche documentaire et le
mini-projet suivent le chemin de note opérationnelle défini par ADR-070.

## 8. Contrat E — Politique pédagogique

La politique est la seule brique autorisée à sélectionner l'action principale.
Elle reçoit des faits déjà validés et des états déjà calculés ; elle ne lit
aucun stockage.

```ts
interface PolicyInput {
  accountId: string;
  declaredContext: ActionContext;
  goals: readonly LearningGoal[];
  skillStates: readonly LearnerSkillState[];
  candidates: readonly ActionCandidate[];
  observedRefusals: readonly {
    candidateId: string;
    observedAt: string;
    expiresAt?: string;
    sourceRef: string;
  }[];
  now: string;
  policyVersion: string;
}

interface PolicyDecision {
  primary: ActionCandidate;
  alternatives: ActionCandidate[];
  factors: {
    kind: RecommendationFactor["kind"];
    label: string;
    sourceRef?: string;
  }[];
  constraints: string[];
  reservations: string[];
  policyVersion: string;
}
```

### Ordre de décision v0

La politique v0 doit être déterministe et explicable :

1. exclure les actions invalides, indisponibles ou interdites par le contexte ;
2. respecter la cible et l'intention déclarées lorsqu'elles existent ;
3. éviter une répétition explicitement sanctionnée ;
4. donner priorité aux lacunes ou révisions que l'état dérivé justifie ;
5. favoriser une action qui produit une observation utile manquante ;
6. départager par durée, capacité, préférence confirmée et actionnabilité ;
7. retourner une réserve quand aucune action n'est suffisamment étayée.

La formule d'utilité globale « apprentissage + rétention + transfert +
information − coût » reste une hypothèse future. Elle ne doit pas être
introduite dans ce contrat tant que ses termes et leur calibration ne sont pas
observables.

`recommander()` et `choisirActionUnifiee()` sont les implémentations actuelles
à réunir progressivement derrière cette frontière. Ils ne doivent pas être
dupliqués par un second classement parallèle.

## 9. Contrat F — Intervention et tuteur

La politique ne produit pas directement une mesure. Elle produit une demande
d'intervention :

```ts
interface InterventionRequest {
  decision: PolicyDecision;
  activity: ActionCandidate;
  mode: WorkModeSettings;
  allowedTools: WorkspaceTool[];
}
```

Le tuteur peut alors produire :

- une consigne ;
- un exercice ou un contenu ;
- une aide ;
- une proposition d'évaluation ;
- un retour textuel.

Le tuteur ne peut pas produire directement :

- un niveau ;
- un score ;
- une confiance ;
- une preuve validée ;
- une préférence confirmée ;
- une conclusion sur l'apprenant.

La mesure revient au chemin de soumission et de validation de l'application.

## 10. Contrat G — Résultat et retour dans la boucle

Une intervention se termine par zéro, une ou plusieurs observations. Elle ne
modifie jamais directement `LearnerSkillState`.

```ts
interface InterventionOutcome {
  interventionId: string;
  status: "completed" | "abandoned";
  observations: Observation[];
  validatedEvidence: SkillEvidence[];
}
```

`validatedEvidence` est vide si l'activité a été abandonnée, si la réponse
requise n'a pas été produite, si le verdict n'a pas été validé ou si le contrat
de preuve ne permet pas de mesurer ce geste.

Le cycle suivant recalcule alors l'état depuis l'historique complet, et non
depuis le résultat précédent.

## 11. Versionnement, erreurs et traçabilité

- Les règles de calcul de l'état portent une version lorsque leur évolution
  change l'interprétation des résultats.
- La politique porte une `policyVersion` ; une prédiction porte une
  `modelVersion` distincte.
- Une décision peut être journalisée comme observation de décision, mais elle
  ne devient jamais la source de l'état apprenant.
- Une prédiction conserve ses entrées et son horizon ; sa résolution est
  recalculée depuis les observations ultérieures.
- Une erreur de validation est observable par le chemin d'application, mais
  ne fabrique aucune donnée pédagogique.
- Les écritures multi-objets et l'idempotence restent du ressort de
  `lib/store/` et de la base ; le moteur pur ne simule pas une transaction.

## 12. Tests contractuels minimaux

Avant de remplacer une brique, les propriétés suivantes doivent être testées :

1. aucune preuve → `level = null`, `score = null`, confiance nulle ;
2. tentative abandonnée → aucune preuve ;
3. verdict du tuteur non validé → aucune preuve ;
4. preuve sans source recevable → rejet ou réserve, jamais mesure ;
5. un échec reste visible après une réussite ultérieure ;
6. deux titres différents d'une même famille ne constituent pas un transfert ;
7. deux familles distinctes ne suffisent pas à elles seules à prouver tous les
   niveaux supérieurs ;
8. une durée estimée ne devient jamais une durée observée ;
9. la politique ne choisit jamais une candidate invalide ou non disponible ;
10. le même événement soumis deux fois ne produit pas une double entrée ;
11. une décision change si ses entrées changent, sans modifier les faits
    historiques ;
12. une nouvelle règle de calcul peut relire l'historique sans migration d'un
    profil dérivé.

## 13. Ordre de migration proposé

Cette séquence est une proposition technique, pas une décision de produit :

1. documenter et tester les invariants déjà présents autour de
   `SkillEvidence`, `ExerciseAttempt` et `SkillState` ;
2. introduire une façade pure de modèle apprenant qui expose les dimensions
   séparées tout en alimentant temporairement les consommateurs de
   `robustesse` ;
3. formaliser `ActionCandidate` comme adaptateur de `Exercise` et des
   activités existantes ;
4. faire de la politique le seul point de sélection, sans modifier d'abord le
   classement interne ;
5. conserver `prediction.ts` comme modèle falsifiable séparé jusqu'à ce que
   ses sorties soient confrontées aux résultats ;
6. seulement ensuite décider si certains anciens champs ou modules peuvent
   être retirés.

À aucun moment cette migration ne doit créer une seconde source de vérité,
une nouvelle entité à côté de `LearningSession`, ou une table de profil dérivé.

## 14. Questions qui restent ouvertes

- Quelle observation minimale autorise chaque niveau 0–5 ?
- Quelle durée sépare une réussite immédiate d'une réussite de rétention ?
- Comment une famille de situation est-elle déterminée quand la source est
  historique ou introuvable ?
- Quel contrat permettra un jour à un projet de produire une preuve ?
- Quelles observations rendent une inférence de métacognition légitime ?
- La politique gagne-t-elle réellement en qualité quand les dimensions de
  `robustesse` sont séparées ?

Ces questions doivent rester des questions ouvertes jusqu'à ce qu'une personne
les tranche ou qu'une mesure les réfute. Ce document ne les ferme pas.
