# Twiny V1/V2 — registre du pilote documentaire

**Suite du 13/09 — analyse dans le fil et rattachement au référentiel existant.**
Les nouveaux partages présentent sources, pages et coût dans la conversation,
puis un seul consentement pour analyser la sélection et appliquer les liens non
ambigus. Le traitement s'arrête au premier échec ou sur demande. Le résultat est
relu du serveur ; les nouveautés restent explicitement à préciser et les choix
déjà appliqués sont préservés. « Vérifier le rangement » reprend sans appel IA
et répare un index incomplet. Les comptes rendus et transcriptions sont lisibles
dans le fil mais ne sont pas envoyés au chat. Les vues historiques ci-dessous
gardent leurs deux revues. Aucun schéma ni budget n'est modifié. La création des
nouveautés, la correction en langage libre et l'essai sur corpus réel restent
à réaliser ; cette tranche ne valide pas tout le lot 2. Contrat courant : ADR-145.

**Correction du 11/09 — saisie unique.** Les fichiers, dossiers et le texte
joint se déposent directement dans le chat d'accueil. Le lien de capture
séparée est retiré et `?nouveau=1` ouvre le même chat. Les liens `?depot=…`
restent lisibles pour les ressources historiques. Les reçus du fil confirment
la conservation, jamais une analyse IA implicite. Le transfert V2 est partagé
avec la vue historique ; aucun schéma, fournisseur ou budget n'est modifié.

**Lot 1 du 11/09/2026.** L'arrivée pilote sur `/app` ouvre désormais l'assistant.
La capture séparée prévue initialement avec `?nouveau=1` est remplacée par la
saisie commune ci-dessus ; `?depot=…` conserve l'accès aux anciens dépôts ;
`?classique=1` donne accès au travail sans conversation obligatoire. Les revues
documentaires de la vue historique restent inchangées. Les preuves et limites de ce
lot sont consignées dans la référence d'entrée et ADR-145 ; le test navigateur
initial a rencontré une limitation fournisseur, sans succès d'écriture revendiqué.

**Réorientation du 10/09/2026.** Maxime refuse le tunnel de dépôt/organisation
comme entrée principale et demande un assistant conversationnel qui administre
les informations utiles. La V2 décrite ici reste l'état du code local, pas
l'expérience cible validée. Le lot de cadrage n'a exécuté aucun nouveau test
applicatif, parcours authentifié ou contrôle Supabase. Voir
[`Assistant d'entrée : référence et diagnostic`](../design/ASSISTANT_ENTREE_REFERENCE.md)
et ADR-145 pour la reprise progressive ; les résultats historiques ci-dessous
ne constituent pas la vérification de cette nouvelle direction.

