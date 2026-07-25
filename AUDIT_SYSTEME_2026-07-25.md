# Audit système — 25/07/2026

Périmètre : dépôt `Système pédagogique/` en l'état actuel (après le MVP
Next.js du 24/07 et l'intégration de la synthèse du 25/07). Angle demandé :
qu'est-ce qui est inutile, qu'est-ce qui est solide, qu'est-ce qui fragilise
l'évolution à long terme — en priorisant la réduction de complexité.

**Verdict global :** l'architecture cœur (protocoles → référentiel de code →
journal de preuves append-only → moteur pur testé) est saine et ne devrait
pas être touchée. Le risque principal n'est pas dans ce cœur mais en
périphérie : une source de vérité dupliquée (fichiers `.txt` legacy vs store
JSON) qui a déjà divergé après un seul cycle de mise à jour réel, et un
fichier de configuration local versionné par erreur.

---

## 1. Points forts — à ne pas remettre en cause

- **Séparation stricte donnée observée / donnée dérivée.** Le disque ne
  contient que des preuves ; niveaux, scores, confiance, robustesse, XP sont
  recalculés à la lecture. C'est le principe le plus important du système et
  il est appliqué avec rigueur (aucune exception trouvée dans le code lu).
- **Le moteur teste littéralement les protocoles**, paragraphe par
  paragraphe (`moteur.test.ts` cite §4, §7, §9, §11, §12, §13, §16 de
  l'anti-hallucination et de l'évaluation). C'est rare et précieux : les
  protocoles ne sont pas de la prose que le tuteur peut interpréter
  librement, ils sont vérifiés.
- **Le tuteur n'a pas d'accès en écriture**, et ce n'est pas juste documenté
  dans le README : `lib/tutor/contexte.ts` l'impose dans le prompt système
  envoyé au modèle (« PROPOSITION DE MISE À JOUR », jamais d'écriture
  directe). Garde-fou réel, pas seulement déclaratif.
- **Le mode démonstration est en mémoire uniquement** et bannière en
  permanence — aucun risque de contamination du profil réel par des données
  fictives.
- **Les écrans non construits (Projets/Lectures/Connaissances) le disent
  franchement** plutôt que d'afficher une maquette avec des données
  inventées — cohérent avec le principe anti-invention appliqué au produit
  lui-même, pas seulement aux compétences de l'utilisateur.
- **Premier cycle de vie réel concluant.** L'extension du référentiel
  (39→43 compétences) et l'intégration de 6 preuves se sont propagées
  correctement dans le code et dans le contexte envoyé au tuteur (« 43
  compétences » apparaît déjà côté `contexte.ts`). Le processus fonctionne.

---

## 2. Fichiers inutiles ou à risque — avec justification

### 2.1 `app/data/01_profil/*.txt` (5 fichiers) — **legacy, déjà en dérive**

Ces fichiers ne sont lus par aucun code de l'application (vérifié :
`lib/store/db.ts` ne connaît que `data/store/*.json`). Ils ne sont donc plus
une source de vérité, seulement une prose parallèle.

Preuve concrète que cette dérive n'est pas théorique : **`01_PROFIL_COMPETENCES.txt`
affiche encore `LOG-02 | Hypothèse 0-1 | Faible | Aucune | Aucune | À évaluer`**,
alors que le store contient déjà une preuve directe (`ev-synth-log02`,
niveau réel autonome). Un seul cycle de mise à jour a suffi à les rendre
faux. Les maintenir à la main après chaque interaction est une charge de
travail récurrente, sans automatisme, pour un résultat qui sera de nouveau
faux au cycle suivant — l'inverse de « réduire la complexité et faciliter
l'évolution ».

**Ce n'est pas un problème d'exécution (je ne les ai pas mis à jour) — c'est
un problème de conception : rien ne garantit que quiconque les mette à jour,
jamais, de façon fiable.**

### 2.2 `.claude/settings.local.json` — **versionné alors qu'il ne devrait pas l'être**

Contient l'historique des autorisations de commandes shell accordées à
Claude Code sur cette machine (installation de `gh`, création du dépôt
GitHub, etc.). Le suffixe `.local` signale par convention un fichier
personnel, non partagé — et pourtant il est suivi par git
(`git ls-files` le confirme). Ce fichier va grossir à chaque nouvelle
commande autorisée, sans rapport avec l'évolution du système pédagogique
lui-même, et polluera les diffs et l'historique git au fil du temps.

### 2.3 Copie des protocoles dans la connaissance importée Claude.ai (hors dépôt)

