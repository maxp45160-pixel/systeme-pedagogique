# Système pédagogique — état des lieux au 27/07/2026

> ## ⚠️ Correction apportée le 27/07/2026 — à lire avant le reste
>
> **Les chiffres d'usage de ce document sont faux.** Ils ont été relevés dans
> `app/data/store/*.json`, qui est un **état figé au 25/07** et non la base de
> production (ce document le signale lui-même en §4.2, puis l'oublie).
>
> | Ce document annonce | Réalité vérifiée en base le 27/07 |
> |---|---|
> | 6 preuves (§3) / 11 dans le journal | **15 preuves** sur le compte principal, 16 au total |
> | 8 compétences évaluées | **12 compétences** évaluées sur 43 |
> | — | **8 diagnostics terminés sur 11** ; il en reste **3** |
> | — | **0 exercice créé** ; 31 compétences sur 43 sans aucun support |
> | Usage interrompu après le 25/07 | **4 séances le 27/07** (07:46, 08:53, 10:16, 15:02) |
> | 20 tests (§2, §5) | **36 tests**, 3 fichiers |
> | `npm run verify` depuis la racine (§2) | N'existe que dans `app/` |
> | « Retirer les bientôt de la nav » (§8) | **Déjà fait** — section « Bientôt » séparée |
> | « Revoir l'emplacement du radar / arbre » (§7) | Radar et arbre **existent déjà**, sélecteur à 3 vues |
>
> **L'analyse technique reste valable** (§4, §7.1, §7.2, §7.3, §7.6, §7.7) —
> le chemin d'appel de l'authentification, le référentiel codé en dur et le
> diagnostic du tuteur ont été revérifiés dans le code et sont exacts. La clé
> `ANTHROPIC_API_KEY` est bien **commentée** dans `app/.env.local`.
>
> **Ce que ce document a manqué :** le corpus d'exercices est presque épuisé,
> et la boucle tuteur → exercice n'existe pas. Voir
> [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) ADR-004.
>
> **Ce document est désormais un instantané daté.** Les documents qui font
> autorité sont listés en tête de [`CLAUDE.md`](CLAUDE.md).

**À quoi sert ce document.** Donner à une session Claude Chat (ou à n'importe
qui découvrant le projet) une vue d'ensemble exacte : ce que fait
l'application, comment elle est construite, ce qui est réellement terminé, ce
qui ne l'est pas, où sont les fragilités, et quelles features valent le coup —
avec un avis argumenté, pas une liste neutre.

Tout ce qui suit a été vérifié dans le dépôt (`~/Desktop/Système pédagogique`,
branche `master`, dernier commit `82b4ecb`). Ce qui n'a pas pu être vérifié est
signalé comme tel.

---

## 1. Le projet en une page

**Nom :** Système pédagogique — https://systeme-pedagogique-nine.vercel.app/

**Ce que c'est.** Un centre de pilotage personnel du développement de
compétences. L'utilisateur travaille (exercices, scripts, échanges avec un
tuteur IA), l'application **enregistre des preuves** de ce travail, en **dérive**
un niveau par compétence, et **recommande** la prochaine action la plus utile.

**Ce qui le distingue d'un tracker classique.** Un principe unique gouverne
toute l'architecture :

> **Rien de ce qui peut être dérivé n'est stocké.**
> Le disque ne contient que des faits observés — preuves, tentatives, séances.
> Niveaux, scores, XP, badges, robustesse et recommandations sont **recalculés
> à chaque lecture**.

Trois conséquences, appliquées avec rigueur dans le code :

- **Aucune valeur sans source.** Chaque nombre affiché porte un « Pourquoi ? »
  qui liste les preuves dont il découle et les réserves associées.
- **L'absence de mesure n'est pas un zéro.** Sans preuve, le score global
  affiche `—`, jamais `0/100`.
- **Une faiblesse ne disparaît pas sans démonstration.** Les preuves
  contradictoires sont conservées et réduisent la *confiance*, pas le niveau.

**Le tuteur IA n'a aucun accès en écriture.** Ce n'est pas seulement documenté :
c'est imposé dans le prompt système (`lib/tutor/contexte.ts`) et il n'existe
aucun import de `lib/store/actions.ts` depuis `lib/tutor/`. Quand une
interaction constitue une preuve, le tuteur émet un bloc texte
`PROPOSITION DE MISE À JOUR` que l'utilisateur valide lui-même via un
formulaire.

