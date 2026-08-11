# Audit produit — 11/08/2026

**C'est l'audit qui compte.** Le document voisin
(`2026-08-audit-claude.md`) traite l'infrastructure : validation des données,
RLS, tests, dette technique. Utile à un chantier de fiabilité, hors sujet pour
une décision de conception. Il reste comme annexe.

Quatre questions, dans cet ordre :

1. **Quels écarts de fonctionnalités** entre la carte et le produit réel ?
2. **Quelle intelligence** le produit a-t-il aujourd'hui, comparée à celle que
   la carte promet ?
3. **Que nettoyer**, et selon quelle règle ?
4. **Quoi construire**, avec quelle méthode, dans quel ordre ?

Chiffres lus dans Supabase le 11/08/2026. Aucun n'est estimé.

---

## 1. Le socle : sept chiffres

| Mesure | Valeur | Lecture |
|---|---|---|
| Comptes | 6 — **2 avec une preuve** | Le produit a deux utilisateurs, pas six |
| Compétences actives | **106** | Le référentiel a doublé depuis le 02/08 |
| Exercices actifs | **23**, tous du tuteur | Le corpus n'a pas suivi |
| Couverture | **11 compétences sur 106 ont un exercice** | 10 % |
| Tentatives | 49 — 40 terminées, 8 abandonnées | La boucle courte tourne |
| Preuves | 50 (47 sur un compte, 3 sur l'autre) | Un seul utilisateur réel |
| Séances | 51 — **50 auto-générées, 1 composée** | Le pôle « Travailler » n'a jamais servi |

**Une phrase :** *la boucle courte — exercice, bilan, mise à jour — tourne
réellement ; tout ce qui a été construit autour d'elle est vide.*

---

## 2. Gaps de fonctionnalités

Quatre natures de gap, et elles n'appellent pas les mêmes gestes :

| Type | Définition | Geste |
|---|---|---|
| **Fantôme** | Dessiné sur la carte, aucun code | Décider : construire ou retirer du dessin |
| **Coquille** | Construit, aucune donnée en production | Comprendre **pourquoi** avant de toucher |
| **Affamé** | Construit, utilisé, manque de matière pour s'exprimer | Nourrir, pas réécrire |
| **Tenu** | Construit, utilisé, produit ce qu'il promet | Ne pas y toucher |

### Le tableau

| Brique de la carte | Construit | Utilisé (production) | Gap |
|---|---|---|---|
| Boucle exercice → bilan → mise à jour | ✅ | 40 tentatives, 50 preuves | **Tenu** |
| Génération d'exercices par le tuteur | ✅ | 23/23 exercices | **Tenu** |
| Correction assistée critère par critère | ✅ | Peu tracée (1 verdict archivé/49) | **Affamé** |
| État de compétence (niveau/confiance/robustesse) | ✅ | 27 compétences mesurées | **Tenu** |
| Calibration (difficulté, dimension faible) | ✅ | S'exprime sur une poignée de compétences | **Affamé** |
| Recommandation « prochaine action » | ✅ | Utilisée, mais pointe vers du non-couvert | **Affamé** |
| Graphe de connaissances | ✅ | Lecture seule | **Tenu** (partiel) |
| Référentiel construit avec le tuteur | ✅ | 129 compétences créées | **Tenu** — trop bien tenu, voir §5 |
| **Séance composée (blueprint, besoin, portée)** | ✅ 1 016 lignes | **1 sur 51 ; 4 colonnes NULL sur 100 % des lignes** | **Coquille** 🔴 |
| **Thèmes / portée modulaire** | ✅ | **2 lignes** | **Coquille** |
| **Détection d'erreurs récurrentes** | Verdicts archivés seulement | Aucun mécanisme de relecture | **Fantôme** 🔴 |
| Révision espacée | ✅ heuristique | Active, jamais confrontée | **Affamé** |
| Reporting long terme / rapports | Partiel (`historique.ts`) | Pas d'écran propre | **Fantôme** |
| Workspace focus | ❌ | — | **Fantôme** |
| Notes markdown liées | ❌ | — | **Fantôme** |
| Widgets modulables | ❌ | — | **Fantôme** |
| Replanification automatique | ❌ | — | **Fantôme** (et en tension avec « proposé, jamais appliqué ») |
| Hésitations / stratégies / triche | ❌ | — | **Fantôme** non observable en l'état |
| Analytics, import/export Obsidian | ❌ | — | **Fantôme** |

### Les trois gaps qui décident

**🔴 G-A — La séance est une coquille de 1 016 lignes.** `statut`,
`planifiee_pour`, `blueprint`, `besoin_declare` sont NULL sur les 51 lignes, y
compris les 6 créées le 10/08 après leur mise en service. Deux causes possibles,
et **on ne peut pas concevoir la suite sans savoir laquelle** : soit le chemin
d'écriture perd les champs (bug, réparation d'une heure), soit personne ne
compose de séance (échec de conception, et le pôle dominant de la navigation est
à repenser). **Premier geste du chantier : créer une séance et regarder la
ligne.**

