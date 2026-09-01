# PRODUCT.md — Système pédagogique

**Version 4.16 — 31/08/2026.** Le rangement vers les domaines long terme est
désormais présenté comme un geste de fin de semestre, disponible plus tôt
uniquement pour le préparer. Le compteur reste neutre tant que le module est
actif et ne devient une alerte qu'après sa clôture. La création
refuse explicitement le nom du module temporaire et explique qu'un domaine
plus général est attendu ; si le nom désigne déjà un domaine continu, celui-ci
est réutilisé au lieu d'être recréé. Aucune compétence n'est présélectionnée :
le rattachement reste un geste explicite (ADR-138).

**Version précédente : 4.15 — 31/08/2026.** La fiche d'un module distingue désormais les
compétences qui alimentent déjà un ou plusieurs domaines continus de celles
qui restent à organiser. La personne peut rattacher une sélection à plusieurs
domaines durables, ou créer sur place un domaine continu alimenté par ces
compétences. Les rattachements réutilisent les codes existants : identité,
observations et état dérivé ne sont jamais copiés. Le compteur rouge du
classement est intégré à cette section ; l'écran global « À classer » reste le
parcours des compétences sans aucun domaine. Les formulaires de saisie rapide
d'un module sont spécialisés par geste : cours, note, définition, exercice
donné et devoir ont chacun leur champ principal, tandis que les précisions
facultatives restent repliées (ADR-138).

**Version précédente : 4.14 — 31/08/2026.** Depuis un module académique, « Ajouter » donne
accès aux cinq familles de contenus de cours : cours (saisie ou PDF), note,
définition, exercice donné et devoir. Une date facultative sur un devoir crée
une échéance de rendu liée au module ; si cette seconde écriture échoue, le
devoir reste enregistré et l'interface permet de réessayer la date sans le
dupliquer. Le même cockpit permet de déclarer un contrôle, sous forme
d'échéance d'examen liée au module. Ces contenus et échéances sont des faits
déclarés : leur création ne produit aucune observation ni mesure (ADR-138).

**Version précédente : 4.13 — 31/08/2026.** Le graphe de Mes cours ne montre plus les
documents de preuve : il reste centré sur le référentiel, les exercices et les
ressources reliées. Les preuves restent accessibles depuis les surfaces
d'activité. La fiche domaine/module répertorie désormais les travaux observés,
regroupés par production pour qu'un même travail mobilisant plusieurs
compétences n'apparaisse qu'une fois. Cette chronologie est dérivée à la
lecture des observations et de leurs sources ; elle n'ajoute aucun historique
persisté ni aucune mesure.

**Version précédente : 4.12 — 31/08/2026.** La fiche module/domaine devient un espace de
travail unique : « Maintenant », contenus et séances, échéances, puis
compétences repliables. Les modes « Fiches », « Arbre » et « Progression », les
indicateurs de maintenance et le volet de contexte droit sont retirés de cette
fiche. La Progression reste la lecture longitudinale globale et comparative ;
elle ne se duplique plus dans chaque domaine. Le classement automatique reste
accessible depuis le module lorsque des compétences n'ont pas encore de
destination durable (ADR-138).

**Version précédente : 4.11 — 30/08/2026.** Le premier lot de l'espace module académique
rend le cadre utilisable avant que son référentiel soit connu : un module peut
désormais être créé sans compétence initiale, reste visible dans « Mes cours »
par son usage déclaré et ouvre un cockpit qui mène aux gestes existants de
dépôt de cours et d'ajout de compétence. Aucun domaine durable vide n'est
autorisé par le parcours applicatif, aucune entité `module` n'est ajoutée et
aucune donnée pédagogique n'est fabriquée pour rendre le module visible
(ADR-138).

**Version précédente : 4.10 — 30/08/2026.** La vision d'orchestration pédagogique reste
validée comme direction (ADR-139), mais sa composition d'interface expérimentale
a été retirée le 30/08 après retour arrière. Le tableau de bord visible est
revenu à sa composition précédente ; les fondations de planification,
d'acceptation, de revue et de chronologie restent dans le dépôt comme code
expérimental non raccordé et gelé. Cette itération ajoute seulement la lecture
réelle des `LearningSession` acceptées du jour : les séances `planifiee` du jour
civil et toutes les séances `en-cours`, séparées de la recommandation. La boucle
complète `contexte réel → plan → travail → observations → estimation →
replanification` reste à valider en conditions réelles. L'acceptation distante
est prouvée pour les séances ordinaires ; la conservation de l'origine d'un
candidat de cours dans cette même RPC est désormais déployée et vérifiée dans
la définition distante via la migration additive
`20260829190000_plan_acceptation_origine_cours.sql` (version Supabase
`20260829174131`). Le plan est une hypothèse
dérivée ; seules les séances acceptées deviennent des `LearningSession`. La
direction validée remplace les refus
de calendrier et de plan jour-par-jour d'ADR-096 et ADR-109 sans réintroduire
d'objectif structuré ni d'état dérivé persistant.

La recommandation globale ne repropose plus un exercice déjà tenté sans
réussite ultérieure (`partiel` ou `echec`), même lorsqu'il s'agit du seul
exercice disponible. Quand aucun candidat honnête ne reste, elle laisse le
repli de génération ou de préparation répondre sans inventer de contenu.

Quand la file ne contient plus d'exercice recommandable pour une compétence,
« Générer puis commencer » ouvre désormais la génération ciblée dans le
tableau de bord. La proposition reste relue et acceptée explicitement ; après
acceptation, une `LearningSession` unitaire est créée et le travail s'ouvre
directement. Un échec de création de séance revient au compositeur sans
réémettre la génération.

Le tableau de bord visible garde une seule surface de référence pour les
échéances : « À venir ». Le raccourci de contexte et le résumé prioritaire qui
répétaient la même échéance ont été retirés ; « Mes cours » reste une entrée
générale vers le contexte académique. La carte conserve la liste des échéances
et leurs actions sans changer les faits persistés.

La frontière distante d'acceptation atomique est désormais fonctionnelle et
prouvée côté PostgreSQL. La reproduction du 29/08/2026 avait montré que `sum(integer)`
renvoie `bigint`, que `coalesce` conserve ce type et que
`make_interval(mins => ...)` attend `integer`. Les définitions distantes
contiennent désormais le cast explicite du résultat de `sum`, et les cas NULL,
individuel et agrégé passent. La même exécution distante avait ensuite révélé
que le rejeu idempotent était filtré par RLS : le `FOR UPDATE` porté par la
lecture du reçu append-only n'avait aucune politique UPDATE, donc un second
appel retombait sur une collision d'insertion. La correction locale
`20260829072035_corriger_somme_intervalle_acceptation_plan.sql` est enregistrée
à distance sous `20260829075048` dans
`supabase_migrations.schema_migrations`. Le correctif additif
`20260829101500_corriger_idempotence_acceptation_plan.sql` retire uniquement ce
verrou de ligne ; il est enregistré à distance sous `20260829145745`.

Le parcours de correction d'un exercice ne bloque plus sur une panne du
tuteur : l'état « correction en cours » est lisible, la relance est explicite
et sérialisée, et un résultat déjà reçu est retrouvé au rechargement sans
nouvel appel. Une relance explicitement demandée est une nouvelle génération
assumée ; aucun double-clic ni rechargement ne la déclenche en douce. Après
expiration ou erreur, « Terminer sans mesure » clôt la tentative sans résultat
ni observation ; la réponse attendue devient alors consultable. Une correction
recevable est aussi affichée dans le bilan, à côté du feedback, avant son
acceptation ; elle reste cachée pendant la recherche. Une observation ne peut
donc naître qu'après une correction recevable puis l'acceptation du bilan.
Pendant une séance ouverte, le menu des exercices permet aussi de relire une
activité déjà menée en lecture seule : aucune nouvelle tentative ni observation
n'est créée, et le retour au déroulé reste explicite.
L'exercice diagnostic qui vient d'être mené est aussi exclu de
l'enchaînement immédiat du même parcours, sans modifier la calibration.

**Version précédente : 4.1 — 28/08/2026.** La nature d'un domaine se déclare désormais :
module académique, progression continue, ou à préciser (ADR-138). Le cœur
longitudinal ne bouge pas — aucune entité nouvelle, aucune mesure venue du
cadre ; le parcours canonique (§4) dit la déclaration au lieu de la taire.

**Version précédente : 3.2 — 25/08/2026.** Positionnement court/moyen terme inscrit : les
étudiants du supérieur (ADR-135). Le cœur longitudinal est inchangé ;
l'expérience, la vitrine et les priorités s'alignent sur le parcours étudiant
(cours structurés, échéances, exercices, projets). Aucune branche généraliste,
aucun modèle persistant de persona, aucun changement d'entité ou de contrat du
moteur.

