# Assistant d'entrée — référence et reprise progressive

## Parcours courant — amendement demandé le 16/09/2026

**Extension P01-0002 approuvée ensuite le 16/09, code local préparé :** un nouveau
sujet peut donner lieu à un domaine d'organisation sans compétence obligatoire ni
usage académique déduit, avec le contrôle des ambiguïtés/collisions. Le choix humain
propose ce cadre par défaut ; le module garde son année explicitement déclarée.
Une création partielle reste signalée et se reprend sans relancer l'IA. Retirer le
rattachement conserve l'original et le domaine, avec refus durable de ce lien.
La migration `20260916183000_domaines_organisation_vides.sql` demeure **en attente** ;
la base distante n'accepte pas encore la création vide. Le détail P01-0001 ci-dessous
décrit la tranche précédente, amendée par cette extension et par
[son mandat](../../ai-company/operations/runs/2026-09-16-p01-domaines.md).

Le dernier accord humain borne P01-0001 : **nouvelle ressource → première analyse
→ domaine existant rattaché si le cas est admissible → contrôle par document**.
La fenêtre présente la synthèse courte, la couverture réelle, le rattachement
effectué et les points à contrôler. « Appliquer ce choix » concerne seulement le
document visé. « Fermer » conserve les ressources sans appliquer les points en
attente ; fermer et rouvrir ne relance ni analyse payante ni rangement automatique.
Les sources humaines et preuves locales sont dans le
[mandat P01-0001](../../ai-company/operations/runs/2026-09-16-p01-classification.md).

Cet accord remplace la confirmation globale et la navigation forcée vers le tableau
de bord des relevés historiques ci-dessous. Le rattachement automatique porte
uniquement sur un domaine vivant explicitement identifié et sourcé, sans incertitude
signalée ni choix/correction/brouillon antérieurs. Il ne crée ni domaine ni compétence
et n'associe aucun code. « Retirer ce rattachement » conserve un refus humain, même
après réanalyse ; le support reste disponible sans domaine. Les compétences proposées
restent consultables et non précochées après délégation. Les liens de dépôt reviennent dans l'assistant, sans
imposer une page de revue distincte. La confirmation réutilise les commandes
du référentiel et permet un nouveau domaine sous un parent existant ; son usage
doit être déclaré. Les résultats partiels d'écriture restent visibles.
Une création humaine actualise les domaines et compétences disponibles pour les
documents suivants, sans effacer leurs saisies. Une ambiguïté ne bloque pas les
documents indépendants. La pertinence sur corpus réel reste à éprouver ; P01-0001
ne clôt pas le pilote fournisseur d'UX-0001.

Le tableau de bord utilise son moteur immédiat. Sans observation, il indique
que le niveau reste à observer ; aucun score ne provient du document importé.
Le planificateur global et le calendrier ne sont pas raccordés par ce chantier.
Les validations réelles de cette réalisation sont ajoutées en fin de document.

Après le retour sur la lisibilité du 15/09, l'aperçu de synthèse est limité à
trois lignes et peut être déplié. Le classement est mis en évidence ; le nombre
de compétences créées reste visible. Les compétences sont sélectionnables
directement, avec leurs pages sources ; les réserves sont visibles et les citations
se consultent séparément. Une suggestion de l'IA est identifiée comme telle. Le prompt classe
selon la matière enseignée, sans forcer un domaine existant au seul motif que
ces connaissances y seraient utiles. Une réponse déjà conservée n'est pas
réécrite par ce changement d'instruction.

La reprise suivante du 15/09 remplace les menus déroulants par un chemin lisible
et « Modifier » : domaine existant, nouveau domaine ou nouveau sous-domaine,
avec choix expliqués du type de matière. Depuis le 16/09, les changements sont
directs : le bouton du document conserve le brouillon puis confirme, sans bouton
intermédiaire « Garder ce choix ». Les noms des fichiers restent visibles en
en-tête. Les anciens liens devenus inaccessibles sont signalés séparément et
peuvent être retirés de l'échange sans supprimer un document.

« Préparer ma proposition » autorise le dépôt et l'analyse automatique des
nouvelles ressources avec un plafond et un fournisseur annoncés dans la saisie.
Le parcours normal ne présente plus « Compléter les compétences », « Actualiser »
ni une seconde autorisation. Un échec propose une reprise explicite et son coût ;
les transcriptions déjà conservées sont réutilisées sans nouvel OCR.
Le choix humain du domaine survit à cette nouvelle analyse ; les compétences
sont à relire et leurs anciens indices ne sont pas réutilisés.

