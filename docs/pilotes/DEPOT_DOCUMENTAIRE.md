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