**Version précédente : 3.1 — 20/08/2026.** Les contrats de la refonte Twiny
ont été validés explicitement par Maxime le 20/08/2026 et sont consignés par
ADR-089 à ADR-095. Ils remplacent uniquement les contrats courants qu'ils
contredisent ; les observations, métriques et récits historiques restent
inchangés.

**Version précédente : 3.0 — 13/08/2026.** Fusion de `PRODUCT_VISION.md` et
`PRODUCT_PRINCIPLES.md` (v1.0, 27/07), dont les démonstrations détaillées
restent dans l'historique git. Document vivant : toute modification doit
préciser ce qui passe d'une catégorie à l'autre.

**Mouvement de la version 4.0.** La promesse passe de « mesurer et recommander
maintenant » à « comprendre le contexte, planifier, observer et replanifier ».
Le tableau de bord reste le lieu de pilotage, `LearningSession` reste l'épisode
de travail unique et le module reste un `Domaine` à usage académique. Le
changement porte sur l'orchestration au-dessus du moteur existant : contexte
académique et temporel déclaré, préparation dérivée aux échéances, plan global
recalculable, synchronisation calendaire consentie et interventions plus
variées. Aucun de ces éléments n'est déclaré construit par cette version.

**Mouvement de la version 3.2.** Le §4 distingue le cœur permanent du
positionnement prioritaire et porte la promesse déclinée pour ce public ainsi
que le parcours canonique. Le §7 gagne quatre questions de filtrage et la
classification des fonctionnalités. Rien du noyau ne bouge : aucune entité,
aucun statut de mesure, aucun contrat du moteur ne changent.

**Mouvement de la version 3.1.** La carte de référence devient un catalogue
global partagé assorti d'un overlay privé par compte. Le vocabulaire courant
distingue désormais Activité, Preuve, Observation et État ; l'actuelle table
`evidence` porte sémantiquement des Observations et sera renommée au lot 1.

**Mouvement de la version 3.0.** Décision humaine : la boucle centrée sur
l'exercice devient un moteur d'actions d'apprentissage adaptatif (ADR-066).
Trois familles avaient été retenues en v1 — Explorer, S'entraîner, Produire.
🔄 **Explorer a été retirée le 15/08/2026 (ADR-070)** ; **Produire a changé de
support le même jour** : un projet est une note opérationnelle, plus une entité
à sept tables. Le contexte déclaré léger et le profil entièrement dérivé
restent. La question ouverte
d'ADR-051 est ainsi tranchée. L'efficacité du classement, l'ergonomie des
surfaces proposées et les nouveaux barèmes de qualité restent 🔬 : décider de
les construire ne démontre pas qu'ils sont efficaces.

> **Les quatre statuts**, au sens strict, employés dans tout le dépôt :
>
> | Statut | Signification |
> |---|---|
> | ✅ **Décision** | Tranché, par une personne, explicitement. Ne se rediscute qu'en changeant ce document. |
> | 🔬 **Hypothèse** | Plausible et argumenté, **non vérifié**. Doit porter son test de réfutation. |
> | ❓ **Question ouverte** | Arbitrage identifié, pas encore rendu. Bloque ou oriente du travail. |
> | 🗑️ **Abandonné** | Envisagé puis écarté. Conservé avec sa raison, pour ne pas y revenir par oubli. |

---

## 1. Ce que le produit est

Une **boucle d'orchestration pédagogique** : contexte réel déclaré +
intentions + échéances + temps disponible + état dérivé → plan de travail
recalculable → meilleure intervention étayée maintenant → activité → preuve
éventuelle → observation → état recalculé → replanification.

Twiny relie deux horizons. À court terme, il aide à comprendre un cours,
préparer une évaluation, produire un rendu ou poursuivre un besoin personnel.
À long terme, chaque preuve recevable enrichit une représentation durable des
compétences, indépendante du semestre ou du module qui l'a fait apparaître.
Les structures temporaires de la vie de la personne alimentent donc le modèle
longitudinal sans devenir elles-mêmes des mesures.

Le noyau implémenté reste, jusqu'au lot 1,
`SkillEvidence → SkillState → recommandation`. Dans le vocabulaire cible,
`SkillEvidence` porte aujourd'hui des Observations. Le geste **probant** le plus
construit reste l'exercice. La cible validée par ADR-139 étend toutefois
`LearningSession` à plusieurs interventions : résoudre, expliquer, rappeler,
lire, synthétiser, produire, diagnostiquer et demander de l'aide. Une
intervention peut préparer, soutenir ou produire une preuve ; son existence ou
son achèvement ne deviennent jamais une mesure par défaut. Le mini-projet reste
une note opérationnelle tant que son contrat de preuve n'est pas tranché.

Autour d'elle, un **instrument de mesure** dont la fonction première est de
**refuser d'affirmer ce qu'il ne peut pas prouver**. L'utilisateur travaille,
le système conserve les déclarations, activités, traces, observations,
productions et feedbacks ; il en **dérive** niveaux, tendances et prochaine
action. Le « jumeau numérique » est cette vue recalculée, jamais un profil
stocké. Rien de ce qui peut être recalculé n'est persisté.

La recommandation n'est jamais présentée comme absolument optimale. Elle est la
**meilleure action étayée maintenant**, accompagnée de son pourquoi et de ses
réserves. Dans la cible, elle s'inscrit dans un plan : une vue dérivée des actions
encore plausibles jusqu'aux échéances. Le plan se pilote au tableau de bord et
se lit dans Séances ; il n'ajoute pas une destination ni une entité métier.
Seules les séances acceptées sont matérialisées. Déplacer, refuser ou manquer
une séance déclenche une nouvelle proposition, jamais une dette morale.

**Le vocabulaire d'implémentation ne remonte jamais à la surface.** *Artefact*,
*snapshot*, *modèle*, *version*, *exécution*, *inventaire recalculé*,
*événement d'audit* décrivent des mécanismes, pas des gestes d'apprentissage.
Ils vivent dans le code et dans les ADR. À l'écran on dit *production*,
*travail en cours*, *ce que vous avez rendu*, *l'original est conservé*. Un
écran qui compte des objets internes est un écran de maintenance : il n'a pas
sa place devant quelqu'un qui vient travailler.

**Et le produit vouvoie** (ADR-119), sur toutes ses surfaces — y compris le
texte que le tuteur rédige à l'exécution : énoncés, corrections,
justifications, intitulés. Ce n'est pas un goût de rédaction. Le tutoiement
fait du système un pair qui encourage ; le vouvoiement en fait un appareil qui
constate — et c'est la seconde chose que ce document décrit.

Ce n'est pas un tracker d'habitudes, pas un LMS. La distinction tient en une
phrase : **un tracker enregistre ce que tu déclares avoir fait ; ce système
enregistre ce qui a été observé, et en tire ce qu'il peut honnêtement en tirer
— souvent moins que ce qu'on aimerait.**

Sur la révision : le produit cible une planification adaptative, encore non
construite. L'**engagement déclaré** reste un fait daté extérieur ; l'emploi du
temps et les disponibilités restent des faits déclarés ou consentis. Le moteur
en dérive un plan sans stocker un score de préparation ni fabriquer
d'intention. Un événement de calendrier ne mesure rien et une séance manquée ne
produit aucune preuve de compétence.

### Glossaire courant

**Activité → Preuve → Observation → État** : l'Activité est le geste réalisé ;
la Preuve est la trace durable vérifiable, ou sa référence durable ;
l'Observation est le constat structuré et sourcé tiré de cette trace ; l'État
est l'estimation recalculée à partir des Observations. Le niveau observé d'un
constat ponctuel reste distinct de la maîtrise consolidée à travers plusieurs
Observations (ADR-090, ADR-091 et ADR-095).

Les mentions historiques de « preuve » peuvent désigner l'actuelle table
`evidence` ou le type `SkillEvidence`, donc une **Observation** dans le nouveau
vocabulaire. Elles sont conservées telles quelles pour ne pas réécrire
l'histoire des décisions.

## 2. Ce que le produit n'est pas

