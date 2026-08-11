# Synthèse des audits indépendants — mission ⑦

> **Portée révisée le 11/08/2026.** Cette synthèse reste une annexe de risques
> techniques. Elle ne pilote pas la roadmap produit. L'analyse orientée
> intelligence, gaps fonctionnels et ordre de construction vit dans
> `docs/audits/2026-08-audit-produit.md`.

**Date :** 11/08/2026  
**Sources :** `2026-08-audit-codex.md` (commit `4158157`) et `2026-08-audit-claude.md` (commit `ad88557`).  
**Règle :** cette synthèse rapproche les constats sans les transformer en décision, sans modifier le code et sans changer un statut.

## Vue d'ensemble

Les deux audits désignent la même priorité : la frontière Supabase traduit les données mais ne les valide pas. Ils s'accordent aussi sur l'absence de preuve concernant l'état RLS réellement appliqué, sur la centralisation de la logique métier et des validations dans `lib/`, et sur la faiblesse relative des tests de la couche `store`.

Deux contradictions demandent un arbitrage humain avant la mission ⑧ : le périmètre exact de la règle d'isolation par compte, notamment pour `dev_todos`, et le statut des clés de profilage navigateur que l'audit Claude n'a pas comptées. Les autres éléments vus par un seul audit restent à instruire, pas à écarter.

## 1. Constats concordants — priorité haute

### CC-01 — La validation Supabase avant le moteur n'existe pas

- **Sources :** Codex C-01 ; Claude C1, C2, C3, C4, G2 et G3.
- **Gravité conservée :** haute.
- **Références :** `app/src/lib/store/supabase-backend.ts:60-67`, `:163-184`, `app/src/lib/store/db.ts:116-145`, `app/src/lib/store/context.ts:90-180`, `app/src/lib/store/supabase-backend.test.ts:45-67`, `PRODUCT_SPECIFICATION_MAP.md:138`, `docs/MODELE.md:74`.
- **Preuve commune :** `ligneVersEntite<T>` retire des colonnes, renomme les clés puis force `sortie as T`. `convertirResultatRPC` vérifie l'enveloppe et la présence des collections, pas les valeurs des entités. Le chemin de lecture séparée applique la même conversion. Le moteur reçoit donc des objets non validés.
- **Éléments propres conservés :** Codex relève que le test accepte des enums et une dimension obsolètes ; Claude relève la coercition défensive `Number(exploitable.difficulte)` dans un consommateur et le nom ambigu de `verifier()`, qui relance des erreurs sans valider les données.
- **Invariant :** 2, 3 et 6 ; garde-fou explicite de `AGENTS.md`.
- **À instruire :** une validation runtime unique par entité persistée, commune au RPC et aux lectures séparées, qui refuse l'invalide sans fabriquer de repli ; tests des champs simples et JSON imbriqués.

### CC-02 — L'état RLS appliqué n'est pas prouvé

- **Sources :** Codex D-02 ; Claude D1 et D3.
- **Gravité conservée :** moyenne, comme défaut d'assurance et non comme fuite démontrée.
- **Références :** `app/supabase/schema.sql:41-48`, `:420-441`, `:471-500`, `AGENTS.md:124-129`.
- **Preuve commune :** le fichier de référence active RLS, applique `auth.uid()` et garde `charger_tout` sous les droits de l'appelant. Aucun audit n'a interrogé l'instance réelle ni exécuté un scénario croisé entre deux comptes. Le dépôt documente déjà une dérive passée de la RPC.
- **À instruire :** relever les politiques et privilèges réels, puis tester lecture, insertion, mise à jour, suppression et RPC entre deux comptes avant de conclure.

### CC-03 — La logique métier et les validations partagées sont centralisées

- **Sources :** Codex axes (e) et (f) ; Claude B2, axe E et conclusion de l'axe F.
- **Gravité :** aucun défaut métier démontré.
- **Références :** `app/src/lib/domain/`, `app/src/lib/engine/`, `app/src/components/seances/concepteur-seance.tsx`, `app/src/components/exercices/formulaire-bilan.tsx`.
- **Preuve commune :** les composants délèguent aux fonctions pures et aux `motifRefus*` partagés. Les validateurs d'appels d'outil du tuteur contrôlent une frontière de transport différente et ne remplacent pas l'autorité métier.
- **Réserve conservée :** Claude note la taille de `chat.tsx` et `concepteur-seance.tsx` comme risque de maintenance, sans violation de l'invariant. Codex classe les algorithmes de force et de rendu du graphe comme logique d'interface, pas métier.

### CC-04 — Le moteur est largement testé, la frontière `store` ne l'est pas

