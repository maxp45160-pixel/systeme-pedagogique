# AGENTS.md — Système pédagogique

## Projet

Application de suivi longitudinal des compétences.

Boucle centrale :

génération d'exercices → évaluation → adaptation

Lire `PRODUCT.md` avant toute décision produit.
Lire `ARCHITECTURE_DECISIONS.md` avant toute modification architecturale.

Ne jamais transformer une analyse Codex en décision validée.

## Architecture cible en cours de conception

Le modèle métier cible est décrit dans :

`docs/architecture/TWINY_MODEL.md`

Ce document est une architecture métier cible, pas un schéma SQL à implémenter
littéralement.

Le code actuel reste la vérité de l'état effectivement implémenté.

Toute migration doit commencer par comparer les deux.

Aucun concept du modèle cible ne doit devenir automatiquement une table, un
service ou une entité persistée.

Ne jamais effectuer une refonte big bang.

---

## Les six couches

Vocabulaire commun à tout le dépôt, défini ci-dessous.
Toute brique du produit se range dans exactement une couche.

| # | Couche | Question | Nature |
|---|---|---|---|
| 0 | **Ignore** | Que refuse-t-elle d'affirmer ? | Garde-fou |
| 1 | **Connaît** | Qu'est-ce qui est déclaré ? | Stocké, jamais calculé |
| 2 | **Observe** | Qu'est-ce qui a été constaté ? | Stocké, jamais fabriqué |
| 3 | **Décide** | Qu'en déduit-elle ? | Dérivé, recalculable |
| 4 | **Fait faire** | Quel geste demande-t-elle ? | Interface |
| 5 | **Fait des données** | Où vont-elles, qui y accède ? | Infrastructure |

Frontière non négociable : **1 et 2 ne se recalculent pas, 3 ne se stocke pas.**
Une brique qui viole cette frontière est un défaut, pas une variante.

Statuts : ✅ construit et tranché · 🔬 construit, hypothèse non réfutée ·
❓ non construit ou arbitrage ouvert · 🗑️ écarté.

**Aucun agent ne fait monter un statut.** Seule une personne passe une brique
en ✅, explicitement.

---

## Architecture

- Next.js App Router + React + TypeScript strict
- Supabase/PostgreSQL + Supabase Auth
- Vercel
- Vitest
- Tailwind CSS
- MCP Supabase

Structure :

- `lib/domain/` → logique métier pure
- `lib/engine/` → calculs et recommandations
- `lib/store/` → persistance
- `lib/tutor/` → tuteur IA
- `app/data/00_instructions/` → protocoles du tuteur
- `app/supabase/` → schéma et migrations

Supabase est la source de vérité des données.

RLS est la barrière d'autorisation de confiance.
Ne jamais exposer `service_role` côté client.

Le moteur ne connaît pas le référentiel : il reçoit les compétences en paramètre.

---

## Invariants métier

1. Ne pas stocker ce qui est dérivable.
2. Toute mesure doit avoir une source explicite.
3. Absence de preuve ≠ zéro.
4. Une faiblesse ne disparaît pas sans nouvelle démonstration.
5. Le tuteur produit du contenu, pas des mesures.
6. Ne jamais inventer de données.
7. Le référentiel appartient au compte.
8. Les données personnelles ne sont jamais partagées sans consentement explicite.

Consulter `PRODUCT.md` pour la définition complète des principes.

---

## Garde-fous

- Le tuteur ne crée jamais de code de compétence.
- Les codes proposés par le tuteur doivent venir d'un `enum` fourni par le serveur.
- Une compétence avec des preuves est archivée, jamais supprimée.
- Un exercice avec des tentatives est archivé, jamais supprimé.
- L'édition d'un exercice ne modifie pas `id`, `origine` ou `competences`.
- Toute validation métier partagée doit avoir une seule implémentation.
- Les données venant de Supabase doivent être validées avant d'entrer dans le moteur.
- Ne jamais fabriquer une valeur à partir d'une donnée invalide.
- Ne pas modifier les seuils de calibration sans données justifiant le changement.
- `dureeEstimeeMin` n'est pas une mesure de performance.
- Une tentative abandonnée ne produit pas de preuve.
- Une séance ne doit pas produire de double entrée dans le journal.
- Le module de cours est un domaine du référentiel (ADR-137), pas une entité.
  L'échéance liée à un module porte un lien facultatif posé à la création et
  validé contre les domaines vivants du compte — jamais réécrit ; les
  échéances d'un module se dérivent à la lecture (`echeancesDuModule`), jamais
  recopiées.
