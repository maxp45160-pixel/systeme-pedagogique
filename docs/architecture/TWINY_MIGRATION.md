# Twiny — repères de migration et retraits

Ce document conserve les correspondances et réserves des vérifications des
20–29/08/2026. **Ce sont des constats datés, pas un état distant revérifié le
15/09.** Consulter la base réelle avant toute opération ; la présence d'un
fichier local ne prouve pas son application et ne justifie jamais un rejeu.

Les contrats courants vivent dans [les ADR](../../ARCHITECTURE_DECISIONS.md)
et [ENGINE_CONTRACTS](../../ENGINE_CONTRACTS.md). Le plan global reste une
fondation expérimentale dont la composition a été retirée le 30/08 ; le
pilote documentaire et l'assistant ont leurs registres actifs dans
[le pilote](../pilotes/DEPOT_DOCUMENTAIRE.md) et
[l'assistant](../design/ASSISTANT_ENTREE_REFERENCE.md).

## Correspondances historiques à conserver

Les versions ci-dessous ont été rapportées comme appliquées lors des
vérifications datées. Elles ne sont pas des instructions d'exécution.

| Migration locale ou opération | Version distante / issue documentée |
|---|---|
| `20260820093322_rupture_evidence_vers_observations.sql` | `20260820102026_rupture_evidence_vers_observations` ; rupture terminée le 20/08, conservation des observations historiques. |
| Provenance, transaction et chargement du lot 2 | `20260820124601_twiny_lot_2_provenance_transaction_chargement`, puis `20260820130527_activer_frontiere_cloture_lot_2`. |
| `20260820134723_twiny_lot_3_carte_globale_overlay_minimal` | Même version ; carte ensuite retirée, voir ci-dessous. |
| `20260820161556_twiny_lot_4_objectifs_evenements_parcours.sql` | `20260820143159_twiny_lot_4_objectifs_evenements_parcours` ; lot ensuite retiré. |
| `20260820164500_twiny_lot_4_fk_indexes.sql` | `20260820143613_twiny_lot_4_fk_indexes`. |
| `20260820170000_twiny_lot_4_cibles_strictes.sql` | `20260820144539_twiny_lot_4_cibles_strictes`. |
| `20260820190000_twiny_lot_7_correspondances_relations.sql` | Appliquée sous le nom `twiny_lot_7_correspondances_relations` ; version distante exacte non précisée dans le relevé. |
| `20260820193000_twiny_lot_7_observations_append_only.sql` | Appliquée sous le nom `twiny_lot_7_observations_append_only` ; version distante exacte non précisée dans le relevé. |
| `20260820194000_twiny_lot_7_admin_comptes_observations.sql` | Appliquée le 21/08 sous sa version locale ; ancien nom trompeur `remove_profile_legacy_objectives`. Ne supprime pas les objectifs textuels du profil. |
| `20260820213000_restaurer_domaine_active_perimetre`, `20260821000000_suppression_themes`, `20260821120000_retrait_objectifs_structures` | Registre réconcilié le 21/08 vers ces versions locales ; les entrées orphelines `20260821082640`, `20260821082808`, `20260821082848` ont été retirées. Ne pas répéter cette réparation. |
| `20260821175518_corriger_archivage_domaine` | Correctif d'archivage documenté le 21/08 ; vérifier le registre réel avant toute opération. |
| `20260821190000_retrait_carte_globale` | Application effective le 22/08, puis historique réparé. Tables et fonctions globales retirées ; `competence_succession` était déjà absente. |
| `20260822093000_index_fk_couvrants.sql` | Appliquée le 22/08 ; détails ci-dessous. |

La réconciliation du 21/08 a aussi corrigé `charger_tout()` en invoker avec
`search_path = public, pg_temp`. `appliquer_commande_referentiel` avait une
seule surcharge canonique, invoker avec `search_path = ''`. Ces résultats
historiques n'autorisent pas de modifier les fonctions courantes à l'identique.

## Retraits qui restent acquis

- Le lot 4 construit le 20/08 a été retiré le 21/08 : tables `objectifs`,
  `parcours`, `evenements` et leurs fonctions/code associés (ADR-096).
- La carte globale partagée et son overlay ont été retirés (ADR-099).
  Les propositions de catalogue ou de nomination d'un curateur ne sont plus
  des actions à reprendre.
- Les thèmes persistants ont été supprimés (ADR-104).
- La suppression des objectifs textuels du profil n'a pas été autorisée par
  le renommage de la migration d'administration ; relire les consommateurs
  réels avant tout changement.

## État d'orchestration constaté le 29/08/2026

| Version locale | Objets constatés dans Supabase réel | Historique distant | Action |
|---|---|---|---|
| `20260828110000_interventions_seance.sql` | `public.sessions.interventions` (`jsonb`) | absente | ne pas rejouer ; réconcilier par le workflow d'infrastructure |
| `20260828120000_lot_3_acceptation_plan.sql` | `public.sessions.origine_proposition`, `public.orchestration_command_receipts`, `public.accepter_plan(text,jsonb)` | absente | ne pas rejouer ; réconcilier par le workflow d'infrastructure |
| `20260828150000_lot_5_revision_plan.sql` | `public.sessions.duree_planifiee_min`, sa contrainte et l'extension visible de `public.accepter_plan(text,jsonb)` | absente | ne pas rejouer ; provenance non inférable, réconcilier par le workflow d'infrastructure |
| `20260828201530_lot_9_contexte_declare.sql` | `public.profiles.periode_declaree`, `public.profiles.disponibilites_declarees` et leurs contraintes de forme | présente (`20260828201530`) | appliquée et vérifiée le 28/08/2026 ; la période est désormais inutilisée |
| `20260829155409_retirer_periode_declaree_inutile.sql` | suppression de `public.profiles.periode_declaree` et de sa contrainte | absente | préparée localement, non appliquée ; 1 valeur distante à perdre après autorisation |
| `20260828212423_corriger_intervalle_acceptation_plan.sql` | casts `DOUBLE PRECISION` remplacés dans les deux fonctions d'acceptation | présente sous `20260828212629` | appliquée, mais insuffisante : `sum(integer)` reste `BIGINT` |
| `20260829072035_corriger_somme_intervalle_acceptation_plan.sql` | cast explicite du résultat de `sum(integer)` avant `make_interval` | présente sous `20260829075048` | appliquée et vérifiée le 29/08/2026 |
| `20260829101500_corriger_idempotence_acceptation_plan.sql` | lecture idempotente du reçu sans verrou UPDATE incompatible avec sa RLS append-only | présente sous `20260829145745` | appliquée et vérifiée le 29/08/2026 |
| `20260829163836_memoriser_refus_proposition_plan.sql` | `public.refus_recommandations.proposition_ref` et sa contrainte de forme | absente | préparée localement, non appliquée ; autorisation requise avant exécution |
| `20260829190000_plan_acceptation_origine_cours.sql` | extension additive de `public.accepter_plan(text,jsonb)` pour conserver le blueprint d'un candidat de cours accepté | présente sous `20260829174131` | appliquée et vérifiée le 29/08/2026 dans la définition distante de la RPC |

La présence d'objets des lots 1, 3 et 5 ne constitue ni une nouvelle validation
produit ni une raison de rejouer une DDL : leur provenance reste inconnue. Le
lot 9, les corrections d'acceptation et la conservation du blueprint de cours
sont visibles à distance et possèdent chacune une entrée d'historique vérifiable
dans ce chantier. Toute correction de
l'historique doit être additive, tracée et autorisée séparément. La preuve
distante de sélection, de tout-ou-rien et de rejeu idempotent est passée ; la
correction reste additive et ne réécrit aucune migration historique.

### Décisions du 22/08/2026 — suite des advisors

**SECURITY DEFINER (4 WARN) — statu quo justifié.** Lecture des définitions :
- `est_admin(p_uid)` et `compte_actif(p_uid)` sont les helpers RLS du panel
  admin (`20260816112000_panel_admin_acces.sql`) : `REVOKE ... FROM PUBLIC,
  anon` puis `GRANT EXECUTE TO authenticated` y est **délibéré**, et des
  dizaines de politiques les appellent. Les révoquer casserait le cadre RLS.
- `admin_comptes()` est appelée en session authentifiée admin
  (`store/acces.ts`) et porte sa garde interne (`est_admin()` → exception
  42501 sinon) ; elle ne sort que compteurs et identité (P8).
- `purger_observations_compte()` est scellée sur `auth.uid()` : purge RGPD de
  ses propres observations.
Les quatre warnings sont donc des faux positifs assumés : la garde vit dans
le corps de la fonction, pas dans les grants.

**Mots de passe fuités (WARN) — impossible sans upgrade.** Activation tentée
via Management API (`password_hibp_enabled`) : refusée — fonctionnalité
réservée aux plans Pro+. À activer au passage en Pro, ou ignorer.

**FK sans index (2 INFO) — corrigé.** Migration
`20260822093000_index_fk_couvrants.sql` appliquée :
`comptes_acces_suspendu_par_idx` et `moteur_predictions_user_decision_idx`.
Un troisième warning `unused_index` apparaît ensuite sur ce nouvel index de
`comptes_acces` : compteur de lectures à zéro depuis sa création, il se
résorbera à l'usage.

### Retrait de `competences.hypothese_initiale` (22/08/2026)

Décision humaine : archiver puis dropper — la colonne n'était plus jamais
écrite depuis l'import initial. Les onze valeurs restantes (LOG-01..03,
PROD-01..04, PROD-06, STAT-01/02/05 — toutes « niveauSuppose 0-1 », cœur ou
domaine couvert du BUT QLIO) sont archivées verbatim dans l'en-tête de
`20260822090000_retrait_hypothese_initiale.sql`. Le statut moteur
« hypothese » (observation de niveau D sans preuve) est retiré avec elle :
une compétence sans observation est simplement non évaluée — invariant 3,
absence de preuve ≠ zéro, sans intermédiaire déclaratif. Code touché :
`types.ts` (champ + union du statut), `skill-state.ts`,
`contexte.ts` (marqueur « ?D »), `validation-supabase.ts`, fixture et tests.

