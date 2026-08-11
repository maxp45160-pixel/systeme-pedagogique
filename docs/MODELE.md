# Modèle pédagogique et modèle de mesure

**Version 0.1 — 11/08/2026.** Livrable de la mission ⑤. Ce document décrit ce que le dépôt implémente ; il ne transforme aucune hypothèse en décision. Les chemins sont relatifs à `app/src/` sauf mention contraire.

## A — Théorie pédagogique effectivement assumée

### A1. Répétition espacée 🔬

Le produit suppose qu'une compétence doit être remobilisée selon un intervalle qui croît avec son niveau, sa robustesse et sa confiance, et qui diminue après un résultat non abouti. L'implémentation active est une heuristique transparente :

```text
intervalle = arrondi(
  1 jour
  × facteur_niveau
  × (1 + 3 × robustesse)
  × facteur_confiance
  × facteur_dernier_résultat
)
```

L'intervalle vaut au moins un jour. Une compétence sans preuve est à diagnostiquer, jamais « due pour révision ». `estDue` alimente ensuite la recommandation avec un signal binaire fort.

Implémentation : `lib/engine/spaced.ts`, `lib/engine/recommend.ts`. Vérification : `lib/engine/spaced.test.ts`, `lib/engine/moteur.test.ts`.

Limite assumée : `modeleFsrs` vaut `null`. Aucun modèle de mémoire calibré n'est implémenté ; l'heuristique reste 🔬.

### A2. Transfert par contexte ✅ pour la règle, 🔬 pour les seuils

Le niveau n'augmente pas seulement avec la répétition. Le niveau 4 exige au moins deux réussites autonomes A3+ portant une dimension de transfert ≥ 0,6 dans au moins deux contextes distincts. Le moteur de recommandation ajoute aussi un facteur de transfert lorsqu'un niveau ≥ 3 n'a été observé que dans un seul contexte.

Implémentation : `lib/engine/skill-state.ts` (`niveauSoutenu`), `lib/engine/recommend.ts`. Vérification : `lib/engine/moteur.test.ts`.

La règle « plusieurs contextes » est implémentée ; le seuil 0,6 et le nombre de deux contextes n'ont pas de validation externe au protocole et restent réfutables.

### A3. Autonomie mesurée avant d'être demandée ✅ ; barème 🔬

Le produit ne demande pas à la personne de choisir A0–A4. Il dérive d'abord l'autonomie des indices internes : tous les indices → A1, au moins un sans les épuiser → A2, aucun → A3. Une aide extérieure déclarée plafonne ensuite ce résultat ; le minimum des deux signaux l'emporte.

ADR-057 étend la cible : les sollicitations du tuteur et toute autre aide interne réellement traçable doivent être mesurées avant de demander à la personne ce que le produit ne peut pas voir. Cette extension n'est pas encore implémentée comme trace par tentative. L'absence de trace ne doit jamais valoir « aucune aide ».

Implémentation actuelle : `lib/engine/preuve.ts`, `lib/store/actions.ts`, `components/exercices/formulaire-bilan.tsx`. Vérification : `lib/engine/moteur.test.ts`, `lib/domain/tentative.test.ts`.

Le principe est décidé ; `PLAFOND_AIDE` reste 🔬 faute de confrontation à l'usage.

### A4. Difficulté ajustée par la performance observée 🔬

La prochaine difficulté vient d'abord de `calibrer`, puis du niveau à défaut. La calibration relit le résultat, les indices et la durée réellement constatée. Elle distingue : non tentée, trop facile, calibrée, trop difficile. Elle produit aussi la dimension la plus faible afin de changer l'angle de l'exercice, pas seulement sa difficulté.

Une difficulté ne monte ou ne baisse qu'après deux signaux concordants dans une fenêtre de trois tentatives. Dès deux durées exploitables sur le même exercice, leur médiane remplace l'estimation du tuteur comme référence.

Implémentation : `lib/engine/calibration.ts`, `lib/engine/recommend.ts`, `lib/tutor/generation.ts`. Vérification : `lib/engine/calibration.test.ts`, `lib/tutor/generation.test.ts`.

La boucle code → mesure → difficulté suivante est testée. Les seuils restent 🔬.

### A5. Composition et action plutôt que plan abstrait ✅

`composerSeance` utilise le classement unique de `recommander`, respecte une portée mono, transverse ou thématique et expose les activités manquantes lorsque le corpus ne permet pas de remplir la séance. `LearningSession` demeure l'unique entité de séance. ADR-059 décide que créer une séance conduit au workspace focus, encore non construit.