- Ne pas créer de nouvelle entité pour remplacer `LearningSession`.
- Le plan pédagogique proposé appartient à **Décide** : il se dérive et se
  recalcule, il ne se stocke pas. Seules les séances explicitement acceptées
  deviennent des `LearningSession` planifiées.
- `LearningSession` est l'épisode de travail unique. Elle peut porter les
  interventions `resoudre`, `expliquer`, `rappeler`, `lire`, `synthetiser`,
  `produire`, `diagnostiquer` et `demander-aide` ; aucune nouvelle entité de
  travail ne remplace un de ces gestes.
- Une intervention annonce si elle vise une **mesure**, une **préparation** ou
  un **soutien**. Seul un contrat de preuve recevable produit une Observation ;
  terminer une lecture, demander de l'aide ou manquer une séance ne modifie
  jamais par défaut l'état d'une compétence.
- Retard, refus, déplacement et abandon peuvent invalider ou réordonner le
  plan, jamais produire une dette, une pénalité ni une mesure de compétence.
- La préparation à une échéance est une projection dérivée avec ses sources,
  ses incertitudes et ses réserves ; ne jamais stocker un score de préparation
  ni convertir l'absence de preuve en zéro.
- Un calendrier externe est une projection consentie : il peut fournir des
  indisponibilités et recevoir les séances acceptées. Supabase reste la source
  de vérité des données Twiny ; les identifiants de synchronisation relèvent de
  l'infrastructure, pas du modèle apprenant.
- L'orchestration ne crée aucune nouvelle destination : le tableau de bord
  pilote, Séances planifie et fait travailler, Mes cours fournit le contexte,
  Progression relit le long terme.
- Toute clé de stockage navigateur doit être isolée par compte. Exception
  documentée (décision du 21/08/2026) : les préférences d'appareil non
  personnelles `theme` et `rail` restent globales au navigateur — elles ne
  portent aucune donnée pédagogique ni identifiable.
- La logique métier non triviale doit vivre dans `lib/`, pas dans un composant.
- `outilCorrection` reste confiné au chemin de correction prévu.
- Toute route qui appelle le tuteur passe par `envTuteur` (ADR-116). C'est là
  et nulle part ailleurs qu'est décompté le quota de la clé serveur : un appel
  direct à `choisirConfiguration` génère gratuitement aux frais du compte
  fournisseur partagé.
- La phrase du tour d'accueil qui décrit les destinations se **dérive** de
  `NAVIGATION` (ADR-117), jamais recopiée — comme `NAV_MOBILE`.
- Une règle de mesure vit dans `app/data/00_instructions/`, jamais dans un
  prompt seul (ADR-123). Un prompt qui ne peut pas charger le protocole le
  **transcrit** — comme `atomicite.ts` et `explication.ts` — et la
  transcription porte un test qui relit le fichier de protocole. C'est la seule
  exception admise à « une seule implémentation », et le protocole décide.
- Le contexte permanent du tuteur ne contient **aucun document** (ADR-124).
  `contexte.ts` n'a pas de bloc de corpus documentaire, et n'en gagne pas un
  sans rouvrir la question de la fenêtre. Un document n'atteint le tuteur que
  par un geste explicite, composé côté client et **relu par la personne avant
  l'envoi** — `composerSujetFiche`, `composerSujetLecture`, `TraiterLigneMarge`.
  Rien de ce qui vient d'un document ne devient une mesure.
- Le prompt système du chat porte un plafond mesuré (ADR-125) :
  `budget-contexte.test.ts` échoue au-delà. Le relever est une décision qui
  s'écrit ; `MAX_MESSAGES_FENETRE` et `LIMITE_MATIERE_FICHE` bornent la
  conversation et se revoient avec lui.
