# CLAUDE.md — Système pédagogique

Contexte de travail pour Claude Code et Claude Chat sur ce dépôt.

## 0. Le fait qui commande tout

Le produit est une **boucle** :

> **génération d'exercices → évaluation de la compétence → ajustement des exercices**

Le 1ᵉʳ maillon s'est ouvert le 31/07/2026 : les exercices en base portent tous
`origine = 'tuteur'`. Le 2ᵉ tourne (20 tentatives terminées).

Le **3ᵉ maillon a été posé le 31/07/2026** (ADR-028). `lib/engine/calibration.ts`
dérive des tentatives réelles une **difficulté conseillée** et une **dimension
faible**, sans rien stocker ; le tuteur les reçoit dans son contexte et le
gabarit d'exercice ne lui laisse plus la difficulté à l'appréciation.

**La boucle a tourné en entier le 01/08/2026** (ADR-030). Sur DEV-01 et DEV-03,
la difficulté produite par le tuteur a suivi exactement celle que la calibration
conseillait : le 3ᵉ maillon est démontré, pas seulement câblé.

⚠️ Ce premier tour a aussi exhibé un défaut que 194 tests ne pouvaient pas
voir — aucun exercice généré n'avait jamais été clos : `terminerExercice`
écrivait une preuve à dimensions nulles sur une tentative abandonnée en
1 minute, alors que `calibration.ts` refusait d'en rien conclure. Corrigé
(ADR-030) : `tentativeMenee` est désormais appelée par **les deux** chemins.

🔬 Reste non mesuré : « la dimension faible recule ». Les deux tentatives du
01/08 ont été abandonnées trop tôt pour le dire.

**Le 02/08/2026, la boucle a buté sur son inventaire, pas sur son algorithme.**
Six irritants d'immersion remontés à l'usage ont été traités (ADR-034 à 036).
Le fait qui les explique presque tous : **40 des 54 compétences actives n'ont
aucun exercice** — 27 exercices en tout, 6 en base et 21 diagnostics livrés.
« Refaire toujours les mêmes exos ratés » n'était pas un défaut de
recommandation : le moteur n'avait rien d'autre à servir.

⚠️ Ce tour a aussi exhibé un défaut d'un genre nouveau. `exercises.difficulte`
était déclarée `TEXT` : `calibration.ts` faisait `"1" + 0` = `"10"`, borné à 5,
et DEV-03/DEV-04 conseillaient une difficulté 5 sur la foi d'un partiel obtenu à
difficulté 1 — valeur qui partait aussi dans le contexte du tuteur. **Aucun des
239 tests ne pouvait le voir** : ils passent tous des `Difficulte` déjà typées,
jamais une valeur venue de la dorsale. Le moteur est pur et testé ; ce qu'on lui
donne à manger ne l'était pas. Corrigé (ADR-034), colonne en `INTEGER`.

---

## 1. Documents de référence — à lire avant toute proposition

| Document | Ce qu'il contient | Autorité |
|---|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Ce que le produit est, n'est pas, et les 8 principes | **Fait autorité** |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | Registre ADR — décisions, hypothèses, questions ouvertes | **Fait autorité** |

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
- **Authentification :** Supabase Auth — e-mail/mot de passe + SSO Google.
  Le jeton est vérifié **localement** (`getClaims`, signature ES256 par
  WebCrypto), jamais par un appel au serveur d'auth sur le chemin chaud
  (ADR-022). Un chemin sensible à une révocation immédiate devrait rappeler
  `getUser()` explicitement.
- **IA :** moteur du tuteur **interchangeable** (`lib/tutor/moteurs/`, ADR-007) —
  `anthropic` via `@anthropic-ai/sdk` (payant) ou `compatible-openai` en `fetch`
  pur (paliers gratuits : Groq, OpenRouter, Mistral…). Streaming SSE dans les
  deux cas. Sans moteur configuré : 503 et repli « copier le contexte ».
- **Styles :** Tailwind CSS v4 ; **graphiques SVG écrits à la main**, aucune
  librairie UI tierce
