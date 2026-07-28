# CLAUDE.md — Système pédagogique

Contexte de travail pour Claude Code et Claude Chat sur ce dépôt.

## 0. Le fait qui commande tout

Le produit est une **boucle** :

> **génération d'exercices → évaluation de la compétence → ajustement des
> exercices**

Le 3ᵉ maillon **n'existe pas encore** dans le code. Les deux premiers existent,
mais la boucle est arrêtée au premier : les 11 exercices de diagnostic ont tous
été faits et **aucun exercice n'a jamais été créé** (`exercises` : 0 ligne).

Tout le reste est secondaire et se justifie devant cette boucle. Un chantier de
décomplexification l'a rétabli au centre le 28/07/2026 (ADR-013 à ADR-019).

---

## 1. Documents de référence — à lire avant toute proposition

| Document | Ce qu'il contient | Autorité |
|---|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Ce que le produit est, n'est pas, et les 8 principes — dont les 2 en défaut | **Fait autorité** |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | Registre ADR — décisions, hypothèses, questions ouvertes | **Fait autorité** |
| [`ROADMAP.md`](ROADMAP.md) | Ordre de travail et conditions de déclenchement | **Fait autorité** |
| [`archive/`](archive/) | Documents datés — analyses, audits, specs terminées | ⚠️ **Ne jamais y lire un chiffre d'usage** |

**Quatre statuts, au sens strict, employés dans tous ces documents :**
✅ décision tranchée par une personne · 🔬 hypothèse argumentée non vérifiée ·
❓ question ouverte · 🗑️ idée abandonnée avec sa raison.

> **Une analyse convaincante n'est pas une décision.** Ne jamais promouvoir en
> ✅ une conclusion produite par une session Claude sans validation humaine
> explicite.

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

> ⚠️ **Cette version de Next.js n'est pas celle de tes données d'entraînement.**
> APIs, conventions et structure de fichiers peuvent différer. Lire le guide
> concerné dans `app/node_modules/next/dist/docs/` avant d'écrire du code.
> Le middleware s'appelle désormais **`proxy`** (`app/src/proxy.ts`).

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

`app/data/00_instructions/` définit un protocole anti-hallucination, **lu tel
quel par le tuteur** et transcrit règle par règle dans `lib/engine/`. Il
s'applique à l'interface autant qu'au tuteur :

- **Rien de ce qui peut être dérivé n'est stocké.** Le disque ne contient que
  des faits observés (preuves, tentatives, séances). Niveaux, scores et
  recommandations sont recalculés à chaque lecture.
- **Aucune valeur sans source.** Chaque nombre affiché porte un « Pourquoi ? ».
- **L'absence de mesure n'est pas un zéro.** Sans preuve : `—`, jamais `0/100`.
- **Une faiblesse ne disparaît pas sans démonstration.** Les preuves
  contradictoires réduisent la confiance, pas le niveau.
- **Le tuteur n'a aucun accès en écriture.** Il émet une proposition structurée
  que l'utilisateur valide lui-même.

Chaque seuil du moteur cite le paragraphe du protocole qui l'impose, et 63 tests
vérifient ces garanties. **Ne pas modifier un seuil sans modifier le protocole
correspondant.**

⚠️ **Deux de ces principes ne sont pas tenus aujourd'hui** — le score global
agrégé compte les compétences non mesurées comme des zéros, et la mesure
d'autonomie ignore l'aide externe. Détail et démonstration dans
[`PRODUCT.md`](PRODUCT.md) §5. Ce sont des écarts **connus et documentés**, pas
des bugs à corriger sans arbitrage (ADR-006 et ADR-008).

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

- 🔴 **Où se trouve l'état réel des données : dans Supabase, jamais ailleurs.**
  Pour toute question sur l'usage — combien de preuves, quels exercices faits,
  quel score affiché — interroger Supabase (serveur MCP configuré dans
  `.mcp.json`). Les fichiers `app/data/store/*.json` ont été supprimés le 28/07 ;
  les documents d'`archive/` contiennent des chiffres périmés.
- **Sécurité.** RLS PostgreSQL est la **seule** barrière d'autorisation à
  laquelle le système accorde sa confiance ; les redirections du proxy ne sont
  qu'un confort d'affichage. Ne jamais mettre la clé `service_role` côté client.