- **Pas un outil de motivation.** L'XP et les jalons ont été supprimés le
  28/07 (ADR-017) : la vue longitudinale porte le retour de progression. Un
  score de 10/100 après trois jours de travail sérieux est une information,
  pas un échec de conception. La présentation peut être ample et gratifiante
  (le profil de carrière d'ADR-098) : ce qui reste interdit, c'est la
  mécanique inventée — tout nombre affiché se dérive des observations, jamais
  du temps passé.
- **Pas un générateur de contenu pédagogique de référence.** Il ne prétend pas
  remplacer un cours ou un enseignant.
- **Pas un réseau social.** La comparaison entre utilisateurs est en tension
  directe avec le principe fondateur.
- **Pas un système d'évaluation certifiante.** Aucun niveau produit ici n'a de
  valeur institutionnelle.

## 3. La proposition de valeur, en une ligne

> Toujours savoir **quoi faire maintenant, pourquoi le faire et ce que ce
> travail fait progresser**, en tenant compte de ce que vous préparez, du temps
> disponible et de ce que les preuves permettent réellement d'affirmer.

| Promesse | État au 28/07/2026 |
|---|---|
| « ce que tu sais réellement faire » | ✅ Tenue. Le moteur est complet et testé. |
| « avec le degré de certitude » | ✅ Tenue. Les trois lectures restent distinctes ; l'interface les traduit en « ce que vous avez montré », « bilan à confirmer / solide » et « ancrage ». |
| « quoi travailler ensuite » | 🟡 **La boucle a tourné en entier le 01/08** (ADR-030). La difficulté produite a suivi le conseil de la calibration sur les deux compétences où il existait — le 3ᵉ maillon est démontré. La seconde moitié du test reste à mesurer : les deux tentatives ont été abandonnées en 1 minute, donc aucune dimension n'a pu reculer. |
| « parmi plusieurs façons d'apprendre » | 🔬 **Deux gestes existent** depuis le 15/08 : l'exercice et le mini-projet, ce dernier sur le chemin documentaire (ADR-070). Reste à vérifier — aucun projet n'a encore été mené à son terme. |
| « organiser le travail jusqu'aux échéances » | ❓ Vision validée le 27/08 (ADR-139) ; le tableau de bord calcule désormais une première proposition éphémère à partir du contexte déclaré et permet l'acceptation atomique de séances. La revue après changement d'une séance acceptée, les candidats de cours et le parcours global restent à valider en conditions réelles. |

## 4. Public

**Vitrine publique (23/08, ADR-114) :** la racine `/` est une landing
marketing publique, complétée par `/methode`, `/etudiants` et `/autodidactes`.
Depuis le repositionnement étudiant (25/08, ADR-135), l'accueil mène par ce
cadre — cours structurés, échéances, `/etudiants` en référence principale ;
les autres publics restent accessibles sans dicter la navigation. Le tableau
de bord est à `/app`, derrière authentification. L'acquisition par
moteur de recherche passe par ces pages publiques ; aucune donnée
pédagogique n'y circule.

**Aujourd'hui, factuellement (31/07) :** 3 comptes en production. Un
utilisateur actif (26 preuves sur 22 compétences, 20 tentatives terminées), un
**compte tiers réellement actif** (3 preuves, 5 tentatives), un compte sans
aucune activité pédagogique.

**Cœur permanent :** le suivi longitudinal — observations sourcées, état
recalculé, recommandation explicable. Il appartient à quiconque travaille des
compétences dans la durée, et ne se spécialise pas.

**Positionnement court/moyen terme (25/08/2026, ADR-135) :** à court et moyen
terme, Twiny est conçu prioritairement pour les étudiants du supérieur qui
suivent des cours structurés et préparent des évaluations, exercices ou
projets. Ce positionnement donne au produit un cadre d'application concret. Il
ne modifie pas son cœur longitudinal et ne constitue pas une restriction
définitive de son public.

**Limite de cette décision :** elle guide l'expérience et les priorités
actuelles — vitrine, onboarding, tableau de bord — mais n'introduit aucune
exclusivité architecturale envers d'autres publics : pas de branche
généraliste, pas de persona persistant, pas d'application parallèle
(ADR-135).

**Critère de révision :** reconsidérer la cible après suffisamment d'usage
étudiant réel — même logique que les tests de réfutation ci-dessous —, pas à
une date arbitraire.

*(Historique de la cible : « étudiants et autodidactes » du 23/08/2026 ;
avant, « toute personne souhaitant un suivi longitudinal ».)*

**Promesse pour ce public (révisée le 27/08/2026) :** « Twiny organise avec
vous le travail utile avant vos échéances, l'ajuste à mesure que vous avancez
et vous montre ce que chaque séance a réellement fait progresser. » C'est la
déclinaison de la phrase du §3 pour le positionnement actuel ; elle décrit la
cible et ne doit pas atteindre la vitrine avant que le plan soit construit.

**Parcours canonique :**

1. L'étudiant vit une première boucle courte : profil, micro-diagnostic,
   exercice réel, observation et premier retour de progression.
2. Il déclare ou importe son cadre : modules, cours suivis, échéances,
   disponibilités et supports utiles.
3. Twiny confronte ce contexte aux compétences attendues, à l'état observé et
   au temps restant ; ce qu'il ne sait pas reste visible comme incertitude.
4. Twiny propose un plan de séances jusqu'aux échéances et explique ses choix.
5. L'étudiant accepte, déplace ou refuse la proposition en une relecture ; les
   seules séances acceptées deviennent des `LearningSession`.
6. Chaque séance enchaîne une ou plusieurs interventions adaptées : résoudre,
   expliquer, rappeler, lire, synthétiser, produire, diagnostiquer ou demander
   de l'aide.
7. Les activités qui portent une preuve recevable produisent des observations
   sourcées ; les autres restent du soutien ou de la préparation.
8. L'étudiant voit ce que son travail a changé, ce qui reste incertain et son
   niveau de préparation étayé avant chaque échéance.
9. Toute nouvelle donnée — cours, échéance, disponibilité, progression,
   retard, refus ou abandon — recalcule le plan sans sanction ni dette.

Le mécanisme des étapes 1-2 (25/08/2026, ADR-137 ; précisé le 26/08/2026,
ADR-138) : **un module de cours est un domaine du référentiel** — le cadre
existant qui rassemble ses PDFs déposés, ses compétences taguées et ses
sous-parties (TD, TP). La nature d'un domaine se **déclare** : module
académique (année académique obligatoire, période facultative), progression
continue durable hors cours, ou « à préciser » — défaut de toutes les données
existantes, jamais déduit du nom ni de l'usage. Une échéance peut se lier à un
module comme fait déclaré, posé à la création ; la liste des échéances d'un
module se dérive à la lecture. Le module peut précéder sa première compétence :
son usage déclaré suffit à le rendre visible, sans compétence factice ni
document inventé. Aucune entité nouvelle.

Le premier parcours doit démontrer cette boucle avant d'exposer la richesse du
référentiel ou des documents — même exigence qu'ADR-128 : atteindre un
exercice probant avant tout le reste.

🔬 **Hypothèse partiellement soutenue :** que le besoin existe au-delà de son
auteur. *Test de réfutation inchangé : un compte tiers atteint 10 preuves sans
assistance.* Le compte tiers en est à 3 — et il les a produites sur un
référentiel écrit pour quelqu'un d'autre, ce qu'ADR-026 corrige.

### Comptes et accès

Connexion par e-mail + mot de passe, ou Google. Un mot de passe perdu se
redéfinit en libre-service : le lien « Mot de passe oublié ? » de la connexion
envoie un lien horodaté (une heure) vers la boîte déclarée, et le consommer
déconnecte les autres appareils du compte (ADR-100). Aucune donnée
pédagogique ne circule dans ce flux ; l'adresse déclarée n'est jamais confirmée
ni infirmée par l'écran de demande.

## 5. Les huit principes

Chacun est transcrit dans `lib/engine/` et vérifié par les tests. Les deux
principes en défaut sont **connus et documentés**, pas des bugs à corriger sans
arbitrage.

| # | Principe | Source | État |
|---|---|---|---|
| **P1** | Rien de ce qui peut être dérivé n'est stocké | Instructions §1 | ✅ Tenu |
| **P2** | L'absence de mesure n'est pas un zéro | Anti-halluc. §7 et §14 | ✅ Tenu depuis le 31/07 (ADR-006) |
| **P3** | Aucune valeur sans source — chaque nombre porte son « Pourquoi ? » | Anti-halluc. §4 | ✅ Tenu |
| **P4** | Une faiblesse ne disparaît pas sans démonstration | Anti-halluc. §5 et §6 | ✅ Tenu |
| **P5** | Le tuteur n'écrit aucune mesure | Instructions §13 | ✅ Tenu — reformulé le 03/08 (ADR-037) |
| **P6** | Le protocole est la spécification | — | ✅ Tenu |
| **P7** | L'honnêteté prime sur la complétude | Anti-halluc. §14 | ✅ Tenu |
| **P8** | La qualité de la preuve conditionne tout | Anti-halluc. §2 ; éval. §5 et §6 | 🔬 Architecture tranchée par ADR-057 ; `PLAFOND_AIDE` reste à confronter à l'usage (barème gelé jusqu'à environ 20 bilans terminés) |

### P2 — comment il a été rétabli le 31/07

`calculerEtatGlobal` calculait `Σ importance × (score/5) ÷ Σ importance` sur
**toutes** les compétences du périmètre. Les compétences sans preuve entraient
au **numérateur pour 0** et au **dénominateur pour leur importance pleine** :
non mesuré y valait exactement zéro, ce que le protocole interdit.