Le temps disponible est modifiable au tableau de bord. Une ressource de
30 minutes n'est pas présentée comme tenant dans 25 minutes ; les conventions
de durée et les seuils du moteur sont conservés. La carte distingue l'étude
d'une ressource de l'entraînement et permet de revenir aux priorités.

10/09/2026 : lot 0 documentaire terminé. Lot 1 implémenté localement les
10–11/09/2026, validation réelle bloquée côté fournisseur. Référence issue des réponses explicites de Maxime dans la conversation du
10/09 ; les choix d'implémentation ci-dessous restent des propositions.

## Intention validée par Maxime

Twiny s'aborde en parlant, sans connaître son interface ou son modèle métier.
Raconter sa journée, partager éventuellement des ressources, demander quoi
travailler ou discuter de son organisation sont des entrées de même importance.
Le dépôt documentaire n'est pas la porte d'entrée obligatoire.

En surface, un assistant ; en arrière-plan, une administration fiable du système :

- Solliciter les cours, exercices et notes utiles au besoin exprimé.
- Conserver les ressources, réutiliser le référentiel, créer les domaines et
  compétences justifiés et relier les ressources concernées.
- Exploiter les contraintes déclarées et les niveaux réellement observés pour
  proposer des étapes accessibles, ordonnées par priorité.
- Alimenter les prochaines actions du tableau de bord et programmer ou
  reprogrammer les séances dans les disponibilités données, sans confirmation
  systématique. Maxime a explicitement autorisé cette autonomie.
- Permettre de modifier les séances librement, sans justification. Les événements
  d'organisation peuvent nourrir une analyse des habitudes, pas mesurer une
  compétence à eux seuls.
- Ouvrir un espace adapté à l'activité : réviser, mémoriser, appliquer, reformuler,
  lire, écrire, expliquer ou créer. L'assistant reste disponible et relit les
  données du système pour tenir compte du travail réellement effectué.
- Donner un retour bref sur le besoin compris et les actions réellement faites.
  Un échange sans suite ou une demande incomprise le signale explicitement.
- Corriger par conversation les éléments visés. Ne demander une précision sur
  la généralisation de cette correction que lorsqu'elle est ambiguë.

L'organisation claire peut être appliquée automatiquement avec un bilan
corrigeable. Une ambiguïté qui change la décision entraîne une question ciblée.
Sans ressource ou niveau observé, une première activité pertinente peut être
proposée pour situer le point de départ ; aucune valeur de niveau n'est inventée.

## Ce qui n'est pas encore décidé

- La composition exacte de l'accueil. Maxime envisage la conversation à la
  première visite du jour, mais veut aussi pouvoir venir simplement travailler.
  Proposition : conversation et accès permanent « Commencer à travailler »,
  sans étape obligatoire de conversation terminée ni état quotidien persisté.
- La conservation durable des conversations complètes : aucune décision prise.
  Leur historique ne remplace pas les ressources et contraintes enregistrées.
- La forme des vues directes de contrôle. Proposition : conserver Mes cours,
  Séances et Progression, avec correction conversationnelle privilégiée.
- La portée, la suspension et la représentation applicative de la délégation
  d'autonomie. L'accord produit de Maxime n'est pas encore une autorisation
  persistée pour tous les comptes.
- Les règles de sélection des documents accessibles au modèle. « Garder les
  ressources en tête » ne décide pas de transmettre tout le corpus à chaque tour.
- La traduction technique du récit en faits sourcés, la gestion des actions
  partielles et la politique de conservation des traces d'exécution.

## Scénario cible de référence

« Aujourd'hui j'ai fait deux heures de probabilités, je n'ai rien compris aux
lois conditionnelles et j'ai un contrôle vendredi. »

1. Reconnaître le travail et la difficulté déclarés, inviter à joindre les
   ressources étudiées. Résoudre la date ou le cours si l'ambiguïté importe.
2. Conserver les ressources reçues et les informations déclarées dans les
   structures appropriées. Ne pas affirmer une écriture qui n'a pas réussi.
3. Réutiliser les domaines et compétences existants ; ajouter et relier ce qui
   est clairement justifié. Ne pas attribuer un niveau à partir de cette phrase.