**Public cible.** Aujourd'hui : un utilisateur (BUT QLIO → Master ITI). Demain
(objectif déclaré) : n'importe qui souhaitant un suivi longitudinal de
compétences avec un parcours personnalisé.

---

## 2. Stack technique réelle

Ta fiche disait « React / Node-Express / Supabase / OAuth / Vercel / npm ».
Le dépôt dit plus précisément :

| | Réel |
|---|---|
| Framework | **Next.js 16.2.11**, App Router, React 19.2.4, TypeScript strict |
| « Backend » | **Pas d'Express.** Server Components + Server Functions + 3 route handlers (`/api/tutor`, `/api/dev-todos`, `/api/dev-todos/upload`) |
| Base de données | **Supabase / PostgreSQL** avec RLS par compte — *ou* fichiers JSON locaux (voir §4) |
| Authentification | Supabase Auth : e-mail/mot de passe **+ SSO Google** (OAuth) |
| IA | `@anthropic-ai/sdk` 0.115, modèle `claude-opus-4-8`, streaming SSE |
| Styles | Tailwind CSS v4 (via `@tailwindcss/postcss`) |
| Graphiques | **SVG écrits à la main** (`components/charts/index.tsx`) — zéro dépendance |
| Tests | Vitest — 20 tests, uniquement sur le moteur et le backend Supabase |
| Déploiement | Vercel (Root Directory = `app`, workspace npm à la racine) |
| Outillage IA | Serveur MCP Supabase (`.mcp.json`), Claude Code |

**~14 500 lignes de TS/TSX**, aucune dépendance UI tierce (pas de shadcn, pas de
Radix, pas de recharts). C'est délibéré et c'est un point fort : rien à mettre à
jour, rien qui casse.

### Commandes utiles (la section vide de ta fiche)

```bash
npm install --workspaces        # depuis la racine
npm run dev                     # http://localhost:3000
npm run verify                  # tsc --noEmit && eslint && vitest run
npm run test                    # tests du moteur seuls
npm run build                   # build de production
```

