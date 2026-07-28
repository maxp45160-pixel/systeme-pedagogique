# CLAUDE.md — Système pédagogique

Contexte de travail pour Claude Code et Claude Chat sur ce dépôt.

## 0. Le fait qui commande tout

Le produit est une **boucle** :

> **génération d'exercices → évaluation de la compétence → ajustement des exercices**

Le 3ᵉ maillon **n'existe pas encore**. La boucle est arrêtée au premier : les 11 exercices de diagnostic ont tous été faits et **aucun exercice n'a jamais été créé** (`exercises` : 0 ligne). Tout le reste est secondaire.

---

## 1. Documents de référence — à lire avant toute proposition

| Document | Ce qu'il contient | Autorité |
|---|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Ce que le produit est, n'est pas, et les 8 principes — dont les 2 en défaut | **Fait autorité** |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | Registre ADR — décisions, hypothèses, questions ouvertes | **Fait autorité** |
| [`ROADMAP.md`](ROADMAP.md) | Ordre de travail et conditions de déclenchement | **Fait autorité** |

Statuts employés dans ces docs : ✅ décision tranchée · 🔬 hypothèse non vérifiée · ❓ question ouverte · 🗑️ idée abandonnée.

> **Une analyse convaincante n'est pas une décision.** Ne jamais promouvoir en ✅ une conclusion produite par une session Claude sans validation humaine explicite.

---

## 2. Vue d'ensemble

**Nom :** Système pédagogique — https://systeme-pedagogique-nine.vercel.app/

**Description :** suivi longitudinal des compétences académiques et
professionnelles d'un individu, avec parcours personnalisé. L'utilisateur
travaille, l'application enregistre des **preuves**, en **dérive** un niveau par
compétence, et **recommande** la prochaine action.

**Public cible :** étudiants curieux, personnes souhaitant apprendre par la
pratique et développer un sujet à long terme.

**Statut :** projet existant, déployé, en cours de recentrage sur la boucle.

---

## 3. Stack technique

- **Framework :** Next.js 16.2.11 (App Router), React 19.2.4, TypeScript strict
- **Backend :** pas de serveur Express — Server Components, Server Functions et
  3 route handlers (`/api/tutor`, `/api/dev-todos`, `/api/dev-todos/upload`)
- **Base de données :** **Supabase / PostgreSQL uniquement**, RLS par compte
  (ADR-015). La dorsale JSON locale a été supprimée le 28/07 : sans session
  valide, aucune lecture ni écriture n'est possible.
- **Authentification :** Supabase Auth — e-mail/mot de passe + SSO Google
- **IA :** moteur du tuteur **interchangeable** (`lib/tutor/moteurs/`, ADR-007) —
  `anthropic` via `@anthropic-ai/sdk` (payant) ou `compatible-openai` en `fetch`
  pur (paliers gratuits : Groq, OpenRouter, Mistral…). Streaming SSE dans les
  deux cas. Sans moteur configuré : 503 et repli « copier le contexte ».
- **Styles :** Tailwind CSS v4 ; **graphiques SVG écrits à la main**, aucune
  librairie UI tierce
- **Tests :** Vitest — **63 tests**, 4 fichiers (moteur, backend Supabase,
  parseurs de propositions, sélection du moteur du tuteur)
- **Déploiement :** Vercel (Root Directory = `app`)
- **Gestionnaire de paquets :** npm (workspace racine → `app/`)
- **Outillage :** serveur MCP Supabase (`.mcp.json`)

> ⚠️ Le middleware Next.js s'appelle ici **`proxy`** (`app/src/proxy.ts`) — pas `middleware.ts`.

---

## 4. Commandes utiles

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
Supabase Studio › SQL Editor. ⚠️ Il contient désormais des `DROP TABLE`
explicites (ADR-014) — les lire avant de le réexécuter.

**Variables d'environnement** (`app/.env.local`, voir `.env.example`) :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **désormais
obligatoires** —, puis, facultatives, le moteur du tuteur : `TUTEUR_MOTEUR`,
`TUTEUR_CLE`, `TUTEUR_URL_BASE`, `TUTEUR_MODELE` (palier gratuit) ou
`ANTHROPIC_API_KEY`. Sans aucun moteur, le tuteur répond 503 et l'interface
bascule sur « Copier le contexte » — comportement voulu, pas une panne.

---

## 5. Le principe qui gouverne tout

`app/data/00_instructions/` définit un protocole anti-hallucination lu par le tuteur et transcrit dans `lib/engine/` :

- **Rien de ce qui peut être dérivé n'est stocké.** Niveaux, scores et recommandations sont recalculés à chaque lecture.
- **Aucune valeur sans source.** Chaque nombre affiché porte un « Pourquoi ? ».
- **L'absence de mesure n'est pas un zéro.** Sans preuve : `—`, jamais `0/100`.
- **Une faiblesse ne disparaît pas sans démonstration.** Les preuves contradictoires réduisent la confiance, pas le niveau.
- **Le tuteur n'a aucun accès en écriture.** Il émet une proposition que l'utilisateur valide.

