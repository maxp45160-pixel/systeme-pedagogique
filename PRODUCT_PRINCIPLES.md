# PRODUCT_PRINCIPLES.md — Système pédagogique

**Version 1.0 — 27/07/2026.**

Les principes ci-dessous ne sont pas des intentions : ce sont des contraintes
**vérifiables dans le code**. Chacun porte :

- son **énoncé** ;
- sa **source** (`app/data/00_instructions/`, protocoles vivants lus tels quels
  par le tuteur) ;
- son **application effective** (fichier, mécanisme) ;
- son **état réel**, y compris les endroits où il n'est **pas** tenu.

La dernière colonne est la plus importante. Un principe dont on ne connaît pas
les violations n'est pas un principe, c'est un slogan.

---

## P1 — Rien de ce qui peut être dérivé n'est stocké

**Énoncé.** Le disque ne contient que des faits observés : preuves, tentatives,
séances. Niveaux, scores, confiance, robustesse, XP, jalons et recommandations
sont recalculés à chaque lecture.

**Source.** Instructions principales ; transcrit en tête de
`lib/domain/types.ts`.

**Application.** `lib/engine/` est pur, sans I/O. `SkillState` n'existe qu'en
mémoire. Le schéma PostgreSQL ne comporte aucune colonne de niveau ou de score.

**État.** ✅ **Tenu sans exception.** C'est le principe le plus solide du
projet et celui dont tous les autres dépendent. Vérifié : aucune table ne
persiste de valeur dérivée.

**Ce qui le menacerait.** Toute optimisation de performance par
« matérialisation » des niveaux en base. Si la lenteur devient un problème, la
réponse est la déduplication d'appels et le cache de requête — **jamais** la
persistance d'un dérivé.

---

## P2 — L'absence de mesure n'est pas un zéro

**Énoncé.** Sans preuve, le système affiche `—`. Jamais `0/100`, qui
prétendrait avoir mesuré.

**Source.** Protocole anti-hallucination §7 et §14.

**Application.** `SkillState.niveau` et `.score` sont `NiveauCompetence | null`.
`computeSkillState` retourne explicitement `null` en l'absence de preuve
recevable (`skill-state.ts:311`).

**État.** ⚠️ **Tenu par compétence. Non tenu en agrégat.**

C'est la contradiction interne la plus sérieuse du système, et elle porte sur
le nombre le plus visible de l'application.

`calculerEtatGlobal` (`lib/engine/progression.ts:128`) calcule :

```
acquis     = Σ importance × (score / 5)   sur les 43 compétences
poidsTotal = Σ importance                 sur les 43 compétences
scoreGlobal = acquis / poidsTotal × 100
```

Les 31 compétences sans preuve entrent au **numérateur pour 0** et au
**dénominateur pour leur importance pleine**. Non mesuré y vaut donc
exactement zéro — ce que §7 interdit.

Trois nuances honnêtes, qui atténuent sans annuler :

1. La réserve affichée le dit (« comptées comme non acquises, jamais comme
   échec »).
2. `niveauMoyen` (0,9/5) existe en complément et ne porte que sur le mesuré.
3. Le score est `null` tant qu'**aucune** preuve n'existe — la règle est donc
   appliquée au cas limite.

Deux conséquences qui restent, elles, entières :

- **Le score est anti-corrélé à l'ambition.** Élargir le référentiel fait
  baisser le score de tout le monde, sans qu'aucune compétence n'ait été
  perdue. Ce piège se déclenchera précisément lors de la généralisation.
- Un instrument dont la vertu affichée est de ne pas confondre ignorance et
  incompétence affiche **10/100** en confondant exactement les deux.

❓ **Question ouverte** — voir `ARCHITECTURE_DECISIONS.md` ADR-006. Non tranché.

---

## P3 — Aucune valeur sans source

**Énoncé.** Tout indicateur affiché doit pouvoir répondre à « d'où vient ce
nombre ? », en listant les preuves dont il découle et les réserves associées.

**Source.** Protocole anti-hallucination §4 (règle de traçabilité).

**Application.** `Explication` est un **champ obligatoire** de `SkillState` —
donc non contournable par construction. Le composant `Depliant`
(`components/ui/explication.tsx`) l'expose derrière « Pourquoi ? ».

**État.** ✅ **Tenu.** Y compris pour la recommandation, dont la justification
est assemblée à partir des facteurs réellement dominants
(`recommend.ts:196`), et non rédigée d'avance.

⚠️ **Réserve de qualité, pas de principe.** La justification produite est
aujourd'hui quasi identique partout : sur les 8 premières recommandations,
la phrase *« elle est centrale pour ton objectif Master ITI »* apparaît 6 fois.
Le mécanisme est correct ; son pouvoir informatif est faible. Cause en ADR-005.

---

## P4 — Une faiblesse ne disparaît pas sans démonstration

**Énoncé.** Les preuves contradictoires sont conservées. Elles réduisent la
**confiance**, pas le niveau. Un niveau ne recule que sur difficulté confirmée.

**Source.** Protocole anti-hallucination §5 et §6 ; protocole d'évaluation §9.

**Application.** `contradictions` est un champ de `SkillState`, jamais purgé.
`difficulteConfirmee()` exige **deux échecs consécutifs en autonomie A2+**
avant de retirer un palier (`skill-state.ts:121`). Les erreurs sont archivées,
jamais supprimées (`ErrorItem.archivee`).

**État.** ✅ **Tenu.** Vérifié dans le code et couvert par les tests.

---

## P5 — Le tuteur n'a aucun accès en écriture