Migrations base de données : **pas de CLI de migration.** Le schéma est un
fichier SQL idempotent unique — `app/supabase/schema.sql` — à réexécuter dans
Supabase Studio › SQL Editor. (C'est un point faible, voir §7.)

---

## 3. Arborescence commentée

```
Système pédagogique/
├── package.json                     workspace npm (racine → app/) — requis par Vercel
├── .mcp.json                        serveur MCP Supabase pour Claude Code
│
├── AUDIT_SYSTEME_2026-07-25.md      audit d'architecture (toujours pertinent)
├── SPEC_MAJ_PROFIL_..._FAIT.md      spec « intégrer la synthèse » — EXÉCUTÉE
├── SPEC_CHANTIER1_..._FAIT.md       spec « fermer la boucle de preuves » — EXÉCUTÉE
├── SETUP_COMPTES_SUPABASE.md        mise en route Supabase / SSO / Vercel
├── synthese_profil_competences_...  synthèse d'évaluation du 25/07
│
└── app/
    ├── data/
    │   ├── 00_instructions/         5 protocoles .txt — LUS TELS QUELS par le tuteur
    │   │                            (initialisation, instructions principales,
    │   │                             anti-hallucination, évaluation, changelog)
    │   └── store/                   journal JSON du mode local
    │       ├── evidence.json        6 preuves  (10 Ko)
    │       ├── attempts.json        tentatives (3 Ko)
    │       ├── sessions.json        séances    (4 Ko)
    │       └── dev-todos.json       todos dev  (3 Ko)
    │
    ├── supabase/schema.sql          schéma PostgreSQL + RLS (idempotent)
    │
    └── src/
        ├── proxy.ts                 ex-middleware : refresh du jeton + redirection /login
        │
        ├── lib/
        │   ├── domain/
        │   │   ├── types.ts         15 entités (486 l.)
        │   │   └── referentiel.ts   43 compétences codées en dur (524 l.)
        │   ├── engine/              ⭐ LE CŒUR — pur, testé, sans I/O
        │   │   ├── skill-state.ts   niveau, confiance, robustesse par compétence
        │   │   ├── progression.ts   état global
        │   │   ├── recommend.ts     choix de la prochaine action
        │   │   ├── xp.ts            XP + badges (projection des preuves)
        │   │   ├── historique.ts    dates.ts
        │   │   └── moteur.test.ts   20 tests citant les § des protocoles
        │   ├── store/
        │   │   ├── db.ts            2 dorsales exclusives (Supabase | JSON)
        │   │   ├── context.ts       chargerContexte() — point d'entrée unique
        │   │   ├── actions.ts       Server Functions (écriture)
        │   │   ├── supabase-backend.ts  mapping camelCase ↔ snake_case
        │   │   ├── migration.ts     import du journal local vers un compte
        │   │   └── export.ts        export du journal
        │   ├── tutor/
        │   │   ├── contexte.ts      construction du prompt système (protocoles + profil)
        │   │   └── proposition.ts   parseur des blocs PROPOSITION DE MISE À JOUR
        │   ├── seed/exercises.ts    10 exercices de diagnostic (771 l.)
        │   ├── demo/dataset.ts      jeu fictif, en mémoire uniquement
        │   └── supabase/            client / server / config / actions
        │
        ├── components/
        │   ├── ui/                  primitives, markdown, icônes, « Pourquoi ? »
        │   ├── layout/              sidebar, nav mobile, thème, compte, dev-todo (793 l.)
        │   ├── charts/              SVG maison (362 l.)
        │   ├── dashboard/           état global, prochaine action, objectifs, activité
        │   ├── competences/         formulaire-preuve.tsx (preuve manuelle)
        │   ├── exercices/           formulaire-bilan, formulaire-creation
        │   └── tuteur/chat.tsx      chat SSE + boutons « Revoir et enregistrer »
        │
        └── app/
            ├── (app)/              routes protégées
            │   ├── page.tsx                tableau de bord
            │   ├── exercices/ + [id]/      liste + exécution d'un exercice
            │   ├── tuteur/                 chat IA
            │   ├── progression/            courbes
            │   ├── competences/ + [code]/  matrice + fiche compétence
            │   ├── erreurs/                erreurs récurrentes
            │   ├── journal/                journal de bord
            │   └── projets|lectures|connaissances/   ⚠️ écrans « à venir »
            ├── login/ + auth/callback/
            └── api/tutor | api/dev-todos
```

---

## 4. Le point d'architecture le plus important : deux dorsales exclusives

`lib/store/db.ts` choisit **à chaque requête** :

| | **Local** (pas de clés Supabase) | **Comptes** (Supabase configuré) |
|---|---|---|
| Données | `data/store/*.json`, versionné git | PostgreSQL, isolé par compte via RLS |
| Accès | aucune authentification | e-mail/mdp ou SSO Google |
| Usage | poste personnel, `localhost` | Vercel |

Le choix est **exclusif** : jamais de double écriture, jamais de synchronisation.
C'est le bon arbitrage (une double écriture divergerait à la première panne
réseau, et le disque Vercel est éphémère). Mais deux conséquences à garder en
tête :

1. **En mode local, les Server Functions écrivent sur disque sans aucune
   authentification.** Acceptable sur `localhost`, dangereux dès qu'on expose
   le port.
2. **`data/store/*.json` est aujourd'hui un état figé**, pas une sauvegarde de
   la base de production. Ne pas le lire comme « l'état réel ».

---

## 5. Ce qui est réellement fait ✅

Vérifié dans le code, pas dans les specs :

- **Moteur de dérivation complet et testé.** 20 tests qui citent littéralement
  les paragraphes des protocoles (§4, §7, §9, §11, §12, §13, §16). Les seuils ne
  sont pas arbitraires : chacun cite la règle qui l'impose.
- **43 compétences** réparties en domaines, avec importance pondérée par
  l'objectif déclaré.
- **10 exercices de diagnostic** jouables de bout en bout, avec déduction
  automatique de l'autonomie à partir du nombre d'indices consultés.
- **Boucle de preuves fermée** (chantier 1 — commit `7395885`) :
  - formulaire de **preuve manuelle** sur chaque fiche compétence ;
  - **parseur des propositions du tuteur** + bouton « Revoir et enregistrer »
    qui pré-remplit le formulaire (sans jamais écrire automatiquement) ;
  - **création manuelle d'exercice**.
- **Comptes Supabase** : inscription, connexion, SSO Google, RLS par compte,
  trigger de création de profil, import du journal local, export du journal.
- **Mode démonstration** en mémoire, sous bandeau permanent, qui ne touche
  jamais les données réelles.
