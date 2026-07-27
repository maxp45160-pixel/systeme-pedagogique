# FEATURE_EVALUATION_FRAMEWORK.md — Système pédagogique

**Version 1.0 — 27/07/2026.**

Grille d'évaluation de toute proposition de fonctionnalité, **y compris celles
produites par une session Claude**. Son but n'est pas de freiner : c'est
d'empêcher qu'une idée devienne une décision par simple absence
d'objection.

---

## Étape 0 — Vérifier les faits avant de raisonner

**Cette étape est obligatoire et passe avant toutes les autres.**

Une analyse fondée sur des données périmées produit des conclusions
confiantes et fausses. **C'est arrivé le 27/07/2026 :** une analyse produit
complète a été bâtie sur `app/data/store/*.json`, qui est un état figé au
25/07. Elle annonçait 11 preuves, 8 compétences évaluées et un usage
interrompu. La production comptait en réalité **15 preuves, 12 compétences et
4 séances le jour même**. Un des trois « risques stratégiques majeurs »
identifiés n'existait pas.

**Règle qui en découle.** Avant toute analyse portant sur l'usage :

| Question | Où se trouve la réponse |
|---|---|
| Combien de preuves, de tentatives, de séances ? | **Supabase**, via MCP ou SQL |
| Quels exercices restent disponibles ? | `lib/seed/exercises.ts` **+** table `exercises` |
| Que voit l'utilisateur à l'écran ? | Exécuter le moteur sur les données de production |
| Quel est l'état du code ? | Le dépôt |
| Quel est l'état de l'usage ? | **Jamais `app/data/store/` — voir ADR-002** |

Si une donnée ne peut pas être vérifiée, l'analyse doit le **dire**, et la
conclusion correspondante reste 🔬 hypothèse.

---

## Les six questions

Toute proposition non triviale répond aux six, dans l'ordre.

### 1. Quel problème réel résout-elle ?

Un problème réel est **observable**. « L'interface pourrait être plus claire »
n'est pas un problème ; « 31 compétences sur 43 n'ont aucun exercice » en est
un.

❌ Si le problème ne peut être formulé qu'en termes de solution
(« il manque un système de X »), il n'a pas encore été identifié.

### 2. Quel est le besoin, distinct de la solution imaginée ?

La formulation d'une demande contient presque toujours déjà une solution. Il
faut la retirer pour voir le besoin.

**Exemple réel.** Demande : « recherche d'exercices ». Solution implicite :
un moteur de recherche. Besoin réel : *qu'il existe des exercices à faire*.
Ce n'est pas un problème de recherche mais de production — d'où ADR-004, et
non une barre de recherche parmi 11 éléments.

### 3. Quels sont les effets secondaires ?

Au minimum :

- **Sur la surface produit** — combien d'écrans, de boutons, de concepts en
  plus ? Chaque ajout renchérit tous les chantiers suivants.
