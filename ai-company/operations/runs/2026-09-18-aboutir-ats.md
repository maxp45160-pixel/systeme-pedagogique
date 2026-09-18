# P01-0008 — Restitution ATS utilisable sous contrôle ciblé

## Résultat observé

Analyse finale 10272723-b7ed-42c7-844e-6ad7608e5f05, tentative 8fda5f3a-822e-4a9a-afba-4d7b18da3a7e : terminée le 18/09 à 17:31:50 UTC. Les 13 pages du vrai livret ATS sont conservées, avec 3 éléments de synthèse et 16 propositions de compétences. Le domaine proposé est mathématiques générales, étayé par l’introduction du livret, sans rattachement à Qualité.

L’interface à localhost:3000/app?depot=depot-7119baf3ddf77ecb24bcf980e6bbd319 affiche ce résultat après rechargement, fermeture et réouverture. Les sources se déplient avec leurs pages PDF. Le choix humain Mathématiques reste visible et conservé, marqué à confirmer. Aucune action Appliquer ce choix effectuée ; cases proposées cochées par défaut ne signifient pas acceptation humaine.

QA indépendante : résultat utilisable pour contrôle humain ciblé. Factoriser expressions algébriques cite l’exercice 2 de la page 4 et un exemple de facteur commun. L’erreur composée fondée sur un produit et les triples doublons d’identités remarquables ne figurent plus dans cette liste.

Réserves explicites : Décrire propriétés des vecteurs demeure trop générique, avec une citation demandant un calcul de coordonnées ; à préciser ou écarter lors du contrôle. Certaines justifications élargissent le geste décrit (normes avec coordonnées, inéquations avec équations). La liste ne démontre pas une extraction exhaustive ni l’atomicité pédagogique de toutes les propositions. La clôture technique n’est pas une validation humaine du référentiel ou du produit.

## Corrections conservées

- JSON Schema strict pour Mistral V1/V2 : bornes métier importées, passages et références limités aux enums réels ; Qwen conserve JSON object. Le corps complet est borné avant réservation. Les validations métier restent obligatoires, sans troncature ou correction silencieuse d’une valeur invalide.
- Version du schéma dans le devis ; anciens devis invalidés avant réservation, réussites historiques reconnues et transcriptions réutilisées. Aucune réouverture ne relance un appel payant.
- Verbes factoriser et simplifier ajoutés à l’enum partagé, absents alors que le livret les demande. Les seuils, le protocole et les règles de coordination restent inchangés.
- Consignes de couverture, gestes observables, témoin précis, recouvrements et cohérence du domaine explicitées. Contre-exemples terminologiques généraux après confusions observées, sans imposer une liste ATS au modèle.
- Diagnostic HTTP précis, top_p=1 explicite avec temperature=0. Mode none conservé après deux échecs length en mode high ; aucune hausse de borne. Le parseur accepte aussi les chunks text, ignore thinking et refuse les autres types ; seuls les résultats finaux sont persistés. Coûts rapprochés avant rejet.