Mis à jour le 09/09/2026. Contrats : [PRODUCT](../../PRODUCT.md),
[ADR-143](../../ARCHITECTURE_DECISIONS.md#adr-143),
[ADR-144](../../ARCHITECTURE_DECISIONS.md#adr-144),
[modèle métier](../architecture/TWINY_MODEL.md),
[interventions](../architecture/INTERVENTIONS_LEARNING_SESSION.md).

## État réel

Le parcours est implémenté dans l'application existante, derrière
`comptes_acces.depot_pilote` et le rôle administrateur actif. Maxime a autorisé
sa fusion sur `master` avant la configuration Mistral ; cela n'ouvre pas le
pilote généralement et ne valide pas sa fidélité. Le compte administrateur actif
de Maxime a été identifié par lui, puis activé et vérifié en base le 06/09/2026.
Le nouvel accueil est accessible sur `/app` avec ce compte, sans `classique=1`.
La qualité de lecture sur ses manuscrits n'a pas été mesurée ; aucun résultat
de fidélité ou de correction en moins d'une minute n'est revendiqué.

La V2 conserve une ressource indépendante par fichier et une ressource `note`
distincte. Elle confirme ensuite l'analyse Mistral ressource par ressource,
relit les éléments sourcés, sépare la validation du référentiel du rangement,
puis permet une lecture et reformulation sans mesure. Les dépôts V1 réunissant
une note et plusieurs fichiers restent lisibles et analysables.
Les dépôts récents sont accessibles chronologiquement dans Mes cours et
l'accueil. Les séances en cours restent immédiatement accessibles.

Révision d'interface du 06/09 après le premier retour : fichiers cumulables,
choix et glisser-déposer de dossiers avec sous-dossiers, liste des refus et
retrait avant transfert. Limites : 100 fichiers / 100 Mio par dépôt, 10 Mio
par fichier. Les chemins deviennent des libellés plats ; aucune synchronisation
reMarkable ni import de son format natif n'est ajouté.
« Comprendre mes documents » ouvre le récapitulatif de consentement ; seul
« Autoriser et analyser » lance l'appel payant. Le suivi s'actualise pendant
l'analyse sans réessai fournisseur. « Travailler ce passage » ouvre la lecture
et la rédaction, expliquées sous le bouton. Les originaux restent utilisables
sans IA dans « Je préfère travailler directement sur mes documents ».

## Installation et activation

Navigation : le clic « Tableau de bord » (desktop/mobile) ouvre les propositions
via `/app?classique=1`. Ma journée affiche ce même bouton de retour en haut.
« Ajouter à ma journée » reste accessible dans le rail et l'en-tête mobile,
sur toutes les pages du pilote. Le lien « Autres propositions de travail »
a été retiré ; l'accès direct à `/app` conserve la logique quotidienne.
Après cette correction de navigation, la vérification complète du 07/09 passe :
TypeScript, lint sans erreur (dix avertissements existants), 2 159 tests dans
205 fichiers et build de production. Les tests de navigation couvrent la
destination desktop/mobile, le maintien des liens hors pilote et l'état actif.

Révision du 07/09 : « Supprimer » est disponible dans les dépôts récents,
avec confirmation et explication des éléments conservés. Les documents avec
une version figée restent protégés. Après une saisie enregistrée, revenir sur
`/app` ouvre le dernier dépôt du jour local du navigateur ; « Ajouter à ma
journée » (`/app?nouveau=1`) rouvre la saisie. Le lendemain, ou après suppression
de tous les dépôts du jour, la saisie revient automatiquement. Aucun changement
de schéma ni migration supplémentaire. Les tests couvrent la sélection du
jour, minuit local, le retour sans dépôt et les refus de suppression.
Vérification du 07/09 : TypeScript, lint sans erreur et build passent. La suite
complète donne 2 155 tests réussis et deux échecs de comparaison LF/CRLF dans
la composition des séances. Après normalisation des fins de ligne dans ce test,
la reprise ciblée des trois fichiers concernés passe (10 tests, dont les sept
nouveaux). Aucun document réel n'a été supprimé pour cette vérification.

- Variables **serveur uniquement** : `MISTRAL_API_KEY` et
  `SUPABASE_SERVICE_ROLE_KEY`, avec la configuration Supabase existante.
  Ne jamais les préfixer `NEXT_PUBLIC_`. Sans ces clés, dépôt, lecture et
  reformulation restent disponibles ; la préparation annonce l'absence d'IA.
  Ces deux variables ont été constatées absentes de l'environnement local le
  06/09/2026, sans afficher ni modifier de secret. Leur état en production
  n'a pas été vérifié.
- Activer `comptes_acces.depot_pilote` uniquement pour le compte identifié,
  après vérification de son rôle actif. Ce réglage ne lance aucun appel.
- Pour revenir à l'accueil historique : désactiver ce drapeau ; le lien
  `/app?classique=1` permet aussi de relire les propositions historiques.
- Réexaminer prix et conversion avant le 06/10/2026 ; les appels se ferment
  automatiquement à cette date tant que la politique n'est pas mise à jour.
- Aucune dépendance nouvelle ni modification de `.env.local` n'a été faite.

## Base réelle

Projet Supabase : `vxkjzzshlqulexydgfpc`. Les versions distantes ont été
vérifiées dans `supabase_migrations.schema_migrations` le 06/09/2026.

Nouvelle vérification en lecture le 09/09/2026 : les tables `documents`,
`document_attachments`, `document_depot_analyses` et `document_links` ont leur
RLS active. L'état constaté comptait 14 documents, 0 pièce jointe, 0 analyse
documentaire et 33 liens. Il ne contient donc encore aucune preuve d'usage réel
du nouveau parcours. La V2 réutilise ces tables ; aucune migration ni
modification de `schema.sql` n'est nécessaire.

| Migration locale | Version distante | État |
|---|---|---|
| `20260906094254_depot_documentaire_pilote.sql` | `20260906101828` | Appliquée |
| `20260906101952_conserver_budget_depot_apres_reinitialisation.sql` | `20260906102203` | Appliquée |

`app/supabase/schema.sql` reprend ces deux migrations. Trois tables
d'infrastructure possèdent une RLS ; les RPC de démarrage, réservation et
rapprochement sont exclusivement serveur. La suppression documentaire purge
analyses et corrections. Le compteur sans contenu survit au reset pédagogique
et part avec le compte d'accès/Auth. Cela empêche le renouvellement du budget
par réinitialisation.

Le test SQL [depot_documentaire.sql](../../app/supabase/tests/depot_documentaire.sql)
a passé sur la base réelle dans une transaction annulée : lancement
idempotent, reprise distincte, interdiction d'écriture par l'ancienne
tentative, plafond, rapprochement immuable, lecture/correction intercomptes
refusée, RPC inaccessible au navigateur et cascade des contenus. Il ne
sollicite aucun fournisseur et ne conserve aucune donnée de test.

Une tentative de vérifier le chevauchement de deux transactions via le MCP
n'a pas démontré leur exécution simultanée ; aucun stress-test concurrent
réel n'est donc revendiqué. La réservation utilise un verrou PostgreSQL par
compte, et les tests de plafond/idempotence ci-dessus passent.

## Lecture et coût

Sources officielles consultées le 06/09/2026 :
[OCR 4.1](https://docs.mistral.ai/models/ocr-4-1),
[Medium 3.5](https://docs.mistral.ai/models/mistral-medium-3-5-26-04),
[API OCR](https://docs.mistral.ai/api/endpoint/ocr).
Les identifiants utilisés sont `mistral-ocr-4-1` et `mistral-medium-3-5`.

La réserve applique 8 000 micro-euros par page, 3 par octet entrant et 15 par
jeton sortant maximal. Elle majore les tarifs USD avec une conversion de
2 EUR/USD ; ce compteur est conservateur, pas une facture comptable.
Le total mensuel maximal est de 5 €. Une tranche de vingt pages et une
restitution maximale réservent au plus 0,4975 €. La consommation connue
libère seulement l'écart avec sa réservation ; un coût inconnu reste réservé.

Le fichier de la ressource sélectionnée part entier à Mistral, avec les pages à
traiter explicitement bornées à vingt au total. Les PDF mixtes passent par la
lecture visuelle. La restitution reçoit uniquement la note ou les extractions
de cette ressource et le référentiel actif. En V2, elle peut proposer une
organisation sourcée, mais ni échéance, ni plan, ni code de compétence nouveau.
Les identifiants et codes existants sont revérifiés côté serveur.
Un numéro de page ou une citation inexistants font refuser le compte rendu.
Cela ne suffit pas à garantir la justesse sémantique : les originaux décident.

## Corpus et décision d'usage — à réaliser avec Maxime

Préparer environ vingt pages anciennes : reMarkable exporté en PDF, scans,
photos lisibles et difficiles, cours imprimés avec annotations manuscrites.
Avant chaque essai, relever manuellement les sujets, annotations essentielles,
dates exactes ou ambiguës et passages illisibles. Garder ces repères hors
entrée IA pour pouvoir constater les omissions.

Pour chaque dépôt, noter dans un fichier privé du compte : sources/pages,
repères attendus, omissions, erreurs, durée d'analyse, réserve/consommation,
fidélité reconnue ou non, temps de correction, décision de poursuivre.
Ne pas committer les originaux personnels ou des identifiants de compte.

Critères proposés : neuf restitutions fidèles sur dix ; recherche des omissions
contre les originaux ; aucune échéance inventée présentée comme certaine ;
correction courante en moins d'une minute ; travail sans classement ; texte
retrouvé après fin/rechargement et aucune Observation créée. Ajouter aux essais
un document comportant des instructions malveillantes et des références
ambiguës. Si une réécriture régulière est nécessaire, suspendre l'élargissement.

## Vérification logicielle

Le chantier V2 ajoute des tests sur l'union V1/V2, les enums serveur, les
citations, l'absence de code modèle, la déduplication des branches, le maintien
des liens acceptés et la réanalyse non destructive. Le parcours garde deux
validations explicites : d'abord le référentiel, ensuite chaque ressource.
Vérification du 09/09/2026 : TypeScript et lint passent sans erreur avec les
dix avertissements préexistants ; Vitest passe 2 171 tests dans 206 fichiers ;
le build Next.js de production compile et génère ses 42 pages. Le premier essai
de build était privé du réseau nécessaire à `next/font`; la reprise autorisée
avec accès aux fontes Google a réussi sans changement de code.
L'audit visuel authentifié desktop/mobile, le zoom 200 % et le corpus réel
restent à effectuer avec la session et les documents privés de Maxime.

Les tests couvrent références/pages invalides, omissions OCR, budget refusé,
double lancement, changement de sources, reprise avec cache, données
malveillantes délimitées et production humaine modifiée ailleurs. Les tests
de prompts vérifient des garde-fous, pas la résistance empirique du modèle.
Le registre SQL ci-dessus vérifie les droits et le décompte réel.

Commandes depuis la racine : `npm run test --workspace=app`,
`npm run lint --workspace=app`,
`node_modules/.bin/tsc.cmd --noEmit --project app/tsconfig.json`, `npm run build`.
La vérification du workspace complet le 06/09/2026 a passé : TypeScript,
ESLint (zéro erreur, dix avertissements préexistants) et 2 150 tests dans
202 fichiers, y compris des travaux locaux sur les exercices et clés tuteur.
Ces travaux indépendants sont exclus de la livraison documentaire.
La version isolée à fusionner passe aussi `npm run verify --workspace=app` :
TypeScript, ESLint (zéro erreur, neuf avertissements préexistants),
2 136 tests dans 200 fichiers, ainsi que le build de production.
La révision d'import couvre les sélections successives, doublons, homonymes
de dossiers distincts, limites cumulées, refus partiels et parcours récursif
au-delà de la première fournée de cent entrées du navigateur. La préparation
de 25 PDF garde la tranche de vingt pages sans appeler l'IA.
`git diff --check` passe. Le build final de production passe également après
les ajustements de relecture, avec accès réseau aux polices Google. Le premier
essai en bac à sable avait échoué uniquement sur leur téléchargement.

Le corpus réel, les appels Mistral réels et le parcours navigateur authentifié
ne sont pas encore vérifiés. L'ouverture générale reste une décision humaine.

L'advisor sécurité Supabase ne signale aucun objet documentaire ajouté.
Il conserve des alertes sur des fonctions `SECURITY DEFINER` historiques et
sur la protection des mots de passe compromis désactivée, hors périmètre du
pilote : [explication du contrôle des fonctions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[protection des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).


### Suite de l'entrée conversationnelle — 14/09/2026

Le parcours historique à deux validations reste disponible. Dans l'accueil
conversationnel pilote, « Analyser et ranger » crée les compétences sourcées
dans les domaines existants. « Corriger ou compléter » permet ensuite de corriger
la ressource depuis la même saisie et de préciser l'usage d'un nouveau domaine.
Une reprise explicite de l'organisation complète les écritures sans nouvel appel IA.
La trace technique de commande reste dans la fiche ; le reçu exige la vérification
des liens réels. Aucun nouveau schéma, quota ou fournisseur. Voir ADR-145 pour
le contrat de reprise et les limites de cette extension. La fidélité sur corpus
réel n'est pas déduite des tests automatisés.


### Essai Qwen

**Branchement Qwen — 14/09/2026.** L’essai demandé utilise la clé personnelle
saisie dans les réglages, l’endpoint international fourni par Maxime et le modèle
figé `qwen3-vl-plus-2025-12-19`. Le chat et les documents partagent une enveloppe
cumulée de 5 USD hors taxes, sans renouvellement automatique. La clé reste dans
le stockage navigateur isolé par compte et transite uniquement dans les requêtes
nécessaires ; elle n’est ni persistée en base ni inscrite dans les documents.

Le compteur `qwen_usage` réserve avant chaque appel une borne majorée : 1 USD/M
entrants et 5 USD/M sortants, validité arrêtée au 15/10/2026. Texte + schémas sont
bornés par leurs octets UTF-8 avec marge ; les pages image réservent 20 000 tokens
entrants. Le raisonnement est désactivé et la sortie limitée à 8 192 tokens.
Une réservation, même échouée, reste consommée : le montant affiché est une borne
engagée, pas la facture Alibaba. Le plafond ne couvre pas les appels hors Twiny.
La réservation SQL sérialise les appels concurrents. Le compte authentifié ne
peut réserver que pour lui-même, après contrôle du compte pilote en base. Aucun appel fournisseur ne se
réessaie automatiquement ; une réponse tronquée n’émet aucune commande.

Le pipeline Mistral historique demeure disponible. Dans la conversation, une clé
Qwen sélectionnée utilise Qwen pour transcrire puis restituer ; les PDF sont
rendus localement page par page avec `@napi-rs/canvas` (ajout autorisé par Maxime).
La transcription Qwen est signalée à relire, sans score OCR inventé. Les citations,
références et actions conservent les validations métier existantes. Aucune
transcription ne rejoint automatiquement le contexte permanent du chat.

Migration `20260914165848_qwen_budget_essai.sql` appliquée à Supabase le 14/09.
Le compteur référence le compte Auth et survit au reset pédagogique. La CLI
Supabase étant absente, la migration a été appliquée par MCP puis enregistrée
localement avec sa version distante exacte. Aucun statut produit n’est promu.

Correction du 14/09 : la dépendance de Qwen à une clé Supabase privilégiée est
retirée. Migration `20260914214857_qwen_reservation_compte.sql` appliquée ;
la RPC personnelle lie l’identité à `auth.uid()` et délègue aux mêmes contrôles
de plafond et d’accès pilote. Aucun droit direct d’écriture du compteur n’est
accordé au client. Les réservations en double, l’effacement et l’accès anonyme
ou depuis un autre compte sont refusés et testés en transaction annulée.

Correction documentaire du 15/09 : le démarrage et la sauvegarde des analyses
utilisent également la session du compte pilote, sans clé Supabase privilégiée.
Le démarrage accepte les versions 1 et 2 du dépôt. La sauvegarde reste limitée
à son compte, sa tentative en cours et aux champs d’analyse autorisés.
Migration `20260914220251_depot_analyse_compte_v2.sql` appliquée (version UTC
du 14/09) ; démarrage V2, rejeu, reprise, ancienne tentative et accès étrangers
testés dans une transaction annulée. Le fil affiche le motif de l’échec.

Vérification du 14/09 : 2 257 tests passent (217 fichiers), compilation de production
et TypeScript réussis. Le test PDF rend réellement une page avec canvas ; les
réponses Qwen sont simulées. Les pages transcrites sont sauvegardées après chaque
réponse pour permettre une reprise sans relire celles déjà conservées. Le test SQL
de plafond, refus des réservations en double et droits RLS est exécuté en transaction annulée.
L’écran du compte affichait 5 USD disponibles avant les tests réels.
Le test réel suivant a révélé la dépendance incorrecte à la clé Supabase privilégiée,
corrigée par la RPC personnelle ci-dessus. Les requêtes atteignent ensuite Qwen,
qui refuse avec HTTP 403 `AccessDenied.Unpurchased` : informations de facturation à
compléter dans QwenCloud. Aucune réponse réelle du modèle n’est encore validée.

### Reprise Mistral — 15/09/2026

Maxime demande « on continue avec mistral d'abord » après le refus Alibaba.
Le complément de diagnostic de la conversation du 14/09 signalait une demande
de vérification d'identité du compte QwenCloud : l'explication initiale limitée
à la facturation ci-dessus était incomplète. La qualité de Qwen reste non évaluée.

Sur le serveur local existant (`master`, HEAD `60c8617`), le navigateur
authentifié a été remis sur la configuration serveur en effaçant la sélection
personnelle Qwen depuis les réglages. Aucun secret serveur n'a été modifié.
La configuration serveur désigne Mistral et `mistral-medium-latest`.

- Un seul envoi réel dans l'entrée libre : demande de conseils pour commencer
  avec ses cours, explicitement sans enregistrement ni modification. Le
  fournisseur refuse pour quota/débit ; aucun réessai de génération effectué.
- La vérification de reprise ne retrouve aucun résultat complet. Son message
  générique conserve une réserve sur une éventuelle commande partielle ; aucun
  contrôle DB supplémentaire n'a été effectué pour cet essai.
- Contrôle fournisseur en lecture seule : `GET /v1/models` répond HTTP 200 ;
  le modèle configuré et `mistral-ocr-4-1` figurent dans la liste. Cela vérifie
  la clé et le catalogue, pas la disponibilité du quota de génération/OCR.
- Maxime confirme utiliser l'offre gratuite. La console Mistral demande une
  connexion dans la session de vérification ; limite exacte et consommation
  restent à lire. Aucun achat ou changement d'offre effectué.
- La configuration documentaire Mistral exige `MISTRAL_API_KEY` et
  `SUPABASE_SERVICE_ROLE_KEY`. Ces variables sont absentes du fichier local
  inspecté ; des variables injectées au processus restent possibles, non
  vérifiées. Le raccord chat ne suffit donc pas à établir que les documents
  sont prêts. Aucun document n'a été transmis pendant cette reprise.
- Confirmation UI sur le livret déjà déposé : écran de consentement affiché
  pour 13 pages, borne 0,44 EUR, budget mensuel restant 5 EUR ; bouton
  « Autoriser et analyser » désactivé avec « Lecture IA non configurée ou
  tarifs à revérifier ». La préparation est donc consultable mais l'analyse
  documentaire Mistral est effectivement bloquée dans cette session.
- QA ciblée : 115 tests passent dans 13 fichiers (Vitest, 6,54 s), couvrant
  accueil, route assistant, configuration, budget et pipeline documentaire.
  Fournisseurs et DB simulés ; aucun nouveau build ni suite complète.

Reprise attendue : lire Usage/Limits après connexion Mistral, résoudre le
prérequis fournisseur puis vérifier la configuration documentaire avant un
essai explicitement consenti. Le parcours réel jusqu'au travail reste non validé.

**Complément après connexion à la console, le 15/09.** L'offre affichée est
Gratuit : 0,06 EUR utilisés sur 8,50 EUR d'API inclus, 17 requêtes sur la
période du 01/09 au relevé. La page Limites affiche pour Medium et Small
20 000 tokens/minute et 1 requête/seconde, et 625 pages/minute pour l'OCR.
La clé active nommée « systeme pedagogique » appartient au Default Workspace
de cette organisation ; son suffixe masqué correspond à celui de la clé
serveur (comparaison booléenne, aucun secret exposé). Aucun pay-as-you-go activé.

Après lecture du quota et plusieurs minutes sans génération, une reprise
manuelle isolée du même envoi Twiny est à nouveau refusée. Deux sondes
techniques distinctes hors application, sans donnée personnelle, avec
`max_tokens: 8`, sur `mistral-medium-latest` puis `mistral-small-2603`,
retournent toutes deux HTTP 429, `type: rate_limited`, `code: 1300`,
`message: Rate limit exceeded`, sans `Retry-After`. Le refus est donc
reproductible hors du format de requête Twiny ; aucune réponse générée ni
usage facturé n'est retourné. Cause exacte côté fournisseur encore inconnue.
Le forfait affiché n'est pas épuisé : aucune nécessité de passer au payant
n'est démontrée. Le workspace ne porte aucune règle de quota personnalisée
et son plafond de dépenses est désactivé ; ces contrôles ne fournissent donc
pas d'explication au refus. Arrêt des sondes ; diagnostic fournisseur nécessaire
avant de conclure qu'un changement d'offre résout le problème.

**Précision documentaire et support — 15/09.** L'aide officielle Mistral
([limites API](https://help.mistral.ai/en/articles/698531-why-am-i-hitting-api-rate-limits-and-how-do-i-increase-them))
distingue requêtes/seconde, tokens/minute et tokens/mois. Elle indique que
l'activation du pay-as-you-go donne accès au Tier 1. Le budget en euros restant
ne suffit donc pas à exclure un plafond mensuel de tokens ; la recommandation
précédente de ne pas payer reste une prudence, pas une preuve d'inutilité du
changement d'offre. Le lien de consultation du quota mensuel fourni par l'aide
redirige dans la session vers la création d'un projet Vibe Code ; aucun projet
n'a été créé.

Un brouillon de diagnostic a été préparé dans le widget de support Mistral :
offre gratuite, consommation affichée, limites et workspace, corps minimal et
réponse 429/code 1300, demande de limite exacte et de date de réinitialisation.
Aucune clé, pièce personnelle ou donnée de paiement jointe. Le contrôle
automatique a refusé l'envoi faute d'approbation explicite de ce contenu par
Maxime ; confirmation demandée. Maxime répond ensuite « Oui, envoyer au
support » : message envoyé et présence dans le fil Intercom vérifiée.
Première réponse du bot : demande de confirmer Gratuit ou Scale, malgré cette
information dans le message initial. Réponse complémentaire préparée : Gratuit
confirmé et demande de limite exacte/réinitialisation ou de transfert technique.
Le contrôle automatique exige un nouvel accord pour cet envoi complémentaire ;
Maxime répond « oui ». La réponse exacte approuvée a été envoyée et relue
dans le fil. Aucun diagnostic spécifique au compte ni transfert humain
encore confirmé ; aucun abonnement modifié.

**Réponse du bot Mistral.** Après confirmation de l'offre gratuite, l'agent IA
du support attribue le refus à une capacité gratuite « best-effort », susceptible
d'être refusée même au premier appel. Il recommande pay-as-you-go ou des
réessais temporisés. Il ne fournit pas de vérification interne du compte,
de limite effectivement atteinte ni de transfert humain. Cette attribution
reste une explication du bot, pas une cause confirmée.
L'aide officielle confirme le passage au Tier 1 lors de l'activation du
pay-as-you-go ; la « capacité réservée » promise par le bot n'a pas été
corroborée par une source officielle consultée. Aucun réessai automatique,
achat, abonnement ou changement des limites n'a été appliqué. Le blocage
documentaire local reste distinct et non résolu.

**Activation PAYG et premier succès réel — 15/09.** Maxime a finalisé
l'abonnement lui-même ; la console affiche ensuite « Pay-as-you-go » et
« API Pay-As-You-Go Actif ». Les limites Medium passent à 500 000 tokens/minute
et 16,67 requêtes/seconde. Le plafond de workspace demandé à 5 EUR est refusé
par le formulaire (minimum 10 EUR) : après accord explicite de Maxime,
10 EUR/mois sont enregistrés sur Default Workspace, auquel appartient la clé
Twiny. Ce plafond compte l'utilisation avant déduction du forfait inclus ;
ce n'est pas un plafond global de l'organisation. Le budget de cette mission
reste de 5 EUR maximum ; le budget documentaire applicatif de 5 EUR reste inchangé.

Un nouvel envoi réel depuis `/app`, sans document joint, reprend le message
de test demandant comment commencer avec les cours et de ne rien enregistrer
ni modifier. Une réponse Mistral s'affiche, orientant vers « Commencer à
travailler » ; l'interface indique « Aucune échéance enregistrée pour cet
échange ». Aucun nouveau refus 429 sur cet essai unique. Aucune vérification DB
indépendante ni mesure du coût exact de cet appel. L'accès conversationnel
fonctionne après activation ; cela ne prouve pas la cause précise des refus
antérieurs ni la qualité du parcours complet. L'analyse documentaire reste
bloquée par sa configuration serveur locale (`MISTRAL_API_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` absentes du fichier local relevé). Aucun secret,
code applicatif, schéma ou protocole modifié ; aucun nouveau test local requis.

**Configuration documentaire demandée — 15/09.** Sur « vas-y traite ça »,
la clé du chat Mistral est réutilisée explicitement dans `MISTRAL_API_KEY`
du fichier local ignoré par Git. Le catalogue répond HTTP 200 et confirme
`mistral-ocr-4-1` et `mistral-medium-3-5`, sans génération ni document envoyé.
Les droits réels Supabase confirment que `depot_reserver` et
`depot_finaliser_cout` sont exécutables par `service_role`, pas par
`authenticated` ; le démarrage par compte est déjà disponible. La seule
configuration restante est donc `SUPABASE_SERVICE_ROLE_KEY`, dont l'emplacement
vide est préparé localement. Le connecteur ne fournit pas les clés secrètes ;
connexion au Dashboard demandée pour terminer cette configuration. Aucun
changement des fonctions, droits ou tables n'est effectué.

**Clé serveur ajoutée par Maxime — 15/09.** La clé locale correspond au rôle
`service_role` du projet attendu ; aucun secret affiché. Un accès REST serveur
à la table de budget, sans contenu retourné ni écriture, répond HTTP 200.
Après nouvelle préparation dans Twiny, « Autoriser et analyser » est actif :
Livret de Calcul ATS.pdf, pages 1 à 13, coût maximal 0,44 EUR, budget restant
5,00 EUR. Le défaut de configuration est résolu. Consentement demandé sur ce
fichier et ce coût avant transmission réelle, conformément à ADR-143.

**Premier essai documentaire autorisé — 15/09.** Maxime confirme l'analyse
du livret entier (13 pages, maximum 0,44 EUR). L'OCR réussit : 13 pages et
leur couverture sont conservées, vérifiées en base. La restitution échoue
avant enregistrement ; son message historique ne conservait pas la raison
d'arrêt fournisseur exacte. Le décompte applicatif rapproché est de
0,104 EUR pour l'OCR et 0,097971 EUR pour la restitution, soit 0,201971 EUR
au total. Ce sont des montants prudents du budget Twiny, pas la facture Mistral.

La demande de restitution précise désormais `reasoning_effort: "none"`
(format texte documenté par [Mistral](https://docs.mistral.ai/studio/conversations/reasoning))
et demande une réponse compacte dans la limite inchangée de 2 500 jetons.
La longueur excessive reste une hypothèse pour le premier échec, dont la
raison précise n'a pas été enregistrée. Les prochains arrêts `length`
produisent un message spécifique ; toute réponse inachevée reste refusée.
22 tests ciblés sur quatre fichiers passent ; TypeScript passe également.
La préparation de reprise affiche 0,34 EUR maximum, 4,80 EUR disponibles ;
elle réutilise les 13 pages déjà extraites. Nouvelle autorisation demandée
avant tout appel de reprise. Aucun statut produit promu.

**Reprise explicitement autorisée — 15/09.** Maxime autorise la nouvelle
tentative à 0,34 EUR maximum. Elle réutilise les 13 pages conservées : la base
ne contient qu'une opération OCR et deux opérations de restitution. La réponse
structurée atteint cette fois la validation des citations, qui refuse
« La citation n'existe pas dans le passage désigné. ». Aucune restitution
invalide n'est conservée ; statut `echec`, 13 pages toujours présentes.
Cela prouve la reprise sans OCR et le rejet d'une citation non retrouvée, pas
la fidélité de l'OCR ni la cause précise de cette divergence. Aucun nouvel
appel automatique ni assouplissement de la validation des sources.

Le coût prudent Twiny de cette reprise est 0,075807 EUR, soit 0,277778 EUR
au total pour l'OCR et les deux synthèses (environ 0,28 EUR) ; il reste
4,722222 EUR du budget documentaire mensuel. La facture fournisseur exacte
n'a pas été relevée. Les 22 tests ciblés, TypeScript, ESLint sur les deux
fichiers modifiés et `git diff --check` passent. Configuration résolue ;
synthèse sourcée réelle et parcours complet toujours non validés. Le prochain
diagnostic doit rendre observable la citation et son repère qui divergent,
avant de multiplier les essais payants. Aucun commit, push ou déploiement.

**Diagnostic repris et analyse aboutie — 15/09.** Sur « vas-y reprends »,
le diagnostic des sources est précisé sans assouplir leur acceptation.
La reprise signale « Résoudre les équations suivantes. » attribué à la page
PDF 6, retrouvé exactement page PDF 7. La lecture ciblée des transcriptions
confirme que la page PDF 7 est la fiche n°6 et porte le numéro imprimé 6.
La confusion de pagination explique ce repère erroné de façon cohérente ;
le raisonnement interne du modèle n'est pas observable. La consigne demande
désormais de recopier le couple `pieceId`/`page` fourni avec le texte, jamais
les numéros imprimés. Aucun repère n'est réparé automatiquement.

La vérification suivante franchit ce contrôle puis refuse une précision de
compétence dépassant 24 caractères. La consigne omettait cette borne : elle
importe maintenant les limites d'objet, précision et intitulé depuis
`atomicite.ts`, sans changer les règles métier. Après cette correction, la
dernière reprise aboutit. Les préparations manuelles restent sur le même
livret et affichent 0,34 EUR maximum ; les 13 pages conservées sont réutilisées.

Résultat vérifié dans l'interface puis en base : analyse V2 `terminee`,
13 pages, 2 sujets sourcés, 2 compétences proposées, modèle
`mistral-medium-3-5`, aucune erreur restante. Le retour et les liens vers les
sources sont visibles. Aucune nouvelle séance n'a été créée par ce test ;
l'acceptation technique ne vaut ni mesure, ni validation humaine de la
fidélité de l'OCR ou de l'interprétation.

Bilan cumulé du livret : 1 OCR et 5 synthèses, 0,508121 EUR décomptés selon
la marge prudente Twiny, aucun coût laissé incertain ; 4,491879 EUR restent
dans le budget mensuel. La facture Mistral exacte n'a pas été relevée.
Validation finale : 59 tests ciblés/5 fichiers, TypeScript, ESLint sur les
quatre fichiers TypeScript modifiés et `git diff --check` passent. Les tests
de budget et d'environnement documentaire ont également passé pendant cette
reprise ; aucun nouveau build ni suite complète. Configuration et première
analyse documentaire réelle abouties ; le parcours jusqu'au travail et la
fidélité sur corpus varié restent à éprouver. Aucun statut humain promu,
aucun commit, push ou déploiement.

### Parcours confirmé dans une fenêtre — 15/09/2026

Réalisation autorisée par Maxime après avis Product, CTO et QA : dépôt dans
l'assistant, synthèse et classement modifiable dans une fenêtre, confirmation
groupée puis priorités du moteur existant. Les liens historiques de dépôt
rouvrent cette même fenêtre. L'ancien classement automatique et sa commande
de complétion sont retirés ; `organiser:true` est refusé avant toute dépense.

La fenêtre présente les chemins hiérarchiques existants, permet un nouveau
domaine sous un parent existant et demande son usage. Les choix restent
présents à la fermeture et les lectures supplémentaires restent consenties.
Les actions sont fixes en pied de fenêtre, y compris à 390 × 844. Les lots
partiels se reprennent avec les mêmes identités ; la concurrence est testée
pour une confirmation initiale et pour deux reprises d'une commande interrompue.

Le navigateur a révélé un défaut antérieur : le convertisseur générique
supprimait `updated_at` et `created_at` des documents, rendant la confirmation
invalide. La conversion documentaire les conserve désormais avec leur
précision d'origine ; sept tests couvrent la lecture réelle jusqu'au dépôt
et le refus des dates absentes ou invalides. Le convertisseur métier général
reste inchangé.

Le script `app/supabase/tests/classement_confirmation_rejeu.sql` est exécuté
dans Supabase : création, reçu relu, rejeu sans doublon et isolation hors compte
passent sous `authenticated`, puis toute la transaction est annulée.
Ce script est un contrôle, pas une migration. Aucune nouvelle analyse Mistral
n'est nécessaire pour cette réalisation ; le livret déjà conservé sert à la
vérification visuelle. Aucun niveau ni séance n'est produit.

Validation finale de cette réalisation : `npm run verify --workspace=app --
--maxWorkers=2` passe (2 301 tests, 224 fichiers, TypeScript et ESLint sans
erreur ; 10 avertissements existants). Le build de production passe. Dans le
navigateur, une note synthétique suit la confirmation jusqu'au tableau de bord ;
son domaine et sa trace de confirmation sont relus dans Supabase. La note et
son analyse de test ont été supprimées, absence vérifiée. L'identifiant initial
de cette fixture était invalide et a été corrigé ; le refus venait du contrôle
normal des références, pas d'un défaut d'hydratation de l'interface.

Le serveur local reste disponible. Aucune dépense Mistral supplémentaire,
aucune modification du classement personnel du livret, aucun commit, push ou
déploiement. La fidélité sur corpus varié reste à éprouver ; ce contrôle porte
sur le parcours, la persistance et les garde-fous.

### Retour sur la pertinence et la lisibilité — 15/09/2026

Le livret de calcul a été proposé dans un domaine industriel parce que le
modèle a confondu discipline enseignée et utilité pour les sciences industrielles.
La lecture réelle confirme qu'il s'agit de la proposition conservée, pas d'un
classement confirmé. La consigne favorisait les domaines existants sans poser
assez clairement leur nécessaire pertinence ; elle est corrigée dans le prompt
partagé. Les propositions anciennes ne sont pas réécrites et aucune nouvelle
analyse payante n'est déclenchée. Un essai fournisseur reste nécessaire pour
mesurer l'effet de cette correction sur le modèle.

La fenêtre réduit l'aperçu de synthèse, permet sa lecture complète et regroupe
les compétences, sources et réserves. Le choix du classement reste visible et
le nombre de créations est annoncé avant confirmation. Preuves de cette reprise :
[compte rendu](../../ai-company/operations/runs/2026-09-15-lisibilite-classement.md).

Second retour du 15/09 : le choix temporaire ne survivait pas au rechargement.
Un brouillon humain persistant et un éditeur sans menus déroulants remplacent ce
fonctionnement. Le livret retrouve désormais « Mathématiques » après sauvegarde
et rechargement réels ; son usage reste à préciser, aucune confirmation finale
ni création de référentiel n'a été effectuée. Le texte original de Mistral reste
inchangé. Les anciens liens absents sont distingués des erreurs réseau.

Validation : 2 329 tests / 229 fichiers passent, puis quatre tests du conteneur
après l'amélioration d'affichage immédiat ; TypeScript et lint passent. Le test
navigateur couvre sauvegarde/rechargement et retrait d'un lien absent. Aucun
appel Mistral supplémentaire. Les limites réseau et viewport sont dans le
compte rendu de reprise.

### Troisième reprise — compétences visibles et couverture des chapitres

Demande du 15/09 : supprimer le volet déroulant confus et expliquer les deux
compétences malgré les nombreux chapitres. La consigne demandait explicitement
au plus deux propositions ; le validateur en autorisait six. Cette restriction
est retirée : les gestes distincts enseignés sont demandés avec leurs citations,
et jusqu'à 30 propositions sont recevables. Une liste n'est pas une mesure et
ne devient pas exhaustive par ce seul changement de consigne.

Les compétences sont directement visibles, sélectionnables, avec pages sources.
Les incertitudes restent visibles et les citations sont consultables séparément.
« Compléter les compétences » prépare une nouvelle synthèse des transcriptions
de l'analyse choisie, après vérification du fichier, sans nouvel OCR. Nouveau
consentement tarifé requis ; le choix humain du domaine est conservé pour la
relecture, sans recycler les anciens indices de compétences.

La sortie reste à 2 500 jetons, coût maximal de synthèse 0,3375 EUR ; le budget
reste de 5 EUR par mois UTC. Le relèvement à 8 192 est différé : l'accès externe
Codex a été refusé (session révoquée), aucune migration distante ni nouvelle
analyse fournisseur n'a été effectuée. Les deux propositions historiques du
livret restent donc inchangées tant qu'un complément n'a pas été autorisé et réussi.

### Quatrième reprise — parcours fluide du 16/09/2026 (état courant)

La demande de Maxime remplace le parcours précédent : joindre les ressources,
« Préparer ma proposition », puis relire synthèse, organisation et compétences
dans une seule fenêtre et « Valider et voir mes priorités ». Le fournisseur,
les vingt premières pages au maximum par fichier et le plafond sont annoncés
dans la saisie. Cette autorisation déclenche les nouveaux dépôts de la saisie,
jamais une relance d'un résultat historique. Une erreur garde une reprise
explicite tarifée ; aucune boucle payante automatique n'est introduite.

La sortie V2 passe à 8 192 jetons, V1 reste à 2 500. La migration
`20260915220807_depot_restitution_v2_sortie_8192.sql` est appliquée dans Supabase,
avec tests transactionnels des bornes et du rejeu sans consommation persistante.
Le budget reste de 5 EUR par mois UTC. Le plafond d'une synthèse Mistral est
0,42288 EUR, affiché 0,423 EUR. Cette section remplace le report de migration
et le plafond V2 décrits dans la troisième reprise.

L'essai autorisé à 0,423 EUR a été interrompu le 15/09 à 22:19 UTC pendant une
mise à jour de l'interface : analyse `0af7ae38-6427-46d5-923d-887e011c8d04`,
réservation Twiny de 0,299466 EUR, facturation fournisseur inconnue. Aucun nouvel
OCR. Une vue qui se remonte n'annule plus l'appel déjà autorisé ; le bouton
« Arrêter » reste explicite. Une ancienne erreur vide ne bloque plus la lecture
du document. L'ancien résultat à deux compétences est de nouveau visible.
La qualité de la nouvelle synthèse reste à vérifier sur un nouvel essai autorisé.

La reprise supplémentaire autorisée a répondu à 22:32 UTC, pour 0,138984 EUR
décomptés par Twiny, mais sa citation du sommaire recomposée a été rejetée.
La consigne précise désormais de citer une seule cellule ou ligne exacte,
sans concaténation. Test de régression du tableau et 36 tests ciblés passent ;
aucune nouvelle liste de compétences validée n'a encore été obtenue.