4. Déduire une progression depuis les observations disponibles ; si elles
   manquent, proposer un point de départ adapté et expliciter cette réserve.
5. Alimenter la file de travail et les séances selon contraintes et délégation.
6. Montrer une synthèse brève, les actions accomplies et la prochaine activité.
   Une correction ultérieure modifie les éléments concernés sans tout refaire.

Ce scénario décrit la cible complète, pas les capacités de la première livraison.

## Diagnostic ciblé de l'existant

Inspection locale des signatures, types, imports, points de raccordement et
libellés. Aucun parcours authentifié ni appel fournisseur exécuté dans ce lot ;
aucun état Supabase réel ou résultat de test antérieur n'est requalifié en preuve
actuelle. Le travail de Sol est présent sous forme de modifications non commitées.

| Élément constaté | Sources dans le dépôt | Conséquence pour la reprise |
|---|---|---|
| L'accueil pilote mène au dépôt ; la voie classique reste distincte | `app/src/app/(app)/app/page.tsx`, `components/depot/accueil-du-jour.tsx` | Remplacer progressivement l'entrée obligatoire par la conversation ; préserver l'accès direct au travail. |
| Le classement affiche « 1. Référentiel », une fin de revue, puis « 2. Ressources » | `app/src/components/depot/organisation-jour.tsx` | Cause principale de friction : l'interface impose de gérer le référentiel. Retirer ce passage obligé lors du lot d'organisation, pas seulement renommer les boutons. |
| Une commande marque la revue et une autre range la ressource avec version attendue | `app/src/lib/store/depot-actions.ts` | Le couplage ne se limite pas au visuel. Réexaminer le contrat serveur avant de supprimer les validations d'écran. |
| V2 sépare fichiers et note ; types d'organisation, liens Markdown, tests associés existent | `lib/documents/depot.ts`, `organisation-depot.ts`, `lib/store/depot-documents.ts` sous `app/src/` | Conserver comme candidats à réutilisation : originaux, validation des références, rangement et reprise. Leurs tests devront être exécutés avant intégration. |
| Le tuteur a un chat, un tiroir global, un flux de réponse et des propositions typées | `app/src/components/tuteur/chat.tsx`, `tiroir-tuteur.tsx`, `app/src/app/api/tutor/route.ts`, `app/src/lib/tutor/outils.ts` | Réutiliser les composants et le transport ; ce constat ne prouve pas un administrateur autonome. Ne pas dupliquer le chat. |
| Le chat documente une conversation en `sessionStorage`, isolée par compte ; la requête transmet une fenêtre de messages | `chat.tsx` : `ProprietesChat`, `route.ts` : `CorpsRequeteTuteur` | Ne pas confondre continuité de conversation et mémoire métier durable. |
| Des commandes d'échéance et de profil sont exposées | `app/src/lib/store/engagement-actions.ts` : `creerEngagement`, `referentiel-actions.ts` : `modifierProfil` | Tester d'abord une écriture métier existante depuis le dialogue. Aucune nouvelle mémoire générique n'est justifiée à ce stade. |
| Le planificateur reçoit contraintes, observations, candidats et séances ; les commandes acceptent/déplacent/révisent | `app/src/lib/engine/planification-temporelle.ts`, `plan-candidates.ts`, `revision-plan.ts`, `app/src/lib/store/plan-actions.ts` | Fondations candidates, à qualifier. ADR-139 documente le retrait de l'intégration globale le 30/08 : ne pas la réactiver en bloc. |
| `BesoinDeclare.intention` exige les mots de la personne ; contexte documentaire et acceptation sont encadrés | `app/src/lib/domain/types.ts`, ADR-124, ADR-139, ADR-144 | Une nouvelle orchestration demande des amendements explicites, pas un prompt qui contourne les contrats. |

À garder : persistance des originaux, validations métier, isolement par compte,
identités serveur, commandes existantes, activités et observations. À remplacer
progressivement : le tunnel documentaire et les revues imposées comme accueil.
À construire et prouver : actions conversationnelles fiables, contexte durable
pertinent, organisation autonome et planification sous délégation.

## Première tranche : conversation → échéance → travail

Découpage proposé par Codex puis mise en œuvre du lot 1 demandée par Maxime.
Une échéance est un premier fait utile, observable après rechargement, disposant
d'une commande existante. Elle permet d'éprouver l'administration par conversation
sans dépendre de l'OCR, du classement ou du planificateur global.