- **RGPD.** Une progression de compétences est une donnée personnelle. Toute
  feature de partage doit être opt-in et granulaire.
- **Accessibilité.** Non auditée à ce jour.
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
- **Ne pas remettre le widget de TODOs dev dans le produit** (ADR-019). Il vit
  sur `/dev` (`components/dev/dev-todo.tsx`), hors du groupe `(app)`, et n'est
  lié depuis aucun écran. Le projet est développé à deux : la liste globale
  partagée entre comptes connectés est **volontaire**, c'est l'outil de
  coordination de l'équipe, et elle ne se discute pas au titre de l'expérience
  utilisateur. Ne pas non plus la « corriger » sans demande.
  *(❓ La politique RLS reste `FOR ALL TO authenticated USING (true)` : tout
  compte authentifié lit et modifie la liste, et la base compte 3 profils dont
  un sans activité pédagogique. Question ouverte en ADR-019.)*
- **Ne pas construire par anticipation.** Un modèle de données sans besoin réel
  est de la complexité gratuite. C'est ce qui a produit les 6 entités mortes
  supprimées le 28/07.
- **Ne pas inventer de données.** Un écran non construit doit le dire.
- **Ne pas transformer une analyse en décision.** Une conclusion produite par
  une session Claude est 🔬 hypothèse ou ❓ question ouverte, jamais ✅ décision,
  tant qu'une personne ne l'a pas tranchée.

---

## 9. Grille d'évaluation de toute proposition

*(absorbée de `FEATURE_EVALUATION_FRAMEWORK.md`, supprimé le 28/07)*

**Étape 0 — vérifier les faits avant de raisonner.** L'usage se lit dans
Supabase, le code dans le dépôt. Nommer explicitement ce qui n'a pas pu être
vérifié.

**Les six questions.** Toute proposition non triviale y répond, dans l'ordre :

1. **Quel problème réel résout-elle ?** Un problème réel est *observable*.
   « L'interface pourrait être plus claire » n'en est pas un ; « 31 compétences
   sur 43 n'ont aucun exercice » en est un. Si le problème ne peut être formulé
   qu'en termes de solution, il n'a pas encore été identifié.
2. **Quel est le besoin, distinct de la solution imaginée ?** Toute demande
   contient déjà une solution ; il faut la retirer. *Exemple réel :* demande
   « recherche d'exercices » → besoin réel *qu'il existe des exercices*. D'où
   ADR-004, et non une barre de recherche.
3. **Quels sont les effets secondaires ?** Sur la surface produit (chaque ajout
   renchérit tous les chantiers suivants), sur les données (une migration à
   venir, sans outil de migration — ADR-012), sur le comportement de
   l'utilisateur, sur les décisions qui deviennent plus difficiles ensuite.
4. **Est-ce compatible avec les 8 principes ?** Principe par principe. Une
   incompatibilité n'est pas rédhibitoire, mais impose de modifier le principe
   *explicitement*, jamais de le contourner en silence.
5. **Quelle est l'alternative ?** Au moins une, sérieusement construite. « Ne
   rien faire » est toujours recevable. Formes plus économiques : résoudre en
   amont, réutiliser un dispositif existant, rendre le problème visible et
   attendre qu'il se manifeste.
6. **Que recommande-t-on, et pourquoi ?** Un avis, avec l'argument décisif —
   celui qui, s'il tombait, ferait changer d'avis. Pas une liste équilibrée.

**Puis ranger la proposition dans un des quatre statuts du §1.**

---

## 10. Workflow de travail préféré

- **Vérifier les faits avant d'analyser** (§9, étape 0).
- **Toujours proposer un plan avant de coder** pour tout chantier non trivial.
- **Trancher plutôt que deviner** : quand une spec laisse un arbitrage ouvert,
  proposer une décision argumentée et la faire valider — ne pas trancher
  silencieusement en cours de route.
- **Une branche par fonctionnalité**, un merge dans `master` après validation.
- **`npm run verify` doit être vert avant tout merge.**
- Écrire les tests en même temps que le code **pour tout ce qui touche au
  moteur**.
- **Vercel refuse les déploiements dont l'auteur du commit n'est pas membre de
  l'équipe** (état `BLOCKED`, sans logs de build). Vérifier
  `git log -1 --format="%an <%ae>"` avant de pousser. Voir
  `SETUP_COMPTES_SUPABASE.md` §7.