- **Sur les données** — un modèle nouveau, c'est une migration à venir
  (ADR-012 : il n'existe aucun outil de migration).
- **Sur le comportement de l'utilisateur** — que va-t-il faire différemment,
  y compris de façon non souhaitée ?
- **Sur les autres décisions** — laquelle devient plus difficile à prendre
  après ?

### 4. Est-ce compatible avec les principes fondamentaux ?

Passage obligé par `PRODUCT_PRINCIPLES.md`, **principe par principe**. Les
plus souvent menacés :

| Principe | Question de contrôle |
|---|---|
| P1 — rien de dérivable n'est stocké | La fonctionnalité veut-elle persister une valeur calculable ? |
| P2 — l'absence de mesure n'est pas un zéro | Fabrique-t-elle un chiffre là où il n'y a pas de mesure ? |
| P3 — aucune valeur sans source | Chaque nombre affiché peut-il répondre à « d'où vient-il » ? |
| P5 — le tuteur n'écrit jamais | Ajoute-t-elle un chemin d'écriture automatique ? |
| P7 — l'honnêteté prime | Affiche-t-elle quelque chose qui n'existe pas encore ? |
| P8 — la qualité de la preuve | Dégrade-t-elle la fiabilité de ce qui entre dans le système ? |

**Une incompatibilité n'est pas rédhibitoire** — mais elle impose de modifier
le principe *explicitement dans son document*, avec sa justification. Jamais
de contournement silencieux.

### 5. Quelle est l'alternative ?

**Au moins une, sérieusement construite.** Une alternative de paille ne compte
pas. « Ne rien faire » est toujours une alternative recevable et doit être
évaluée comme les autres.

Formes fréquentes d'alternative plus économique :
- résoudre le problème **en amont** plutôt que d'ajouter une surface ;
- réutiliser un dispositif existant plutôt qu'en créer un ;
- rendre le problème visible et attendre qu'il se manifeste vraiment.

### 6. Que recommande-t-on, et pourquoi ?

Une recommandation **avec son argument décisif** — la raison qui, si elle
tombait, ferait changer d'avis. Pas une liste équilibrée d'avantages et
d'inconvénients : un avis.

**Et une recommandation reste une recommandation.** Elle ne devient une
décision que quand une personne la tranche. Voir la règle de classement
ci-dessous.

---

## Deux tests supplémentaires

### Test de réversibilité

| Type | Traitement |
|---|---|
| **Réversible** (rendu, libellés, ordre d'affichage) | Décider vite, corriger à l'usage |
| **Coûteux à défaire** (modèle de données, schéma, contrat public, généralisation) | Écrire une ADR, trancher explicitement, ne pas improviser |

La généralisation du référentiel (ADR-009) est le cas type de la seconde
catégorie : elle fige simultanément trois modèles.

### Test de réfutation

Toute proposition classée 🔬 **hypothèse** doit énoncer **ce qui la rendrait
fausse**. Sans cela, ce n'est pas une hypothèse mais une opinion, et elle ne
peut être ni validée ni écartée.

*Exemple, ADR-005 :* « le moteur de recommandation est une file d'attente ».
Réfutation : quand la couverture dépassera ~50 %, les facteurs secondaires
devraient reprendre la main et les justifications se diversifier. Si c'est le
cas, le barème n'a pas besoin d'être touché.

---

## Règle de classement — la plus importante

Le résultat de la grille se range dans **une seule** des quatre cases :

| Statut | Condition d'entrée |
|---|---|
| ✅ **Décision** | Une personne a tranché, explicitement. Consignée dans `ARCHITECTURE_DECISIONS.md` |
| 🔬 **Hypothèse** | Argumentée, avec test de réfutation. **Pas d'action engagée** |
| ❓ **Question ouverte** | Arbitrage identifié, nomme qui tranche et ce qui bloque |
| 🗑️ **Abandonnée** | Écartée, **avec sa raison conservée** pour ne pas y revenir par oubli |

> **Une analyse convaincante n'est pas une décision.**
> C'est la principale façon dont un projet dérive : une session produit un
> raisonnement solide, personne n'objecte, et trois semaines plus tard il est
> traité comme acquis alors que personne ne l'a jamais choisi.

---

## Trois cas travaillés

### Cas 1 — « Le contenu doit venir du tuteur » → ✅ Décision

1. **Problème réel.** 3 exercices restants, 0 créé, 31 compétences sans support.
2. **Besoin vs solution.** Besoin : qu'il existe du travail à faire. Pas :
   une bibliothèque, ni une recherche.
3. **Effets secondaires.** Qualité non relue ; le corpus alimente ensuite les
   recommandations. Traitement : `origine` affichée, exercice écartable.
4. **Principes.** Conforme à P5 (proposition validée) et P1 (un exercice est un
   fait observé, pas un dérivé).
5. **Alternatives.** Écrire 30 seeds à la main (coût récurrent, non
   transférable) ; supprimer l'objet `Exercise` (ADR-011, reste ouverte).
6. **Recommandation → décision.** Retenue par Maxime le 27/07, avec la
   contrainte de gratuité. → **ADR-004**

### Cas 2 — « Geler le développement 3 semaines » → 🗑️ Abandonnée

1. **Problème supposé.** Le développement évincerait la pratique.
2. **Vérification (étape 0) — échouée.** Le problème reposait sur le journal
   local figé. Les données de production montrent 4 séances le jour même de
   modifications du code.
3. **Décision de l'auteur.** Le temps disponible permet les deux ; voir l'outil
   évoluer fait partie de la motivation.
4. **Classement.** 🗑️ Abandonnée, raison conservée. Ne pas reproposer sans fait
   nouveau.

**Ce cas est conservé délibérément** : il montre la grille rejetant une
proposition issue de son propre auteur, faute de vérification préalable.

### Cas 3 — « Système d'amis » → ❓ Reportée avec condition

1. **Problème réel.** Non établi. Aucun utilisateur ne l'a demandé ; il y a
   un utilisateur actif.
2. **Besoin vs solution.** Besoin possible : émulation, redevabilité. La
   comparaison sociale n'est qu'une des solutions, et pas la plus sûre.
3. **Effets secondaires.** Casse le modèle RLS « chacun ses lignes » ; une
   progression de compétences est une donnée personnelle (RGPD).
4. **Principes.** ⚠️ Tension frontale avec la finalité du système — maximiser
   la capacité à résoudre des problèmes nouveaux, non accumuler des marqueurs
   de statut.
5. **Alternatives.** Partage ponctuel d'un bilan ; relance interne (déjà
   presque outillée) ; ne rien faire.
6. **Recommandation.** Reporter après ADR-009. Si retenue : opt-in, par
   compétence, **jamais de classement**. → ❓ Reportée.

---

## Application aux sessions Claude

Une session Claude travaillant sur ce dépôt doit :

1. **Vérifier avant d'analyser** (étape 0). Ne jamais présenter comme un fait
   ce qui vient d'une source non vérifiée, et nommer explicitement ses
   réserves.
2. **Proposer un plan avant de coder** pour tout chantier non trivial
   (`CLAUDE.md` §8).
3. **Ne pas transformer ses propres analyses en décisions.** Une conclusion
   d'analyse est 🔬 ou ❓, jamais ✅.
4. **Trancher plutôt que deviner** quand une spécification laisse un arbitrage
   ouvert : formuler une recommandation argumentée et la faire valider — ne
   pas choisir silencieusement en cours de route.
5. **Signaler les contradictions avec les principes**, y compris quand elles
   existent déjà dans le code (P2 et P8 en sont deux exemples actuels).