- **UI** : thème clair/sombre, navigation desktop + barre mobile, graphiques SVG
  maison, composant « Pourquoi ? » sur chaque valeur dérivée.
- **Widget de TODOs dev** partagé, avec upload d'images (793 lignes).
- **Déploiement Vercel fonctionnel.**

**Les specs `SPEC_MAJ_PROFIL` et `SPEC_CHANTIER1` sont toutes deux exécutées.**
`FEATURES.md` en est un doublon octet-pour-octet et n'a plus de contenu vivant.

---

## 6. Ce qui n'est pas fait ❌

- **Projets / Lectures / Connaissances** : modèles de données présents dans
  `types.ts`, entrées de navigation présentes, mais les écrans annoncent
  franchement qu'ils n'existent pas. *C'est ce que tu appelles « les bientôt ».*
- **Diagnostic initial personnalisé** : il existe un ordre de diagnostic
  (`ORDRE_DIAGNOSTIC`) et 10 exercices de diagnostic, mais **aucun flux
  d'onboarding**. Un nouveau
  compte arrive sur une application vide, avec un référentiel QLIO qui n'est pas
  le sien.
- **Généralisation du profil** : le référentiel des 43 compétences est **codé en
  dur** et centré BUT QLIO → Master ITI. `recommend.ts` dit littéralement
  *« elle est centrale pour ton objectif Master ITI »*. Un profil neutre existe
  pour les nouveaux comptes (`profilNeutre()`), mais il ne change ni le
  référentiel ni les recommandations.
- **Google Calendar** : rien. Pas de modèle, pas de route, pas de dépendance.
- **Système d'amis** : rien. Le schéma RLS est strictement « chacun ses lignes »,
  aucune notion de visibilité partagée.
- **Recherche d'exercices** : rien (mais avec ~10 exercices, ce n'est pas encore
  un besoin).
- **Édition du profil utilisateur** depuis l'interface : la table `profiles`
  porte `formation`, `objectifMoyenTerme`, `objectifLongTerme`,
  `preferencesPedagogiques`… mais rien dans l'UI ne permet de les renseigner.

---

## 7. Points faibles — diagnostic technique

Classés par gravité réelle, avec le fichier et la ligne quand c'est pertinent.

### 7.1 🔴 Performance — la cause racine est identifiée

C'est ton point n°1, et ce n'est pas un problème de « rendu » : c'est un
problème de **round-trips réseau redondants**.

Le chemin exact :

1. `proxy.ts` appelle `supabase.auth.getUser()` → **1 aller-retour réseau** vers
   Supabase Auth, sur chaque requête non-statique.
2. Chaque page appelle `chargerContexte()` → `lireTout()` (`store/db.ts:332`).
3. `lireTout()` appelle **`lire()` 10 fois** (user, evidence, exercises,
   attempts, errors, projects, readings, knowledge, sessions, objectives).
4. **Chaque `lire()`** appelle `dorsaleCompte()` → `compteCourant()` →
   `createServeurClient()` **+ `auth.getUser()`** (`supabase/server.ts:47`).

Soit **11 appels `getUser()` par chargement de page**, plus 10 requêtes SQL —
dont 3 sur des tables qu'on sait vides (`projects`, `readings`, `knowledge`).
Les 10 partent en `Promise.all`, donc le temps de mur reste borné, mais on paie
la latence réseau la plus lente de 10 appels concurrents, on consomme du quota,
et on est très exposé au cold start.

**Aggravant :** aucun cache nulle part. `grep` sur `cache(`, `unstable_cache`,
`revalidate`, `export const dynamic` → **zéro résultat**. Chaque page est
entièrement dynamique (elle lit les cookies), recalcule les 43 états de
compétence, l'état global, les XP, les badges et les recommandations à chaque
affichage.

**Aggravant 2 :** les Server Functions appellent `revalidatePath("/", "layout")`,
ce qui invalide tout le layout après la moindre écriture.

**Les correctifs, par rapport effort/gain :**

