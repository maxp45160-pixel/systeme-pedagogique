# Twiny V1 — registre du pilote documentaire

Mis à jour le 06/09/2026. Contrats : [PRODUCT](../../PRODUCT.md),
[ADR-143](../../ARCHITECTURE_DECISIONS.md#adr-143),
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

La boucle permet de conserver une note et plusieurs fichiers, confirmer
l'analyse Mistral, relire les éléments sourcés et ajouter des corrections,
puis ouvrir une séance de lecture et reformulation sans compétence ni mesure.
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

Les fichiers sélectionnés partent entiers à Mistral, avec les pages à traiter
explicitement bornées à vingt au total. Les PDF mixtes passent par la lecture
visuelle. La restitution reçoit uniquement la note et les extractions de la
tranche ; elle ne propose ni échéance, ni compétence, ni plan.
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