- **Sources :** Codex G-01 et bilan de l'axe (g) ; Claude G1, G2 et G3.
- **Gravité conservée :** moyenne pour la frontière de données, faible pour l'outillage de couverture.
- **Références :** `app/src/lib/engine/*.test.ts`, `app/src/lib/store/supabase-backend.test.ts`, `app/package.json:8-12`.
- **Preuve commune :** 30 fichiers et 687 tests passent ; les dérivations principales disposent de suites dédiées. Un seul fichier couvre `store`, sans cas exigeant le rejet d'une ligne invalide. La suite n'a pas de mesure de couverture.
- **À instruire :** protéger d'abord CC-01 par des tests de réfutation, puis mesurer la couverture ciblée de `lib/store` et `lib/engine` avant de choisir un éventuel seuil.

### CC-05 — La carte contient des références de code devenues fausses

- **Sources :** Codex H-01 ; Claude A1.
- **Gravité conservée :** faible.
- **Références :** `PRODUCT_SPECIFICATION_MAP.md:41`, `:58`, `:78`, `app/src/lib/engine/preuve.ts:66`.
- **Preuve commune :** la carte place notamment `PLAFOND_AIDE` dans `domain/bilan.ts` alors qu'il vit dans `engine/preuve.ts`. Codex ajoute que `calculerEtatGlobal` est dans `engine/progression.ts` et que le référentiel par compte n'est plus porté par l'ancien `domain/referentiel.ts`.
- **À instruire :** corriger mécaniquement les chemins après les arbitrages, sans utiliser cette passe pour changer les statuts.

## 2. Constats divergents — vus par un seul audit

### DV-01 — Une dimension non documentée devient zéro dans le score

- **Source :** Codex B-01 uniquement.
- **Gravité proposée par la source :** haute.
- **Références :** `app/src/lib/engine/skill-state.ts:236-255`, `:365-370`, `docs/MODELE.md:140`.
- **Preuve :** `calculerDimensions` écrit zéro lorsqu'aucune preuve ne documente une dimension, puis le score pondère les cinq dimensions. L'inconnu peut donc pénaliser une compétence évaluée.
- **À instruire :** écrire un test de réfutation et comparer trois modèles : renormaliser sur les dimensions observées, rendre le score absent sous une couverture minimale, ou séparer explicitement score et couverture dimensionnelle.

### DV-02 — Les seuils d'autonomie et de confiance ne sont pas tous nommables

- **Source :** Claude F1 et F2 uniquement.
- **Gravité proposée par la source :** moyenne.
- **Références :** `app/src/lib/engine/preuve.ts:66`, `:105`, `app/src/lib/engine/skill-state.ts:144`.
- **Preuve :** `PLAFOND_AIDE` est privé ; d'autres conditions numériques sont écrites directement dans les expressions. Claude estime que cela gêne la confrontation des hypothèses au modèle de la mission ⑤.
- **À instruire :** vérifier d'abord si les comportements sont déjà testables par l'API publique ; ne nommer/exporter que ce qui améliore réellement la réfutabilité, sans multiplier les constantes décoratives.

### DV-03 — Dette de migrations et état de schéma non réconcilié

- **Source :** Claude H1 uniquement.
- **Gravité proposée par la source :** moyenne.
- **Références :** `app/supabase/schema.sql`, les neuf fichiers `app/supabase/migration-*.sql`, `app/src/lib/domain/types.ts:328-338`.
- **Preuve :** le dépôt ne dit pas quels scripts sont appliqués sur quelle instance ; certaines branches de code reconnaissent cette incertitude.
- **À instruire :** produire un inventaire daté du schéma réellement appliqué et définir la relation entre schéma de référence et historique des migrations avant toute modification DB.

### DV-04 — `docs/design/` n'a pas de statut documentaire

- **Source :** Claude H2 uniquement.
- **Gravité proposée par la source :** faible.
- **Références :** `docs/design/`.
- **Preuve :** quatre phases de design ne sont rattachées ni à une couche de la carte ni à une décision ; leur caractère actif ou historique est inconnu.
- **À instruire :** les classer comme source active, hypothèse ou archive, sans promouvoir leur contenu.

### DV-05 — Dette assumée de conversion du profil

- **Source :** Claude H3 uniquement.
- **Gravité :** aucune action demandée par la source.
- **Référence :** `app/src/lib/store/supabase-backend.ts:115-117`.
- **Preuve :** l'absence de conversion inverse du profil est expliquée et conditionnée à l'existence future d'un écran d'édition.
- **Traitement :** conserver comme exemple de dette correctement documentée ; ne pas construire par anticipation.

### DV-06 — Statuts et commentaires ADR devenus incohérents

- **Source :** Codex H-01 uniquement pour ces sous-points.
- **Gravité proposée par la source :** faible.
- **Références :** `ARCHITECTURE_DECISIONS.md:21-24`, `:251`, `:413`, `:463`, `app/src/lib/domain/theme.ts:1-3`, `app/src/lib/store/theme-actions.ts:1-4`.
- **Preuve :** l'index conserve ADR-006, ADR-008 et ADR-009 comme ouvertes alors que leurs sections les donnent acceptée ou fermées ; deux commentaires des thèmes citent ADR-053 au lieu d'ADR-055.
- **À instruire :** aligner index et commentaires sur les sections existantes, sans nouvel arbitrage produit.