Deux conséquences entières : le score était **anti-corrélé à l'ambition** —
élargir le référentiel le faisait baisser sans qu'aucune compétence n'ait été
perdue ; et un instrument dont la vertu est de ne pas confondre ignorance et
incompétence affichait 10/100 en confondant exactement les deux.

**Ce qui a forcé la correction :** ADR-026 rend le référentiel extensible par
l'utilisateur, et le tuteur peut lui en proposer l'extension. Le défaut cessait
d'être une verrue documentée pour devenir une incitation structurelle à ne pas
utiliser la fonctionnalité qu'on venait de construire.

Les deux sommes portent désormais sur les seules compétences mesurées, et ce qui
en sort revient **entièrement** à la couverture — l'indicateur honnête de ce qui
n'a pas encore été mesuré. Le doute sur une couverture partielle continue de
plafonner la *confiance*, pas d'abaisser le niveau. ✅ Tranché : ADR-006.
Les compétences non mesurées restent **en veille** dans le référentiel, prêtes à
être remobilisées lorsqu'une intention ou une recommandation les rend utiles.

### P5 — ce que la garantie protégeait réellement

Formulé « le tuteur n'a aucun accès en écriture », le principe interdisait aussi
bien d'écrire une preuve que d'écrire un énoncé d'exercice. Or les deux n'ont
pas la même nature : **une preuve affirme quelque chose sur la personne, un
exercice n'affirme rien**. Le premier interdit est la garantie ; le second était
un coût — 3 navigations et 3 formulaires pour obtenir un exercice, quand
40 compétences sur 54 n'en avaient aucun.

✅ **Reformulé le 03/08/2026 (ADR-037)** en « le tuteur n'écrit aucune mesure ».
Le tuteur écrit désormais le **contenu** — exercices, propositions de branche —
directement. Tout ce qui **mesure** reste une proposition que l'utilisateur
valide. Le principe est devenu plus précis, pas plus permissif.

### P8 — refermé le 01/08, rouvert le 04/08

`indicesUtilises` ne comptait que les indices **internes**. Toute aide
extérieure était invisible au moteur, qui enregistrait néanmoins A3
« résolution autonome » :

| Preuve | Enregistré | Commentaire de l'utilisateur |
|---|---|---|
| `RO-01` | A3, 0 indice | *« J'ai eu besoin de l'aide de Claude et de ressources »* |
| `STAT-02` | A3, 0 indice | *« j'ai regardé sur internet »* |

L'utilisateur était honnête ; le moteur ne lisait pas le champ commentaire.

✅ **Tranché le 01/08/2026 (ADR-033).** La preuve manuelle ne demande plus un
palier d'autonomie : elle demande **de quelle aide la personne a disposé**, et
le moteur en dérive le palier — documentation → A2, assistant IA → A1,
correction → A0, en prenant toujours le minimum avec ce que disent les indices
internes. Un fait constatable a remplacé une auto-évaluation.

🔬 **Une réserve, écrite plutôt que tue.** Les **29 preuves antérieures** ne sont
pas retouchées — aucune donnée ne dit quelle aide a servi, et les inventer serait
la faute que ce système combat.

🔬 **Rouvert le 04/08/2026 (ADR-038).** Le formulaire de preuve manuelle a été
retiré : il n'était pas utilisé, et le lot 1 lève la pénurie d'exercices qui le
justifiait. Mais c'était le seul chemin qui posait alors la question de l'aide
extérieure. P8 est repassé de ✅ à 🔬.

⚠️ **Corrigé le 07/08/2026.** La phrase « le bilan d'exercice ne pose pas la
question » était fausse au moment où elle a été écrite. Le bilan la pose depuis
le commit `5424f4d` (04/08), soit le jour même d'ADR-038 : les deux gestes se
sont croisés. `formulaire-bilan.tsx` affiche les quatre options, et
`terminerExercice` en dérive `autonomieObservee`.

**P8 reste 🔬 malgré tout**, pour une raison différente de celle d'ADR-038 : le
chemin existe, mais le barème `PLAFOND_AIDE` (documentation → A2, assistant
IA → A1, correction → A0) n'a jamais été confronté à l'usage. Le refermer en ✅
demande une décision humaine, pas une relecture de code.

✅ **Architecture de mesure tranchée le 11/08/2026 (ADR-057).** Le produit
utilise d'abord les traces observables — indices, sollicitation du tuteur et
aides internes — puis demande à la personne ce qui reste invisible. L'absence
de trace ne vaut jamais « aucune aide ». Cette décision ne valide pas les
plafonds numériques : P8 reste 🔬 jusqu'à leur confrontation à l'usage.

## 6. Horizon

### Décidé

**Décision produit validée le 27/08/2026 — orchestration adaptative
(ADR-139), direction toujours en validation d'intégration.** Le plan reste
dérivé, explicable et recalculable ; seules les séances acceptées sont
persistées sous forme de `LearningSession`. Le calendrier est une projection
consentie du plan, jamais une source de vérité pédagogique. Une préparation à
l'échéance reste une vue dérivée avec réserves. Retard, refus et abandon peuvent
replanifier, mais ne mesurent aucune compétence. Cette décision remplace
uniquement les interdits de planification d'ADR-096 et ADR-109 ; elle conserve
leurs refus de fabriquer une intention ou un objectif structuré.
Les lots 0 à 6 ont posé dans le dépôt les contrats, le planificateur temporel
pur, la frontière d'acceptation, la revue groupée locale et la lecture
opérationnelle des séances acceptées. Leur branchement dans la composition
visible a été retiré lors du retour arrière du 30/08 ; aucune proposition de
plan globale, revue ou vue `/seances` expérimentale n'est activée par cette
version. La vérification Supabase réelle du 28/08/2026 confirme
que les colonnes `interventions`, `origine_proposition` et
`duree_planifiee_min`, le reçu d'idempotence et les fonctions
`accepter_plan(text,jsonb)`/`accepter_plan_lot3_legacy(text,jsonb)` sont
présents, avec RLS actif. Les versions locales
`20260828110000_interventions_seance.sql`,
`20260828120000_lot_3_acceptation_plan.sql` et
`20260828150000_lot_5_revision_plan.sql` n'y sont pas enregistrées. Une
migration corrective `20260828212629` (`corriger_intervalle_acceptation_plan`)
a été appliquée, mais sa correction était incomplète : les casts des opérandes
avaient été ramenés à `INTEGER` sans convertir le résultat `BIGINT` de `sum`
avant `make_interval`. La correction additive
`20260829072035_corriger_somme_intervalle_acceptation_plan.sql` a ensuite
produit les définitions distantes corrigées ; elle est enregistrée sous la
version distante `20260829075048`. La migration additive
`20260829101500_corriger_idempotence_acceptation_plan.sql`, enregistrée sous la
version distante `20260829145745`, supprime le verrou RLS incompatible. La
preuve distante transactionnelle de sélection, d'idempotence, de tout-ou-rien,
d'absence de plan dérivé et d'absence d'observation passe désormais. Aucun
statut de construction n'est promu avant un scénario réel de bout en bout.

