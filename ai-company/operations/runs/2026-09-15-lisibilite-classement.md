# Lisibilité et classement documentaire — 15/09/2026

## Mandat

Maxime demande pourquoi un livret de mathématiques est proposé dans « logistique industrielle » et autorise l'amélioration de la fenêtre, jugée trop dense et peu lisible. Livraison locale, diagnostic du cas réel, correction ciblée des instructions et présentation ; aucun nouvel appel fournisseur ou changement de classement personnel sans confirmation.

## État initial vérifié

La proposition enregistrée vient du modèle : le document n'a aucun domaine confirmé. Sa justification assimile l'utilité du calcul pour les sciences industrielles à l'appartenance à la logistique. Le prompt favorise les domaines existants sans condition suffisante de pertinence. La citation source mentionne pourtant le programme de mathématiques collège/lycée. Aucun remplacement de la réponse historique n'est effectué.

## Répartition

CTO : instructions documentaires et tests. Product : fenêtre et tests UI. Coordinateur : diagnostic Supabase en lecture seule, intégration, navigateur, preuves et documentation. Les modifications préexistantes sont conservées.

## Vérifications

- QA : 38 tests passent dans quatre fichiers (fenêtre, Mistral, validation du
  dépôt, contrat de classement). La consigne envoyée est vérifiée, pas la
  pertinence d'une nouvelle réponse du fournisseur.
- ESLint des cinq fichiers TypeScript concernés et contrôle du diff passent.
- Navigateur : titre unique, aperçu trois lignes, expansion du résumé et des
  détails, provenance de la suggestion et créations annoncées vérifiés sur
  ordinateur et à 390 × 844. Nouveau domaine, garde-fou d'usage obligatoire,
  fermeture par Échap et reprise des choix vérifiés sans écriture serveur.
- Une fixture UI contenait un palier invalide détecté par TypeScript ; elle
  utilise désormais un palier autorisé sans assertion de type. Les huit tests
  UI et TypeScript passent après cette correction finale.
- `agents:check` et `git diff --check` passent. Aucun nouveau build de production
  ni suite complète dans cette reprise ciblée.

Révision : base `60c8617` et diff local conservé. Cette reprise touche
`modale-ressources.tsx`, son test, `ressources-conversation.tsx`,
`depot-mistral.ts` et son test ; PRODUCT, ADR et les deux références documentaires
suivent ces changements. Les modifications antérieures du checkout sont gardées.

## Livraison et limites

Le prompt privilégie maintenant le sujet enseigné et autorise un nouveau
domaine pertinent ou l'absence de suggestion. Aucune règle spécialisée pour
les mathématiques n'est ajoutée. L'ancienne restitution reste traçable et n'est
pas réécrite. Aucun nouvel appel Mistral, aucune migration, aucun déploiement.

Un brouillon « Mathématiques » est préparé dans la fenêtre pour le livret ;
son usage reste à choisir avant confirmation. Ce brouillon appartient à l'état
de la fenêtre, pas à la base. La réponse historique et les données pédagogiques
n'ont pas été modifiées. La fenêtre est laissée disponible pour examen.

## Reprise après le second retour utilisateur

Maxime signale que les ressources ne sont pas identifiables, que l'actualisation
est incompréhensible, que les menus sont ambigus et que « logistique industrielle »
revient. La première livraison n'avait pas résolu la conservation du choix : son
brouillon était seulement local. Le périmètre est repris sous le même identifiant.

Le brouillon humain est désormais conservé dans le frontmatter, avec version
attendue et analyse désignée. Les tests couvrent concurrence, rejeu, compte,
analyse périmée, données invalides et absence de création de référentiel.
Le rangement final, y compris par les autres chemins, efface ce brouillon.
L'interface affiche un chemin et un éditeur explicite ; aucune liste déroulante
de classement n'est présentée. Le pied reste désactivé pendant l'édition.

Les fichiers sont identifiés dès l'en-tête. Un lien absent du compte n'est plus
présenté comme une ressource conservée à actualiser. Le retrait de ce lien de
l'échange n'efface aucun document. Une panne de préparation conserve la ressource
et son résultat ; celui-ci peut s'afficher sans attendre la préparation suivante.