Sans rapport avec les fichiers du dossier, mais pertinent pour la cohérence
long terme : les fichiers `00_SYSTEME_*` existent aussi, gelés en lecture
seule, dans la connaissance importée du projet Claude.ai qui alimente cette
session. Cette copie est maintenant en v1.0 alors que le dépôt est en v2.0 —
**deux sources qui divergent silencieusement.** Le dépôt git (lu par
l'application et par Claude Code) est la seule copie qui compte
opérationnellement ; la copie Claude.ai risque d'induire en erreur une
future session qui s'appuierait dessus sans regarder le dépôt réel.

### 2.4 `AGENTS.md` / `CLAUDE.md` — inoffensifs mais à ne pas confondre avec les protocoles

Boilerplate injecté par le scaffold Next.js (avertissement générique sur les
breaking changes de la version), sans rapport avec le système pédagogique.
Rien à corriger, juste à savoir : ce ne sont pas des « instructions système »
au sens du projet.

---

## 3. Points faibles — risques à surveiller, pas nécessairement à corriger maintenant

- **Gamification (XP, badges, paliers, ~500 lignes cumulées + emplacement
  dans l'UI).** Bien conçue (non-farmable, adossée à une preuve, volontairement
  secondaire visuellement) mais c'est la partie la plus éloignée de l'objectif
  central (§16 : maximiser la capacité à résoudre des problèmes nouveaux, pas
  le nombre de badges). Ce n'est pas à supprimer aujourd'hui — juste le
  premier candidat si le système doit un jour perdre du poids.
- **Trois modèles de données non exploités** (`Project`, `Reading`,
  `KnowledgeItem` dans `types.ts`, plus leurs routes et entrées de nav).
  Honnêtement présentés comme « pas encore construits », donc pas un défaut
  actuel — mais c'est de la surface spéculative. Recommandation : ne pas les
  développer avant qu'un besoin réel (un projet, une lecture en cours)
  n'existe. Construire à l'avance, c'est exactement le type de complexité que
  vous demandez de réduire.
- **IA Tutor lié à une clé API externe** (`ANTHROPIC_API_KEY`, avec repli
  « copier le contexte » si absente). C'est le seul point du système dépendant
  d'un service externe payant — pas un défaut de conception, mais le point le
  plus susceptible de casser silencieusement un jour (rotation de clé, quota,
  changement d'API).
- **`referentiel.ts` comme unique source du référentiel de compétences.**
  Correct et déjà éprouvé (extension 39→43 réussie), mais chaque évolution
  future du référentiel est un vrai changement de code (tests à repasser),
  pas une édition de données. À accepter comme coût normal de la rigueur du
  système, pas à « simplifier » en revenant à du texte libre — ce serait
  perdre la garantie de cohérence que le typage apporte.

---

## 4. Propositions, par ordre de priorité

**1. Arrêter la maintenance manuelle de `01_profil/*.txt`.**
Recommandation : ajouter en tête de chacun des 5 fichiers une bannière
« ARCHIVE — non maintenu depuis le 25/07/2026, l'état réel est dans
l'application » plutôt que de continuer à les corriger à la main à chaque
mise à jour du profil. Alternative si une vue texte lisible reste utile : en
faire un export **généré** par l'application (bouton ou script, jamais édité
à la main), horodaté, plutôt qu'un fichier vivant.

**2. Retirer `.claude/settings.local.json` du suivi git.**
`git rm --cached .claude/settings.local.json` + ajout au `.gitignore`. Le
fichier reste utile localement, il n'a juste rien à faire dans l'historique
partagé du projet.

**3. Trancher la source canonique des protocoles.**
Le dépôt git est déjà la source qui compte en pratique. Recommandation :
resynchroniser une fois la connaissance importée Claude.ai sur la version
actuelle du dépôt (v2.0), puis ne plus considérer cette copie comme un lieu
d'édition — uniquement une référence de secours.

**4. Ne pas construire Projets/Lectures/Connaissances par anticipation.**
Décision à acter plutôt qu'action de code : attendre un besoin réel avant
d'investir dans ces écrans.

**5. Ne rien changer au cœur (domain/engine/store).**
C'est la partie qui porte la garantie du système. Toute proposition de
« simplification » qui toucherait au typage strict, au calcul dérivé, ou au
garde-fou d'écriture du tuteur irait dans le mauvais sens.

---

## 5. Ce que je n'ai pas pu vérifier

`npm run verify` (tsc + eslint + tests) n'a pas pu être exécuté depuis cet
environnement : les binaires natifs installés dans `node_modules`
correspondent à la machine Windows d'origine, pas au bac à sable Linux de
cette session (`Cannot find native binding` sur `rolldown`/`vitest`). Ce
n'est pas un défaut du projet — à relancer sur votre machine ou via Claude
Code pour confirmer que les 20 tests passent toujours après les preuves
ajoutées le 25/07.