| Correctif | Effort | Gain attendu |
|---|---|---|
| Envelopper `compteCourant` et `createServeurClient` dans le `cache()` de React (déduplication par requête) | **~10 lignes** | 11 appels `getUser()` → **1** |
| Remplacer les 10 `lire()` par une seule résolution de dorsale + 10 requêtes | ~30 lignes | −10 résolutions redondantes |
| Ne pas lire `projects`/`readings`/`knowledge` tant qu'elles ne servent à rien | ~5 lignes | −3 requêtes SQL |
| Index PostgreSQL sur `(user_id)` de chaque table | SQL | dépend du volume (faible aujourd'hui) |
| `<Suspense>` autour des blocs lourds (progression, graphiques) | moyen | perception, pas latence réelle |

👉 **Le premier correctif seul devrait faire l'essentiel du travail.** Fais-le
avant tout redesign : c'est dix lignes et c'est mesurable.

### 7.2 🔴 Le référentiel est codé en dur — le vrai blocage de la généralisation

`referentiel.ts` (524 lignes) est un tableau TypeScript. Ajouter une compétence
= modifier du code + repasser les tests. C'était un **bon** arbitrage tant que
l'app avait un utilisateur : le typage garantit la cohérence, et l'extension
39→43 s'est bien passée.

Ça devient un **mur** dès que tu veux que chaque profil se spécialise :
un étudiant en droit ne peut pas avoir `LOG-02 — Dimensionnement de stock`.

Trois options, franchement :

- **A. Référentiels prédéfinis multiples** (QLIO, informatique, droit…), chacun
  toujours en TypeScript, l'utilisateur en choisit un à l'inscription.
  *Effort moyen, garanties conservées, mais tu écris chaque référentiel à la
  main.*
- **B. Référentiel en base**, éditable par l'utilisateur.
  *Effort élevé, tu perds le typage statique et les tests qui citent les
  compétences par code. Le moteur devient générique — c'est faisable mais c'est
  un vrai chantier.*
- **C. Référentiel de base commun + extensions par compte.** Un socle de
  compétences transverses (raisonnement, méthode, communication technique,
  outillage) valable pour tous, plus des compétences ajoutées par l'utilisateur
  ou proposées par le tuteur lors du diagnostic initial.

👉 **Mon avis : C.** C'est la seule option qui rend le diagnostic initial
(ta feature n°5) réellement utile, et elle est cohérente avec le protocole : une
compétence ajoutée par le tuteur reste une *proposition* que l'utilisateur
valide. A est un pansement, B jette la garantie qui fait la valeur du système.

### 7.3 🟠 IA Tutor — le code est correct, c'est la configuration qui bloque

J'ai vérifié `app/api/tutor/route.ts` ligne par ligne contre la référence API
Anthropic actuelle :

- ✅ modèle `claude-opus-4-8` — valide ;
- ✅ `thinking: { type: "adaptive" }` — la forme correcte sur 4.8
  (`budget_tokens` y renverrait un 400) ;
- ✅ `output_config: { effort: "high" }` — bien placé dans `output_config` ;
- ✅ streaming avec `finalMessage()` ;
- ✅ `cache_control` sur le préfixe stable (protocoles), profil variable après ;
- ✅ gestion d'erreurs typée (`AuthenticationError`, `NotFoundError`,
  `RateLimitError`…) et gestion de `stop_reason: "refusal"`.

**Ce code est bon.** Si « l'IA Tutor ne marche pas », les causes probables, par
ordre :

1. **`ANTHROPIC_API_KEY` absente.** Elle n'est pas dans ton `.env.local`
   (qui ne contient que les deux clés Supabase). En local, la route répond
   **503** et l'UI bascule sur « Copier le contexte » — comportement voulu, mais
   qui ressemble exactement à « ça ne marche pas ». Sur Vercel, à vérifier dans
   Settings › Environment Variables.
2. **Timeout de fonction Vercel.** `max_tokens: 16000` + `effort: "high"` +
   thinking adaptatif : une réponse peut dépasser la durée maximale par défaut.
   Le streaming SSE aide, mais la fonction peut être coupée en cours. À
   confirmer dans les logs Vercel — je n'ai pas pu les consulter.
3. **Accès au modèle.** Le compte API doit avoir accès à `claude-opus-4-8`
   (sinon `NotFoundError`, correctement remonté par le code).

👉 **Avant de toucher au code du tuteur, vérifie la clé et les logs Vercel.**
C'est probablement une ligne de configuration, pas un bug.

### 7.4 🟡 Le widget de TODOs dev est visible par tout compte connecté

`components/layout/dev-todo.tsx` (793 lignes, le plus gros fichier du projet)
est monté **sans condition** dans `app/(app)/layout.tsx:72`. Sa liste est
**globale** : la politique RLS l'ouvre à tout compte `authenticated`.

