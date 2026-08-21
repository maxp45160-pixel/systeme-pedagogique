# Propositions de résolution des ADR non résolues

**21/08/2026. Document de proposition — aucun statut promu.**

Conformément à la règle 4 du registre (« aucune analyse produite par une
session d'agent ne devient ✅ sans validation humaine explicite »), tout ce
qui suit reste une **recommandation**. Maxime tranche ; seule sa validation
écrit un statut dans `ARCHITECTURE_DECISIONS.md`.

Méthode : pour chaque ADR ouverte, l'état réel du code a été vérifié en
lecture seule le 21/08/2026, puis classée selon trois destins possibles :

- **A. Clôturer maintenant** — l'implémentation existe et est testée ; la
  promotion ne demande qu'une validation humaine ;
- **B. Garder ouverte, close par l'usage** — la question se répond par des
  données que seul un tour de boucle réel produira ; un test de réfutation
  précis est rappelé ;
- **C. Reporter explicitement** — rien n'est construit et rien ne l'exige ;
  l'assumer évite qu'une hypothèse dormante ressemble à un chantier prévu.

---

## Partie A — clôtures proposées immédiatement

| ADR | Sujet | État vérifié dans le code | Recommandation |
|---|---|---|---|
| [011](../../ARCHITECTURE_DECISIONS.md#adr-011) ❓ | Conservation de l'objet `Exercise` | La calibration (ADR-028) dérive difficulté et dimension faible d'`indicesUtilises`, `dureeMin`, `autoEvaluation` — signaux que seule l'exécution structurée d'un exercice produit. La RPC `clore_exercice` (lot 2) en a fait la frontière transactionnelle du produit. | **Conserver**, clore en ✅. Le test envisagé (« comparer preuves d'exercice vs conversation ») n'a jamais pu tourner faute de volume ; entre-temps l'exercice est devenu structurellement porteur. |
| [042](../../ARCHITECTURE_DECISIONS.md#adr-042) 🔬 | Maîtrise = prédicat dérivé | `lib/engine/maitrise.ts` (`evaluerMaitrises`) calcule à la lecture depuis les états, sans seuil propre ni stockage ; consommé par le contexte tuteur et les vues. | Clore en ✅ si l'affichage « maîtrisé / non maîtrisé » te paraît juste à l'usage. Aucun code restant. |
| [044](../../ARCHITECTURE_DECISIONS.md#adr-044) 🔬 | Un référentiel se révise | `/api/referentiel/reviser` + gouvernance transactionnelle (`referentiel_changes`, versions optimistes) ; retraits toujours dérivés (ADR-027). | Clore en ✅ : le mécanisme demandé existe entièrement. |
| [055](../../ARCHITECTURE_DECISIONS.md#adr-055) 🔬 | Thème = portée modulaire | `PorteeSeance`, `ModaleTheme`, `urlCompositionTheme` — et ADR-075 s'appuie explicitement dessus. | Clore en ✅. |
| [064](../../ARCHITECTURE_DECISIONS.md#adr-064) 🔬 | Workspace documentaire Markdown | L'Atelier documentaire est en production et constitutive du parcours quotidien depuis le 12/08. | Clore en ✅ si tu confirmes l'usage réel. C'est la seule de cette liste qui demande un jugement d'usage, pas une lecture de code. |
| [065](../../ARCHITECTURE_DECISIONS.md#adr-065) 🔬 | Gouvernance transactionnelle | Migrées le 13/08 sur autorisation explicite (PRODUCT.md le consigne) ; complétées par la succession (18/08) et ADR-081. | Clore en ✅ — PRODUCT.md dit déjà « migrés sur autorisation explicite ; le statut n'est pas monté par l'agent ». Ce document est l'endroit où la monter, avec ta validation. |
| [069](../../ARCHITECTURE_DECISIONS.md#adr-069) 🔬 | L'agent écrit le réversible + journal d'actions | Le journal d'actions n'a jamais existé en production ; sa contrepartie fonctionnelle est désormais assurée ailleurs : frontière transactionnelle `clore_exercice` (lot 2) et append-only des Observations avec purge contrôlée (lot 7). | Marquer 🔄 **remplacée par ces deux mécanismes**. L'idée (réversibilité explicite des écritures agent) survit dans eux. |
| [083](../../ARCHITECTURE_DECISIONS.md#adr-083) 🔬 | Famille de situation ≠ titre | `lib/engine/contexte-situation.ts` (`construireCatalogueSituation`, `attacherFamilles`), branché sur données brutes dans `context.ts`, testé. | Clore en ✅ après confirmation d'usage. |
| [085](../../ARCHITECTURE_DECISIONS.md#adr-085) 🔬 | Le moteur se relit, ajuste un seuil à la fois | Migrations `journal_moteur` + `journal_reglages`, `lib/engine/reglages.ts` (`reglagesEffectifs`), consommation réelle dans `context.ts`. | Clore en ✅. |
| [087](../../ARCHITECTURE_DECISIONS.md#adr-087) 🔬 | Scission sèche, plusieurs successeurs | Posée en SQL le 18/08 (`competence_succession`, `remplacer_competence`, `referentiel_codes_emis`) — visible dans `schema.sql` §12. | Clore en ✅. |

## Partie B — garder ouvertes, closes par l'usage uniquement

Aucune de celles-ci ne peut être tranchée par analyse. Le gel de nouvelles
fonctionnalités décidé le 21/08 rend leur test enfin possible.

| ADR / sujet | Test de réfutation qui la clos | Déclencheur |
|---|---|---|
| [005](../../ARCHITECTURE_DECISIONS.md#adr-005) 🔬 | À couverture > ~50 % du périmètre actif, les facteurs secondaires doivent diversifier les justifications. Sinon, le barème se rouvre. | Relancer le relevé de justifications après ~10 boucles réelles. |
| [034](../../ARCHITECTURE_DECISIONS.md#adr-034) / [035](../../ARCHITECTURE_DECISIONS.md#adr-035) / [040](../../ARCHITECTURE_DECISIONS.md#adr-040) / [045](../../ARCHITECTURE_DECISIONS.md#adr-045) / [047](../../ARCHITECTURE_DECISIONS.md#adr-047) 🔬 | Toutes portent sur le cycle de vie de l'exercice en conditions réelles (échec revient-il ? correction sur exercice à preuves ? confirmation de difficulté ?). | Après ~10 exercices tuteur générés **et menés au bout** (pas abandonnés à la minute). |
| Barème `PLAFOND_AIDE` (P8, 🔬) | Les réponses « aide extérieure » du bilan s'accumulent-elles conformément aux paliers A2/A1/A0 posés ? | Revue après ~20 bilans renseignés. Ne pas modifier les seuils avant. |
| Moteur gratuit exact (ADR-007 ❓) | « Résolu par mesure » — la mesure existe désormais (jetons comptés par moteur dans le chat) mais n'a jamais été consignée comme décision. | Consigner le relevé après ~10 sessions ; disqualifier au-delà d'une violation de protocole. |

## Partie C — reporters explicitement

| ADR | Sujet | Recommandation |
|---|---|---|
| [082](../../ARCHITECTURE_DECISIONS.md#adr-082) 🔬 | Relation proposée, domaine cible arbitré | Rien d'incohérent n'est construit, rien ne l'appelle tant que la carte globale est vide. Garder 🔬 dormant avec mention « reporté jusqu'à contenu de carte ». |
| [084](../../ARCHITECTURE_DECISIONS.md#adr-084) 🔬 | Décision et prédiction comme faits datés | Rien construit, rien exigé. Reporter sans date — « ne pas construire par anticipation » s'applique littéralement. Envisager 🗑️ si rien ne survient d'ici fin 2026. |
| [088](../../ARCHITECTURE_DECISIONS.md#adr-088) 🔬 | Un domaine n'est pas un thème | ⚠️ Obsolète de fait : la table `themes` a été supprimée le 21/08 (`suppression_themes`). La question se reformulera si les thèmes reviennent sous une autre forme. Proposer 🗑️ écartée avec cette raison. |
| [086](../../ARCHITECTURE_DECISIONS.md#adr-086) 🔬 | Atomicité au schéma ; référentiel autodétecté | Demi-clos par le lot 2 (`clore_exercice` atomique + triggers). La moitié « référentiel se détecte seul » n'est pas vérifiée. Soit scinder l'ADR en deux, soit la garder 🔬 pour la moitié restante. |

---

## Résumé de décision demandé

Pour clore ce document, il suffit d'un arbitrage en quatre lignes :

1. **Partie A** : valider (ou rejeter) chaque promotion → j'écris les statuts
   dans le registre dans le même commit que toute retouche de code associée.
2. **Partie B** : confirmer le gel — ces questions se répondent en utilisant
   l'application, pas en la modifiant.
3. **Partie C** : valider reports et l'🗑️ proposé pour ADR-088.
4. Décision séparée déjà identifiée : catalogue global (`GO contenu` +
   curateur) — prérequis de toute vie pour ADR-082.
