# ARCHITECTURE_DECISIONS.md — Système pédagogique

**Version 1.0 — 27/07/2026.**

Registre des décisions structurantes. Une décision entre ici quand elle est
**coûteuse à défaire**. Le reste n'a pas besoin d'être documenté.

**Statuts :** ✅ Acceptée · 🔬 Hypothèse · ❓ Ouverte · 🗑️ Abandonnée ·
🔄 Remplacée.

Une décision n'est ✅ que si elle a été **tranchée explicitement par une
personne**. Une analyse, même convaincante, reste 🔬 ou ❓.

| # | Sujet | Statut |
|---|---|---|
| [001](#adr-001) | Séparation observé / dérivé, moteur pur | ✅ Acceptée |
| [002](#adr-002) | Deux dorsales exclusives, jamais synchronisées | 🔄 Remplacée par ADR-015 |
| [003](#adr-003) | Aucune librairie UI tierce | ✅ Acceptée |
| [004](#adr-004) | Le contenu pédagogique vient du tuteur | ✅ Acceptée (27/07) |
| [005](#adr-005) | Le moteur de recommandation est aujourd'hui une file d'attente | 🔬 Hypothèse |
| [006](#adr-006) | Traitement des compétences non mesurées dans le score global | ❓ Ouverte |
| [007](#adr-007) | Tuteur intégré, moteur configurable | ✅ Acceptée (27/07) |
| [008](#adr-008) | L'autonomie mesurée ignore l'aide externe | ❓ Ouverte |
| [009](#adr-009) | Généralisation du référentiel | ❓ Ouverte, reportée |
| [010](#adr-010) | Widget de TODOs dev partagé entre comptes | 🔄 Remplacée par ADR-019 |
| [011](#adr-011) | Conservation de l'objet `Exercise` | ❓ Ouverte |
| [012](#adr-012) | Schéma SQL idempotent sans outil de migration | ✅ Acceptée, fragile |
| [013](#adr-013) | **La boucle est le produit** — cadrage du chantier soustractif | ✅ Acceptée (28/07) |
| [014](#adr-014) | Suppression des six entités sans usage | ✅ Acceptée (28/07) |
| [015](#adr-015) | Dorsale unique : Supabase | ✅ Acceptée (28/07) |
| [016](#adr-016) | Suppression du mode démonstration | ✅ Acceptée (28/07) |
| [017](#adr-017) | Suppression de la gamification (XP, paliers, badges) | ✅ Acceptée (28/07) |
| [018](#adr-018) | Périmètre pilote : domaine Logistique | 🔄 Remplacée par ADR-020 |
| [019](#adr-019) | Le widget de TODOs dev sort du produit | ✅ Acceptée (28/07) |
| [020](#adr-020) | Pivot du périmètre pilote : Développement logiciel | ✅ Acceptée (29/07) |
| [021](#adr-021) | Compression et chargement conditionnel des protocoles du tuteur | ✅ Acceptée (29/07) |
| [022](#adr-022) | Vérification locale du jeton (`getClaims`) sur le chemin chaud | ✅ Acceptée (31/07) |
| [023](#adr-023) | Cache des données inter-requêtes | 🗑️ Écartée par [024](#adr-024) (31/07) |
| [024](#adr-024) | Le cache de navigation est celui de Next, et l'invalidation est uniforme | ✅ Acceptée (31/07) |
| [025](#adr-025) | La traçabilité peut être repliée, jamais retirée | ✅ Acceptée (31/07) |
| [026](#adr-026) | Le référentiel est une donnée par compte, construite par le tuteur | ✅ Acceptée (31/07) |
| [027](#adr-027) | Suppression ou archivage : une preuve n'est jamais orpheline | ✅ Acceptée (31/07) |
| [028](#adr-028) | Le 3ᵉ maillon : la difficulté et l'angle sont dérivés des tentatives | ✅ Acceptée (31/07) |
| [029](#adr-029) | Aucun profil n'est écrit dans les protocoles | ✅ Acceptée (31/07) |
| [030](#adr-030) | Aucune preuve n'est écrite sur une tentative qui n'a pas eu lieu | ✅ Acceptée (01/08) |
| [031](#adr-031) | Les propositions du tuteur passent en sortie structurée | ✅ Acceptée (01/08) |
| [032](#adr-032) | Ce qu'un validateur rejette n'a pas à être un paragraphe de prompt | ✅ Acceptée (01/08) |
| [033](#adr-033) | L'aide extérieure se demande, l'autonomie se dérive | ✅ Acceptée (01/08) |
| [034](#adr-034) | Un exercice échoué ne revient qu'après un progrès démontré | 🔬 Hypothèse (02/08) |
| [035](#adr-035) | Cycle de vie d'un exercice : le calque d'ADR-027 | 🔬 Hypothèse (02/08) |
| [036](#adr-036) | Le tuteur voit le corpus, jamais les énoncés | 🔬 Hypothèse (02/08) |
| [037](#adr-037) | P5 reformulé : le tuteur écrit le contenu, jamais la mesure | ✅ Acceptée (03/08) |
| [038](#adr-038) | Le retrait de la preuve manuelle | ✅ Acceptée (04/08) · ⚠️ corrigée le 07/08 |
| [039](#adr-039) | Le « crash du tuteur » était une boucle infinie de rendu | ✅ Acceptée (04/08) |
| [040](#adr-040) | La réponse écrite est la condition du bilan ; l'abandon est un geste | 🔬 Hypothèse (07/08) |
| [041](#adr-041) | Le tuteur voit la correction sur un seul chemin, et n'en écrit aucune mesure | 🔬 Hypothèse (07/08) — amende [036](#adr-036) |
| [042](#adr-042) | La maîtrise est un prédicat dérivé ; l'évolution est proposée, jamais appliquée | 🔬 Hypothèse (07/08) |
| [043](#adr-043) | Le tuteur désigne un code, il n'en frappe aucun | ✅ Acceptée (07/08) — précise [026](#adr-026) |
| [044](#adr-044) | Un référentiel se révise ; le retrait reste dérivé | 🔬 Hypothèse (07/08) |
| [045](#adr-045) | La difficulté conseillée demande confirmation ; la durée de référence est observée | 🔬 Hypothèse (09/08) |
| [046](#adr-046) | Le tuteur garde la mémoire de ses verdicts | 🔬 Hypothèse (09/08) |
| [047](#adr-047) | Un exercice se corrige ; les preuves qu'il a produites ne bougent pas | 🔬 Hypothèse (09/08) |
| [048](#adr-048) | La séance existait déjà : elle s'étend, elle ne se recrée pas | ✅ Acceptée (10/08) |
| [049](#adr-049) | Le CAF n'ajoute qu'une pièce : le modèle d'assemblage | ✅ Acceptée (10/08) |
| [050](#adr-050) | Le besoin déclaré est un fait stocké ; l'écart est dérivé, et il n'y a pas de score de biais | ✅ Acceptée (10/08) |
| [051](#adr-051) | Le moteur travaille sur `importance`, pas sur un objectif déclaré | ❓ Ouverte |
| [052](#adr-052) | Le moteur dérive sans validation ; seul le tuteur ne mesure jamais | ✅ Acceptée (10/08) — précise [037](#adr-037) |
| [053](#adr-053) | Pilotage au tableau de bord, analyse dans Séances ; navigation à trois pôles | ✅ Acceptée (10/08) |
| [054](#adr-054) | L'actionnabilité départage sans pénaliser ; un partiel suit la règle de l'échec | ✅ Acceptée (10/08) |
| [055](#adr-055) | Le thème : une portée modulaire, pas une arête de plus | 🔬 Hypothèse (10/08) |
| [056](#adr-056) | Le graphe est une vue dérivée : nœuds typés, liens réels, aucune arête fabriquée | ✅ Acceptée (11/08) |
| [057](#adr-057) | L'autonomie se mesure par traces, puis se demande pour l'invisible | ✅ Acceptée (11/08) |
| [058](#adr-058) | Granularité sans plafond ; les notes servent la boucle et entrent dans le graphe | ✅ Acceptée (11/08) |
| [059](#adr-059) | Une séance créée conduit au workspace focus | ✅ Acceptée (11/08) |
| [060](#adr-060) | Observer le maximum pertinent, jamais le maximum indiscriminé | ✅ Acceptée (11/08) |
| [061](#adr-061) | Séances : un hub et un workspace, pas quatre vues | ✅ Acceptée (11/08) |
| [062](#adr-062) | Le pôle devient Cahier ; la relecture synthétise et toute prochaine action ouvre le focus | ✅ Acceptée (11/08) |

*(037 à 039 avaient été omises de ce tableau ; rattrapées le 07/08. 045 à 047
l'étaient aussi ; rattrapées le 10/08. 051 et 052 ont été écrites en parallèle du
lot 1/2 de ce chantier, sur un sujet distinct — voir la note de numérotation en
tête d'[ADR-053](#adr-053).)*

---

<a name="adr-001"></a>
## ADR-001 — Séparation observé / dérivé, moteur pur ✅

**Date.** Antérieure au 24/07/2026 (fondatrice).

**Contexte.** Un système de suivi de compétences peut stocker les niveaux, ou
les recalculer. Stocker est plus rapide et plus simple.

**Décision.** Ne stocker que des faits observés. Recalculer tout le reste à
chaque lecture, dans `lib/engine/`, pur et sans I/O.

**Conséquences.**
- ✅ Un changement de règle d'évaluation se propage rétroactivement à tout
  l'historique. Aucune migration de données n'est jamais nécessaire pour cela.
- ✅ Impossible d'avoir un niveau sans preuve : l'incohérence est
  structurellement inatteignable.
- ⚠️ Coût de calcul à chaque affichage (43 états + agrégats + XP +
  recommandations). Acceptable au volume actuel ; à surveiller.

**Alternative écartée.** Matérialiser les niveaux en base. Rejetée : c'est
précisément ce que le système existe pour empêcher.

---

<a name="adr-002"></a>
## ADR-002 — Deux dorsales exclusives 🔄

> 🔄 **Remplacée le 28/07/2026 par [ADR-015](#adr-015)** — dorsale unique
> Supabase. La section ci-dessous est conservée pour l'historique : elle
> explique pourquoi `app/data/store/*.json` a été, pendant trois jours, une
> source d'analyses fausses.

**Date.** 26/07/2026 (commit `d6826d4`, « ouvrir le suivi aux comptes
Supabase » ; fusionné par `47a93f0`).

**Décision.** `lib/store/db.ts` choisit à chaque requête **soit** Supabase
(compte connecté, isolation par RLS) **soit** le journal JSON local. Jamais les
deux. Aucune synchronisation.

**Conséquences.**
- ✅ Pas de divergence possible entre deux copies.
- 🔴 **`app/data/store/*.json` n'est plus une sauvegarde de la production.**
  C'est un état figé au 25/07. Une analyse fondée sur ces fichiers est fausse —
  **c'est arrivé le 27/07** : un relevé produit à partir du journal local
  annonçait 11 preuves au 25/07, alors que la production en comptait 15 au 27/07,
  dont 4 séances le jour même.
- 🔴 En mode local, les Server Functions écrivent **sans authentification**.
  Acceptable sur `localhost`, dangereux dès l'exposition réseau.

**Règle opérationnelle qui en découle.** Toute question sur l'état réel des
données se résout **en interrogeant Supabase**, jamais en lisant
`app/data/store/`. Ces fichiers devraient être renommés ou marqués comme
archive.

---

<a name="adr-003"></a>
## ADR-003 — Aucune librairie UI tierce ✅

**Décision.** Pas de shadcn, Radix, recharts ni équivalent. Primitives et
graphiques SVG écrits à la main (`components/charts/`, 362 lignes).

**Conséquences.** ✅ Aucune dette de mise à jour, contrôle total du rendu et de
l'accessibilité. ⚠️ Tout composant non trivial est à écrire.

**Statut.** Confirmée dans `CLAUDE.md` §7. Une dépendance ne s'ajoute qu'avec
confirmation explicite.

---

<a name="adr-004"></a>
## ADR-004 — Le contenu pédagogique vient du tuteur ✅

**Date.** 27/07/2026. **Tranchée par Maxime.**

**Contexte — le fait qui force la décision.**

| Mesure au 27/07 | Valeur |
|---|---|
| Exercices existants | 11, tous des diagnostics de démarrage |
| Exercices consommés | 8 |
| **Exercices restants** | **3** |
| Exercices créés par le tuteur ou manuellement | **0** |
| Compétences sans aucun exercice | **31 / 43** |

Dès la 4ᵉ position, les recommandations du moteur pointent vers des compétences
sans support de travail. L'interface bascule alors sur « Demander un exercice
au tuteur » (`prochaine-action.tsx:92`) — **le tuteur est donc déjà, par
conception, le moteur de contenu du système.**

Or la boucle est asymétrique :

| Boucle | Gabarit | Parseur | Pré-remplissage | État |
|---|---|---|---|---|
| Tuteur → **preuve** | `PROPOSITION DE MISE À JOUR` | `lib/tutor/proposition.ts` | fiche compétence | ✅ fermée |
| Tuteur → **exercice** | — | — | — | ❌ **ouverte** |

Le type `Exercise` déclare `origine: "seed" | "tuteur" | "manuel"`. **La valeur
`"tuteur"` est inatteignable dans tout le code** : le design l'avait anticipée,
elle n'a jamais été câblée.

**Décision.** Le corpus d'exercices se construit par propositions du tuteur,
validées par l'utilisateur — par symétrie exacte avec la boucle de preuves
existante. Pas par écriture manuelle de fichiers seed.

**Contrainte attachée.** ✅ La solution retenue doit être **gratuite**
(décidée le même jour, voir ADR-007).

**Compatibilité avec les principes.** Conforme à P5 : le tuteur *propose*,
l'utilisateur *valide*, l'application écrit. Un exercice est un fait observé
(« cet énoncé a été proposé le J »), pas une donnée dérivée — il a sa place sur
le disque sans contrevenir à P1.

**Risque assumé.** Un exercice généré n'est relu par personne. Le corpus se
remplira de contenu de qualité inégale, et ce corpus alimente ensuite les
recommandations. Traitement prévu : `origine` affichée, et possibilité
d'écarter un exercice raté — même contrat que pour une preuve contradictoire
(P4 : on conserve, on qualifie, on ne supprime pas).

**Alternatives écartées.**
- 🗑️ Écrire 30 exercices seed à la main : coût récurrent, non transférable à un
  autre référentiel, bloquant pour ADR-009.
- 🗑️ Supprimer l'objet `Exercise` et ne travailler qu'en conversation : voir
  ADR-011, qui reste ouverte pour une raison distincte.

---

<a name="adr-005"></a>
## ADR-005 — Le moteur de recommandation est aujourd'hui une file d'attente 🔬

**Statut.** Hypothèse argumentée, **non validée par l'auteur**. Aucune action
décidée.

**Observation.** Exécution du moteur sur les données réelles du 27/07 :

```
63 | TECH-01  | Recommandé car elle figure au rang 11 de ton plan… et elle est centrale pour ton objectif Master ITI.
61 | PROD-03  | Recommandé car elle figure au rang  6 de ton plan… et elle est centrale pour ton objectif Master ITI.
59 | ALGO-05  | Recommandé car elle figure au rang  8 de ton plan… et elle est centrale pour ton objectif Master ITI.
53 | RO-02    | …  (aucun exercice)
```

**Deux causes mesurées.**

1. **`importance` ne discrimine pas.** Les 43 valeurs vont de 0,70 à 1,00
   (moyenne 0,86 ; 18 compétences à ≥ 0,90). Contribution : 17,5 à 25 points,
   sur des totaux de 47 à 85. Le facteur est proche du bruit.
2. **Le bonus « jamais évaluée » (30 + jusqu'à 30) écrase tout** tant que
   31 compétences sont vierges. Les 7 autres facteurs (transfert, robustesse,
   prérequis, erreurs, ancienneté) sont **inertes**.

**Conséquence.** La justification — signature du produit (P3) — est quasi
identique partout.

**Nuance importante, contre l'alarmisme.** Ce comportement est **correct en
phase de diagnostic** : quand rien n'est mesuré, mesurer est effectivement la
meilleure action. L'hypothèse à tester n'est pas « le moteur est cassé » mais
« le moteur ne redeviendra pas informatif tout seul ».

**Test de réfutation.** Quand la couverture dépassera ~50 % (≈ 22/43
compétences évaluées), les facteurs secondaires devraient reprendre la main et
les justifications se diversifier. **Si ce n'est pas le cas à ce moment-là,
alors le barème est à revoir.** D'ici là : ne rien changer.

---

<a name="adr-006"></a>
## ADR-006 — Compétences non mesurées dans le score global ✅

**Date.** 31/07/2026. **Tranchée par Maxime.** Option **B**.

**Décision.** Le score global porte sur les **seules compétences mesurées**. La
couverture (`competencesEvaluees` / `competencesTotal`) devient l'indicateur
distinct de ce qui reste à mesurer. Ce qui sort du score y revient entièrement.

**Ce qui a forcé l'arbitrage.** ADR-026 rend le référentiel extensible par
l'utilisateur, et le tuteur peut lui en proposer l'extension. Le défaut cessait
d'être une verrue documentée pour devenir une **incitation structurelle à ne pas
étendre son référentiel** : chaque branche validée aurait fait chuter la note
affichée. Un produit qui décourage la fonctionnalité qu'il vient de construire.

**Application.** `lib/engine/progression.ts` — `calculerEtatGlobal` et
`agregerDomaine` restreignent les deux sommes à `statut === "evalue"`. Une somme
de poids nulle donne `null`, jamais 0. Une réserve annonce désormais la portée
du nombre affiché (P3). `niveauMoyen` valait `NaN` sans compétence évaluée : il
vaut `null`.

**Ce qui ne change pas.** Le doute sur une couverture partielle continue de
plafonner la **confiance** à « faible » sous 25 % de couverture. C'est là que le
doute doit s'exprimer — pas en abaissant un niveau réellement mesuré.

**Vérifié par** trois tests de `moteur.test.ts`, dont un dont la garantie a été
**inversée** : « élargir le référentiel ne change PAS le score ». Il vérifiait
exactement le contraire avant ce jour.

---

### Historique de la question (avant arbitrage)

**Problème.** Le score global compte les 31 compétences sans preuve comme des
zéros. Valeur affichée aujourd'hui : **10/100**. Le principe P2 interdit
exactement cela.

**Options.**

| | Approche | Effet |
|---|---|---|
| **A** | Ne rien changer | Le défaut se propage à la généralisation : un référentiel plus large ⇒ score plus bas pour tous, sans perte réelle de compétence |
| **B** | Calculer le score **sur le seul périmètre mesuré**, et afficher la couverture comme second indicateur distinct | Conforme à P2. Le score devient « où j'en suis là où j'ai mesuré », la couverture devient « combien j'ai mesuré ». Deux nombres honnêtes au lieu d'un ambigu |
| **C** | Conserver les deux calculs, renommer l'actuel en « couverture pondérée » et cesser de l'appeler « progression » | Correction de vocabulaire seule, coût minimal |

**Analyse.** B est le plus conforme au principe ; C est le moins cher et
supprime déjà le mensonge principal, qui est un problème de **nom** autant que
de formule. Les deux sont compatibles.

**Recommandation (rendue le 31/07).** Traiter **avant** ADR-009, pas après :
corriger un indicateur est trivial aujourd'hui, et devient un changement
observable par tous les utilisateurs une fois le produit généralisé. C'est
exactement ce qui s'est produit — ADR-009 est arrivée dix jours plus tard sous
la forme d'ADR-026, et la correction a dû se faire dans le même geste.

---

<a name="adr-007"></a>
## ADR-007 — Le tuteur est intégré, son moteur est configurable ✅

**Date.** 27/07/2026. **Tranchée par Maxime.**

> ⚠️ **Vocabulaire.** On dit ici **« moteur du tuteur »**, jamais « dorsale ».
> « Dorsale » est réservé au choix Supabase / JSON d'ADR-002. Ce sont deux
> mécanismes distincts qui n'ont rien à voir.

**Décision.**

1. ✅ Le tuteur est **intégré à l'application** — chat en flux, dans l'interface.
   Le mode « copier le contexte » reste le **repli** quand aucun moteur n'est
   configuré, pas le chemin nominal.
2. ✅ Le **moteur** (le fournisseur de modèle) est choisi par variable
   d'environnement, derrière une interface unique. En changer ne demande aucune
   réécriture.
3. ✅ Le moteur retenu au démarrage doit être **gratuit** (contrainte posée le
   même jour).

**Ce que la décision évite.** Trancher aujourd'hui « quel fournisseur »
alors que le critère qui compte — la fidélité au protocole — n'a pas encore été
mesuré. La question devient empirique au lieu d'être spéculative.

**Contexte qui a fait pencher la décision.**

Le tuteur n'est pas un agent conversationnel : il reçoit **~8 700 tokens de
protocole**, doit s'y tenir, et produire un bloc structuré qu'un parseur relit.
Sa sortie **entre dans la chaîne de preuves** (P8). Un modèle qui suit mal un
préfixe long ne dégrade pas le confort — il corrompt les données.

Le critère de sélection d'un moteur n'est donc **pas** le prix, mais :
*respecte-t-il le protocole de façon fiable ?*

**Test de réfutation d'un moteur candidat** (à exécuter avant de l'adopter) :

> Faire tourner 10 échanges réels et compter les violations : niveau affirmé
> sans preuve, « j'ai mis à jour ton profil », gabarit `PROPOSITION` cassé,
> compétence inventée hors référentiel.
> **Au-delà d'une violation, le moteur est disqualifié pour ce rôle.**

**Conséquence sur les dépendances.** Les paliers gratuits sérieux (Groq,
OpenRouter, Mistral, Cerebras) exposent une API **compatible OpenAI**. Un seul
module appelé en `fetch` les couvre tous — **aucune dépendance nouvelle**,
conformément à `CLAUDE.md` §7. Le SDK `@anthropic-ai/sdk` déjà présent reste
utilisé pour le moteur Anthropic.

**Ce qui reste ❓ ouvert :** quel fournisseur gratuit précisément. Résolu par
mesure, pas par arbitrage — voir le test ci-dessus.

**Coût mesuré de l'alternative payante** (pour information, si la contrainte de
gratuité était un jour revue) : contexte réel de ~11 300 tokens par requête,
à ~15 messages/jour — Haiku 4.5 ≈ 5 $/mois, Sonnet 5 ≈ 9 $/mois, Opus 5
≈ 23 $/mois. *Estimation par comptage de caractères, non vérifiée par
`count_tokens` (aucune clé API configurée).*

**Deux gaspillages identifiés dans le code actuel**, indépendants du moteur :
le bloc profil **n'est pas mis en cache** alors qu'il ne change qu'à l'écriture
d'une preuve, et `max_tokens: 16000` + `effort: "high"` est la configuration la
plus coûteuse possible pour cet usage.

**Alternatives écartées.**
- 🗑️ « Copier le contexte » comme chemin nominal — recommandé le 27/07, écarté
  par Maxime le même jour : l'aller-retour manuel casse l'usage, et l'intérêt
  d'un tuteur intégré est réel. Conservé comme repli.
- 🗑️ Dépendre d'un seul fournisseur codé en dur — c'est la situation actuelle,
  et c'est ce qui rend la question difficile à trancher.

---

### Historique — état antérieur de cette ADR (27/07, avant décision)

**La contrainte était décidée** : ✅ la solution doit être gratuite.

**État actuel.** `app/api/tutor/route.ts` appelle `claude-opus-4-8` via
`ANTHROPIC_API_KEY` — **payant**. Dans `app/.env.local`, la ligne est
**commentée** : en local, la route répond 503 et l'interface bascule d'elle-même
sur « Copier le contexte ». Ce n'est pas une panne, c'est le repli prévu.

**Options.**

| | Approche | Coût | Ce qu'on y gagne | Ce qu'on y perd |
|---|---|---|---|---|
| **A** | **Élever « copier le contexte » au rang de chemin nominal** : l'app produit déjà le contexte complet ; ajouter le chemin de **retour** (coller la réponse, en extraire propositions de preuve et d'exercice) | **0 €**, aucune dépendance, aucun quota | Les données restent sous le contrôle de l'utilisateur ; fonctionne avec n'importe quel assistant, y compris ceux déjà utilisés | Le chat en flux disparaît du chemin principal ; aller-retour manuel |
| **B** | API tierce à palier gratuit (Gemini, Groq, Mistral, OpenRouter…) | 0 € dans le quota | Chat intégré conservé | Nouvelle dépendance + clé à gérer ; quotas et conditions modifiables sans préavis ; **plusieurs paliers gratuits exploitent les données envoyées** — or un profil de compétences est une donnée personnelle (RGPD, `CLAUDE.md` §6) |
| **C** | Modèle local (Ollama) | 0 € | Confidentialité totale | Ne fonctionne pas sur Vercel : comportement scindé entre local et déployé |
| **D** | Conserver l'API Anthropic payante | ~€ | Meilleure qualité | 🗑️ **Exclue par la décision du 27/07** |

**Argument en faveur de A, au-delà du coût.** L'architecture y est déjà
préparée : `construireContexte()` produit un prompt **autonome et portable**,
accompagné d'un **manifeste** de ce qu'il contient. C'est le design d'un
contexte fait pour être emporté ailleurs. Seul le retour manque.

**Argument secondaire, non trivial.** L'utilisateur travaille **déjà** avec
Claude en dehors de l'application — c'est écrit dans ses propres commentaires
de preuve (« j'ai eu besoin de l'aide de Claude »). Ce travail échappe
aujourd'hui entièrement au système. Formaliser l'aller-retour **capte une
activité réelle qui n'est pas mesurée**, et recoupe donc partiellement ADR-008.

**Recommandation formulée alors (A comme chemin nominal) — 🗑️ écartée.**
Tranchée en faveur du tuteur intégré à moteur configurable, voir la décision en
tête d'ADR-007. *Fin de la section historique.*

---

<a name="adr-008"></a>
## ADR-008 — L'autonomie mesurée ignore l'aide externe 🔄 (fermée)

**Statut.** **Fermée le 01/08/2026 par [ADR-033](#adr-033)**, qui retient
l'option A ci-dessous. Ouverte le 27/07 en lisant les données de production.

**Problème.** `indicesUtilises` ne compte que les indices **internes**. Toute
aide extérieure est invisible au moteur, qui enregistre néanmoins
**A3 « résolution autonome »** :

| Preuve | Enregistré | Écrit par l'utilisateur |
|---|---|---|
| `RO-01` | A3, 0 indice | *« J'ai eu besoin de l'aide de Claude et de ressources (internet, anciens cours…) »* |
| `STAT-02` | A3, 0 indice | *« j'ai regardé sur internet »* |

L'utilisateur est honnête ; le moteur ne lit pas le champ commentaire. Les
niveaux dérivés sont donc **optimistes dans une proportion inconnue**.

**Pourquoi c'est grave.** P8 est le principe d'entrée de toute la chaîne. Une
erreur d'agrégation (ADR-006) déforme un indicateur ; une erreur sur la qualité
des preuves déforme **tout**.

**Options.**

| | Approche | Coût | Remarque |
|---|---|---|---|
| **A** | Ajouter au bilan d'exercice une question explicite : « aide extérieure utilisée ? » (aucune / documentation / assistant IA / correction obtenue), et la faire entrer dans le calcul d'autonomie | Faible | Reste déclaratif, mais **posé** plutôt que deviné. Le protocole d'évaluation §5 devrait être amendé en conséquence (P6) |
| **B** | Ne rien changer, considérer que le commentaire libre suffit à la relecture humaine | Nul | Laisse un écart connu entre l'affiché et le réel |
| **C** | Ne plus déduire l'autonomie, la faire déclarer intégralement | Faible | Perd le seul signal non déclaratif existant |

**Analyse.** A conserve le signal des indices internes et ajoute l'information
manquante là où elle est disponible — au moment du bilan, quand l'utilisateur
s'en souvient. B accepte sciemment un biais dans le cœur du système. C jette
l'unique mesure objective.

⚠️ **Ce point modifie une conclusion antérieure.** Une analyse du 27/07 avançait
que l'objet `Exercise` méritait d'être conservé *parce qu'il produit une mesure
objective d'autonomie*. Les données montrent que cette mesure est
partiellement aveugle. L'argument tient encore — un indice interne compté vaut
mieux qu'une autonomie entièrement déclarée — mais il est **plus faible qu'annoncé**.
C'est pourquoi ADR-011 est rouverte.

**Arbitré le 01/08/2026 par Maxime** — option A, portée au seul formulaire de
preuve manuelle, sous une contrainte qu'il a posée explicitement : *« quand je
parle d'autonomie c'est au niveau des inputs demandés par l'utilisateur. Faire
en sorte qu'il n'ait pas beaucoup de boutons à sélectionner. »* Voir
[ADR-033](#adr-033).

---

<a name="adr-009"></a>
## ADR-009 — Généralisation du référentiel 🔄 (fermée)

> 🔄 **Fermée le 31/07/2026 par [ADR-026](#adr-026)**, qui retient l'option
> **B** — référentiel en base, éditable, par compte. Le texte ci-dessous est
> conservé tel qu'il était : son ordre imposé a été respecté, ADR-004 puis
> ADR-006 ayant été traitées avant.

**Statut d'origine.** Ouverte, **volontairement non traitée maintenant**.

**Problème.** `lib/domain/referentiel.ts` code en dur 43 compétences centrées
BUT QLIO → Master ITI. `recommend.ts` produit littéralement la phrase
*« elle est centrale pour ton objectif Master ITI »* pour n'importe quel
compte. Deux des trois comptes existants ont `formation: "Formation à
renseigner"`.

**Options** (reprises de `archive/ETAT_DES_LIEUX_2026-07-27.md` §7.2) :
**A** référentiels prédéfinis multiples · **B** référentiel en base éditable ·
**C** socle transverse commun + extensions par compte.

**Pourquoi c'est reporté.** Généraliser figerait simultanément trois modèles
non validés : la granularité du référentiel, le calcul du score (ADR-006) et le
barème de recommandation (ADR-005). Le coût de correction après généralisation
est bien supérieur au coût de correction maintenant.

**Ordre logique imposé.** ADR-004 (contenu) → ADR-006 (score) → ADR-009.
En particulier : **ADR-004 est un prérequis technique de ADR-009**, puisqu'un
référentiel de droit ou d'informatique n'aura jamais d'exercices écrits à la
main.

**Pré-requis matériel identifié, non contesté.** L'édition du profil
utilisateur (`formation`, `objectifMoyenTerme`, `objectifLongTerme`,
`preferencesPedagogiques`) : les colonnes existent en base, **rien dans
l'interface ne les renseigne**.

---

<a name="adr-010"></a>
## ADR-010 — Widget de TODOs dev partagé 🔄

> 🔄 **Remplacée le 28/07/2026 par [ADR-019](#adr-019)** — le widget sort du
> produit. Le partage entre comptes reste volontaire ; c'est son montage sans
> condition dans le layout applicatif qui change.

**Décision d'origine.** La liste de TODOs est **globale et partagée entre tous
les comptes authentifiés**. C'est volontaire : le projet est développé à
plusieurs et c'est l'outil de coordination (`CLAUDE.md` §7).

**Condition de réexamen inscrite dans `CLAUDE.md`** : « à restreindre au moment
de l'ouverture à des utilisateurs tiers ».

🔔 **Cette condition est peut-être atteinte.** La base compte **3 profils**,
dont un (`clement.peyredieu`) sans aucune activité pédagogique. La politique
RLS est `FOR ALL TO authenticated USING (true)` : ce compte voit et peut
modifier la liste de développement.

❓ **Question à trancher.** `clement.peyredieu` est-il un compte de test, un
troisième développeur, ou un utilisateur tiers ? La réponse détermine si la
restriction (`DEV_TODO_ALLOWLIST` côté rendu **et** côté RLS) doit être faite
maintenant ou plus tard.

**Aucune action prise.** `CLAUDE.md` §7 interdit explicitement de « corriger »
ce widget sans demande.

---

<a name="adr-011"></a>
## ADR-011 — Conservation de l'objet `Exercise` ❓ (rouverte)

**Statut.** Ouverte.

**Question.** Si le tuteur génère le contenu (ADR-004), faut-il encore
persister un objet `Exercise` avec énoncé, indices, correction et critères — ou
suffit-il de travailler en conversation et de n'enregistrer que les preuves ?

**Argument pour conserver.** Le parcours d'exercice produit des signaux que la
conversation ne produit pas : indices débloqués un par un, durée, critères
d'auto-évaluation par dimension, réponse archivée. C'est un **dispositif de
mesure**, pas seulement du contenu.

**Argument contre, renforcé le 27/07.** Ce dispositif est partiellement aveugle
(ADR-008). Sur les 8 tentatives réelles, 6 déclarent 0 indice, dont deux où
l'utilisateur signale par ailleurs une aide externe. La supériorité de
l'exercice sur la conversation est donc **réelle mais plus faible qu'estimé**.

**Élément factuel utile.** Les durées enregistrées vont de **1 minute**
(`diag-algo-01`, échec, « je sais plus coder ») à **61 minutes**
(`diag-ro-01`, réussi). Ce signal-là est riche et n'existe pas en conversation.

**Depuis qu'ADR-007 est tranchée (27/07).** Le tuteur reste **intégré**, donc
l'argument « la conversation remplacerait l'exercice » perd son principal appui
pratique : les deux coexistent dans l'interface. La question devient plus
étroite — l'objet `Exercise` mérite-t-il d'exister pour la **mesure** qu'il
produit (indices consultés, durée, critères par dimension) ?

**Élément à mesurer avant de trancher.** Une fois la boucle ADR-004 en service,
comparer la qualité des preuves issues d'un exercice à celle des preuves issues
d'une conversation. S'il n'y a pas d'écart mesurable, l'objet ne se justifie
plus.

**Reste ❓ ouverte, sans blocage** : rien n'en dépend à court terme.

---

<a name="adr-012"></a>
## ADR-012 — Schéma SQL idempotent sans outil de migration ✅ (fragile)

**Décision.** Un fichier unique `app/supabase/schema.sql`, idempotent,
réexécuté à la main dans Supabase Studio.

**Conséquences.** ✅ Simple, lisible, sans outillage. 🔴 Aucun historique de ce
qui a été appliqué où. À la première modification de colonne sur des données
existantes, il n'y aura aucune trace exploitable.

**Non traité maintenant** : le volume (16 preuves, 3 comptes) ne le justifie
pas encore. À rouvrir avant tout changement de schéma destructif.

---

<a name="adr-013"></a>
## ADR-013 — La boucle est le produit ✅

**Date.** 28/07/2026. **Tranchée par Maxime.**

**Contexte — le problème énoncé.** « Le code et le contexte me semblent overkill,
je veux reculer pour mieux réavancer vers un projet réellement bien construit
avec en son centre la valeur ajoutée pure. »

**Faits mesurés le 28/07 en production** (Supabase, pas `app/data/store/`) :

| Table | Lignes |
|---|---|
| `evidence` 20 · `sessions` 13 · `attempts` 12 | vivantes |
| `exercises` | **0** |
| `errors`, `objectives`, `projects`, `readings`, `knowledge` | **0** chacune |

Les 11 exercices de diagnostic ont tous été faits (12 tentatives, 11 terminées).
**Le stock est épuisé et la boucle est arrêtée au maillon de génération.**
Douze entités déclarées, deux vivantes.

**Décision.** Le produit est une boucle unique :
**génération d'exercices → évaluation de la compétence → ajustement des
exercices.** Tout le reste est secondaire et se justifie devant elle.

**Portée du chantier ouvert ce jour : soustractif uniquement.** Le 3ᵉ maillon
(ajustement) n'existe nulle part dans le code ; il fera l'objet d'une décision
séparée, une fois le terrain dégagé. Ce chantier retire et durcit les deux
maillons existants, il n'en ajoute pas.

**Ce qui est déclaré irréductible et ne doit pas être abîmé :**
1. la chaîne preuve → niveau dérivé, avec le « Pourquoi ? » de chaque valeur ;
2. la vue longitudinale.

**Conséquence de méthode.** Les décisions ADR-014 à ADR-019 sont les
suppressions arbitrées une par une le 28/07 sur la base des faits ci-dessus.
Aucune n'a été prise par déduction : chacune a été soumise et tranchée.

---

<a name="adr-014"></a>
## ADR-014 — Suppression des six entités sans usage ✅

**Date.** 28/07/2026. **Tranchée par Maxime, entité par entité.**

**Décision.** Suppression de `Project` / `ProjectStep`, `Reading`,
`KnowledgeItem`, `Objectif`, `ErrorItem`, `Quest` / `QuestStep` — types, tables,
écrans et facteurs de moteur associés.

**Justification par entité.**

| Entité | Lignes en base | Élément décisif |
|---|---|---|
| `Reading`, `KnowledgeItem` | 0 | aucun chemin d'écriture n'a jamais existé ; les pages sont des placeholders |
| `Quest` / `QuestStep` | — | types déclarés, jamais dans `Collections`, jamais lus : code strictement mort |
| `Objectif` | 0 | le formulaire **est** exposé et pré-rempli sur l'écran d'entrée, et n'a jamais servi. Une UI proposée et ignorée est un signal plus fort qu'une UI absente |
| `Project` | 0 | son seul usage actif était l'XP projet (+100), qui disparaît avec ADR-017 |
| `ErrorItem` | 0 | le facteur de recommandation `+10×erreurs +2×occurrences` est donc structurellement mort depuis l'origine |

**Réserve inscrite sur `ErrorItem`.** C'est conceptuellement le brouillon du
3ᵉ maillon : ajuster les exercices suppose de savoir sur quoi l'utilisateur
bute. La suppression est décidée **en connaissance de cela**. Quand le maillon
3 sera traité, la question devra être reposée sous sa vraie forme : une
difficulté **dérivée des preuves**, conformément à ADR-001, et non une fiche
saisie à la main — ce qui est précisément ce qui n'a jamais été fait.

**Conséquence sur ADR-005.** Deux des neuf facteurs de recommandation
disparaissent (erreurs récurrentes, prérequis restant). Le test de réfutation
d'ADR-005 reste valable, sur sept facteurs.

---

<a name="adr-015"></a>
## ADR-015 — Dorsale unique : Supabase ✅

**Date.** 28/07/2026. **Tranchée par Maxime.** Remplace [ADR-002](#adr-002).

**Décision.** Supabase devient l'unique dorsale. La dorsale JSON locale est
supprimée : les quatre forks `if (dorsale)` de `db.ts`, `lireLocal` /
`ecrireLocal`, `migration.ts` et l'import « Journal local » de la modale compte.
`export.ts` est **conservé** comme filet de sortie JSON.

**Ce que la décision achète.**
- ✅ La règle opérationnelle d'ADR-002 (« ne jamais lire `app/data/store/` pour
  analyser l'usage ») cesse d'être une consigne à respecter : elle devient
  structurellement impossible à enfreindre. C'était la source documentée d'une
  analyse fausse le 27/07.
- ✅ Disparition de l'écriture disque **sans authentification** signalée en
  `CLAUDE.md` §6 — les Server Functions n'ont plus de chemin non authentifié.
- ✅ Un seul jeu de règles à tester par opération d'écriture.

**Ce qu'elle coûte.** Le développement hors ligne, et le premier démarrage sans
configuration Supabase, ne sont plus possibles. Accepté explicitement.

---

<a name="adr-016"></a>
## ADR-016 — Suppression du mode démonstration ✅

**Date.** 28/07/2026. **Tranchée par Maxime.**

**Décision.** Suppression de `lib/demo/dataset.ts` (483 l.), du cookie
`mode-demo`, du bandeau et de `refuserSiDemo()`.

**Élément décisif.** Le mode démo ne coûte pas 483 lignes, il coûte **une
condition sur chaque formulaire de l'application** : objectifs, création
d'exercice, preuve manuelle, statuts d'erreur, note de journal. Il conditionne
environ la moitié de la surface interactive et double le nombre d'états à
vérifier sur presque tous les écrans. C'est un multiplicateur, pas un module.

**Ce qu'elle coûte.** Plus de démonstration du produit sans compte.

---

<a name="adr-017"></a>
## ADR-017 — Suppression de la gamification ✅

**Date.** 28/07/2026. **Tranchée par Maxime.**

**Décision.** Suppression de `lib/engine/xp.ts` : `BAREME_XP` (7 motifs),
`PALIERS` (7 paliers nommés), `BADGES` (6), `deriverXP`, `deriverBadges`, la
jauge XP permanente du rail, la section paliers de `/progression` et la ligne
« Niveau global (gamification, secondaire) » du contexte tuteur.

**Éléments décisifs.**
- Le contexte envoyé au tuteur qualifie lui-même la mécanique de
  « (gamification, secondaire) » — le système la déclarait déjà accessoire.
- Environ 20 seuils numériques et une UI permanente pour un signal que la vue
  longitudinale, préservée, porte déjà.
- `CODES_MODELISATION` (6 codes) et `CODES_SIMULATION` (3 codes) sont des
  listes de codes de compétence **en dur**, fausses dès que le référentiel
  bouge — ce que ADR-018 fait immédiatement.
- Le code contient déjà une branche morte : `xp.ts:279-282`, le test
  `type === "code"` est sans effet.

**Ce qu'elle coûte.** Le seul retour positif immédiat après l'enregistrement
d'une preuve. Accepté.

**Conséquence sur les tests.** Les 5 tests « XP non-farmable » de
`moteur.test.ts` disparaissent avec leur objet. La garantie qu'ils portaient
(1 XP = 1 preuve existante, via `XPEvent.sourceEvidenceId` obligatoire) n'a
plus de sujet. **Ce n'est pas un affaiblissement de garde-fou** au sens de
`CLAUDE.md` §7 : la règle ne devient pas laxiste, la mécanique qu'elle
contraignait cesse d'exister.

---

<a name="adr-018"></a>
## ADR-018 — Périmètre pilote : domaine Logistique 🔄

> 🔄 **Remplacée le 29/07/2026 par [ADR-020](#adr-020)** — le périmètre pilote
> devient le domaine Développement. La section ci-dessous est conservée pour
> l'historique : le raisonnement (un seul domaine actif à la fois, référentiel
> conservé en entier) reste celui qu'ADR-020 réapplique.

**Date.** 28/07/2026. **Tranchée par Maxime.**

**Contexte.** 43 compétences déclarées, **16 touchées** en trois jours, **31
sans aucun support de travail**. Le référentiel dépasse largement ce que la
boucle peut alimenter.

**Décision.** Le référentiel **garde ses 43 compétences en données**. Un
périmètre actif borne ce que l'application et le tuteur manipulent :
**LOG-01 → LOG-09**, le domaine le plus travaillé (7 preuves sur 6
compétences). Les 34 autres restent lisibles, hors calcul et hors contexte.

**Décision attachée — le grain de la vue longitudinale change.** Le radar
passait 7 axes = 7 domaines ; à l'échelle d'un pilote mono-domaine il ne dirait
plus rien. Il passe à **9 axes = les 9 compétences de Logistique**, et la courbe
de progression suit le score du domaine. C'est le seul point du chantier qui
touche à ce qui a été déclaré irréductible en ADR-013 — il a été soumis et
tranché comme tel.

**Conséquence sur ADR-006 (❓ toujours ouverte).** Le défaut du score global —
les compétences non mesurées comptées comme des zéros — passe de 12 mesurées
sur 43 à 6 sur 9. L'écart de principe **ne disparaît pas** et ADR-006 reste à
trancher ; il cesse simplement d'être le facteur dominant de la valeur
affichée. Ne pas lire cette amélioration comme une résolution.

**Conséquence sur ADR-009.** Réduire le périmètre actif est le contraire de
généraliser, mais introduit le mécanisme dont ADR-009 aura besoin : la
distinction entre le référentiel possédé et le référentiel travaillé.

---

<a name="adr-019"></a>
## ADR-019 — Le widget de TODOs dev sort du produit ✅

**Date.** 28/07/2026. **Tranchée par Maxime.** Remplace [ADR-010](#adr-010).

**Contexte.** 1 340 lignes — `dev-todo.tsx` (808) + route (427) + upload (105) —
soit **8,6 % du code**, plus que tout `lib/store/`, pour un outil hors domaine
pédagogique monté **sans condition sur chaque page** de l'application.

**Décision.** Le widget est **sorti du produit, pas réduit** : ses
fonctionnalités restent intactes, il cesse d'être monté dans le layout
applicatif et vit sur une route dédiée. Il n'est plus compté comme du code
produit.

**Ce qui change dans le garde-fou de `CLAUDE.md` §7.** L'interdiction passe de
« ne pas corriger ce widget » à « ne pas le remettre dans le produit ». La forme
change, le fond est identique : c'est l'outil de coordination de l'équipe, il ne
se discute pas au titre de l'expérience utilisateur.

**Conséquence sur la question ouverte d'ADR-010.** Le statut de
`clement.peyredieu` devient sans objet **côté rendu** — le widget n'est plus
exposé sur les pages du produit. ❓ **La question reste entière côté RLS** : la
politique est toujours `FOR ALL TO authenticated USING (true)`, donc tout compte
authentifié lit et modifie la liste. Aucune action prise là-dessus.

---

<a name="adr-020"></a>
## ADR-020 — Pivot du périmètre pilote : Développement logiciel ✅

**Date.** 29/07/2026. **Tranchée par Maxime**, via quatre réponses explicites
à une clarification (`AskUserQuestion`) avant tout changement de code.
Remplace [ADR-018](#adr-018).

**Contexte.** L'utilisateur veut travailler en priorité des compétences de
développement logiciel — lire, comprendre, faire évoluer ce projet réel —
plutôt que la Logistique, pour être capable de mener ce projet à bien.
Un lot de 10 exercices sur ce thème existait déjà, rédigé en dehors du format
`Exercise` (fichier `EXERCICES_APPRENTISSAGE.md`, non versionné).

**Décision.**

1. `DOMAINE_PILOTE` passe de `"logistique"` à `"developpement"`. Le
   référentiel gagne 10 compétences (`DEV-01`→`DEV-10`, `lib/domain/referentiel.ts`),
   converties du lot d'exercices déjà rédigé.
2. **Logistique sort du périmètre exactement comme les 34 autres compétences
   déjà hors périmètre** — pas supprimée. Les 7 preuves déjà écrites sur
   6 compétences Logistique restent en base, intactes ; elles cessent d'être
   calculées et affichées tant que ce domaine n'est pas repris. Rien n'est
   perdu (P1, P4) ; élargir de nouveau le périmètre suffirait à les faire
   réapparaître dans les calculs — même garantie qu'ADR-018 offrait déjà pour
   les 34 compétences d'origine.
3. Le radar de la vue longitudinale suit désormais les 10 compétences Dev
   (au lieu des 9 de Logistique) — même mécanisme générique qu'ADR-018 avait
   introduit, aucun changement de code nécessaire au-delà de la donnée.
4. Les 10 exercices sont enregistrés en `origine: "seed"`, `diagnostic: true`,
   dans `EXERCICES_DIAGNOSTIC` (`lib/seed/exercises.ts`) — même mécanisme que
   les 11 diagnostics d'origine.

**Tension avec ADR-004 et PRODUCT.md, assumée et non contournée.** ADR-004
écarte l'écriture manuelle de futurs exercices seed ; PRODUCT.md range « écrire
des exercices seed à la main » en 🗑️ abandonné. Cette décision **répète ce
geste**, pour la raison suivante : le circuit tuteur → exercice reste ❌ non
câblé (ADR-004 le documente déjà), et ce lot est un **amorçage ponctuel d'un
nouveau domaine** — exactement le précédent déjà accepté pour les 11
diagnostics d'origine, pas l'ouverture d'une pratique récurrente. ADR-004
n'est pas rouverte : le prochain exercice, au-delà de ce lot fondateur, devra
venir du tuteur.

**Correction connexe entraînée par ce pivot.** `lib/engine/recommend.ts`
codait en dur la phrase « elle est centrale pour ton objectif Master ITI »
pour toute compétence d'importance ≥ 0,9, quel que soit le domaine actif —
elle serait devenue fausse pour les compétences Dev (P3 : aucune valeur sans
source honnête). Généralisée en « elle est centrale pour ton objectif
actuel ». Ne traite pas le problème plus large d'ADR-005 (l'importance ne
discrimine pas assez), qui reste hors sujet ici.

**Ce qui n'a pas eu besoin d'être touché, vérifié en lecture seule avant
d'agir.** `app/data/00_instructions/*.txt` (protocole lu par le tuteur) ne
code en dur aucune restriction à la Logistique. `ROADMAP.md` ne nomme aucun
domaine spécifique. Les assertions de `moteur.test.ts` sur `DOMAINE_PILOTE`/
`SKILLS_ACTIFS` sont écrites génériquement (aucune chaîne `"logistique"` en
dur) : elles restent vraies sans modification.

**Alternative écartée.** 🗑️ Garder Logistique active en parallèle de Dev
(les deux domaines calculés à la fois) — écartée par l'utilisateur : contraire
au raisonnement mono-domaine d'ADR-018 (34 compétences hors périmètre tant
qu'aucun contenu ne les alimente ; en ajouter une neuvième sans la retirer
revient au problème qu'ADR-018 corrigeait).

---

<a name="adr-021"></a>
## ADR-021 — Compression et chargement conditionnel des protocoles du tuteur ✅

**Date.** 29/07/2026. **Tranchée par Maxime**, via deux réponses explicites
à une clarification (`AskUserQuestion`) avant tout changement de code —
même précédent qu'ADR-020.

**Contexte.** À chaque message, le tuteur charge en préfixe système trois
fichiers de `app/data/00_instructions/` (`construireContexte`,
`app/src/lib/tutor/contexte.ts`) : Instructions principales, Protocole
d'évaluation, Protocole anti-hallucination — 20 135 caractères ≈ 5 034
tokens, sans condition. Ce coût est fixe et pèse le plus sur le cas qui
compte le plus : les moteurs du palier gratuit (Groq, OpenRouter, Mistral…)
ont une fenêtre de contexte étroite (~12K tokens/message) — c'est déjà le
critère de choix du moteur documenté ailleurs. ~5K tokens de protocole avant
même le profil de compétences, le travail récent et la question de
l'utilisateur, c'est 40 % du budget englouti avant que la conversation
commence. Le cache `ephemeral` d'Anthropic (`moteurs/anthropic.ts:32-41`)
amortit ce coût en argent pour ce moteur précis, mais ne change rien au
budget de contexte, ni pour Anthropic ni pour les moteurs sans cache.

**Décision.**

1. **Compression du texte, sans retrait de règle.** Les 3 fichiers chauds
   ont déjà subi une passe de dédoublonnage documentée en
   `00_SYSTEME_CHANGELOG.txt` (VERSION 2.3). Le gisement restant est fin :
   conversion de quelques énumérations en prose vers des puces (retire les
   mots de liaison, aucune information perdue) et retrait de deux phrases
   méta redondantes avec une règle déjà posée ailleurs dans le même fichier
   (`INSTRUCTIONS_PRINCIPALES` §17, `PERENNISATION` §6). Chaque coupe a été
   vérifiée individuellement : « cette phrase porte-t-elle une règle
   distincte, encore présente ailleurs dans le fichier compressé ? ».
   Aucun test ne protège cette étape (`moteur.test.ts` teste le comportement
   calculé, jamais le texte des `.txt`) — la seule garantie est la relecture
   humaine du diff.
2. **Chargement conditionnel du protocole d'évaluation, lui seul.**
   `INSTRUCTIONS_PRINCIPALES` et `PROTOCOLE_ANTI_HALLUCINATION` restent
   chargés en entier, sans condition : ce sont les garde-fous d'identité et
   anti-hallucination — CLAUDE.md §8 interdit d'affaiblir un garde-fou, et
   une erreur de chargement conditionnel sur l'un des deux romprait
   exactement la garantie que le produit vend. `PROTOCOLE_EVALUATION` est
   scindé en deux fichiers, **sans renumérotation des sections** (plusieurs
   références absolues au numéro de section existent en code —
   `contexte.ts` cite « §5 » et « §16 », `INSTRUCTIONS_PRINCIPALES` §6 cite
   « §4 » — une renumérotation les aurait rendues fausses silencieusement) :
   - `..._CORE.txt` (§1-11 : objectif, dimensions, échelle de niveau,
     autonomie, qualité de preuve, confiance, règle de mise à jour, règle de
     régression, évaluation d'une réponse, transfert) — **toujours chargé** :
     nécessaire à chaque tour où une preuve pourrait être proposée ou une
     réponse évaluée, pas seulement en synthèse.
   - `..._SYNTHESE.txt` (§12-17 : score macro, indice de robustesse, champs
     du profil, synthèse périodique, priorisation, format de bilan) —
     chargé seulement quand un bilan est probable.
3. **Déclencheur déterministe, pas un second appel LLM** (le coût et la
   latence annuleraient le gain) : fonction pure
   `fautChargerSyntheseEvaluation(dernierMessage, nombreDeTours)`
   (`contexte.ts`, testée dans `contexte.test.ts`) — vrai si le dernier
   message contient un mot-clé de bilan (bilan, synthèse, résumé, point
   d'étape, où j'en suis, priorité, prochaine étape), **ou** si le nombre de
   tours est un multiple de 5 (cadence de secours : une formulation non
   reconnue retarde le protocole complet, ne le supprime jamais
   durablement).
4. **Sites sans historique de conversation** (le rendu de `(app)/tuteur/page.tsx`,
   pour l'indicateur de taille — c'était `route.ts` `GET` jusqu'à ce que
   ADR-022 le supprime ; `actions.ts` `preparerPromptComplet`, le mode
   « copier le contexte » sans clé API) : pas de tour suivant pour rattraper
   un manque, donc pas d'heuristique — chargement complet par défaut
   (`messages` vide ⇒ `chargerSynthese = true`).
5. **Transparence.** Le `manifeste` déjà renvoyé par `construireContexte`
   (jamais laisser croire que le tuteur a reçu plus qu'il n'a reçu) nomme
   désormais « Protocole d'évaluation (essentiel) » le fichier CORE et
   n'ajoute « Protocole d'évaluation (complet) » que les tours où SYNTHESE
   est effectivement chargé.

**Chiffres réels, mesurés après la passe de compression.** Fichiers
toujours chargés : Instructions principales 8 014 + Évaluation CORE 4 252 +
Anti-hallucination 5 311 = **17 577 caractères ≈ 4 394 tokens** sur un tour
ordinaire, contre 20 135 caractères ≈ 5 034 tokens avant ce chantier —
**-12,7 %** sur le plancher payé à chaque message.

> ⚠️ **Ces trois chiffres ont dérivé après coup.** Remesurés le 01/08/2026 :
> 8 926 + 4 863 + 5 311 = **19 100 caractères**, soit 1 523 de plus que ce que
> ce paragraphe annonçait. Les fichiers ont grossi au fil des chantiers
> suivants (ADR-026, ADR-029) sans que personne ne remette le total à jour —
> et un chiffre périmé dans une ADR sert d'argument à la décision suivante.
> Le dégraissage d'[ADR-032](#adr-032) repart de 19 100, pas de 17 577. Sur un tour de synthèse
(SYNTHESE inclus, 2 206 caractères de plus), le total revient à 19 783
caractères ≈ 4 946 tokens, soit -1,7 % par rapport à l'ancien total : la
compression seule, le découpage n'ajoutant ni ne retranchant rien de
substantiel une fois SYNTHESE rechargé. Le gain est donc réel mais modeste,
pas un facteur x2 — conforme à ce qui avait été annoncé avant
implémentation, pas gonflé après coup.

**Limite assumée, non contournée.** L'heuristique est un texte, pas une
compréhension : une demande de bilan formulée de façon totalement
inhabituelle peut ne déclencher ni mot-clé ni (si elle tombe hors cadence)
le filet de sécurité, et le tuteur répondrait alors sans §12-17 en
contexte — au pire une réponse moins étayée sur le score macro ou la
priorisation ce tour précis, jamais un accès en écriture ni une invention de
preuve (§1-11, toujours présents, couvrent déjà la règle de mise à jour et
de régression). La cadence de 5 tours borne cette limite dans le temps.

**Alternative écartée.** 🗑️ Un second appel LLM pour classifier l'intention
avant de construire le contexte — écartée : le coût et la latence de l'appel
de classification annuleraient le gain de tokens visé sur le message
principal, précisément sur les moteurs à petite fenêtre où l'économie
compte le plus.

**Ce qui n'a pas été touché.** `00_SYSTEME_INITIALISATION.txt` et
`00_SYSTEME_CHANGELOG.txt` : aucune redondance sûre à retirer sans perdre la
valeur narrative que ces documents existent pour porter (§1 de
`PERENNISATION` : « chaque règle répond à un incident réel ») — et ces deux
fichiers ne sont de toute façon jamais lus par le code (`grep` exhaustif),
donc leur taille n'a aucun effet sur le coût par message. Compresser ces
fichiers pour gagner un chiffre aurait été le genre d'optimisation que ce
même chantier existe pour éviter.

---

<a name="adr-022"></a>

## ADR-022 — Vérification locale du jeton (`getClaims`) sur le chemin chaud ✅

**Date.** 31/07/2026. **Tranchée par Maxime**, via une clarification
explicite (`AskUserQuestion`) posée avant tout changement de code, la
question portant précisément sur l'arbitrage de sécurité ci-dessous.

**Contexte.** Chaque navigation dans le groupe `(app)` payait **deux
allers-retours réseau** vers le serveur d'authentification Supabase :

1. `proxy.ts` — `supabase.auth.getUser()`, sur chaque requête que couvre le
   matcher ;
2. `lib/supabase/server.ts` — `compteCourant()`, à nouveau pendant le rendu
   du Server Component. Le `cache()` de React est porté par la requête React
   et ne franchit pas la frontière du proxy : les deux appels ne pouvaient
   pas se mutualiser.

Et le matcher du proxy couvre aussi les charges RSC : ces deux allers-retours
sont donc payés **deux fois** par navigation perçue (document + payload RSC).

La mesure a écarté les autres suspects. La base contient 29 preuves, 22
tentatives, 22 sessions, 1 exercice, 3 profils, avec les index `(user_id, …)`
attendus : les cinq `select` de `lireTout()`, exécutés en parallèle, ne sont
pas le poste dominant. C'est l'authentification qui l'est.

**Fait qui rend la décision possible.** Le projet signe déjà ses jetons avec
une **clé asymétrique ES256** — `…/auth/v1/.well-known/jwks.json` renvoie une
clé EC vivante. `supabase.auth.getClaims()` peut donc vérifier la signature
**localement**, par WebCrypto, sans appel réseau. Vérifié dans
`@supabase/auth-js` : le cache JWKS est une variable de **module**
(`GLOBAL_JWKS`), de TTL 10 minutes — reconstruire un client Supabase à chaque
requête ne le retélécharge pas. Au plus une requête réseau toutes les dix
minutes par processus.

**Décision.** `proxy.ts` et `compteCourant` utilisent `getClaims()`.

`compteCourant` ne renvoie plus le type `User` de supabase-js mais un type
local `Compte` réduit aux trois champs réellement consommés (`id`, `email`,
`user_metadata`) — tous présents dans le jeton. Le champ garde son nom
snake_case pour que les sites d'appel restent inchangés.

**Ce qui remplace le raisonnement précédent.** Le commentaire de
`server.ts` justifiait `getUser()` contre `getSession()` : seul `getUser()`
revalidait le jeton, se fier au cookie revenant à faire confiance à une
valeur modifiable par le client. **Cet interdit sur `getSession()` reste
entier.** `getClaims()` n'est pas `getSession()` : il vérifie
cryptographiquement la signature du jeton contre la clé publique du projet,
et valide `exp`. Un cookie forgé ne peut pas produire une signature valide
sans la clé privée, qui ne quitte jamais Supabase. La confiance ne vient plus
de l'interrogation du serveur d'auth, elle vient des mathématiques.

Ce qui ne change **pas** :

- **RLS reste la seule barrière d'autorisation** (CLAUDE.md §7). Le jeton
  part de toute façon à PostgREST, qui le revalide indépendamment. Même si
  notre vérification locale était fausse, aucune ligne ne traverserait.
  `compteCourant` ne sert qu'au contrôle *optimiste* — déjà documenté comme
  tel en tête de `proxy.ts` — et à fournir l'identifiant des clauses
  `.eq("user_id", …)`, que RLS double.
- `allowExpired` n'est jamais passé : la validation de `exp` fait partie du
  contrat.
- Le rafraîchissement du jeton reste le rôle nº 1 du proxy : `getClaims()`
  passe par `getSession()`, qui rafraîchit si nécessaire, et le `setAll` du
  proxy persiste les cookies comme avant.
- Aucune clé `service_role` n'entre dans le code.

**Repli automatique.** Si le projet repassait à un secret symétrique, ou si
`crypto.subtle` était absent de l'environnement, auth-js retombe de lui-même
sur `getUser()`. La migration est donc sûre par construction : le pire cas
est le comportement d'avant, jamais une vérification affaiblie.

**Conséquence assumée — l'arbitrage réel.** Un compte supprimé, banni ou
déconnecté côté serveur conserve un jeton d'accès valide et non expiré
jusqu'à son `exp` (durée configurée dans Auth › Sessions ; défaut Supabase :
1 heure). `getUser()` s'en apercevait immédiatement ; `getClaims()` non.
Acceptable ici, pour trois raisons :

- La fenêtre est bornée. Le *refresh token*, lui, est révoqué immédiatement :
  au prochain rafraîchissement, le proxy échoue et redirige.
- La conséquence concrète est cosmétique. Les lignes du compte ont disparu
  par cascade depuis `auth.users`, RLS ne renvoie rien, `lire("user")`
  retombe sur `profilNeutre` : l'utilisateur voit une coquille vide au lieu
  d'être redirigé. **Aucune donnée d'un autre compte n'est jamais
  accessible — ce n'est pas nous qui en décidons, c'est Postgres.**
- Le produit n'a aucun flux de révocation administrative : trois comptes, un
  seul responsable, pas d'espace admin, pas de rôle privilégié, pas de
  facturation. Le risque que couvrait `getUser()` n'existe pas ici.

**Ce que cette décision n'autorise pas.** Elle retire `getUser()` du chemin
chaud, elle ne l'interdit pas. Si un chemin apparaît un jour où une identité
périmée serait nuisible — bannissement, rôle administrateur, suppression de
compte en libre-service, partage de progression entre comptes — **ce
chemin-là, et lui seul, doit rappeler `getUser()` explicitement**. Écrire
ce rappel fait partie de la décision, pas d'un chantier futur.

---

<a name="adr-023"></a>

## ADR-023 — Cache des données inter-requêtes 🗑️

**Date.** 31/07/2026. **Ouverte le matin, écartée le soir même par
[ADR-024](#adr-024).** Conservée intégralement : elle porte la mesure qui a
permis de trancher, et la liste des pièges à relire si l'idée revenait.

**Ce qui l'a close.** La question a été reposée le jour même sous un autre
angle — « architecture trop complexe, revenir à une logique simple et
unifiée » — et une seconde mesure a montré que le poste restant n'était pas
le nombre de lectures **par rendu** (déjà un aller-retour) mais le nombre de
**rendus par session** : le cache routeur client de Next était désactivé par
défaut. ADR-024 le rallume. Aucun cache de données n'a été construit, et le
cloisonnement des comptes reste entièrement dans PostgreSQL.

**Contexte.** Le chantier de performance du 31/07 est parti d'une demande
précise : « faire en sorte que le cache utilisateur n'appelle pas à chaque
fois la base de données ». L'hypothèse implicite était que les lectures
Supabase étaient le poste de latence dominant.

**La mesure l'a contredite.** La base contient 29 preuves, 22 tentatives, 22
séances, 1 exercice, 3 profils, avec les index `(user_id, …)` attendus sur
toutes les tables. Les cinq `select` de `lireTout()` s'exécutent en
parallèle : ils coûtent **un** aller-retour PostgREST, pour 77 lignes au
total. Le poste dominant était l'authentification — deux allers-retours
réseau par page, payés deux fois par navigation à cause des charges RSC —
supprimés par ADR-022, plus l'absence totale de frontière `<Suspense>`, qui
bloquait le premier octet jusqu'à la fin de la dérivation.

**Pourquoi ne rien construire.** Un cache inter-requêtes supprimerait le
dernier aller-retour restant. En échange il faudrait :

- une clé de cache contenant l'identifiant du compte, et sept points
  d'invalidation dans `lib/store/actions.ts` — dont deux (`creerExercice`,
  `ajouterNoteSession`) n'ont pas l'identifiant sous la main aujourd'hui ;
- **déplacer une décision de cloisonnement hors de PostgreSQL**, vers une
  chaîne de caractères que nous fabriquons. CLAUDE.md §7 pose que RLS est la
  seule barrière d'autorisation de confiance ; une erreur de clé ferait
  servir les données d'un compte à un autre sans que Postgres ait son mot à
  dire. Trois comptes réels existent.

ADR-022 a supprimé **deux** allers-retours pour une fraction de ce risque.
« Ne rien faire » est recevable (CLAUDE.md §9) : c'est la recommandation.

**Qui doit trancher.** Maxime. **Ce qui bloque :** rien — il manque
seulement une raison. Cette question ne se rouvre que si une mesure montre
que les `select` sont redevenus le poste dominant, ce qui n'arrivera pas à
77 lignes.

**Si elle se rouvre**, les contraintes sont déjà connues :

- `unstable_cache` **et** `"use cache"` interdisent `cookies()` dans le corps
  mis en cache. Le client doit être construit à l'extérieur et capturé par
  fermeture : garder `await dorsaleCompte()` en tête de `lireTout()` et
  n'envelopper que le `Promise.all`.
- Clé `["lireTout", userId]`, étiquette `` `compte:${userId}` ``. L'`userId`
  vient de `claims.sub`, donc d'un jeton à signature vérifiée : il n'est pas
  manipulable par le client. **Un test de non-fuite entre deux comptes est la
  première chose à écrire, pas la dernière.**
- Piège principal : `revalidatePath` **n'invalide pas** `unstable_cache`. Il
  faut `revalidateTag` dans chaque écriture.
- `cacheComponents` est à écarter : c'est une bascule globale du modèle de
  rendu (PPR, frontière obligatoire sur tout accès dynamique non caché) pour
  six pages.

---

<a name="adr-024"></a>

## ADR-024 — Le cache de navigation est celui de Next, et l'invalidation est uniforme ✅

**Date.** 31/07/2026. Remplace [ADR-023](#adr-023).

**Contexte.** Demande : « architecture trop complexe de manière globale,
revenir à une logique simple et unifiée — un unique appel à la base au
lancement de l'application, tout dans le cache, et à chaque modification
mettre à jour la base et le cache ». Symptômes retenus : la navigation est
lente au clic, et le code du store est illisible.

**La mesure, encore.** Deux prémisses de la demande ne tenaient pas :
`lireTout()` fait cinq `select` **en parallèle**, soit un aller-retour
PostgREST pour 77 lignes ; et `chargerContexte()` est déjà mémoïsé par
`cache()`, donc déjà « un seul point d'entrée ». Il n'y avait pas cinq appels
à réduire à un.

En revanche, `experimental.staleTimes.dynamic` vaut **0** par défaut en Next
16.2.11. Toutes les pages du groupe `(app)` lisent les cookies de session,
donc sont dynamiques : **aucune n'était conservée entre deux navigations.**
Revenir sur une page déjà vue refaisait un rendu serveur complet et un
aller-retour Supabase. Dix clics coûtaient dix allers-retours. C'était ça, la
lenteur au clic — et le seul endroit où « un appel par session » avait un
sens mesurable.

**Décision.**

1. `experimental.staleTimes: { dynamic: 300 }` dans `app/next.config.ts`. Une
   page visitée est réaffichée depuis le cache routeur client, sans appel
   serveur. Ce n'est **pas** un cache de données : rien n'est indexé par
   compte côté serveur, et RLS reste la seule barrière (CLAUDE.md §7). `300`
   est un cadran, pas une vérité.
2. Les sept Server Functions passent toutes à `revalidatePath("/", "layout")`.
   C'est ce qui rend le point 1 sûr : une écriture peut déplacer un niveau, un
   score global et une recommandation à la fois, et raisonner à chaque ajout
   sur les écrans qu'une preuve touche est précisément la complexité qu'on
   retire. À 77 lignes, tout invalider ne coûte rien. **Les deux réglages se
   lisent ensemble** — modifier l'un sans l'autre laisse du périmé à l'écran.

**Ce qui n'a pas été construit, et pourquoi.**

- **Store client global (SPA).** C'est la lecture littérale de la demande :
  le layout charge tout une fois, un provider React tient les données, le
  moteur — pur, donc portable — part dans le navigateur. Écarté : il faudrait
  réécrire les sept pages en composants clients, ce qui annulerait les
  frontières `<Suspense>` posées le matin même, alourdirait le bundle du
  référentiel et du seed, et ferait diverger deux onglets. Le gain restant,
  une fois le point 1 en place, se réduit au **premier** affichage de chaque
  page.
- **Cache serveur par compte** — voir ADR-023, écartée.

**Effet secondaire assumé.** Après une écriture, la première visite de chaque
page repaye son aller-retour. Les écritures sont rares devant les
navigations : c'est le bon sens de l'échange.

**Ménage effectué dans le même geste** (le second symptôme, « le store est
illisible ») :

- `ecrire()` supprimé de `lib/store/db.ts` : 52 lignes, trois requêtes SQL
  (upsert, inventaire, delete), **zéro appelant**. Avec lui disparaît
  `userVersProfil`, dont il était le seul consommateur — le jour où un écran
  d'édition du profil existera, elle se réécrira en cinq lignes symétriques
  de `profilVersUser`, plutôt que d'être maintenue à vide (CLAUDE.md §8 :
  ne pas construire par anticipation).
- `remplacer()` devient `modifier()` : mise à jour partielle avec
  `.select()`, **une requête au lieu de deux**. Allers-retours par action :
  `debloquerIndice` 2→1, `enregistrerReponse` 2→1, `ajouterNoteSession` 2→1,
  `terminerExercice` 5→4.
- `debloquerIndice` reçoit le compteur courant, que la page rend déjà, au
  lieu de relire la tentative pour l'incrémenter. Deux onglets cliquant à la
  même seconde perdraient un incrément ; la garde optimiste alternative
  transformerait la perte en indice affiché mais non compté, c'est-à-dire en
  **autonomie surestimée** — le défaut P8 déjà connu, qu'on refuse d'aggraver.
- **Bug corrigé au passage :** `entiteVersLigne` ignore les `undefined`, donc
  vider une note de séance n'écrivait rien — le champ restait tel quel. Le
  défaut préexistait. `modifier()` distingue désormais `undefined`
  (« ne pas toucher ») de `null` (« effacer »).
- L'en-tête de `lib/store/actions.ts` affirmait « application mono-utilisateur
  exécutée en local : il n'y a pas d'authentification ». Faux depuis ADR-015.

**Limite connue.** `db.ts` n'a toujours aucun test : `modifier()` n'est
couvert que par la vérification manuelle de bout en bout. Le couvrir
demanderait un faux client PostgREST — infrastructure de test nouvelle,
délibérément hors de ce chantier, et qui reste à faire.

**Ce qui n'a pas été touché.** `demarrerTentative` garde ses deux
allers-retours : le rendre atomique demanderait un index unique partiel, donc
une modification de `schema.sql` (ADR-012, « fragile »). `lib/engine/` et
`lib/domain/` sont inchangés.

---

<a name="adr-025"></a>
## ADR-025 — La traçabilité peut être repliée, jamais retirée ✅

**Date.** 31/07/2026. Tranchée explicitement pendant le chantier UI/UX.

**Contexte.** Le protocole anti-hallucination impose que toute valeur affichée
porte sa source. En pratique, cela s'était traduit par de la surface : le
panneau « Contexte pédagogique » occupait en permanence un tiers de la largeur
de `/tuteur`, et la carte « Progression récente » un tiers de la hauteur
utile du tableau de bord. Les deux sont des lectures de contrôle — on les
consulte en cas de doute, pas à chaque visite.

La question posée était : peut-on les retirer ? Non — ce serait affaiblir le
principe. Peut-on les mettre au repos ?

**Décision.** Oui. Une information de traçabilité satisfait le protocole dès
lors qu'elle est **atteignable sans quitter l'écran ni dépendre du réseau**.
Elle n'a pas à être dépliée en permanence. Le véhicule est le `<details>` natif
(primitive `Depliant`), qui fonctionne **sans JavaScript** — c'est cette
propriété, et non l'ergonomie, qui rend le repli acceptable.

Corollaire, appliqué dès ce chantier : **ce qui est actionnable ne se replie
pas.** L'encart « Aucune clé API configurée » de `/tuteur` reste visible hors du
dépliant — le replier transformerait une panne explicable en panne muette.

**Conséquences.**
- ✅ `/tuteur` : conversation pleine largeur, contexte replié sous un résumé
  chiffré (`Contexte transmis — N k caractères · modèle`). Aucune ligne retirée.
- ✅ Tableau de bord : « Progression récente » repliée, ce qui laisse le
  bandeau d'activité passer au-dessus de la ligne de flottaison.
- ⚠️ Un repli n'est jamais gratuit : une information repliée est une
  information moins lue. La règle ne vaut que pour les lectures **de
  contrôle**, jamais pour ce qui doit provoquer une action.

**Dette relevée au passage, corrigée dans la foulée.** Les réglages du compte —
et donc l'export du journal, la déconnexion et désormais le choix du thème —
vivent dans le pied du rail, qui est `hidden lg:flex` : en dessous de `lg`, ils
n'étaient atteignables par aucun chemin. Le défaut préexistait à ce chantier,
mais y déplacer le thème l'aggravait. La barre supérieure mobile reçoit donc un
bouton compte ouvrant le même panneau, à la place de la bascule clair/sombre
qui l'occupait. Conséquence : **il n'existe plus de bascule de thème isolée** —
l'apparence est un réglage parmi les autres, au même endroit partout.

---

<a name="adr-026"></a>
## ADR-026 — Le référentiel est une donnée par compte, construite par le tuteur ✅

**Date.** 31/07/2026. **Tranchée par Maxime.** Ferme [ADR-009](#adr-009),
remplace [ADR-020](#adr-020).

### Problème

`lib/domain/referentiel.ts` codait en dur 53 compétences et 8 domaines centrés
BUT QLIO → Master ITI, et `DOMAINE_PILOTE` en fixait le périmètre actif **pour
tous les comptes à la fois**. Étendre le référentiel était un commit, pas un
geste d'utilisateur.

Le fait qui tranche, relevé en base le 31/07 : sur 3 comptes, **deux** avaient
`formation: "Formation à renseigner"`, et l'un d'eux (`cyril.hup2716`) était un
compte tiers **actif** — 3 preuves, 5 tentatives — travaillant sur un
référentiel écrit pour quelqu'un d'autre. La cible déclarée du produit était
déjà là, et le produit ne savait pas l'accueillir.

### Décision

Le référentiel devient une donnée par compte : tables `domaines` et
`competences`, RLS par la même politique que les preuves. Un compte démarre
**vide**, déclare son sujet, et construit son arborescence avec le tuteur —
philosophie, droit, n'importe quoi — sans qu'une ligne de code soit écrite pour
lui.

Options écartées : **A** (référentiels prédéfinis multiples) ne sert que les
sujets déjà écrits, et un philosophe n'y trouve rien ; **C** (socle commun +
extensions) suppose qu'il existe un socle transverse, ce qu'aucune observation
n'appuie.

### Ce qui rend la chose possible, et pourquoi maintenant

ADR-004 était le prérequis technique : un référentiel de philosophie n'aura
jamais d'exercices écrits à la main. Il est vérifié depuis le 31/07 — les deux
seuls exercices en base portent `origine = 'tuteur'`. Le maillon de génération
fonctionne ; ce chantier le rend **transférable à n'importe quel sujet**.

### Le garde-fou de typage est déplacé, pas retiré

`DomaineId` cesse d'être une union de huit littéraux et devient `string`. Aucune
union ne peut vérifier à la compilation une valeur produite à l'exécution par un
utilisateur. La garantie passe à la clé étrangère
`competences.domaine → domaines.id`, et surtout à `evidence_competence_fk`.

**C'est un renforcement.** Avant, `historique.ts` faisait `if (!skill) continue`
— une preuve dont le code avait disparu du référentiel s'effaçait de
l'historique **en silence**. Désormais la base la refuse.

### La règle uniforme de rédaction

Une compétence n'entre au référentiel que si elle est **mesurable par l'appareil
qui existe** — c'est la condition qui empêche un référentiel généré de se
remplir de lignes que rien ne pourra jamais prouver. Cinq critères, chacun tracé
à un protocole existant : savoir-faire observable (éval. §10) · notable sur les
cinq dimensions (§3) · testable dans deux contextes (§11) · exerçable par un des
huit types · prouvable en 20 à 60 min.

Écrit dans `data/00_instructions/00_SYSTEME_PROTOCOLE_REFERENTIEL.txt`, chargé
**conditionnellement** (mécanisme d'ADR-021 — 6 Ko inutiles quand l'utilisateur
travaille un exercice). Un compte sans référentiel le reçoit toujours : c'est sa
seule conversation possible.

La moitié mécanique est vérifiée par le code
(`lib/domain/referentiel-compte.ts`) ; la moitié sémantique — « est-ce vraiment
un savoir-faire ? » — reste à l'humain au moment de la validation, ce qui est
exactement la répartition de P5.

### Le tuteur n'écrit aucun code de compétence

Troisième type de proposition, `PROPOSITION DE RÉFÉRENTIEL`, sur le modèle des
deux existants. Mais celui-ci a une contrainte propre : **les codes sont
attribués par l'application**, à partir du préfixe du domaine, et jamais par le
modèle.

Un code est la clé étrangère des preuves. Un code inventé pourrait entrer en
collision avec un code existant, et les preuves suivraient la mauvaise
compétence — sans erreur visible, sans rien à corriger après coup. La
numérotation ne réutilise jamais un numéro libéré par une suppression, pour la
même raison.

### Conséquences

- `DOMAINE_PILOTE` global disparaît ; le périmètre devient `competences.active`,
  par compte. ADR-020 est traduite, pas annulée.
- `ORDRE_DIAGNOSTIC` — onze codes en dur, seule trace d'un plan supprimé le
  27/07 — est remplacé par une dérivation (palier, puis rang déclaré). Un
  référentiel construit par l'utilisateur ne peut pas porter de liste écrite
  d'avance.
- Le domaine d'un exercice se dérive de sa compétence cible. Un exercice ne peut
  plus être rangé dans un domaine autre que celui qu'il mesure.
- L'édition du profil existe enfin (`formation`, objectifs) — le prérequis
  matériel qu'ADR-009 identifiait depuis le 27/07 et que rien ne renseignait.
- ADR-006 a dû être tranchée dans le même geste. Voir plus haut.

### Ce que cela ne fait pas

Le 3ᵉ maillon — l'ajustement des exercices, ADR-014 — reste inexistant. Ce
chantier rend le 1ᵉʳ maillon transférable à n'importe quel sujet ; il ne ferme
pas la boucle.

---

<a name="adr-027"></a>
## ADR-027 — Suppression ou archivage : une preuve n'est jamais orpheline ✅

**Date.** 31/07/2026. **Tranchée par Maxime.** Corollaire d'[ADR-026](#adr-026).

**Problème.** Un référentiel modifiable doit être *réductible* — la demande
était explicite : « une logique facilement réalisable de supprimer des champs ».
Mais supprimer une compétence qui porte des preuves détruirait ces preuves, ce
qu'interdisent **P4** et le protocole anti-hallucination §6.

**Décision.** Le geste de retrait est **dérivé du nombre de preuves**, jamais
arbitré :

| État | Geste | Effet |
|---|---|---|
| 0 preuve | `DELETE` franc | La ligne disparaît. Rien n'est perdu. Le code n'est pas réattribué. |
| ≥ 1 preuve | Archivage (`archive = true`, `active = false`) | Les preuves restent, l'intitulé reste résoluble, la compétence sort des calculs et de l'affichage. |
| Domaine | `DELETE` si toutes ses compétences le sont, archivage en cascade sinon | — |

Le `code` est **immuable** : c'est la clé étrangère des preuves, le renommer
déplacerait tout un historique vers une autre compétence. Intitulé, palier,
importance, prérequis et ordre restent éditables — ce sont des libellés et des
pondérations, pas des mesures.

**Pourquoi ce n'est pas un choix offert.** L'écran annonce lequel des deux
gestes s'appliquera, **avant** le clic, avec le nombre de preuves en jeu.
`supprimerCompetence` **refuse** quand des preuves existent plutôt que de se
replier en silence sur l'archivage : une fonction qui fait autre chose que ce
que son nom annonce est exactement le genre de garde-fou qui s'érode.

**Deux drapeaux distincts, et c'est délibéré.** `active` est le périmètre de
travail, réversible d'un clic. `archive` acte qu'une compétence porte des
preuves. Une compétence archivée ne se réactive pas directement : il faut la
désarchiver d'abord, et le désarchivage ne la remet pas d'office au travail.

---

<a name="adr-028"></a>
## ADR-028 — Le 3ᵉ maillon : la difficulté et l'angle sont dérivés des tentatives ✅

**Date.** 31/07/2026. **Tranchée par Maxime.** Lève la réserve d'[ADR-014](#adr-014).

### Le problème, correctement nommé

La boucle est *génération → évaluation → ajustement*. Le 3ᵉ maillon n'existait
pas, et ce n'était **pas** « on ne peut pas modifier un exercice » — `difficulte`
est une colonne éditable depuis l'origine.

C'était que **rien ne relisait la mesure pour régler la génération suivante**.
`indicesUtilises`, `dureeMin`, `resultat` et `autoEvaluation` étaient écrits à
chaque tentative et jamais réexploités. `recommend.ts` mappait le niveau dérivé
vers une difficulté par table fixe — la même proposition à qui venait d'échouer
indices épuisés et à qui venait de réussir sans aide en moitié moins de temps.
Et le tuteur, qui rédige les exercices, ne recevait jamais ce signal.

### Ce que les données ont dicté

ADR-014 inscrivait la condition : difficulté **dérivée des preuves**, pas
ressaisie à la main — `ErrorItem` est resté vide précisément parce qu'il
demandait une saisie. Les 17 tentatives réelles du compte principal ont fourni
la matière, et trois faits ont façonné le module :

**1. Les indices sont bimodaux.** 0 ou 3, presque jamais entre. Et
`3 indices → échec` s'est vérifié 4 fois sur 4.

**2. Il existe deux échecs différents.** `diag-algo-01` : difficulté 2, estimée
25 min, « échoué » en **1 minute** avec les trois indices consultés. En conclure
« trop difficile » serait inventer — l'exercice n'a pas été tenté. D'où la règle
qui gouverne tout le module : **sous 25 % de la durée estimée, aucun verdict
n'est rendu sur la difficulté** (anti-hallucination §7).

Exception : une **réussite** échappe à cette règle. On ne réussit pas un
exercice sans l'avoir fait, et une réussite éclair est le signal « trop facile »
le plus fort qui soit — l'exclure jetterait la donnée la plus informative.

**3. L'auto-évaluation est le signal le plus riche, et personne ne la lisait.**
`diag-dev-03` a été échoué avec « comprehension 0.5, application 0,
integration 0 ». La compréhension tient ; l'application s'effondre. Proposer le
même exercice « en plus facile » raterait ce que la mesure dit.

### Décision

`lib/engine/calibration.ts` dérive, par compétence et sans rien stocker (P1) :

| Sortie | Dérivée de |
|---|---|
| **Difficulté conseillée** | résultat × indices épuisés × durée réelle contre estimée, sur la dernière tentative exploitable |
| **Dimension faible** | moyenne des `autoEvaluation` sur les 3 dernières tentatives, avec son nombre d'observations |

Deux seuils, chacun calé sur des observations et non sur une intuition :
`FRACTION_NON_TENTEE = 0.25` et `FRACTION_TROP_FACILE = 0.6`. Le second sépare
exactement `diag-dev-05` (12 min sur 25) et `diag-prod-01` (14 sur 35) — trop
faciles — de `diag-prod-03` (32 sur 35) et `diag-ro-01` (61 sur 35) — calibrés.

**Le maillon n'est bouclé que parce que le tuteur reçoit le signal.** Un bloc
« CALIBRAGE DU PROCHAIN EXERCICE » entre dans `systemeProfil`, et le gabarit de
proposition d'exercice cesse de laisser la difficulté à l'appréciation du
modèle : elle lui est donnée, et la dimension faible doit être travaillée par au
moins un critère.

### Ce que la calibration ne fait pas

Elle règle la **difficulté**, elle ne **re-classe pas** les compétences. Les
`facteurs` de `recommend.ts` restent des contributions chiffrées au score de
priorité ; y glisser une entrée à contribution nulle aurait rendu la liste
illisible. Faire peser le calibrage sur la priorité serait une décision
distincte, non prise ici.

Elle ne dit rien non plus quand elle n'a rien à dire : `difficulteConseillee`
vaut `null` sur une compétence jamais travaillée en exercice, ou dont toutes les
tentatives récentes ont été abandonnées trop tôt. L'appelant retombe alors sur
la table par niveau — et l'interface l'affiche.

### Vérifié par

27 tests dans `calibration.test.ts`, **écrits sur les tentatives réelles** avec
leurs valeurs exactes plutôt que sur des cas construits. Un seuil calé sur une
intuition se déplace au premier désaccord ; un seuil calé sur des données
observées demande de nouvelles données pour bouger. Dont le test du maillon
lui-même : la même compétence, avec et sans calibration, ne reçoit pas la même
difficulté.

### Défaut trouvé en écrivant les tests

La règle « non tentée » s'appliquait d'abord à **toutes** les tentatives, y
compris les réussites : réussir un exercice de difficulté 5 en 5 minutes sur 25
ne produisait aucun conseil. C'est le test qui l'a révélé, et c'est le module
qui a été corrigé.

---

<a name="adr-029"></a>
## ADR-029 — Aucun profil n'est écrit dans les protocoles ✅

**Date.** 31/07/2026. **Tranchée par Maxime**, sur signalement d'usage réel.
Corrige un angle mort d'[ADR-026](#adr-026).

### Le défaut

`data/00_instructions/00_SYSTEME_INSTRUCTIONS_PRINCIPALES.txt` § 2 décrivait en
dur le parcours d'une seule personne — « Révise et approfondit son BUT QLIO,
prépare un Master ITI interdisciplinaire, vise une carrière de chercheur ». Ce
fichier est chargé **sans condition pour tous les comptes**.

Conséquence observée : le compte tiers demandait au tuteur d'initialiser son
profil, et le tuteur lui parlait de son BUT QLIO — un diplôme qui n'est pas le
sien, des objectifs qui ne sont pas les siens.

### Pourquoi ADR-026 ne l'a pas attrapé

Le chantier a généralisé le **référentiel** — la liste de ce qui est mesuré —
sans généraliser les **protocoles**, qui décrivent *qui* est mesuré. Les deux
sont pourtant la même hypothèse : que le produit n'a qu'un utilisateur.

C'est le genre de défaut qu'une relecture ne trouve pas, parce que le fichier
fautif se lit correctement quand on est la personne décrite. Il a fallu l'usage
d'un autre compte.

### Décision

**Aucun fichier de protocole ne contient de profil.** Le profil réel est
transmis à chaque conversation, dans une section « PROFIL DÉCLARÉ PAR
L'UTILISATEUR », et il vient exclusivement de ce que la personne a écrit.

§ 2 pose la règle explicitement : ne jamais attribuer une formation, un diplôme,
un métier ou un objectif absent de cette section — et ne pas l'inférer du
référentiel. *Travailler la statistique ne fait pas de quelqu'un un ingénieur,
ni la philosophie un étudiant en lettres.* Ce qui est marqué « non déclaré » se
demande, il ne se comble pas : même exigence que pour un niveau de compétence
(anti-hallucination §7).

§ 7 perd la liste des sept domaines historiques et la référence au module
supprimé.

### Le manque qui rendait § 2 nécessaire

`serialiserProfil` ne transmettait **jamais** `formation` ni les objectifs hors
compte vierge : le tuteur n'avait littéralement pas d'autre source que le
paragraphe écrit en dur. Le retirer sans transmettre le vrai profil aurait
remplacé une erreur par un vide.

`lib/domain/profil.ts` porte désormais la distinction entre **déclaré** et
**pas encore rempli**. Les valeurs par défaut du schéma sont des libellés
d'invite (« Formation à renseigner »), pas des réponses : les transmettre
telles quelles se lirait comme une formation nommée « à renseigner ».

### Trois autres fuites du même défaut, corrigées

| Emplacement | Correction |
|---|---|
| `lib/tutor/contexte.ts` — légende « ?D » | « hypothèse **BUT QLIO** non vérifiée » → « hypothèse issue de la formation déclarée » |
| `competences/page.tsx` | même étiquette, affichée à l'écran de tous les comptes |
| `00_SYSTEME_PROTOCOLE_EVALUATION_CORE.txt` § 2 et § 11 | exemples exclusivement industriels, désormais donnés dans deux domaines. Aucune règle modifiée |

### Une erreur de données, introduite par la migration d'ADR-026

Le compte tiers avait reçu `hypothese_initiale = « Domaine couvert par le BUT
QLIO »` sur `STAT-01` : la justification du compte d'origine, recopiée telle
quelle. Une hypothèse tirée du diplôme de quelqu'un d'autre n'est pas une
hypothèse — la ligne a été mise à `NULL` plutôt que réécrite, et
`scripts/migrer-referentiel.ts` ne transfère plus les hypothèses hors du compte
dont elles décrivent la formation.

### Vérifié par

15 tests, dont le décisif : le contexte **complet** d'un compte sans profil
déclaré — protocoles inclus, et non seulement les blocs calculés — ne doit
contenir ni « QLIO » ni « Master ITI ». Le test lit `systemeStable` précisément
parce que c'est dans un fichier de protocole que la fuite se trouvait.

---

<a name="adr-030"></a>
## ADR-030 — Aucune preuve n'est écrite sur une tentative qui n'a pas eu lieu ✅

**Date.** 01/08/2026. **Tranchée par Maxime**, sur une clarification explicite
(`AskUserQuestion`) avant tout changement de code. Étend [ADR-028](#adr-028) au
journal de preuves. Écho direct d'[ADR-008](#adr-008), qui reste ouverte.

### Ce qui l'a révélée

**La boucle a tourné en entier pour la première fois le 01/08/2026.** Le tuteur
a généré deux exercices depuis la calibration, ils ont été faits et clos. C'est
la mesure qu'attendaient `PRODUCT.md` §3 et `CLAUDE.md` §0.

Elle a produit deux résultats, et le second n'était pas cherché.

**1. Le 3ᵉ maillon fonctionne.** Sur les deux compétences où la calibration
avait un avis, la difficulté produite l'a suivi exactement :

| Compétence | Dernière tentative exploitable | Signal | Conseillée | Produite |
|---|---|---|---|---|
| DEV-01 | `diag-dev-01` partiel, 20 min / 20 | `calibre` | 1 + 0 = **1** | **1** |
| DEV-03 | `diag-dev-03` échec, 15 min / 25 | `trop-difficile` | 2 − 1 = **1** | **1** |

**2. Un défaut à l'entrée de la chaîne de preuve.** Les deux tentatives ont été
**abandonnées en 1 minute**, sur 20 et 25 estimées. `calibration.ts` refusait
d'en conclure quoi que ce soit — fractions de 0,04 et 0,05 contre
`FRACTION_NON_TENTEE = 0,25`, signal `non-tentee`. C'est exactement la règle
qu'ADR-028 avait construite autour de `diag-algo-01`.

`terminerExercice` écrivait la preuve quand même, avec **toutes les dimensions
à 0**. Mesuré sur DEV-01 en rejouant le moteur réel :

```
sans la tentative d'1 min : score 2,7  dims 1 / 1 / 0,75
avec                      : score 2,3  dims 0,87 / 0,87 / 0,65  + 1 contradiction
```

### Le problème, correctement nommé

Ce n'était pas « le seuil est mal réglé ». C'était que **le garde-fou
anti-hallucination n'existait que d'un côté** : tenu pour dériver la difficulté,
rompu pour écrire dans le journal de preuves — la seule chaîne qui fait bouger
un niveau. « L'absence de mesure n'est pas un zéro » (P2) était donc vrai à
l'affichage et faux à l'écriture.

C'est la même forme de défaut qu'ADR-008 : à l'**entrée** de la chaîne, pas à
son agrégation. Une erreur d'agrégation déforme un indicateur ; une erreur sur
ce qui entre déforme tout ce qui en descend.

### Décision

La règle sort de `verdictTentative` dans **`tentativeMenee`**
(`lib/engine/calibration.ts`), exportée, et les **deux** chemins l'appellent.
Un test parcourt les deux et vérifie qu'ils rendent le même verdict : desserrer
l'un sans l'autre le fait tomber.

Au bilan, quand la tentative n'a pas eu lieu :

- la tentative passe en **`abandonnee`** au lieu de `terminee` ;
- **aucune preuve n'est écrite** ;
- **l'écran le dit**. Le silence ferait croire la mesure enregistrée — ce serait
  pire que le zéro qu'on vient de refuser d'écrire (P3 : aucune valeur sans
  source, y compris quand la valeur est « rien ») ;
- **la tentative reste en base.** C'est un fait observé, et `verdictTentative`
  la lit pour expliquer pourquoi aucune difficulté n'est conseillée ;
- **la séance reste au journal d'activité.** La minute passée a eu lieu ; la
  taire ferait disparaître l'abandon du suivi.

### Données existantes

Trois preuves déjà écrites depuis un abandon (DEV-01, DEV-03, DEV-04, toutes
dimensions à 0, fractions 0,040 / 0,040 / 0,050) ont été **supprimées** après
revue ligne à ligne. Les tentatives correspondantes ont été conservées et
passées en `abandonnee` : les 24 tentatives de la base sont intactes. DEV-01
est revenu de 2,3 à 2,7.

### Ce que cette décision ne fait pas

Elle ne touche pas au seuil : `FRACTION_NON_TENTEE` reste à 0,25, calé sur des
observations (ADR-028). Elle ne dit rien de l'aide externe — **ADR-008 reste
ouverte**, et c'est toujours le seul principe en défaut.

### Vérifié par

8 tests dans `calibration.test.ts`, écrits sur les tentatives réelles du 01/08
avec leurs valeurs exactes, dont celui qui lie les deux chemins. 210 tests au
total.

### Ce qu'il faut en retenir sur la méthode

194 tests n'avaient pas vu ce défaut, et ne pouvaient pas : **aucun exercice
généré par le tuteur n'avait jamais été clos.** Le premier tour complet de la
boucle l'a exhibé en une fois. C'est l'argument d'ADR-013 — la boucle est le
produit — sous sa forme la plus concrète : la faire tourner mesure le système,
pas seulement l'utilisateur.

---

## ADR-031 — Les propositions du tuteur passent en sortie structurée ✅

**Date.** 01/08/2026. Lot 3.2 du plan de micro-incrémentation, **demandé
explicitement**. Remplace le mécanisme de gabarits markdown d'[ADR-004](#adr-004)
et d'[ADR-026](#adr-026) ; ne change aucun garde-fou.

### Le problème

Le tuteur écrivait ses propositions — preuve, exercice, branche — en blocs
markdown à étiquettes, relus par une machine à états (`decouperChamps`,
`lib/tutor/proposition.ts`). Trois défauts de **forme**, tous observés :

1. **Une réponse tronquée produisait un demi-exercice, en silence.** Les champs
   arrivent dans l'ordre du gabarit ; `Correction` et `Critère` sont en fin de
   bloc. Un flux coupé — plafond de jetons, bouton « Arrêter » — laissait un
   bloc qui satisfaisait « titre + énoncé », donc affichable, donc cliquable.
   Le lot 1 l'a masqué avec `exerciceComplet` ; il ne l'a pas supprimé.
2. **La mise en forme était une classe de bugs.** `**Titre** :`, `**Titre :**`,
   étiquette seule sur sa ligne, tiret cadratin dans un intitulé : quatre
   correctifs successifs sur le parseur, dont le commit `a3f2946`.
3. **Les interdits n'étaient que des phrases.** « N'écris aucun code de
   compétence » (ADR-026, `CLAUDE.md` §8) se lit ou ne se lit pas. Un code
   inventé entre en collision et les preuves suivent la mauvaise compétence,
   sans erreur visible.

### Décision

Les trois propositions passent par un **appel d'outil**, décrit une seule fois
dans `lib/tutor/outils.ts` et traduit par chaque moteur (`tools` chez Anthropic,
`tools` / `tool_choice` chez les compatibles OpenAI). Le texte conversationnel
continue de streamer ; la proposition arrive en fin de tour, validée.

- **La validation est écrite à la main et fait seule autorité.** Le schéma part
  au fournisseur, mais un fournisseur qui le suivrait mal ne doit pas pouvoir
  faire entrer une proposition mal formée. Aucune dépendance ajoutée.
- **Le schéma de branche ne comporte AUCUN champ `code`.** L'interdit d'ADR-026
  devient inexprimable au lieu d'être demandé. Un test le vérifie, et un second
  vérifie qu'un `code` glissé malgré tout ne ressort pas de la validation.
- **Une proposition invalide est rejetée ET annoncée** (`proposition-rejetee`).
  Taire le rejet remplacerait le demi-exercice d'hier par un exercice disparu :
  deux pannes silencieuses, pas une correction.
- **`exerciceComplet` reste la seule définition de « complet »**, appliquée
  désormais au plus tôt, à la validation.

### Ce qui ne change pas

Le tuteur n'a toujours **aucun accès en écriture** (P5). Un appel d'outil est
une proposition : elle remplit un formulaire que l'utilisateur valide, comme le
bloc markdown avant elle. Les types rendus par la validation sont ceux des
parseurs — le formulaire de création et l'écran de validation du référentiel ne
sont pas touchés.

### Ce que la mesure dit — et contredit

Le plan annonçait **~1 389 jetons économisés par message**. C'est faux, et il
faut l'écrire :

| Bloc | Avant | Après |
|---|---|---|
| `consignesInterface` | 5 556 car. | **3 105 car.** |
| Schémas des trois outils | 0 | **3 128 car.** |
| **Total** | **5 556** | **6 233 (+677, +12 %)** |

Les gabarits ont bien disparu du prompt ; les schémas coûtent à peu près ce
qu'ils remplacent. **Le gain de ce lot n'est donc pas la taille du prompt** — il
est la rejetabilité d'une proposition tronquée et la disparition d'une classe de
bugs. Les deux blocs vivent dans le préfixe stable, donc mis en cache : le coût
marginal par message est celui d'un cache lu.

Corollaire : **le lot 3.3 ne peut plus s'appuyer sur 3.2 pour son budget.** Les
19 100 caractères de protocole restent le seul gisement réel.

### Repli, et ce qu'il coûte

`compatible-openai.ts` replie en deux marches sur un 400 : d'abord sans
`prompt_cache_key` ni double bloc système (outils conservés), puis sans outils
du tout. Dans ce dernier cas le tuteur répond en texte et **les parseurs de
`proposition.ts` reprennent la main** — d'où leur maintien, avec leurs 33 tests.
Ce qui se perd alors est exactement la rejetabilité. Le mode « copier le
contexte » est dans le même cas : il n'a pas d'appel d'outil, et reçoit les
schémas rendus en texte, depuis la même source.

### 🔬 Ce qui n'est pas vérifié

**La bascule n'a été exercée sur aucun moteur réel.** Les 15 tests de
`outils.test.ts` portent sur la validation, pas sur ce que Mistral ou Anthropic
émettent effectivement.

**Premier essai, 01/08/2026 : aucune carte, et la cause était indécidable.** Les
deux gestes ont rendu « Réponse interrompue. Le texte déjà reçu est conservé. »
Deux enseignements, dont un défaut de ce lot :

1. **Le second geste ne testait pas ce que j'avais écrit.** Cliquer « Arrêter »
   coupe le `fetch` côté navigateur ; le serveur n'achève jamais son tour, donc
   n'émet aucun appel d'outil, donc aucun rejet à annoncer. Le message
   d'interruption est le comportement correct. Ce geste vérifie seulement
   qu'aucune carte n'apparaît — c'est le cas. **`proposition-rejetee` ne peut
   être atteint que par un tour qui va au bout** avec un appel invalide, en
   pratique une troncature à `max_tokens`.
2. **L'absence de carte avait trois causes possibles et aucune n'était
   observable** : le tuteur n'a rien proposé, le fournisseur a refusé `tools` et
   le repli s'est fait en silence, ou le flux a été coupé avant la fin — les
   propositions n'arrivant qu'en fin de tour. Trois diagnostics, un symptôme :
   la panne muette que ce lot combat s'était réinstallée dans le lot lui-même.

Corrigé dans le même geste : l'événement `fin` porte désormais
`outils: { actifs, appels }`. Le compte d'appels s'affiche sous le chat, et un
repli sans outils déclenche un avis explicite au lieu de passer inaperçu.

**Conséquence de conception à assumer** : en sortie structurée, la proposition
arrive en fin de tour. **Interrompre une réponse la perd entièrement**, là où le
gabarit markdown en laissait un fragment. C'est le prix de la rejetabilité, et
il est visible plutôt que subi.

### ✅ Vérifié sur Mistral le 01/08/2026

Second essai, réponse menée au bout, `mistral-large-2512` :

| Observé | Valeur |
|---|---|
| Appels d'outil | **1** |
| Carte « Exercice proposé » | affichée — DEV-03, difficulté 1/5 |
| Avis de repli | aucun — `tools` accepté sur `api.mistral.ai/v1` |
| Jetons | 10 398 entrée / **2 035 sortie** |

**La bascule fonctionne sur le moteur en service.** Anthropic reste 🔬 : aucune
clé n'était disponible.

Deux observations que cet essai a produites :

**1. Le tuteur écrivait l'exercice deux fois** — dans l'appel d'outil *et* en
prose dans le message (énoncé, critères, « je te propose de l'ajouter »). D'où
les 2 035 jetons de sortie. La carte n'était pas dupliquée — le garde-fou
« deux sources, jamais les deux » de `chat.tsx` a tenu — mais la sortie l'était.
Corrigé par une règle du cadre d'intervention : ne pas recopier le contenu d'un
appel d'outil, la carte l'affiche déjà. 🔬 Effet non mesuré.

**2. `cacheLu` restait à 0 — et c'était un zéro fabriqué.** Examiné le
01/08/2026 : `compatible-openai.ts` lisait `prompt_cache_hit_tokens`, décrit en
commentaire comme « Mistral-specific ». **Il ne l'est pas** — c'est un champ
DeepSeek. Mistral publie les jetons servis par le cache dans
`usage.prompt_tokens_details.cached_tokens`, la forme standard OpenAI. Le champ
lu était donc toujours absent, le `?? 0` le rendait nul, et l'interface
affichait « dont 0 lus en cache » : **un chiffre qu'aucune API n'avait jamais
dit, dans l'écran même où le produit promet de n'en afficher aucun** (P2, P3).

C'est le défaut d'ADR-030 sous une autre forme — l'absence de mesure lue comme
un zéro — cette fois sur l'indicateur de coût plutôt que sur le journal de
preuves. Il ne fausse aucun niveau de compétence, mais il a directement faussé
un arbitrage : c'est sur ce « 0 » que j'ai conclu, dans la version précédente de
cette ADR, que les schémas étaient payés plein tarif.

Corrigé : `jetonsLusEnCache` lit les deux formes, rend **`null`** quand le
fournisseur est muet, et l'interface affiche alors « cache non renseigné par le
fournisseur ». Quatre tests, dont un qui distingue un cache réellement vide
(`cached_tokens: 0`) d'un cache non renseigné.

🔬 **L'efficacité réelle du cache reste inconnue** — la mesure n'avait jamais eu
lieu. À relire sous le chat au prochain message. Si le chiffre reste nul une
fois le bon champ lu, deux pistes, dans cet ordre : `prompt_cache_key` est bien
documenté chez Mistral mais notre clé est un hachage de `systemeStable`, qui
**varie** selon les protocoles chargés ce tour-là (ADR-021) ; et le double bloc
`system` peut empêcher la correspondance de préfixe.

**Test de réfutation, pour Anthropic et pour toute reprise :**

- demander un exercice et **laisser la réponse aller au bout** ; la carte doit
  s'afficher, et la ligne sous le chat indiquer « 1 appel(s) d'outil » ;
- si elle indique « 0 appel(s) » sans avis de repli, le fournisseur accepte les
  outils mais le modèle ne les emploie pas : c'est le prompt qu'il faut reprendre ;
- si l'avis « n'a pas accepté les appels d'outil » apparaît, le fournisseur
  refuse `tools` sur cette route et la bascule est à revoir au niveau du moteur.

### Étape suivante, non faite ici

`proposition.ts` et ses tests **restent en place** tant que la vérification
ci-dessus n'a pas eu lieu sur les deux moteurs. Leur retrait est un second
commit, pas celui-ci.

---

## ADR-032 — Ce qu'un validateur rejette n'a pas à être un paragraphe de prompt ✅

**Date.** 01/08/2026. Lot 3.3 du plan de micro-incrémentation, **demandé
explicitement**. Suite directe d'[ADR-031](#adr-031), qui a rendu structurels
plusieurs interdits jusque-là écrits en prose. Corrige les chiffres périmés
d'[ADR-021](#adr-021).

### La règle

Un interdit tenu par le code — un schéma sans champ, une architecture sans
route d'écriture, un moteur qui refuse une valeur — n'a pas besoin d'être
répété au modèle. **Il est déjà impossible à enfreindre.** Ce qui doit rester
au prompt est ce qu'aucun validateur ne saura dire : le jugement pédagogique.

Ce dégraissage **ne retire aucune règle.** Il retire des répétitions et des
énoncés devenus structurellement garantis.

### Ce qui a été coupé, et pourquoi c'était sûr

| Coupe | Ce qui la garantit désormais |
|---|---|
| Absence d'accès en écriture, dite **4 fois** (instructions §4, §10, §17, cadre d'intervention) | Aucune route de l'application ne l'offre. Énoncée **une** fois, dans le cadre d'intervention. |
| Niveaux de preuve C et D détaillés en exemples | `estRecevable` les rejette, et le schéma de proposition de preuve **n'a aucun champ de niveau** — le tuteur ne peut pas en écrire un. |
| « N'écris aucun code de compétence » (10 lignes) | ADR-031 : le schéma de branche n'a **pas** de champ `code`. |
| Échelle 0-5 dans les instructions §6 | Dupliquait le protocole d'évaluation §4, dont le texte disait lui-même qu'il « fait foi ». |
| Instructions §11, §14, §15 | Dupliquaient respectivement évaluation §7/§11, anti-hallucination §9, et la consigne de concision du cadre d'intervention. |
| Conditions de mesurabilité a–e dans le cadre d'intervention | **Déplacées**, pas supprimées — voir ci-dessous. |

### Mesure

| Bloc | Avant | Après |
|---|---|---|
| Instructions principales | 8 926 | **7 029** |
| Protocole d'évaluation (CORE) | 4 863 | 4 863 |
| Protocole anti-hallucination | 5 311 | **5 299** |
| Cadre d'intervention | 3 105 | **2 480** |
| Schémas des outils | 3 128 | **3 348** |
| **Plancher payé à chaque message** | **25 333** | **23 019 (−2 314, −9,1 %)** |

Soit environ **−580 jetons par message**. Le protocole de référentiel, chargé
à la demande, passe de 7 287 à 6 808.

### Le seul poste en hausse, et pourquoi il est volontaire

Les schémas grossissent de 220 caractères. Les cinq conditions de mesurabilité
d'une compétence étaient écrites **deux fois** — dans le cadre d'intervention,
à chaque message, et au protocole de référentiel §2. Les retirer du premier
suffisait presque ; sauf que **le protocole de référentiel n'est chargé que sur
mots-clés**, et « je veux travailler la thermodynamique » n'en porte aucun. Le
tuteur aurait proposé une branche sans aucune règle de mesurabilité.

Leur version condensée est donc passée dans la **description de l'outil**
`proposer_referentiel`, qui part avec l'outil à chaque message. Le déplacement
est le point : une règle qui doit toujours s'appliquer appartient à l'endroit
qui est toujours présent, pas au fichier qu'une liste de mots-clés décide de
charger.

### La main la plus légère sur l'anti-hallucination

Une seule coupe sur quatorze sections, et la moins engageante : les exemples
de C et D. Les treize autres sont intactes. C'est le garde-fou que le produit
vend ; on n'y touche qu'à la marge.

⚠️ **`NiveauPreuve` conserve ses quatre valeurs dans le code.** C et D existent
pour être **refusées** ; les retirer du type priverait le moteur de ce pouvoir
(CLAUDE.md §8). Cette coupe ne touche que le prompt.

### Un chiffre périmé est un argument faux

ADR-021 annonçait 17 577 caractères de protocole toujours chargé. Remesuré
aujourd'hui avant toute coupe : **19 100**. Les fichiers avaient grossi de
1 523 caractères au fil d'ADR-026 et d'ADR-029, sans que le total soit repris.

Ce n'est pas une coquille : ce chiffre sert d'argument aux décisions suivantes,
et j'ai failli dimensionner ce lot dessus. ADR-021 porte désormais un
avertissement daté. **Toute ADR qui annonce une mesure devrait porter la date à
laquelle elle a été prise** — celles-ci ne vieillissent pas comme les décisions.

### 🔬 Non vérifié

**L'effet sur le comportement du tuteur n'est pas mesuré.** Retirer 2 314
caractères de consignes redondantes ne devrait rien changer — c'est
l'hypothèse, pas une observation. Test de réfutation : sur les trois prochains
exercices générés, vérifier que la difficulté suit toujours le calibrage, que
les critères portent bien une dimension du protocole, et qu'aucune proposition
de branche ne contient d'intitulé non mesurable (« comprendre X », un sujet
plutôt qu'un savoir-faire). Si l'un des trois dérape, la coupe correspondante
se remet — et on saura laquelle.

---

<a name="adr-033"></a>
## ADR-033 — L'aide extérieure se demande, l'autonomie se dérive ✅

**Date.** 01/08/2026. **Tranchée par Maxime**, qui a arbitré [ADR-008](#adr-008)
en option A *et* posé la contrainte de forme : réduire le nombre de boutons, pas
en ajouter. Lot 4 du plan de micro-incrémentation. **Ferme le dernier principe
en défaut (P8).**

### Le défaut, une dernière fois

`indicesUtilises` ne comptait que les indices **internes**. Documentation
consultée, assistant IA sollicité, correction lue : invisibles. Le moteur
écrivait « A3 — résolution autonome ».

| Preuve | Enregistré | Écrit par l'utilisateur |
|---|---|---|
| `RO-01` | A3, 0 indice | *« J'ai eu besoin de l'aide de Claude et de ressources »* |
| `STAT-02` | A3, 0 indice | *« j'ai regardé sur internet »* |

**La personne était honnête ; l'instrument était sourd.** Le champ commentaire
n'est pas lu par le moteur. C'est une erreur à l'**entrée** de la chaîne de
preuve, pas à son agrégation — elle déforme tout ce qui en descend.

### Décision

L'aide extérieure **plafonne** l'autonomie, selon le protocole d'évaluation §5
lu à la lettre :

| Aide déclarée | Plafond | Raison |
|---|---|---|
| aucune | — | rien à plafonner |
| documentation, cours | **A2** | « quelques indices nécessaires » — une référence consultée est un indice |
| assistant IA | **A1** | « solution fortement guidée » |
| correction obtenue | **A0** | « solution fournie », par définition |

L'autonomie retenue est le **minimum** entre les indices internes et ce
plafond. Un minimum, jamais un remplacement : indices épuisés (A1) + doc
consultée (plafond A2) reste **A1**. Un plafond ne doit pas *relever* ce que la
mesure interne avait déjà rabaissé.

Le protocole d'évaluation §5 porte ce barème, écrit avant le code
(`00_PERENNISATION` §6). `autonomieObservee` le transcrit.

### La forme compte autant que le fond

Le sélecteur à cinq paliers disparaît. Il demandait de **connaître le
protocole** pour être rempli honnêtement, et récompensait l'optimisme : personne
ne se déclare A1. À sa place, une question de fait dont la personne se
souvient — de quelle aide as-tu disposé ? — avec « aucune » par défaut, donc
**zéro clic dans le cas ordinaire**.

C'est la contrainte posée par Maxime, et elle améliore la mesure au lieu de la
contrarier : on ne demande plus un jugement sur soi, on demande un fait.

> ⚠️ **A4 n'est plus atteignable.** C'était le seul palier auto-attribuable, et
> « j'ai fait preuve d'initiative méthodologique » est exactement le type
> d'auto-évaluation que ce chantier retire. Le palier reste dans `Autonomie` et
> dans l'échelle du protocole ; plus rien ne l'écrit. Si une mesure objective de
> l'initiative apparaît un jour, le palier est là pour la recevoir.

### Ce qui n'est pas fait, et pourquoi

**Les 29 preuves existantes ne sont pas retouchées.** Aucune donnée ne dit
quelle aide a servi, sauf les deux commentaires ci-dessus. Corriger les
vingt-sept autres demanderait de les inventer — la faute même que ce système
combat. Le biais subsiste, **borné dans le temps**, et le protocole
anti-hallucination §12 le signale désormais au tuteur comme portant sur les
preuves antérieures au 01/08/2026.

**Le bilan d'exercice ne pose pas la question.** Ce chemin dispose déjà d'une
mesure non déclarative — le compteur d'indices — et le lot visait à *réduire*
les inputs, pas à en ajouter un sur le chemin le plus fréquenté. L'écart y
subsiste, moindre mais réel : quelqu'un qui fait un exercice de l'application
avec Claude ouvert à côté sera toujours coté A3.

C'est une fermeture **partielle** de P8, et il faut le dire ainsi. Le principe
n'est plus violé sur le chemin où il n'existait aucune mesure ; il l'est encore,
plus faiblement, là où une mesure partielle existe.

### 🔬 Non vérifié

**Aucune preuve n'a encore été enregistrée avec ce barème.** Test de
réfutation : enregistrer une preuve manuelle en déclarant « assistant IA » et
vérifier que l'autonomie écrite est **A1**, non A3 — et que le commentaire
consigne « Aide extérieure déclarée : assistant IA ».

Reste ouvert, et sans échéance : **le barème lui-même n'a pas été validé par
l'usage.** `documentation → A2` est la lecture littérale du protocole, mais
c'est une décision de valeur, pas une mesure. Si les niveaux s'effondrent chez
quelqu'un qui travaille normalement documentation ouverte, c'est ce chiffre
qu'il faudra rediscuter — pas le principe.

---

<a name="adr-034"></a>
## ADR-034 — Un exercice échoué ne revient qu'après un progrès démontré 🔬

**Date.** 02/08/2026. **Produite par une session Claude, non tranchée à
l'usage.** Née d'un irritant remonté par Maxime :

> « En suivant le système de "prochaine action", je me retrouve à refaire tous
> les exos ratés, et qui ne sont pas de mon niveau réel sinon je les aurais
> traité. Si j'y arrive pas une fois je vois pas pourquoi 3 jours après je
> saurais davantage le faire. »

### Le problème avait deux couches, et la première était un défaut

**Couche 1 — un défaut de typage, pas une décision.** `exercises.difficulte`
était déclarée `TEXT` (ADR-012 : schéma écrit à la main) et `ligneVersEntite` ne
coerce rien. Un exercice relu depuis la base portait donc `"1"`, et
`calibration.ts` faisait :

```ts
borner(exploitable.difficulte + AJUSTEMENT[exploitable.signal])
```

`"1" + 0` vaut `"10"` → borné à **5**. `"1" + (-1)` vaut `"1-1"` → **`NaN`**.

Mesuré en production le 02/08 : DEV-03 et DEV-04 conseillaient une difficulté
**5** sur la foi d'un `partiel` obtenu sur un exercice de difficulté **1**. Cette
valeur alimentait `difficulteCible` *et* le bloc « CALIBRAGE DU PROCHAIN
EXERCICE » envoyé au tuteur, qui générait en conséquence. Le « pas de mon niveau
réel » était donc littéral.

Les 239 tests d'alors ne pouvaient pas le voir : `calibration.test.ts` passe des
`Difficulte` déjà typées, jamais une valeur venue de la dorsale. **Leçon :
`lib/engine/` est pur et testé, mais il consomme des entités que personne ne
valide à la frontière.** C'est un angle mort d'ADR-001 — la pureté du moteur ne
garantit rien sur ce qu'on lui donne à manger.

**Couche 2 — l'inventaire.** Relevé le même jour : 27 exercices (6 en base,
21 diagnostics livrés) pour **54 compétences actives, dont 40 sans aucun
exercice**. `choisirExercice` n'excluait que les exercices **réussis** : un
échec redevenait candidat au tour suivant, à l'identique, indéfiniment. Le
moteur n'avait rien d'autre à servir.

### Décision

Deux règles dans `choisirExercice`, et un repli.

**1. Exclusion dure.** Un exercice dont la dernière tentative **terminée** est un
`echec` ne redevient candidat qu'après un **progrès démontré** sur sa compétence
cible : une preuve en `reussi` postérieure à cet échec.

C'est une **condition, pas un délai**. Un refroidissement temporel reproposerait
au bout de N jours un exercice hors de portée, sans que rien n'ait changé
entre-temps — exactement l'objection de Maxime. C'est **P4 lu dans l'autre
sens** : une faiblesse ne disparaît pas sans démonstration, et elle ne se
remesure pas non plus sans qu'il y ait quelque chose de nouveau à mesurer.

**2. Classement souple.** À écart de difficulté égal, un exercice **jamais
tenté** passe devant un exercice déjà tenté. Un `partiel` reste candidat — c'est
un progrès, pas un mur — il descend simplement dans la file.

**3. Repli.** Plus aucun candidat ⇒ `exercice: null`, et la carte propose de
demander un exercice au tuteur, avec la difficulté conseillée et la dimension
faible **déjà dans l'amorce** (`lib/tutor/amorces.ts`). Mieux vaut aucun
exercice qu'un exercice qui ne mesure rien.

**Et le garde-fou de typage.** La colonne passe en `INTEGER` avec
`CHECK BETWEEN 1 AND 5` (`supabase/migration-exercices.sql`). Mais le moteur ne
s'en remet pas à la dorsale : `calibrer` convertit explicitement et, sur une
valeur non finie, ne conseille **rien** — `difficulteConseillee: null` + une
réserve. Fabriquer un nombre à partir d'une entrée illisible est ce que **P2**
interdit.

### Ce que ça ne fait pas

Ça ne crée pas d'exercices. Les 40 compétences découvertes le restent tant que
le tuteur n'en produit pas — d'où la génération par lot livrée le même jour.
Cette ADR empêche seulement le système de **prétendre** avoir quelque chose à
proposer.

### 🔬 Test de réfutation

Deux observations sont nécessaires, et aucune n'a eu lieu :

1. **Échouer un exercice, puis en réussir un autre sur la même compétence.**
   Le premier doit redevenir candidat au tour suivant, et pas avant. Si un
   utilisateur se retrouve durablement sans rien à faire sur une compétence
   qu'il travaille, la condition est trop stricte et le repli vers le tuteur
   n'est pas une réponse suffisante.
2. **Vérifier que le sentiment de progression revient.** C'est le vrai critère,
   et il est subjectif. Si la file cesse de tourner en rond mais paraît
   maintenant vide, le problème a seulement changé de forme.

Le test unitaire correspondant existe (`moteur.test.ts`, describe « choix de
l'exercice ») ; il garantit la mécanique, pas la pertinence.

---

<a name="adr-035"></a>
## ADR-035 — Cycle de vie d'un exercice : le calque d'ADR-027 🔬

**Date.** 02/08/2026. **Produite par une session Claude, non tranchée à
l'usage.** Corollaire d'[ADR-027](#adr-027). Née d'un irritant remonté par
Maxime : « Que devient un exercice maîtrisé ? Un exercice trop dur ? Ça reste
dans le système en prenant de la place. »

**Problème.** `Exercise` ne portait **aucun statut**. Un exercice réussi
disparaissait de la recommandation mais restait dans la liste ; aucune action ne
permettait de retirer un exercice manifestement hors niveau. La bibliothèque ne
faisait qu'enfler, et ce qui était fait encombrait ce qui restait à faire.

**Décision.** La règle est le **calque exact** de celle du référentiel, jusqu'au
nom du type (`ModeRetrait` est importé, pas redéfini — deux vocabulaires pour
une même règle finiraient par diverger) :

| État | Geste | Effet |
|---|---|---|
| 0 tentative | `DELETE` franc | L'énoncé disparaît. Rien ne le cite. |
| ≥ 1 tentative | Archivage (`archive = true`) | Sort de la recommandation et de la calibration. Les preuves restent. |

`supprimerExercice` **refuse** quand des tentatives existent, plutôt que de se
replier en silence sur l'archivage — même raison qu'ADR-027.

**Une différence assumée avec la calibration.** `compterTentatives` compte
**tous** les statuts, abandons compris, là où `calibration.ts` les écarte. Les
deux modules ne posent pas la même question : la calibration demande « qu'a-t-on
mesuré ? » (un abandon ne mesure rien), le retrait demande « reste-t-il une
trace ? ». Une tentative abandonnée figure au journal et cite l'exercice par son
titre ; l'effacer laisserait une entrée qui ne résout plus.

**Les diagnostics ne se retirent pas** (`estRetirable`). Ils sont livrés avec le
logiciel, pas propriété du compte. Les sortir du flux passe par le périmètre de
la compétence (`competences.active`).

**Regroupement, pas filtrage.** La liste se regroupe par domaine, avec un repli
« Acquis » et un repli « Archivés ». Aucun filtre n'est réintroduit : le
commentaire d'`exercices/page.tsx` documente pourquoi cinq familles ont été
retirées — « ~5 000 combinaisons pour une bibliothèque qui en compte une
poignée ». Avec 27 exercices, en remettre serait refaire l'erreur.

### 🔬 Test de réfutation

**Aucun exercice n'a encore été archivé ni supprimé.** À vérifier :

1. Archiver un exercice portant des tentatives ⇒ ses preuves restent lisibles au
   journal, et il sort bien de `exercicesActifs`.
2. `supprimerExercice` sur ce même exercice ⇒ **refus explicite**, pas un
   archivage silencieux.
3. **Le vrai risque est l'usage, pas la mécanique** : si personne n'archive
   jamais rien, le repli « Acquis » suffisait et ces trois Server Functions sont
   de la complexité gratuite. À rouvrir si le compteur d'archivés reste à zéro
   dans un mois.

---

<a name="adr-036"></a>
## ADR-036 — Le tuteur voit le corpus, jamais les énoncés 🔬

**Date.** 02/08/2026. **Produite par une session Claude, non tranchée à
l'usage.** Née d'un irritant remonté par Maxime : « il n'a pas le contexte des
exercices existants et ne sait pas ce sur quoi on travaille en temps réel, donc
il ne peut pas trop nous aider au final. »

**Le constat.** `lib/tutor/contexte.ts` n'ouvrait **ni `ctx.donnees.exercises`
ni `ctx.donnees.attempts`**, alors que les deux étaient dans `Contexte` depuis
toujours. Conséquences mesurées :

- Le tuteur a produit **deux exercices quasi identiques sur LOG-10** — « Analyser
  un schéma de flux logistique pour identifier un goulot » et « Identification
  des goulots d'étranglement dans un flux logistique de production de vélos » —
  sans pouvoir le soupçonner.
- L'exercice ouvert était **totalement absent**. Le lien depuis une fiche
  d'exercice était un `<Link href="/tuteur">` sans paramètre : demander de
  l'aide obligeait à recoller l'énoncé à la main.

**Décision.** Deux blocs entrent dans `systemeProfil` (bloc variable, jamais le
préfixe mis en cache), avec une asymétrie délibérée :

| Bloc | Ce qui part | Ce qui ne part pas |
|---|---|---|
| **Corpus existant** | Titres, compétences, difficulté, durée, état d'usage | **Les énoncés** |
| **Exercice en cours** | Énoncé complet, indices consultés, brouillon de réponse | **La correction** |

**Pourquoi pas les énoncés du corpus.** Le critère de choix du moteur du tuteur
est la **taille du contexte**, pas le prix. Une trentaine de titres coûte
quelques centaines de jetons ; une trentaine d'énoncés complets en coûterait des
dizaines de milliers, **à chaque message**. Le bloc a un seul objet — ne plus
produire de doublon — et les titres y suffisent. Plafonné à 60 lignes, et une
troncature est **annoncée** : une liste tronquée en silence se lirait comme un
corpus complet (**P3**).

**Pourquoi l'énoncé de l'exercice ouvert, lui, se justifie.** C'est l'objet même
de la conversation. Le brouillon part avec, et les indices déjà consultés aussi —
avec la consigne de ne pas donner un indice plus explicite que ceux restés
fermés : l'autonomie observée est ce qui fonde la preuve.

**La correction ne part jamais.** Le tuteur la recopierait sur demande, et la
preuve produite ne vaudrait plus rien. Un test le vérifie.

### 🔬 Test de réfutation

1. **Le doublon doit disparaître.** Demander un exercice sur une compétence qui
   en a déjà un, et vérifier que le tuteur le cite plutôt que de le refaire.
   Si les doublons persistent, la consigne « NE PROPOSE PAS » est trop faible et
   il faudra valider côté application, pas côté prompt.
2. **Le budget doit tenir.** Le manifeste du chat affiche le poids de chaque
   bloc. À surveiller quand le corpus passera de 27 à 200 exercices : le plafond
   de 60 lignes est posé sans donnée, c'est un chiffre rond, pas une mesure.
3. **Ouvrir un exercice, cliquer « Demander de l'aide »**, et vérifier que le
   tuteur cite l'énoncé sans qu'on le lui colle — et qu'il ne livre pas la
   correction quand on la lui demande.

---

## ADR-037 — Le tuteur écrit le contenu, jamais la mesure ✅

**Date.** 03/08/2026, arbitrage rendu par une personne. Livré le 04/08/2026.

**Le problème.** Le produit s'était construit chantier par chantier depuis le
27/07 : chacun avait ajouté sa surface, aucun n'avait retiré celle du précédent.
Mesure d'entrée : **11 écrans** dans le groupe `(app)`, **~180 actions
interactives**, **6 points de départ** pour « générer un exercice » en 3 formes
de lien incompatibles — pour **5 exercices en base** et **51 compétences
actives dont 4 couvertes**.

Deux défauts nommés :

1. **La téléportation vers `/tuteur`.** Vouloir un exercice déracinait
   l'utilisateur de sa page. Coût mesuré dans le code : 3 navigations, 2 gestes
   de chargement explicites, ~9 clics, 3 formulaires.
2. **La fragmentation.** 11 écrans, dont un (`/competences/referentiel`) absent
   de la navigation et atteignable par 4 liens dispersés.

**La reformulation de P5.** De « le tuteur n'a aucun accès en écriture » à **« le
tuteur n'écrit aucune mesure »**. La ligne de partage :

- un **exercice** n'affirme rien sur la personne → le tuteur l'écrit directement ;
- une **preuve**, un **niveau** → jamais ; ils restent des propositions à valider ;
- une **compétence** est l'unité de mesure : sa validation humaine reste, mais
  elle tient dans une modale, plus dans un détour par le chat.

P5 devient **plus précis, pas plus laxiste** : la reformulation nomme ce que la
garantie protégeait réellement. **ADR-004** s'élargit d'autant — le contenu vient
du tuteur, qui l'écrit désormais lui-même.

**Ce qui est livré.** Génération d'exercices sans conversation
(`lib/tutor/generation.ts` + `/api/exercices/generer`), modale de compétence in
situ adossée à `ValidationBranche`, tuteur en tiroir latéral, navigation à 3
pôles, `/competences` absorbant gestion, progression et journal.

**Refusés explicitement, pour qu'ils ne soient pas reproposés par oubli** 🗑️ :

- Le niveau **`Sujet`** entre domaine et compétence. Il n'existe pas : le schéma
  a `domaines` et `competences`. Ce qu'on prend pour un 3ᵉ niveau est `palier` —
  un attribut, pas un conteneur. L'inventer serait construire par anticipation,
  ce qui a déjà produit 6 entités mortes supprimées le 28/07.
- Le champ **`Code`** dans la modale de compétence. Le code est attribué par
  l'application depuis le préfixe du domaine, et c'est la clé étrangère des
  preuves (ADR-026). Depuis ADR-031 le schéma de l'outil n'a plus de champ
  `code` : l'interdit est devenu inexprimable. Ne pas le réintroduire « pour la
  commodité ».
- Le **sélecteur de difficulté** dans la modale de génération. `calibrer()` la
  dérive des tentatives observées (ADR-028) ; laisser choisir jetterait le 3ᵉ
  maillon. Elle est dérivée et affichée avec son « Pourquoi ? » (**P3**), jamais
  saisie.

**Ce que le chantier a exhibé au passage.** Deux lignes de travail ont
implémenté le même lot 2 en parallèle, et leur fusion a produit un doublon de
`modifierDomaine` qu'aucun test ne pouvait voir — le fichier ne compilait plus,
c'est `tsc` qui l'a arrêté. Une des deux implémentations enregistrait `origine:
"utilisateur"` sur une branche entièrement rédigée par le tuteur : `origine` est
un **fait observé, jamais dérivé**, et une prop à valeur par défaut la
falsifiait en silence. Elle a été écartée pour cette raison.

---

## ADR-038 — Le retrait de la preuve manuelle ✅

**Date.** 04/08/2026, décision de Maxime, **hors du plan du chantier** et
postérieure à lui : le formulaire de preuve manuelle n'était pas utilisé.

**Ce qui est retiré.** L'outil `proposer_preuve` du tuteur, l'extraction
`extrairePropositions`, `components/competences/formulaire-preuve.tsx` (385
lignes), `enregistrerPreuveManuelle` dans `lib/store/actions.ts`, la carte
« Proposition » du chat, et les tests correspondants.

**Ce qui reste.** Un seul chemin d'écriture d'une preuve : le **bilan
d'exercice**, `terminerExercice`. La garantie centrale ne bouge pas — une preuve
naît toujours d'un geste de l'utilisateur, jamais du tuteur.

**Pourquoi c'est tenable.** L'objection évidente est que 40 des 54 compétences
actives n'avaient aucun exercice, donc plus aucun moyen d'être mesurées. C'est le
lot 1 qui y répond : la génération à la demande produit un exercice sur
n'importe quelle compétence du périmètre, en une modale, sans changer de page.
La preuve manuelle était le contournement d'une pénurie d'exercices que le
chantier vient de lever.

**Ce que cela coûte, écrit franchement.** ADR-033 avait fermé **P8** en posant la
question de l'aide extérieure dans le formulaire manuel, d'où le moteur dérivait
`autonomieObservee`. Ce formulaire n'existe plus, et **le bilan d'exercice ne
pose pas la question** — la réserve était déjà écrite dans `PRODUCT.md` §5.
**P8 repasse donc de ✅ à 🔬** : l'autonomie continue d'être dérivée pour les
preuves issues d'un bilan, mais le protocole n'a plus de chemin où la personne
déclare de quelle aide elle a disposé.

### 🔬 Test de réfutation

1. **Compter les preuves après un mois d'usage.** Si le volume de preuves chute
   par rapport à juillet, le formulaire manuel servait plus que ce que l'usage
   laissait croire, et il faudra un chemin de remplacement.
2. **Vérifier qu'aucune compétence ne reste non mesurable.** Prendre une
   compétence sans exercice, générer, terminer : la preuve doit exister. Si la
   génération échoue pour une famille de compétences, ADR-038 les a rendues
   muettes.
3. **Rouvrir P8.** Poser la question d'autonomie dans le bilan d'exercice est le
   candidat évident. Tant que ce n'est pas fait, le biais est borné mais réel.

### ⚠️ Correction factuelle — 07/08/2026

**Le paragraphe « Ce que cela coûte » ci-dessus est faux depuis le jour où il a
été écrit.** Le bilan d'exercice **pose** la question de l'aide extérieure :
`components/exercices/formulaire-bilan.tsx` affiche les quatre options (aucune,
documentation, assistant IA, correction obtenue), `soumettre` transmet
`aideExterne`, et `terminerExercice` en dérive `autonomieObservee`
(`lib/engine/preuve.ts`, `PLAFOND_AIDE`).

Vérifié : `aideExterne` est entré dans ce composant par le commit `5424f4d`
(04/08/2026, « Chantier du 02/08 au 04/08 ») — **le jour même d'ADR-038**. Les
deux gestes se sont croisés, et l'ADR a décrit un état que le code venait de
quitter. Le point 3 du test de réfutation était donc déjà fait au moment où il
a été écrit.

**Ce que cela ne tranche pas.** Le chemin existe, ce qui lève l'objection
d'ADR-038 ; mais le barème `PLAFOND_AIDE` n'a jamais été confronté à l'usage, et
les 29 preuves antérieures ne sont toujours pas retouchables faute de donnée.
**P8 reste donc 🔬** — le rendre ✅ est un arbitrage humain, pas une conclusion
de session (règle du §1 de `CLAUDE.md`).

---

## ADR-039 — Le « crash du tuteur » était une boucle infinie de rendu ✅

**Date.** 04/08/2026. Cinq frictions d'usage remontées par Maxime sur le tuteur ;
la première — « il crashe souvent, sans doute trop de contexte » — s'est révélée
sans rapport avec le contexte.

**Le fait.** `components/ui/markdown.tsx` ne terminait pas sur une ligne
commençant par `|` non suivie d'un séparateur de tableau. Le bloc tableau
n'acceptait cette ligne qu'accompagnée de son `|---|---|` ; la boucle paragraphe
la refusait catégoriquement. Personne ne la consommait, `i` n'avançait plus. Le
navigateur gelait, l'onglet mourait, tout le site avec.

Ce n'était pas un cas limite : **le flux SSE livre la ligne d'en-tête d'un
tableau avant son séparateur**. Tout tableau rédigé par le tuteur passait par cet
état au premier flush. Un `|x| < 3` en début de ligne suffisait aussi. Le
symptôme rapporté — « réponse coupée en plein milieu, puis plus rien ne
marche » — décrivait exactement cela.

**Ce qui a été fait.** Le découpage sort du JSX vers `lib/ui/markdown-blocs.ts`.
Motif : Vitest ne prend que `src/**/*.test.ts` en environnement node — la
fonction était **intestable là où elle vivait**, et c'est ce qui a permis au
défaut de survivre à 320 tests verts. Elle porte désormais un invariant
explicite : *chaque tour de boucle consomme au moins une ligne*. Une ligne que
personne ne reconnaît devient du texte. Un caractère mal rendu est un défaut
d'affichage ; un onglet figé est une perte de travail.

**La leçon, qui n'est pas nouvelle.** C'est le calque exact d'ADR-034 : le moteur
est pur et testé, et le défaut se loge dans ce qui n'est pas testable — une
colonne `TEXT` hier, un composant de rendu aujourd'hui. **Ce qui n'est pas
atteignable par un test finit par porter le défaut.**

### Les quatre autres frictions

| Friction | Cause | Correctif |
|---|---|---|
| Message perdu à la fermeture du tiroir | `publierReponse` fait un `setMessages` sur un composant démonté ; l'effet de persistance ne rejoue jamais | Écriture dans `sessionStorage` au démontage, **avant** l'`abort`, conditionnée à une génération en cours |
| Texte sélectionné invisible | `::selection` = `--primaire` / `--primaire-contraste`, soit exactement les deux couleurs de la bulle utilisateur | Règle `::selection` inversée sur `[data-fond="primaire"]` |
| Formules absentes des énoncés | `enonce` n'avait aucune `description` dans le schéma de `proposer_exercice` | Exigence d'auto-suffisance portée par le schéma — donc présente à chaque message, contrairement à une phrase de protocole chargée sur mots-clés |
| Réponses trop directes | §8 impose la gradation, mais le mode LÉGER et la consigne de concision tirent en sens inverse | Consigne de gradation dans le bloc `EXERCICE EN COURS`, qui n'existe que si un exercice est ouvert |

### Le contexte, dégraissé mais non refondu

Le contexte n'était pas la cause du crash, et il n'a donc pas été refait. Deux
corrections mesurées :

1. **`MOTS_CLES_REFERENTIEL` resserré.** `ajouter`, `apprendre`, `commencer`,
   `me lancer`, `travailler sur` y figuraient : « par où commencer cet exo ? »
   chargeait 6,8 Ko de charte de construction du référentiel, en pleine
   résolution, à chaque message. Ce sont des verbes du langage courant, pas des
   marqueurs d'intention.
2. **`exerciceId` allège le contexte.** Ce paramètre ne vient que de l'interface
   de résolution. `EXERCICES EXISTANTS` (jusqu'à 60 lignes, dont l'unique raison
   d'être est d'empêcher un doublon) et `PRIORITÉS CALCULÉES` n'y servent aucune
   réponse possible. Ils sont omis, et **le manifeste ne les annonce plus** —
   annoncer un bloc non transmis serait la fausse information que P2 et P3
   interdisent.

Ce qui reste sur ce chemin : profil, travail récent, calibrage, énoncé ouvert.

### 🔬 Ce qui n'est pas démontré

Le resserrement des mots-clés a un prix assumé : « j'aimerais travailler sur le
droit » ne charge plus la charte du référentiel. Le garde-fou restant est la
description de `proposer_referentiel`, qui porte les cinq conditions de
mesurabilité et part à chaque message. **À vérifier à l'usage** : si les branches
proposées sans la charte sont de moins bonne qualité, il faudra un déclencheur
plus fin qu'une liste de mots — pas une liste plus longue.

---

## ADR-040 — La réponse écrite est la condition du bilan ; l'abandon est un geste 🔬

**Date.** 07/08/2026, lot A0 du chantier d'intégration IA. Décision de Maxime,
prise en connaissance du chiffre ci-dessous.

**Le fait mesuré, avant d'écrire une ligne.** Sur 37 tentatives terminées,
**16 ne portent aucune réponse écrite** (43 %). Ce n'est donc pas une formalité
qu'on ajoute : c'est un changement de parcours réel, et il fallait le savoir
avant de le décider, pas après.

**La règle.** `terminerExercice` refuse une tentative dont `reponse` est vide
après `trim`, et la carte d'auto-évaluation ne s'affiche pas. `reponseSuffisante`
(`lib/domain/tentative.ts`) porte la règle, pure et testée.

**Pourquoi aucun seuil de longueur.** « 42 » est une réponse complète à un
exercice de calcul. Poser un minimum de caractères serait un seuil sans données,
que CLAUDE.md §8 interdit et qu'ADR-028 a appris à ne pas poser : un seuil calé
sur une intuition se déplace au premier désaccord. Le jour où l'usage montre
qu'on tape « . » pour passer, ce sera une **observation**, et le seuil pourra
être calé dessus.

**Pourquoi la condition porte sur la base et non sur l'écran.**
`zone-reponse.tsx` exige un clic « Enregistrer le brouillon » — choix délibéré,
non remis en cause. Du texte non enregistré n'existe pas pour le serveur, et le
tuteur ne le relirait pas. Conséquence : **le message d'erreur nomme le bouton**,
sinon il enverrait la personne regarder un champ qu'elle a déjà rempli.

**Le troisième chemin de clôture.** Il en existait deux, tous deux via
`terminerExercice` : la preuve écrite, et l'abandon *dérivé* d'une durée
dérisoire (ADR-030). Les deux exigent un bilan ouvert, donc désormais une
réponse. Une tentative qu'on ne veut pas mener n'aurait plus eu de sortie :
elle serait restée `en-cours` indéfiniment. D'où `abandonnerExercice`, qui
n'écrit **aucune preuve** et **aucun `resultat`** — lui prêter un « partiel »
par défaut fabriquerait la mesure qu'on refuse d'écrire. Sans danger pour la
calibration : `calibrer`, `recommend` et `usageExercice` filtrent tous
`statut === "terminee"`.

**Le refus a lieu avant toute écriture.** `terminerExercice` écrivait la
tentative puis lisait sa valeur de retour ; un refus placé après aurait laissé
une tentative close, avec sa durée et son auto-évaluation, sans preuve pour
l'expliquer. Une trace à moitié écrite est plus difficile à lire qu'une absence
de trace.

### ⚠️ Correction apportée à ADR-038 dans le même geste

Le paragraphe « Ce que cela coûte » d'ADR-038 affirme que le bilan d'exercice ne
pose pas la question de l'aide extérieure. **C'était faux le jour où ça a été
écrit** : le commit `5424f4d` (04/08) l'y avait introduite. Voir la correction
factuelle sous ADR-038. **P8 reste 🔬**, pour une autre raison — le barème
`PLAFOND_AIDE` n'a jamais été confronté à l'usage.

### 🔬 Test de réfutation

1. **Compter les abandons délibérés sur un mois.** S'ils dépassent les bilans
   remplis, la règle n'a pas produit des réponses écrites : elle a produit des
   sorties. Il faudrait alors un chemin intermédiaire (dicter, photographier un
   brouillon) plutôt que durcir davantage.
2. **Regarder la longueur des réponses.** Si la médiane s'effondre vers un ou
   deux caractères, la règle est contournée et le seuil devient justifiable —
   sur données.
3. **Vérifier qu'aucune tentative ne reste bloquée.** Les 3 tentatives
   `en-cours` sans réponse au 07/08 doivent avoir trouvé leur sortie.

---

## ADR-041 — Le tuteur voit la correction sur un seul chemin, et n'en écrit aucune mesure 🔬

**Date.** 07/08/2026, lot A1 du chantier d'intégration IA.

**Ce qui est décidé.** Le tuteur relit la réponse écrite et rend un verdict
complet — résultat global, une appréciation par critère, une justification par
critère. L'interface l'affiche **replié**, avec un bouton « Accepter et
enregistrer » et un « Relire / modifier » à un clic. Rien n'est écrit sans ce
clic.

### Ce que cela amende — ADR-036

ADR-036 pose que le tuteur voit le corpus par ses titres, ses compétences, sa
difficulté et son état d'usage, **jamais par ses énoncés et jamais par ses
corrections**. Ce lot y ouvre une exception nommée : sur le chemin de
correction, et sur lui seul, la correction de référence entre dans le prompt.

La raison est qu'il n'y a pas d'alternative honnête. Un tuteur qui corrige sans
la correction n'corrige pas : il improvise un barème. Et un barème improvisé qui
pré-remplit un formulaire qui écrit une preuve est exactement ce que ce système
existe pour empêcher.

**Les six verrous, tous portés par du code :**

| # | Verrou | Où |
|---|---|---|
| 1 | Prompt dédié, qui n'appelle jamais `construireContexte` | `lib/tutor/correction.ts` — le test `contexte.test.ts` « ne transmet JAMAIS la correction » reste vert et reste la garantie du chat |
| 2 | Route dédiée ; `/api/tutor` ne lit toujours pas `exercice.correction` | `api/exercices/corriger` |
| 3 | `outilCorrection` **n'entre pas** dans `outilsTuteur` — testé | `outils.ts` |
| 4 | Aucun historique : un seul message construit côté serveur | la route n'accepte pas de `messages` |
| 5 | La sortie ne peut pas contenir la correction : `JUSTIFICATION_MAX = 400` la borne, et le validateur rejette au-delà | `outils.ts` |
| 6 | Ne sert qu'une tentative **ouverte, du compte, avec une réponse écrite** | gardes de la route |

Le verrou 6 mérite un mot de plus. **Le corps de la requête ne porte qu'un
`attemptId`** — ni exercice, ni correction, ni réponse. Le serveur relit tout
sous RLS. Si le client envoyait un `exerciseId`, il obtiendrait la correction
d'un exercice qu'il ne possède pas : une fuite de contenu par un chemin
qu'ADR-036 croyait fermé.

### Pourquoi ce n'est pas `proposer_preuve` ressuscité

ADR-038 a retiré l'outil `proposer_preuve`. La distinction tient à ce que
`proposer_correction` **ne nomme pas** : ni compétence, ni autonomie, ni qualité,
ni niveau de preuve. Ces quatre-là restent dérivés par `autonomieObservee` et
`qualiteDepuisDifficulte`, à partir de faits observés — indices consultés, aide
déclarée, difficulté de l'exercice. L'outil ne porte que ce que la personne
aurait coché elle-même.

**Mais il faut le dire franchement : le tuteur recommence à *proposer* une
mesure, ce qu'il avait cessé de faire le 04/08.** P5 tient à la lettre — « le
tuteur écrit le contenu, jamais la mesure », et il n'écrit toujours rien. L'esprit,
lui, est élargi, et ce registre n'a pas à le masquer.

### Ce qui n'est pas proposé, et pourquoi

**L'aide extérieure et la durée restent hors du repli, saisies par la personne.**
L'aide est un fait que seul l'utilisateur connaît : le tuteur ne peut pas savoir
s'il avait un assistant ouvert à côté. La lui faire proposer fabriquerait la
donnée même qu'ADR-033 existe pour aller chercher.

### Refuser plutôt que tronquer

Une réponse de plus de `REPONSE_MAX_CARACTERES` (12 000) fait échouer la route
avec un message explicite. Un verdict rendu sur une réponse amputée aurait l'air
d'un verdict rendu sur le tout : « une liste tronquée en silence se lirait comme
un corpus complet » (ADR-036), c'est la même règle. Repère : la plus longue
réponse enregistrée à ce jour fait 1 183 caractères.

De même, une valeur d'appréciation illisible est **rejetée, jamais ramenée à 0**.
Un `0` est la mesure « non démontré » : le fabriquer produirait un jugement
négatif que personne n'a porté, indiscernable d'un vrai. C'est P2, et c'est le
motif d'ADR-034.

### ⚠️ Un risque que ce lot introduit, et qu'il ne corrige pas

`tentativeMenee` laisse toujours passer une **réussite**, quelle qu'en soit la
durée — « on ne réussit pas un exercice sans l'avoir fait » (ADR-030). Ce
raisonnement supposait une auto-évaluation humaine. Un verdict `reussi` proposé
par le tuteur sur une réponse mince, écrite en deux minutes sur trente estimées,
écrirait donc une preuve là où la personne aurait probablement abandonné.

Le seuil n'est **pas** déplacé : CLAUDE.md §8 interdit de bouger un seuil de
`calibration.ts` sans nouvelles observations. Le comportement est consigné ici
pour être surveillé. `verdictTentative` classera ces cas en « trop-facile » et
abaissera la difficulté conseillée — ce qui est la réaction voulue, mais ne
protège pas le journal de preuves.

### 🔬 Test de réfutation

1. **Soumettre une réponse volontairement fausse.** Le verdict proposé ne doit
   pas être `reussi`. S'il l'est, le dispositif corrompt la mesure à la source
   et doit être retiré avant d'aller plus loin.
2. **Compter les modifications sur les 5 premiers usages.** Si le verdict n'est
   **jamais** modifié, « Accepter » est un tampon : la personne ne relit pas, et
   la chaîne de preuves est alimentée par le modèle. C'est le risque central de
   ce lot, et il n'est pas technique.
3. **Comparer les niveaux avant / après sur un mois.** Une montée générale des
   niveaux sans montée du nombre de contextes distincts signalerait un
   correcteur complaisant.
4. **Vérifier qu'aucune justification ne recopie la correction.** Si le plafond
   de 400 caractères est régulièrement atteint, il est mal calé.

---

## ADR-042 — La maîtrise est un prédicat dérivé ; l'évolution est proposée, jamais appliquée 🔬

**Date.** 07/08/2026, lot B du chantier d'intégration IA.

**La question.** ADR-035 a demandé « que devient un exercice maîtrisé ? » et y a
répondu. Personne ne l'avait posée pour les **compétences**. Une compétence de
niveau 5 restait dans la file de recommandation indéfiniment, avec un intervalle
de révision seize fois plus long mais aucune sortie. Le produit savait dire « tu
progresses » et ne savait pas dire « tu sais ».

### Le prédicat

```
maitrisee ⟺ niveau !== null ∧ niveau >= 4 ∧ confiance ∈ {moyenne, forte}
```

**Aucune colonne, aucun stockage** (P1). Il se recalcule à chaque lecture, comme
le niveau dont il dépend : une preuve contradictoire écrite demain le retire
d'elle-même.

**Pourquoi 4 et non 5.** Le niveau 5 de `niveauSoutenu` exige
`competencesCombinees.length >= 1`, que `terminerExercice` n'écrit que pour un
exercice visant plusieurs compétences. Mesuré le 07/08/2026 : **les 47 preuves
du compte l'ont à `null`** — 2 exercices multi-compétences existent, aucune
tentative terminée ne porte sur eux. **Le niveau 5 est donc inatteignable en
pratique**, et c'est un fait sur le système qui méritait d'être consigné
indépendamment de cet ADR. Poser la maîtrise à 5 aurait bâti une fonctionnalité
qui ne se déclenche jamais : l'erreur exacte des six entités mortes du 28/07.

Le niveau 4 est la définition protocolaire du transfert — deux réussites
autonomes A3+ avec `transfert ≥ 0,6` sur deux contextes distincts. `DEB-01` et
`RO-01` y sont aujourd'hui : le prédicat se déclenche sur des données réelles.

**Pourquoi il n'ajoute aucun seuil.** C'est son argument central au regard de
CLAUDE.md §8. La clause de confiance absorbe gratuitement ce qu'il faudrait
sinon écrire à la main : une preuve contradictoire fait chuter l'échelon (P4),
une dernière preuve de plus de 120 jours aussi, un contexte unique ne peut
donner ni le niveau 4 ni une confiance moyenne, et une régression confirmée a
déjà abaissé le niveau en amont.

### Les trois évolutions, et ce que chacune écrit

| Évolution | Écriture | Note |
|---|---|---|
| **successeur** | `creerBranche` — rattachement par **nom**, code par `attribuerCodes` | La compétence maîtrisée devient un **prérequis** du successeur : un fait du référentiel, pas une note. `SoumissionBranche` gagne `prerequis` ; la colonne `TEXT[]` existe déjà |
| **élargissement** | **rien au référentiel** | Un « contexte » n'est pas un objet de base : `SkillEvidence.contexte` est le *titre de l'exercice*. Se résout en un exercice généré sur la **même** compétence, avec ce contexte pour thème |
| **retrait** | `archiverCompetence` (ou `supprimerCompetence`), mode **dérivé** | Une compétence maîtrisée porte ≥ 2 preuves par construction : ce sera **toujours** un archivage. L'écran le dit avec le compte, avant le clic (ADR-027), et propose à côté le geste doux et réversible — sortir du périmètre |

### Ce que ce lot ne fait pas

**Il ne touche pas `recommend.ts`.** L'arbitrage de l'utilisateur *est* le
mécanisme qui sort la compétence de la file ; y ajouter un facteur de score le
préempterait, sur zéro donnée. Et `estDue` la tient déjà silencieuse 8 à 16 fois
plus longtemps (`spaced.ts`).

🔬 **Déclencheur pour rouvrir** : si une compétence maîtrisée reste en tête de la
file une semaine **après** son arbitrage, un facteur négatif — à l'image du −15
« Pratiquée récemment » — devient justifié.

### 🗑️ Explicitement refusé, pour qu'on ne le repropose pas

- une table ou une colonne `contextes` — un contexte est le titre d'un exercice ;
- une colonne `maitrisee` ou `niveau` en base — P1, tout est dérivé ;
- un niveau `Sujet` entre domaine et compétence — déjà refusé par ADR-037 ;
- une carte de maîtrise sur le tableau de bord — une quatrième carte y serait le
  défaut de surface qu'ADR-037 a nommé.

### 🔬 Test de réfutation

1. **Ouvrir `/competences/DEB-01`.** La carte doit être là, et son explication
   citer le niveau 4, la confiance moyenne et les deux contextes. Sur `DEV-03`
   (niveau bas), aucune carte, et `/api/competences/evolution` doit refuser.
2. **Regarder les trois évolutions proposées sur un mois.** Si le tuteur
   propose toujours « successeur », il ne lit pas les contextes : le référentiel
   enflera sans que rien ne soit remesuré, et la réserve d'ADR-009 sur le
   sur-ajout redevient d'actualité.
3. **Vérifier qu'aucun successeur ne redouble une compétence voisine.** Les
   intitulés du domaine partent dans le prompt pour cette raison ; si des
   doublons apparaissent, le garde-fou ne suffit pas.
4. **Compter les compétences maîtrisées après un mois.** Si le nombre reste à
   deux, le seuil de niveau 4 est peut-être trop haut — ou le produit ne produit
   pas assez de contextes distincts, ce qui serait un fait plus intéressant.

---

## ADR-043 — Le tuteur désigne un code, il n'en frappe aucun ✅

**Date.** 07/08/2026, lot C du chantier d'intégration IA.

**Le problème.** CLAUDE.md §8 interdit de laisser le tuteur écrire un code de
compétence, et ADR-031 a rendu l'interdit *structurel* en retirant le champ
`code` du schéma de `proposer_referentiel`. Mais **réviser** un référentiel
existant exige de désigner les compétences à reformuler ou à retirer. Appliquer
l'interdit à la lettre rendrait la révision impossible ; l'assouplir sans le
penser rouvrirait la classe de bugs qu'il ferme.

**La distinction, à écrire noir sur blanc.**

> **Frapper un code** = produire un identifiant que l'application n'a pas
> attribué. Interdit : collision avec un code existant, preuves qui suivent la
> mauvaise compétence, **sans erreur visible**.
>
> **Désigner un code** = pointer l'un des identifiants que l'application a
> **déjà attribués** et qu'elle vient de remettre au modèle dans cette requête
> même. Ce n'est pas le même acte, et il ne porte aucun des risques du premier.

**Le design, en trois couches indépendantes.**

1. **L'`enum` est fermé et construit par le serveur**, à la requête, sur les
   codes vivants du **seul domaine révisé**. Une valeur hors de cet ensemble
   n'est pas découragée : elle n'est pas dans le schéma. Deux bornes gratuites
   au passage — une révision du domaine X ne peut pas renommer une compétence du
   domaine Y, et une compétence **archivée** ne peut être ni renommée ni
   re-retirée.
2. **`validerRevision` revérifie l'appartenance.** Un fournisseur qui ignore le
   schéma ne doit pas passer pour autant (ADR-031). Les codes connus sont tirés
   du **schéma lui-même**, pas d'une liste passée à part : deux listes pourraient
   diverger, une seule ne le peut pas.
3. **`appliquerRevision` revérifie à l'écriture**, et refuse tout code dont le
   domaine n'est pas celui révisé. Un bug du validateur ne peut donc pas toucher
   une compétence hors périmètre ; RLS interdit de toucher un autre compte.

**Et surtout : `ajouts` n'a aucun champ `code`.** L'interdit reste intact là où
il compte — la frappe. L'`enum` ne fait que pointer.

⚠️ **CLAUDE.md §8 est amendé** dans le même geste, pour qu'une session future ne
« simplifie » pas cet `enum` en `type: "string"` par commodité. Ce serait rendre
la frappe exprimable à nouveau, et le défaut serait invisible.

---

## ADR-044 — Un référentiel se révise ; le retrait reste dérivé 🔬

**Date.** 07/08/2026, lot C du chantier d'intégration IA.

**Ce qui manquait, dans les mots de Maxime.** « J'aime pas, il faut saisir à la
main, ça marche pas bien. Sur la page compétence, on n'a pas d'option pour
ajouter un référentiel. » Et sur une sous-page : « Ce référentiel ne couvre plus
mes besoins, change-le » — **comportement attendu : mise à jour.**

Deux manques distincts, donc, et le second est une capacité nouvelle :

1. `/competences` n'avait **aucun** point d'entrée pour une branche neuve :
   `+ Compétence` n'existe que sur la carte d'un domaine existant. Et
   `proposer_referentiel` rend **une** branche, là où « le stoïcisme » en demande
   plusieurs.
2. Le référentiel ne se **révisait** pas. On pouvait créer, éditer une ligne à la
   fois, retirer une ligne à la fois — pas reprendre une branche entière.

### Ce qui est décidé

`proposer_referentiel_complet` découpe un sujet en branches ; `proposer_revision`
reprend une branche existante (ajouts, reformulations, retraits). Sur la page
d'un domaine, **« + Compétence » devient « Réviser avec le tuteur »** — le
chemin manuel reste atteignable depuis la modale, donc **la surface ne grossit
pas d'un bouton**.

### ADR-027 appliquée à un chemin groupé

Le retrait reste **dérivé** : `scinderRetraits` (pure, testée, partagée avec
`retirerCompetences`) décide par les preuves de chaque code, jamais par celles
du lot. `appliquerRevision` ne contient **aucun `delete` direct**.

L'écran ajoute une sécurité au-dessus d'ADR-027, qui exige seulement d'annoncer :
**les retraits sont affichés en premier et décochés par défaut**. C'est le seul
geste qu'on ne peut pas défaire d'un clic — une compétence archivée ne revient
au périmètre qu'après avoir été désarchivée.

### La réserve sur la reformulation en masse

Renommer une compétence ne casse rien : le `code` est immuable, les preuves
suivent. Mais **le sens de l'historique est réécrit**. Une preuve enregistrée sur
« Sait reconstruire un argument » se lira désormais comme preuve de « Sait
critiquer un sophisme ». ADR-027 autorise déjà d'éditer un intitulé — mais **à
l'unité**. En masse, c'est un geste d'une autre nature.

Mitigation retenue : le **nombre de preuves** est affiché à côté de chaque
reformulation, et totalisé dans le pied de l'écran (P3). Pas d'interdiction :
l'information, et la décision à la personne.

### Pourquoi une branche écartée sur cinq est acceptable

Le reste du module refuse plutôt que d'accepter à moitié. Ici, une branche
invalide est **écartée** et les autres passent. La différence tient à ce qu'est
l'objet : les parties d'un exercice forment **un** objet — un demi-exercice n'en
est pas un. Cinq branches sont **cinq** unités, relues et cochées séparément.
Écarter la quatrième ne produit aucun objet à moitié.

La condition est que l'écart soit **annoncé** : une liste tronquée en silence se
lirait comme un corpus complet (ADR-036). D'où `ecartees`, affiché. Zéro branche
valide reste un rejet — il n'y a alors rien à relire.

### 🔬 Test de réfutation

1. **Après une révision, ouvrir le journal** et vérifier qu'aucune preuve n'a
   perdu son sens. Si des entrées deviennent illisibles, le compte de preuves
   affiché ne suffit pas et il faudra interdire la reformulation d'une
   compétence au-delà d'un certain nombre de preuves.
2. **Compter les retraits effectivement cochés.** S'ils sont systématiquement
   décochés puis jamais recochés, le tuteur propose des retraits que personne ne
   veut : la consigne du prompt est mal calée.
3. **Vérifier qu'aucune preuve n'est orpheline** après plusieurs révisions :
   ```sql
   select count(*) from evidence e
   where not exists (select 1 from competences c
                     where c.user_id = e.user_id and c.code = e.skill_code);
   ```
   Doit rester à 0. Trois couches protègent ce chiffre — la dérivation
   applicative, l'absence de `delete` direct, et la clé `evidence_competence_fk`,
   **vérifiée posée en production le 07/08/2026**.
4. **Regarder le nombre de branches proposées.** Si le tuteur en produit
   systématiquement six pour des sujets étroits, le référentiel enflera — c'est
   la situation du 28/07 (un grand référentiel sans contenu pour l'alimenter),
   et la consigne « une seule si le sujet est étroit » aura échoué.

---

## ADR-045 — La difficulté conseillée demande une confirmation ; la durée de référence est observée 🔬

**Date.** 09/08/2026, lot 3 du chantier de stabilisation.

**Ce qui manquait, dans les mots de Maxime.** « La durée attendue d'un exercice
pourrait être ajustée en fonction du niveau de l'utilisateur. » L'intuition
visait juste, la cause était ailleurs : le problème n'est pas que la durée
devrait s'adapter à la personne, c'est que **la durée est une donnée inventée
par un LLM, et que le moteur s'en sert comme d'un instrument de mesure calibré**.

### Le constat, chiffré

Sur les 46 tentatives réellement enregistrées au 09/08/2026 :

| Mesure | Valeur |
|---|---|
| Réussites sur exercices non diagnostiques | 10 |
| … classées `trop-facile` par la calibration | **7** |
| Durée réelle / durée estimée, sur les réussites | **0,48** en moyenne |

`FRACTION_TROP_FACILE = 0.6` avait été calé (ADR-028) sur quatre **diagnostics**,
dont la durée était rédigée à la main. Les exercices écrits par le tuteur portent
une durée que personne n'a confrontée au réel, et elle vaut environ le double du
temps effectivement passé. Le seuil restait bon ; ce qu'on lui donnait à mesurer
ne l'était pas.

S'y ajoutait un effet d'accumulation : `difficulteConseillee` ne lisait que **le
dernier verdict exploitable**. Trois réussites rapides d'affilée poussaient de 2
à 5, et cette valeur repartait dans le prompt de génération, où le tuteur a
consigne de s'y conformer (« Emploie la difficulté conseillée ; si tu t'en
écartes, c'est une erreur »). La boucle se renforçait elle-même.

### Ce qui est décidé

1. **La référence de durée devient le réel dès qu'il existe.** `dureeDeReference`
   rend la **médiane des durées constatées** sur l'exercice à partir de
   `OBSERVATIONS_DUREE_MINIMUM = 2` tentatives terminées, et retombe sinon sur
   l'estimation. La **source voyage avec la valeur** et s'affiche dans la phrase
   du verdict — « 14 min habituellement constatées (médiane de 3 tentatives) »
   plutôt que « 30 estimées » (P3).
   La médiane et non la moyenne : sur deux ou trois points, une séance
   interrompue à 2 minutes rendrait tout le reste « lent ».

2. **Bouger la difficulté demande une confirmation.** `SIGNAUX_CONCORDANTS = 2` :
   le verdict le plus récent commande le **sens**, mais il lui faut un second
   verdict du même signe dans la fenêtre des 3 retenus. Sans confirmation, la
   difficulté est **maintenue** — c'est un conseil, pas une abstention — et la
   réserve le dit.

3. **Les bornes de `difficulte` et `dureeEstimeeMin` ont une seule autorité**
   (`lib/domain/exercice.ts`), importée par le schéma de l'outil, la conversion
   et `creerExercice`. Elles étaient posées à trois endroits qui ne se parlaient
   pas : le schéma bornait la durée à 240, la conversion à 480, et l'écriture ne
   bornait rien. Ce qui entrait en base pouvait dépasser ce que le tuteur avait
   le droit de proposer.

### Ce qui n'est PAS décidé : `tentativeMenee` garde l'estimation

La règle des 25 % — celle qui décide si une preuve s'écrit (ADR-030) — continue
de lire `dureeEstimeeMin`, et ce n'est pas un oubli. Elle pose une autre
question (« la tentative a-t-elle eu lieu ? »), elle tranche le plus souvent au
**premier** passage, quand aucune observation n'existe encore, et **rien dans
les données ne la met en cause** : une seule réussite sous 25 %. La desserrer
sans motif serait exactement ce que ce registre reproche à l'ancienne règle.

### Ce que le rejeu montre — et ce qu'il ne montre pas

Les deux règles rejouées sur les 46 tentatives réelles :

| | Ancien | ADR-045 |
|---|---|---|
| Verdicts `trop-facile` / réussites | 7/10 | **7/10** |
| Compétences dont la difficulté conseillée baisse | — | **3** (LOG-07 4→3, LOG-09 5→4, RO-01 4→3) |

⚠️ **La référence observée ne change rien aujourd'hui**, et il faut le dire :
un seul exercice du corpus a été tenté deux fois. La médiane est donc **inerte**
— mécanisme correct, sans prise sur les données actuelles. C'est la règle de
concordance qui fait tout le travail visible.

Elle le fait avec discernement : DEB-01 et DEB-03 montent toujours d'un cran,
chacune sur **deux** réussites rapides indépendantes. Seuls les signaux isolés
sont retenus. C'est le comportement voulu — pas un amortissement uniforme.

Ce déséquilibre est la conséquence directe du déficit d'inventaire (66
compétences actives sur 77 sans aucun exercice) : on ne refait pas les exercices
parce qu'il n'y en a pas assez pour tourner. La médiane deviendra la référence
réelle quand le corpus le permettra.

### 🔬 Test de réfutation

1. **Rejouer le comptage dans un mois.** Si la part de `trop-facile` reste au-
   dessus de 50 % une fois que des exercices auront été tentés deux fois, c'est
   que le seuil de 0,6 est lui-même mal placé, et non sa référence.
2. **Surveiller les difficultés conseillées à 5.** Il n'en reste aucune. Si
   elles réapparaissent sans que deux verdicts concordants ne les justifient,
   la concordance est contournée quelque part.
3. **Vérifier qu'aucune difficulté ne se fige.** Le risque symétrique de cette
   ADR est l'immobilisme : une compétence dont la difficulté ne bouge plus
   jamais parce qu'aucun signal ne trouve son jumeau. Requête de contrôle —
   compter les compétences dont les 3 verdicts retenus sont exploitables,
   directionnels, et **discordants**. Si ce cas est fréquent, `TENTATIVES_RETENUES`
   est trop étroit pour que la concordance se produise.
4. **Comparer médiane et estimation par exercice**, une fois plusieurs exercices
   tentés deux fois. Si l'écart reste autour de 2×, la consigne donnée au tuteur
   sur la durée estimée est à revoir à la source — c'est là que la mesure devrait
   être juste, pas seulement corrigée en aval.

---

## ADR-046 — Le tuteur garde la mémoire de ses verdicts 🔬

**Date.** 09/08/2026, lot 4 du chantier de stabilisation.

**Ce qui manquait, dans les mots de Maxime.** « Le tuteur semble principalement
remplir des cases pour moi, alors que j'attends davantage d'un véritable
tuteur. » Suivi d'une liste — ce qui a été bien fait, ce qui pose problème,
pourquoi, les erreurs identifiées, les conseils — et d'une seconde demande :
« qu'il puisse détecter des patterns au fil du temps, plutôt que d'analyser
chaque exercice indépendamment. »

### Le diagnostic : il savait juger, pas se souvenir ni s'exprimer

Trois causes distinctes, dont aucune n'est un problème de prompt.

1. **Son format de sortie n'avait pas de place pour un retour.**
   `PropositionCorrection` valait `{ resultat, appreciations[] }`. Aucun champ
   global : ni « ce qui est acquis », ni « pourquoi c'est un problème », ni
   « quoi retravailler ». Il ne pouvait dire que « 0 / 0,5 / 1 » plus 400
   caractères par critère.

2. **Le seul retour détaillé qu'il produisait était jeté.** La `justification`
   par critère était affichée dans le formulaire de bilan — puis
   `terminerExercice` recevait `resultat`, `autoEvaluation`, `dureeMin`, `notes`,
   `aideExterne`, et rien d'autre. Le texte mourait avec la page.

3. **Son contexte était un instantané.** `lib/engine/historique.ts` existait,
   testé, et n'était **importé par aucun module du tuteur**.
   `competencesAmeliorees` était calculé et jamais transmis. Le signal
   historique le plus profond qui l'atteignait était la calibration : trois
   tentatives, réduites à une phrase.

Aucun prompt ne compense (2) et (3). L'ordre est contraint : élargir le format
sans persister ne sert à rien, historiser sans matière non plus.

### Ce qui est décidé

1. **Le verdict s'élargit.** `schemaCorrection` gagne un `bilan` **requis** :
   `points_forts`, `points_bloquants` (l'erreur *puis* ce qu'elle empêche),
   `a_retravailler`. Un verdict sans lui est rejeté — sinon le tuteur retombe
   dans la grille de cases que ce lot lui retire.

2. **Le verdict se conserve.** `attempts.verdict_tuteur` (JSONB,
   `supabase/migration-verdict.sql`, additive et idempotente). On archive aussi
   ce que le tuteur **proposait** comme résultat et appréciations, à côté de ce
   que la personne a validé : l'écart entre les deux dit si quelqu'un se
   surestime, et c'est une observation qu'on ne pouvait pas faire.

3. **Le temps entre dans le contexte.** Un bloc `TRAJECTOIRE` porte, par
   compétence, la suite des tentatives, les points relevés lors des corrections
   précédentes, les paliers franchis, et le nombre de compétences améliorées
   sur 30 jours. Il rend `null` quand il n'y a pas encore d'histoire — un bloc
   vide se lirait comme « aucun motif », qui est une affirmation.

4. **Le déclaré se confronte à l'observé.** Les deux étaient déjà dans le
   prompt ; il manquait la consigne de les comparer. Elle demande de nommer
   l'écart **une fois**, en citant les deux côtés.

### Pourquoi `JUSTIFICATION_MAX` ne bouge pas, et pourquoi le bilan est plus large

ADR-041 décrit les 400 caractères comme une **borne de confinement**. Elle est
maintenue, parce que la justification est attachée à **une case que
l'utilisateur doit cocher** : longue, elle devient la correction réécrite, on la
lit, on se dit « oui c'est ça », et on tamponne. La mesure est corrompue à
l'entrée de la chaîne.

Le bilan rédigé ne porte **aucune mesure**. Il n'est attaché à aucun critère,
n'entre dans aucune preuve, ne pré-remplit rien, et s'affiche **après** les
critères. D'où `FEEDBACK_MAX = 900` et `RETRAVAILLER_MAX = 180` : borner court
reviendrait à refuser la demande plutôt qu'à la sécuriser.

### ⚠️ La frontière réelle, et où elle est tenue

Le risque n'est pas la longueur : c'est que ce texte **revienne dans le chat**,
où la correction n'a jamais le droit d'entrer (ADR-036). Un bilan persisté puis
resérialisé dans `construireContexte` serait exactement le tunnel qu'ADR-041
bornait.

Règle retenue : **seul `aRetravailler` franchit la frontière.** Ce sont des
points courts, demandés sous une forme qui parle de la personne — « confond
médiane et moyenne » — et non de la solution. `pointsForts` et
`pointsBloquants` sont persistés, relisibles sur la fiche de l'exercice, et ne
sortent jamais de là. Un test l'épingle avec quatre témoins textuels.

**Ne pas « compléter » le bloc TRAJECTOIRE avec la prose** pour rendre le
tuteur plus loquace. C'est la seule manière de rouvrir l'exception, et elle
serait invisible : le tuteur paraîtrait simplement mieux informé.

### L'archivage ne bloque jamais l'écriture d'une preuve

`archiverVerdict` est appelée **après** la preuve et le journal, et son échec
est journalisé puis avalé. Deux raisons, la seconde étant la vraie : la colonne
peut ne pas encore exister (migration manuelle), et surtout **un conseil perdu
ne doit pas empêcher l'écriture d'une mesure**. Les lier ferait dépendre la
preuve d'un texte, ce qui est l'inverse de tout ce que le moteur défend.

### 🔬 Test de réfutation

1. **Lire trois verdicts consécutifs.** Si `points_bloquants` paraphrase la
   correction au lieu de nommer l'incompréhension, la consigne du prompt a
   échoué et la borne ne suffit pas : il faudra contraindre la forme, pas la
   longueur.
2. **Vérifier qu'aucun motif n'est affirmé sur une seule occurrence.** La
   consigne exige deux dates. Si le tuteur écrit « tu confonds régulièrement… »
   après un seul relevé, il hallucine un motif — le défaut le plus coûteux que
   ce lot puisse produire, parce qu'il est crédible.
3. **Surveiller `caracteresTotal`.** La trajectoire est plafonnée à 8
   compétences et 5 tentatives chacune. Si le contexte franchit durablement la
   fenêtre des moteurs gratuits, ce sont ces deux bornes qui bougent, pas le
   principe.
4. **Comparer `verdict_tuteur.resultat` et `attempts.resultat` sur 20
   tentatives.** Un écart systématique dans un sens est une mesure de la
   calibration de l'auto-évaluation — et personne ne l'a jamais regardée :
   ```sql
   select a.resultat as valide, a.verdict_tuteur->>'resultat' as propose, count(*)
   from attempts a where a.verdict_tuteur is not null group by 1, 2;
   ```
5. **Vérifier que la prose ne fuit pas.** Le test automatique couvre le chemin
   nominal ; relire le contexte réel via « Copier le contexte » après quelques
   exercices corrigés, et y chercher un fragment de correction.

---

## ADR-047 — Un exercice se corrige ; les preuves qu'il a produites ne bougent pas 🔬

**Date.** 09/08/2026, lot 6 du chantier de stabilisation.

**Ce qui manquait, dans les mots de Maxime.** « L'utilisateur ne peut pas
suggérer de modification ou signaler facilement un problème sur un exercice. »

### Le besoin, dépouillé de la solution

Un « signalement » suppose un **destinataire**. Il n'y en a pas : la personne
est seule avec son corpus. Retirer la solution de la demande laisse un besoin
plus simple — **corriger**.

Et il était impossible. `creerExercice` était la seule écriture ; il n'existait
ni `modifierExercice`, ni écran d'édition. Un énoncé ambigu, une correction
fausse, une durée absurde n'avaient qu'une issue : l'archivage. C'est-à-dire
jeter le seul contenu disponible pour une compétence qui, dans la situation
mesurée (11 compétences actives sur 77 disposant d'un exercice), n'en a le plus
souvent aucun autre. **On jetait au lieu de réparer**, sur un corpus produit par
un LLM que personne ne relit avant usage.

### Ce qui est décidé

`modifierExercice` change le **contenu** : titre, type, difficulté, durée,
énoncé, indices, correction, critères. Elle passe par `exerciceDuCompte`, la
même porte que le retrait — un diagnostic est livré avec le logiciel et n'est
pas modifiable.

**Ne se modifient pas :**

- **`id`** — c'est ce que les preuves et le journal citent (`source.ref`).
- **`origine`** (ADR-004) — qu'un énoncé ait été rédigé par le tuteur ne cesse
  pas d'être vrai parce qu'on en corrige une phrase. Le champ dit d'où vient
  l'exercice, pas qui l'a retouché en dernier.
- **`competences`** — les changer ferait pointer les preuves passées vers une
  autre compétence que celle qu'elles ont mesurée. C'est un autre exercice.
- **`diagnostic`**, **`archive`** — hors compte pour le premier, gestes propres
  pour le second.

### La validation a une seule autorité

`motifRefusExercice` (pur, testé, `lib/domain/exercice.ts`) est partagée par
`creerExercice` **et** `modifierExercice`, et rejouée par l'écran pour dire tout
de suite ce qui cloche. Deux copies auraient fini par diverger, et la divergence
aurait été invisible : **on aurait pu faire entrer par l'édition ce que la
création refuse**. C'est la forme exacte du défaut qu'ADR-044 a corrigé pour les
retraits, et que l'audit a retrouvée sur `basculerActives`.

### Ce que l'édition ne répare pas, et pourquoi c'est voulu

**Les preuves déjà écrites.** Elles mesurent une tentative sur l'énoncé
**d'alors**. Corriger le texte ne les rend ni plus ni moins justes ; les
retoucher serait réécrire l'histoire (P4, anti-hallucination §6).

Mais l'exercice affiché devient alors différent de celui qui a été fait, et le
journal paraîtrait cohérent alors qu'il ne l'est plus. D'où `exercises.modifie_le`
(`supabase/migration-exercice-edition.sql`) et l'étiquette « Contenu corrigé
le … » sur la fiche. L'écran annonce en outre le nombre de tentatives déjà
portées **avant** le clic — comme le retrait annonce son mode avant de
s'exécuter (ADR-027).

### 🔬 Test de réfutation

1. **Compter les exercices corrigés au bout d'un mois.** Si le chiffre reste à
   zéro, le besoin était mal lu : le problème n'était pas de corriger mais
   autre chose — peut-être de savoir *qu'un* exercice est mauvais, ce qui est
   une question de détection, pas d'édition.
2. **Vérifier qu'aucune preuve ne devient illisible.** Requête de contrôle :
   les preuves dont `source.ref` pointe un exercice `modifie_le` postérieur à
   la date de la preuve. Si ces cas sont nombreux et que le journal en devient
   confus, il faudra archiver une copie de l'énoncé au moment de la preuve
   plutôt qu'une simple date.
3. **Surveiller les corrections massives de difficulté ou de durée.** Ce sont
   les deux nombres dont le moteur se sert comme d'une règle (ADR-045).
   Quelqu'un qui les ajuste pour obtenir la difficulté conseillée qu'il
   souhaite court-circuite la calibration — l'édition deviendrait un moyen de
   contourner la mesure, ce qui est l'inverse du but.

---

<a name="adr-048"></a>
## ADR-048 — La séance existait déjà : elle s'étend, elle ne se recrée pas ✅

**Date.** 10/08/2026, lot 1 du chantier de refonte. Tranchée par Maxime en
discussion préalable.

**Ce qui était demandé.** Un planificateur et un concepteur de séances au
tableau de bord, et un onglet d'historique qui permette de revoir, refaire et
analyser les séances passées.

### Le fait qui a décidé de la forme

`LearningSession` existe depuis l'origine et est écrite **automatiquement** à
chaque exercice terminé (`lib/store/actions.ts`, trois appels). Relevé en base
le 10/08/2026 : **46 séances, dont 45 auto-générées, chacune avec une seule
activité**.

Autrement dit, la séance n'était pas à créer — elle tournait depuis le début
sous une forme dégénérée. Une séance composée, c'est la même entité avec *N*
activités et un cycle de vie.

**Décision : quatre colonnes additives sur `sessions`** — `statut`,
`planifiee_pour`, `besoin_declare`, `blueprint` — et aucune table nouvelle.
L'alternative examinée, une table `seances` distincte, aurait coupé l'historique
en deux et laissé 45 lignes hors du nouvel onglet, pour un gain conceptuel nul :
les deux entités auraient dit la même chose.

### L'absence de statut a un sens, et un seul endroit le dit

Les 45 séances antérieures n'ont pas de `statut`. Elles ont été écrites au
moment où un exercice se terminait : elles sont donc terminées. `statutSeance`
(`lib/domain/seance.ts`) est le seul endroit qui interprète cette absence. Un
`seance.statut ?? "terminee"` recopié dans chaque écran aurait fini par diverger
— et la divergence aurait fait réapparaître 45 séances closes dans la file des
séances à faire.

On ne fabrique pas rétroactivement un statut que personne n'a posé (P2).

### Le double journal, et pourquoi il aurait été invisible

Les trois clôtures de tentative — preuve écrite, abandon dérivé, abandon
explicite — écrivent chacune une séance mono-exercice. Comportement d'origine,
et toujours correct **hors séance**. Dans une séance composée, la séance *est*
l'entrée de journal : laisser la clôture en écrire une seconde ferait compter
deux fois le même travail, au journal comme au bandeau d'activité.

Le défaut n'aurait levé aucune erreur : les deux lignes auraient été exactes
prises séparément. La règle vit donc dans une fonction pure unique,
`seanceEnCoursPour`, que les trois appelants interrogent — même discipline que
`tentativeMenee` (ADR-030) et `scinderRetraits` (ADR-044).

### Une séance planifiée n'est pas de l'activité

Corollaire découvert en écrivant le lot, et c'est le piège le plus sournois de
la planification : `calculerActivite` compte **une ligne de `sessions` par jour
actif**. Une séance prévue pour jeudi aurait rempli une case du bandeau
d'activité le jeudi, sans qu'une minute ait été travaillée.

C'est le 0 fabriqué à l'envers — une mesure là où il n'y a rien de mesuré — dans
l'écran même qui existe pour dire ce qui s'est réellement passé. `seanceALieu`
(pur, testé) filtre en tête de `calculerActivite`, d'`activiteSurFenetre` et du
journal. Une séance `en-cours` compte : la personne y travaille.

### Ce qui n'est pas stocké

L'avancement — qui est fait, qui reste. Il se dérive des tentatives
(`avancementSeance`), et sa borne temporelle est la règle : **seules les
tentatives ouvertes à partir du début de la séance comptent**. Sans elle, une
séance composée d'exercices déjà travaillés s'afficherait terminée avant d'avoir
commencé. C'est pour la même raison que `demarrerSeance` réécrit `date` au
démarrage réel.

### Réserve

🔬 Le rattachement est garanti par une fonction pure partagée et ses tests, pas
par un test qui relit `actions.ts`. Si un quatrième chemin de clôture apparaît
sans appeler `appartientAUneSeanceEnCours`, le double journal revient en
silence. Même exposition qu'ADR-030 avant que son test ne lie les deux chemins.

---

<a name="adr-049"></a>
## ADR-049 — Le CAF n'ajoute qu'une pièce : le modèle d'assemblage ✅

**Date.** 10/08/2026, lot 1 du chantier de refonte.

**Ce qui était demandé.** Utiliser le Conceptual Assessment Framework pour
assembler une séance de plusieurs exercices pertinents selon le profil de
compétences.

### Trois modèles sur quatre tournaient déjà

| Modèle CAF | Ce qui le porte ici | État |
|---|---|---|
| *Student model* | `SkillState` — niveau, confiance, robustesse, contextes testés | existait |
| *Evidence model* | `criteres`, `Dimension`, `engine/preuve.ts`, `maitrise.ts` | existait |
| *Task model* | `Exercise` — type, difficulté, compétences, durée | existait |
| *Assembly model* | — | **manquait** |

Le produit savait répondre à « quelle tâche maintenant » (`recommander`) et
n'avait jamais eu à répondre à « quelles tâches, combien, dans quel ordre ».
`lib/engine/caf.ts` est cette réponse, et rien d'autre.

### Il ne reclasse rien

`composerSeance` appelle `recommander` et parcourt son classement. Un second
classement aurait divergé du premier sans que rien ne le signale : le tableau de
bord et le compositeur auraient proposé deux « meilleures actions » différentes
le même jour. Même raison pour `recommandable` (l'éligibilité d'un exercice) et
`difficulteVisee` — cette dernière a été **exportée** plutôt que recopiée,
puisque l'assemblage doit annoncer une difficulté pour une compétence qui n'a
aucun exercice, donc aucune `Recommandation` d'où la lire.

Ce que caf ajoute tient en trois gestes : remplir *N* places, faire passer
devant ce que la personne a explicitement visé, et **nommer ce qui manque**.

### Le manquant est le produit principal

Au 10/08/2026, **11 compétences actives sur 77 ont un exercice**. Une séance de
quatre exercices est donc, dans le cas normal, une place tenue et trois à
rédiger. `manquants` n'est pas une liste d'erreurs : c'est la commande que
l'écran passe au tuteur, et c'est par là que le corpus se remplit.

**Une composition qui se rabattrait sur les compétences déjà couvertes pour
« faire une belle séance » reproduirait exactement le défaut rapporté à
l'usage** — « ça me repropose toujours les mêmes exercices » — et il serait
invisible, puisque la séance paraîtrait simplement mieux remplie. Un test le
verrouille : une compétence jamais évaluée sans exercice passe devant une
compétence travaillée qui en a un.

### Ce qu'il refuse de fabriquer

- **Une durée pour un exercice qui n'existe pas.** `dureeEstimeeTotaleMin` ne
  compte que les exercices retenus ; l'explication dit combien manquent et que
  leur durée est inconnue (P2).
- **Des places de remplissage.** Si le périmètre compte moins de compétences que
  demandé, la séance en contient moins, et l'explication le dit.
- **Un exercice inscrit deux fois.** Un énoncé qui vise plusieurs compétences
  tient une place ; les compétences qu'il couvre au passage n'en consomment pas.

### Réserve

🔬 Aucune séance CAF n'a encore été jouée. Le classement de `recommander` est
mesuré sur une seule action à la fois ; rien ne dit qu'il ordonne bien un
ensemble de quatre. **Test de réfutation :** si les séances composées se
révèlent systématiquement mono-domaine ou monotones en difficulté alors que la
portée demandée était transverse, l'assemblage a besoin d'une contrainte de
diversité que le classement seul ne porte pas.

---

<a name="adr-050"></a>
## ADR-050 — Le besoin déclaré est un fait stocké ; l'écart est dérivé ✅

**Date.** 10/08/2026, lot 1 du chantier de refonte.

**Ce qui était demandé, dans les mots de Maxime.** « Mesurer un besoin
utilisateur avant génération de séance. Le besoin court terme pourra être
mesuré au besoin plus long terme afin de juger de la pertinence des séances et
des biais utilisateur. »

### Où était le risque

Le mot « mesurer », appliqué à une personne, sans preuve. Un questionnaire noté
— motivation, énergie, priorité — agrégé en indicateur aurait produit un nombre
sur quelqu'un que rien n'étaye : la forme exacte de ce que P2 et P3 interdisent,
et que le produit refuse partout ailleurs.

### Ce qui est décidé

**Le besoin est stocké verbatim** : intention en clair, compétences visées,
temps déclaré disponible, date. C'est un **fait observé** — « le 10/08 à 9 h,
elle a écrit ceci » — au même titre qu'une tentative. Une intention n'est
dérivable de rien : c'est la seule raison pour laquelle elle a le droit
d'occuper une colonne (P1).

**L'écart est dérivé** (`ecartBesoinRealise`), recalculé à chaque lecture,
jamais écrit. Il rend les **deux valeurs côte à côte** — « 60 min déclarées,
34 min passées », « 1 compétence travaillée sur 2 visées, laissée de côté :
DEV-02 » — et s'arrête là.

**Il n'existe aucun score de biais.** « Tu surestimes ton temps » est une
conclusion sur quelqu'un ; elle demanderait une série, pas une séance. La
fonction porte cette limite dans ses `reserves` plutôt que de laisser le lecteur
la deviner, et un test vérifie qu'aucun constat ne contient de qualificatif de
ce genre.

### Le besoin doit commander, sinon il est décoratif

`codesImposes` passe devant le classement du moteur dans `composerSeance`. Sans
cela, on enregistrerait la déclaration et la séance composerait exactement ce
qu'elle aurait composé sans elle — l'écart mesuré n'aurait alors rien mesuré
d'autre que l'indifférence du moteur à la demande.

Un code visé sans exercice devient un **manquant**, pas un silence. Un code visé
hors du périmètre de la séance est écarté **et annoncé**.

### Amendement du 10/08/2026 — l'intention rédigée devient facultative

**Ce qui a été observé, à l'usage immédiat.** Maxime, en essayant le
compositeur : « le processus de conception de séances est plutôt lourd
(l'affichage des compétences en liste c'est trop de trucs à faire) ». Le
formulaire exigeait une phrase rédigée, un temps, **et une sélection dans une
liste de 77 cases à cocher**, avant même de voir une composition. Le besoin
déclaré coûtait plus cher que la séance qu'il préparait.

**Ce qui change.** `BesoinDeclare.intention` passe de requis à facultatif, et
la liste de cases est remplacée par un **thème** pré-sélectionné sur la
prochaine action (`themesSuggeres`, `lib/engine/caf.ts`). Composer une séance
demande désormais deux gestes : un thème, un temps.

**Ce qui ne change pas, et c'est l'essentiel.** Le besoin déclaré reste un fait
stocké et daté : `codesVises` (issus du thème), `tempsDisponibleMin` et
`declareLe` sont toujours écrits verbatim. `ecartBesoinRealise` **ne lit pas**
l'intention rédigée — il compare les codes et les temps — donc l'écart dérivé,
qui est la substance de cette ADR, fonctionne à l'identique sans elle. Toujours
aucun score de biais.

**Ce qui est perdu, et c'est assumé.** La part qualitative de la déclaration —
« pourquoi cette séance » en toutes lettres — ne sera en pratique renseignée que
rarement, puisqu'elle est repliée derrière un lien facultatif. Sélectionner un
thème est une intention *catégorielle*, pas une intention *raisonnée* : on
saura « elle visait DEV-02 », pas « avant l'examen de jeudi ». Le champ reste
disponible pour qui veut noter le pourquoi.

⚠️ **Ce qui reste interdit :** dériver une intention depuis le thème choisi
pour « remplir » le champ. Ce serait rédiger à la place de la personne une
déclaration qu'elle n'a pas faite — exactement ce que la première phrase de
cette ADR interdit au tuteur.

### Réserve

🔬 La comparaison court terme / long terme demandée n'est pas faite : elle exige
plusieurs séances déclarées, et il n'en existe aucune. Ce lot pose la matière —
des déclarations datées et des écarts dérivés — pas la lecture longitudinale.
**Test de réfutation :** si après une dizaine de séances déclarées les écarts ne
montrent aucun motif, le besoin déclaré est un formulaire de plus et doit être
retiré plutôt que gardé « au cas où ».

🔬 L'amendement ci-dessus rend cette réfutation **plus dure à trancher** :
sans phrase rédigée, un écart sans motif pourra vouloir dire « le besoin déclaré
ne sert à rien » ou « il manquait le contexte que la phrase portait ». Si le cas
se présente, réactiver le champ en obligatoire sur quelques séances avant de
conclure.

---

<a name="adr-051"></a>
## ADR-051 — Le moteur travaille sur `importance`, pas sur un objectif déclaré ❓

**Date.** 10/08/2026.

**Origine.** Relecture croisée d'une analyse externe (ChatGPT) sur l'état du
produit. La quasi-totalité du texte redécrivait l'existant ou proposait des
constructions par anticipation que CLAUDE.md §8 interdit déjà — sans intérêt
pour ce registre. Un point a résisté à l'examen : le profil porte
`objectifMoyenTerme` et `objectifLongTerme` en prose libre, mais aucun calcul
du moteur ne les lit. `recommend.ts` classe sur `importance` (un poids par
compétence, fixé au référentiel), pas sur ce que la personne a dit vouloir
faire de la compétence.

### Le problème, à distinguer de sa solution

« Apprendre Python », « développer une API », « réussir un entretien
technique » et « contribuer à un projet open source » peuvent partager
exactement le même référentiel de compétences et la même `importance` par
compétence — et pourtant demander un ordre de travail différent : un
entretien technique pousse vers la vitesse d'exécution et les cas classiques,
un projet open source pousse vers la lecture de code existant et l'intégration.
Le moteur ne peut aujourd'hui produire qu'un seul ordre, indifférent à
laquelle des deux intentions est la vraie raison de la personne.

C'est un trou réel, distinct du reste de l'analyse externe : il ne demande
aucune nouvelle entité massive, aucune taxonomie d'activités, aucun modèle de
stratégie pédagogique — juste la question de savoir si `importance` doit
rester la seule source de tri, ou si un objectif déclaré doit la pondérer.

### Pourquoi ❓ et pas 🔬 ni ✅

Ce n'est pas encore une hypothèse testable : personne n'a encore proposé *ce
que le moteur ferait différemment* si l'objectif était structuré plutôt que
laissé en prose. Sans mécanisme précis à réfuter, ce n'est qu'une question.

### Ce qui bloque

**a)** Le goulot mesuré au 10/08/2026 reste le corpus : 11 compétences actives
sur 77 ont un exercice ([PLAN_REFONTE_SEANCES.md §1](PLAN_REFONTE_SEANCES.md)).
Un objectif déclaré ne peut réordonner que ce qui existe à classer — tant que
66 compétences n'ont rien à servir, raffiner le tri ne change rien à l'écran.
**b)** Aucun signal ne dit si `objectifMoyenTerme` / `objectifLongTerme`, tels
qu'écrits aujourd'hui, portent assez de matière pour être exploités sans
fabriquer une structure que la personne n'a pas donnée (P1, P2).

### Qui doit trancher

Maxime, une fois le corpus rempli et les séances CAF jouées plusieurs fois
(ADR-049). Trancher maintenant reviendrait à choisir une structure
(`LearningGoal` ou équivalent) avant d'avoir observé un seul cas où
`importance` seule a produit un ordre insatisfaisant.

---

<a name="adr-052"></a>
## ADR-052 — Le moteur dérive sans validation ; seul le tuteur ne mesure jamais ✅

**Date.** 10/08/2026.

**Origine.** Discussion sur une proposition externe (ChatGPT) de gestion de
connaissances (« Obsidian intégré ») — non retenue comme chantier ici, mais
qui a fait remonter une confusion dans l'application d'ADR-037 : une première
lecture assimilait toute association automatique (ex. lier une note à une
compétence) à une mesure écrite par le tuteur, donc interdite. Maxime a
corrigé : « c'est le moteur qui doit décider surtout, pas l'utilisateur. Le
moteur c'est pas l'IA c'est le code. »

### Le problème, distinct de sa solution

ADR-037 dit « le tuteur écrit le contenu, jamais la mesure ». Mais **tuteur**
(le LLM, `lib/tutor/`) et **moteur** (le code déterministe, `lib/engine/`,
`lib/domain/`) ne portent pas la même contrainte. Le moteur dérive déjà, sans
validation utilisateur à chaque occurrence : `recommander()` choisit une
compétence sans qu'on la confirme, `difficulteConseillee` (ADR-028, ADR-045)
part dans le prompt du tuteur sans clic. Étendre par réflexe l'exigence de
validation d'ADR-037 au moteur aurait interdit ce que le produit fait déjà
partout, et aurait bloqué à tort toute dérivation automatique future (par
exemple, un futur lien entre un objet de connaissance et une compétence).

### Ce qui est décidé

**Interdit** (inchangé, ADR-037) : le tuteur (LLM) produit un jugement —
« ceci concerne la compétence X », un score, un niveau — et le système
l'écrit tel quel. Aucune traçabilité de calcul, une opinion de modèle de
langage habillée en mesure.

**Permis, sans validation systématique** : le moteur (fonction pure, testée,
`lib/engine/` ou `lib/domain/`) dérive une association ou une valeur par un
calcul explicite — correspondance de mots-clés, similarité déterministe,
classement. Le calcul est la source (P2), il est testable, et il peut
s'exécuter et s'écrire sans qu'un humain valide chaque occurrence — exactement
le régime déjà en vigueur pour `recommander()` et la calibration.

**Limite : une preuve de compétence reste une exception.** Dès qu'une
dérivation touche directement une **preuve** (niveau, `NiveauPreuve` A/B/C/D)
plutôt qu'une métadonnée d'organisation, le régime de validation manuelle
reprend (§5, bilan d'exercice) — le moteur peut proposer, il n'écrit pas la
mesure de la personne sans qu'elle la confirme.

**Toute valeur numérique dérivée** (type score de confiance) doit être
recalculée à la lecture, jamais stockée figée (P1), et sortir d'une formule
nommée et testée — jamais d'une estimation du tuteur au moment de la
rédaction.

### Conséquences

- Précise ADR-037 : la contrainte de non-mesure vise le **tuteur**, pas le
  **moteur**.
- Débloque, le jour où un chantier de gestion de connaissances serait décidé,
  la dérivation automatique de liens (Knowledge↔Compétence) sans en faire un
  chantier de validation manuelle supplémentaire — à condition que le calcul
  soit dans `lib/engine/` ou `lib/domain/`, testé, et ne touche aucune preuve.
- Ne décide pas de construire cette fonctionnalité : aucun `KnowledgeItem`
  n'existe. Cette entrée fixe la règle pour le jour où la question se posera,
  conformément à §8 (ne pas construire par anticipation).

---

<a name="adr-053"></a>
## ADR-053 — Pilotage au tableau de bord, analyse dans Séances ; navigation à trois pôles ✅

**Date.** 10/08/2026, lots 2 à 4 du chantier de refonte.

**⚠️ Note de numérotation.** Cette décision a été implémentée (code, six
citations en commentaire) sous le numéro « ADR-051 » avant que cette entrée ne
soit écrite — le numéro avait entre-temps été pris par une décision sans
rapport (« Le moteur travaille sur `importance`… », rédigée en parallèle sur un
autre fil). Les six citations dans le code (`navigation.ts`, les trois
redirections `/exercices`, `/journal`, `/progression`, `ics.ts`) ont été
corrigées vers ce numéro-ci dans le même geste que l'écriture de cette entrée.
Ne pas recréer d'ADR-051 pointant sur ce sujet.

**Ce qui était demandé, dans les mots de Maxime.** Un tableau de bord qui soit
« le point d'entrée unique pour piloter l'activité (lancer une session, voir sa
prochaine action, gérer son temps) », et un onglet Exercices qui n'ait plus la
responsabilité du pilotage — devenu un historique des séances, consultable et
rejouable.

### La séparation, et pourquoi elle n'est pas cosmétique

Deux questions distinctes se posaient sous le même écran depuis toujours :
« que dois-je faire maintenant ? » (pilotage) et « qu'ai-je fait, et comment
ça s'est passé ? » (analyse). L'ancien `/exercices` répondait aux deux à la
fois — générer, filtrer, consulter — et c'est ce qui le rendait illisible
(brief initial de Maxime, cadrant ce chantier).

**Décision : le tableau de bord pilote, `/seances` analyse.**

- **Tableau de bord** (`/`) — la carte « Prochaine meilleure action »
  (inchangée), le concepteur de séance (« Composer une séance »), le pomodoro,
  et la carte Profil. Tout ce qui se fait *maintenant*.
- **`/seances`** — quatre vues dans un `SelecteurSegmente` : *Historique* (les
  séances, rejouables via « Refaire cette séance » — [ADR-048](#adr-048)),
  *Progression*, *Journal* et *Bibliothèque* (l'ancien `/exercices`, allégé :
  plus de sélecteur de statut, le pilotage n'y vit plus).
- **`/competences`** perd ses vues Progression et Journal, qui n'avaient de
  sens que comme sous-onglets d'un pôle Suivre plus large ; il ne montre plus
  que les domaines et leurs compétences.

### Ce qui ne change pas de forme, seulement de nom

`/exercices`, `/journal` et `/progression` restent des redirections — même
geste que la fusion précédente de ces deux dernières dans `/competences`
(historique de ce fichier). `/exercices/[id]`, l'écran unitaire d'un exercice,
**ne bouge pas** : c'est ce que le déroulé d'une séance ouvre, et le contrainte
« ne pas casser le process d'exercice à l'unité » (brief de Maxime) s'applique
lettre à lettre.

### Trois pôles, pas quatre

Maxime a tranché explicitement (question posée en session, réponse retenue :
« 3 pôles + carte Profil au tableau de bord ») plutôt que d'ajouter Profil
comme quatrième pôle de navigation : le profil remonte en évidence par une
carte au tableau de bord et un lien direct, sans coûter une entrée de nav pour
un écran consulté rarement.

### Réserve

🔬 `.ics` (`lib/engine/ics.ts`) est écrit — fonction pure, hors périmètre d'une
intégration calendrier complète (§5 du plan) — mais n'est encore appelé nulle
part dans l'interface : aucun bouton d'export ne l'utilise. Fonction morte tant
que ce bouton n'existe pas ; à retirer si elle ne trouve pas de point
d'entrée, plutôt qu'à laisser traîner « au cas où » (CLAUDE.md §8).

---

<a name="adr-054"></a>
## ADR-054 — L'actionnabilité départage sans pénaliser ; un partiel suit la règle de l'échec ✅

**Date.** 10/08/2026, lot 5 du chantier de refonte.

**Ce qui était demandé.** Revoir la logique de scoring de « prochaine
meilleure action » : le brief initial de Maxime rapportait qu'elle
« favorise les exercices déjà réalisés au lieu de prioriser les compétences
faibles ou non couvertes ».

### Le diagnostic a corrigé le problème avant de le traiter

Mesuré le 10/08/2026 : `evaluer()` donnait déjà jusqu'à +70 au jamais-évalué
contre +40 à « due pour révision » et **−15** à « pratiquée récemment ». Le
classement des *compétences* poussait donc déjà vers le non-couvert. Le
symptôme rapporté avait une autre cause : `choisirExercice` rendait `null`
pour 66 compétences actives sur 77 (11 seulement ont un exercice), et la carte
« Prochaine action » retombait alors sur « Générer un exercice » — visuellement
indiscernable d'un algorithme qui privilégierait le déjà-fait, alors que le
vrai obstacle était le corpus, pas le tri. Le diagnostic complet est dans
[PLAN_REFONTE_SEANCES.md §1](PLAN_REFONTE_SEANCES.md).

Deux défauts réels sont restés une fois cette confusion levée — ce sont eux
que ce lot corrige.

### 1. L'actionnabilité départage, elle ne pénalise pas

`BONUS_ACTIONNABLE = 10` (`lib/engine/recommend.ts`) : une compétence pour
laquelle un exercice existe déjà reçoit ce bonus modeste. Comparé aux autres
facteurs — « Jamais évaluée » jusqu'à +70, « Due pour révision » +40,
« Confiance faible » +12, « Robustesse insuffisante » +14 — il suffit à
départager un quasi-ex-aequo, pas à renverser un écart réel. Deux tests le
vérifient : l'un construit un ex-aequo strict et montre que le bonus décide
(et non l'ordre alphabétique du code, qui aurait décidé sans lui) ; l'autre
montre qu'une compétence jamais évaluée sans exercice passe quand même devant
une compétence actionnable de moindre priorité.

**Pourquoi un bonus et pas une pénalité sur le non-couvert.** Une pénalité
aurait été l'inverse du besoin exprimé par Maxime — enfoncer encore ce qui
manque déjà d'exercices. Le bonus agit uniquement sur la face « prête à
lancer », jamais sur la face « manquante ».

**Où il est calculé.** `recommander()` doit désormais choisir l'exercice
AVANT de noter la compétence (`choisirExercice` puis `evaluer(..., exercice
!== null)`), un réordonnancement du pipeline interne. Rien ne change à la
sortie sur ce point : `Recommandation.exercice` est toujours résolu par
`choisirExercice`, `evaluer` ne fait qu'en recevoir le résultat.

### 2. Un partiel suit désormais la même règle qu'un échec

Avant ce lot, `recommandable()` bloquait un exercice ÉCHOUÉ tant qu'aucune
réussite postérieure n'était démontrée sur la compétence (règle posée le
02/08, condition et non délai), mais laissait un exercice PARTIEL candidat
sans aucune condition — « c'est un progrès, pas un mur ».

**Observé en production le 10/08/2026** : `diag-dev-02` et `diag-tech-01` ont
chacun produit deux résultats « partiel » à plusieurs *jours* d'écart, sans
qu'aucune condition ne les ait fait sortir de la file entre les deux — le même
exercice reproposé, le même résultat obtenu. C'est la définition même de
« tourner en rond », l'irritant que ce chantier entier adresse, et l'exemption
du partiel en était une cause directe et mesurée, pas hypothétique.

**Décision : P4 ne distingue pas l'échec du partiel.** Les deux sont un
résultat non abouti, et les deux exigent la même démonstration — une preuve en
réussite postérieure sur la compétence — avant que le MÊME exercice ne
revienne. `recommandable()` perd sa branche spéciale pour le partiel ; un seul
chemin gouverne désormais échec et partiel.

**Ce que ça change concrètement, vérifié sur les deux cas réels.** `TECH-01`
n'a que `diag-tech-01` pour exercice : bloqué, la compétence retombe sur
`exercice: null` et le repli « Générer un exercice » — la sortie voulue, pas
une impasse. `DEV-02` a un second exercice en base : bloqué, `choisirExercice`
sert l'autre exercice — encore mieux, puisque `jamaisTente` le préférait déjà
à difficulté égale.

**Ce qui ne change pas.** Une compétence jamais évaluée reste candidate sans
condition — seule la RÉPÉTITION du même résultat sur le même exercice est
gouvernée.

### Ce qui n'a pas été fait, et pourquoi

**5.3 du plan — « relire les facteurs à la lumière des séances »** n'est **pas
implémenté**. Le plan le disait déjà : « à trancher sur données, pas avant »
(CLAUDE.md §8, ne pas construire par anticipation). Aucune séance composée
n'a encore été jouée en production ; rien ne dit aujourd'hui si le fait
qu'une compétence ait été travaillée *dans* une séance transverse sans en
être la cible doit peser sur son score. **Test de réfutation, pour qui
reprendra ce point** : si, après plusieurs séances transverses jouées, des
compétences déjà travaillées en séance restent premières dans la file malgré
un score qui devrait les avoir fait reculer, le facteur manque réellement.

⚠️ **Aucun seuil de `calibration.ts` n'a bougé** (ADR-028/045) : ce lot touche
uniquement `recommend.ts`.

---

<a name="adr-055"></a>
## ADR-055 — Le thème : une portée modulaire, pas une arête de plus 🔬

**Date.** 10/08/2026.

**Origine.** Discussion avec Maxime sur un « knowledge graph » de compétences,
relancée après ADR-052 : « je veux de la flexibilité dans ce que je veux
apprendre et passer d'une structure stricte (compétence 01... sous compétence
a.) à une structure modulaire et interconnectée pour favoriser la
pluridisciplinarité. » Deux besoins distincts derrière cette phrase, séparés
avant de coder (CLAUDE.md §9) : composer une séance à partir d'une intention
libre (« je veux apprendre l'histoire de l'industrie japonaise »), et
regrouper des compétences que le domaine sépare (le stoïcisme est 5 domaines
sur 12 ; le japonais et le toyotisme n'ont aucun domaine commun).

### Ce que la base disait, interrogée avant de concevoir

12 domaines actifs, 77 compétences actives, 17 portant un `prerequis`, 16
couvertes par un exercice. Deux lectures : les 12 domaines sont en réalité 3
sujets (stoïcisme = 5 domaines, industrie = 5 domaines) — « bosser le
stoïcisme » n'est pas exprimable aujourd'hui ; et **le graphe existe déjà et
il est décoratif** — `competences.prerequis TEXT[]` (`schema.sql`), rempli à
22 %, lu par un seul facteur de `recommend.ts`
([recommend.ts:220](../app/src/lib/engine/recommend.ts)), et le formulaire
d'édition du référentiel ne sait même pas l'écrire.

### La décision

**Le nœud manquant n'est pas une compétence, c'est un thème.** `ThemeSeance`
existait déjà (`lib/engine/caf.ts`, ADR-049) et se décrivait lui-même comme
« une demande à moitié remplie » — calculé depuis `recommander()` puis jeté.
Le persister dans une table `themes` (id, libellé, intention facultative,
`codes: string[]`, origine) suffit : un thème est une **hyper-arête nommée**,
`{Japonais, Toyotisme, Histoire industrielle}` étant une relation à N branches
qui porte son *pourquoi*. Une arête binaire n'en est qu'un cas particulier à
2 membres — la co-appartenance est donc plus expressive, pas moins, et elle a
un consommateur dès le premier jour (`composerSeance`), contrairement à une
table d'arêtes typées que rien ne lirait.

**Point de conception qui a tout décidé : le thème alimente `PorteeSeance`, pas
`codesImposes`.** `composerSeance` préfixe `codesImposes` au classement puis
remplit *n* créneaux ([caf.ts:401](../app/src/lib/engine/caf.ts)) — un thème à
30 codes imposés pour 4 créneaux écraserait le classement, les 4 premiers
codes gagnant dans un ordre arbitraire. `PorteeSeance` gagne donc une 3ᵉ
variante, `{ type: "theme", themeId, codes }` : le moteur classe **dans** le
thème, exactement comme pour `mono`/`transverse`. Un seul classement,
ADR-049 tenu ; `codesImposes` reste réservé aux thèmes ciblés d'une seule
compétence.

**La résolution d'une intention libre passe par le moteur, pas par le
tuteur — au sens d'ADR-052.** `proposer_theme` (`lib/tutor/outils.ts`) ne
**désigne** que des codes déjà attribués (`enum` fermé, comme
`proposer_revision`, ADR-043) ; il n'écrit jamais de code, et le tuteur n'écrit
aucune mesure sur le lien produit — c'est une métadonnée d'organisation, pas
une preuve de compétence. Comme `proposer_correction`, cet outil **n'entre
pas** dans `outilsTuteur` : il n'est armé que sur `/api/themes/resoudre`.
Une liste de codes vide n'est pas une erreur — c'est le refus demandé (P2, pas
de rapprochement forcé) — et renvoie vers la création d'une branche plutôt que
d'inventer une correspondance.

### Ce qui n'a délibérément pas été fait

- **Aucune table d'arêtes compétence↔compétence.** Aucun consommateur
  identifié : `recommander` ne saurait pas quoi faire d'un lien typé. Le
  besoin exprimé (japonais ↔ toyotisme) est couvert par la co-appartenance à
  un thème.
- **Aucun `KnowledgeItem`** (notes, lectures, projets — la partie « gestion de
  connaissances » de la discussion d'origine). Un chantier séparé, pour le jour
  où il sera décidé : une note aura alors un thème existant où se ranger.
- **Aucun score de confiance ni pondération d'arête** : un nombre porté sur un
  lien demanderait une source (P2), et rien ne la fournit aujourd'hui.
- **Le domaine ne bouge pas** : toujours la source du préfixe de code
  (ADR-026) et la cible de la FK des compétences. Le thème se superpose, il ne
  remplace rien.

### Réserve, et test de réfutation

🔬 Rien ne dit encore qu'un thème enregistré sera **réutilisé** plutôt que
composé une fois puis oublié — c'est ce qui distingue un vrai nœud de graphe
d'une requête de recherche qu'on aurait tort de stocker. **Test de
réfutation** : si après une dizaine de séances personnalisées aucun thème
enregistré n'est jamais resélectionné, le thème n'est pas un nœud persistant —
il ne doit plus être stocké, et la résolution doit redevenir éphémère
(calculée à la demande, jamais écrite).

---

## ADR-056 — Le graphe est une vue dérivée : nœuds typés, liens réels, aucune arête fabriquée ✅

**Date.** 11/08/2026.

**Origine.** Un premier graphe de compétences façon Obsidian a été livré par
Cyril sur `origin/master` (`feat: add interactive skill graph view`), non
encore fusionné. Revue avant intégration (« regarde les changements faits par
le commit de cyril sur le graph system, corrige le, fais le évoluer »).

### Ce que la revue a trouvé

Le moteur de forces était écrit à la main : répulsion O(n²) sur chaque paire à
chaque frame, sans quadtree, dans une boucle `requestAnimationFrame` qui ne
s'arrêtait jamais (pas de décroissance d'`alpha`, pas de seuil de
convergence) — 200 itérations synchrones bloquantes à chaque changement de
niveau. La structure était à trois niveaux zoomables (catégories →
compétences → exercices) qui se remplaçaient, loin du graphe plat d'Obsidian.

Plus grave que la performance : **le graphe inventait des arêtes.** Deux
mécanismes fabriquaient des liens absents du référentiel :

1. un « backbone » séquentiel par domaine — les compétences triées par code et
   reliées en chaîne (`FTS-01 → FTS-02 → …`) dès qu'il n'y avait « pas assez »
   de prérequis déclarés, typé identiquement à un vrai `prerequis` et donc
   dessiné avec la même flèche de dépendance ;
2. un regroupement de domaines par mots-clés codés en dur dans le code source
   (`"stoïc"`, `"conway"`, `"couplage"`, `"domain-driven"`) — un graphe qui ne
   fonctionne que sur le référentiel pour lequel ces mots ont été écrits.

Cela viole l'invariant 6 du projet (« ne jamais inventer de données ») aussi
directement qu'un score calculé sur une hypothèse non vérifiée. Un bug
structurel en découlait d'ailleurs directement : une arête `inter-domaine`
mélangeait un id de domaine et un code de compétence dans le même espace de
noms, et la règle « prérequis inter-domaines, priorité maximale » se
retrouvait silencieusement filtrée à l'affichage — invisible, donc jamais
corrigée.

### La décision

**Une compétence sans prérequis, sans thème et sans exercice reste isolée
dans le graphe.** C'est une information vraie et actionnable (« celle-là n'est
reliée à rien »), pas un défaut à masquer en fabriquant un voisin. Quatre
liens seulement, tous dérivés d'un fait réel :

- `prerequis` — `skill.prerequis`, orienté ;
- `theme` — `Theme.codes` (ADR-053), hub non orienté ;
- `exercice` — `Exercise.competences`, hub non orienté ;
- `similarite` — proximité de **vocabulaire** des intitulés de compétence
  (TF-IDF + cosinus + top-K **mutuel**, `lib/engine/similarite-textuelle.ts`,
  remplace `lib/ui/micro-embedding.ts`), toujours rendue en pointillé,
  toujours un lien dérivé — jamais présenté comme une mesure (invariant 5).
  Le module précédent utilisait des fréquences brutes sans IDF, sans
  normalisation, et ne fonctionnait qu'au niveau domaine ; le remplaçant
  travaille au niveau compétence et ne retient une paire que si chacune
  figure dans le top-K de l'autre — la règle standard d'un graphe de
  plus-proches-voisins, qui évite qu'un vocabulaire générique produise un hub
  parasite relié à tout le référentiel.

**Chaque identifiant de nœud est préfixé par son type**
(`competence:LOG-01`, `theme:abc`, `exercice:xyz` — `lib/domain/graphe.ts`).
C'est la correction directe du bug structurel ci-dessus, et un point
d'extension : une future entité « note » (projet, PDF, cours — évoquée par
Maxime, hors de ce chantier) ajoutera son propre préfixe sans toucher aux
autres.

**`etiquettes: string[]` sur chaque nœud** (domaine, palier, niveau,
couverture, dérivées) est le second point d'extension : une note portera ses
propres étiquettes libres dans le même tableau, et les filtres du panneau de
réglages fonctionneront sans changement de modèle.

**Le layout est calculé par `d3-force`**, pas par un moteur maison — Barnes-Hut
(`forceManyBody`), décroissance d'`alpha` (la simulation converge puis dort,
plus de boucle perpétuelle), `forceLink`/`forceCollide`/`forceX`/`forceY` pour
ce que le code précédent réimplémentait à la main. ~6 ko gzippés (`d3-force` +
`@types/d3-force`) pour ne plus maintenir un moteur physique. Le rendu reste
Canvas 2D fait main (grille, arêtes, nœuds, tooltip, légende) — c'est la
partie qui n'avait pas de raison de changer.

**Structure : graphe plat**, comme Obsidian — tous les nœuds à l'écran, un
panneau de réglages (filtres par type de nœud/lien, seuil de similarité, axe
de coloration réglable — domaine par défaut, palier, maîtrise, couverture en
exercices, forces de disposition), survol qui surligne les voisins directs et
estompe le reste. Plus de niveaux qui se remplacent avec fil d'Ariane.

### Ce qui reste volontairement hors de ce chantier

- **Aucune entité « note »** (projet, PDF, cours, idée). Le modèle de nœuds
  typés et d'étiquettes est prêt à l'accueillir ; sa persistance (table,
  RLS, UI de rédaction) est un chantier séparé, à décider comme tel — même
  raisonnement que « KnowledgeItem » en ADR-055.
- **Aucun score de confiance sur une arête** dérivée : le poids d'un lien
  `similarite` est affiché comme ce qu'il est (une similarité de texte), pas
  présenté comme une mesure de compétence.

### Réserve

🔬 Le seuil et le top-K de la similarité (0.12, K=4) sont des valeurs de
départ, pas calibrées sur un usage réel. **Test de réfutation** : si le
panneau de réglages montre systématiquement soit aucune arête `similarite`
soit un graphe saturé quel que soit le curseur, le calcul (ou son seuil par
défaut) est à revoir.

---

<a name="adr-057"></a>
## ADR-057 — L'autonomie se mesure par traces, puis se demande pour l'invisible ✅

**Date.** 11/08/2026. **Tranchée par Maxime** après la mission ④ : « Le degré
d'autonomie doit être mesuré au maximum (sollicitation du tuteur, indices...)
et sinon doit être demandé à l'utilisateur. »

### Décision

L'autonomie suit un ordre de preuve :

1. le produit utilise d'abord les traces qu'il observe lui-même — indices
   débloqués, sollicitation du tuteur et autres aides internes réellement
   enregistrées ;
2. il demande ensuite à la personne les aides extérieures que le produit ne
   peut pas voir ;
3. le moteur dérive le palier depuis l'ensemble de ces faits et retient la
   borne la plus basse quand plusieurs signaux se contredisent.

**L'absence de trace n'est jamais interprétée comme « aucune aide ».** Elle
déclenche la question au bilan lorsque l'information est nécessaire. La
personne ne choisit pas directement son palier d'autonomie : elle déclare un
fait que le moteur traduit, conformément à ADR-033.

### Rapport aux décisions précédentes

- ADR-008 reste fermée : ignorer l'aide externe n'est plus une option.
- ADR-033 reste valide et fournit le mécanisme de plafond.
- ADR-038 reste un fait historique ; sa correction du 07/08 confirme que le
  bilan pose déjà la question de l'aide extérieure.

### Ce que cette décision ne valide pas

Le barème `PLAFOND_AIDE` reste 🔬 tant qu'il n'a pas été confronté à l'usage.
Cette décision fixe **quelles sources chercher et dans quel ordre**, pas les
coefficients qui convertissent chaque aide en A0/A1/A2. P8 reste donc 🔬 sur sa
calibration, même si son architecture de mesure est désormais tranchée.

**Alternative écartée.** Demander systématiquement une auto-note d'autonomie :
elle jette les traces objectives et réintroduit le biais retiré par ADR-033.

---

<a name="adr-058"></a>
## ADR-058 — Granularité sans plafond ; les notes servent la boucle et entrent dans le graphe ✅

**Date.** 11/08/2026. **Tranchée par Maxime** après la mission ④.

### Décision

Le modèle de connaissances cible une hiérarchie thématique de profondeur non
bornée par le produit : thème, sous-thème et niveaux descendants ne constituent
pas des entités différentes. **Thèmes et sous-thèmes apparaissent dans la
liste. Toutes les notes apparaissent dans le graphe.**

Une note sert la boucle pédagogique : elle permet d'intégrer un cours, une
curiosité personnelle ou un besoin professionnel, de préciser ce que la
personne veut apprendre et de conserver les ressources correspondantes dans un
espace organisé. Une note est du contenu déclaré ; elle ne porte ni niveau, ni
preuve, ni score par elle-même.

### Rapport au modèle actuel

ADR-055 n'est pas remplacée : le thème actuel reste une portée modulaire de
séance et une hyper-arête nommée. La présente décision l'étend vers une
hiérarchie récursive et décide la finalité de l'entité « note » laissée hors du
chantier par ADR-055 et ADR-056.

Le graphe d'ADR-056 reste une vue dérivée : il pourra accueillir des nœuds
`note`, mais aucun lien ne sera fabriqué. Une note n'est reliée que par des
relations réellement stockées ou par un lien explicitement présenté comme
dérivé.

### Ce qui reste à concevoir avant implémentation

La décision ne choisit pas le schéma SQL, l'éditeur, les formats d'import, les
règles de rattachement ni l'interface de navigation profonde. Le chantier devra
notamment traiter les cycles, l'isolation RLS par compte, l'archivage et la
distinction stricte entre contenu déclaré et mesure. Les briques restent ❓
« non construites » dans la carte tant que ce travail n'est pas livré.

**Alternatives écartées.** Une profondeur fixe « thème / sous-thème / notion » ;
des notes détachées de la boucle ; un graphe qui invente automatiquement leurs
relations.

---

<a name="adr-059"></a>
## ADR-059 — Une séance créée conduit au workspace focus ✅

**Date.** 11/08/2026. **Tranchée par Maxime** après la mission ④.

### Décision

La création d'une séance n'aboutit pas à une simple ligne planifiée : elle
conduit au **workspace focus**, l'environnement dans lequel la séance est
travaillée. Le geste produit est continu : composer → créer → travailler.

Le workspace focus est une présentation et une phase de `LearningSession`, pas
une nouvelle entité métier. ADR-048 reste donc la contrainte : la séance
existante s'étend, elle ne se recrée pas. Le déroulé d'un exercice unitaire
continue d'utiliser la séance et les tentatives existantes.

### Ce qui reste à concevoir

La route, le comportement d'une séance seulement planifiée, la reprise après
interruption et la composition exacte de l'écran ne sont pas décidés ici. Ils
devront préserver l'absence de double entrée dans le journal et le calcul pur
de l'avancement.

**Alternative écartée.** Créer une séance puis laisser la personne retrouver
manuellement son point de départ dans un autre écran.

---

<a name="adr-060"></a>
## ADR-060 — Observer le maximum pertinent, jamais le maximum indiscriminé ✅

**Date.** 11/08/2026. **Tranchée par Maxime** après la mission ④ : « Le maximum
de data doit être mesuré afin d'établir un bilan précis. »

### Décision

Pour chaque geste pédagogique, le produit recueille le maximum de **faits
pertinents pour la boucle** qu'il peut observer honnêtement : temps réellement
passé, indices, sollicitations du tuteur, réponses, validations et autres
signaux explicitement reliés à une question du bilan.

« Maximum » reste borné par les invariants du produit :

- chaque observation a une source explicite (P3) ;
- une donnée absente reste absente (P2) ;
- le dérivable n'est pas stocké (P1) ;
- les données restent isolées par compte et ne sont pas partagées sans
  consentement (invariant 8, confidentialité) ;
- le tuteur peut produire du contenu, jamais une mesure (P5) ;
- une trace ne devient ni intention, ni hésitation, ni triche par inférence.

Avant d'ajouter un champ, le chantier doit écrire la question pédagogique à
laquelle il répond, sa source, sa durée de conservation et la dérivation qui le
consomme. Sans consommateur dans la boucle, ce n'est pas une observation utile
mais de la collecte par anticipation.

### Conséquences

La couche 2 est appelée à s'enrichir, notamment pour l'autonomie (ADR-057),
mais cette décision n'autorise aucune télémétrie générale ni aucun partage de
données. Elle ne résout pas la détection de triche : accuser demande un niveau
de preuve qui n'est toujours pas défini.

**Alternative écartée.** Ne conserver que le résultat final : cela empêche de
comprendre pourquoi une compétence progresse ou résiste et rend le bilan moins
précis.

---
<a name="adr-061"></a>
## ADR-061 — Séances : un hub et un workspace, pas quatre vues ✅

**Date.** 11/08/2026. **Tranchée par Maxime.** Remplace la partie « quatre vues »
[ADR-053](#adr-053) et réalise [ADR-059](#adr-059) (workspace focus).

### Décision

`/seances` n'a plus quatre onglets. Il affiche deux choses :

- sans `session` : un **hub** — un CTA de composition centré, une file épinglée
  des séances en cours et planifiées (reprendre, démarrer, annuler), puis un
  **cahier** chronologique léger des séances réalisées (y compris les anciennes
  séances mono-exercice). Ni progression, ni recherche, ni statistiques : un
  cahier, pas un tableau de bord ;
- avec `session=<id>` : le **workspace** de la séance (ADR-059) — rechargable et
  partageable par URL, couvrant l'interface courante. Les trois outils (file
  d'exercices, Pomodoro, tuteur) restent repliés derrière des boutons.

`LearningSession` reste l'unique entité (ADR-048), aucune migration DB. La
progression et la bibliothèque disparaissent de Séances ; `/exercices/[id]`
reste l'écran unitaire d'un exercice. Redirections conservées : `/journal` et
`/exercices` → `/seances` ; `/progression` → `/competences` ;
`/seances/[id]` → `/seances?session=<id>`.

### Conséquences

- Le déclencheur « Composer une séance » est centré sur le hub Séances, et
  `creerSeance(entree, mode)` écrit une séance planifiée **ou** en cours en une
  écriture — plus d'enchaînement « planifier puis démarrer » non atomique, qui
  pouvait laisser une séance planifiée orpheline.
- Une séance sans aucun exercice disponible est **refusée** (`motifRefusActivites`) :
  les « à générer » ne comptent pas comme activité tant qu'ils ne sont pas
  relus dans la composition.
- Sortir du workspace ne termine rien : la séance reste épinglée et reprenable.
  Une séance planifiée y affiche son résumé et « Démarrer » ; une séance
  terminée reste consultable en lecture seule.

**Alternative écartée.** Conserver les quatre onglets : la progression dépend
des preuves (pôle Compétences), la bibliothèque est l'écran unitaire des
exercices, et disperser le suivi derrière des onglets diluait la destination
d'une séance.

---

<a name="adr-062"></a>
## ADR-062 — Le pôle devient Cahier ; la relecture synthétise et toute prochaine action ouvre le focus ✅

**Date.** 11/08/2026. **Tranchée par Maxime.** Étend [ADR-061](#adr-061) et
remplace explicitement son retrait de la recherche.

### Décision

Le pôle visible s'appelle **Cahier**. La route `/seances` et l'entité
`LearningSession` ne changent pas : « Cahier » désigne la destination où l'on
travaille puis relit les séances, pas une nouvelle entité métier.

La relecture d'une séance terminée ne rejoue plus l'écran d'exercice complet.
Elle met d'abord en avant les conclusions réellement disponibles — notions
travaillées, points forts, points bloquants et actions à reprendre — puis garde
la réponse et la correction sous des volets explicites. Si aucun verdict du
tuteur n'a été conservé, la synthèse peut seulement reformuler les critères et
scores validés ; elle n'invente aucune conclusion. La recherche revient dans le
cahier et porte sur les traces déjà disponibles. « Refaire la séance »
recompose depuis le blueprint conservé ou, pour l'historique antérieur, depuis
les exercices encore identifiables.

Après génération, les deux décisions sont **Accepter** ou **Modifier**.
Modifier transmet une consigne humaine et la proposition courante au tuteur ;
la proposition révisée reste non enregistrée jusqu'à une acceptation explicite.

Enfin, la prochaine action — exercice déjà disponible ou nouvel exercice
accepté — crée une `LearningSession` mono-exercice puis ouvre le workspace
focus. Cela réalise ADR-059 sur ce second point d'entrée sans créer de double
entrée dans le journal.

### Conséquences

- aucune migration de base et aucune nouvelle entité ;
- la correction reste disponible, mais ne concurrence plus les conclusions ;
- le tuteur révise du contenu, jamais une mesure ;
- une séance déjà en cours continue de bloquer l'ouverture d'une seconde.

**Alternative écartée.** Ouvrir directement `/exercices/[id]` depuis la
prochaine action : le focus resterait alors une présentation réservée au seul
compositeur de séances, malgré ADR-059.

---

## Comment modifier ce registre

1. Une décision ✅ ne se retire pas : elle passe en 🔄 **Remplacée**, avec le
   numéro de l'ADR qui la remplace.
2. Une 🔬 hypothèse doit porter son **test de réfutation**. Sans test, c'est une
   opinion et elle n'a pas sa place ici.
3. Une ❓ question ouverte doit nommer **qui doit trancher** et **ce qui bloque**.
4. Aucune analyse produite par une session Claude ne devient ✅ sans validation
   humaine explicite.