**🔴 G-B — La couverture à 10 % rend la recommandation absurde.** 95 compétences
actives n'ont ni preuve ni exercice. Le facteur dominant du score
(« Jamais évaluée », 30 à 70 points) pointe donc massivement vers ce qui n'a rien
à servir. Le code le sait : il a ajouté `BONUS_ACTIONNABLE = 10` en documentant
que c'est « largement insuffisant pour renverser un écart réel ». **Le correctif
a été calibré pour ne pas corriger le cas dominant.** Ce n'est pas un bug de
moteur, c'est un problème de stock — et le stock est un problème de conception,
pas de code.

**🔴 G-C — La mémoire du tuteur est archivée mais jamais relue.** ADR-046 a fait
archiver les verdicts pour permettre « cette erreur revient ». Or
[`correction.ts:23`](app/src/lib/tutor/correction.ts:23) est explicite :
*« aucun historique de conversation : un seul message construit ici »*. Le
maillon manquant n'est plus la donnée — **c'est la relecture**. C'est le gap le
moins cher à combler et le plus visible pour l'utilisateur.

---

## 3. L'intelligence réelle, mesurée

Une échelle, pour que « intelligent » cesse d'être un adjectif :

| Niveau | Définition |
|---|---|
| **N0 — Inerte** | Affiche ce qui a été saisi |
| **N1 — Dérivé** | Calcule à partir des faits, par des règles fixes écrites d'avance |
| **N2 — Adaptatif** | La sortie change selon l'historique **de cette personne** |
| **N3 — Auto-correctif** | Le système ajuste **ses propres paramètres** d'après ce qu'il observe |
| **N4 — Anticipatif** | Prédit, planifie, et se réorganise sur un modèle appris |

### Où en est chaque fonction

| Fonction | La carte promet | Réel | Ce qui manque pour +1 |
|---|---|---|---|
| Génération d'exercices | N2 | **N2** ✅ | Elle reçoit `difficulteConseillee` et `dimensionFaible` de la calibration ([`generation.ts:110-116`](app/src/lib/tutor/generation.ts:110)). **C'est le seul endroit réellement adaptatif du produit.** |
| État de compétence | N1 | **N1** ✅ | Conforme : dérivation pure, c'est ce qu'on veut |
| Calibration | N2 | **N2**, muette | Rien à coder — il lui faut 3 tentatives par compétence pour parler (§5, F1) |
| Recommandation | N3 « personnalisée » | **N2 limité** | Les poids restent fixes, mais les refus frais sont relus et excluent temporairement un exercice ou une compétence (`store/context.ts:166-177`). Passer N3 demande de mesurer l'effet du conseil, pas seulement de le masquer 7 jours |
| Révision espacée | N3 « adaptative » | **N1** | Facteurs constants (`FACTEUR_NIVEAU`, `FACTEUR_CONFIANCE`). `modeleFsrs = null`. Passer N2 = faire varier l'intervalle avec le résultat observé |
| Correction IA | N2 « détecte les motifs » | **N1** | Aucun historique en entrée. Passer N2 = injecter les derniers verdicts de la compétence (G-C) |
| Détection d'erreurs récurrentes | N2 | **N0** | N'existe pas |
| Planification de séance | N3 | **N0 en pratique** | La donnée n'existe pas (G-A) |
| Reporting long terme | N2 | **N1** partiel | Agrégats existants, aucun écran |
| Graphe | N1 | **N1** ✅ | Conforme |

