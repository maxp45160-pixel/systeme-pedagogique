# Utilité des rôles — mesures manuelles

Créé le 15/09/2026, après examen de la phase 8 conditionnelle.
État initial avant intégration native : **NON MESURÉ**. Les missions historiques
sont consignées ci-dessous ; l'utilité comparative et le coût restent non mesurés.
Les exercices de validation de cette V1 ne sont pas des observations d'utilité.

## Unité et registre

Une ligne par demande réelle : identifiant historique `USE-XXXX`, ou identifiant
de la [fiche V2](missions/README.md), sans deuxième numéro pour la même mission.
Les nouvelles réalisations conservent leur état dans cette fiche ; ce registre
en indexe les preuves. Plusieurs rôles consultés pour la même demande ne
comptent pas comme plusieurs tâches. Aucun tableau de bord ni collecte automatique.

| ID | Date | Demande / source durable | Rôles réellement consultés | Mode (session / isolé) | Résultat observable / preuve | Coût et surcharge connus |
|---|---|---|---|---|---|---|
| USE-0001 | 2026-09-15 | Collègues natifs et compte rendu demandés par Maxime ; [mandat](mandate.md) | QA, Product, Chief of Staff | Sous-agents natifs ; sélection explicite du profil pour Chief, profil lu sur instruction pour Product | Contradictions documentaires corrigées ; [analyse Product terminée](runs/2026-09-15-product-premiere-mission.md) ; guide relu par Chief | Coût/tokens/durée non mesurés ; une interruption Product pour limite d'usage, puis reprise réussie |
| USE-0002 | 2026-09-15 | Bilan Twiny, nettoyage et entrée libre ; alternatives après refus Alibaba, demandé par Maxime | Chief of Staff | Sous-agent natif, héritage ; recherche fournisseurs par le coordinateur | Relevé Git `60c8617`, registres pilote et historique des tâches confrontés ; sources officielles Mistral et Gemini consultées | Usage attribuable et durée non mesurés ; aucun appel fournisseur payant |
| USE-0003 | 2026-09-15 | Continuer avec Mistral, demande de Maxime | QA | Sous-agent natif hérité ; UI par coordinateur | Résultats, reprises et clôture dans la fiche USE-0003 ci-dessous et le [pilote](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md#reprise-mistral--15092026) | Usage agent inconnu ; coût documentaire distinct, détaillé dans le pilote |
| USE-0004 | 2026-09-15 | Avis sur assistant et priorités | Product, CTO, QA | Sous-agents natifs hérités | Fiche USE-0004 ci-dessous | Inconnu |
| USE-0005 | 2026-09-15 | Réalisation du parcours assistant | CTO, Product, QA | Sous-agents natifs hérités | État et preuves dans la fiche USE-0005 ci-dessous, tenue par sa tâche propriétaire | Inconnu |
| USE-0006 | 2026-09-15 | Audit du système d'agents demandé par Maxime ; [rapport](runs/2026-09-15-audit-autonomie.md) | CTO, QA | Sous-agents natifs, héritage | Manques d'autonomie, mémoire et évaluation établis ; contrôleur documentaire et ses 6 tests passent | Deux délégations ; durée, tokens et coût attribuable inconnus |
| ORG-0001 | 2026-09-15 | Implémenter les améliorations de l'audit, demande de Maxime | CTO, QA, Chief of Staff pour évaluation indépendante | Sous-agents natifs hérités ; hors essai DEC-0002 | État, critères et preuves dans [ORG-0001](missions/ORG-0001.json) | Coût et temps humain inconnus ; pas de nouvelle dépense externe |

Pour USE-0001 : corrections QA/Chief appliquées par le coordinateur. La
recommandation produit reste proposée, sans accord humain enregistré. Aucun
gain comparatif ni décision produit évitée n'est revendiqué. Les constats
regroupés portent sur la cohérence du guide, pas sur des bugs de l'application.

Pour une entrée réelle, noter :

- Recommandations identifiées et décision explicite de Maxime (acceptée, refusée,
  en attente), avec source ; ne pas compter un silence comme acceptation.
- Défauts distincts détectés par QA, confirmation par reproduction/test/revue,
  et correction si réalisée. Une réserve ou un doublon ne compte pas comme erreur.
- Décision évitée ou corrigée : ancienne option, contre-élément, choix humain et
  trace. Sans contre-factuel raisonnablement documenté, laisser inconnu.
- Spec : première version, reprise substantielle nécessaire ou non, cause ;
  séparer nouvelle demande de Maxime et omission dans la spec initiale.
- Valeur de la consultation supplémentaire : constat accepté/refusé par Maxime,
  justification ; si elle n'apporte rien, le noter explicitement.
- Usage attribuable si fourni par l'outil : tokens/coût, devise, source et portée.
  Des limites de compte partagées ne mesurent pas le coût d'une tâche.
- Durée : début/fin observés, attentes et temps de coordination séparés lorsque
  mesurables. Complexité ajoutée : étapes, relectures ou entretien réellement requis.

Pas de secret, transcript apprenant ou donnée personnelle dans le registre.
Lier un artefact du dépôt ou conserver un extrait minimal de l'arbitrage humain.

## Indicateurs à calculer lors d'une revue

| Indicateur | Définition / limite |
|---|---|
| Recommandations acceptées | Nombre d'identifiants avec accord humain ; présenter aussi examinées et en attente. |
| Erreurs détectées par QA | Défauts confirmés et dédupliqués ; séparer gravité, simples soupçons et faux positifs. |
| Décisions évitées/corrigées | Cas avec option antérieure et arbitrage humain sourcés, sans gain fictif chiffré. |
| Taux de specs reprises | Specs nécessitant au moins une reprise substantielle / specs effectivement relues ; dénominateur absent = non mesuré. |
| Multi-rôles sans valeur supplémentaire | Tâches avec constat explicite de non-apport / tâches multi-rôles dont l'apport a été évalué ; ne pas confondre avec absence de réponse. |
| Coût/usage | Valeurs observées, source et unité ; montant inconnu reste inconnu, pas 0. |
| Durée/complexité ajoutée | Temps de coordination/entretien et étapes observées ; comparaison seulement à tâche/périmètre comparables. |

Ne pas maintenir des totaux à la main en parallèle des observations. Les
indicateurs sont recalculés lors de la revue, avec période et dénominateurs.
Pas de quota de performance ni de seuil artificiel pour justifier un agent.

## Essai manuel compute — DEC-0002

Essai autorisé par Maxime le 15/09/2026 : [périmètre, règles et fin de l'essai](../decisions/DEC-0002-essai-manuel-compute.md).
Au lancement, aucune mission pilote n'est enregistrée. Les fiches ci-dessous
feront foi ; USE-0001, la revue de spec et la mise en place ne comptent pas.
Le coordinateur complète ce gabarit pour chaque mission éligible, avec une ligne
dans le registre général et le prochain identifiant USE libre. Les cinq missions
sont comptées une seule fois chacune, quel que soit le nombre de collègues.

```markdown
### USE-XXXX — Titre de la demande

- Essai : DEC-0002 ; date ; source minimale de la demande autorisée.
- Résultat attendu / critère de fin : ...
- Choix habituel avant exécution : héritage ou paramètres connus ; source.
- Alternative envisagée : aucune, ou modèle/effort et raison en une phrase.
- Décision initiale : choix retenu et justification ; hypothèse d'économie éventuelle.

| Tentative | Rôle / périmètre | Recommandation modèle/effort | Paramètres transmis / agent de référence | Résultat et preuve | Cause d'échec / raison de reprise | Usage attribuable et source |
|---|---|---|---|---|---|---|
| USE-XXXX-A1 | ... | ... | hérité ou paramètres explicites ; identifiant si disponible | ... | sans objet ou cause documentée | inconnu si absent |

- Clôture : terminé / partiel / échoué / bloqué ; livrable et vérifications.
- Reprises : liens aux tentatives et transferts de contexte ; inconnues conservées.
- Surcharge : temps si mesuré, sinon étapes supplémentaires observées ; coût inconnu.
- Apport discernable du choix : constat ou inconnu ; aucune comparaison causale supposée.
```

Les consultations indépendantes d'une mission sont des tentatives distinctes
avec leur périmètre ; elles ne sont pas des reprises l'une de l'autre. Relier
explicitement toute reprise à sa tentative précédente. Compter tout usage connu
de la mission, coordination comprise si observable, et signaler la couverture
incomplète. Une valeur inconnue ne vaut pas zéro. Le gabarit vide n'est pas une
observation. À la cinquième clôture, produire le bilan prévu par DEC-0002.

### USE-0002 — Situation Twiny et alternatives à Alibaba

- Essai : DEC-0002 ; première mission pilote, 15/09/2026. Source : demande de Maxime dans la tâche Codex `01a0a641-26c9-7591-9276-a8e6990c3159`.
- Résultat attendu : bilan sourcé du nettoyage et de l'entrée libre, limites des validations et candidats de remplacement ; aucune implémentation produit.
- Choix habituel avant exécution : héritage du modèle et de l'effort de la tâche ; identifiants effectifs non exposés par le retour de délégation.
- Alternative envisagée : aucune ; enquête croisant code, historique et décisions, périmètre initial incertain.
- Décision initiale : héritage conservé, indiqué dans la mission avant exécution ; profil Chief of Staff explicitement demandé. Aucun réglage utilisateur modifié.

| Tentative | Rôle / périmètre | Recommandation modèle/effort | Paramètres transmis / agent de référence | Résultat et preuve | Cause d'échec / raison de reprise | Usage attribuable et source |
|---|---|---|---|---|---|---|
| USE-0002-A1 | Chief of Staff ; état Git, pilote et nettoyage | Héritage | `agent_type=twiny_chief_of_staff`, aucun override ; `/root/situation_twiny` | HEAD `60c8617`, état propre au relevé ; nettoyage documentaire distingué d'un audit de code mort ; validations historiques distinguées des essais réels | Sans reprise ; précision KYC et historique documentaire transmise pendant l'enquête | Inconnu |

- Clôture : bilan terminé ; Git et suppressions vérifiés indépendamment par le coordinateur, lecture des registres et des tâches antérieures, documentation officielle fournisseurs consultée. Aucun test applicatif, contrôle DB distant ou déploiement exécuté pour ce bilan.
- Reprises : aucune ; recherches fournisseurs et historique menées par le coordinateur, sans autre sous-agent.
- Surcharge : une délégation, échanges de précisions et vérification ciblée ; temps et coût inconnus, coordination comprise. Seul ce registre est modifié par la mission.
- Apport discernable du choix : correction du relevé institutionnel périmé dans la synthèse ; aucune comparaison causale de modèles ni économie mesurée. Alternatives fournisseurs proposées, non intégrées et non évaluées sur corpus réel.

### USE-0003 — Reprendre l'entrée libre avec Mistral

- Essai : DEC-0002 ; deuxième mission pilote, 15/09/2026. Source : « on continue avec mistral d'abord », tâche `01a0a641-26c9-7591-9276-a8e6990c3159`.
- Résultat attendu : accès réel Mistral puis parcours d'entrée libre ; prérequis et échecs documentés sans promotion de statut.
- Choix habituel : héritage ; alternative : aucune, diagnostic encore inconnu. Décision avant délégation : héritage conservé, aucun réglage de la tâche modifié.

| Tentative | Rôle / périmètre | Recommandation modèle/effort | Paramètres transmis / agent de référence | Résultat et preuve | Cause d'échec / raison de reprise | Usage attribuable et source |
|---|---|---|---|---|---|---|
| USE-0003-A1 | QA ; tests ciblés existants hors réseau | Héritage | `agent_type=twiny_qa`, aucun override ; `/root/qa_mistral` | 115 tests / 13 fichiers PASS, 6,54 s, sortie 0 | Aucune reprise QA | Tokens/coût inconnus |

- État à l'interruption pour connexion : partiel ; [relevé de reprise](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md#reprise-mistral--15092026). Un appel UI réel refusé quota/débit, catalogue fournisseur HTTP 200, offre gratuite confirmée par Maxime ; connexion console requise pour connaître la limite exacte. Cette reprise conserve USE-0003.
- Environnement : tentative de second serveur arrêtée par le verrou Next, serveur existant réutilisé ; GET fournisseur initial bloqué par réseau restreint, réussi après élévation autorisée. Aucun réessai de génération.
- Surcharge : une délégation QA indépendante, contrôles UI/configuration et catalogue, deux clarifications compte/connexion ; durée globale et coût non mesurés. Aucun benchmark comparatif ni économie déduite.
- Apport : tests locaux distingués de l'échec fournisseur réel ; prérequis documentaire distinct repéré. Aucun code applicatif, secret ou schéma modifié.
- Reprise du même USE-0003 après connexion : console gratuite 0,06/8,50 EUR et limites Medium/Small 20 000 tokens/minute, 1 requête/seconde ; une reprise UI et deux sondes minimales distinctes hors Twiny reproduisent HTTP 429/code 1300. Aucun nouveau sous-agent, aucun nouveau test local ; coût des refus non retourné, pas supposé nul. Le rattachement de la clé à l'organisation affichée reste à vérifier ; aucun passage au payant effectué. Mission toujours partielle, cause fournisseur exacte non déterminée.
- Vérification suivante dans cette reprise : suffixe masqué de la clé active comparé au serveur (correspondance), aucun quota personnalisé du workspace, plafond de dépenses désactivé. L'offre payante n'est pas justifiée par ces observations ; diagnostic fournisseur encore nécessaire. Aucun réglage fournisseur modifié.
- Suite sur « vas-y » : recherche officielle identifiant un plafond mensuel de tokens distinct des euros ; avis sur pay-as-you-go nuancé, plafond effectif toujours inconnu. Brouillon support préparé ; envoi refusé par contrôle automatique exigeant l'accord explicite sur le contenu, confirmation demandée. Aucun contournement ni nouvelle génération. Même USE-0003, aucun nouvel agent.
- Accord ultérieur explicite « Oui, envoyer au support » : même brouillon transmis via Intercom, envoi confirmé dans le fil. Aucun secret ni document transmis, aucune activation de facturation. Réponse de diagnostic encore attendue.
- Le bot redemande le type d'offre ; après second accord explicite de Maxime (« oui »), confirmation Gratuit et demande de diagnostic ou transfert technique envoyées. Envoi vérifié ; aucun nouveau test ni changement fournisseur.
- Réponse reçue du bot : refus attribué au best-effort gratuit, proposition pay-as-you-go/backoff. Aucun diagnostic individuel ni transfert humain confirmé ; explication conservée comme attribution non vérifiée. Source officielle confirme Tier 1 avec pay-as-you-go, pas la capacité réservée affirmée par le bot. Aucun achat, réglage ou retry ajouté ; mission de test réelle toujours partielle.

- Reprise après activation PAYG par Maxime : état actif vérifié ; minimum fournisseur de 10 EUR empêchant le plafond initial de 5 EUR. Accord explicite obtenu pour 10 EUR/mois, enregistré et confirmé sur Default Workspace ; budget de mission maintenu à 5 EUR. Un appel UI réel depuis `/app` aboutit avec réponse Mistral et indication d'absence d'échéance enregistrée. Accès conversationnel débloqué ; configuration documentaire toujours manquante, parcours complet non validé. Aucun nouvel agent ni test local, aucun code ou secret modifié ; coût exact de l'appel inconnu. Même USE-0003.

- Suite sur « vas-y traite ça » : configuration documentaire autorisée. `MISTRAL_API_KEY` renseignée depuis la clé du chat, sans affichage de secret ; fichier local ignoré par Git. Catalogue HTTP 200 confirmant OCR et restitution. Droits RPC distants vérifiés : réservation et finalisation Mistral restent réservées au serveur. Clé Supabase serveur absente et non fournie par le connecteur ; connexion Dashboard demandée. Aucun nouvel agent, aucune migration ni modification applicative. Même USE-0003, analyse réelle encore à réaliser.

- Maxime renseigne ensuite la clé Supabase localement : rôle/projet vérifiés sans secret affiché, accès REST serveur au budget HTTP 200 sans écriture. Nouvelle préparation UI disponible, bouton d'analyse actif pour le livret de 13 pages, 0,44 EUR maximum. Configuration résolue ; consentement précis demandé avant transmission documentaire. Aucun test local répété ni code modifié.

- Essai documentaire explicitement autorisé : OCR réel 13/13 pages conservées, restitution interrompue sans raison fournisseur détaillée sauvegardée. Budget Twiny rapproché 0,201971 EUR (marge comprise, distinct de la facture). Correction ciblée de la demande de concision/format et du diagnostic de troncature ; 22 tests/4 fichiers passent et TypeScript passe. Devis de reprise 0,34 EUR avec cache OCR, nouveau consentement demandé. Aucun nouvel agent ; même USE-0003, synthèse réelle encore non obtenue.

- Reprise autorisée à 0,34 EUR : cache 13 pages confirmé, aucun second OCR ; réponse complète rejetée à la validation des citations. Aucune synthèse invalide conservée. Décompte prudent cumulé Twiny 0,277778 EUR, facture fournisseur non mesurée. 22 tests ciblés, TypeScript et ESLint passent ; configuration résolue, fidélité/synthèse réelle encore non validées. Arrêt des appels payants ; prochain diagnostic : divergence de citation à rendre observable. Même USE-0003, aucun agent supplémentaire ni promotion de statut.

- Reprise « vas-y reprends » : diagnostic de citation rendu explicite sans assouplissement. Reproduction réelle d'un repère PDF 6 au lieu de 7 ; transcription page 7 numérotée 6. Consigne de pagination corrigée, puis borne de précision omise rendue explicite depuis les constantes métier. Trois reprises manuelles de synthèse dans le même périmètre, chacune préparée avec un maximum de 0,34 EUR ; cache OCR conservé.
- Résultat final USE-0003 : configuration et analyse réelle du livret abouties, état `terminee` en base, 13 pages, 2 sujets et 2 compétences proposées, aucune erreur restante. 59 tests ciblés/5 fichiers, TypeScript et ESLint passent. Bilan documentaire cumulé : 1 OCR + 5 synthèses, 0,508121 EUR décomptés par le budget prudent Twiny, facture fournisseur et coût agent non mesurés. Aucun nouvel agent, aucun benchmark comparatif, aucune économie attribuée à un choix de modèle. Le parcours jusqu'au travail et la fidélité sur d'autres documents restent hors des preuves obtenues ; aucun statut promu.

### USE-0004 — Avis sur assistant, fenêtre de classement et tableau de bord

- Essai DEC-0002, troisième mission pilote, 15/09/2026. Source : Maxime demande l'avis de ses agents sur une saisie de ressources dans l'assistant, une fenêtre de synthèse/classement puis les priorités du moteur au tableau de bord.
- Périmètre : analyse seulement. Le coordinateur possède ce registre ; aucun changement produit, appel IA documentaire ou écriture de données.
- Choix avant délégation : héritage pour Product, CTO et QA ; besoin d'examen critique produit/architecture, aucune alternative de modèle ni économie supposée. Les réglages de la tâche restent inchangés.
- Livrables attendus : avis Product sur le parcours, cartographie CTO des raccordements existants, contre-exemples QA ; synthèse des désaccords et décision concrète proposée.

| Tentative | Rôle / périmètre | Choix | Paramètres réellement transmis | Résultat | Usage attribuable |
|---|---|---|---|---|---|
| USE-0004-A1 | Product : besoin, confirmation groupée et friction | Héritage | `agent_type=twiny_product`, aucun override ; `/root/avis_parcours_product` | Parcours recommandé avec fenêtre courte et classement modifiable ; arbitrage validation préalable vs bilan automatique explicité | Inconnu |
| USE-0004-A2 | CTO : raccordements UI, hiérarchie, moteur | Héritage | `agent_type=twiny_cto`, aucun override ; `/root/avis_parcours_cto` | Modale et moteur immédiat présents ; contrat documentaire plat à enrichir pour chemins hiérarchiques ; orchestration globale distincte | Inconnu |
| USE-0004-A3 | QA : lots, reprise, fermeture, données sans preuves | Héritage | Réemploi de `/root/qa_mistral` (`twiny_qa`), aucune modification modèle/effort | Fenêtre refermable/retrouvable, couverture explicite, distinction proposé/enregistré, accès au travail sans classement complet | Inconnu |

- Vérification du coordinateur : observations AX et captures réelles de l'assistant, du livret et du dashboard ; contrôles ciblés des contrats/types/usages. L'écran `/app?depot=...` conserve les deux revues historiques alors que le fil moderne utilise `organiser:true`. Le tableau de bord affiche déjà une priorité sur le livret, avec un motif encore technique. Ces deux parcours doivent être distingués des recommandations des agents.
- Synthèse proposée : assistant unique, fenêtre courte de compréhension/classement hiérarchique avec une confirmation groupée, puis priorités du moteur et possibilité de différer. Une confirmation avant écriture amenderait le chemin automatique d'ADR-145 ; ce n'est pas une décision validée. Aucun statut humain promu.
- Clôture : avis rendu ; aucune modification produit, aucune nouvelle analyse documentaire, aucun test applicatif ou contrôle DB pour cette mission. Seul le registre est modifié. Trois agents, aucune reprise de travail délégué ; durée et coût de coordination inconnus, aucune économie causale revendiquée. Troisième mission de l'essai manuel, bilan de cinq missions non encore dû.

### USE-0005 — Réaliser le parcours assistant → confirmation → priorités

- Essai DEC-0002, quatrième mission pilote, 15/09/2026. Autorité : Maxime approuve la proposition précédente et demande de poursuivre automatiquement jusqu'au fonctionnement complet.
- Choix avant délégation : héritage conservé ; modifications coordonnées de contrats et d'interface, sans comparaison artificielle ni modification des réglages utilisateur. Modèle hérité et coût attribuable inconnus.
- Répartition : CTO possède classement serveur et logique pure ; Product réalise la fenêtre et le raccordement au chat ; coordinateur possède route, tableau de bord, intégration et documentation ; QA relira le résultat. Aucun nouveau schéma ni dépendance prévu.
- Vérifications prévues : refus avant confirmation, classement hiérarchique, reprise/fermeture, concurrence et erreurs partielles, `npm run verify`, build et parcours navigateur avec l'analyse du livret déjà conservée. Budget de tests maintenu à 5 EUR ; aucune nouvelle analyse nécessaire pour ces contrôles.
- Clôture : parcours réalisé et vérifié localement. `npm run verify --workspace=app -- --maxWorkers=2` passe : 2 301 tests dans 224 fichiers, TypeScript et ESLint sans erreur (10 avertissements existants). Build de production réussi. Le navigateur confirme une note synthétique dans la fenêtre puis rejoint le tableau de bord ; le classement et sa trace sont relus dans Supabase. Note et analyse de test supprimées, absence vérifiée. Contrôles de fermeture/reprise et affichage mobile à 390 × 844 effectués. Le contrôle SQL de rejeu et isolation est annulé par rollback.
- Défauts corrigés : classement automatique avant confirmation, parcours séparé, concurrence des reprises, pied de fenêtre mobile et dates SQL retirées par le convertisseur documentaire. Ce dernier défaut a été reproduit dans le navigateur puis couvert par sept tests QA. Le coordinateur a aussi corrigé son identifiant de fixture, refusé par le validateur existant ; ce refus n'était pas un défaut du produit.
- Répartition réalisée : trois agents natifs réutilisés avec héritage ; reprises ciblées UI, concurrence serveur et horodatage documentaire. Durée, tokens et coût attribuable inconnus ; aucune économie causale revendiquée. Aucune nouvelle dépense Mistral, dépendance ou migration. Aucun commit, push ou déploiement. La fidélité de l'analyse sur corpus varié et le planificateur global ne sont pas validés par ce chantier. La revue DEC-0002 de USE-0006 était antérieure à cette clôture ; aucune prolongation de l'essai n'est décidée ici.

### USE-0006 — Audit du système d'agents et de son autonomie

- Essai DEC-0002 ; cinquième mission éligible, 15/09/2026. Source : Maxime demande un audit de l'utilité, de la conception, des manques et de la capacité à construire et améliorer Twiny avec validation humaine pertinente.
- Résultat attendu : audit sourcé de l'existant, limites des preuves, recommandations priorisées et proposition de délégation d'autorité ; aucune modification du produit ou des règles actives.
- Choix avant délégation : héritage du modèle et de l'effort ; identifiants effectifs inconnus. Alternative : aucune, analyse de gouvernance et d'architecture avec contre-exemples. Aucun gain de coût présumé ni réglage utilisateur modifié.
- Répartition prévue : CTO vérifie les capacités et limites d'exécution ; QA attaque les règles de validation et d'amélioration ; coordinateur examine gouvernance, mémoire, preuves et synthétise. Sous-agents en lecture seule ; coordinateur possède le rapport et cette fiche seulement.
- État initial : USE-0005 encore indiquée en cours ; limite conservée dans la revue des cinq fiches.

| Tentative | Rôle / périmètre | Recommandation modèle/effort | Paramètres transmis / agent de référence | Résultat et preuve | Cause d'échec / raison de reprise | Usage attribuable et source |
|---|---|---|---|---|---|---|
| USE-0006-A1 | CTO ; exécution, reprise, isolation et contrôles | Héritage | `agent_type=twiny_cto`, `fork_turns=all`, aucun override ; `/root/audit_execution_cto` | Profils réels et limites établis ; check : 40 documents/243 liens avant ajout du rapport, sortie 0 ; 6 tests passent ; context sortie 0 | Aucune reprise | Inconnu, non fourni par l'outil |
| USE-0006-A2 | QA ; autorité, reprise, auto-amélioration et contre-exemples | Héritage | `agent_type=twiny_qa`, `fork_turns=all`, aucun override ; `/root/audit_governance_qa` | Six constats documentaires et cinq scénarios examinés ; restriction de lecture et mémoire périmée confirmées | Aucune reprise ; vérification ciblée d'une sortie tronquée, sans défaut de fichier établi | Inconnu, non fourni par l'outil |

- Clôture : audit terminé, [rapport et revue DEC-0002](runs/2026-09-15-audit-autonomie.md). Sources des principaux constats relues par le coordinateur ; résultats CTO/QA confrontés. Les scénarios de gouvernance sont des analyses de textes, pas des essais comportementaux exécutés. Aucun test applicatif ni contrôle distant ; aucune règle active modifiée.
- Surcharge observée : deux délégations, précisions de périmètre, vérification croisée et rédaction du rapport. Durée totale et coût/tokens inconnus, coordination comprise ; aucune économie chiffrée revendiquée.
- Apport discernable : convergence sur les limites d'exécution et mise au jour de la contradiction lecture/diagnostic ; aucune comparaison causale avec un agent unique ni avec un autre modèle.
- Revue de l'essai : cinq missions éligibles USE-0002 à USE-0006 examinées, USE-0005 encore en cours au relevé. Tous les choix consignés conservent l'héritage ; aucune donnée ne justifie un Compute Router ou une économie attribuable. Recommandation : conserver l'héritage et simplifier la mesure ; aucune prolongation automatique de l'essai.

## Décision de simplifier

Après quelques demandes réelles (calendrier à choisir par Maxime), comparer
valeur constatée, coût et entretien. Si un rôle n'apporte rien de discernable,
recommander de le fusionner, réduire ou retirer, avec les contre-exemples éventuels.
Une proposition de changement durable suit le registre DEC ; aucun rôle ne
s'étend, ne s'auto-valide ou ne se supprime automatiquement.
