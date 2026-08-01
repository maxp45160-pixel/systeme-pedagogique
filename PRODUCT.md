# PRODUCT.md — Système pédagogique

**Version 2.0 — 28/07/2026.** Fusion de `PRODUCT_VISION.md` et
`PRODUCT_PRINCIPLES.md` (v1.0, 27/07), dont les démonstrations détaillées
restent dans l'historique git. Document vivant : toute modification doit
préciser ce qui passe d'une catégorie à l'autre.

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

Une **boucle** : le tuteur génère un exercice, l'exercice mesure une
compétence, la mesure oriente l'exercice suivant.

Autour d'elle, un **instrument de mesure** dont la fonction première est de
**refuser d'affirmer ce qu'il ne peut pas prouver**. L'utilisateur travaille, le
système enregistre des **preuves**, en **dérive** un niveau par compétence, et
**recommande** la prochaine action. Rien de ce qui peut être recalculé n'est
stocké.

Ce n'est pas un tracker d'habitudes, pas un LMS, pas un outil de révision. La
distinction tient en une phrase : **un tracker enregistre ce que tu déclares
avoir fait ; ce système enregistre ce qui a été observé, et en tire ce qu'il
peut honnêtement en tirer — souvent moins que ce qu'on aimerait.**

## 2. Ce que le produit n'est pas

- **Pas un outil de motivation.** L'XP et les jalons ont été supprimés le
  28/07 (ADR-017) : la vue longitudinale porte le retour de progression. Un
  score de 10/100 après trois jours de travail sérieux est une information, pas
  un échec de conception.
- **Pas un générateur de contenu pédagogique de référence.** Il ne prétend pas
  remplacer un cours ou un enseignant.
- **Pas un réseau social.** La comparaison entre utilisateurs est en tension
  directe avec le principe fondateur.
- **Pas un système d'évaluation certifiante.** Aucun niveau produit ici n'a de
  valeur institutionnelle.

## 3. La proposition de valeur, en une ligne

> Savoir **ce que tu sais réellement faire**, avec le degré de certitude qui
> va avec — et savoir quoi travailler ensuite, pour une raison qu'on peut te
> montrer.

| Promesse | État au 28/07/2026 |
|---|---|
| « ce que tu sais réellement faire » | ✅ Tenue. Le moteur est complet et testé. |
| « avec le degré de certitude » | ✅ Tenue. Niveau / confiance / robustesse sont distincts et affichés. |
| « quoi travailler ensuite » | 🟡 **La boucle a tourné en entier le 01/08** (ADR-030). La difficulté produite a suivi le conseil de la calibration sur les deux compétences où il existait — le 3ᵉ maillon est démontré. La seconde moitié du test reste à mesurer : les deux tentatives ont été abandonnées en 1 minute, donc aucune dimension n'a pu reculer. |

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
| **P5** | Le tuteur n'a aucun accès en écriture | Instructions §14 | ✅ Tenu |
| **P6** | Le protocole est la spécification | — | ✅ Tenu |
| **P7** | L'honnêteté prime sur la complétude | Anti-halluc. §14 | ✅ Tenu |
| **P8** | La qualité de la preuve conditionne tout | Anti-halluc. §2 ; éval. §5 et §6 | 🔴 Tenu formellement, **fragile en pratique** |

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

### P8 — pourquoi il est fragile

`indicesUtilises` ne compte que les indices **internes**. Toute aide extérieure
est invisible au moteur, qui enregistre néanmoins A3 « résolution autonome » :

| Preuve | Enregistré | Commentaire de l'utilisateur |
|---|---|---|
| `RO-01` | A3, 0 indice | *« J'ai eu besoin de l'aide de Claude et de ressources »* |
| `STAT-02` | A3, 0 indice | *« j'ai regardé sur internet »* |

L'utilisateur est honnête ; le moteur ne lit pas le champ commentaire. Les
niveaux dérivés sont donc **structurellement optimistes** dans une proportion
inconnue. Plus grave que P2, parce que le défaut est à l'entrée de la chaîne et
non à son agrégation. ❓ Non tranché : voir ADR-008.

## 6. Horizon

### Décidé

✅ **Le contenu vient du tuteur**, pas de fichiers écrits à la main (ADR-004).
✅ **Le moteur du tuteur doit être gratuit** et configurable (ADR-007).
✅ **Construire et utiliser en parallèle** est le mode de travail retenu.
✅ **La boucle est le produit.**
✅ **Le référentiel appartient au compte** (ADR-026, 31/07) : il n'existe aucune
liste universelle de compétences. Un compte démarre vide, déclare son sujet et
construit son arborescence avec le tuteur. Le périmètre de travail reste un
frein utile, mais par compte (`competences.active`) et non plus global.
✅ **Une preuve n'est jamais orpheline** (ADR-027) : une compétence sans preuve
se supprime, une compétence qui en porte s'archive — jamais l'inverse.
✅ **Le score porte sur ce qui est mesuré** (ADR-006) ; la couverture dit le
reste.

### Ouvert

❓ Quel moteur gratuit exactement (ADR-007) — résolu **par mesure**.
❓ La prise en compte de l'aide externe dans l'autonomie (ADR-008) — le seul
principe encore en défaut.
✅ Le 3ᵉ maillon est posé (ADR-028) et **a fonctionné le 01/08** (ADR-030) :
sur DEV-01 et DEV-03, la difficulté produite par le tuteur a suivi exactement
celle que la calibration conseillait. 🔬 *Reste de la réfutation : « la
dimension faible recule » demande un exercice réellement fait — les deux du
01/08 ont été abandonnés en 1 minute.*

⚠️ **Le premier tour complet a révélé un défaut que 194 tests n'avaient pas
vu** : le journal de preuves enregistrait les abandons comme des mesures à
zéro. Corrigé par ADR-030. Fait de méthode à retenir : faire tourner la boucle
mesure le système, pas seulement l'utilisateur.

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

🗑️ **« Corriger le score global sans arbitrage. »** P2 est une question ouverte
depuis le 27/07 (ADR-006) : la formule ne se change pas au passage d'un autre
chantier.