- Le protocole d'un cours n'est pas une entité (ADR-130) : il devient des
  séances planifiées dont `blueprint.origine` porte la trace. La validation du
  plan n'appelle jamais le tuteur : les exercices manquants ne sont générés
  qu'au démarrage de la séance qui les demande (ADR-131), ancrés dans
  l'extrait du cours désigné par l'origine — jamais un autre document
  (ADR-132) —, et une séance
  planifiée sans exercice n'est tolérée que si son origine porte sa commande
  (codes + consigne). Une séance « compréhension » ne fait pas écrire
  d'exercices par le tuteur : elle reçoit des exercices-Feynman déterministes,
  sans appel LLM (ADR-133) ; une séance « mémorisation » reçoit des cartes de
  rappel qui désignent le cours réel pour vérification, jamais un corrigé
  fabriqué (ADR-134). Ses dimensions
  (compréhension, application, contextualisation, mémorisation) sont des
  intentifs de séance — elles n'observent rien et ne notent rien. Les codes
  qu'il désigne viennent de l'enum du référentiel actif, validés par
  `motifRefusProtocole`. Le journal de la fiche se DÉRIVE des sessions
  (`lireTraceProtocole`) — seuls les faits déclarés (intention, plan validé)
  s'y écrivent.
- Pas d'émoji dans le frontend : ne jamais utiliser d'émojis dans l'interface utilisateur (boutons, badges, étiquettes, icônes, textes). Utiliser les composants d'icônes SVG (`components/ui/icones.tsx`) ou du texte sobre.

Pour les détails et justifications :
`ARCHITECTURE_DECISIONS.md`.

---

## Base de données

`app/supabase/schema.sql` est le schéma de référence.

Avant toute modification DB :

1. vérifier l'état réel dans Supabase ;
2. consulter les ADR concernés ;
3. vérifier les dépendances du code ;
4. créer/appliquer la migration nécessaire ;
5. documenter la décision.

Ne jamais supposer qu'une migration est appliquée simplement parce que le fichier existe.

Ne jamais rejouer une migration appliquée sans raison.

---

## Workflow

Pour tout chantier non trivial :

1. Comprendre le problème réel.
2. Consulter les documents concernés.
3. Vérifier le code et les données.
4. Proposer un plan avant de coder.
5. Faire valider les décisions importantes.
6. Implémenter avec les tests concernés.
7. Vérifier avant merge.
8. Documenter les décisions dans les fichiers appropriés.

**Règle de synchronisation documentaire — non négociable.**
La documentation fait autorité seulement si elle suit le code :

- Toute décision qui retire, remplace ou contredit un contrat existant met à
  jour `PRODUCT.md` et/ou `ARCHITECTURE_DECISIONS.md` **dans le même commit**
  que le changement de code — jamais dans un commit ultérieur.
- Une fonctionnalité construite puis retirée doit laisser son retrait visible
  dans la documentation courante (pas seulement dans un journal).
- Toute migration créée doit refléter son état réel (appliquée / en attente)
  là où elle est décrite.
- Avant de conclure un chantier : relire les sections de `PRODUCT.md` et des
  ADR que le chantier touche, et corriger toute phrase devenue fausse.

Un écart entre la documentation et le code est un défaut, pas une tolérance :
le 21/08/2026, le journal décrivait une interface inexistante et PRODUCT.md
décrivait un système retiré la veille. Ne pas reproduire cela.

Toujours diagnostiquer la cause d'un défaut avant de conclure.
En cas d'incompréhension, la formuler et demander avant de valider une décision.
Vérifier les affirmations avec la même exigence, quelle que soit leur source.

Ne pas construire par anticipation.

Ne pas installer de dépendance sans confirmation.

Ne pas modifier silencieusement :
- `.env.local`
- `app/supabase/schema.sql`
- `app/data/00_instructions/`

Ne pas pousser directement un chantier non vérifié sur `master`.

---

## Commandes

Depuis la racine :

```bash
npm install --workspaces
npm run dev
npm run test
npm run build
