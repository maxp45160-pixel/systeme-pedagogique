# Twiny — Continuité de la refonte

**Support canonique de passage de relais — baseline du 20/08/2026.**

Ce document permet à un nouveau chat de reprendre la refonte sans dépendre de
l'historique conversationnel. Il coordonne la cible métier et l'état réellement
implémenté ; il ne remplace ni les décisions produit, ni les ADR, ni la
vérification de la base réelle.

> **Consigne permanente : un chat n'implémente qu'un lot et ne commence pas le
> suivant.** Il termine ses vérifications et son passage de relais avant de
> s'arrêter.

## 1. Documents faisant autorité

Lire dans cet ordre avant chaque lot :

1. [`AGENTS.md`](../../AGENTS.md) — règles de travail, invariants et
   garde-fous du dépôt ;
2. [`PRODUCT.md`](../../PRODUCT.md) — contrats produit courants et récits
   historiques à ne pas réécrire ;
3. [`ARCHITECTURE_DECISIONS.md`](../../ARCHITECTURE_DECISIONS.md) — décisions,
   statuts et justifications ;
4. [`TWINY_MODEL.md`](TWINY_MODEL.md) — architecture métier cible, jamais un
   schéma SQL littéral ;
5. le présent document — ordre des lots, baseline et passage de relais ;
6. le code, `app/supabase/schema.sql`, les migrations locales puis l'état réel
   de Supabase — vérité de ce qui est effectivement implémenté et appliqué.

Règles d'interprétation :

- une cible documentée n'est pas réputée construite ;
- le code actuel fait foi sur l'implémentation locale ;
- l'état Supabase réel fait foi sur les objets, politiques, fonctions et
  données effectivement déployés ;
- la présence d'une migration locale ne prouve jamais son application ;
- en cas d'écart entre cible et existant, commencer par le décrire et migrer
  par lots, sans refonte big bang.

## 2. ADR validées par la refonte

Les décisions suivantes ont reçu la validation humaine explicite de Maxime le
20/08/2026 dans le chat du lot 0 :