**Ne pas modifier un seuil du moteur sans modifier le protocole correspondant.** 63 tests vérifient ces garanties.

⚠️ Deux principes ne sont pas tenus : le score global compte les non-mesurées comme des zéros, et l'autonomie ignore l'aide externe. Écarts connus — voir `PRODUCT.md` §5 (ADR-006 et ADR-008).

---

## 6. Périmètre de travail

Le référentiel compte **43 compétences sur 7 domaines**, mais seul le domaine
**Logistique (LOG-01 → LOG-09)** est actif (ADR-018). C'est `SKILLS_ACTIFS`, et
non `SKILLS`, que consomment le moteur, l'interface et le contexte du tuteur.

Les 34 autres ne sont pas supprimées : elles sont hors périmètre. Élargir le
périmètre est **une décision**, pas un réglage — le faire sans contenu pour
l'alimenter ramènerait exactement le problème que le chantier du 28/07 corrige.

---

## 7. Contraintes et points d'attention

- 🔴 **L'état réel des données est dans Supabase, jamais ailleurs.** Pour toute question sur l'usage, interroger Supabase via le MCP (`.mcp.json`).
- **Sécurité.** RLS PostgreSQL est la seule barrière d'autorisation de confiance. Ne jamais mettre la clé `service_role` côté client.
- **RGPD.** La progression est une donnée personnelle. Toute feature de partage doit être opt-in et granulaire.
- **Compatibilité.** Navigateur en priorité, mobile en second temps.

---

## 8. Ce que Claude Code ne doit PAS faire

- **Ne pas toucher au cœur** (`lib/domain/`, `lib/engine/`, `lib/store/`) sans
  demande explicite. C'est ce qui porte la garantie du système.
- **Ne pas affaiblir un garde-fou** : typage strict, calcul dérivé, absence
  d'accès en écriture du tuteur. En particulier, `NiveauPreuve` conserve ses
  quatre valeurs A/B/C/D bien que C et D ne soient jamais écrites : le moteur
  existe pour les **rejeter** (`estRecevable`), les retirer du type le priverait
  de ce pouvoir.
- **Ne pas modifier** `.env.local`, `app/supabase/schema.sql` déjà appliqué,
  ni `app/data/00_instructions/` (protocoles vivants) **en silence, en marge
  d'une autre tâche**. Une modification de ces fichiers est légitime quand
  elle est l'objet explicite et déclaré de la session — dans ce cas elle se
  fait, et se consigne dans `00_SYSTEME_CHANGELOG.txt` dans le même geste
  (voir `00_PERENNISATION_DU_SYSTEME.txt` §6 et §12).
- **Ne pas installer de dépendance** sans confirmation — l'absence de librairie
  UI tierce est un choix.
- **Ne pas pousser directement sur `master`.**
- **Ne pas remettre le widget de TODOs dev dans le produit** (ADR-019). Il vit sur `/dev` (`components/dev/dev-todo.tsx`), hors du groupe `(app)`. La liste partagée entre comptes est volontaire — ne pas la « corriger » sans demande.
- **Ne pas construire par anticipation.** Un modèle de données sans besoin réel
  est de la complexité gratuite. C'est ce qui a produit les 6 entités mortes
  supprimées le 28/07.
- **Ne pas inventer de données.** Un écran non construit doit le dire.
- **Ne pas transformer une analyse en décision.** Une conclusion produite par
  une session Claude est 🔬 hypothèse ou ❓ question ouverte, jamais ✅ décision,
  tant qu'une personne ne l'a pas tranchée.

---

## 9. Grille d'évaluation de toute proposition

Vérifier les faits d'abord (Supabase pour l'usage, le dépôt pour le code). Puis répondre dans l'ordre :

1. **Quel problème réel ?** Observable, pas une impression.
2. **Quel besoin, distinct de la solution ?** Retirer la solution de la demande.
3. **Quels effets secondaires ?** Sur la surface produit, les données, les décisions futures.
4. **Compatible avec les 8 principes ?** Incompatibilité → modifier le principe explicitement, jamais le contourner.
5. **Quelle alternative ?** « Ne rien faire » est toujours recevable.
6. **Recommandation et argument décisif.** Un avis tranché, pas une liste équilibrée.

Ranger ensuite dans un statut du §1.

---

## 10. Workflow de travail préféré

- **Toujours proposer un plan avant de coder** pour tout chantier non trivial.
- **Trancher plutôt que deviner** : proposer une décision argumentée, la faire valider.
- **Une branche par fonctionnalité**, un merge dans `master` après validation.
- **`npm run verify` doit être vert avant tout merge.**
- Écrire les tests en même temps que le code **pour tout ce qui touche au moteur**.
- **Vercel refuse les déploiements dont l'auteur du commit n'est pas membre de l'équipe** (état `BLOCKED`). Vérifier `git log -1 --format="%an <%ae>"` avant de pousser.