### DV-07 — La vérification complète échoue sur le graphe

- **Source :** vérification Codex, non exécutée par Claude.
- **Gravité proposée :** faible, indépendante des constats métier.
- **Références :** `app/src/components/competences/graphe/graphe-competences.tsx:82`, `:213`.
- **Preuve :** `npm run verify` passe TypeScript puis échoue sur deux règles React ESLint ; `npm test` passe séparément les 687 tests.
- **À instruire :** corriger les deux erreurs et les trois avertissements dans un lot de maintenance explicitement planifié.

## 3. Constats contradictoires — arbitrage humain requis

### CT-01 — `dev_todos` est-elle dans le périmètre de l'isolation par compte ?

- **Position Claude — A2, A3 et D2 :** la carte affirme une isolation et une absence de comparaison entre comptes sans mentionner `dev_todos`, table et bucket volontairement partagés entre tous les comptes authentifiés. ADR-019 laisserait encore une question ouverte ; la garantie ✅ est donc trop large.
- **Position Codex — axe (d) et invariant 8 :** aucune donnée pédagogique partagée n'a été trouvée ; `dev_todos` est documentée dans le schéma comme outil d'équipe hors produit. Elle a été traitée comme exception de développement, pas comme défaut de l'isolation des comptes pédagogiques.
- **Références :** `app/supabase/schema.sql:503-510`, `:528`, `:575-581`, `PRODUCT_SPECIFICATION_MAP.md:46`, `:135-136`, ADR-019.
- **Choix humain requis :**
  1. soit les invariants et la carte couvrent **toute donnée de l'application** : `dev_todos` doit être isolée ou sortie de la dorsale accessible aux comptes produit ;
  2. soit ils couvrent seulement les **données pédagogiques et personnelles du produit** : l'exception d'équipe doit être explicitement nommée dans la carte, avec son contrôle d'accès et sa finalité.
- **Interdit avant choix :** ne pas transformer l'exception en conformité implicite, ni supprimer le partage sans décision sur l'usage de l'équipe.

### CT-02 — Quelles clés navigateur échappent réellement à l'isolation ?

- **Position Claude — B1 :** seules `theme` et `rail` sont globales ; « toutes les autres clés » passent par `cleParCompte`. Le choix est de restreindre la règle aux données de compte ou d'isoler aussi ces deux préférences visuelles.
- **Position Codex — D-01 :** quatre clés supplémentaires sont globales : `profilage-client-actif`, `profilage-client-enregistre`, `profilage-rendus`, `profilage-interactions`. Les deux dernières stockent type, libellé, durée et horodatage d'interactions, avec une sensibilité supérieure à thème/rail.
- **Références :** `app/src/lib/profiling/client.ts:49-65`, `:133-152`, `:169-192`, `app/src/lib/ui/stockage-session.ts:14-22`, `app/src/app/layout.tsx:29`.
- **Choix humain requis :** confirmer si le profilage est une donnée liée au compte — auquel cas ses clés et drapeaux doivent être isolés et les anciennes valeurs purgées — ou un diagnostic volontairement lié au navigateur — auquel cas sa portée, sa rétention et son absence d'usage pédagogique doivent être documentées. Le choix thème/rail peut être distinct.
- **Interdit avant choix :** ne pas corriger seulement thème/rail en laissant croire que toutes les clés sont alors isolées.

## 4. Table de traçabilité exhaustive

| Audit source | Entrée | Destination |
|---|---|---|
| Codex | C-01 | CC-01 |
| Codex | H-01 | CC-05, DV-06 |
| Codex | B-01 | DV-01 |
| Codex | D-01 | CT-02 |
| Codex | D-02 | CC-02 |
| Codex | axe (e) | CC-03 |
| Codex | axe (f) | CC-03 |
| Codex | G-01 | CC-04 |
| Codex | vérification locale | DV-07 |
| Claude | A1 | CC-05 |
| Claude | A2, A3 | CT-01 |
| Claude | B1 | CT-02 |
| Claude | B2, axe E | CC-03 |
| Claude | C1, C2, C3, C4 | CC-01 |
| Claude | D1, D3 | CC-02 |
| Claude | D2 | CT-01 |
| Claude | F1, F2 | DV-02 |
| Claude | G1, G2, G3 | CC-04, CC-01 |
| Claude | H1 | DV-03 |
| Claude | H2 | DV-04 |
| Claude | H3 | DV-05 |

## Arrêt obligatoire avant la mission ⑧

Une personne doit trancher CT-01 et CT-02. La roadmap ne doit pas décider silencieusement du périmètre de confidentialité et d'isolation. Les constats concordants et divergents peuvent être préparés, mais pas ordonnancés en chantier final avant ces deux réponses.