**C'est intentionnel** : le projet est développé à deux, et la liste partagée
est l'outil de coordination de l'équipe. Ce n'est donc pas un défaut, et il n'y
a rien à corriger tant que les seuls comptes existants sont ceux des deux
développeurs.

👉 **Mais c'est une bombe à retardement au moment de l'ouverture aux
utilisateurs** (features n°3 et n°5) : le jour où un tiers s'inscrit, il voit et
modifie votre liste de tâches de développement. Deux façons de le désamorcer, à
faire **avant** l'ouverture, pas maintenant :

- **une liste d'e-mails autorisés** (`DEV_TODO_ALLOWLIST` en variable
  d'environnement), côté rendu *et* côté politique RLS — c'est l'option qui
  préserve l'usage actuel : vous gardez la liste partagée en production ;
- `process.env.NODE_ENV === "development"` — plus simple, mais vous perdez
  l'accès depuis le déploiement Vercel.

Dans les deux cas, la garde doit être **côté RLS aussi**, pas seulement côté
rendu : masquer le widget ne ferme pas l'API `/api/dev-todos`.

Reste vrai indépendamment de l'accès : c'est du mobilier permanent dans l'UI,
donc à prendre en compte dans le chantier n°2 (« réduire le nombre de
boutons »).

### 7.5 🟡 Dette documentaire et sources dupliquées

> ✅ **Traité le 27/07/2026** pour les trois premiers points (ménage du dépôt) :
> `FEATURES.md` et `data/01_profil/*.txt` supprimés, specs exécutées renommées
> `_FAIT`. Le constat ci-dessous est conservé pour mémoire du raisonnement.

- `FEATURES.md` = copie exacte de `SPEC_CHANTIER1` (19 408 octets tous les deux),
  et la spec est **déjà exécutée**. Un fichier nommé `FEATURES.md` qui décrit du
  travail terminé va induire en erreur toute future session.
- `data/01_profil/*.txt` (5 fichiers) : legacy, lus par aucun code, **et déjà
  faux** (l'audit du 25/07 documente `LOG-02` affiché « À évaluer » alors qu'une
  preuve directe existe dans le store). Ce n'est pas un problème d'exécution,
  c'est un problème de conception : rien ne garantit qu'ils soient maintenus.
- `data/00_instructions/*.txt` en revanche sont **vivants** : le tuteur les lit
  tels quels. À ne pas confondre.
- L'audit signalait aussi une copie des protocoles en v1.0 dans la connaissance
  importée Claude.ai alors que le dépôt est en v2.0. **C'est directement ton
  cas d'usage ici** : si tu alimentes un projet Claude Chat, resynchronise cette
  copie ou ne l'utilise que comme secours.

### 7.6 🟡 Pas d'outillage de migration de schéma

Un seul `schema.sql` idempotent, appliqué à la main dans Supabase Studio. Ça
tient tant que tu es seul. Dès qu'il y aura une modification de colonne sur des
données existantes, tu n'auras aucun historique de ce qui a été appliqué où.
Le CLI Supabase (`supabase db push` + `supabase/migrations/`) résout ça, et tu
as déjà le serveur MCP Supabase configuré.

### 7.7 🟡 Couverture de tests asymétrique

20 tests, tous sur `lib/engine/` et `lib/store/supabase-backend.ts`. **Zéro test**
sur les composants, les Server Functions, les route handlers, le proxy. Le cœur
est protégé — c'est le bon choix si on ne teste qu'une chose — mais toute la
couche qui a bougé récemment (comptes, RLS, upload, todos) n'a aucun filet.

### 7.8 🟢 Points à surveiller sans agir maintenant

- **Gamification** (~500 lignes : XP, badges, paliers). Bien conçue et
  non-farmable, mais c'est la partie la plus éloignée de l'objectif central.
  Premier candidat si le système doit un jour perdre du poids.
- **Dépendance à une API externe payante** pour le tuteur. Le repli « copier le
  contexte » est un bon garde-fou.
- **Accessibilité** : non auditée. Contrastes, navigation clavier, `aria-*` — je
  n'ai pas vérifié.

---

## 8. Tes 12 features, relues et priorisées

Reprise de ta liste, avec ce que j'en pense après lecture du code.

