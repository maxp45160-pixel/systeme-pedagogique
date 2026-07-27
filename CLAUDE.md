# CLAUDE.md — Système pédagogique

Contexte de travail pour Claude Code et Claude Chat sur ce dépôt.

## Documents de référence — à lire avant toute proposition

| Document | Ce qu'il contient | Autorité |
|---|---|---|
| [`PRODUCT_VISION.md`](PRODUCT_VISION.md) | Ce que le produit est, n'est pas, et pour qui | **Fait autorité** |
| [`PRODUCT_PRINCIPLES.md`](PRODUCT_PRINCIPLES.md) | Les 8 principes et **où ils sont violés aujourd'hui** | **Fait autorité** |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | Registre ADR — décisions, hypothèses, questions ouvertes | **Fait autorité** |
| [`ROADMAP.md`](ROADMAP.md) | Ordre de travail et conditions de déclenchement | **Fait autorité** |
| [`FEATURE_EVALUATION_FRAMEWORK.md`](FEATURE_EVALUATION_FRAMEWORK.md) | Grille d'évaluation de toute proposition | **Fait autorité** |
| [`ETAT_DES_LIEUX_2026-07-27.md`](ETAT_DES_LIEUX_2026-07-27.md) | Analyse technique détaillée | Instantané daté — ⚠️ ses **chiffres d'usage** (§5, §8) proviennent du journal local figé et sont **faux**. L'analyse technique reste valable. |

**Quatre statuts, au sens strict, employés dans tous ces documents :**
✅ décision tranchée par une personne · 🔬 hypothèse argumentée non vérifiée ·
❓ question ouverte · 🗑️ idée abandonnée avec sa raison.

> **Une analyse convaincante n'est pas une décision.** Ne jamais promouvoir en
> ✅ une conclusion produite par une session Claude sans validation humaine
> explicite.

---

## 1. Vue d'ensemble

**Nom :** Système pédagogique — https://systeme-pedagogique-nine.vercel.app/

**Description :** suivi longitudinal des compétences académiques et
professionnelles d'un individu, avec parcours personnalisé. L'utilisateur
travaille, l'application enregistre des **preuves**, en **dérive** un niveau par
compétence, et **recommande** la prochaine action.

**Public cible :** étudiants curieux, personnes souhaitant apprendre par la
pratique et développer un sujet à long terme.

**Statut :** projet existant, déployé, avec des features à implémenter.

---

## 2. Stack technique

- **Framework :** Next.js 16.2.11 (App Router), React 19.2.4, TypeScript strict
- **Backend :** pas de serveur Express — Server Components, Server Functions et
  3 route handlers (`/api/tutor`, `/api/dev-todos`, `/api/dev-todos/upload`)
- **Base de données :** Supabase / PostgreSQL avec RLS par compte — *ou* fichiers
  JSON locaux (`app/data/store/`). Les deux dorsales sont **exclusives**
  (`lib/store/db.ts`), jamais synchronisées entre elles.
- **Authentification :** Supabase Auth — e-mail/mot de passe + SSO Google
- **IA :** `@anthropic-ai/sdk`, modèle `claude-opus-4-8`, streaming SSE.
  ⚠️ Payant — **ne peut plus être le chemin nominal** (contrainte de gratuité
  du 27/07, voir ADR-007).
- **Styles :** Tailwind CSS v4 ; **graphiques SVG écrits à la main**, aucune
  librairie UI tierce
- **Tests :** Vitest — **36 tests**, 3 fichiers (moteur, backend Supabase,
  parseur de propositions)
- **Déploiement :** Vercel (Root Directory = `app`)
- **Gestionnaire de paquets :** npm (workspace racine → `app/`)
- **Outillage :** serveur MCP Supabase (`.mcp.json`)

> ⚠️ **Cette version de Next.js n'est pas celle de tes données d'entraînement.**
> APIs, conventions et structure de fichiers peuvent différer. Lire le guide
> concerné dans `app/node_modules/next/dist/docs/` avant d'écrire du code.
> Le middleware s'appelle désormais **`proxy`** (`app/src/proxy.ts`).

---

## 3. Commandes utiles

Depuis la **racine** :

```bash
npm install --workspaces   # installer les dépendances
npm run dev                # développement — http://localhost:3000
npm run test               # vitest run
npm run build              # build de production
```

