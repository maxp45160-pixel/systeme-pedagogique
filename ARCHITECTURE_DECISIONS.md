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
| [002](#adr-002) | Deux dorsales exclusives, jamais synchronisées | ✅ Acceptée |
| [003](#adr-003) | Aucune librairie UI tierce | ✅ Acceptée |
| [004](#adr-004) | Le contenu pédagogique vient du tuteur | ✅ Acceptée (27/07) |
| [005](#adr-005) | Le moteur de recommandation est aujourd'hui une file d'attente | 🔬 Hypothèse |
| [006](#adr-006) | Traitement des compétences non mesurées dans le score global | ❓ Ouverte |
| [007](#adr-007) | Tuteur intégré, moteur configurable | ✅ Acceptée (27/07) |
| [008](#adr-008) | L'autonomie mesurée ignore l'aide externe | ❓ Ouverte |
| [009](#adr-009) | Généralisation du référentiel | ❓ Ouverte, reportée |
| [010](#adr-010) | Widget de TODOs dev partagé entre comptes | ✅ Acceptée, réexamen déclenché |
| [011](#adr-011) | Conservation de l'objet `Exercise` | ❓ Ouverte |
| [012](#adr-012) | Schéma SQL idempotent sans outil de migration | ✅ Acceptée, fragile |

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
## ADR-002 — Deux dorsales exclusives ✅

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
## ADR-006 — Compétences non mesurées dans le score global ❓

**Statut.** Ouverte. Voir `PRODUCT_PRINCIPLES.md` P2 pour la démonstration
complète de la contradiction.

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

**Recommandation (non décidée).** Traiter **avant** ADR-009, pas après :
corriger un indicateur est trivial aujourd'hui, et devient un changement
observable par tous les utilisateurs une fois le produit généralisé.

**En attente de :** arbitrage de Maxime.

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
## ADR-008 — L'autonomie mesurée ignore l'aide externe ❓

**Statut.** Ouverte. Découvert le 27/07 en lisant les données de production.

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

**En attente de :** arbitrage de Maxime.

---

<a name="adr-009"></a>
## ADR-009 — Généralisation du référentiel ❓ (reportée)

**Statut.** Ouverte, **volontairement non traitée maintenant**.

**Problème.** `lib/domain/referentiel.ts` code en dur 43 compétences centrées
BUT QLIO → Master ITI. `recommend.ts` produit littéralement la phrase
*« elle est centrale pour ton objectif Master ITI »* pour n'importe quel
compte. Deux des trois comptes existants ont `formation: "Formation à
renseigner"`.

**Options** (reprises de `ETAT_DES_LIEUX_2026-07-27.md` §7.2) :
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
## ADR-010 — Widget de TODOs dev partagé ✅ (réexamen déclenché)

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

## Comment modifier ce registre

1. Une décision ✅ ne se retire pas : elle passe en 🔄 **Remplacée**, avec le
   numéro de l'ADR qui la remplace.
2. Une 🔬 hypothèse doit porter son **test de réfutation**. Sans test, c'est une
   opinion et elle n'a pas sa place ici.
3. Une ❓ question ouverte doit nommer **qui doit trancher** et **ce qui bloque**.
4. Aucune analyse produite par une session Claude ne devient ✅ sans validation
   humaine explicite.