### Preuves de la reprise

- Suite complète : 2 329 tests / 229 fichiers passent avec TypeScript et ESLint
  (10 avertissements préexistants). Après l'amélioration d'affichage immédiat,
  les quatre tests du conteneur passent, TypeScript et lint ciblé repassent.
- Revue indépendante QA : 51 tests / huit fichiers, deux risques corrigés
  (ancien brouillon après correction et analyse devenue périmée avant écriture).
- Outils agents : 29 tests et contrôle des fiches passent ; diff sans erreur.
- Navigateur réel : « Mathématiques » enregistré par « Garder ce choix », puis
  rechargement complet. La carte retrouve Mathématiques et « Votre choix est
  conservé ». Usage laissé à préciser, aucune confirmation finale envoyée.
- Ancien lien de la fixture supprimée : état « Document indisponible », aucune
  analyse proposée, retrait du lien ferme la fenêtre. Aucun document créé.
- Pendant ce contrôle, une lecture Supabase a échoué par `fetch failed` ; une
  nouvelle ouverture a abouti. Une requête SQL de vérification a aussi échoué
  côté connecteur ; la preuve de persistance est le rechargement navigateur.
- Rendu vérifié au viewport réel 910 × 698. L'outil n'a pas appliqué la taille
  mobile demandée lors de cette reprise : pas de nouvelle preuve mobile revendiquée.

Fichiers supplémentaires de la reprise : brouillon-classement (contrat, action,
tests), lecteur depot-documents, rangement commun, identification des ressources,
chat, conteneur et éditeur de classement. Base Git inchangée `60c8617`, autres
modifications locales conservées. Aucun nouvel appel fournisseur, migration,
commit, push ou déploiement. Le brouillon Mathématiques persiste maintenant dans
le document ; il remplace le brouillon temporaire décrit dans la première livraison.

## Reprise : volet déroulant et couverture des chapitres — 15/09/2026

Autorité : « MIEUX, mais reprends le menu déroulant qui est toujours moche et
pas instinctif + pk ya que 2 compétences de proposées alors que ya plein de
chapitres traités ». Reprise de UX-0001 ; aucun nouveau budget autorisé.

Cause établie : la consigne de concision V2 imposait au plus deux propositions,
avec un validateur limité à six, malgré une sélection métier limitée à trente.
La consigne décrit désormais les gestes distincts par chapitre, tous sourcés,
sans identité artificielle chapitre = compétence. Validation et sélection sont
alignées à trente ; aucune mesure ou compétence n'est créée par l'analyse.

Réalisations locales : compétences directement visibles avec cases et pages,
incertitudes séparées, sources consultables à part ; action de complément sur
les transcriptions de l'analyse choisie, consentement distinct, empreinte liée
à l'analyse et à la consigne, contrôle de l'original avant réutilisation.
Le domaine humain reste à la relecture ; les indices des anciennes propositions
ne sont pas réutilisés après un complément.

Limites : accès navigateur refusé par auto-review car jeton Codex révoqué ;
MCP Supabase renvoie Internal error, CLI non privilégié échoue sur son écriture
de télémétrie, élévation refusée pour la même session révoquée. Reconnexion
Codex demandée ; aucun contournement. Sortie conservée à 2 500 jetons pour
rester compatible avec la fonction SQL. Aucun schéma ni migration modifiés.
Aucun appel fournisseur, aucune confirmation de classement réelle.
L'ancienne analyse garde ses deux propositions ; couverture réelle et rendu
final restent à vérifier après reconnexion et consentement distinct au complément.

Vérification finale de cette reprise : `npm run verify --workspace=app -- --maxWorkers=2`
passe : 2 342 tests / 229 fichiers, TypeScript sans erreur, ESLint sans erreur
(10 avertissements préexistants). Une attente de test obsolète — abandonner le
domaine humain après nouvelle analyse — a été remplacée par le contrat demandé :
domaine/usage conservés, anciens codes et indices non recyclés. 59 tests ciblés
passent aussi ; la revue QA confirme le GET sans appel payant et la référence
`syntheseDe` jusqu'au POST. `agents:check` et `git diff --check` passent.