Implémentation : `lib/domain/seance.ts`, `lib/engine/caf.ts`. Vérification : `lib/domain/seance.test.ts`, `lib/engine/caf.test.ts`.

## B — Modèle de mesure

### B1. Sources admissibles

| Source | Nature | Champs consommés | Ce qu'elle ne permet pas d'affirmer |
|---|---|---|---|
| `Skill` | Déclarée, couche 1 | code, domaine, palier, importance, prérequis, ordre | Aucun niveau ni résultat |
| `ExerciseAttempt` | Observée, couche 2 | début/fin, statut, durée réelle, résultat, indices, évaluation | Une tentative abandonnée ne produit aucune preuve |
| `SkillEvidence` A ou B | Observée, couche 2 | compétence, résultat, dimensions, autonomie, qualité, contexte, date, source | Les preuves C et D ne soutiennent aucun niveau |
| Aide extérieure | Déclarée comme fait | aucune, documentation, assistant IA, correction | La personne ne choisit pas son palier A0–A4 |
| Horloge injectée | Paramètre de calcul | date de calcul | Le temps n'efface jamais une preuve ni un niveau |
| Référentiel du compte | Déclaré | périmètre actif et total | Le moteur ne connaît aucun référentiel global |

Chaque `SkillEvidence` doit porter `source.kind` et `source.ref`. Les données venant de Supabase sont converties et validées dans `lib/store/supabase-backend.ts` avant d'entrer dans le moteur.

### B2. Niveau

`computeSkillState(skill, preuves, now)` filtre les preuves de la compétence aux niveaux de preuve A et B, les trie par date, puis choisit le niveau le plus élevé soutenu :

| Niveau | Condition implémentée |
|---|---|
| `null` | aucune preuve recevable ; aucun score n'est fabriqué |
| 0 — Exposition | au moins une preuve, mais aucune condition supérieure satisfaite |
| 1 — Compréhension | au moins une preuve non échouée avec compréhension ≥ 0,6 |
| 2 — Application guidée | au moins une réussite avec application ≥ 0,6 et autonomie ≥ A1 |
| 3 — Application autonome | au moins deux réussites avec application ≥ 0,7 et autonomie ≥ A3 |
| 4 — Transfert | au moins deux réussites A3+, transfert ≥ 0,6, dans au moins deux contextes |
| 5 — Intégration | au moins une réussite combinant une autre compétence, intégration ≥ 0,6 et justification ≥ 0,6 |

Régression : une difficulté n'est confirmée que si au moins trois preuves existent et que les deux plus récentes sont des échecs en autonomie A2+. Le niveau baisse alors d'un palier. Un échec isolé réduit la confiance, pas le niveau.

Code : `lib/engine/skill-state.ts`. Tests : `lib/engine/moteur.test.ts`.

### B3. Confiance

La confiance est ordinale : nulle, faible, moyenne, forte.

- nulle : aucune preuve recevable ;
- forte : au moins 4 preuves, 3 contextes et 2 preuves A3+ ;
- moyenne : au moins 2 preuves et 2 contextes ;
- faible : tous les autres cas évalués ;
- une ou plusieurs contradictions retirent un échelon ;
- une dernière preuve vieille de plus de 120 jours retire un échelon ;
- au niveau global, une couverture inférieure à 25 % plafonne la confiance à faible.

La confiance module le score par `0 / 0,85 / 0,95 / 1` pour nulle / faible / moyenne / forte.

Code : `lib/engine/skill-state.ts`, `lib/engine/progression.ts`. Tests : `lib/engine/moteur.test.ts`.

### B4. Robustesse

La robustesse est continue dans `[0,1]` et distincte du niveau :

```text
robustesse =
  0,25 × min(1, réussites / 5)
+ 0,20 × min(1, contextes / 3)
+ 0,20 × moyenne(poids_autonomie)
+ 0,15 × max(0,3 ; 0,5^(jours / 120))
+ 0,10 × réussite_après_21_jours
+ 0,10 × transfert_observé
```

Un transfert est observé si une réussite est de type `transfert` ou porte une dimension transfert ≥ 0,6. Une réussite après délai vaut 1 dès que deux réussites consécutives sont espacées d'au moins 21 jours.

Code : `lib/engine/skill-state.ts`, `lib/engine/dates.ts`. Tests : `lib/engine/moteur.test.ts`.

### B5. Dimensions et score par compétence

Pour chaque dimension documentée, la valeur est une moyenne pondérée :

