# PRODUCT.md — Système pédagogique

**Version 3.1 — 20/08/2026.** Les contrats de la refonte Twiny ont été validés
explicitement par Maxime le 20/08/2026 et sont consignés par ADR-089 à ADR-095.
Ils remplacent uniquement les contrats courants qu'ils contredisent ; les
observations, métriques et récits historiques restent inchangés.

**Version précédente : 3.0 — 13/08/2026.** Fusion de `PRODUCT_VISION.md` et
`PRODUCT_PRINCIPLES.md` (v1.0, 27/07), dont les démonstrations détaillées
restent dans l'historique git. Document vivant : toute modification doit
préciser ce qui passe d'une catégorie à l'autre.

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

Une **boucle d'actions d'apprentissage** : contexte déclaré + objectifs +
profil dérivé → meilleure action étayée maintenant → activité → preuve
éventuelle → observation → état recalculé.

Le noyau implémenté reste, jusqu'au lot 1,
`SkillEvidence → SkillState → recommandation`. Dans le vocabulaire cible,
`SkillEvidence` porte aujourd'hui des Observations. Le geste **probant** reste
l'exercice, mais il n'est pas le seul geste
d'apprentissage : le **mini-projet** existe, sous forme de note opérationnelle
(ADR-070). Il produit du travail et du contexte, pas encore une mesure — la
question de son contrat de preuve se rouvrira quand un projet aura été mené à
son terme. Explorer, elle, a été retirée faute de surface. Survit aussi
l'arbitrage à l'instant T — temps disponible et capacité déclarée — qui
réordonne la file sans qu'aucune table ne l'assiste.

Autour d'elle, un **instrument de mesure** dont la fonction première est de
**refuser d'affirmer ce qu'il ne peut pas prouver**. L'utilisateur travaille,
le système conserve les déclarations, activités, traces, observations,
productions et feedbacks ; il en **dérive** niveaux, tendances et prochaine
action. Le « jumeau numérique » est cette vue recalculée, jamais un profil
stocké. Rien de ce qui peut être recalculé n'est persisté.

La recommandation n'est jamais présentée comme absolument optimale. Elle est la
**meilleure action étayée maintenant**, accompagnée de son pourquoi et de ses
réserves. Elle vit dans la carte d'action qui existait déjà : la boucle n'a pas
d'écran à elle, et la file des suivantes reste où elle était.

**Le vocabulaire d'implémentation ne remonte jamais à la surface.** *Artefact*,
*snapshot*, *modèle*, *version*, *exécution*, *inventaire recalculé*,
*événement d'audit* décrivent des mécanismes, pas des gestes d'apprentissage.
Ils vivent dans le code et dans les ADR. À l'écran on dit *production*,
*travail en cours*, *ce que tu as rendu*, *l'original est conservé*. Un écran
qui compte des objets internes est un écran de maintenance : il n'a pas sa
place devant quelqu'un qui vient travailler.

Ce n'est pas un tracker d'habitudes, pas un LMS, pas un outil de révision. La
distinction tient en une phrase : **un tracker enregistre ce que tu déclares
avoir fait ; ce système enregistre ce qui a été observé, et en tire ce qu'il
peut honnêtement en tirer — souvent moins que ce qu'on aimerait.**

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

> Savoir **ce que tu sais réellement faire**, avec le degré de certitude qui
> va avec — et choisir la meilleure action étayée maintenant, pour une raison
> qu'on peut te montrer.

| Promesse | État au 28/07/2026 |
|---|---|
| « ce que tu sais réellement faire » | ✅ Tenue. Le moteur est complet et testé. |
| « avec le degré de certitude » | ✅ Tenue. Niveau / confiance / robustesse sont distincts et affichés. |
| « quoi travailler ensuite » | 🟡 **La boucle a tourné en entier le 01/08** (ADR-030). La difficulté produite a suivi le conseil de la calibration sur les deux compétences où il existait — le 3ᵉ maillon est démontré. La seconde moitié du test reste à mesurer : les deux tentatives ont été abandonnées en 1 minute, donc aucune dimension n'a pu reculer. |
| « parmi plusieurs façons d'apprendre » | 🔬 **Deux gestes existent** depuis le 15/08 : l'exercice et le mini-projet, ce dernier sur le chemin documentaire (ADR-070). Reste à vérifier — aucun projet n'a encore été mené à son terme. |

## 4. Public

**Aujourd'hui, factuellement (31/07) :** 3 comptes en production. Un
utilisateur actif (26 preuves sur 22 compétences, 20 tentatives terminées), un
**compte tiers réellement actif** (3 preuves, 5 tentatives), un compte sans
aucune activité pédagogique.

**Cible déclarée :** toute personne souhaitant un suivi longitudinal de ses
compétences avec un parcours personnalisé.

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

✅ **Le contenu vient du tuteur**, pas de fichiers écrits à la main (ADR-004).
✅ **Le moteur du tuteur est configurable par environnement** ; aucun fournisseur
gratuit canonique n'est imposé. Le choix se valide par la mesure (ADR-007).
✅ **Construire et utiliser en parallèle** est le mode de travail retenu.
✅ **La boucle est le produit** (ADR-066). Son arbitrage — temps disponible,
capacité déclarée — vit dans la carte d'action et fonctionne sans aucune table.
🔄 **Les familles Explorer et Produire ont été retirées le 15/08 (ADR-070)** :
la seconde avait produit une exécution planifiée, jamais démarrée, et aucune
preuve. L'exercice redevient le geste unique, non par principe mais faute d'un
usage qui justifie les autres.
✅ **Le contexte immédiat est déclaré, jamais deviné** : temps disponible,
capacité mentale ressentie, intention, cible facultative et note verbatim.
✅ **Le parcours est une file d'actions dérivée** (ADR-096). Le système
d'objectifs structurés du lot 4 a été retiré le 21/08/2026 après retrait
humain explicite : il ne convenait pas. Le parcours se dérive des faits
(recommandations du moteur, ordonnées par l'espace actif) et n'est visible
que par les actions recommandées — jamais comme surface autonome. Les
intentions déclarées restent des textes verbatim du profil
(`objectif_moyen_terme`, `objectif_long_terme`), sans extraction ni
rattachement automatique.
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
✅ **`LearningSession` reste l'épisode de travail unique.** Plusieurs activités
durables peuvent rester ouvertes, mais une seule séance peut être `en-cours`
par compte. Les exercices historiques passent par un adaptateur sans copie ni
double écriture.
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
dupliquée : sa surface canonique est le graphe de l'Atelier. La Progression est
le **profil de carrière** (ADR-098) : elle porte la lecture longitudinale —
évolution du score rejouée depuis le journal, faits marquants, bilan de
croissance. Le *concept* d'un catalogue partagé reste décrit dans
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

### Ouvert

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
mais parce qu'elle sert la boucle du §1 et la phrase du §3. La grille
d'évaluation est dans `CLAUDE.md` §9 et s'applique **à toute proposition, y
compris celles venant d'une session Claude.**

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