⚠️ **`verify` n'existe que dans `app/`**, pas à la racine :

```bash
cd app && npm run verify   # tsc --noEmit && eslint && vitest run
```

**Migrations base de données :** pas de CLI de migration. Le schéma est un
fichier SQL **idempotent** unique, `app/supabase/schema.sql`, à réexécuter dans
Supabase Studio › SQL Editor.

**Variables d'environnement** (`app/.env.local`, voir `.env.example`) :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY` (facultative — sans elle le tuteur répond 503 et l'interface
bascule sur « Copier le contexte »).

---

## 4. Le principe qui gouverne tout

`app/data/00_instructions/` définit un protocole anti-hallucination, **lu tel
quel par le tuteur** et transcrit règle par règle dans `lib/engine/`. Il
s'applique à l'interface autant qu'au tuteur :

- **Rien de ce qui peut être dérivé n'est stocké.** Le disque ne contient que
  des faits observés (preuves, tentatives, séances). Niveaux, scores, XP, badges
  et recommandations sont recalculés à chaque lecture.
- **Aucune valeur sans source.** Chaque nombre affiché porte un « Pourquoi ? ».
- **L'absence de mesure n'est pas un zéro.** Sans preuve : `—`, jamais `0/100`.
- **Une faiblesse ne disparaît pas sans démonstration.** Les preuves
  contradictoires réduisent la confiance, pas le niveau.
- **Le tuteur n'a aucun accès en écriture.** Il émet une proposition structurée
  que l'utilisateur valide lui-même.

Chaque seuil du moteur cite le paragraphe du protocole qui l'impose, et 36 tests
vérifient ces garanties. **Ne pas modifier un seuil sans modifier le protocole
correspondant.**

⚠️ **Deux de ces principes ne sont pas tenus aujourd'hui** — le score global
agrégé compte les compétences non mesurées comme des zéros, et la mesure
d'autonomie ignore l'aide externe. Détail et démonstration dans
[`PRODUCT_PRINCIPLES.md`](PRODUCT_PRINCIPLES.md) P2 et P8. Ce sont des écarts
**connus et documentés**, pas des bugs à corriger sans arbitrage.

---

## 5. Volontés de développement

👉 **Ordre de travail, statuts et conditions de déclenchement :
[`ROADMAP.md`](ROADMAP.md).**

Le fait qui commande tout aujourd'hui : **il reste 3 exercices** et
**0 exercice créé** ; 31 compétences sur 43 n'ont aucun support de travail.
Deux décisions ont été prises le 27/07 :

- ✅ **Le contenu pédagogique vient du tuteur**, par propositions validées par
  l'utilisateur (ADR-004) — pas de nouveaux fichiers seed écrits à la main.
- ✅ **Le tuteur est intégré à l'application, et son moteur est configurable**
  par variable d'environnement (ADR-007). Le moteur retenu au démarrage doit
  être gratuit ; « copier le contexte » devient le repli, plus le chemin
  nominal. Quel fournisseur gratuit exactement : décidé **par mesure**
  (test de réfutation en ADR-007), pas par arbitrage.

> ⚠️ **Vocabulaire.** « Dorsale » = le choix Supabase / JSON des données
> (ADR-002). « **Moteur du tuteur** » = le choix du fournisseur de modèle
> (ADR-007). Deux mécanismes sans rapport — ne pas confondre les termes.

Les 12 souhaits initiaux restent recensés, requalifiés et ordonnés dans
`ROADMAP.md`. Plusieurs sont plus petits que prévu (navigation et vues
radar/arbre déjà en place), un est urgent (le contenu), deux sont volontairement
reportés (généralisation, diagnostic initial) pour ne pas figer des modèles non
validés.

---

## 6. Contraintes et points d'attention

- 🔴 **Où se trouve l'état réel des données.** `app/data/store/*.json` est un
  **état figé au 25/07**, pas une sauvegarde de la production. Les deux dorsales
  sont exclusives et jamais synchronisées (ADR-002). Pour toute question sur
  l'usage réel — combien de preuves, quels exercices faits, quel score affiché —
  **interroger Supabase** (serveur MCP configuré dans `.mcp.json`), jamais lire
  ces fichiers. Une analyse produite le 27/07 à partir du journal local
  annonçait 11 preuves au 25/07 alors que la production en comptait 15 au 27/07 :
  ses conclusions étaient fausses.