Exemple : « J'ai un contrôle le 18 septembre 2026 sur les probabilités. »

- Accueil conversationnel avec accès direct au tableau de bord existant.
- Reconnaissance d'une échéance d'examen clairement déclarée ; réutilisation de
  `creerEngagement` après vérification de son contrat et de ses dépendances.
- Question ciblée si la date ou une référence nécessaire manque ; ne pas rendre
  obligatoire un rattachement que le métier permet de laisser facultatif.
- Retour fondé sur le résultat serveur : échéance enregistrée ou erreur explicite.
- Accès au travail existant. Ne pas annoncer un plan adapté ou une file réordonnée
  tant que ces capacités ne sont pas raccordées.
- Une question sans action reçoit une réponse explicite sur l'absence d'écriture.

Cette tranche ne conserve pas encore tout le récit de la journée. Elle ne crée
pas de référentiel, ne classe pas de document et ne programme aucune séance.
Ces limites doivent rester visibles pendant l'essai ; un simple chat qui promet
de mémoriser sans écriture réelle ne remplit pas le contrat.

### Conditions de fin et vérification

1. Venir travailler sans parler reste possible au clavier et sur mobile.
2. Une déclaration claire crée une échéance réelle, relisible après rechargement ;
   sa date et son libellé correspondent à la déclaration, sans mesure produite.
3. Une ambiguïté ne crée rien avant clarification ; une question sans suite
   n'entraîne aucune écriture métier.
4. Un rejeu technique du même envoi ne crée pas de doublon. Une seconde déclaration
   potentiellement identique est traitée distinctement d'un rejeu réseau.
5. Une écriture échouée n'est jamais annoncée comme réussie ; un flux interrompu
   après écriture permet de retrouver le résultat sans relancer aveuglément.
6. Les commandes restent limitées au compte autorisé et les données invalides
   sont rejetées avant écriture. Aucun accès privilégié n'est donné au modèle.
7. Le modèle ne déduit pas une difficulté mesurée de « je n'ai rien compris ».
8. Tests ciblés de ces contrats, vérifications TypeScript/lint et parcours
   authentifié réel avant de déclarer la tranche livrée. Vérification adaptée
   de production avant fusion, puis essai par Maxime avant extension des pouvoirs.

Avant codage : lire les corps des seules fonctions à modifier, vérifier le
contrat réel de la commande et l'entrée tuteur via `envTuteur`, proposer le
mécanisme minimal d'idempotence/récupération et amender les ADR touchées. Une
migration éventuelle impose la comparaison avec Supabase réel ; elle n'est pas
présumée nécessaire. Aucune dépendance nouvelle sans confirmation.

## Ordre de progression et règle d'arrêt

| Lot | Résultat observable | Condition avant extension |
|---|---|---|
| 0 — cette référence | Intention, écarts et première tranche documentés | Terminé ; application inchangée. |
| 1 — première écriture | Échéance fiable depuis la conversation et accès au travail | Contrats ci-dessus vérifiés et essai utilisateur. |
| 2 — ressources et organisation | Dépôt dans l'échange, rangement cohérent, correction locale | Sources conservées, références valides, absence de doublons, reprise partielle démontrée. |
| 3 — prochaines actions | Progression proposée depuis les faits et observations | Priorités et réserves compréhensibles sur un cas réel, niveau inconnu respecté. |
| 4 — calendrier délégué | Séances programmées et déplacées dans les disponibilités | Portée de délégation explicite, modifications libres, reprise fiable, aucune pénalité. |

Chaque lot se termine par un résultat essayé et un point de reprise : fichiers
touchés, contrôles réellement exécutés, limites et prochaine action. Pas de
refonte transversale préalable, pas de réactivation globale du code expérimental.
Si le même blocage revient sans nouvelle preuve, arrêter les réessais et livrer
son diagnostic avec les éléments nécessaires pour le résoudre. Si le lot exige
un autre domaine de travail, le redécouper avant de continuer.

## Point de reprise du 11/09/2026