```text
poids_preuve = poids_autonomie × poids_qualité × facteur_récence
dimension = Σ(valeur × poids_preuve) / Σ(poids_preuve)
score = arrondi_0,1(5 × Σ(poids_dimension × dimension) × modulation_confiance)
```

Poids des dimensions : compréhension 0,30 ; application 0,25 ; transfert 0,20 ; intégration 0,15 ; justification 0,10. Poids d'autonomie : A0 0 ; A1 0,25 ; A2 0,55 ; A3 0,85 ; A4 1. Poids de qualité : faible 0,35 ; moyenne 0,70 ; forte 1.

Dans une compétence déjà évaluée, une dimension absente est actuellement représentée par 0 dans `calculerDimensions`. Cette convention est un fait de code, pas une validation théorique ; l'audit ⑥ devra vérifier sa compatibilité avec P2.

Code : `lib/domain/types.ts`, `lib/engine/skill-state.ts`. Tests : `lib/engine/moteur.test.ts`.

### B6. Couverture et agrégats

```text
couverture = compétences évaluées / compétences du périmètre
score_global = 100 × Σ(importance × score/5) / Σ(importance)
```

Les deux sommes du score global portent uniquement sur les compétences évaluées. Sans compétence évaluée, score et niveau moyen valent `null`, jamais zéro. Les compétences non mesurées restent en veille et ne modifient que la couverture.

Code : `lib/engine/progression.ts`. Tests : `lib/engine/moteur.test.ts`.

### B7. Maîtrise

```text
maîtrisée ⇔ niveau ≥ 4 ∧ confiance ∈ {moyenne, forte}
```

La maîtrise est un prédicat dérivé, jamais stocké. Une contradiction ou une preuve trop ancienne peut la retirer via la confiance sans effacer le niveau.

Code : `lib/engine/maitrise.ts`. Tests : `lib/engine/maitrise.test.ts`. Statut : 🔬 ADR-042.

### B8. Calibration et difficulté visée

- tentative non réussie menée moins de 25 % de la durée estimée : `non-tentee` ;
- réussite sans indice sous 60 % de la durée de référence : `trop-facile` ;
- échec mené : `trop-difficile` ;
- partiel ou réussite ne satisfaisant pas le cas précédent : `calibre` ;
- deux signaux concordants sont requis pour déplacer la difficulté de ±1 ;
- la difficulté reste bornée à 1–5 ;
- la dernière tentative exploitable commande le sens ;
- à défaut de calibration, difficulté par niveau : `null/0/1 → 2`, `2 → 3`, `3 → 4`, `4/5 → 5`.

Code : `lib/engine/calibration.ts`, `lib/engine/recommend.ts`. Tests : `lib/engine/calibration.test.ts`.

## C — Registre des seuils et tests de réfutation

Les tests unitaires cités vérifient que le code applique la règle. Le « test de réfutation » ci-dessous est différent : c'est l'observation qui montrerait que la règle pédagogique doit être revue. Tant qu'un seuil n'a pas subi ce test, il reste 🔬 même si son implémentation est verte.

