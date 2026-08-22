# Simulation persona — adulte en reconversion autodidacte

**Version 1.0 — 22/08/2026. Simulation d'évaluation, aucune décision validée.**

> Persona dérivé de la méthode du persona académique (v1.1, même jour). Les
> verdicts s'appuient sur la relecture de code commune ; les étapes qui
> dépendent d'une sortie du tuteur sont des hypothèses non réfutées.

## 1. Persona

Sofia, 34 ans, assistante de gestion, se reconvertit vers un poste de data
analyste. Objectif : être recrutable dans six mois, sans diplôme visé ni examen
daté. Elle apprend seule le soir : Python, SQL, statistiques descriptives.
Ressources éparses : un cours en ligne (vidéos), un manuel PDF, des exercices
trouvés çà et là. Temps disponible très variable : 20 min un mardi, 2 h le
dimanche.

## 2. Scénario en huit gestes

| # | Geste |
|---|---|
| S0 | Créer un compte, déclarer l'intention (« devenir data analyst ») → référentiel proposé |
| S1 | Organiser trois domaines d'apprentissage autonomes |
| S2 | Anciller le travail sur ses ressources réelles (vidéo, PDF, web) |
| S3 | Pratiquer par sessions de durée très variable |
| S4 | Reprendre après dix jours d'interruption sans culpabiliser |
| S5 | Savoir si elle approche de l'« employabilité » |

Verdicts : ✅ fluide · 🟡 faisable avec friction · ❌ bloqué · 🔬 hypothèse non testable sans exécution du tuteur.

## 3. Walkthrough détaillé

### S0/S1 — Intention large, trois domaines — 🔬 / 🟡

À l'amorçage, la phrase peut porter plusieurs branches en un geste (pas de
plafond sans domaine vivant, `outils.ts:767`). Le risque est inverse du persona
académique : « devenir data analyst » est une intention de projet plus que de
compétences ; le tuteur choisit le genre (`intention.ts:49`) et pourrait basculer
vers « projet » plutôt que proposer un référentiel. Hypothèse non réfutée. En
compte établi, l'ajout des deux derniers domaines subit le plafond
(`BRANCHES_MAX_COMPTE_ETABLI = 2`, `outils.ts:754`) — juste ici.

### S2 — Ressources réelles — 🟡

- le manuel PDF passe (fiche `cours`, pièce jointe ≤ 10 Mo) ;
- la vidéo et le cours en ligne n'ont aucun accueil : pas de lien web type
  document, pas de lecture. Sofia notera « chapitre 3 vu » à la main ;
- le corpus ne regroupe ni par source ni par progression dans le cours suivi
  (corpus plat, déjà constaté en S4 académique).

Le produit assume que l'exercice prime sur le consumisme de contenu — cohérent,
mais le geste « j'ai regardé le chapitre 3, fais-moi travailler dessus » demande
de reformuler à chaque fois.

### S3 — Durées très variables — ✅

Le contexte instant déclaré (temps + capacité) pilote la composition, et le
tableau de bord propose une action unique avec pistes alternatives. C'est le
persona pour lequel l'arbitre du jour est le mieux adapté : aucune structure
extérieure (emploi du temps, échéance) à laquelle il devrait être sensible.

### S4 — Reprise après interruption — ✅ / 🔬

Aucune pénalité de rupture : une faiblesse ne disparaît pas sans nouvelle
démonstration (invariant 4), donc les acquis dégradés restent visibles et
représentables. La reprise des travaux ouverts existe sur le tableau de bord.
Hypothèse : l'absence totale de notion d'objectif rend la reprise motivationnel-
lement flottante — rien ne rappelle pourquoi Sofia fait cela. Le produit assume
cette position (PRODUCT.md §2) ; c'est un arbitrage, pas un défaut.

### S5 — Employabilité — ❌ (assumé)

Aucun objectif long terme : les objectifs structurés sont retirés (ADR-096),
et « être recrutable » n'est de toute façon pas une compétence démontrable par
exercice. Le produit ne promet qu'une chose mesurable : ce qui a été démontré,
quand, avec quelle autonomie. Pour ce persona, l'écart est assumé et acceptable
— mais il faut le dire : l'app montrera « SQL solide », jamais « prête pour
l'entretien ».

## 4. Scorecard

| # | Geste | Verdict | Cause racine |
|---|---|---|---|
| S0/S1 | Intention → trois domaines | 🔬 / 🟡 | genre d'intention ambigu pour un projet de vie ; plafond OK ensuite |
| S2 | Ancrer sur ressources réelles | 🟡 | PDF seul ; vidéo/web sans accueil ; corpus plat |
| S3 | Durées variables | ✅ | contexte instant bien consommé |
| S4 | Reprise après coupure | ✅ | invariants favorables ; flou motivationnel assumé |
| S5 | Sentir la progression vers l'objectif | ❌ assumé | pas de fait daté ni d'objectif (ADR-096) |

**Conclusion générale.** Le persona le mieux servi des quatre nouveaux : son
usage tient presque entièrement dans la boucle apprendre, sans engagement daté
ni structure externe. Les frictions restantes portent sur l'ancrage aux
ressources réelles, pas sur le moteur.

## 5. Écarts classés — hypothèses à arbitrer, pas des chantiers ouverts

1. **Accueil des ressources non-PDF (couvre S2).** Un simple document-lien
   (URL + titre + rattachement) serait peu coûteux mais crée un nouveau type
   de ressource : arbitrage produit avant tout code.
2. **Intention projet vs compétences (S0/S1).** Vérifier expérimentalement ce
   que le tuteur fait d'une phrase comme « devenir data analyst » avant toute
   retouche du formulaire d'amorçage.