### Le verdict

> **Le produit est en moyenne à N1,3. La carte promet N3.**
>
> Il n'y a **qu'une seule fonction adaptative** dans tout le système — la
> génération d'exercices pilotée par la calibration — et c'est précisément
> celle qui manque de matière pour s'exprimer.

Ce n'est pas un échec : N1 rigoureux vaut mieux que N3 inventé, et c'est
cohérent avec le principe fondateur. **Mais l'écart doit être dans la carte**,
sinon le dessin promet une intelligence que le produit n'a pas.

Corollaire de conception : **on ne monte pas de N1 à N3.** Chaque fonction
ci-dessus gagne un cran à la fois, et chaque cran demande une donnée que le
produit n'a pas encore. La séquence du §5 découle de là.

---

## 4. Nettoyage — la règle avant la liste

**Règle unique proposée :** *on ne supprime jamais ce qui a une preuve d'usage ;
on supprime ce qui n'en a aucune après une exposition réelle.* La coquille (§2)
n'est pas supprimable tant qu'on n'a pas distingué non-usage et bug d'écriture.

| Quoi | Lignes | Fait | Geste |
|---|---|---|---|
| `dev-todo.tsx` + route + upload | ~1 250 | Hors produit depuis ADR-019, 13 lignes en base | **Sortir du dépôt produit** (dossier `tools/` ou dépôt séparé). Il ne doit plus peser sur la CI ni sur les audits de conception |
| `chat.tsx` | 1 277 | Plus gros fichier, +94 lignes depuis l'audit design | **Extraire l'état de conversation** vers `lib/tutor/`. Cible < 600 lignes. Aucun changement fonctionnel |
| `concepteur-seance.tsx` | 1 016 | Coquille | **Ne rien toucher avant G-A.** Si bug : réparer. Si non-usage : réduire à la portion réellement utilisée |
| `text-[0.6875rem]` / `text-[0.625rem]` | 141 + 34 occurrences | Aucune échelle typographique tokenée | **2 tokens**, un remplacement mécanique. Le seul nettoyage design qui rapporte plus qu'il ne coûte |
| 7 preuves `source = manuel` | — | Vestiges du chemin retiré (ADR-038) | **Marquer dans l'interface**, ne pas supprimer : ce sont celles dont on ne connaîtra jamais l'aide reçue |
| ADR-020 (10 exercices seed) | — | **0 exercice `seed` en base** | **Acter la caducité** dans le registre. Un ADR faux est pire qu'un ADR absent |

**Environ 2 250 lignes sortent du produit sans perdre une fonction utilisée.**
Aucun de ces gestes ne demande d'arbitrage produit, sauf le troisième.

---

## 5. Ce qu'il faut construire — quoi, comment, quand

Ordonné par **ce qui débloque quoi**. Chaque entrée porte le fait qui dira si
elle a marché.

### Lot 0 — Lever l'inconnue (avant tout le reste)

**F0 — Trancher la coquille de séance.** *Comment :* créer une séance planifiée
en production, relire la ligne. Une heure. *Test :* les quatre colonnes sont
renseignées ou non. *Pourquoi d'abord :* selon la réponse, le Lot 3 est une
réparation ou une refonte, et 1 016 lignes changent de statut.

### Lot 1 — Nourrir la boucle (sans ça, rien d'autre ne compte)

**F1 — Génération par lot adossée aux trous de couverture.**
*Problème :* 95 compétences actives sans exercice ; la recommandation ne peut
que conseiller d'en générer.
*Comment :* une action « couvrir les compétences non couvertes », qui prend les
N compétences les mieux classées **sans exercice** et lance une génération par
lot, en réutilisant `construirePromptGeneration` (qui accepte déjà une liste de
demandes) et la calibration existante. Pas de nouveau moteur.
*Quand :* immédiatement après F0.
*Test qui décide :* la couverture passe de 10 % à > 60 %, et la carte
« Prochaine action » cesse de proposer « Générer » en tête.