| ADR | Contrat |
|---|---|
| [ADR-089](../../ARCHITECTURE_DECISIONS.md#adr-089) | Carte globale partagée, générique et extensible ; overlay privé par compte ; remplace ADR-026. |
| [ADR-090](../../ARCHITECTURE_DECISIONS.md#adr-090) | Preuve = trace vérifiable ; l'actuel `evidence` = Observation ; rupture complète au lot 1. |
| [ADR-091](../../ARCHITECTURE_DECISIONS.md#adr-091) | États, carte individuelle et espace actif calculés, non autoritatifs et non persistés. |
| [ADR-092](../../ARCHITECTURE_DECISIONS.md#adr-092) | Connaissance = élément déclaré pouvant référencer des ressources, jamais document automatique. |
| [ADR-093](../../ARCHITECTURE_DECISIONS.md#adr-093) | Relations validées et sourcées persistables ; similarités et inférences dérivées. |
| [ADR-094](../../ARCHITECTURE_DECISIONS.md#adr-094) | Objectifs multiples, datés, priorisés, structurés et à cible typée. |
| [ADR-095](../../ARCHITECTURE_DECISIONS.md#adr-095) | Niveau observé distinct de la maîtrise consolidée ; seuils inchangés. |

Ces ADR n'élèvent aucun statut antérieur. ADR-083 à ADR-088 restent 🔬 ; les
anciennes ADR conservent leur vocabulaire historique.

## 3. Baseline au 20/08/2026

Ce snapshot a été fourni et validé humainement pour le lot 0. Le lot 0 ne
requiert ni ne permet une nouvelle mutation ou migration Supabase. Chaque lot
qui touche la base doit recontrôler les faits concernés sur le projet réel.

| Fait de départ | Valeur ou état | Conséquence |
|---|---|---|
| Lignes dans `evidence` | **52** | Le lot 1 doit préserver le compte, les identifiants, dates et relations. |
| Tentatives | **59** | À rapprocher des observations et des sources avant/après migration. |
| Séances | **59** | Aucun remplacement de `LearningSession` n'est autorisé. |
| `competence_domaines` | **0 ligne** | L'absence de données ne permet ni suppression ni invention ; le chargement doit néanmoins être corrigé au lot 2. |
| RPC `charger_tout` | omet `competence_domaines` | Le référentiel chargé ne contient pas actuellement les rattachements secondaires. |
| Références de source actuelles | `evidence.source.ref` pointe vers l'exercice | La source ne désigne pas encore la tentative exacte ; ne pas inventer la provenance au lot 1. |
| Conversion des données Supabase | non validée à l'exécution avant l'entrée dans le moteur | Le lot 2 doit ajouter une validation explicite sans fabriquer de valeur de repli invalide. |
| Clôture d'exercice | non transactionnelle | Le lot 2 doit rendre atomiques les écritures concernées ; le lot 1 préserve le comportement. |

Avant le lot 1, vérifier au minimum dans Supabase : existence et définition de
`evidence`, compte de lignes, contraintes, index, déclencheurs, privilèges,
politiques RLS, définition et droits de `charger_tout`, ainsi que l'état réel des
migrations. Répéter les contrôles après application. Ne jamais déduire
l'application d'une migration de son seul fichier local.

## 4. Roadmap et frontières

### Lot 0 — Contrats et continuité

**Objectif.** Verrouiller le vocabulaire, les frontières métier, les ADR et le
support canonique de passage de relais.

**Dépendances.** Validation humaine des arbitrages du 20/08/2026 ; lecture de
l'état documentaire et des signatures actuelles.

**Non-objectifs.** Aucun code, test, schéma SQL, migration, table de carte,
requête mutante ou changement d'état Supabase. Aucune suite applicative.

### Lot 1 — Rupture complète `evidence` → `observations`

**Objectif.** Aligner sans coexistence le vocabulaire PostgreSQL, TypeScript,
RPC, moteur, interfaces internes et tests, en conservant toutes les lignes et
le comportement. Le contrat détaillé est au § 5.

**Dépendances.** Lot 0 terminé ; état Supabase réel vérifié avant intervention ;
sauvegarde et stratégie conservative de renommage préparées ; dépendances du
code inventoriées depuis les types jusqu'aux consommateurs.

**Non-objectifs.** Pas de concept `Preuve` persistant nouveau, de provenance
complète, de source réattribuée à la tentative, de transaction de clôture, de
validation Supabase générale, de carte globale ni d'overlay.

### Lot 2 — Provenance, transaction, validation et chargement

**Objectif.** Faire pointer chaque Observation nouvelle vers une source exacte,
rendre la clôture d'exercice atomique, valider les données Supabase avant le
moteur et intégrer `competence_domaines` au chargement du référentiel.

**Dépendances.** Lot 1 terminé sans référence runtime historique ; contrat des
Observations stabilisé ; état Supabase revérifié ; ADR de gouvernance et de RLS
relues.

**Non-objectifs.** Pas de noyau de carte globale, pas d'objectif structuré, pas
d'état persisté, pas de bascule UI. Ne pas fabriquer une source pour les lignes
historiques qui n'en portent pas une démontrable.

**Sortie attendue pour le lot 3.** Mettre à jour ce document avec la provenance
réellement disponible, la frontière transactionnelle, les validateurs ajoutés,
la charge RPC exacte et tout écart de données restant.

### Lot 3 — Noyau de carte globale et overlay

**Objectif.** Concevoir puis construire le plus petit noyau nécessaire au
catalogue global partagé et à la relation privée du compte, conformément à
ADR-089, ADR-092 et ADR-093.

**Dépendances.** Lots 1 et 2 terminés ; comparaison explicite du modèle cible,
du code, du schéma et des données ; arbitrage humain de toute nouvelle forme de
persistance ; provenance et RLS prêtes à tenir la séparation global/privé.

**Non-objectifs.** Pas de carte exhaustive, pas de copie par compte, pas de
fusion automatique du local, pas de conversion automatique du corpus en
Connaissances, pas d'objectifs/parcours complets, pas d'états persistés. Le lot
0 n'a validé aucune table pour ce noyau.

### Lot 4 — Objectifs, événements et parcours

**Objectif.** Porter les objectifs multiples et structurés, les événements et
les parcours comme faits privés datés, sans interpréter les textes historiques.

**Dépendances.** Overlay du lot 3 opérationnel ; types de cibles globaux et
locaux stabilisés ; provenance, consentement et RLS vérifiés.

**Non-objectifs.** Pas d'extraction automatique d'intention, pas d'état ou de
score stocké, pas de nouvelle entité remplaçant `LearningSession`, pas de
recommandation recalibrée.

### Lot 5 — États, carte individuelle, espace actif et recommandation

**Objectif.** Calculer à la demande les états de connaissance et de compétence,
la carte individuelle et un espace actif borné, puis adapter la recommandation
à ces vues.

**Dépendances.** Carte/overlay du lot 3 et faits du lot 4 disponibles ;
Observations validées ; distinction niveau observé/maîtrise consolidée testable.

**Non-objectifs.** Aucun état autoritatif, aucune matérialisation ou cache sans
mesure et nouvelle décision, aucun changement de seuil sans données, aucune
présentation comme recommandation absolument optimale.

### Lot 6 — Bascule UI et dépréciations

**Objectif.** Exposer le vocabulaire et les parcours cibles, distinguer le
ponctuel du consolidé, puis retirer les surfaces et contrats devenus obsolètes.

**Dépendances.** Lots 1 à 5 terminés et vérifiés ; parcours de bout en bout
opérationnel ; stratégie de dépréciation et compatibilité de données validée.

**Non-objectifs.** Pas de nouvelle entité métier par commodité d'interface, pas
de logique métier non triviale dans les composants, pas de suppression de faits
historiques, pas de publication globale implicite.

## 5. Contrat opératoire du lot 1

### Périmètre obligatoire

- Renommer la table active `evidence` en `observations` par une migration
  PostgreSQL conservative.
- Préserver les **52 lignes**, leurs identifiants, dates, clés étrangères et
  politiques RLS.
- Renommer les contraintes, index et politiques dont le nom conserve l'ancien
  concept lorsque cela améliore la traçabilité.
- Renommer `SkillEvidence` en `SkillObservation`.
- Renommer toutes les collections, propriétés, paramètres et résultats RPC qui
  représentent les Observations.
- Faire retourner `observations` par `charger_tout`.
- Adapter actions, contexte, moteur, progression, recommandations, tuteur,
  composants consommateurs et tests.
- Réserver le nom `Evidence`/`Preuve` au futur concept de trace brute.
- Vérifier l'état Supabase réel avant la migration, après son application et
  avant de conclure le lot.

### Interdictions

- aucun alias TypeScript ;
- aucune vue SQL `evidence` ;
- aucune double lecture ou double écriture ;
- aucune période de coexistence technique ;
- aucune réinterprétation ou réécriture des 52 lignes ;
- aucune provenance complète ni transaction de clôture anticipée : elles
  appartiennent au lot 2 ;
- aucune conclusion d'application fondée sur le seul fichier de migration.

### Critères de sortie

- aucune référence runtime à la table ou au type métier historique `evidence` ;
- seules les migrations et explications historiques conservent ce mot dans son
  ancien sens ;
- compte de lignes inchangé ;
- identifiants, dates, clés étrangères, contraintes utiles, index et RLS
  préservés ou renommés sans perte de protection ;
- chargement groupé fonctionnel avec `observations` ;
- moteur et interfaces comportementalement équivalents ;
- tests ciblés, suite complète et build réussis ;
- vérification Supabase avant/après consignée ;
- présent document mis à jour avec le contrat exact du lot 2, sans commencer ce
  lot.

## 6. Journal de passage de relais

Chaque lot ajoute une entrée contenant obligatoirement :

- lot terminé et date ;
- HEAD et état complet du worktree ;
- fichiers réellement modifiés ;
- migrations créées et état réel de leur application ;
- tests ou vérifications exécutés et résultats ;
- décisions nouvelles, avec leur validation humaine ou leur statut non validé ;
- écarts connus et données non vérifiées ;
- périmètre exact du prochain lot ;
- modèle et effort recommandés pour le prochain chat.

### Passage de relais — lot 0 — 20/08/2026

**Lot terminé.** Lot 0 — verrouillage des contrats et continuité documentaire.

**HEAD.** `016cf31c11f5b8b862117bd19dc2b9a3e84a1466` au démarrage du lot.

**Worktree.** Non propre au démarrage. Écarts utilisateur préservés :
`AGENTS.md` modifié, `README.md` supprimé et `docs/architecture/` non suivi.
Le contrôle final du lot doit relever l'état complet sans attribuer ces écarts
au chantier.

**Fichiers réellement modifiés par le lot 0.**

- `ARCHITECTURE_DECISIONS.md` ;
- `PRODUCT.md` ;
- `docs/architecture/TWINY_MODEL.md` ;
- `docs/architecture/TWINY_MIGRATION.md` créé.

**Migrations et Supabase.** Aucune migration créée ou appliquée. Aucun code,
schéma SQL ni état Supabase modifié. Les 52 lignes constituent le baseline
humainement validé, pas une requête distante exécutée par le lot 0.

**Vérifications.** `git diff --check` réussi sans erreur (seuls les avertissements
de conversion LF/CRLF du worktree sont émis). Numéros, index et ancres
ADR-026/083-095 vérifiés ; liens locaux ajoutés valides ; aucune espace finale
dans les quatre documents ; aucune formulation contradictoire trouvée dans les
sections courantes ciblées. Aucun fichier sous `app/src/` ou `app/supabase/`
n'a changé. Aucune suite applicative n'est exécutée, conformément au périmètre.

**Décisions nouvelles.** ADR-089 à ADR-095, toutes acceptées par validation
humaine explicite de Maxime le 20/08/2026. Aucun autre statut n'est promu.

**Écarts connus.** La cible de carte globale n'a encore aucune forme SQL
validée. Les comptes de données et l'état des objets Supabase doivent être
recontrôlés au début du lot 1. Les anciennes ADR emploient légitimement
« preuve » dans le sens historique de l'actuel `evidence`. Un audit global des
liens a aussi retrouvé quatre liens locaux historiques déjà invalides dans le
registre — deux vers `PLAN_REFONTE_SEANCES.md` absent et deux chemins `../app/`
hors racine — ; ils ne sont ni introduits ni corrigés par le lot 0.

**Prochain lot exact.** Exécuter uniquement le lot 1 décrit au § 5, achever ses
vérifications et écrire le contrat concret du lot 2. Ne pas commencer la
provenance, la transaction de clôture ou la carte globale.

**Modèle recommandé.** `gpt-5.6-sol`, effort `xhigh`.

### Passage de relais — lot 1 préparé, cutover restant — 20/08/2026

**État réel : lot 1 incomplet.** La rupture est implémentée et vérifiée dans le
worktree, mais elle n'est appliquée ni à la base active ni à l'application
déployée. Le dépôt ne contient ni liaison `.vercel`, ni `vercel.json`, ni
workflow de déploiement permettant de promouvoir dans ce chat la même version
que le schéma. Appliquer seulement la migration aurait laissé l'ancien code
face à `observations`, ce qu'ADR-090 interdit. Supabase distant a donc été laissé
intact volontairement.

**Date, HEAD et branche.** Travail effectué le 20/08/2026 sur `master`, HEAD
`016cf31c11f5b8b862117bd19dc2b9a3e84a1466`. Aucun commit, push ou déploiement
n'a été créé.

**Worktree complet.** Il était déjà non propre. Les écarts utilisateur du lot 0
ont été préservés : `AGENTS.md`, `ARCHITECTURE_DECISIONS.md` et `PRODUCT.md`
modifiés, `README.md` supprimé, `docs/architecture/TWINY_MODEL.md` et le présent
document non suivis. Le lot 1 ajoute les changements sous `app/` décrits
ci-dessous. Le dernier `git status --porcelain=v1 --untracked-files=all` compte
164 chemins suivis modifiés ou supprimés sous `app/src/`, le nouveau
`app/src/lib/engine/observation.ts`, les cinq protocoles runtime, le schéma de
référence et la migration locale.

**Fichiers modifiés par le lot 1.** Le diff exact couvre tous les consommateurs
du contrat, sans alias :

- `app/supabase/schema.sql` ;
- `app/supabase/migrations/20260820093322_rupture_evidence_vers_observations.sql`
  créé par `supabase migration new` ;
- les cinq fichiers `app/data/00_instructions/00_SYSTEME_*.txt` ;
- `app/src/lib/domain/` (28 chemins suivis), dont `types.ts` et les contrats
  administrateur/référentiel ;
- `app/src/lib/store/` (17), dont `db.ts`, `supabase-backend.ts`, `context.ts` et
  `actions.ts` ;
- `app/src/lib/engine/` (39), avec suppression de `preuve.ts` et création de
  `observation.ts` ;
- `app/src/lib/tutor/` (17), `app/src/lib/documents/` (9),
  `app/src/lib/seed/exercises.ts` et les stockages UI ;
- les 41 composants et 10 pages/routes API qui consomment ou affichent ces
  données ;
- 40 fichiers de tests compris dans ces ensembles.

Les usages `Preuve` qui restent actifs désignent volontairement l'artefact brut
en amont : réponse/production, document `type: preuve`, snapshot et helpers
`construireDocumentProductionPreuve`/`estDocumentPreuve`. Ils ne désignent plus
les lignes structurées.

**Contrat local obtenu.** La collection est `observations`, le type
`SkillObservation`, la colonne de domaine `niveauObservation`, la table
`public.observations` et la colonne SQL `niveau_observation`. `charger_tout`
attend et renvoie uniquement la clé `observations`; le garde-fou RPC refuse
toute charge utile qui ne porte pas cette clé. `admin_comptes()` expose
`observations BIGINT`. Aucun seuil, coefficient ou branche métier du moteur
n'a changé.

**Migration locale.** Version CLI `20260820093322`, nom
`rupture_evidence_vers_observations`. Elle prend un verrou `ACCESS EXCLUSIVE`,
renomme la table, la colonne, les trois contraintes et les deux index, adapte
les trois fonctions actives, restaure leurs droits et compare dans la même
transaction comptes, bornes, orphelins et empreinte avant/après. Elle préserve
la définition distante réellement active de
`appliquer_commande_referentiel(...)`, qui comporte une dérive sans rapport
avec ce lot par rapport à `schema.sql`.

La migration n'a pas été exécutée sur une base locale : aucun projet Supabase
local/configuré n'est présent. Elle n'a pas été appliquée à distance et n'est
pas enregistrée dans l'historique distant. La dernière migration distante
reste `20260818135459_succession_ecriture_compte`.

**État Supabase distant constaté en lecture seule.** Projet
`vxkjzzshlqulexydgfpc`, PostgreSQL 17.6.1.147 :

| Mesure avant cutover | Valeur |
|---|---|
| relation active | `public.evidence` |
| relation future | absente |
| lignes | 52 |
| clés distinctes `(user_id, id)` | 52 |
| date minimale / maximale | `2026-07-25T10:28:48.579Z` / `2026-08-17T08:12:53.654Z` |
| `created_at` minimal / maximal | `2026-07-26 12:48:33.532677+00` / `2026-08-17 08:12:57.157109+00` |
| empreinte MD5 du tableau JSON ordonné | `d13a921a309fcaa4d1263c8193c60cd2` |
| orphelines de `profiles` / `competences` | 0 / 0 |

L'empreinte porte, dans cet ordre, `user_id`, `id`, `skill_code`, `date`,
`type`, `niveau_preuve`, `autonomie`, `qualite`, `resultat`, `contexte`,
`dimensions`, `competences_combinees`, `source`, `commentaire`, `created_at`.
Après cutover, la sixième valeur devra être lue dans `niveau_observation` et
l'empreinte devra rester strictement identique.

**Protections distantes avant cutover.** Propriétaire `postgres`, OID 17515,
RLS activée et non forcée, aucun trigger applicatif. Politique
`isolation_par_compte`, commande `ALL`, rôle `authenticated`, expression et
`WITH CHECK` : `(auth.uid() = user_id) AND compte_actif()`. Contraintes :
`evidence_pkey (user_id,id)`, `evidence_user_id_fkey` vers `profiles(id)` avec
suppression en cascade, `evidence_competence_fk` vers
`competences(user_id,code)`. Index : `evidence_pkey`,
`evidence_user_created_idx (user_id,created_at DESC)` et
`evidence_user_skill_idx (user_id,skill_code)`. Les ACL de table accordent les
droits existants à `postgres`, `anon`, `authenticated` et `service_role`; le
renommage conserve l'OID et ces ACL.

**Fonctions distantes avant cutover.** `charger_tout()` est `SECURITY INVOKER`,
`search_path = public, pg_temp`, lit `evidence` et renvoie la clé `evidence`.
`appliquer_commande_referentiel(text,integer,text,text,jsonb)` est
`SECURITY INVOKER`, `search_path = ''`, et consulte `public.evidence`.
`admin_comptes()` est `STABLE SECURITY DEFINER`,
`search_path = public, pg_temp`, contrôle `est_admin()`, lit `evidence` et
retourne `preuves BIGINT`. Pour les trois, `PUBLIC` et `anon` n'ont pas
`EXECUTE`; `authenticated` et `service_role` l'ont. La migration conserve ces
caractéristiques, y compris après le `DROP/CREATE` nécessaire à la colonne OUT
de `admin_comptes()`.

**Vérifications locales.** Résultats obtenus :

- tests ciblés store/RPC, état, maîtrise, historique indirect, recommandations,
  impact, projections documentaires et contexte tuteur : 8 fichiers, 193 tests,
  tous réussis ;
- `npm run test --workspace=app` : 83 fichiers, 1 225 tests réussis ;
- `npm run verify --workspace=app` : réussi, TypeScript et ESLint sans erreur,
  puis 1 225 tests réussis ; cinq avertissements ESLint préexistants hors lot
  restent signalés ;
- `npm run build --workspace=app` : build Next.js 16.3.0 réussi, 28 pages
  statiques générées ;
- recherches actives : aucun `SkillEvidence`, `NiveauPreuve`, `niveauPreuve`,
  `QualitePreuve`, `QUALITE_PREUVE`, accès `.from("evidence")`, collection ou
  clé RPC `evidence` sous `app/src/` et `app/supabase/schema.sql` ;
- `git diff --check` : aucune erreur, seulement les avertissements LF/CRLF du
  worktree Windows.

**Advisors Supabase.** Ils ont été exécutés sur l'état distant *avant* cutover,
donc ce ne sont pas des contrôles post-migration. Sécurité : quatre avertissements
existants — exécution authentifiée de trois fonctions `SECURITY DEFINER`
(`admin_comptes`, `compte_actif`, `est_admin`) et protection contre les mots de
passe compromis désactivée. Performance : deux clés étrangères non indexées,
sept politiques avec réévaluation `auth.*` — dont celle de `evidence` —, quatre
index inutilisés et deux politiques permissives `SELECT` sur `profiles`. Aucun
de ces avis n'a été corrigé : ils sont hors périmètre et préexistent au lot.
Remédiations Supabase : [fonctions `SECURITY DEFINER`](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
[clés étrangères non indexées](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys),
[plans d'initialisation RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan),
[index inutilisés](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
et [politiques permissives multiples](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
Relancer les deux advisors après le cutover.

**Déploiement applicatif.** Non effectué. Le seul remote Git visible est
`origin` sur GitHub ; aucun artefact/version applicative déployable n'a été
identifié depuis ce worktree non commité. La reprise doit préparer une version
applicative déployable, ouvrir une fenêtre de maintenance, confirmer l'absence
d'écriture, appliquer la migration, promouvoir immédiatement l'application,
puis effectuer les contrôles de données, RPC, RLS et parcours réels avant de
lever la maintenance.

**Rollback coordonné préparé.** Ne pas créer de migration inverse. Si le
cutover échoue : maintenir les écritures coupées, exécuter le SQL ci-dessous,
promouvoir la révision applicative antérieure identifiée avant la fenêtre,
vérifier le parcours et seulement ensuite lever la maintenance.

```sql
BEGIN;

LOCK TABLE public.observations IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE twiny_lot1_rollback_audit AS
SELECT
  count(*) AS total,
  count(DISTINCT (o.user_id, o.id)) AS distinct_keys,
  min(o.date) AS min_date,
  max(o.date) AS max_date,
  min(o.created_at) AS min_created_at,
  max(o.created_at) AS max_created_at,
  md5(coalesce(jsonb_agg(
    jsonb_build_array(
      o.user_id, o.id, o.skill_code, o.date, o.type, o.niveau_observation,
      o.autonomie, o.qualite, o.resultat, o.contexte, o.dimensions,
      o.competences_combinees, o.source, o.commentaire, o.created_at
    ) ORDER BY o.user_id, o.id
  )::TEXT, '[]')) AS fingerprint_md5
FROM public.observations o;

ALTER TABLE public.observations RENAME TO evidence;
ALTER TABLE public.evidence RENAME COLUMN niveau_observation TO niveau_preuve;
ALTER TABLE public.evidence
  RENAME CONSTRAINT observations_pkey TO evidence_pkey;
ALTER TABLE public.evidence
  RENAME CONSTRAINT observations_user_id_fkey TO evidence_user_id_fkey;
ALTER TABLE public.evidence
  RENAME CONSTRAINT observations_competence_fk TO evidence_competence_fk;
ALTER INDEX public.observations_user_created_idx
  RENAME TO evidence_user_created_idx;
ALTER INDEX public.observations_user_skill_idx
  RENAME TO evidence_user_skill_idx;

DO $rollback$
DECLARE definition_active TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.appliquer_commande_referentiel(text,integer,text,text,jsonb)'::regprocedure
  ) INTO definition_active;
  definition_active := replace(
    definition_active, 'public.observations', 'public.evidence'
  );
  IF position('public.observations' IN definition_active) > 0
     OR position('public.evidence' IN definition_active) = 0 THEN
    RAISE EXCEPTION 'Rollback de appliquer_commande_referentiel invalide.';
  END IF;
  EXECUTE definition_active;
END;
$rollback$;

DO $rollback$
DECLARE definition_active TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.charger_tout()'::regprocedure)
  INTO definition_active;
  definition_active := replace(definition_active, 'observations', 'evidence');
  IF position('observations' IN definition_active) > 0
     OR position('evidence' IN definition_active) = 0 THEN
    RAISE EXCEPTION 'Rollback de charger_tout invalide.';
  END IF;
  EXECUTE definition_active;
END;
$rollback$;

DO $rollback$
DECLARE definition_active TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.admin_comptes()'::regprocedure)
  INTO definition_active;
  definition_active := replace(
    definition_active, 'observations bigint', 'preuves bigint'
  );
  definition_active := replace(
    definition_active, 'public.observations', 'public.evidence'
  );
  IF position('observations bigint' IN definition_active) > 0
     OR position('public.observations' IN definition_active) > 0
     OR position('preuves bigint' IN definition_active) = 0
     OR position('public.evidence' IN definition_active) = 0 THEN
    RAISE EXCEPTION 'Rollback de admin_comptes invalide.';
  END IF;
  DROP FUNCTION public.admin_comptes();
  EXECUTE definition_active;
END;
$rollback$;

REVOKE ALL ON FUNCTION public.appliquer_commande_referentiel(
  TEXT, INTEGER, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appliquer_commande_referentiel(
  TEXT, INTEGER, TEXT, TEXT, JSONB
) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_comptes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_comptes()
  TO authenticated, service_role;

DO $verification$
DECLARE
  avant RECORD;
  apres RECORD;
BEGIN
  SELECT * INTO avant FROM twiny_lot1_rollback_audit;
  SELECT
    count(*) AS total,
    count(DISTINCT (e.user_id, e.id)) AS distinct_keys,
    min(e.date) AS min_date,
    max(e.date) AS max_date,
    min(e.created_at) AS min_created_at,
    max(e.created_at) AS max_created_at,
    md5(coalesce(jsonb_agg(
      jsonb_build_array(
        e.user_id, e.id, e.skill_code, e.date, e.type, e.niveau_preuve,
        e.autonomie, e.qualite, e.resultat, e.contexte, e.dimensions,
        e.competences_combinees, e.source, e.commentaire, e.created_at
      ) ORDER BY e.user_id, e.id
    )::TEXT, '[]')) AS fingerprint_md5
  INTO apres
  FROM public.evidence e;

  IF apres IS DISTINCT FROM avant THEN
    RAISE EXCEPTION 'Conservation invalide au rollback. Avant: %, apres: %',
      avant, apres;
  END IF;
  IF to_regclass('public.observations') IS NOT NULL THEN
    RAISE EXCEPTION 'public.observations existe encore après rollback.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evidence'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS inactive ou public.evidence absente.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'evidence'
      AND policyname = 'isolation_par_compte'
  ) THEN
    RAISE EXCEPTION 'Politique isolation_par_compte absente.';
  END IF;
END;
$verification$;

COMMIT;
```

Après ce SQL, recalculer aussi les deux comptes d'orphelines et contrôler les
ACL, signatures, `SECURITY DEFINER/INVOKER`, `search_path`, droits `EXECUTE`,
clé RPC `evidence` et compteur `preuves`. En cas d'échec SQL, la transaction
doit être abandonnée ; ne pas tenter un rollback partiel.

**Écarts et risques restants.** La migration n'a encore été exécutée sur aucun
PostgreSQL de test ou de production. Les mesures « après » n'existent donc pas.
Le cutover doit vérifier les écritures concurrentes, disposer d'une révision
applicative promouvable et d'une révision antérieure restaurable, puis tester
les trois RPC et les accès RLS avec des comptes autorisé/non autorisé. Les avis
Supabase sont seulement le baseline avant changement. La dérive distante de
`appliquer_commande_referentiel` est volontairement préservée, pas résolue.

**Aucune décision nouvelle.** Le lot applique ADR-090 et ne promeut aucun
statut. Il ne commence ni provenance, ni transaction, ni validation générale,
ni `competence_domaines`, ni carte.

**Continuation exacte du lot 1.** Reprendre ce même lot, relire les documents
canoniques et cette entrée, inspecter le worktree sans écraser les changements,
préparer une révision applicative déployable et sa révision de rollback,
revalider le baseline distant, ouvrir une maintenance avec absence d'écriture,
appliquer `20260820093322_rupture_evidence_vers_observations.sql`, déployer
immédiatement l'application correspondante, puis vérifier conservation,
contraintes/index/ACL/RLS, les trois RPC, les parcours app et les advisors.
Seulement si tout est vert, marquer le lot 1 terminé et rédiger le prompt du lot
2. Ne pas implémenter le lot 2 dans cette continuation.

**Modèle recommandé pour la continuation.** `gpt-5.6-sol`, effort `xhigh`.

### Passage de relais — lot 1 terminé — 20/08/2026

**État réel : lot 1 terminé.** Le cutover coordonné a été exécuté sur le projet
Supabase `vxkjzzshlqulexydgfpc`, puis l'application correspondante a été
déployée. Aucun rollback n'a été appliqué. La révision antérieure reste
`016cf31c11f5b8b862117bd19dc2b9a3e84a1466` ; la rupture a été livrée par
`500a002d4acd5b9ed2cdc5d3e64a18e7dad6c123`, puis le correctif de double
soumission décrit ci-dessous par
`0a6a26e6198aa2e636588ad43093ac2f15bcb793`.

**Migration distante.** Le fichier local reste
`app/supabase/migrations/20260820093322_rupture_evidence_vers_observations.sql`.
Supabase a enregistré la version effective
`20260820102026_rupture_evidence_vers_observations`. Juste avant l'opération :
52 lignes, 52 clés distinctes, empreinte
`d13a921a309fcaa4d1263c8193c60cd2`, zéro orpheline et aucune écriture, session
active ou verrou concurrent sur la relation. Juste après : mêmes 52 lignes,
mêmes 52 clés, mêmes bornes, même empreinte et zéro orpheline. L'OID 17515, le
propriétaire `postgres`, les ACL, la politique `isolation_par_compte`, RLS, les
contraintes et les index ont été conservés ou renommés comme prévu.

**Contrat RPC et autorisation après cutover.** `charger_tout()` rend la clé
`observations` et jamais `evidence` ; `admin_comptes()` rend le compteur
`observations` et jamais `preuves` ;
`appliquer_commande_referentiel(text,integer,text,text,jsonb)` lit
`public.observations`. Les propriétés `SECURITY INVOKER/DEFINER`, `search_path`
et droits `EXECUTE` correspondent au baseline. Sous rôle `authenticated`, le
compte propriétaire a vu exactement ses 52 observations et zéro observation
d'un autre compte ; un membre sans observation en a vu zéro et l'appel à
`admin_comptes()` lui a été refusé ; l'administrateur a vu les 8 comptes et le
total de 52 observations.

**Déploiements.** La rupture a été déployée en Production à 10:21:19 UTC. Le
correctif final a été déployé à 10:44:23 UTC, déploiement GitHub `6000627952`,
sur `https://systeme-pedagogique-23f9nlzdx-ow-team-gang.vercel.app`; l'URL
canonique reste `https://systeme-pedagogique-nine.vercel.app`. Les deux statuts
Vercel sont `success`.

**Parcours réels.** Sans session, `/`, `/progression`, `/competences` et
`/admin` redirigent vers `/login`; la page de connexion répond 200. Avec le
compte administrateur réel : tableau de bord chargé, progression chargée avec
52 observations, référentiel chargé via l'Atelier, panneau administrateur
chargé avec 8 comptes et 52 observations, sans erreur console. Une clôture
réelle a ensuite produit une tentative `terminee`, une Observation A et une
séance terminée. L'état final constaté à 10:45:40 UTC est de 53 observations,
53 clés distinctes, zéro orpheline de compte ou de compétence,
`public.observations` présente et `public.evidence` absente.

**Incident de parcours et correction.** Un unique clic sur « Commencer » avait
créé deux séances identiques à trois secondes d'intervalle : l'une terminée par
le parcours, l'autre restée `en-cours`. Le démarrage focus créait
inconditionnellement une nouvelle séance. Il réutilise désormais la séance en
cours que `seanceEnCoursPour` résout pour l'exercice ; deux appels convergent
donc vers le même identifiant. Le test de régression couvre la réutilisation et
la création nominale. Les deux lignes produites avant correction restent en
base : aucune donnée utilisateur n'a été supprimée silencieusement. Le tableau
de bord expose la ligne résiduelle comme séance à reprendre. Ce défaut était
présent dans la révision antérieure et le patch ne change ni le moteur ni le
contrat Observation.

**Vérifications finales.** Tests ciblés : 2 fichiers, 53 tests réussis. Suite
complète : 84 fichiers, 1 227 tests réussis. `npm run verify --workspace=app`
réussi avec zéro erreur et les cinq avertissements ESLint préexistants.
`npm run build --workspace=app` réussi, 28 pages générées. `git diff --check`
réussi hors avertissements de conversion LF/CRLF du worktree Windows.

**Advisors post-cutover.** Sécurité : les quatre avis préexistants restent
l'exécution authentifiée de trois fonctions `SECURITY DEFINER` et la protection
contre les mots de passe compromis désactivée. Performance : deux clés
étrangères non indexées, sept `auth_rls_initplan` — la cible est maintenant
`observations` —, quatre index inutilisés et les politiques permissives
multiples sur `profiles`. Les catégories et comptes sont inchangés ; aucun avis
hors périmètre n'a été corrigé.

**Aucune décision nouvelle.** Ce lot exécute ADR-090 sans promouvoir le statut
d'une brique. Il n'ajoute ni provenance exacte, ni transaction de clôture, ni
validation Supabase générale, ni `competence_domaines` au RPC. Ces travaux
restent exclusivement ceux du lot 2.

**Prochain lot exact.** Exécuter uniquement le lot 2 « Provenance, transaction,
validation et chargement » décrit plus haut : faire pointer chaque Observation
nouvelle vers sa source exacte sans réécrire les 52 lignes historiques, rendre
la clôture atomique, valider les données Supabase avant leur entrée dans le
moteur et intégrer `competence_domaines` au chargement. Ne commencer ni carte
globale, ni overlay, ni objectif structuré, ni état persisté, ni bascule UI.