- **Tests :** Vitest — **422 tests**, 20 fichiers (moteur, répétition espacée,
  calibration, backend Supabase, référentiel par compte, cycle de vie des
  exercices, profil, parseurs de propositions, outils du tuteur, contexte du
  tuteur, amorces du tuteur, sélection du moteur du tuteur, génération sans
  conversation, suggestion de branche, conversion d'exercice, conversion de
  correction, prompt de correction, règle de la réponse écrite, découpage
  markdown, formules)
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
Supabase Studio › SQL Editor. ⚠️ Il contient des `DROP TABLE` explicites
(ADR-014) — les lire avant de le réexécuter.

✅ **`supabase/migration-exercices.sql` a été appliqué le 02/08/2026.** Additif et
idempotent, sans `DROP` : `exercises.difficulte` passe de `TEXT` à `INTEGER` avec
un `CHECK BETWEEN 1 AND 5` (ADR-034), et la colonne `exercises.archive` apparaît
(ADR-035). `schema.sql` porte les mêmes définitions pour une installation neuve.
Inutile de le rejouer.

✅ **Migration du référentiel appliquée.** Vérifié le 07/08/2026 :
`evidence_competence_fk` **est posée** en base et **aucune preuve n'est
orpheline**. (Cette section affirmait le contraire — le texte datait d'avant
l'application.) L'ordre, pour mémoire et pour une installation neuve :
`schema.sql` (§ 2 crée les tables) → `supabase/migration-referentiel.sql`
(généré par `scripts/migrer-referentiel.ts`) → `schema.sql` à nouveau, qui pose
alors la clé. Elle n'est créée que si aucune preuve n'est orpheline ; sinon le
fichier émet un `NOTICE` et continue.

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
- **Le tuteur n'écrit aucune mesure** (ADR-037). Il rédige le **contenu** — un
  exercice n'affirme rien sur la personne, et il l'écrit directement. Tout ce qui
  **mesure** — preuve, niveau, compétence — reste une proposition que
  l'utilisateur valide.

**Ne pas modifier un seuil du moteur sans modifier le protocole correspondant.**
Ces garanties sont vérifiées par les tests de `lib/engine/` et `lib/domain/`.

⚠️ **Un test vert ne garantit rien sur ce qui entre dans le moteur.** Le 02/08,
une colonne `TEXT` là où le domaine dit `1|2|3|4|5` a produit une difficulté
conseillée de 5 au lieu de 1, sans qu'aucun des 239 tests d'alors puisse le
voir : ils passent tous des valeurs déjà typées. `ligneVersEntite` renomme des
clés, il ne valide pas. Quand un calcul du moteur lit une valeur venue de la
dorsale, il doit la convertir explicitement et **refuser de conclure** si elle
est illisible — jamais fabriquer un nombre (P2, ADR-034).

✅ **Les 8 principes sont tenus depuis le 01/08/2026.** P8 — l'autonomie
ignorait l'aide externe — est fermé par ADR-033 : la preuve manuelle demande
de quelle aide la personne a disposé, et le moteur en dérive le palier
(`autonomieObservee`). Le score global avait été corrigé le 31/07 (ADR-006).

🔬 Deux réserves subsistent sur P8, écrites dans `PRODUCT.md` §5 : le **bilan
d'exercice** ne pose pas la question, et les **29 preuves antérieures** ne sont
pas retouchées faute de donnée. Le biais est borné, pas supprimé.

---

## 6. Le référentiel appartient au compte

Depuis **ADR-026 (31/07/2026)**, il n'existe plus de référentiel global. Chaque
compte a le sien, dans les tables `domaines` et `competences`, construit avec le
tuteur et validé par l'utilisateur. `lib/domain/referentiel.ts` — 53 compétences
en dur, `DOMAINE_PILOTE`, `SKILLS_ACTIFS` — **est en sursis** : il ne sert plus
qu'à alimenter `scripts/migrer-referentiel.ts` et disparaît une fois la
migration appliquée. Aucun code d'exécution ne doit l'importer.

Les points d'entrée sont `lib/store/referentiel.ts` (lecture, `server-only`),
`lib/domain/referentiel-compte.ts` (tout ce qui est pur : assemblage, ordre,
validation, attribution des codes, **table des retraits**) et
`lib/store/referentiel-actions.ts` (écritures, unitaires **et groupées**). Le
moteur, lui, ne connaît toujours aucun référentiel : il reçoit les compétences
en paramètre.

⚠️ **En lecture, appeler `chargerReferentiel()`, jamais `lireReferentiel()`.**
Le second n'est là que pour les Server Functions d'écriture, qui ont déjà leur
dorsale et ne doivent surtout pas lire un référentiel mis en cache avant leur
propre écriture. Deux appelants faisaient chacun leur `lireReferentiel` dans la
même requête : domaines, compétences et preuves étaient lus **deux fois par
rendu**, et l'écran de gestion était le plus lent du produit (corrigé le 02/08).

**Le périmètre de travail** survit à ADR-020 sous la forme du drapeau
`competences.active`, par compte. C'est le frein contre le sur-ajout qui a
produit la situation du 28/07 — un grand référentiel sans contenu pour
l'alimenter.

**Retrait (ADR-027)** : une compétence **sans preuve** se supprime franchement,
une compétence **qui en porte** s'archive. Le geste est dérivé du nombre de
preuves, jamais offert au choix, et annoncé avant le clic. Le `code` est
immuable — c'est la clé étrangère des preuves.

## 7. Contraintes et points d'attention

- 🔴 **L'état réel des données est dans Supabase, jamais ailleurs.** Pour toute question sur l'usage, interroger Supabase via le MCP (`.mcp.json`).
- **Sécurité.** RLS PostgreSQL est la seule barrière d'autorisation de confiance. Ne jamais mettre la clé `service_role` côté client.
- **RGPD.** La progression est une donnée personnelle. Toute feature de partage doit être opt-in et granulaire.
- **Compatibilité.** Navigateur en priorité, mobile en second temps.

---

## 8. Ce que Claude Code ne doit PAS faire

- **Ne pas toucher au cœur** (`lib/domain/`, `lib/engine/`, `lib/store/`) sans
  demande explicite. C'est ce qui porte la garantie du système.
- **Ne jamais laisser le tuteur écrire un code de compétence.** Les codes sont
  attribués par l'application depuis le préfixe du domaine (ADR-026). Un code
  inventé entrerait en collision et les preuves suivraient la mauvaise
  compétence, sans erreur visible. Depuis ADR-031 le schéma de l'outil
  `proposer_referentiel` n'a **aucun champ `code`** : l'interdit est devenu
  inexprimable. Ne pas l'y réintroduire « pour la commodité ».
- **Ne pas supprimer une compétence qui porte des preuves** — l'archiver.
  `supprimerCompetence` refuse plutôt que de se replier en silence : une
  fonction qui fait autre chose que ce que son nom annonce s'érode (ADR-027).
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
- **Ne pas pousser directement sur `master`un chantier non vérifié.**
- **Ne pas remettre le widget de TODOs dev dans le produit** (ADR-019). Il vit sur `/dev` (`components/dev/dev-todo.tsx`), hors du groupe `(app)`. La liste partagée entre comptes est volontaire — ne pas la « corriger » sans demande.
- **Ne pas construire par anticipation.** Un modèle de données sans besoin réel
  est de la complexité gratuite. C'est ce qui a produit les 6 entités mortes
  supprimées le 28/07.
- **Ne pas desserrer `tentativeMenee` d'un seul côté** (ADR-030). Elle est
  appelée par la calibration *et* par l'écriture de la preuve, et un test lie
  les deux. Une tentative sous 25 % de la durée estimée ne produit aucune
  preuve : c'est un abandon, pas un échec. Le défaut est né de cette règle
  appliquée à un seul chemin.
- **Toute clé de stockage navigateur passe par `cleParCompte`**
  (`lib/ui/stockage-session.ts`). Conversation du tuteur, brouillons : deux
  comptes sur le même navigateur ne doivent jamais se voir — c'est ADR-029 un
  cran plus bas. Et l'état venant du navigateur se lit dans un initialiseur
  paresseux derrière `useEstHydrate`, jamais dans un `useEffect`.
- **Ne pas supprimer un exercice qui porte des tentatives** — l'archiver
  (ADR-035). `supprimerExercice` refuse, comme `supprimerCompetence`. Et le
  compte de tentatives inclut les **abandons**, contrairement à ce que fait la
  calibration : les deux modules ne posent pas la même question — « qu'a-t-on
  mesuré ? » d'un côté, « reste-t-il une trace au journal ? » de l'autre.
- **Ne pas remettre de filtres dans la liste d'exercices** (`exercices/page.tsx`).
  Cinq familles ont été retirées volontairement — « ~5 000 combinaisons pour une
  bibliothèque qui en compte une poignée ». Le besoin réel est de **regrouper**
  et de **retirer**. Elles reviendront quand le stock le justifiera.
- **Ne pas réintroduire une valeur unique là où il y a une file** (ADR-034,
  02/08). `cleExercicesProposes(compteId)` stocke un `PropositionExercice[]` :
  le tuteur sait produire plusieurs exercices par tour, et une clé unique les
  écrasait un par un. Et comme toute clé de navigateur, elle passe par
  `cleParCompte` — les deux clés de proposition étaient globales, en violation
  directe de la règle un cran plus bas qu'ADR-029.
- **Ne pas déplacer un seuil de `lib/engine/calibration.ts` sans données.**
  `FRACTION_NON_TENTEE` et `FRACTION_TROP_FACILE` sont calés sur des tentatives
  réelles, citées dans les tests. Les changer demande de nouvelles observations,
  pas un avis (ADR-028).
- **Ne pas laisser une boucle de décision dans un `.tsx`** (ADR-039). Vitest ne
  prend que `src/**/*.test.ts` en environnement node : ce qui vit dans un
  composant est **hors de portée d'un test**. `markdown.tsx` a porté deux mois
  une boucle infinie sur toute ligne commençant par `|` — le flux SSE livre
  l'en-tête d'un tableau avant son séparateur, donc l'onglet gelait à chaque
  tableau. Toute boucle `while` qui avance un index doit vivre dans `lib/`, et
  garantir qu'elle **consomme au moins un élément par tour**.
- **Ne pas élargir l'exception à ADR-036** (ADR-041, 07/08). Le tuteur voit la
  correction d'un exercice **sur un seul chemin** : `lib/tutor/correction.ts` et
  `/api/exercices/corriger`. Six verrous la bornent, tous du code — et le plus
  fragile est le troisième : `outilCorrection` ne doit **jamais** entrer dans
  `outilsTuteur`, sinon il voyage avec chaque message du chat et l'exception
  cesse d'en être une. Un test le vérifie. `JUSTIFICATION_MAX` n'est pas une
  règle de style : c'est ce qui empêche la « justification » d'être la
  correction recopiée.
- **Ne pas desserrer la réponse écrite d'un seul côté** (ADR-040). Le serveur
  (`terminerExercice`) et l'écran appliquent `reponseSuffisante`, et le refus a
  lieu **avant** toute écriture. `abandonnerExercice` est sa contrepartie
  obligatoire : sans lui, une tentative qu'on ne veut pas mener reste
  `en-cours` indéfiniment. Il n'écrit ni preuve ni `resultat` — prêter un
  « partiel » par défaut fabriquerait la mesure qu'on refuse d'écrire.
- **Ne pas laisser une proposition du tuteur entrer par un `useEffect`.** Dans
  `formulaire-bilan.tsx`, le verdict pré-remplit l'état par un **initialiseur
  paresseux**. Un `useEffect` qui recopie la prop écraserait les modifications
  de l'utilisateur au moindre re-rendu : on cocherait un critère et il
  reviendrait à la valeur du tuteur.
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