✅ **Le contenu vient du tuteur**, pas de fichiers écrits à la main (ADR-004).
🔬 **Une proposition d'exercice est contrôlée avant d'être présentée comme
enregistrable** (ADR-140). La complétude de la sortie structurée ne suffit pas :
un contrôle dédié compare l'énoncé et la correction. Si la correction ajoute une
cause ou un paramètre sans preuve, le serveur la répare une fois puis la
recontrôle avant de la rendre ; les détails de ce contrôle restent invisibles.
Une sortie texte non structurée peut rester lisible, mais ne produit aucune carte
d'exercice actionnable. La relecture humaine demeure nécessaire avant
l'enregistrement.
✅ **Le moteur du tuteur est configurable par environnement** ; aucun fournisseur
gratuit canonique n'est imposé. Le choix se valide par la mesure (ADR-007).
🔬 **Le tuteur fonctionne sans que l'utilisateur fournisse de clé** (24/08/2026,
ADR-116). Le produit sert sa propre clé, portée par un compte fournisseur
dédié, et **150 générations par mois sont incluses** par compte. Ce que « gratuit »
promet sur la vitrine est donc exact et borné : passé le plafond, la génération
s'arrête avec un message qui dit quand le compteur repart, et renseigner sa
propre clé lève la limite sans rien décompter. Le plafond est réglable par
compte ; un administrateur n'est jamais décompté.
🔬 **Une fiche de cours atteint le tuteur par un geste, jamais par le contexte**
(24/08/2026, ADR-124). « S'entraîner sur ce document » compose un message
— titre plus corps borné à 4 000 caractères — que la personne relit et envoie
elle-même. Le contexte permanent du tuteur ne contient toujours aucun document,
et le moteur n'en lit aucun : une fiche est de la matière pour un énoncé, jamais
une mesure. Avoir écrit un cours n'est pas l'avoir démontré.
🔬 **Le cours saisi devient un protocole de séances, relu case par case**
(24/08/2026, ADR-130). Au dépôt d'un cours, la personne déclare son intention
(mémoriser / maîtriser / comprendre, enum serveur + précision libre) ; le
tuteur lit le PDF et propose un plan de 1 à 6 séances typées par dimension
(compréhension, application, contextualisation, mémorisation) et liées aux
compétences validées du référentiel. Le plan n'est rien tant qu'il n'est pas
relu : les séances cochées deviennent des `LearningSession` planifiées du
bureau — écrites aussitôt, sans aucun appel tuteur ; les exercices manquants
sont générés par le tuteur au démarrage de chaque séance (25/08/2026,
ADR-131), ancrés dans le texte réel du cours déposé (ADR-132) — sauf les
séances « compréhension », qui demandent de reformuler avec ses mots
(méthode Feynman, exercices déterministes sans appel tuteur, 25/08/2026,
ADR-133), et les séances « mémorisation », qui demandent de restituer de
mémoire avant de vérifier contre le cours (cartes de rappel déterministes,
25/08/2026, ADR-134). Aucune entité
« protocole »
n'existe ; les dates des séances travaillées se dérivent des sessions à la
lecture, et seuls les faits déclarés (intention, plan validé) s'inscrivent au
journal de la fiche. Les dimensions sont des intentifs de séance — elles ne
mesurent rien. **C'est l'implémentation actuelle, pas la cible finale du
planificateur.** ADR-139 conserve l'analyse du cours, l'ancrage documentaire et
les interventions déterministes, mais retire à chaque PDF la responsabilité de
construire son propre plan isolé : les candidats relus doivent alimenter le
plan global, qui arbitre entre tous les cours, échéances et besoins.
✅ **Construire et utiliser en parallèle** est le mode de travail retenu.
✅ **La boucle est le produit** (ADR-066). Son arbitrage — temps disponible,
capacité déclarée — vit dans la carte d'action et fonctionne sans aucune table.
🔄 **Les familles Explorer et Produire ont été retirées le 15/08 (ADR-070)** :
la seconde avait produit une exécution planifiée, jamais démarrée, et aucune
preuve. ADR-139 ne les restaure pas : elle remplace cette taxonomie par des
interventions concrètes dans `LearningSession`, chacune indiquant si elle vise
une mesure, une préparation ou un soutien.
✅ **Le contexte immédiat est déclaré, jamais deviné** : temps disponible,
capacité mentale ressentie, intention, cible facultative et note verbatim.
🔄 **Le parcours était limité à une file d'actions dérivée** (ADR-096), puis
étendu par ADR-139 en plan temporel dérivé. Le système
d'objectifs structurés du lot 4 a été retiré le 21/08/2026 après retrait
humain explicite : il ne convenait pas. Le parcours se dérive des faits
(recommandations du moteur, ordonnées par l'espace actif, échéances et
disponibilités) et reste visible dans les surfaces existantes — tableau de bord
et Séances, jamais comme nouvelle destination. Les
intentions déclarées restent des textes verbatim du profil
(`objectif_moyen_terme`, `objectif_long_terme`), sans extraction ni
rattachement automatique. Nuance du 22/08/2026 : une date détectée dans un
besoin ouvre le chemin assisté vers l'engagement déclaré (ADR-109) — une
proposition explicite, jamais une écriture automatique.
✅ **L'engagement est un fait déclaré, pas un objectif** (ADR-109, amendée par
ADR-139). Une
échéance extérieure — examen, rendu — se déclare verbatim avec sa date et
éclaire la priorisation par un seul facteur de proximité (fenêtre J-21 →
veille dans l'implémentation actuelle). Elle n'est pas un objectif structuré.
La phrase qui interdisait calendrier et plan jour-par-jour est remplacée :
l'échéance devient l'une des entrées du plan dérivé, sans devenir une mesure.
✅ **Le mode épreuve est une déclaration de séance, pas une mesure** (ADR-110).
Déclaré au départ sur la séance et irréversible, il change l'habillage du
déroulé — chrono plein écran, indices masqués, correction à la fin — et rien
au moteur. `LearningSession` reste l'épisode unique (ADR-048).
✅ **Les états et vues personnelles sont dérivés** (ADR-091). `État`,
`KnowledgeState`, `SkillState`, carte individuelle, espace actif, tendances,
préférences inférées et recommandation se recalculent depuis les faits. Aucun
stockage autoritatif n'est permis ; un cache jetable et reconstructible
demanderait une mesure et une nouvelle décision. Une préférence n'entre dans le
déclaré qu'après confirmation explicite.
✅ **La recommandation est explicable et révisable**, jamais dite absolument
optimale : une action, ses facteurs, ses contraintes et ses réserves, dans la
carte existante et son dépliant « Pourquoi cette action plutôt qu'une autre ? ».
Aucun score de recommandation n'est stocké.
❓ **Une production ne devient preuve que sous contrat.** Le contrat critere par
critere a été retiré le 15/08 avec la machinerie qui le portait (ADR-070) : les
critères d'un projet s'écrivent désormais dans sa fiche, se lisent, et ne
produisent aucune mesure. La question reste ouverte, et se tranchera sur un
projet réellement mené — pas d'avance.
✅ **Une preuve originale ne se réécrit pas.** 🔄 Le journal de rectifications
qui le mettait en œuvre est parti le 15/08 (ADR-070) : sa table n'avait jamais
existé en production. Aucun chemin ne réécrit une preuve aujourd'hui.
✅ **`LearningSession` reste l'épisode de travail unique.** ❓ Son extension aux
interventions d'ADR-139, au diff de revue groupée et à la chronologie À venir est
outillée côté domaine, engine et acceptation. La composition `/seances` issue
de cette tentative a été retirée le 30/08 ; ces fondations restent
expérimentales et non raccordées au parcours visible. Les objets Supabase
additifs sont présents, tandis que les migrations historiques des lots 1, 3 et
5 restent absentes de l'historique distant et ne sont pas rejouées. La colonne
de durée planifiée, la RPC de raccourcissement et la conservation du blueprint
de cours sont visibles dans l'état réel ; la dernière est enregistrée sous
`20260829174131`. Plusieurs activités durables et séances
peuvent rester ouvertes en parallèle ; le contexte explicite désigne la séance
en cours. Les exercices historiques passent par un adaptateur sans copie ni
double écriture. Aucune entité parallèle n'est créée pour la lecture, la
synthèse, la production, le diagnostic ou l'aide.
🔬 **La lecture « À venir » de Séances reste expérimentale** (lot 6). Le moteur
relit les `LearningSession` acceptées encore planifiées ou en cours dans une
chronologie groupée par jour ; la composition qui la rendait nominale a été
retirée lors du retour arrière du 30/08. La route visible conserve donc le
Bureau/Cahier et ses liens jour/focus. Les absences de date, d'intervention ou
de domaine sont montrées comme réserves, jamais complétées par une valeur
pédagogique inventée. Aucun déplacement n'est écrit sans recalcul et choix
explicites.
🔄 **Le déploiement en bêta par compte** est sans objet depuis le 15/08 :
`learning_loop_mode` a été retiré avec la boucle qu'il gardait (ADR-070). La
suppression des 7 tables a fait l'objet de l'autorisation distincte que cette
ligne exigeait.
✅ **La validation de ce chantier reste gratuite pour l'instant** : aucun
environnement Supabase payant n'est créé. Les migrations et fixtures sont
préparées localement ; toute dépense future exigera un nouvel accord explicite.
✅ **La carte globale a été retirée** (21/08/2026, ADR-099). Ses tables
n'avaient jamais reçu une seule ligne et son chemin d'écriture n'existait plus.
L'overlay privé du compte porte désormais uniquement des faits locaux — états
dérivés du référentiel et des observations — jamais une copie d'un catalogue
externe. L'amorçage reste privé au compte : la personne déclare son sujet et
son intention de départ dans `/demarrer`, sans transformer cette déclaration en
objectif structuré ni en mesure. La carte personnelle n'a pas de fenêtre
dupliquée : sa surface canonique est le graphe de Mes cours. La Progression est
le **profil de carrière** (ADR-098) : elle porte la lecture longitudinale —
évolution du score rejouée depuis le journal, faits marquants, bilan de
croissance.
✅ **Les destinations portent des noms devinables** (24/08/2026, ADR-117).
« Atelier » est devenu **Mes cours**, « Bureau » **Séances**, et le mode archive
« Cahier » **Historique** ; « Carnet » a disparu du copy de la connexion. Quatre
métaphores de mobilier pour trois surfaces demandaient d'apprendre le plan avant
de pouvoir s'en servir. Les routes n'ont pas bougé. La phrase du tour d'accueil
qui présente ces destinations est désormais **dérivée** de `NAVIGATION` : elle
annonçait « vos trois espaces » en surlignant un rail qui en montrait quatre,
dont un retiré un mois plus tôt.
✅ **La lecture longitudinale n'encombre plus la fiche de travail** (31/08/2026).
La tentative de réunir « Fiches », « Arbre » et « Progression » dans chaque
domaine ajoutait trois lectures concurrentes avant le premier geste utile. La
fiche module/domaine sert désormais à travailler : reprendre une séance ou un
cours, consulter les échéances et retrouver les compétences. La Progression
globale conserve la comparaison entre domaines ; il n'existe plus de mode ni de
redirection `/progression?domaine=` vers Mes cours.
Le *concept* d'un catalogue partagé reste décrit dans
[`TWINY_MODEL.md`](docs/architecture/TWINY_MODEL.md) ; tout retour repartira du
modèle cible, avec un contenu initial réel et un curateur désigné avant toute
table.
✅ **Une preuve n'est jamais orpheline** (ADR-027) : une compétence sans preuve
se supprime, une compétence qui en porte s'archive — jamais l'inverse.
✅ **Le score porte sur ce qui est mesuré** (ADR-006) ; la couverture dit le
reste.
✅ **Une Connaissance est un élément déclaré, pas un document** (ADR-092). Elle
peut référencer des ressources ; aucune note, ressource ou partie du corpus
n'est convertie automatiquement en Connaissance. L'ancienne hiérarchie
persistante de thèmes et sous-thèmes a été retirée le 21/08/2026 (ADR-104) ;
elle n'est donc plus un contrat de l'application.
✅ **Les relations déclarées et calculées n'ont pas le même statut** (ADR-093).
Une relation validée et sourcée peut être persistée ; similarités et inférences
restent dérivées.
✅ **Niveau observé et maîtrise consolidée restent distincts** (ADR-095). Les
seuils actuels ne changent pas sans données ; la future interface distinguera
une performance ponctuelle d'une maîtrise étayée dans la durée.
✅ **Une séance créée conduit au workspace focus** (ADR-059), sans créer une
nouvelle entité à côté de `LearningSession`.
✅ **Observer le maximum pertinent** (ADR-060) : chaque signal recueilli doit
avoir une source, une finalité pédagogique et un consommateur dans la boucle.
✅ **P5 reste une garantie interne** : il n'est pas nécessaire de l'exposer dans
l'interface tant que le moteur et ses validations la rendent vraie.
✅ **Pas de reporting long terme maintenant** : les données sont insuffisantes
et les KPI actuels répondent au besoin présent. Réouverture sur fait nouveau.
✅ **Une seule application, un seul noyau, une expérience d'abord étudiante**
(25/08/2026, ADR-135). Le positionnement priorise les étudiants du supérieur ;
il n'ajoute ni type d'utilisateur `student`, ni colonne de persona sur le
compte, ni entité générique `LearningContext`, ni moteur de capacités selon le
public, ni application parallèle pour les autodidactes. Cours, échéances et
projets restent des faits déclarés du parcours (ADR-109, ADR-124, ADR-130) —
jamais l'identité permanente de la personne, jamais une source de mesure
automatique : après les études, l'historique et les compétences restent
utilisables tels quels. L'ouverture future vers d'autres publics est préservée
par le modèle métier, pas par une seconde version du produit.
✅ **Le module de cours est un domaine ; l'échéance s'y lie comme fait déclaré**
(25/08/2026, ADR-137). Déclarer ses modules = créer des domaines racines —
geste déterministe existant, sans appel tuteur ; la seule pièce nouvelle est la
colonne nullable `engagements.module_domaine_id`, posée à la création et validée
contre les domaines vivants du compte. Le sens inverse se dérive (`echeancesDuModule`),
jamais recopié. Aucune fusion forcée fiche ↔ domaine, aucune entité nouvelle.
✅ **La nature d'un domaine se déclare : module académique, progression
continue, ou à préciser** (26/08/2026, ADR-138). Le domaine reçoit un usage
déclaré — jamais déduit du nom, du parent, des documents ou des échéances ;
« à préciser » protège toutes les données existantes. Le module reste un cadre,
pas un propriétaire ni une mesure : une compétence taguée dans un module et
dans un domaine continu garde une identité, un historique et un état uniques ;
la clôture d'un module conserve tout l'historique ; les vues de module se
dérivent, la recommandation de module réutilise le moteur avec un périmètre
explicite. Quatre colonnes additives sur `domaines`, une commande gouvernée
séparée, aucune table nouvelle. L'entrée « Déclarer un besoin » est unique au
tableau de bord : son cadre ouvre le même parcours pour un module ou une
progression continue. « Mes cours » regroupe ensuite les domaines selon cet
usage déclaré, sans recopier compétences, échéances, séances ou scores.
Une fiche de domaine permet aussi de préciser ou corriger ce cadre après
création ; les domaines historiques restent « à préciser » tant que personne
ne pose ce geste.

Le module académique peut être créé vide : l'année et la période déclarent le
cadre, puis le cockpit de « Mes cours » permet de déposer le premier cours ou
d'ajouter la première compétence. Cette exception ne s'étend pas aux domaines
continus ; elle ne crée ni compétence sentinelle, ni score, ni contenu implicite.

Dans « À classer », Mes cours peut proposer le domaine qui a créé une
compétence comme point de départ stable. Cette proposition reste une lecture
du référentiel : elle n'écrit aucun tag à l'ouverture. La personne peut
sélectionner plusieurs compétences, confirmer les destinations ensemble, puis
annuler immédiatement cette confirmation ; un domaine archivé ou introuvable
ne produit aucune proposition automatique. Ce geste ne passe ni par le tuteur
ni par une nouvelle entité.

Une fiche de cours rassemble également les documents support du même domaine
ou portant une compétence commune, les échéances dérivées de son module et les
séances déjà acceptées qui en portent l'origine. Depuis ce même panneau, le
besoin déclaré et l'échéance réutilisent leurs entrées existantes ; consulter
ces repères ne modifie pas les données et ne déclenche pas le tuteur.

### Ouvert

🔬 **Le premier parcours atteint l'exercice avant le tableau de bord**
(construit le 24/08/2026, ADR-128). Après la saisie du sujet, un seul axe est
coché par défaut ; les autres propositions restent repliées et ne sont pas
écrites sans geste. Valider cet axe lance la rédaction d'un exercice unique,
que la personne relit puis accepte avant d'entrer directement dans une vraie
`LearningSession`. « Faire plus tard » conduit au tableau de bord. Le contrat
minimal de l'exercice reste cinq minutes : l'objectif de deux minutes porte sur
le temps pour **atteindre** le test, pas sur une durée fictive. Test de
réfutation : un compte tiers doit atteindre et commencer ce premier exercice
sans assistance, et le taux d'abandon avant l'énoncé doit baisser.

🔬 **Pertinence du classement adaptatif (ADR-066).** Le moteur déterministe et
ses règles de séquençage sont une politique explicable, pas la démonstration
d'une action pédagogiquement optimale. Test : au moins 10 boucles réelles avec
une seule famille désormais (ADR-070), en collectant acceptation, passage,
abandon, utilité et effort sans recalibrer avant un volume suffisant.
🔬 **Ergonomie des workspaces et du Mode de travail (ADR-066, révisé le
14/08).** Focus, guidage et puissance des outils sont les surfaces décidées ;
leur défaut exact reste à observer sur desktop et mobile. Une conformité
clavier, tactile ou WCAG vérifie la mécanique, pas l'utilité. La première
tentative a été retirée : elle avait remplacé le tableau de bord au lieu de s'y
brancher, et exposait le vocabulaire interne. Le contexte d'instant tient
désormais en deux champs dans la carte d'action ; qu'il soit suffisant reste à
observer.
🔬 **Qualité des preuves de projet (ADR-066).** Les conditions d'accès à une
preuve faible, moyenne ou forte sont des garde-fous de départ, non un barème
calibré. Les contradictions, rectifications et validations humaines doivent
être observées avant toute revendication ou modification des seuils.
✅ **Gouvernance transactionnelle** (ADR-065, acceptée le 22/08). Le
référentiel est gouverné par des commandes serveur, des versions optimistes,
des codes non réutilisables, une succession explicite et un journal append-only.
Le statut n'est pas monté par l'agent.
❓ **Modèle de domaines hiérarchiques** (ADR-107, construit le 23/08 — statut
inchangé, aucune donnée d'usage encore). Un domaine peut en contenir d'autres,
sans plafond de profondeur et sans table de sous-domaines : un sous-domaine est
un domaine avec un parent. Une compétence porte **plusieurs** tags de domaine,
ou aucun — elle est alors « À classer » : au référentiel, mais dans aucun
domaine tant qu'une personne ne l'y range pas. Un tag posé sur un sous-domaine
rend la compétence visible dans tous ses ancêtres par dérivation, jamais par
une ligne écrite ; déplacer un domaine ne réécrit ni compétence, ni observation,
ni score. Le domaine qui a produit le code (`LOG-01`) reste un namespace de
création, plus une propriété : le nommage des futures compétences reste ouvert.
Le tuteur peut proposer où une compétence sert, sur une liste fermée de
domaines existants ; il n'en pose aucun.
Les preuves et notes supportent le référentiel sans en devenir des entités ; les
thèmes persistants ont été retirés (ADR-104).
❓ **Relecture du référentiel entier** (ADR-108, construit le 23/08 — statut
inchangé). La relecture est désormais divisée en trois familles qui ne se
déclenchent pas l'une l'autre : **structure** quand le référentiel grandit ou
qu'un nouveau candidat déterministe apparaît ; **progression** quand une
compétence franchit réellement la maîtrise ou qu'une intention explicite est
modifiée ; **maintenance** quand un nouveau candidat de dormance apparaît.
Une activité récente seule n'autorise jamais un élargissement. Accepter un
rangement, un tag ou un lien ne relance donc pas la classification qui l'a
produit ; créer réellement une compétence rouvre seulement son rangement.

Les propositions de progression portent leur source structurée : code de la
maîtrise, ou portée et valeur exacte de l'intention lue. Une régression, un
archivage ou une intention modifiée les rend inapplicables sans effacer leur
historique. Rien ne s'écrit sans un geste. Un refus vaut pour l'horizon courant,
pas pour toujours : la même idée reste masquée tant qu'aucun fait nouveau de sa
famille n'arrive, puis elle peut être reproposée. Les lots vides et les familles
effectivement analysées sont datés séparément ; un échec du tuteur ne consomme
pas le déclencheur et sera retenté. La migration
`20260824170120_declenchement_relecture_sur_ajout_declare.sql` est appliquée en
production depuis le 24/08/2026 (historique Supabase :
`20260824173303_declenchement_relecture_par_famille`) ; la table de déclencheurs est append-only,
isolée par RLS, et ne stocke aucun état de maîtrise dérivé.

Depuis le 24/08/2026 (ADR-127), une
proposition qui **redit ce qui existe déjà** — un domaine à créer sous un autre
nom qu'un domaine vivant, une compétence à ajouter sous une autre formulation
qu'une compétence vivante — est écartée **avant** d'atteindre l'écran, et le
compte des écartées est rendu. Et un échec d'arbitrage s'affiche **avec son
motif** : les messages du produit ne sont plus masqués par la rédaction des
erreurs de Next. Le déclenchement repose sur des faits nouveaux par famille,
jamais sur une version ou un seuil de taille ; l'élargissement est ouvert sur arbitrage explicite
du 22/08/2026 et réversible en une ligne si sa rétention ne tient pas. Les
propositions se signalent d'elles-mêmes, à deux endroits qui ne font pas
doublon (ADR-118) : une pastille compte celles qui attendent, posée sur « Mes
cours » dans le rail — le signal, visible depuis n'importe quelle page — et un
avis sur le tableau de bord, l'entrée de pilotage, d'où l'on décide de ce qu'on
fait maintenant. Rien du tout quand il n'y en a pas. On ne va pas les
chercher — c'est la condition pour qu'un écran de plus soit lu. La dormance,
elle, ne vise plus que ce qui a eu le temps de servir : une compétence de moins
de trois mois n'est jamais proposée à la mise de côté, et une compétence sans
date de création ne l'est pas non plus. **Mettre de côté est réversible** :
la compétence est archivée — jamais supprimée, ce qui n'était pas le cas avant
le 24/08/2026 — et « Mises de côté », sur la fiche de son domaine, la reprend
d'un geste. La migration `20260825100000_archiver_competence` porte la commande
qui archive sans arbitrer ; elle est **appliquée depuis le 24/08/2026**.
🔬 Le barème `PLAFOND_AIDE` — l'architecture de mesure est décidée par ADR-057,
mais ses plafonds restent gelés jusqu'à environ 20 bilans terminés et n'ont pas
encore été confrontés à l'usage.
✅ Le 3ᵉ maillon est posé (ADR-028) et **a fonctionné le 01/08** (ADR-030) :
sur DEV-01 et DEV-03, la difficulté produite par le tuteur a suivi exactement
celle que la calibration conseillait. 🔬 *Reste de la réfutation : « la
dimension faible recule » demande un exercice réellement fait — les deux du
01/08 ont été abandonnés en 1 minute.*

⚠️ **Le premier tour complet a révélé un défaut que 194 tests n'avaient pas
vu** : le journal de preuves enregistrait les abandons comme des mesures à
zéro. Corrigé par ADR-030. Fait de méthode à retenir : faire tourner la boucle
mesure le système, pas seulement l'utilisateur.

⚠️ **Le deuxième tour, le 02/08, a buté sur l'inventaire.** Six irritants
d'immersion remontés à l'usage (ADR-034 à 036). Le fait qui les explique presque
tous : **40 des 54 compétences actives n'avaient aucun exercice**, pour un
corpus de 27. Suivre la « prochaine action » revenait à refaire les mêmes
échecs, non parce que la recommandation était mauvaise, mais parce qu'elle
n'avait rien d'autre à proposer. Deuxième leçon de méthode : **la boucle ne vaut
que ce que vaut son stock**, et le 1ᵉʳ maillon doit produire par lots, pas à
l'unité.

Ce tour a aussi montré un défaut d'un genre nouveau : `exercises.difficulte`
était une colonne `TEXT`, et `"1" + 0` vaut `"10"` — deux compétences se
voyaient conseiller la difficulté 5 sur la foi d'un partiel obtenu à
difficulté 1. Les 239 tests d'alors ne pouvaient pas le voir : ils passent tous
des valeurs déjà typées, jamais une valeur relue de la base. **Le moteur est
pur et vérifié ; ce qu'on lui donne à manger ne l'était pas.**

## 7. Critère d'arrêt

Une fonctionnalité n'entre pas dans ce produit parce qu'elle est intéressante,
mais parce qu'elle sert la boucle du §1 et la phrase du §3. Depuis le
25/08/2026 (ADR-135), complétée le 27/08 par ADR-139, toute proposition doit
d'abord répondre **oui** à au moins une de ces cinq questions :

1. Aide-t-elle l'étudiant à décider quoi travailler avant une échéance ?
2. Produit-elle une observation plus fiable de ce qu'il sait faire ?
3. Rend-elle l'évolution de son niveau plus compréhensible ?
4. Réduit-elle fortement la friction pour accomplir l'une de ces trois choses ?
5. Aide-t-elle à construire ou ajuster un plan réaliste sans demander à
   l'étudiant d'administrer le système ?

Être simplement *compatible* avec les études ne suffit pas. Cette grille
s'applique **à toute proposition, y compris celles venant d'une session
Claude.**

**Classification des fonctionnalités (25/08/2026, ADR-135) :**

| Priorité | Fonctionnalités | Traitement |
|---|---|---|
| Cœur | Compétences, interventions, tentatives, observations, état, progression, recommandation, plan dérivé | Renforcer, rendre immédiatement compréhensible |
| Cadre étudiant | Cours/modules, emploi du temps, disponibilités, échéances, examens, projets académiques | Relier directement à la boucle principale |
| Facilitateurs | Dépôt de cours, tuteur, `LearningSession`, mode épreuve, calendrier externe, notes utiles au travail | Conserver seulement lorsqu'ils réduisent la friction |
| Administration | Référentiel, relations, classements, maintenance documentaire | Secondaire et contextuel |
| Hors priorité | Contextes professionnels, moteur multi-persona, productivité universelle | Ne plus développer à court/moyen terme |

Le projet étudiant — TP, rapport, livrable — reste dans « Cadre étudiant »
avec sa réserve : associable à un cours, une échéance et des compétences, il
ne modifie jamais l'état simplement parce qu'il existe ou est déclaré terminé.
❓ Sa valeur de preuve reste sous contrat explicite (§6) : aucune observation
sans travail vérifiable.

**Le cas des outils** (ADR-122). Un outil n'est pas une étape de la boucle : il
l'assiste. Deux portes, et seulement deux :

1. **Sur le chemin d'une preuve** — l'outil est traversé par le geste qui
   produit une Observation. Il entre, visible par défaut. *La palette de
   formules : on la rencontre en rédigeant sa réponse à un exercice.*
2. **Éteint par défaut** — l'outil n'est sur aucun chemin, mais un compte qui
   ne l'allume jamais ne peut pas constater son existence en travaillant. Il
   entre, et il reste éteint. *La calculatrice de séance.*

Tout le reste relève du refus ci-dessus. Un outil intéressant, visible par
défaut, hors du chemin d'une preuve, est la définition de la dérive de
périmètre.

### Lot 7 — exécution multi-interventions

🔬 Une `LearningSession` peut exécuter plusieurs interventions dans une même
coquille. Le registre canonique réutilise les chemins Résoudre/Diagnostiquer,
Feynman, rappel, lecture, écriture et tiroir du tuteur. Chaque geste expose sa
source, sa durée et son effet ; terminer une préparation ou un soutien dit
explicitement qu'aucune nouvelle mesure n'a été produite. Les tentatives restent
la source de vérité des exercices et le contrat de preuve est le seul chemin
vers une Observation. Le statut facultatif du geste est conservé dans le JSONB
déjà porté par la séance : il ne crée ni entité ni score dérivé. Les séances
historiques sont adaptées sans réécriture.

### Lot 8 — cours et plan global (fondations expérimentales gelées)

❓ Le protocole d'un cours possède désormais un adaptateur pur vers les actions
candidates du plan global. L'identité de chaque candidate distingue la fiche et
le PDF effectivement analysé ; ce PDF précis voyage dans l'origine des nouvelles
séances du chemin historique et reste le seul que la génération différée puisse
relire. Une séance historique sans cette origine reste lisible, mais ne choisit
aucun PDF de substitution. Un document archivé, un domaine orphelin ou un code
hors référentiel est refusé ou mis en réserve, jamais remplacé par un exercice
générique.

La fiche d'un module dérive « Cette semaine » des `LearningSession` acceptées et
« Échéances » des engagements et preuves disponibles. Ces lectures ne stockent
ni échéance recopiée, ni plan, ni préparation. Sans preuve, la préparation est
« Non estimable » ; le besoin de diagnostic reste une raison d'action, pas une
mesure.

La proposition du tableau de bord reste dérivée et porte une référence opaque
et stable pour les mêmes entrées matérielles. Elle réunit les recommandations
historiques, les besoins déclarés, les échéances ouvertes et, lorsqu'il est
fourni par le parcours de cours, les candidates du protocole. Les codes passent
par le référentiel actif à la frontière d'adaptation. Une séance active ou un
diagnostic déjà terminé dans le parcours est écarté ; les candidates
équivalentes sont fusionnées par codes, intervention et durée, en conservant
la provenance de priorité et les raisons réunies. La personne peut sélectionner
une partie, tout sélectionner, tout désélectionner ou ignorer toute la
proposition. Ignorer écrit seulement ce fait dans `refus_recommandations` ;
aucune `LearningSession`, observation, dette ou pénalité n'en découle. Une
proposition ignorée ne revient pas tant que ses échéances, créneaux, travaux
disponibles ou séances acceptées n'ont pas changé. Les états sans séance
expliquent la cause en langage courant ; les identifiants et détails techniques
restent dans les journaux.

La proposition de plan global, sa revue et son acceptation appartiennent encore
aux fondations non raccordées de l'itération du 26–30/08. Le tableau de bord
visible ne les affiche pas : il conserve sa recommandation historique et le bloc
« Aujourd'hui » ne contient que des séances persistées `planifiee` ou
`en-cours`.

Lorsqu'une recommandation désigne un exercice déjà disponible, la carte propose
aussi une planification explicite : la personne choisit une date et une heure,
puis le chemin canonique de création écrit une seule `LearningSession`
`planifiee`. Ce geste n'enregistre ni la recommandation ni un plan global ;
après actualisation, la séance rejoint « Aujourd'hui » seulement si son jour
civil local correspond. Les recommandations qui ne désignent pas un exercice
conservent leurs actions existantes.

L'arbitrage est déterministe et ne modifie aucun seuil de calibration : les
séances actives sont exclues, les codes inactifs sont mis en réserve, puis une
seule candidate est conservée par besoin équivalent. À égalité, la provenance
de cours précède le besoin déclaré, les activités durables, puis l'exercice
historique ; l'échéance et l'ordre temporel restent ensuite ceux du
planificateur existant. Seules les séances acceptées sont matérialisées. Pour
une candidate de cours acceptée par le plan global, la commande locale porte
également le blueprint documentaire ; la migration
`20260829190000_plan_acceptation_origine_cours.sql` est appliquée à distance
sous `20260829174131` et sa définition est vérifiée. Le chemin direct historique du protocole reste donc
en place jusqu'à la preuve de parité globale ; il ne doit pas être retiré avant.
Le statut d'ADR-139 reste ❓.

La revue d'un plan accepte maintenant les déclencheurs déjà portés par les
faits relus : modification d'une échéance ou d'une disponibilité, séance
annulée, déplacée, manquée ou abandonnée, et nouvelle observation recevable.
`calculerDiffPlan` reste pur : il distingue ce qui reste, se déplace, ne figure
plus ou apparaît, sans persister le nouveau plan. L'action « Déplacer » relit
le créneau et la séance au moment du clic, conserve l'identité et l'origine de
la `LearningSession`, puis transmet un ajustement atomique à la RPC existante.
Un conflit ou une donnée devenue obsolète bloque l'écriture entière ; aucun de
ces gestes ne crée de compétence, d'observation, de dette ou de pénalité.

Les huit interventions (`resoudre`, `expliquer`, `rappeler`, `lire`,
`synthetiser`, `produire`, `diagnostiquer`, `demander-aide`) restent des gestes
de la même `LearningSession`. Leurs entrées, interfaces, sorties, provenances
et contrats de preuve sont décrits dans la
[matrice des interventions](docs/architecture/INTERVENTIONS_LEARNING_SESSION.md).
Les parcours exercice réutilisent `VueExercice` ; Feynman revient à la séance
au lieu d'en créer une seconde ; rappel, lecture, synthèse et production
restent respectivement dans leur carte, l'Atelier ou le tuteur existant. Une
intervention de préparation ou de soutien terminée sans contrat reste une
séance terminée sans observation.

Dans un module académique actif, un cours, une note, une définition, un
exercice donné ou un devoir peut désormais devenir explicitement une séance
immédiate ou planifiée. Le menu propose seulement les gestes cohérents avec le
contenu ; la `LearningSession` conserve le module et le document source dans
son intervention. Tous ces chemins annoncent un effet de préparation. En
particulier, « résoudre » un exercice donné sans corrigé ouvre un travail écrit
sans contrat de preuve : le terminer ne crée aucune Observation. Cette
intégration visible ne valide pas le plan global d'ADR-139.

### Lot 9 — créneaux et échéances concrètes

🔬 Le tableau de bord expose désormais une configuration permanente et courte :
la personne ajoute, modifie ou supprime plusieurs créneaux disponibles, puis
déclare plusieurs échéances depuis le même écran. Les créneaux sont conservés
dans le tableau déclaré du profil et validés ensemble ; une plage inversée ou
un chevauchement est refusé. Une absence de créneau demeure une absence de fait,
jamais une faiblesse ou une indisponibilité fabriquée. Aucun parcours local à
acquitter, calendrier externe, plan, score ou nouvelle entité de travail n'est
créé.

La migration additive `20260828201530` (`lot_9_contexte_declare`) a été
appliquée et vérifiée dans Supabase le 28/08/2026. Le code n'utilise plus la
colonne historique `profiles.periode_declaree`, qui n'alimentait aucune
décision ; la migration de retrait `20260829155409_retirer_periode_declaree_inutile.sql`
est préparée localement mais reste à appliquer. La base distante contient
encore cette colonne et une valeur sur un profil jusqu'à autorisation de ce
retrait. `profiles.disponibilites_declarees` reste la seule donnée de créneaux.

### Contenus scientifiques et figures

🔬 Les formules sont lisibles à la consultation comme à la saisie : KaTeX est
composé par une primitive commune, le texte Unicode reste le repli accessible,
et les champs pédagogiques qui proposent la palette affichent un rendu
immédiat avec le même chemin que la lecture. Dans le chat, la formule est
composée directement dans la zone d’édition ; sa source reste conservée pour
un geste explicite d’édition, sans devenir une mesure ni une donnée dérivée.

❓ Le modèle `Exercise` ne porte pas encore de figure structurée. Le contrat
minimal et la migration candidate sont décrits dans
[`docs/architecture/MATHEMATIQUES_FIGURES.md`](docs/architecture/MATHEMATIQUES_FIGURES.md),
mais aucune colonne ni association n'est considérée comme validée ou déployée.

---

## Annexe — envisagé puis écarté

🗑️ **« Geler le développement trois semaines pour n'utiliser que l'app. »**
Écarté le 27/07 : le temps disponible permet les deux. **Ne pas reproposer sans
fait nouveau.**

🗑️ **« Écrire 30 exercices seed supplémentaires à la main. »** Écarté le 27/07 :
coût récurrent, non transférable à un autre référentiel. *Nuance posée le
29/07 (ADR-020) : un lot ponctuel de 10 exercices seed a été écrit pour
amorcer le nouveau domaine Développement, par le même précédent que les 11
diagnostics d'origine — ce n'est pas une réouverture de la pratique récurrente
écartée ici.*

🗑️ **« Corriger le score global sans arbitrage. »** Écarté lorsque P2 était
encore ouverte. L'arbitrage a ensuite été rendu le 31/07 (ADR-006) : la formule
porte sur le seul périmètre mesuré et la couverture dit le reste.
