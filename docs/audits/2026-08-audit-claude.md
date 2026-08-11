# Audit du dépôt — Claude — 11/08/2026

Étape ⑥-bis du plan. Rédigé **à l'aveugle** : aucun audit Codex n'a été lu.
Destiné à être fusionné avec `2026-08-audit-codex.md` à l'étape ⑦.

**Ce document ne tranche rien.** Il constate. Aucun statut n'y monte, aucune
correction n'y est appliquée. Conformément à `AGENTS.md` : *ne jamais
transformer une analyse en décision validée*.

Gravité : 🔴 haute (un invariant peut être violé en silence) · 🟠 moyenne
(décision ouverte ou angle mort) · 🟡 basse (exactitude, lisibilité).

**Périmètre mesuré.** 206 fichiers `.ts`/`.tsx`, 47 315 lignes dans `app/src`.
30 fichiers de test, **687 tests, tous verts** (`npm run test`, 3,4 s).

---

## Axe A — Écart entre le code et la carte

| # | Constat | Gravité |
|---|---|---|
| **A1** | La carte situe `PLAFOND_AIDE` dans `domain/bilan.ts`. Il vit en réalité dans [`engine/preuve.ts:66`](app/src/lib/engine/preuve.ts:66). La colonne « Code » de la couche 2 est fausse sur la brique dont dépend P8. | 🟡 |
| **A2** | Couche 5, « Isolation par compte ✅ ». La table `dev_todos` est **délibérément partagée** : `USING (true)` ([`schema.sql:528`](app/supabase/schema.sql:528)), plus deux politiques de dépôt d'images (575-581). La carte affiche un ✅ sans exception, alors qu'ADR-019 laisse la question ❓ **explicitement ouverte depuis le 28/07** — « aucune action prise là-dessus ». | 🟠 |
| **A3** | Couche 0, « Aucune comparaison entre comptes ✅ — absence assumée ». Vrai du pédagogique ; faux au sens littéral tant que `dev_todos` est lue par tout compte authentifié. La garantie doit préciser son périmètre. | 🟡 |

Le reste des chemins vérifiés est exact : les trois pôles de navigation
([`navigation.ts:36-56`](app/src/components/layout/navigation.ts:36)), les
redirections `/progression`, `/journal`, `/exercices` vers `/seances`, la
présence de `RefusRecommandation`, `VerdictTuteur`, `graphe.ts`.

---

## Axe B — Les huit invariants

| # | Constat | Gravité |
|---|---|---|
| **B1** | *« Toute clé de stockage navigateur doit être isolée par compte. »* Deux clés ne le sont pas : `theme` et `rail` ([`layout.tsx:29`](app/src/app/layout.tsx:29), [`theme.ts:29-39`](app/src/components/layout/theme.ts:29), [`bascule-rail.tsx:21`](app/src/components/layout/bascule-rail.tsx:21)). Deux comptes sur le même navigateur partagent leur thème et l'état du rail. Toutes les autres clés passent par `cleParCompte` (11 usages vérifiés : graphe, pomodoro, brouillon de réponse, conversation, clé tuteur, propositions, feedback). **Soit la règle dit « toute » et le code est en défaut, soit la règle vise les données de compte et son libellé est trop large.** C'est un arbitrage, pas un bug. | 🟠 |
| **B2** | *« La logique métier non triviale doit vivre dans `lib/`. »* Vérifié sur les deux plus gros composants : [`concepteur-seance.tsx`](app/src/components/seances/concepteur-seance.tsx) (1 016 lignes) délègue à `domain/seance`, `domain/exercice`, `domain/theme` et n'importe du moteur que des **types**. Aucune violation trouvée. `chat.tsx` (1 277 lignes) reste le plus gros fichier du dépôt — risque de maintenance, pas manquement à l'invariant. | 🟡 |

Les invariants 1 (rien de dérivable stocké), 5 (le tuteur ne mesure pas) et 7
(le référentiel appartient au compte) n'ont produit aucun contre-exemple sur les
chemins lus.

---

## Axe C — Données Supabase entrant dans le moteur

**C'est le constat central de cet audit.**