Sources techniques consultées : [API Mistral](https://docs.mistral.ai/api/endpoint/chat), [exemple officiel de schéma](https://github.com/mistralai/client-python/blob/main/examples/mistral/chat/structured_outputs_with_json_schema.py), [format des chunks](https://docs.mistral.ai/studio/conversations/reasoning).

## Essais et budget

Mandat : [accord courant](2026-09-18-aboutir-ats-mandat.md). Plafond cumulé 10 €, y compris coûts antérieurs et réservations incertaines. Baseline : 1,444517 €, dont 0,299466 € non rapprochés. Devis de chaque reprise : maximum 0,422880 €, contrôlé avant lancement. Aucun OCR supplémentaire.

| Essai | Résultat | Coût prudent additionnel |
| --- | --- | --- |
| 1 — f7b98117 / 646f5271 | Schéma accepté, 21 propositions ; omissions et confusions pédagogiques | 0,143145 € |
| 2 — 202cc175 / 92ad25b2 | Consigne générique, 23 propositions ; défauts sémantiques persistants | 0,144396 € |
| 3 — 3dc404f5 / 8c4f69f7 | HTTP 400 : top_p doit valoir 1 avec échantillonnage greedy | réservation 0,406788 € conservée |
| 4 — 3dc404f5 / f70f45f5 | Raisonnement high, refus length à 8 192 jetons | 0,202722 € |
| 5 — 3dc404f5 / 102f289c | Raisonnement raccourci demandé, encore length ; mode abandonné | 0,203016 € |
| 6 — b198dea1 / 4db16624 | Mode direct et enum corrigé, 21 propositions ; factorisation rétablie | 0,131502 € |
| 7 — 10272723 / b8698b32 | Nouveau domaine sans compétence nouvelle rattachée : refus métier | 0,130167 € |
| 8 — 10272723 / 8fda5f3a | Succès final, 16 propositions contrôlables | 0,120864 € |

Cumul final : **2,927117 € prudents**, dont **2,220863 € rapprochés** et **0,706254 € de réservations non rapprochées**. Le travail de cette mission ajoute 1,482600 € prudents. 20 opérations avant et après rechargement/réouverture : aucune nouvelle dépense liée à la consultation. Le plafond applicatif du pilote reste à 5 €/mois. Aucun remboursement inventé.

Les essais explicites 2 à 8 utilisent un banc HTML local temporaire, appelant GET devis puis POST sur la route authentifiée existante avec consentement, reprise et analyse source identifiée. Aucun secret copié, aucun contournement d’authentification ou quota. Banc supprimé et onglet fermé après vérification ; onglet Twiny conservé.

## Intégrité et vérifications

Document : depot-7119baf3ddf77ecb24bcf980e6bbd319. MD5 contenu_md a3a0c6e087678cd87fc0d2598c5d7d20 et frontmatter e365b85d685850da17ee7bdd8382ce17 identiques avant/après ; updated_at demeure le 15/09 à 21:57:24.784065 UTC. Le brouillon reste lié à cafc3136-d39e-49ef-9861-8565c9f32072, domaine Mathématiques, usage continu, codes vides, indices antérieurs 0/1. Les anciennes sélections ne sont pas réinterprétées sur la nouvelle liste.

Tests ciblés exécutés : schéma, fournisseur, traduction de sources, orchestration, atomicité et budget de contexte passent. TypeScript et ESLint ciblé passent. Revues CTO sans défaut bloquant : schéma, réservation, reprise/historiques, parseur. Limites de maintenance : Ajv est déjà verrouillé via ESLint et utilisé seulement en test ; le schéma ne remplace pas les contrôles métier des espaces ou du comptage UTF-16.

Les vérifications globales finales, leur résultat et le snapshot exact sont portés par P01-0008.json. Aucun succès n’est présumé avant leur exécution. Base Git 1c7588e6a0e034681047e067906cadc09b4c91cd, avec diff local partagé préservé. PRODUCT et ADR-086/143 synchronisés. Pas de migration, dépendance installée, permission, publication ni déploiement ; effets distants limités aux analyses documentaires et à leur comptabilité autorisées.


Dernier défaut corrigé sans appel payant : le validateur documentaire imposait encore au moins une compétence nouvelle pour un nouveau domaine. Cette garde contredisait l’accord P01-0002 du 16/09 (domaine d’organisation sans compétence obligatoire). Retrait ciblé de cette seule garde ; citations, collisions, enum et domaine principal unique restent contrôlés. Tests acceptation domaine seul, refus citation inventée et autre domaine nouveau ; régressions de délégation exécutées. La consigne est alignée : ne pas fabriquer une compétence pour autoriser un classement. Le résultat ATS enregistré (16 propositions) reste valide ; aucune réanalyse nécessaire pour ce retrait de blocage.