- **Sécurité.** RLS PostgreSQL est la **seule** barrière d'autorisation à
  laquelle le système accorde sa confiance ; les redirections du proxy ne sont
  qu'un confort d'affichage. Ne jamais mettre la clé `service_role` côté client.
  En mode local, les Server Functions écrivent sur disque **sans
  authentification** : ne pas exposer l'app sur un réseau public sans Supabase.
- **RGPD.** Une progression de compétences est une donnée personnelle. Toute
  feature de partage doit être opt-in et granulaire.
- **Performance.** Voir l'état des lieux §7.1 — l'authentification est
  actuellement résolue une fois par collection lue.
- **Accessibilité.** Non auditée à ce jour.
- **Compatibilité.** Navigateur en priorité, mobile en second temps (une barre
  de navigation mobile existe déjà).

---

## 7. Ce que Claude Code ne doit PAS faire

- **Ne pas toucher au cœur** (`lib/domain/`, `lib/engine/`, `lib/store/`) sans
  demande explicite. C'est ce qui porte la garantie du système.
- **Ne pas affaiblir un garde-fou** : typage strict, calcul dérivé, absence
  d'accès en écriture du tuteur, `refuserSiDemo()` sur les Server Functions.
- **Ne pas modifier** `.env.local`, `app/supabase/schema.sql` déjà appliqué,
  ni `app/data/00_instructions/` (protocoles vivants).
- **Ne pas installer de dépendance** sans confirmation — l'absence de librairie
  UI tierce est un choix.
- **Ne pas pousser directement sur `master`.**
- **Ne pas « corriger » le widget de TODOs dev.** Le projet est développé à
  deux ; la liste globale partagée entre comptes connectés
  (`components/layout/dev-todo.tsx`, monté sans condition dans
  `app/(app)/layout.tsx`) est **volontaire** — c'est l'outil de coordination de
  l'équipe. À restreindre uniquement au moment de l'ouverture à des
  utilisateurs tiers, et à ce moment-là côté RLS autant que côté rendu.
  *(La base compte aujourd'hui 3 profils, dont un sans activité pédagogique :
  la condition de réexamen est peut-être atteinte — question ouverte en
  ADR-010, aucune action à prendre sans arbitrage.)*
- **Ne pas construire par anticipation.** Un modèle de données sans besoin réel
  est de la complexité gratuite.
- **Ne pas inventer de données.** Un écran non construit doit le dire.
- **Ne pas transformer une analyse en décision.** Une conclusion produite par
  une session Claude est 🔬 hypothèse ou ❓ question ouverte, jamais ✅ décision,
  tant qu'une personne ne l'a pas tranchée. Voir
  [`FEATURE_EVALUATION_FRAMEWORK.md`](FEATURE_EVALUATION_FRAMEWORK.md).
- **Ne pas analyser l'usage sans vérifier la source** (§6, premier point).

---

## 8. Workflow de travail préféré

- **Vérifier les faits avant d'analyser.** Étape 0 de
  [`FEATURE_EVALUATION_FRAMEWORK.md`](FEATURE_EVALUATION_FRAMEWORK.md) : l'usage
  se lit dans Supabase, le code dans le dépôt. Nommer explicitement ce qui n'a
  pas pu être vérifié.
- **Toujours proposer un plan avant de coder** pour tout chantier non trivial.
- **Trancher plutôt que deviner** : quand une spec laisse un arbitrage ouvert,
  proposer une décision argumentée et la faire valider — ne pas trancher
  silencieusement en cours de route.
- **Évaluer toute proposition avec la grille des six questions**
  (`FEATURE_EVALUATION_FRAMEWORK.md`), et la ranger dans un des quatre statuts.
- **Une branche par fonctionnalité**, un merge dans `master` après validation.
- **`npm run verify` doit être vert avant tout merge.**
- Écrire les tests en même temps que le code **pour tout ce qui touche au
  moteur**.
- **Vercel refuse les déploiements dont l'auteur du commit n'est pas membre de
  l'équipe** (état `BLOCKED`, sans logs de build). Vérifier
  `git log -1 --format="%an <%ae>"` avant de pousser. Voir
  `SETUP_COMPTES_SUPABASE.md` §7.