| # | Constat | Gravité |
|---|---|---|
| **C1** | Le garde-fou *« Les données venant de Supabase doivent être validées avant d'entrer dans le moteur »* **n'a aucune implémentation**. [`ligneVersEntite`](app/src/lib/store/supabase-backend.ts:60) supprime les `NULL`, renomme les colonnes, puis rend `sortie as T` — un cast, pas une validation. Toutes les entités passent par là : `SkillEvidence`, `Exercise`, `ExerciseAttempt`, `LearningSession`, `RefusRecommandation`, `Domaine`, `Skill`. Aucune bibliothèque de validation dans les dépendances (pas de `zod`). | 🔴 |
| **C2** | Le bug du 02/08 (`exercises.difficulte` en `TEXT`, `"1" + 0 === "10"`) a été réparé **chez le consommateur** — [`calibration.ts:478`](app/src/lib/engine/calibration.ts:478) fait `Number(exploitable.difficulte)` — et non à la frontière. La classe de défaut reste entière : n'importe quelle autre colonne mal typée traversera de la même façon, et les tests ne peuvent pas le voir puisqu'ils passent des valeurs déjà typées. C'est exactement la leçon écrite dans `PRODUCT.md` §6, non encore transposée en code. | 🔴 |
| **C3** | [`convertirResultatRPC`](app/src/lib/store/supabase-backend.ts:163) valide la **présence** des clés (ligne 170) et se replie proprement si la fonction SQL a dérivé. Bonne protection — mais elle porte sur la forme de l'enveloppe, jamais sur le type des valeurs. | 🟠 |
| **C4** | `verifier()` (ligne 211) est une **relance d'erreur**, pas une validation. Le nom laisse croire à une barrière qui n'existe pas. | 🟡 |

---

## Axe D — RLS et isolation

| # | Constat | Gravité |
|---|---|---|
| **D1** | **Conforme.** Huit tables passent dans la même boucle ([`schema.sql:424-441`](app/supabase/schema.sql:424)) : `ENABLE ROW LEVEL SECURITY` + politique `isolation_par_compte` en `USING (auth.uid() = user_id) WITH CHECK (...)`. `profiles` est traitée à part (41-44), `themes` par `migration-themes.sql:28-31`. `charger_tout()` est `SECURITY INVOKER`, `REVOKE` de `anon`, `GRANT` aux seuls `authenticated` (499-500). Aucun `service_role` côté client. | ✅ |
| **D2** | `dev_todos` : partage assumé et documenté (ADR-019), mais la question ❓ est ouverte **depuis le 28/07 sans action**. Tout compte authentifié lit, modifie et supprime la liste, et dépose dans le bucket d'images. | 🟠 |
| **D3** | **Rien n'a été vérifié dans Supabase.** Les fichiers SQL disent l'intention, pas l'état appliqué. `AGENTS.md` l'interdit explicitement : *« ne jamais supposer qu'une migration est appliquée simplement parce que le fichier existe »*. Toute conclusion de cet axe est donc sous réserve d'une lecture réelle de la base. | 🟠 |

---

## Axe E — Logique métier hors `lib/`

13 fichiers de `components/` importent `@/lib/engine`. Les cas inspectés
importent des **types** et des fonctions pures, pas de la dérivation recopiée.
Rien à signaler au-delà de B2.

---

## Axe F — Duplication et seuils

| # | Constat | Gravité |
|---|---|---|
| **F1** | `PLAFOND_AIDE` est un `const` **privé du module** ([`preuve.ts:66`](app/src/lib/engine/preuve.ts:66)) : ni exporté, ni testable de l'extérieur, ni affichable. Or c'est le barème dont dépend la fermeture de P8. Une valeur qu'on ne peut pas nommer depuis l'extérieur ne peut pas être confrontée à l'usage. | 🟠 |
| **F2** | Deux régimes coexistent pour la même nature de décision. Nommé et documenté : `NIVEAU_MAITRISE = 4`, `FRACTION_TROP_FACILE`, `SIGNAUX_CONCORDANTS`, `FACTEUR_NIVEAU`. Anonyme : [`preuve.ts:105`](app/src/lib/engine/preuve.ts:105) `difficulte >= 4 && (autonomie === "A3" \|\| "A4")`, [`skill-state.ts:144`](app/src/lib/engine/skill-state.ts:144) `preuves.length >= 4 && contextes >= 3 && autonomes >= 2`. **Un seuil sans nom ne peut pas porter de test de réfutation** — c'est un obstacle direct à l'étape ⑤. | 🟠 |