**Énoncé.** Le tuteur ne modifie jamais le profil. Il émet une **proposition
structurée** que l'utilisateur valide lui-même.

**Source.** Protocole anti-hallucination §4 ; `CONSIGNES_INTERFACE` dans
`lib/tutor/contexte.ts`.

**Application.** Structurelle, pas conventionnelle : **aucun import de
`lib/store/actions.ts` depuis `lib/tutor/`** (vérifié). La boucle est
proposition → `extrairePropositions()` → formulaire pré-rempli → validation
humaine → écriture.

**État.** ✅ **Tenu**, et c'est le garde-fou le mieux conçu du système.

**Portée à préciser.** Ce principe dit que le tuteur ne peut pas écrire *sans
validation*. Il ne dit pas que le tuteur ne peut rien proposer. Étendre la
boucle aux **exercices** (ADR-004) ne l'affaiblit pas tant que la validation
humaine reste sur le chemin — un exercice est d'ailleurs un fait observé
(« cet énoncé a été proposé le J »), pas une donnée dérivée.

---

## P6 — Le protocole est la spécification

**Énoncé.** `app/data/00_instructions/*.txt` est lu **tel quel** par le tuteur
et transcrit règle par règle dans le moteur. Chaque seuil cite le paragraphe
qui l'impose.

**Source.** Le dispositif lui-même.

**Application.** `lib/tutor/contexte.ts` lit les fichiers sans reformulation.
Les tests citent littéralement les paragraphes (§4, §7, §9, §11, §12, §13,
§16). `verify` est vert : **36 tests** au 27/07.

**État.** ✅ **Tenu.** Conséquence directe : **ne jamais modifier un seuil du
moteur sans modifier le protocole correspondant, et réciproquement.**

⚠️ **Point de fragilité.** Rien n'empêche mécaniquement la divergence : c'est
une discipline, pas une contrainte. Un test qui vérifierait que chaque
constante du moteur référence un paragraphe existant reste à écrire.

---

## P7 — L'honnêteté prime sur la complétude

**Énoncé.** Un écran non construit doit le dire. Une donnée absente doit être
absente. On ne fabrique jamais de contenu de remplacement.

**Source.** Protocole anti-hallucination §1 et §3.

**Application.** Les écrans Projets / Lectures / Connaissances annoncent
franchement qu'ils n'existent pas (`page-a-venir.tsx`) et sont relégués en
section « Bientôt » distincte. Le mode démonstration est signalé par un bandeau
permanent et ne touche jamais les données réelles. Un fichier de journal
corrompu renvoie la valeur vide, jamais des données inventées
(`db.ts:144`).

**État.** ✅ **Tenu.**

---

## P8 — La qualité de la preuve conditionne tout

**Énoncé.** Le système ne vaut que ce que valent ses preuves. Une preuve porte
son niveau (A directe / B indirecte / C déduction / D hypothèse), son autonomie
(A0–A4) et sa qualité intrinsèque. Seules A et B entrent dans le calcul.

**Source.** Protocole anti-hallucination §2 ; protocole d'évaluation §5 et §6.

**Application.** `estRecevable()` filtre C et D (`skill-state.ts:42`).
L'autonomie est **déduite du nombre d'indices consultés** dans l'exercice,
pas déclarée.

**État.** 🔴 **Tenu formellement, fragile en pratique.** C'est le principe le
plus important du système et celui dont la mise en œuvre est la plus faible.

`indicesUtilises` ne compte que les indices **internes à l'application**. Toute
aide extérieure — Claude, moteur de recherche, ancien cours, camarade — est
invisible au moteur. Les données réelles le montrent, dans les mots de
l'utilisateur lui-même :

| Preuve | Autonomie enregistrée | Indices internes | Commentaire libre de l'utilisateur |
|---|---|---|---|
| `RO-01` (27/07) | **A3 — « résolution autonome »** | 0 | *« J'ai eu besoin de l'aide de Claude et de ressources (internet, anciens cours…) »* |
| `STAT-02` (25/07) | **A3 — « résolution autonome »** | 0 | *« j'ai regardé sur internet »* |

L'utilisateur est parfaitement honnête. **Le moteur, lui, ne peut pas lire le
champ commentaire.** Il enregistre A3 et en dérive un niveau.

Conséquence : les niveaux dérivés sont **structurellement optimistes** dans une
proportion inconnue. Pour un système dont la valeur entière est de ne pas se
mentir, c'est le défaut le plus grave identifié à ce jour — plus grave que P2,
parce qu'il touche l'entrée de la chaîne et non son agrégation.

❓ **Question ouverte** — voir ADR-008. Non tranché.

---

## Récapitulatif

| # | Principe | État |
|---|---|---|
| P1 | Rien de dérivable n'est stocké | ✅ Tenu |
| P2 | L'absence de mesure n'est pas un zéro | ⚠️ Tenu par compétence, violé en agrégat |
| P3 | Aucune valeur sans source | ✅ Tenu (pouvoir informatif faible) |
| P4 | Une faiblesse ne disparaît pas sans démonstration | ✅ Tenu |
| P5 | Le tuteur n'écrit jamais | ✅ Tenu |
| P6 | Le protocole est la spécification | ✅ Tenu (par discipline) |
| P7 | L'honnêteté prime sur la complétude | ✅ Tenu |
| P8 | La qualité de la preuve conditionne tout | 🔴 Fragile — angle mort sur l'aide externe |

**Règle de préséance.** En cas de conflit entre un principe et une
fonctionnalité, le principe gagne, ou bien le principe est modifié
explicitement dans ce document — jamais contourné silencieusement.