**Correction ultérieure demandée par Maxime :** parler et déposer doivent
utiliser une seule saisie. Les pièces jointes sont désormais intégrées au chat
d'accueil, y compris les dossiers et le glisser-déposer. Le bouton Envoyer
conserve les fichiers et le texte joint (note séparée), puis affiche les reçus
dans le fil. Le transfert V2 est partagé avec la lecture des anciens dépôts.
`?nouveau=1` ne mène plus à une autre interface ; le raccourci global ouvre
l'assistant. L'envoi documentaire n'appelle pas l'IA : conservation et analyse
restent distinguées dans le reçu. Un texte sans fichier reste conversationnel.
Cela remplace le choix initial d'un dépôt accessible par un lien séparé, sans
déclarer le lot 2 complet ni lever le blocage fournisseur.

Le lot 1 est implémenté localement : accueil pilote réutilisant `ChatTuteur`,
outil d'accueil dédié, commande d'examen via `creerEngagement`, idempotence
adossée à la PK existante, reçu serveur et vérification après interruption sans
appel IA. Les autres comptes et les activités existantes gardent leurs chemins.
La capture est maintenant intégrée à la conversation. Aucun plan ni mesure n'est écrit.

Les codes, domaines et niveaux ne sont pas transmis dans ce premier chemin.
Il demande une date absolue complète ; le libellé provient des mots de la
personne. Une nouvelle déclaration distincte n'est pas une reprise technique :
la déduplication sémantique reste une limite à éprouver avant extension.
Les conversations et envois en attente restent dans la session du navigateur,
isolés par compte. Le changement de compte remonte un chat indépendant.

Preuves obtenues :

- 45 tests ciblés passent : parser, provenance de date/libellé, erreurs
  fournisseur, route, absence d'écriture sur clarification, reprise et commande.
- TypeScript et lint ciblé passent après les corrections du 11/09.
- Suite complète finale du 11/09 : **2 204 tests réussis dans 209 fichiers**.
  Le dépassement de délai du scanner lors du premier passage sous charge ne
  se reproduit ni seul ni dans cette exécution complète ; aucun seuil modifié.
- Build de production final du 11/09 réussi après autorisation de l'accès
  réseau nécessaire au téléchargement des polices Google Fonts existantes.
  Le premier essai en environnement restreint échouait sur ces téléchargements.
- Schéma/PK/RLS inspectés dans Supabase réel ; script
  `app/supabase/tests/assistant_echeance_idempotence.sql` exécuté le 11/09 sous
  `authenticated` : écriture, relecture, unicité, refus d'écriture et de lecture
  hors compte réussis. Transaction annulée, aucune donnée de test conservée.
- Navigateur authentifié : accueil et saisie chargent ; une question de conseil
  rencontre une limitation fournisseur (quota/débit, HTTP 429). Le message
  contrôlé l'explique, aucune écriture n'est annoncée. La vérification de reprise
  du 10/09 ne retrouve aucune échéance ; elle ne lance pas d'appel fournisseur.
- « Commencer à travailler » ouvre effectivement le tableau de bord, même
  lorsque l'IA échoue, au clic et par Entrée au clavier. Accueil inspecté à
  390 × 844 et à 1280 × 900 ; pas d'audit clavier exhaustif ni de preuve à 200 %.

**Constat du 11/09, remplacé par la demande de poursuivre du 13/09 ci-dessous :
lot 2 non autorisé à démarrer par les critères de livraison initiaux.** Le fournisseur
configuré reste limité lors du nouvel essai du 11/09. Ne pas répéter les appels
sans changement de condition ni changer silencieusement de clé ou fournisseur.
Il faut ensuite vérifier une question sans écriture, une clarification, puis
une échéance réelle fournie/saisie par Maxime, rechargement et reçu compris,
et terminer l'essai complet clavier/mobile/zoom. Maxime a été invité à donner une
échéance réelle pour éviter d'inventer des données pédagogiques dans son compte.
Son essai utilisateur reste requis avant extension des pouvoirs.

Vérification de la correction « une seule saisie » du 11/09 : 2 210 tests
réussis dans 210 fichiers, TypeScript, lint ciblé et build de production
réussis. Le navigateur authentifié présente les pièces jointes dans la saisie
du chat ; sélection d'un fichier, activation d'Envoyer sans texte, puis retrait
vérifiés sans téléversement réel. Interface inspectée en largeur mobile et à
1280 × 900. Les tests du transfert couvrent notamment la reprise après échec
d'enregistrement sans nouvelle création ni nouveau téléversement. Cette
correction d'interface ne valide pas l'analyse ou le classement automatiques.

## Point de reprise du 13/09/2026