**F2 — Freiner l'inflation du référentiel.**
*Problème :* 106 compétences actives pour 2 utilisateurs, et le référentiel
grossit plus vite que le corpus. Le moteur mesure ce qui n'existe pas.
*Comment :* soustraction. Rendre l'activation d'une compétence un geste conscient
et réversible, et afficher en permanence le rapport *actives / couvertes*.
*Test :* le nombre d'actives cesse de croître plus vite que le corpus.

> F1 et F2 sont la même décision vue des deux bouts : **soit on produit plus
> d'exercices, soit on déclare moins de compétences.** Les deux à la fois est le
> seul chemin qui tienne.

### Lot 2 — Monter l'intelligence d'un cran, là où c'est possible

**F3 — Mémoire de correction (N1 → N2).** *Comment :* injecter dans
`construirePromptCorrection` les 2-3 derniers `verdictTuteur` de la même
compétence. La donnée est déjà en base (ADR-046), le prompt est déjà construit
côté serveur. *Quand :* dès que le stock du Lot 1 produit des tentatives
répétées. *Test :* le tuteur écrit « cette erreur revient » sur un cas où elle
revient réellement — et seulement là.

**F4 — Mesurer l'effet de la recommandation (N2 → N3).**
*État réel :* les 6 refus sont déjà relus par `store/context.ts` et écartent
temporairement un exercice ou une compétence. Ce mécanisme personnalise la file,
mais n'apprend rien sur la qualité des facteurs qui ont produit le conseil.
*Comment :* conserver recommandation servie, facteurs, acceptation/refus,
activité réellement commencée et résultat. *Test :* comparer l'issue des
conseils suivis selon leurs facteurs avant de modifier un poids.

**F5 — Révision espacée pilotée par l'observé (N1 → N2).** *Comment :*
`modeleFsrs` a son emplacement réservé. *Quand :* **pas avant ~100 preuves** —
en dessous, on remplacerait une heuristique honnête par une heuristique
déguisée en modèle. Aujourd'hui : 50.

### Lot 3 — La séance (conditionné à F0)

Si bug d'écriture : réparation, et on observe l'usage pendant 30 jours avant
d'ajouter quoi que ce soit. Si non-usage : la question n'est pas « que
construire » mais **« pourquoi personne ne compose de séance alors que c'est le
pôle dominant ? »** — et la réponse ne s'écrit pas en code.

### Lot 4 — Design system (parallèle, sans dépendance)

Deux tokens typographiques (141 + 34 occurrences), les états manquants de
`classesBouton` (focus, active, loading), la variante « danger » sortie de
`compte.tsx`. Coût faible, gain immédiat sur toute page future.

---

## 6. Séquence

Pas de dates : des **portes**. Une phase ne s'ouvre pas parce que la précédente
a duré assez longtemps, mais parce que son fait de sortie est constaté.

| Phase | Contenu | Porte de sortie |
|---|---|---|
| **0** | F0 | Les quatre colonnes de séance sont expliquées |
| **1** | F1 + F2 + nettoyage (dev-todo, tokens) | Couverture > 60 % ; actives stabilisées |
| **2** | F3 + F4 | Deux fonctions passent de N1 à N2, prouvé sur un cas réel |
| **3** | Lot 3 selon F0 ; `chat.tsx` extrait | 30 jours d'usage observé sur les séances |
| **4** | F5 | ≥ 100 preuves en base |

---

## 7. Ce que cet audit ne dit pas

- **Pourquoi** personne ne compose de séance. Aucune donnée ne le dit ; F0 ouvre
  la question, il ne la referme pas.
- Si les **poids de la recommandation** sont bons. Personne ne le sait — c'est
  l'objet d'ADR-005, 🔬 depuis le 27/07.
- Ce que vaut l'**expérience** réelle : aucun parcours n'a été déroulé dans
  l'application pour cet audit. Les gaps sont lus dans le code et la base.
- Les **protocoles du tuteur** (`app/data/00_instructions/`), non lus. P6 dit
  qu'ils *sont* la spécification : un audit de conception complet doit les
  confronter à la carte.