Statut UX-0001 : bloqué sur vérification navigateur réelle après reconnexion,
pas sur tests locaux. Aucun résultat visuel ou fournisseur inventé. Sortie2500
conservée ; prochain essai documentaire nécessite son consentement spécifique.

Reprise de connexion : accès CUA rétabli après demande utilisateur. Serveur local redémarré avec npm run dev. Page Twiny ouverte sur login ; connexion Google lancée, session pas encore établie. Aucun appel documentaire ni écriture métier.

## Reprise du 16/09 : fluidité avant optimisation du coût

Autorité : Maxime demande saisie → proposition automatique (synthèse,
organisation, compétences) → validation unique ; les étapes « relancer »,
« actualiser » et « classifier » cassent son usage. Il accepte de privilégier
la qualité malgré un coût supérieur. Budget pilote existant5EUR maintenu.

Diagnostic réel : la dernière synthèse Mistral du livret (13 pages conservées)
a échoué le15/09 à21:59UTC sur finish_reason length. Un essai Qwen précédent
a échoué403Unpurchased. L'ancienne synthèse reste à deux compétences.
La migration distante 20260915220807_depot_restitution_v2_sortie_8192 est appliquée,
avec contrôle postmigration : sortie8192, INVOKER, search_pathvide, service_role
seul et budget5EUR inchangés. V1 reste2500 ; synthèse V2 jusqu'à0,42288EUR.

La saisie annonce fournisseur, couverture et plafond, capturés au clic. Le reçu
d'un nouveau dépôt transmet cette autorisation à la fenêtre ; une réouverture
historique ne la recrée pas. La proposition se modifie directement et se valide
en un geste. Les erreurs ne déclenchent pas de boucle payante.

#### Essai autorisé et interruption

Maxime a explicitement autorisé la reprise des 13 transcriptions Mistral à
0,423 EUR maximum. L'analyse `0af7ae38-6427-46d5-923d-887e011c8d04` a démarré
à 22:19:05 UTC le 15/09 et a été interrompue à 22:19:19 pendant le développement
de la vue. La réservation de restitution est de 299466 micro-EUR ; sa facture
est NULL, ce qui ne prouve pas une absence de consommation chez Mistral.
Aucun remboursement ni nouvelle tentative implicite. Accord supplémentaire
demandé pour un nouvel essai à 0,423 EUR.

Corrections de reprise : remontage de vue sans annuler l'appel en cours,
préservation des lignes déjà chargées, tolérance d'une erreur historique vide
comme diagnostic absent et écriture d'un diagnostic non vide à l'avenir.
L'ancien résultat, le nom du PDF et Mathématiques sont vérifiés dans le navigateur.

Vérification : suite générale 2353 tests / 230 fichiers, TypeScript et ESLint
sans erreur (10 avertissements préexistants). Après correction de l'erreur vide,
30 tests ciblés passent, dont deux nouveaux cas d'interruption. Nouvelle
synthèse et couverture réelle des chapitres restent non vérifiées à ce stade.

#### Reprise explicitement autorisée par « vas-y »

Nouvel appel Mistral à 22:32 UTC, sans nouvel OCR, après accord supplémentaire
à 0,423 EUR. Même analyse, nouvelle tentative
`fc20d333-7cdd-4161-8eba-ed117525a315` : coût rapproché par Twiny de
138984 micro-EUR (0,138984 EUR), échec à 22:32:51. Mistral a concaténé les
intitulés du sommaire avec des barres en les présentant comme une citation
continue. La page originale est un tableau avec numéros et lignes distinctes ;
le rejet est correct. Aucun assouplissement de la validation des sources.

La consigne demande désormais une citation courte sur une seule ligne ou
cellule, sans concaténer les intitulés. Un test reproduit le tableau et refuse
la citation recomposée tout en acceptant les cellules exactes séparées.
36 tests fournisseurs et validation passent. Cette précision de consigne ne
prouve pas encore la fiabilité d'un nouvel appel. Le résultat brut rejeté n'est
pas conservé ; les pages et l'ancien résultat restent accessibles dans la fenêtre.
La QA indépendante n'a établi aucun nouveau défaut sur les correctifs React
et le traitement des erreurs vides. Aucune autre tentative payante lancée.