| # | Ta feature | Verdict | Effort | Note |
|---|---|---|---|---|
| 1 | Rapidité de chargement | **Faire en premier** | **XS** | Cause racine identifiée (§7.1). `cache()` sur `compteCourant` = ~10 lignes. |
| 4 | Faire marcher l'IA Tutor | **Faire en premier** | **XS** | Probablement une variable d'environnement (§7.3). À diagnostiquer avant de coder. |
| 6 | Implémenter tous les « bientôt » | **Ne pas faire (pour l'instant)** | XL | Voir ci-dessous. |
| 2 | Réduire boutons / filtres / doublons | À faire | S–M | Retirer les « bientôt » de la nav. Le widget dev reste (§7.4). |
| 10 | Flèche ouvrir/fermer sections compétences | À faire | XS | Un `<Depliant>` existe déjà dans `ui/explication.tsx`. |
| 7 | Revoir l'emplacement du radar / arbre | À faire | M | Lié à 2 et 9 — traiter comme un seul chantier UI. |
| 9 | Polish général UI/UX | À faire | M | Idem. |
| 5 | Diagnostic initial | **Le vrai gros sujet** | L | Bloqué par le référentiel codé en dur (§7.2). |
| 3 | Généraliser / spécialiser les profils | **Le vrai gros sujet** | XL | Même blocage. 3 et 5 sont **le même chantier**. |
| 8 | Google Calendar | Plus tard | L | Voir ci-dessous. |
| 11 | Système d'amis | Plus tard | L | Voir ci-dessous. |
| 12 | Recherche d'exercices | Plus tard | S | ~10 exercices. Attends d'en avoir 50. |

### Là où je ne suis pas d'accord avec ta liste

**Sur le n°6 (« implémenter tous les bientôt »).** Projets, Lectures et
Connaissances sont de la *surface spéculative* : trois modèles de données, trois
routes, trois entrées de nav, écrits avant qu'un besoin existe. Les construire
maintenant, c'est tripler la surface de l'app pour des écrans que personne n'a
demandés — et ça alourdit mécaniquement tous les autres chantiers (nav, perf,
généralisation). L'application est **honnête** aujourd'hui : elle dit qu'ils
n'existent pas. C'est mieux qu'une maquette remplie de données inventées.

👉 **Ma proposition : ne construis un de ces trois écrans que le jour où tu as
un projet réel ou une lecture en cours à y mettre.** En attendant, retire-les de
la navigation principale (ils occupent de la place et concurrencent les entrées
actives — c'est exactement ton point n°2). C'est *l'inverse* de « implémenter
tous les bientôt », et je pense que c'est le bon choix.

**Sur le n°8 (Google Calendar).** L'idée est bonne — la répétition espacée est
au cœur d'un système d'apprentissage — mais le coût est mal placé : OAuth
Google supplémentaire, gestion de jetons, synchronisation bidirectionnelle,
gestion des suppressions côté Calendar. **Or tu as déjà tout ce qu'il faut pour
la valeur pédagogique** : `engine/dates.ts` et `historique.ts` savent calculer
l'ancienneté, et le moteur dégrade déjà la confiance avec le temps.

👉 **Fais d'abord la relance *dans* l'app** — « ces 3 compétences n'ont pas été
démontrées depuis 40 jours, voici l'exercice à refaire ». Si tu constates que tu
l'ignores parce que tu n'ouvres pas l'app, alors Calendar devient justifié. À ce
moment-là, une simple **export `.ics`** (un fichier, zéro OAuth) couvre
probablement 80 % du besoin.

**Sur le n°11 (amis).** C'est la feature qui change le plus la nature du projet.
Techniquement, elle casse frontalement le modèle RLS actuel (« un compte ne voit
que ses lignes ») : il faut une table de relations, des politiques de partage
granulaires, et une réflexion RGPD réelle — la progression de compétences est
une donnée personnelle sensible. Mais surtout : **la comparaison sociale entre
en tension directe avec le principe fondateur du système**, qui dit que le but
est de maximiser ta capacité à résoudre des problèmes nouveaux, pas d'accumuler
des badges.

👉 Si tu la fais, fais-la **explicitement encadrée** : partage opt-in, par
compétence, et jamais de classement. Et fais-la *après* la généralisation —
comparer des progressions n'a de sens que si les profils partagent un
référentiel.

### Ce que ta liste ne mentionne pas et qui manque

- **Édition du profil utilisateur.** Les colonnes existent en base
  (`formation`, `objectifMoyenTerme`, `objectifLongTerme`,
  `preferencesPedagogiques`), rien dans l'UI ne les remplit. C'est un
  pré-requis évident du diagnostic initial, et c'est petit.
- **Écran vide utile.** L'app est vide au premier lancement — c'est correct et
  assumé — mais rien n'oriente. La seule sortie est le mode démonstration. Un
  vrai onboarding, c'est ta feature n°5 sous un autre nom.
- **Sécuriser le mode local.** Une bannière ou un refus d'écriture si l'app est
  servie sur autre chose que `localhost`.
- **Nettoyage documentaire** (§7.5) — quinze minutes, et ça évite qu'une future
  session parte sur `FEATURES.md`.

---

## 9. Ordre de travail que je recommande

**Sprint 0 — une soirée, débloque tout le reste**
1. `cache()` sur `compteCourant` / `createServeurClient` → mesurer avant/après.
2. Diagnostiquer le tuteur : clé présente ? logs Vercel ? Corriger la cause
   réelle.
3. ✅ ~~Supprimer `FEATURES.md`, marquer `01_profil/*.txt` en archive, renommer
   les specs exécutées en `_FAIT`.~~ — fait le 27/07/2026 (`01_profil/*.txt`
   supprimé plutôt qu'archivé : arbitrage de l'utilisateur, le référentiel de
   code est désormais la seule source de vérité des compétences).

*(Le widget dev-todo reste tel quel : liste partagée volontaire entre les deux
développeurs. À restreindre au moment de l'ouverture aux utilisateurs — §7.4.)*

**Sprint 1 — UI/UX (tes n°2, 7, 9, 10)**
Traiter comme un seul chantier cohérent : retirer les « bientôt » de la nav
principale, dédupliquer les filtres, repositionner radar et arbre, ajouter les
dépliants. Ne pas y toucher avant le sprint 0 — l'app paraîtra deux fois
meilleure une fois qu'elle sera rapide.

**Sprint 2 — le chantier de fond : généralisation + diagnostic (n°3 + n°5)**
C'est **un seul projet**, et c'est celui qui décide de ce qu'est l'application.
Il mérite sa propre spec, écrite avant de coder, avec un arbitrage explicite
entre les options A/B/C du §7.2. Étapes probables :
1. formulaire d'édition du profil ;
2. socle de compétences transverses ;
3. flux de diagnostic initial qui produit des preuves réelles ;
4. compétences supplémentaires proposées par le tuteur, validées par
   l'utilisateur.

**Plus tard, dans cet ordre** : relance interne → export `.ics` → recherche
d'exercices → amis → écrans « bientôt » quand le besoin existe.

---

## 10. Verdict

**L'architecture cœur est saine et ne devrait pas être touchée** — c'est déjà
la conclusion de l'audit du 25/07 et elle tient toujours. La séparation
observé/dérivé, le moteur pur testé contre les protocoles, le garde-fou en
écriture du tuteur, l'honnêteté des écrans non construits : c'est rare et c'est
ce qui fait la valeur du projet. Toute proposition de « simplification » qui
toucherait au typage strict, au calcul dérivé ou au garde-fou du tuteur irait
dans le mauvais sens.

Les problèmes sont **tous en périphérie**, et deux d'entre eux sont beaucoup
plus petits que ce que leur symptôme laisse croire : la lenteur est une
déduplication d'appels d'authentification, et le tuteur est probablement une
variable d'environnement.

Le seul vrai grand chantier est la **généralisation du profil**. Il est
structurel, il conditionne la moitié de ta liste, et il mérite d'être conçu
avant d'être codé.

---

### Réserves — ce que je n'ai pas pu vérifier

- `npm run verify` n'a pas été exécuté : je n'ai pas confirmé que les 20 tests
  passent en l'état.
- Les logs et la configuration Vercel (variables d'environnement, durée maximale
  des fonctions) n'ont pas été consultés — le diagnostic du tuteur (§7.3) est
  donc une hypothèse argumentée, pas une certitude.
- Aucune mesure de performance réelle (Lighthouse, temps de réponse serveur) :
  l'analyse du §7.1 vient de la lecture du chemin d'appel, pas d'un profilage.
- L'état réel de la base Supabase de production n'a pas été inspecté.
- Accessibilité et rendu mobile non audités.
