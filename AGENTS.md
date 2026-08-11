# AGENTS.md — Système pédagogique

## Projet

Application de suivi longitudinal des compétences.

Boucle centrale :

génération d'exercices → évaluation → adaptation

Lire `PRODUCT.md` avant toute décision produit.
Lire `ARCHITECTURE_DECISIONS.md` avant toute modification architecturale.

Ne jamais transformer une analyse Codex en décision validée.

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
- Ne pas créer de nouvelle entité pour remplacer `LearningSession`.
- Toute clé de stockage navigateur doit être isolée par compte.
- La logique métier non triviale doit vivre dans `lib/`, pas dans un composant.
- `outilCorrection` reste confiné au chemin de correction prévu.

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