Aucune double implémentation d'une même validation métier n'a été trouvée.

---

## Axe G — Couverture des chemins de dérivation

| # | Constat | Gravité |
|---|---|---|
| **G1** | **Le moteur est couvert.** `moteur.test.ts` (68 tests) exerce `skill-state`, `progression`, `recommend`, `historique`, `preuve` sur les fixtures du référentiel ; `calibration` 47, `caf` 35, `spaced` 22, `maitrise` 12. | ✅ |
| **G2** | **La distribution des tests contredit la leçon du 02/08.** 13 fichiers de test sur `tutor`, 7 sur `domain`, 6 sur `engine` — et **1 seul sur `store`**, la couche où vit C1. « Le moteur est pur et vérifié ; ce qu'on lui donne à manger ne l'était pas » est écrit dans `PRODUCT.md`, pas encore dans le dossier de tests. | 🟠 |
| **G3** | Aucun test n'affirme qu'une ligne invalide est rejetée — logiquement, puisque aucun code ne la rejette (C1). | 🟡 |

---

## Axe H — Dette documentaire

| # | Constat | Gravité |
|---|---|---|
| **H1** | **Deux sources de vérité pour le schéma, aucune réconciliation.** 9 fichiers de migration coexistent avec `schema.sql`, et rien dans le dépôt ne dit lesquels sont appliqués. [`types.ts:328-338`](app/src/lib/domain/types.ts:328) le reconnaît noir sur blanc pour `modifieLe` : le champ reste absent « tant que `migration-exercice-edition.sql` n'est pas appliquée ». Le code porte donc des branches conditionnées à un état de base que personne ne peut lire depuis le dépôt. | 🟠 |
| **H2** | `docs/design/` (4 fichiers, phases 00 à 03) n'a pas été rattaché à une couche de la carte ni à un ADR. Statut inconnu : chantier en cours, ou instantané périmé ? | 🟡 |
| **H3** | `supabase-backend.ts:115-117` documente une conversion inverse volontairement absente, avec sa raison. C'est de la dette **assumée et datée** — le bon régime. Aucune action. | ✅ |

---

## Ce que je n'ai pas vérifié

À dire avant que quiconque prenne ce document pour exhaustif :

- **L'état réel de Supabase** — aucune requête MCP lancée. Tout l'axe D est sous réserve.
- **`npm run build`** — non exécuté. Seuls les tests l'ont été.
- **Les 206 fichiers** — lecture ciblée par axe, pas revue exhaustive. `chat.tsx` (1 277 lignes) et `dev-todo.tsx` (815) n'ont pas été lus en entier.
- **Les protocoles du tuteur** (`app/data/00_instructions/`) — non lus. Or P6 dit que le protocole *est* la spécification : un audit complet doit les confronter au code.
- **L'usage réel** — aucun chiffre de production n'est repris ici.

---

## Les trois choses qui comptent

1. **C1/C2 — la frontière de validation n'existe pas.** Le produit dont le
   principe fondateur est de ne rien affirmer sans preuve accepte n'importe
   quelle valeur venue de la base sans la vérifier. Tout le reste de cet audit
   est secondaire devant ça.
2. **F1/F2 — les seuils ne sont pas tous nommables.** L'étape ⑤ demande un test
   de réfutation par seuil ; deux seuils n'ont pas de nom et un troisième n'est
   pas exporté. ⑤ butera dessus si rien n'est fait avant.
3. **D2/A2 — une exception documentée a été perdue en route.** ADR-019 laissait
   une question ouverte ; la carte affiche un ✅ qui l'efface. Le mécanisme qui a
   produit cet écart mérite autant d'attention que l'écart lui-même : c'est
   ainsi qu'un instrument de mesure se met à mentir.