| Seuil / barème | Valeur et effet | Source / test logiciel | Test de réfutation |
|---|---|---|---|
| Recevabilité | seules preuves A/B | `skill-state.ts` ; `moteur.test.ts` | Des preuves C/D vérifiées ultérieurement prédisent mieux la performance que les A/B sans augmenter les faux positifs. |
| Paliers 1–5 | 0,6 ; 0,7 ; nombres de preuves et contextes décrits en B2 | `skill-state.ts` ; `moteur.test.ts` | Les personnes placées de part et d'autre d'un seuil ne se distinguent pas lors d'une tâche indépendante correspondant au palier. |
| Régression | ≥3 preuves, deux derniers échecs A2+ ; baisse de 1 | `skill-state.ts` ; `moteur.test.ts` | Le mécanisme baisse fréquemment un niveau après un incident transitoire, ou ne baisse pas avant des échecs répétés observés. |
| Confiance | moyenne : 2 preuves/2 contextes ; forte : 4/3/2 autonomes ; −1 contradiction ou >120 j | `skill-state.ts` ; `moteur.test.ts` | Les taux de réussite futurs ne sont pas ordonnés nulle < faible < moyenne < forte, ou le déclassement à 120 jours ne change pas le risque d'échec. |
| Couverture globale | <25 % plafonne à faible | `progression.ts` ; `moteur.test.ts` | Une confiance globale supérieure reste calibrée et compréhensible sous 25 %, ou le plafond reste trop permissif au-dessus. |
| Récence | demi-vie 120 j, plancher 0,3 | `dates.ts`, `skill-state.ts` ; `moteur.test.ts` | La probabilité de remobilisation observée décroît selon une autre échelle ou continue sous le plancher. |
| Robustesse | poids 0,25/0,20/0,20/0,15/0,10/0,10 ; caps 5 réussites, 3 contextes ; délai 21 j | `skill-state.ts` ; `moteur.test.ts` | La robustesse ne classe pas les compétences selon leur réussite après délai et changement de contexte. |
| Poids des dimensions | 0,30/0,25/0,20/0,15/0,10 | `domain/types.ts`, `skill-state.ts` ; `moteur.test.ts` | Le score pondéré prédit moins bien une tâche globale que des poids alternatifs préenregistrés. |
| Poids autonomie / qualité | A0–A4 : 0/0,25/0,55/0,85/1 ; qualité : 0,35/0,70/1 | `domain/types.ts` ; `moteur.test.ts` | À niveau de tâche comparable, ces poids n'ordonnent pas la réussite autonome future. |
| `NIVEAU_MAITRISE` | 4, avec confiance moyenne ou forte | `maitrise.ts` ; `maitrise.test.ts` | Les compétences déclarées maîtrisées échouent régulièrement lors d'un transfert indépendant ou après délai. |
| `FACTEUR_NIVEAU` | niveaux 0–5 : ×1/1/2/4/8/16 | `spaced.ts` ; `spaced.test.ts` | Les intervalles produisent trop d'échecs de rappel aux niveaux élevés ou des révisions redondantes aux niveaux faibles. |
| Facteurs de révision | robustesse `1+3r` ; confiance 0,5/0,5/1/1,5 ; résultat 0,5/0,75/1 | `spaced.ts` ; `spaced.test.ts` | La réussite à l'échéance ne varie pas dans le sens prévu avec robustesse, confiance et dernier résultat. |
| `FRACTION_NON_TENTEE` | 0,25 ; hors réussite, en dessous aucune preuve ni calibration | `calibration.ts` ; `calibration.test.ts` | Des tentatives sous 25 % contiennent régulièrement un travail exploitable, ou des abandons au-dessus de 25 % polluent les preuves. |
| `FRACTION_TROP_FACILE` | 0,60, réussite sans indice | `calibration.ts` ; `calibration.test.ts` | Les tentatives classées trop faciles ne se distinguent pas des calibrées en réussite, effort ou transfert ultérieur. |
| Fenêtre de calibration | 3 tentatives | `calibration.ts` ; `calibration.test.ts` | La fenêtre réagit au bruit ou ignore durablement un changement réel de niveau. |
| Référence observée | médiane dès 2 durées | `calibration.ts` ; `calibration.test.ts` | Deux durées rendent plus souvent la référence instable qu'elles ne corrigent l'estimation du tuteur. |
| `SIGNAUX_CONCORDANTS` | 2 verdicts de même sens | `calibration.ts` ; `calibration.test.ts` | La difficulté oscille encore trop, ou réagit trop tard à une évolution confirmée. |
| `PLAFOND_AIDE` | documentation → A2 ; assistant IA → A1 ; correction → A0 ; aucune → A4 sans relever les indices | `preuve.ts` ; `moteur.test.ts` | À tâche comparable suivante sans aide, les groupes ne s'ordonnent pas comme A2/A1/A0 ou un plafond déforme systématiquement l'autonomie réelle. |
| Difficulté par niveau | `null/0/1→2`, `2→3`, `3→4`, `4/5→5` | `recommend.ts` ; `calibration.test.ts` | En absence de calibration, la difficulté proposée échoue à maintenir un taux de réussite utile par niveau. |
| Bonus de recommandation | actionnable +10 ; due +40 ; récente −15 ; confiance +12 ; transfert +18 ; robustesse +14 ; prérequis −12 chacun | `recommend.ts` ; `moteur.test.ts` | Le classement observé privilégie systématiquement l'actionnabilité au besoin pédagogique, ou propose des actions impossibles malgré le bonus. |

## D — Inconnues conservées

- Le barème d'aide n'a pas été confronté à l'usage (Q-02).
- Les hésitations et stratégies doivent être observées, mais aucun fait ni schéma n'est défini (ADR-060).
- Aucun signal suffisant ne fonde une détection de triche (Q-05).
- Le seuil de répétition d'un motif d'erreur n'est pas décidé (Q-06).
- La replanification demeure une question de périmètre et d'autorité (Q-13).
- Les rapports, analytics, formats de ressources et le moteur gratuit exact restent ouverts (Q-14 à Q-17).

Ces inconnues ne sont pas des zéros et ne sont pas comblées par une valeur par défaut.