Maxime demande explicitement de faire la suite puis de reprendre. Cette demande
autorise la poursuite locale du lot documentaire ; elle ne valide pas a posteriori
l'essai fournisseur du lot 1. La tranche réalisée relie la saisie unifiée à
l'analyse existante, au rattachement non ambigu aux références existantes et
au retour relu de Supabase dans le fil. Consentement unique de sélection dans
le fil, traitement séquentiel interruptible, arrêt sur premier échec, aucune
reprise payante automatique. Une reprise du rangement répare les liens sans IA.

Les ressources sont mémorisées par identifiant dans le message du navigateur ;
leur contenu et les résultats ne sont pas recopiés dans la conversation envoyée
au modèle. La note source exclut la section de liens générée. Les choix déjà
appliqués sont préservés ; les nouveautés non résolues restent à préciser.
La première tranche ne créait ni domaine ni compétence nouvelle et ne corrigeait
pas le rangement en langage libre ; la suite du 14/09 ci-dessous la complète.
Elle ne programme pas de séance.

Contrôles du 13/09 : 2 228 tests réussis dans 212 fichiers, TypeScript, lint
ciblé et build de production réussis. Schéma et RLS réels relus. Le script
`app/supabase/tests/assistant_ressource_rangement.sql` passe dans Supabase sous
`authenticated` : écriture conditionnelle, refus de version périmée, réparation
de l'index et refus de lecture/écriture hors compte. Transaction annulée, aucune
donnée de test conservée. L'accueil authentifié charge avec la saisie unique.
L'analyse de ressources personnelles réelles et la fidélité du résultat ne sont
pas éprouvées dans cette tranche : aucune ressource n'a été transmise au modèle.

Tranche suivante, construite le 14/09 : correction locale du rangement par la conversation, puis
création de nouveautés justifiées avec clarification de l'usage des nouveaux
domaines. Terminer l'essai réel avant de déclarer le lot 2
complet ou de passer au plan adaptatif du lot 3.


## Suite du 14/09/2026 — création et correction

Le rangement crée les compétences sourcées dans les domaines existants.
« Corriger ou compléter » cible une ressource dans la saisie habituelle :
correction du titre, type, domaine ou liens ; création des compétences proposées.
Un nouveau domaine demande son usage (continu ou module et année) dans cet échange.
Seules les métadonnées et intitulés proposés atteignent ce dialogue ciblé.
La commande persistée avant ses effets permet une reprise sans réinterprétation IA ;
les créations déjà réussies sont réutilisées, les archives et conflits sont refusés.
Aucun plan de séances ni niveau n'est créé. L'essai sur ressources personnelles
réelles reste nécessaire avant de déclarer la fidélité du lot 2 vérifiée.


Vérifications finales du 14/09 : 2 248 tests passent dans 215 fichiers avec
`vitest run --maxWorkers=2`, TypeScript, lint ciblé et build de production passent.
Le premier passage sans limite de parallélisme a dépassé les délais de deux
scanners et de quatre démarrages de workers ; la suite limitée passe sans
modifier les tests ni leurs délais. Aucun nouvel essai fournisseur ni écriture
de ressource personnelle n'a été effectué pendant cette vérification.

## Vérification du parcours du 15/09/2026

Le parcours assistant → fenêtre → confirmation → tableau de bord est construit.
Le navigateur a confirmé une note synthétique avec un domaine existant, puis
affiché la priorité du moteur. L'écriture et sa trace ont été relues dans
Supabase ; la note et son analyse de test ont ensuite été supprimées, absence
vérifiée. La fenêtre a aussi été contrôlée avec le livret déjà analysé et à
390 × 844 : actions en pied, classement hiérarchique et fermeture/reprise.

Validation finale : 2 301 tests dans 224 fichiers, TypeScript, ESLint sans
erreur (10 avertissements existants) et build de production passent. Le contrôle
SQL de création, rejeu et isolation hors compte passe puis est annulé. Le défaut
de dates documentaires détecté dans le navigateur est corrigé et couvert par
sept tests. Aucun nouvel appel Mistral, aucune migration ni dépendance.

La confirmation réelle de la note ne valide pas la pertinence des propositions
du modèle sur d'autres documents. Le classement personnel du livret n'a pas été
modifié par cet essai. Aucun niveau ni séance n'a été créé ; le planificateur
global reste hors périmètre. Aucun commit, push ou déploiement.
