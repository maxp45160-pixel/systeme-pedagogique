/**
 * Exercices de diagnostic initial.
 *
 * Deux lots, tous deux `origine: "seed"` par exception à ADR-004 (le circuit
 * tuteur → exercice n'est pas câblé) :
 *
 * 1. Le lot d'origine (STAT/LOG/PROD/ALGO/RO/SYSC/TECH) — un exercice par
 *    compétence listée dans `01_PLAN_EVALUATION_INITIALE.txt` (supprimé le
 *    27/07/2026 ; l'ordre survit dans `ORDRE_DIAGNOSTIC`), dans l'ordre de
 *    priorité qu'il fixe.
 * 2. Le lot DEV-01→10 (ADR-020, 29/07/2026) — dix compétences transférables
 *    de lecture/maintenance de code, amorçant le nouveau périmètre pilote.
 *
 * Objectif de ces exercices : SITUER un niveau réel, pas seulement enseigner
 * — d'où des énoncés courts, sans aide préalable, et une correction qui
 * distingue méthode et résultat.
 *
 * Les indices sont ordonnés du plus léger au plus explicite et se débloquent
 * un par un (instructions §9 : ne pas donner la solution immédiatement).
 */

import type { Exercise } from "@/lib/domain/types";

export const EXERCICES_DIAGNOSTIC: Exercise[] = [
  /* ------------------------------- STAT-01 ------------------------------ */
  {
    id: "diag-stat-01",
    titre: "Décrire une série de temps de cycle",
    domaine: "statistiques",
    type: "probleme",
    difficulte: 2,
    competences: ["STAT-01"],
    dureeEstimeeMin: 20,
    diagnostic: true,
    origine: "seed",
    enonce: `Un poste d'assemblage a été chronométré douze fois dans la journée. Les temps de cycle relevés, en minutes, sont donnés ci-contre.

Le responsable de production souhaite communiquer « le temps de cycle du poste » à un client, sous la forme d'une valeur centrale accompagnée d'une mesure de dispersion.

1. Calcule les indicateurs de tendance centrale et de dispersion que tu juges pertinents.
2. Choisis ceux que tu retiendrais pour cette communication, et justifie ce choix.
3. Que conclus-tu sur la série elle-même ?`,
    donnees: [
      { libelle: "Temps de cycle (min)", valeur: "42 · 38 · 45 · 41 · 39 · 44 · 40 · 43 · 78 · 41 · 39 · 42" },
      { libelle: "Effectif", valeur: "n = 12" },
    ],
    indices: [
      "Range la série par ordre croissant avant tout calcul. Que remarques-tu ?",
      "Compare la moyenne et la médiane. Un écart important entre les deux est une information, pas un détail de calcul.",
      "Un point est atypique si sa valeur dépasse Q3 + 1,5 × (Q3 − Q1). Calcule les quartiles.",
    ],
    correction: `**Série triée** : 38 · 39 · 39 · 40 · 41 · 41 · 42 · 42 · 43 · 44 · 45 · 78

**Tendance centrale**
- Moyenne : 532 / 12 = **44,3 min**
- Médiane : (41 + 42) / 2 = **41,5 min**

**Dispersion**
- Q1 = 39,5 ; Q3 = 43,5 ; écart interquartile = **4 min**
- Écart-type (échantillon) : **≈ 10,8 min**

**Le point clé**
La valeur 78 dépasse Q3 + 1,5 × IQR = 43,5 + 6 = 49,5 : c'est un point atypique.

Son effet est massif : en l'écartant, la moyenne tombe à 41,3 min et l'écart-type à **2,2 min**, soit cinq fois moins. La moyenne et l'écart-type sont ici tirés par une seule observation sur douze.

**Réponse attendue**
Communiquer la **médiane (41,5 min)** et l'**écart interquartile (4 min)** : ces indicateurs sont robustes aux valeurs atypiques.

Mais la bonne réponse ne s'arrête pas au choix de l'indicateur : la valeur 78 doit être **investiguée, pas supprimée**. Un temps de cycle presque double signale un incident réel (panne, changement de série, opérateur en formation). L'écarter du calcul sans l'expliquer reviendrait à masquer l'information la plus intéressante de la série.

**Erreur fréquente** : annoncer « 44,3 ± 10,8 min », ce qui décrit un poste beaucoup plus instable qu'il ne l'est réellement.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai distingué tendance centrale et dispersion" },
      { dimension: "application", libelle: "J'ai calculé correctement médiane et quartiles" },
      { dimension: "justification", libelle: "J'ai justifié le choix des indicateurs par la présence du point atypique" },
    ],
  },

  /* ------------------------------- STAT-02 ------------------------------ */
  {
    id: "diag-stat-02",
    titre: "Choisir une loi pour un comptage de défauts",
    domaine: "statistiques",
    type: "probleme",
    difficulte: 2,
    competences: ["STAT-02"],
    dureeEstimeeMin: 25,
    diagnostic: true,
    origine: "seed",
    enonce: `Un poste de contrôle réceptionne des lots de 500 pièces. Sur l'historique des douze derniers mois, on relève en moyenne 2,5 pièces défectueuses par lot. Les défauts sont indépendants les uns des autres et le procédé est stable.

1. Quelle loi de probabilité modélise le nombre de défauts par lot ? Justifie ton choix.
2. Quelle est la probabilité qu'un lot ne contienne aucun défaut ?
3. Le contrat client prévoit une alerte si un lot contient plus de 5 défauts. Quelle est la probabilité de déclencher cette alerte sur un lot conforme au procédé actuel ?`,
    donnees: [
      { libelle: "Taille du lot", valeur: "500 pièces" },
      { libelle: "Nombre moyen de défauts par lot", valeur: "2,5" },
      { libelle: "e^(−2,5)", valeur: "0,0821" },
    ],
    indices: [
      "Deux lois sont candidates ici. Qu'est-ce qui distingue leurs conditions d'emploi ?",
      "Le nombre d'essais est grand (500) et la probabilité individuelle de défaut est faible (2,5/500 = 0,005). Que devient la loi Binomiale dans ce régime ?",
      "P(X > 5) = 1 − P(X ≤ 5). Calcule les six premiers termes de proche en proche : P(k) = P(k−1) × λ/k.",
    ],
    correction: `**1. Choix de la loi**

Comptage d'événements rares, indépendants, sur un support fixe (le lot) avec un taux moyen constant → **loi de Poisson de paramètre λ = 2,5**.

La loi Binomiale B(500 ; 0,005) serait formellement exacte, mais avec n grand et p petit (n ≥ 30, np < 5), l'approximation de Poisson s'applique et λ = np = 2,5. Les deux réponses sont recevables ; ce qui compte est de justifier les conditions.

**2. Probabilité d'un lot sans défaut**

P(X = 0) = e^(−2,5) = **0,082**, soit environ 8 %.

**3. Probabilité d'alerte**

Calcul de proche en proche à partir de P(0), en utilisant P(k) = P(k−1) × 2,5/k :

| k | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| P(k) | 0,0821 | 0,2052 | 0,2565 | 0,2138 | 0,1336 | 0,0668 |

P(X ≤ 5) = 0,958 → **P(X > 5) = 0,042**, soit environ **4 %**.

**Interprétation attendue**

Environ un lot sur vingt-quatre déclenchera l'alerte alors que le procédé est parfaitement conforme. C'est un **faux positif** structurel, inhérent au seuil choisi. Si ce taux est jugé trop élevé, c'est le seuil qu'il faut déplacer (à 6 défauts : P ≈ 1,4 %), pas le procédé qu'il faut incriminer.

**Erreur fréquente** : utiliser une loi Normale. Avec λ = 2,5, la distribution est nettement asymétrique et prend des valeurs entières positives ; l'approximation normale n'est acceptable qu'à partir de λ ≈ 15.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai justifié le choix de la loi par ses conditions d'application" },
      { dimension: "application", libelle: "J'ai calculé correctement les probabilités demandées" },
      { dimension: "justification", libelle: "J'ai interprété le résultat en termes de faux positifs" },
    ],
  },

  /* ------------------------------- LOG-01 ------------------------------- */
  {
    id: "diag-log-01",
    titre: "Quantité économique et point de commande",
    domaine: "logistique",
    type: "calcul",
    difficulte: 2,
    competences: ["LOG-01"],
    dureeEstimeeMin: 25,
    diagnostic: true,
    origine: "seed",
    enonce: `Un distributeur écoule une référence à raison de 12 000 unités par an, de façon régulière et prévisible. Chaque passation de commande coûte 80 €, tous frais confondus. Le coût de possession est estimé à 6 € par unité et par an. Le fournisseur livre en 10 jours ouvrés et l'entreprise travaille 250 jours ouvrés par an.

1. Détermine la quantité économique de commande.
2. Combien de commandes seront passées par an, et quel sera le coût annuel total de gestion du stock ?
3. À quel niveau de stock faut-il déclencher une commande ?`,
    donnees: [
      { libelle: "Demande annuelle D", valeur: "12 000 unités" },
      { libelle: "Coût de passation S", valeur: "80 € par commande" },
      { libelle: "Coût de possession h", valeur: "6 € / unité / an" },
      { libelle: "Délai de livraison", valeur: "10 jours ouvrés" },
      { libelle: "Jours ouvrés par an", valeur: "250" },
    ],
    indices: [
      "À l'optimum, deux coûts antagonistes s'équilibrent. Lesquels, et que vaut leur somme ?",
      "Q* = √(2·D·S / h).",
      "Le point de commande couvre exactement la demande consommée pendant le délai de livraison. Ramène la demande annuelle à une demande journalière.",
    ],
    correction: `**1. Quantité économique**

Q* = √(2 × 12 000 × 80 / 6) = √320 000 = **565,7 → 566 unités**

**2. Fréquence et coût annuel**

- Nombre de commandes : 12 000 / 565,7 = **21,2 par an**, soit une commande toutes les ~12 jours ouvrés
- Coût de passation : 21,2 × 80 = 1 697 €
- Coût de possession : (565,7 / 2) × 6 = 1 697 €
- **Coût total : 3 394 €/an**

L'égalité des deux termes n'est pas un hasard : c'est la propriété qui définit l'optimum. On peut d'ailleurs l'obtenir directement par CT* = √(2·D·S·h) = √11 520 000 = 3 394 €.

**3. Point de commande**

Demande journalière : 12 000 / 250 = 48 unités/jour
Point de commande = 48 × 10 = **480 unités**

**Vérification d'ordre de grandeur**

480 est proche de Q* = 566 : le stock est donc quasiment épuisé au moment où la commande précédente arrive. C'est cohérent avec un délai (10 j) presque égal au cycle de réapprovisionnement (12 j).

**Réserve à formuler**

Le modèle suppose une demande **constante et certaine** et un délai **fixe**. Aucun stock de sécurité n'apparaît, ce qui n'est acceptable que sous ces hypothèses. Dès que la demande ou le délai varient, ce point de commande produit une rupture une fois sur deux — c'est l'objet de la compétence LOG-02.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai identifié l'arbitrage entre coût de passation et coût de possession" },
      { dimension: "application", libelle: "J'ai appliqué correctement les formules" },
      { dimension: "justification", libelle: "J'ai énoncé les hypothèses du modèle et leurs limites" },
    ],
  },

  /* ------------------------------- LOG-02 ------------------------------- */
  {
    id: "diag-log-02",
    titre: "Stock de sécurité sous demande variable",
    domaine: "logistique",
    type: "probleme",
    difficulte: 3,
    competences: ["LOG-02", "STAT-02"],
    dureeEstimeeMin: 35,
    diagnostic: true,
    origine: "seed",
    enonce: `Une référence est consommée en moyenne 120 unités par semaine, avec un écart-type hebdomadaire de 25 unités. Le fournisseur livre en 3 semaines. L'entreprise vise un taux de service de 97,5 %.

1. Calcule le stock de sécurité et le point de commande, en supposant le délai fixe.
2. Le service achats t'informe que le délai n'est en réalité pas fixe : il vaut 3 semaines en moyenne, avec un écart-type de 0,5 semaine. Reprends le calcul.
3. Commente l'écart entre les deux résultats.`,
    donnees: [
      { libelle: "Demande hebdomadaire moyenne", valeur: "120 unités" },
      { libelle: "Écart-type de la demande", valeur: "25 unités/semaine" },
      { libelle: "Délai moyen", valeur: "3 semaines" },
      { libelle: "Écart-type du délai (question 2)", valeur: "0,5 semaine" },
      { libelle: "z pour 97,5 %", valeur: "1,96" },
    ],
    indices: [
      "Le stock de sécurité couvre l'incertitude sur la demande pendant le délai — pas sur une semaine isolée.",
      "Quand le délai est fixe, les variances des semaines successives s'additionnent : σ_DL = σ_D × √L.",
      "Quand le délai varie aussi, il faut composer les deux sources d'incertitude : σ_DL = √(L·σ_D² + D̄²·σ_L²).",
    ],
    correction: `**1. Délai fixe**

σ_DL = 25 × √3 = **43,3 unités**
Stock de sécurité = 1,96 × 43,3 = **85 unités**
Point de commande = 120 × 3 + 85 = **445 unités**

**2. Délai variable**

σ_DL = √(3 × 25² + 120² × 0,5²) = √(1 875 + 3 600) = √5 475 = **74,0 unités**
Stock de sécurité = 1,96 × 74,0 = **145 unités**
Point de commande = 360 + 145 = **505 unités**

**3. Commentaire**

Le stock de sécurité passe de 85 à 145 unités, soit **+70 %**, pour une variabilité du délai en apparence modeste (±0,5 semaine sur 3).

La raison est lisible dans la formule : le terme D̄²·σ_L² vaut 3 600, alors que le terme de demande ne vaut que 1 875. **La variabilité du délai contribue deux fois plus à l'incertitude que la variabilité de la demande.** C'est l'effet du facteur D̄² : plus la consommation moyenne est élevée, plus une incertitude sur le délai coûte cher.

**Conséquence de gestion** : fiabiliser le fournisseur est ici plus rentable que de mieux prévoir la demande. Si σ_L tombait à 0,2 semaine, le stock de sécurité redescendrait à ≈ 100 unités.

**Erreur fréquente — et coûteuse**

Appliquer σ_D × √L quand le délai est aléatoire. Le résultat (85) sous-estime le besoin réel (145) de 40 % : le taux de service effectif ne serait pas de 97,5 % mais d'environ 88 %.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai compris que l'incertitude porte sur la demande pendant le délai" },
      { dimension: "application", libelle: "J'ai composé correctement les deux sources de variabilité" },
      { dimension: "transfert", libelle: "J'ai su adapter la formule au cas du délai aléatoire" },
      { dimension: "justification", libelle: "J'ai identifié quel levier agir en priorité" },
    ],
  },

  /* ------------------------------- PROD-01 ------------------------------ */
  {
    id: "diag-prod-01",
    titre: "Faisabilité d'un Plan Industriel et Commercial",
    domaine: "production",
    type: "etude-de-cas",
    difficulte: 3,
    competences: ["PROD-01"],
    dureeEstimeeMin: 35,
    diagnostic: true,
    origine: "seed",
    enonce: `Un atelier doit construire son PIC sur six mois. Les prévisions commerciales sont données ci-contre. La capacité est de 1 000 unités par mois en régime normal. Le stock initial est de 200 unités et la direction impose un stock de sécurité permanent de 150 unités.

1. Un plan à production constante de 1 000 unités par mois est-il faisable ? Démontre-le.
2. Si non, quantifie précisément le manque et indique à partir de quel mois le problème apparaît.
3. Propose deux leviers d'action et discute leurs conditions d'emploi.`,
    donnees: [
      { libelle: "Prévisions M1 → M6", valeur: "800 · 900 · 1 100 · 1 300 · 1 200 · 900" },
      { libelle: "Capacité normale", valeur: "1 000 unités/mois" },
      { libelle: "Stock initial", valeur: "200 unités" },
      { libelle: "Stock de sécurité imposé", valeur: "150 unités" },
    ],
    indices: [
      "Commence par un bilan global sur les six mois avant de regarder mois par mois.",
      "Production nécessaire = demande totale + stock final visé − stock initial.",
      "Un bilan global équilibré ne garantit pas la faisabilité : construis le tableau des stocks de fin de mois.",
    ],
    correction: `**1. Bilan global**

- Demande totale : 800 + 900 + 1 100 + 1 300 + 1 200 + 900 = **6 200 unités**
- Production nécessaire = 6 200 + 150 (stock final) − 200 (stock initial) = **6 150 unités**
- Capacité disponible : 6 × 1 000 = **6 000 unités**

**Le plan n'est pas faisable : il manque 150 unités sur l'horizon.**

**2. Tableau des stocks de fin de mois (production constante 1 000)**

| Mois | M1 | M2 | M3 | M4 | M5 | M6 |
|---|---|---|---|---|---|---|
| Prévision | 800 | 900 | 1 100 | 1 300 | 1 200 | 900 |
| Stock fin | 400 | 500 | 400 | **100** | **−100** | 0 |

Le stock passe **sous le seuil de sécurité dès M4** (100 < 150) et devient **négatif en M5** : rupture de 100 unités.

Le manque global est donc de 150 unités, mais il doit être couvert **avant M4**, pas n'importe quand sur l'horizon. C'est le point que le seul bilan global masque.

**3. Deux leviers**

*Augmenter la capacité en amont du pic* — heures supplémentaires ou sous-traitance sur M1–M3, pour produire ~1 050/mois. Le stock de M3 monte alors à 550 et absorbe le pic de M4–M5. Condition : la capacité additionnelle doit être mobilisable **avant** le pic, et son surcoût comparé au coût de possession des stocks anticipés.

*Lisser la demande* — décaler une partie du pic de M4 vers M3 ou M6 (négociation commerciale, promotion en M6, délai annoncé). Condition : acceptabilité client et absence de pénalité contractuelle.

**Ce qui est attendu au-delà du calcul** : constater qu'un bilan global équilibré ne prouve rien sur la faisabilité, parce que la contrainte est **temporelle**. Un plan n'est faisable que si le stock reste au-dessus du seuil à chaque période.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai distingué bilan global et faisabilité période par période" },
      { dimension: "application", libelle: "J'ai construit le tableau des stocks correctement" },
      { dimension: "justification", libelle: "J'ai discuté les conditions d'emploi des leviers proposés" },
    ],
  },

  /* ------------------------------- PROD-03 ------------------------------ */
  {
    id: "diag-prod-03",
    titre: "Calcul des besoins nets (MRP)",
    domaine: "production",
    type: "calcul",
    difficulte: 3,
    competences: ["PROD-03"],
    dureeEstimeeMin: 35,
    diagnostic: true,
    origine: "seed",
    enonce: `Le produit fini P est composé de 2 unités du composant A et 1 unité du composant B. Les besoins bruts en P sont de 100 unités en semaine 4 et 150 unités en semaine 6.

Les stocks disponibles et les délais d'obtention sont donnés ci-contre. La règle de lotissement est « lot pour lot » à tous les niveaux, et aucune réception n'est attendue.

Établis le plan de lancement (quantité et semaine) pour P, A et B.`,
    donnees: [
      { libelle: "Nomenclature", valeur: "P = 2 × A + 1 × B" },
      { libelle: "Besoins bruts en P", valeur: "S4 : 100 · S6 : 150" },
      { libelle: "Stock P / délai P", valeur: "30 unités / 1 semaine" },
      { libelle: "Stock A / délai A", valeur: "80 unités / 2 semaines" },
      { libelle: "Stock B / délai B", valeur: "0 unité / 1 semaine" },
    ],
    indices: [
      "Traite les niveaux de la nomenclature dans l'ordre : P d'abord, puis A et B. Ne saute pas d'étape.",
      "Besoin net = besoin brut − stock disponible. Le stock ne sert qu'une fois.",
      "Le besoin brut d'un composant est engendré par la date de LANCEMENT du parent, pas par sa date de besoin.",
    ],
    correction: `**Niveau 0 — Produit P** (stock 30, délai 1 semaine)

| | S4 | S6 |
|---|---|---|
| Besoin brut | 100 | 150 |
| Stock disponible | 30 | 0 |
| **Besoin net** | **70** | **150** |
| **Lancement** | **S3 : 70** | **S5 : 150** |

Le stock de 30 est consommé par le premier besoin ; il n'est plus disponible en S6.

**Niveau 1 — Composant A** (2 par P, stock 80, délai 2 semaines)

Les besoins bruts de A naissent des **lancements** de P, soit S3 et S5 :

| | S3 | S5 |
|---|---|---|
| Besoin brut | 2 × 70 = 140 | 2 × 150 = 300 |
| Stock disponible | 80 | 0 |
| **Besoin net** | **60** | **300** |
| **Lancement** | **S1 : 60** | **S3 : 300** |

**Niveau 1 — Composant B** (1 par P, stock 0, délai 1 semaine)

| | S3 | S5 |
|---|---|---|
| Besoin brut | 70 | 150 |
| **Lancement** | **S2 : 70** | **S4 : 150** |

**Plan de lancement consolidé**

- S1 : A — 60
- S2 : B — 70
- S3 : P — 70 · A — 300
- S4 : B — 150
- S5 : P — 150

**Point de vigilance principal**

Le besoin en A est déclenché par le **lancement** de P (S3, S5), pas par le besoin en P (S4, S6). Oublier ce décalage est l'erreur la plus fréquente en MRP : elle produit un plan où les composants arrivent une semaine trop tard, systématiquement.

**Contrôle de cohérence** : le lancement de A en S1 signifie que la commande doit partir dès la première semaine pour un besoin en S4. Avec un délai de 2 semaines sur A et 1 sur P, c'est bien 2 + 1 = 3 semaines d'anticipation.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai compris la logique de descente dans la nomenclature" },
      { dimension: "application", libelle: "J'ai correctement décalé les besoins des délais d'obtention" },
      { dimension: "justification", libelle: "J'ai vérifié la cohérence globale du plan" },
    ],
  },

  /* ------------------------------- ALGO-01 ------------------------------ */
  {
    id: "diag-algo-01",
    titre: "Algorithme de moyenne mobile",
    domaine: "algorithmique",
    type: "programmation",
    difficulte: 2,
    competences: ["ALGO-01"],
    dureeEstimeeMin: 25,
    diagnostic: true,
    origine: "seed",
    enonce: `Écris un algorithme (pseudo-code ou Python) qui prend en entrée une liste de valeurs numériques et un entier k, et renvoie la liste des moyennes mobiles d'ordre k.

Contraintes :
1. Structure ton code en fonctions.
2. Traite explicitement les cas limites : liste vide, k ≤ 0, k supérieur à la longueur de la liste.
3. Indique le nombre de valeurs que doit contenir la liste de sortie, et justifie-le.
4. Donne la complexité de ta solution.`,
    donnees: [
      { libelle: "Exemple d'entrée", valeur: "[10, 12, 14, 16, 18], k = 3" },
      { libelle: "Sortie attendue", valeur: "[12.0, 14.0, 16.0]" },
    ],
    indices: [
      "Combien de fenêtres de taille k peut-on placer dans une liste de n éléments ?",
      "Décide explicitement du comportement attendu pour k > n : erreur, liste vide, ou autre. Le choix importe moins que le fait de le documenter.",
      "Une somme glissante évite de recalculer entièrement chaque fenêtre : que devient alors la complexité ?",
    ],
    correction: `**Solution directe**

\`\`\`python
def moyenne_mobile(valeurs, k):
    if k <= 0:
        raise ValueError("k doit être strictement positif")
    if k > len(valeurs):
        return []
    return [sum(valeurs[i:i + k]) / k for i in range(len(valeurs) - k + 1)]
\`\`\`

**Nombre de valeurs en sortie : n − k + 1**

Une fenêtre de taille k commence à l'indice 0 et la dernière commence à l'indice n − k. Il y a donc n − k + 1 positions. Avec n = 5 et k = 3 : 3 valeurs. La liste de sortie est **toujours plus courte que l'entrée** — un décalage classique en prévision, où la moyenne mobile ne peut rien dire des k−1 premières périodes.

**Complexité**

Cette version est en **O(n × k)** : chaque fenêtre est resommée intégralement.

**Version en somme glissante — O(n)**

\`\`\`python
def moyenne_mobile(valeurs, k):
    if k <= 0:
        raise ValueError("k doit être strictement positif")
    n = len(valeurs)
    if k > n:
        return []
    resultat = []
    fenetre = sum(valeurs[:k])
    resultat.append(fenetre / k)
    for i in range(k, n):
        fenetre += valeurs[i] - valeurs[i - k]
        resultat.append(fenetre / k)
    return resultat
\`\`\`

Chaque élément est ajouté une fois et retiré une fois : **O(n)** en temps, O(n) en espace pour le résultat.

**Ce qui est évalué ici**

Moins la formule que la **rigueur** : sortie de taille n − k + 1 (et non n), cas limites traités explicitement plutôt que laissés au hasard, et complexité annoncée puis justifiée. Un code qui « marche sur l'exemple » mais renvoie silencieusement une liste vide pour k = 0 ne démontre pas la compétence.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai compris la structure du parcours par fenêtre" },
      { dimension: "application", libelle: "Mon code produit le bon résultat et gère les cas limites" },
      { dimension: "justification", libelle: "J'ai justifié la taille de la sortie et la complexité" },
    ],
  },

  /* ------------------------------- ALGO-05 ------------------------------ */
  {
    id: "diag-algo-05",
    titre: "Évaluer la précision d'une prévision en Python",
    domaine: "algorithmique",
    type: "programmation",
    difficulte: 3,
    competences: ["ALGO-05", "LOG-03"],
    dureeEstimeeMin: 40,
    diagnostic: true,
    origine: "seed",
    enonce: `On dispose de l'historique des ventes mensuelles d'une référence et des prévisions qui avaient été établies pour ces mêmes mois.

Écris un programme Python qui :
1. calcule l'erreur moyenne (biais), l'erreur absolue moyenne (MAE) et l'erreur relative absolue moyenne (MAPE) ;
2. indique si la prévision est biaisée, et dans quel sens ;
3. gère le cas d'une valeur réelle nulle dans le calcul du MAPE.

Commente ce que chacun des trois indicateurs t'apprend, et lequel tu retiendrais pour piloter cette référence.`,
    donnees: [
      { libelle: "Ventes réelles", valeur: "[120, 135, 128, 142, 150, 138]" },
      { libelle: "Prévisions", valeur: "[125, 130, 130, 135, 140, 135]" },
    ],
    indices: [
      "Le biais conserve le signe des erreurs ; la MAE ne le conserve pas. Que se passe-t-il si les erreurs se compensent ?",
      "Le MAPE divise par la valeur réelle : que faire si celle-ci vaut zéro ?",
      "Compare l'ampleur du biais à celle de la MAE. Si les deux sont proches, que peux-tu en déduire sur le signe des erreurs ?",
    ],
    correction: `**Programme**

\`\`\`python
def indicateurs(reel, prevu):
    if len(reel) != len(prevu) or not reel:
        raise ValueError("séries de tailles différentes ou vides")

    erreurs = [r - p for r, p in zip(reel, prevu)]
    biais = sum(erreurs) / len(erreurs)
    mae = sum(abs(e) for e in erreurs) / len(erreurs)

    # Le MAPE n'est pas défini pour une valeur réelle nulle :
    # on écarte ces points et on signale combien ont été ignorés.
    couples = [(r, e) for r, e in zip(reel, erreurs) if r != 0]
    ignores = len(reel) - len(couples)
    mape = (sum(abs(e) / r for r, e in couples) / len(couples) * 100) if couples else None

    return {"biais": biais, "mae": mae, "mape": mape, "points_ignores": ignores}
\`\`\`

**Résultats**

Erreurs (réel − prévu) : +5, −5, −2, +7, +10, +3 → somme = 18

- **Biais = +3,0** unités
- **MAE = 5,33** unités
- **MAPE ≈ 3,9 %**

**Interprétation**

Le biais est **positif** : le réel dépasse la prévision. La prévision **sous-estime systématiquement** la demande d'environ 3 unités par mois. Sur les quatre derniers mois, cinq erreurs sur six sont positives — ce n'est pas du bruit.

Le rapport biais / MAE = 3,0 / 5,33 ≈ 0,56 est le signal important : plus de la moitié de l'erreur moyenne est une erreur **de direction**, pas de dispersion. Une prévision non biaisée aurait un rapport proche de zéro.

**Quel indicateur retenir**

Les trois répondent à des questions différentes et se complètent :
- le **biais** dit s'il faut corriger la méthode (ici : oui, elle décroche vers le bas) ;
- la **MAE** dit combien de stock il faut prévoir pour absorber l'erreur, en unités directement exploitables ;
- le **MAPE** permet de comparer des références de volumes différents.

Pour **piloter cette référence**, la MAE est la plus directement actionnable : elle s'exprime dans la même unité que le stock de sécurité. Mais l'action prioritaire ici est de corriger le biais, car un biais persistant se traduit en ruptures répétées, quel que soit le stock de sécurité calculé.

**Piège du MAPE** : il est asymétrique — il pénalise davantage la surestimation que la sous-estimation, et explose quand le réel est proche de zéro. C'est pourquoi le cas r = 0 doit être traité explicitement plutôt que de laisser passer une division par zéro.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai distingué erreur de biais et erreur de dispersion" },
      { dimension: "application", libelle: "Mon code calcule correctement les trois indicateurs" },
      { dimension: "justification", libelle: "J'ai justifié le choix d'indicateur pour l'usage visé" },
    ],
  },

  /* -------------------------------- RO-01 ------------------------------- */
  {
    id: "diag-ro-01",
    titre: "Formuler un programme linéaire",
    domaine: "recherche-operationnelle",
    type: "probleme",
    difficulte: 3,
    competences: ["RO-01"],
    dureeEstimeeMin: 35,
    diagnostic: true,
    origine: "seed",
    enonce: `Un atelier fabrique deux produits. Le produit P1 dégage une marge de 40 € l'unité, le produit P2 une marge de 30 €.

Chaque unité de P1 requiert 2 heures d'usinage et 1 heure d'assemblage ; chaque unité de P2 requiert 1 heure d'usinage et 1 heure d'assemblage. L'atelier dispose de 100 heures d'usinage et 80 heures d'assemblage par semaine. Le marché ne peut absorber plus de 40 unités de P1 par semaine.

1. Formule le programme linéaire : variables de décision, fonction objectif, contraintes.
2. Résous-le graphiquement ou par énumération des sommets.
3. Quelles ressources sont saturées à l'optimum ? Que cela t'apprend-il ?`,
    donnees: [
      { libelle: "Marges unitaires", valeur: "P1 : 40 € · P2 : 30 €" },
      { libelle: "Usinage", valeur: "P1 : 2 h · P2 : 1 h · capacité 100 h" },
      { libelle: "Assemblage", valeur: "P1 : 1 h · P2 : 1 h · capacité 80 h" },
      { libelle: "Demande maximale P1", valeur: "40 unités" },
    ],
    indices: [
      "Définis les variables avec leur unité et leur période de référence. « x1 = P1 » est insuffisant.",
      "L'optimum d'un programme linéaire est atteint en un sommet du domaine réalisable. Identifie-les tous.",
      "Une contrainte est saturée si elle est vérifiée avec égalité à l'optimum. Que vaut alors l'heure supplémentaire de cette ressource ?",
    ],
    correction: `**1. Formulation**

*Variables de décision*
x₁ = nombre d'unités de P1 produites par semaine
x₂ = nombre d'unités de P2 produites par semaine

*Objectif*
Maximiser Z = 40x₁ + 30x₂ (marge hebdomadaire, en €)

*Contraintes*
- Usinage : 2x₁ + x₂ ≤ 100
- Assemblage : x₁ + x₂ ≤ 80
- Marché : x₁ ≤ 40
- Non-négativité : x₁ ≥ 0, x₂ ≥ 0

**2. Résolution par les sommets**

| Sommet | (x₁, x₂) | Z |
|---|---|---|
| Origine | (0, 0) | 0 |
| Assemblage seul | (0, 80) | 2 400 |
| **Usinage ∩ assemblage** | **(20, 60)** | **2 600** |
| Usinage ∩ marché | (40, 20) | 2 200 |
| Marché seul | (40, 0) | 1 600 |

L'intersection des deux premières contraintes s'obtient par 2x₁ + x₂ = 100 et x₁ + x₂ = 80, d'où x₁ = 20 et x₂ = 60.

**Optimum : produire 20 unités de P1 et 60 unités de P2, pour une marge de 2 600 €/semaine.**

**3. Ressources saturées**

- Usinage : 2(20) + 60 = 100 = capacité → **saturé**
- Assemblage : 20 + 60 = 80 = capacité → **saturé**
- Marché : 20 < 40 → **non saturé**, il reste 20 unités de débouché inexploitées

Les deux ressources de production sont goulots simultanément. Toute heure supplémentaire sur **l'une seule** des deux a une valeur marginale strictement positive, mais investir sur la seule capacité commerciale de P1 ne rapporterait **rien** : la contrainte marché n'est pas active.

**Le contre-sens à éviter**

P1 a la marge unitaire la plus élevée (40 € contre 30 €), et l'intuition pousse à en produire le maximum, soit 40 unités. C'est le sommet (40, 20), qui ne rapporte que 2 200 € — **400 € de moins que l'optimum**.

La raison : P1 consomme deux fois plus d'usinage que P2. Rapportée à la ressource rare, la marge de P1 vaut 20 €/heure d'usinage contre 30 €/heure pour P2. **C'est la marge par unité de ressource critique qui décide, pas la marge par unité produite.** C'est précisément ce qu'une formulation en programme linéaire permet de voir, et qu'un raisonnement au jugé rate.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai défini des variables précises, avec unité et période" },
      { dimension: "application", libelle: "J'ai formulé et résolu correctement le programme" },
      { dimension: "justification", libelle: "J'ai interprété la saturation des contraintes en termes de décision" },
    ],
  },

  /* ------------------------------- SYSC-01 ------------------------------ */
  {
    id: "diag-sysc-01",
    titre: "Analyser un système logistique et ses rétroactions",
    domaine: "systemes-complexes",
    type: "etude-de-cas",
    difficulte: 3,
    competences: ["SYSC-01"],
    dureeEstimeeMin: 40,
    diagnostic: true,
    origine: "seed",
    enonce: `Une chaîne logistique comporte quatre maillons : détaillant, grossiste, distributeur, usine. Chaque maillon ne connaît que les commandes de son client direct et met une à deux semaines à être livré par son fournisseur. Chacun ajuste ses commandes pour reconstituer son stock cible.

On observe qu'une hausse durable mais modeste de la demande finale (+10 %) provoque des variations de commandes de plus de 40 % au niveau de l'usine, suivies d'annulations massives.

1. Identifie les composants du système et leurs interactions.
2. Identifie au moins une boucle de rétroaction et précise son signe.
3. Explique le mécanisme d'amplification.
4. Propose deux interventions et discute leur efficacité relative.`,
    donnees: [
      { libelle: "Maillons", valeur: "Détaillant → Grossiste → Distributeur → Usine" },
      { libelle: "Délai par maillon", valeur: "1 à 2 semaines" },
      { libelle: "Information disponible", valeur: "commandes du client direct uniquement" },
      { libelle: "Variation observée", valeur: "+10 % en aval → +40 % en amont" },
    ],
    indices: [
      "Distingue les stocks (grandeurs qui s'accumulent) des flux (grandeurs qui les font varier).",
      "Une boucle est positive si elle amplifie l'écart initial, négative si elle le corrige. Ici, les deux coexistent.",
      "Le délai est le facteur décisif : que se passe-t-il quand un maillon corrige un écart qui a déjà commencé à se résorber ?",
    ],
    correction: `Ce phénomène est l'**effet coup de fouet** (bullwhip effect).

**1. Composants et interactions**

*Stocks* : stock physique et encours de commande de chaque maillon.
*Flux* : commandes (remontantes) et livraisons (descendantes).
*Variables de décision* : stock cible et règle de réapprovisionnement de chaque maillon.
*Information* : uniquement les commandes du client direct — c'est la variable structurante du problème.

**2. Boucles de rétroaction**

*Boucle négative (correction de stock), locale à chaque maillon*
Stock perçu ↓ → commande ↑ → réception (après délai) → stock ↑
Prise isolément, elle est stabilisante : c'est son objet.

*Boucle positive (amplification), à l'échelle du système*
Commande du maillon aval ↑ → estimation de la demande ↑ → stock cible ↑ → commande au maillon amont ↑↑
Chaque maillon commande à la fois pour satisfaire la demande **et** pour reconstituer son stock cible relevé. L'écart initial est donc amplifié à chaque remontée.

**3. Mécanisme d'amplification**

Trois facteurs se combinent :

- **Le délai** : un maillon corrige un écart mesuré 1 à 2 semaines plus tôt. Quand sa commande arrive, la situation a déjà évolué — souvent dans l'autre sens.
- **Le double comptage** : chaque maillon commande pour la demande *et* pour le stock cible, si bien que le signal est multiplié à chaque étage.
- **L'absence de visibilité** : aucun maillon ne voit la demande finale. Chacun interprète les commandes de son client comme un signal de demande, alors qu'elles contiennent déjà la correction de stock de ce client.

La boucle négative locale, censée stabiliser, **déstabilise le système global** parce qu'elle agit avec retard sur une information déjà périmée. C'est le résultat contre-intuitif central : une régulation correcte à chaque maillon produit une oscillation à l'échelle du système.

**4. Interventions**

*Partager l'information de demande finale (point de vente)*
Attaque la cause : chaque maillon planifie sur la demande réelle et non sur un signal déjà déformé. C'est l'intervention **la plus efficace**, car elle supprime le mécanisme d'amplification lui-même.

*Réduire les délais*
Atténue l'effet sans supprimer la cause. Le système reste amplificateur, mais oscille moins longtemps et avec une amplitude moindre.

**Hiérarchie attendue**

Agir sur **l'information** est plus efficace qu'agir sur les **délais**, eux-mêmes plus efficaces qu'agir sur les **stocks**. Augmenter les stocks de sécurité — réflexe le plus courant — est la réponse la moins efficace : elle traite le symptôme, coûte cher en immobilisation, et peut aggraver l'oscillation en allongeant le temps de réaction.

Formulé autrement : dans ce système, **la structure d'information détermine le comportement davantage que le dimensionnement des ressources**.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai distingué stocks, flux et variables de décision" },
      { dimension: "application", libelle: "J'ai identifié les boucles et leur signe" },
      { dimension: "integration", libelle: "J'ai relié délai, information et comportement du système" },
      { dimension: "justification", libelle: "J'ai hiérarchisé les interventions et justifié cette hiérarchie" },
    ],
  },

  /* ------------------------------- TECH-01 ------------------------------ */
  {
    id: "diag-tech-01",
    titre: "Cadrer un projet de maintenance prédictive",
    domaine: "technologies-innovantes",
    type: "etude-de-cas",
    difficulte: 3,
    competences: ["TECH-01"],
    dureeEstimeeMin: 35,
    diagnostic: true,
    origine: "seed",
    enonce: `Une entreprise souhaite prédire les pannes d'une ligne de production à partir des données de ses capteurs (vibration, température, courant), enregistrées toutes les minutes depuis deux ans. Sur cette période, la ligne a connu 14 pannes.

1. S'agit-il d'un problème d'apprentissage supervisé ou non supervisé ? Justifie.
2. Comment définirais-tu la variable à prédire ?
3. Le premier modèle atteint 99,8 % d'exactitude. Que penses-tu de ce résultat ?
4. Quelle métrique retiendrais-tu, et quelles données manquent probablement ?`,
    donnees: [
      { libelle: "Capteurs", valeur: "vibration, température, courant" },
      { libelle: "Fréquence", valeur: "1 relevé par minute" },
      { libelle: "Historique", valeur: "2 ans" },
      { libelle: "Pannes observées", valeur: "14" },
    ],
    indices: [
      "Combien de relevés compte l'historique, et quelle proportion correspond à une panne ?",
      "« Prédire une panne » n'est pas une cible exploitable tant qu'on n'a pas fixé un horizon de prédiction.",
      "Un modèle qui prédirait « pas de panne » en permanence : quelle exactitude atteindrait-il ?",
    ],
    correction: `**1. Nature du problème**

**Supervisé**, à condition de disposer de l'historique daté des pannes — ce qui est le cas (14 pannes documentées). La cible est construite à partir de ces dates.

Une approche **non supervisée** (détection d'anomalies) reste pertinente en complément, et devient la seule option si les dates de panne sont absentes ou peu fiables. Elle détecte des comportements inhabituels sans savoir s'ils précèdent une panne.

**2. Définition de la cible**

« Prédire une panne » n'est pas exploitable tel quel. Il faut fixer un **horizon** :

> y = 1 si une panne survient dans les H heures suivant l'instant t, 0 sinon.

Le choix de H est une **décision métier, pas technique** : il doit correspondre au délai nécessaire pour agir (mobiliser un technicien, commander une pièce, planifier un arrêt). Un modèle qui prédit une panne 5 minutes à l'avance est techniquement excellent et opérationnellement inutile.

**3. Les 99,8 % d'exactitude**

**Ce résultat ne dit rien.**

L'historique compte environ 2 × 365 × 24 × 60 ≈ **1 050 000 relevés**. Même en étiquetant généreusement 24 heures avant chaque panne, les instants positifs représentent 14 × 1 440 ≈ 20 000 relevés, soit **moins de 2 %** des données.

Un modèle qui prédirait « pas de panne » en permanence obtiendrait donc **plus de 98 % d'exactitude sans rien apprendre**. Les 99,8 % annoncés sont parfaitement compatibles avec un modèle qui ne détecte quasiment aucune panne.

C'est le piège classique du **déséquilibre de classes** : l'exactitude est une métrique trompeuse dès que les classes sont déséquilibrées.

**4. Métriques et données manquantes**

*Métriques* — **rappel** (quelle proportion de pannes détectée) et **précision** (quelle proportion d'alertes justifiée), synthétisées par le F1 ou l'aire sous la courbe précision-rappel. L'arbitrage entre les deux est un choix économique : coût d'une panne non détectée contre coût d'une intervention inutile.

*Un point critique de méthode* — la validation doit être **temporelle** : entraîner sur le passé, tester sur le futur. Un découpage aléatoire laisserait fuiter des relevés postérieurs à une panne dans le jeu d'entraînement et produirait une performance illusoire.

*Données probablement manquantes*
- L'**historique de maintenance** : sans lui, une intervention préventive réussie ressemble à un faux positif alors qu'elle a évité la panne.
- Le **mode de défaillance** de chaque panne : 14 pannes de natures différentes ne constituent pas un seul problème, mais peut-être cinq problèmes de 2 ou 3 cas chacun.
- Les **conditions d'exploitation** (produit fabriqué, cadence, équipe) : une vibration élevée peut être normale sur une référence et anormale sur une autre.

**Le point de fond**

Avec 14 événements, on est dans un régime de **très faible effectif**, pas de « big data ». La contrainte dominante n'est pas la puissance de calcul ni le choix de l'algorithme, mais le **nombre d'événements observés**. Une méthode simple et interprétable, cadrée avec le service maintenance, a ici plus de valeur qu'un modèle complexe — et permet au moins de comprendre ce qu'il apprend.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai identifié la nature supervisée du problème et ses conditions" },
      { dimension: "application", libelle: "J'ai su définir une cible exploitable avec un horizon" },
      { dimension: "justification", libelle: "J'ai détecté le piège du déséquilibre de classes" },
      { dimension: "integration", libelle: "J'ai relié le choix de métrique aux enjeux métier" },
    ],
  },

  /* ==================== DÉVELOPPEMENT (ADR-020, 29/07/2026) ====================
   * Lot fondateur pour amorcer le nouveau domaine `developpement`, converti
   * depuis EXERCICES_APPRENTISSAGE.md (10 niveaux déjà rédigés). Même
   * exception qu'à l'origine du lot ci-dessus : le circuit tuteur → exercice
   * (ADR-004) n'est pas câblé, ADR-020 documente pourquoi un seed ponctuel
   * est accepté ici.
   * ================================================================== */

  /* ------------------------------- DEV-01 -------------------------------- */
  {
    id: "diag-dev-01",
    titre: "Lire un système de types statique",
    domaine: "developpement",
    type: "application",
    difficulte: 1,
    competences: ["DEV-01"],
    dureeEstimeeMin: 20,
    diagnostic: true,
    origine: "seed",
    enonce: `Voici un extrait réel de \`lib/domain/types.ts\`, le fichier qui définit le vocabulaire du moteur de ce projet.

\`\`\`ts
export type Autonomie = "A0" | "A1" | "A2" | "A3" | "A4";

export const AUTONOMIE: Record<Autonomie, { libelle: string; poids: number }> = {
  A0: { libelle: "Solution fournie", poids: 0 },
  A1: { libelle: "Fortement guidé", poids: 0.25 },
  A2: { libelle: "Quelques indices nécessaires", poids: 0.55 },
  A3: { libelle: "Résolution autonome", poids: 0.85 },
  A4: { libelle: "Autonome avec initiative méthodologique", poids: 1 },
};

/**
 * Hiérarchie des preuves. A preuve directe · B preuve indirecte · C déduction
 * · D hypothèse. C et D ne doivent jamais être présentées comme des faits certains.
 */
export type NiveauPreuve = "A" | "B" | "C" | "D";
\`\`\`

Et la fonction qui, ailleurs dans le moteur, se sert de ce type pour rejeter les preuves faibles :

\`\`\`ts
function estRecevable(e: SkillEvidence): boolean {
  return e.niveauPreuve === "A" || e.niveauPreuve === "B";
}
\`\`\`

**Méthode :** lis le bloc une fois, sans chercher la réponse. Réponds aux questions sur papier avant de lancer quoi que ce soit.

**Questions :**
1. Que vaut \`AUTONOMIE["A2"].poids\` ?
2. Pourquoi \`AUTONOMIE["A5"]\` est-il refusé par TypeScript avant même l'exécution, alors qu'un simple objet JavaScript \`{A0: ..., A1: ...}\` ne refuserait rien ?
3. \`NiveauPreuve\` inclut C et D alors que \`estRecevable\` ne les accepte jamais. Pourquoi garder dans le type des valeurs qu'on n'accepte jamais, plutôt que de les retirer ?`,
    indices: [
      "Un Record<Clé, Valeur> est un objet dont TypeScript connaît les clés à l'avance — que se passe-t-il quand tu demandes une clé hors de cet ensemble ?",
      "Compare ce que fait le compilateur (avant l'exécution) et ce que ferait le moteur JavaScript à l'exécution sur un objet nu.",
      "Regarde ce que ferait estRecevable si C et D n'existaient plus dans le type : pourrait-elle encore les nommer pour les rejeter ?",
    ],
    correction: `**1.** \`0.55\`.

**2.** TypeScript vérifie les clés d'un \`Record<Autonomie, ...>\` contre le type union \`Autonomie\` à la compilation : \`"A5"\` n'appartenant pas à \`"A0"|"A1"|"A2"|"A3"|"A4"\`, l'accès est une erreur de compilation, avant toute exécution. Un objet JS nu n'a aucune de ces garanties : \`objet["A5"]\` renverrait simplement \`undefined\` à l'exécution, silencieusement.

**3.** \`estRecevable\` a besoin que C et D existent *dans le type* pour pouvoir les **rejeter explicitement** dans son test. Les supprimer du type reviendrait à supprimer le garde-fou lui-même : plus rien n'empêcherait une future preuve d'être écrite avec un niveau non fiable, faute de pouvoir même le nommer pour le refuser.

**Ce que ça apprend :** un type union borne les valeurs possibles à la compilation, avant même que le programme tourne — c'est un garde-fou, pas juste de la documentation.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai su lire un type union et un Record sans les confondre avec un objet JS nu" },
      { dimension: "application", libelle: "J'ai calculé correctement une valeur d'un Record typé" },
      { dimension: "justification", libelle: "J'ai expliqué pourquoi une valeur toujours rejetée reste dans le type qui la nomme" },
    ],
  },

  /* ------------------------------- DEV-02 -------------------------------- */
  {
    id: "diag-dev-02",
    titre: "Exécuter une fonction pure à la main",
    domaine: "developpement",
    type: "calcul",
    difficulte: 1,
    competences: ["DEV-02"],
    dureeEstimeeMin: 15,
    diagnostic: true,
    origine: "seed",
    enonce: `Extrait réel de \`lib/engine/preuve.ts\` :

\`\`\`ts
/**
 * Autonomie déduite du nombre d'indices réellement consultés.
 * Observée, pas déclarée par l'utilisateur.
 */
export function autonomieDepuisIndices(indices: number, total: number): Autonomie {
  if (total > 0 && indices >= total) return "A1";
  if (indices >= 1) return "A2";
  return "A3";
}
\`\`\`

Une fonction pure ne dépend que de ses arguments et ne modifie rien à l'extérieur : c'est la seule chose qu'on peut exécuter fiablement « dans sa tête ».

**Pour chaque cas, donne le résultat sans lancer le code :**
1. \`autonomieDepuisIndices(0, 3)\`
2. \`autonomieDepuisIndices(3, 3)\`
3. \`autonomieDepuisIndices(1, 3)\`
4. \`autonomieDepuisIndices(0, 0)\` — cas piège : aucun indice n'était disponible. Que fait la fonction, concrètement ?`,
    indices: [
      "Évalue les deux conditions dans l'ordre où elles sont écrites, pas dans un ordre logique que tu inventerais.",
      "Pour le cas 4, la condition total > 0 && ... est un ET : un seul terme faux suffit à rendre tout le test faux.",
      "Une fois les 4 réponses écrites, vérifie-les en ajoutant un test dans le fichier *.test.ts correspondant et en lançant npm run test.",
    ],
    correction: `**1.** \`total=3>0\` et \`indices=0<3\` → pas A1. \`indices=0\`, pas ≥1 → pas A2. Résultat : **A3**.
**2.** \`indices=3 ≥ total=3\` et \`total>0\` → **A1**.
**3.** \`total=3\`, \`indices=1≥1\` → **A2**.
**4.** \`total=0\` : \`total > 0\` est faux, donc toute la condition l'est. \`indices=0\`, pas ≥1. Résultat : **A3** — un exercice sans indice disponible est traité comme une résolution pleinement autonome. Ce n'est pas un cas d'erreur, c'est la branche par défaut, et ça mérite d'être su.

**Ce que ça apprend :** enchaîner mentalement des conditions simples, dans l'ordre où elles sont écrites, est la compétence de base pour lire n'importe quelle fonction pure sans avoir besoin de l'exécuter.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai su ce qui définit une fonction pure et pourquoi on peut l'exécuter mentalement" },
      { dimension: "application", libelle: "J'ai prédit correctement les 4 résultats avant d'exécuter le code" },
      { dimension: "justification", libelle: "J'ai expliqué le cas limite total=0 sans le traiter comme une erreur" },
    ],
  },

  /* ------------------------------- DEV-03 -------------------------------- */
  {
    id: "diag-dev-03",
    titre: "Repérer un motif répété dans du code métier",
    domaine: "developpement",
    type: "application",
    difficulte: 2,
    competences: ["DEV-03"],
    dureeEstimeeMin: 25,
    diagnostic: true,
    origine: "seed",
    enonce: `Extrait réel de \`lib/engine/skill-state.ts\`, fonction \`niveauSoutenu\` (avec deux aides) :

\`\`\`ts
const ORDRE_AUTONOMIE = ["A0", "A1", "A2", "A3", "A4"] as const;

function autonomieAuMoins(e: SkillEvidence, min: (typeof ORDRE_AUTONOMIE)[number]): boolean {
  return ORDRE_AUTONOMIE.indexOf(e.autonomie) >= ORDRE_AUTONOMIE.indexOf(min);
}

function niveauSoutenu(preuves: SkillEvidence[]): AppuiNiveau[] {
  const reussies = preuves.filter((e) => e.resultat === "reussi");
  const nonEchouees = preuves.filter((e) => e.resultat !== "echec");
  const appuis: AppuiNiveau[] = [];

  const l1 = nonEchouees.filter((e) => dim(e, "comprehension") >= 0.6);
  if (l1.length > 0) appuis.push({ niveau: 1, preuves: l1, raison: "compréhension démontrée" });

  const l2 = reussies.filter((e) => dim(e, "application") >= 0.6 && autonomieAuMoins(e, "A1"));
  if (l2.length > 0) appuis.push({ niveau: 2, preuves: l2, raison: "méthode appliquée avec accompagnement" });

  const l3 = reussies.filter((e) => dim(e, "application") >= 0.7 && autonomieAuMoins(e, "A3"));
  if (l3.length >= 2) appuis.push({ niveau: 3, preuves: l3, raison: "deux résolutions autonomes concordantes" });

  const l4 = reussies.filter((e) => autonomieAuMoins(e, "A3") && dim(e, "transfert") >= 0.6);
  const contextesL4 = new Set(l4.map((e) => e.contexte));
  if (l4.length >= 2 && contextesL4.size >= 2) {
    appuis.push({ niveau: 4, preuves: l4, raison: \`transfert démontré sur \${contextesL4.size} contextes distincts\` });
  }

  return appuis;
}
\`\`\`

Et comment l'appelant s'en sert :

\`\`\`ts
const appuis = niveauSoutenu(preuves);
let niveau = appuis.length > 0 ? Math.max(...appuis.map((a) => a.niveau)) : 0;
\`\`\`

**Questions :**
1. Combien de \`.filter\` distincts apparaissent dans \`niveauSoutenu\` ? Pour chacun, dis en une phrase ce qu'il isole.
2. \`new Set(l4.map((e) => e.contexte))\` : explique ce que mesure \`contextesL4.size\`, et pourquoi le niveau 4 exige \`size >= 2\` plutôt que \`l4.length >= 2\`.
3. Pourquoi la fonction retourne-t-elle *tous* les paliers soutenus (un tableau) plutôt qu'un seul niveau ?`,
    indices: [
      "Compte-les un par un dans l'ordre du code : reussies, nonEchouees, puis un par palier.",
      ".size d'un Set compte les valeurs distinctes — que se passe-t-il si deux preuves ont exactement le même contexte ?",
      "Regarde ce que fait l'appelant avec le tableau retourné : que perdrait-il si la fonction ne renvoyait qu'un seul niveau ?",
    ],
    correction: `**1.** Au moins six \`.filter\` explicites (\`reussies\`, \`nonEchouees\`, un par palier \`l1\`…\`l4\`), plus un \`.map\` sur un filtre pour \`contextesL4\`. L'important est la justification de chacun, pas le compte exact.

**2.** \`.size\` d'un \`Set\` compte les valeurs **distinctes** : deux preuves du même contexte ne comptent que pour 1. Exiger \`size >= 2\` garantit que le transfert est démontré dans des situations réellement différentes — deux réussites dans le même contexte ne prouvent que de la répétition, pas un transfert.

**3.** Un niveau peut être soutenu par plusieurs paliers à la fois. L'appelant prend ensuite \`Math.max\` sur les niveaux soutenus : retourner un tableau garde toute l'information (quelles preuves soutiennent quoi) au lieu de la perdre en ne renvoyant qu'un nombre.

**Ce que ça apprend :** \`.filter\`, \`.map\`, \`new Set()\` sont les trois outils qui reviennent dans presque tout code métier en TypeScript. Les repérer, c'est pouvoir lire n'importe quel fichier de ce genre sans en connaître le détail à l'avance.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai su dire ce qu'isole chaque filter du code lu" },
      { dimension: "application", libelle: "J'ai expliqué correctement ce que mesure la taille d'un Set" },
      { dimension: "integration", libelle: "J'ai relié le tableau retourné à la façon dont l'appelant s'en sert" },
    ],
  },

  /* ------------------------------- DEV-04 -------------------------------- */
  {
    id: "diag-dev-04",
    titre: "Dérouler un pipeline de fonctions pures à la main",
    domaine: "developpement",
    type: "programmation",
    difficulte: 2,
    competences: ["DEV-04"],
    dureeEstimeeMin: 35,
    diagnostic: true,
    origine: "seed",
    enonce: `Extrait réel de \`lib/engine/skill-state.ts\` :

\`\`\`ts
/**
 * Une mauvaise performance isolée ne fait PAS baisser le niveau : elle baisse
 * la confiance. Le niveau ne recule que si une difficulté est confirmée par
 * plusieurs preuves — ici : les deux preuves les plus récentes sont des
 * échecs en autonomie réelle (A2+).
 */
function difficulteConfirmee(preuvesTriees: SkillEvidence[]): boolean {
  if (preuvesTriees.length < 3) return false;
  const deuxDernieres = preuvesTriees.slice(-2);
  return deuxDernieres.every((e) => e.resultat === "echec" && autonomieAuMoins(e, "A2"));
}

export function computeSkillState(skill: Skill, toutesPreuves: SkillEvidence[], now = new Date()): SkillState {
  const preuves = toutesPreuves
    .filter((e) => e.skillCode === skill.code && estRecevable(e))
    .sort((a, b) => a.date.localeCompare(b.date));

  const appuis = niveauSoutenu(preuves);
  let niveau = appuis.length > 0 ? Math.max(...appuis.map((a) => a.niveau)) : 0;

  if (difficulteConfirmee(preuves) && niveau > 1) {
    niveau = niveau - 1;
  }
  // ... calcul de la confiance, de la robustesse, des dimensions, puis du score.
  return { skill, niveau, /* ... */ };
}
\`\`\`

Enchaîner plusieurs fonctions pures (niveau → confiance → robustesse → score) est un **pipeline**. Le comprendre, c'est pouvoir prédire l'effet d'une preuve avant de l'enregistrer.

**Exercice :** fabrique à la main (sur papier) 3 preuves fictives pour une compétence de ton choix, avec des dates, une \`autonomie\`, un \`resultat\`, des \`dimensions\`. Calcule à la main le niveau soutenu, et vérifie si \`difficulteConfirmee\` s'applique. Écris ensuite un test dans le style des tests déjà présents dans \`lib/engine/*.test.ts\` (regarde-en un pour le format d'une preuve de test) qui vérifie ta prédiction, et lance-le.

**Question annexe :** dans quel cas précis le niveau peut-il *baisser* ? Pourquoi une seule mauvaise preuve ne suffit-elle jamais ?`,
    indices: [
      "Commence par écrire les 3 preuves sur papier avant d'ouvrir un éditeur — c'est l'exercice réel, pas le test lui-même.",
      "Pour que difficulteConfirmee s'applique, il faut au moins 3 preuves triées par date, et les 2 dernières doivent être des échecs en A2 ou plus.",
      "Une régression de niveau et une baisse de confiance sont deux mécanismes différents dans ce moteur — ne les confonds pas.",
    ],
    correction: `Il n'y a pas de résultat unique ici : le but est de vérifier ta prédiction contre le test que tu écris toi-même, c'est ça l'exercice.

**Question annexe.** Le niveau ne baisse que si \`difficulteConfirmee\` est vraie, c'est-à-dire si les **deux dernières preuves**, et seulement elles, sont des échecs en autonomie réelle (A2 ou plus), avec au moins 3 preuves au total. Une preuve isolée n'y suffit jamais : c'est la **confiance** qui encaisse une mauvaise performance isolée, pas le niveau — pour éviter qu'un jour difficile n'efface un acquis réel.

**Ce que ça apprend :** enchaîner plusieurs fonctions pures est ce qu'on appelle un pipeline. Le dérouler à la main, étape par étape, est la seule façon fiable de prédire ce qu'un changement va produire avant de l'exécuter.`,
    criteres: [
      { dimension: "application", libelle: "J'ai construit et fait passer un test qui vérifie ma prédiction manuelle" },
      { dimension: "transfert", libelle: "J'ai identifié correctement la condition de régression du niveau, sans la confondre avec la confiance" },
      { dimension: "justification", libelle: "J'ai expliqué pourquoi une preuve isolée ne fait jamais baisser un niveau" },
    ],
  },

  /* ------------------------------- DEV-05 -------------------------------- */
  {
    id: "diag-dev-05",
    titre: "Confronter le code à la documentation produit",
    domaine: "developpement",
    type: "etude-de-cas",
    difficulte: 3,
    competences: ["DEV-05"],
    dureeEstimeeMin: 25,
    diagnostic: true,
    origine: "seed",
    enonce: `Extrait réel de \`lib/engine/progression.ts\` :

\`\`\`ts
export function calculerEtatGlobal(etats: SkillState[], now = new Date()): EtatGlobal {
  const poidsTotal = etats.reduce((s, e) => s + e.skill.importance, 0);
  const acquis = etats.reduce((s, e) => s + e.skill.importance * ((e.score ?? 0) / 5), 0);
  const scoreGlobal = Math.round((acquis / poidsTotal) * 100);
  // ...
}
\`\`\`

Et un document produit du même dépôt, tel quel :

> \`calculerEtatGlobal\` calcule Σ importance × (score/5) ÷ Σ importance × 100 sur toutes les compétences du périmètre. Les compétences sans preuve entrent au **numérateur pour 0** et au **dénominateur pour leur importance pleine** : non mesuré y vaut exactement zéro, ce que le protocole interdit.
>
> Deux conséquences : le score est **anti-corrélé à l'ambition** — élargir le référentiel fait baisser le score sans qu'aucune compétence n'ait été perdue ; et un instrument dont la vertu est de ne pas confondre ignorance et incompétence peut afficher un score très bas en confondant exactement les deux.

**Questions :**
1. \`e.score ?? 0\` : une compétence sans preuve a \`e.score === null\`. Que devient-elle dans ce calcul ?
2. Explique avec tes mots pourquoi élargir le référentiel (ajouter des compétences non mesurées) fait *baisser* \`scoreGlobal\`, sans qu'aucune compétence existante n'ait changé.
3. Ce document range volontairement ce point en « question ouverte », pas en « bug à corriger ». Pourquoi ce n'est pas simplement un bug à corriger tout de suite — quel est le risque à « juste » exclure les non-mesurées du calcul, en passant, dans un autre chantier ?`,
    indices: [
      "?? 0 remplace null par 0 — regarde séparément l'effet sur le numérateur (acquis) et sur le dénominateur (poidsTotal).",
      "Ajouter une compétence non mesurée change un seul des deux termes de la fraction. Lequel, et dans quel sens ça pousse le ratio ?",
      "Un changement de formule change ce que le nombre affiché *veut dire*. Qui d'autre que le code est concerné par ce sens ?",
    ],
    correction: `**1.** \`null\` devient \`0\`. La compétence entre au numérateur pour 0, **et** au dénominateur pour son \`importance\` pleine.

**2.** Ajouter une compétence non mesurée augmente \`poidsTotal\` (dénominateur) sans augmenter \`acquis\` (numérateur) : le rapport \`acquis / poidsTotal\` baisse mécaniquement, même si toutes les compétences déjà mesurées sont restées identiques. Le score est donc anti-corrélé à l'ambition du référentiel.

**3.** La correction n'est pas neutre : exclure les non-mesurées change ce que le score *veut dire* (couverture vs performance pure), ce qui a des effets sur l'affichage et sur la confiance globale ailleurs dans le système. Un choix technique isolé, fait « en passant » dans un autre chantier, risquerait de trancher silencieusement un arbitrage produit qui mérite d'être posé à part, avec ses propres conséquences assumées.

**Ce que ça apprend :** un principe écrit dans un document et son application dans le code sont deux choses différentes, qui peuvent diverger sans que personne ne mente. Savoir repérer l'écart — et savoir le classer « en attente d'arbitrage » plutôt que « bug » — est une compétence à part entière.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai expliqué correctement ce que devient une compétence sans preuve dans le calcul" },
      { dimension: "justification", libelle: "J'ai expliqué pourquoi élargir un référentiel peut faire baisser un score sans rien perdre" },
      { dimension: "integration", libelle: "J'ai distingué une question ouverte d'un bug à corriger tout de suite, et dit pourquoi" },
    ],
  },

  /* ------------------------------- DEV-06 -------------------------------- */
  {
    id: "diag-dev-06",
    titre: "Tracer un flux client → serveur → base",
    domaine: "developpement",
    type: "etude-de-cas",
    difficulte: 3,
    competences: ["DEV-06"],
    dureeEstimeeMin: 30,
    diagnostic: true,
    origine: "seed",
    enonce: `Trois extraits réels du même dépôt, dans l'ordre où l'exécution les traverse.

\`\`\`tsx
// tourne dans le navigateur
"use client";

function soumettre() {
  demarrer(async () => {
    await terminerExercice({ attemptId, exerciseId: exercice.id, resultat, evaluation, dureeMin: duree });
  });
}
\`\`\`

\`\`\`ts
// tourne sur le serveur
"use server";

export async function terminerExercice(soumission) {
  // ... construit une ou plusieurs preuves à partir de la soumission
  for (const [index, code] of exercice.competences.entries()) {
    const preuve = {
      skillCode: code,
      niveauPreuve: index === 0 ? "A" : "B",
      // ...
    };
    await ajouter("evidence", preuve);
  }
}
\`\`\`

\`\`\`ts
// écrit réellement dans la base
export async function ajouter(nom, element) {
  const { supabase, userId } = await dorsaleCompte();
  const { error } = await supabase.from(TABLES[nom]).insert(entiteVersLigne(element, userId));
  return element;
}
\`\`\`

Dans Next.js, \`"use client"\` et \`"use server"\` délimitent deux mondes : ce qui tourne dans le navigateur, et ce qui tourne sur un serveur avec accès à la base. Comprendre cette frontière, c'est comprendre la majorité de l'architecture d'une application Next.js.

**Exercice :** dessine (sur papier, en texte, peu importe) le trajet complet d'un clic sur le bouton de soumission : quelle fonction appelle quelle fonction, qu'est-ce qui s'exécute dans le navigateur, qu'est-ce qui s'exécute sur le serveur, à quel moment la donnée part réellement vers la base.

**Question annexe :** pourquoi \`terminerExercice\` peut-elle écrire *plusieurs* preuves pour un seul exercice ?`,
    indices: [
      "Cherche dans le dépôt réel où soumettre() est défini, et remonte la chaîne d'appels jusqu'à la ligne qui touche effectivement la base.",
      "Le passage d'un monde à l'autre se fait à l'appel d'une fonction marquée \"use server\" — repère cet appel précis dans le premier extrait.",
      "Regarde ce que fait la boucle sur exercice.competences dans le deuxième extrait.",
    ],
    correction: `Le trajet : clic → \`soumettre()\` côté navigateur → appel à \`terminerExercice(...)\` : c'est **cet appel précis** qui bascule côté serveur, parce que la fonction est marquée \`"use server"\` → dans \`terminerExercice\`, construction de la ou des preuves et appel à \`ajouter("evidence", preuve)\` → dans la fonction \`ajouter\`, l'appel \`supabase.from(...).insert(...)\` est la ligne, et seulement elle, qui touche réellement la base.

**Annexe.** Un exercice peut viser plusieurs compétences à la fois. La première reçoit une preuve directe (niveau A), les suivantes une preuve indirecte (niveau B) — la boucle sur \`exercice.competences\` écrit une preuve par compétence ciblée.

**Ce que ça apprend :** situer précisément la ligne où un client cesse de parler à lui-même et commence à parler à un serveur (puis à une base) est la compétence de lecture d'architecture la plus rentable sur ce genre de projet.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai situé correctement la frontière client / serveur" },
      { dimension: "application", libelle: "J'ai tracé le trajet complet jusqu'à l'écriture réelle en base" },
      { dimension: "justification", libelle: "J'ai expliqué pourquoi un exercice peut écrire plusieurs preuves" },
    ],
  },

  /* ------------------------------- DEV-07 -------------------------------- */
  {
    id: "diag-dev-07",
    titre: "Trouver une contradiction entre deux fichiers",
    domaine: "developpement",
    type: "etude-de-cas",
    difficulte: 4,
    competences: ["DEV-07"],
    dureeEstimeeMin: 20,
    diagnostic: true,
    origine: "seed",
    enonce: `Deux commentaires réels, écrits dans deux fichiers voisins du même dépôt, le même jour.

\`\`\`ts
// en tête d'un fichier de Server Functions
/**
 * Application mono-utilisateur exécutée en local : il n'y a pas
 * d'authentification. Ne pas exposer cette application sur un réseau public.
 */
\`\`\`

\`\`\`ts
// en tête du fichier de persistance
/**
 * Les données vivent dans PostgreSQL, isolées par compte via les politiques
 * RLS. Sans session valide, aucune lecture ni écriture n'est possible.
 */

export async function compteObligatoire() {
  const compte = await compteCourant();
  if (!compte) {
    throw new Error("Aucune session : les données ne sont accessibles qu'avec un compte connecté.");
  }
  return compte;
}
\`\`\`

Un commentaire n'est pas exécuté — rien ne garantit qu'il est encore vrai. Le vérifier contre le code qui, lui, tourne réellement, est un réflexe à avoir en permanence, y compris face aux explications d'un assistant IA.

**Questions :**
1. Que dit chaque commentaire sur l'authentification ? Les deux ne peuvent pas être vrais en même temps.
2. Lequel décrit l'état réel du système ? Appuie-toi sur ce que fait réellement la fonction du second extrait, pas sur ce que dit le premier commentaire.
3. Ce n'est pas grave en soi — mais que ferais-tu de cette découverte ? (Ne corrige rien : dis ce que tu ferais, et pourquoi ce n'est probablement pas une urgence.)`,
    indices: [
      "Un commentaire décrit une intention passée ; une fonction qui lève une erreur décrit un comportement présent.",
      "Cherche depuis quand l'authentification a été introduite dans ce projet (les décisions d'architecture du dépôt en gardent la trace) — le premier commentaire date probablement d'avant.",
      "La question 3 teste ton jugement de proportion, pas ta capacité à corriger : un commentaire faux qui ne pilote aucune exécution a un coût différent d'un bug.",
    ],
    correction: `**1.** Le premier dit qu'il n'y a pas d'authentification. Le second implique une authentification obligatoire (une session valide est requise pour toute donnée).

**2.** Le second fichier décrit l'état réel : la fonction lève une erreur explicite si aucune session n'existe, ce qui est l'exact opposé d'une application locale sans authentification. Le premier commentaire date vraisemblablement d'avant l'introduction de l'authentification et n'a jamais été mis à jour.

**3.** Un commentaire faux à ce point mérite une correction, mais ce n'est ni urgent ni risqué : il ne pilote aucune exécution (contrairement au code), donc son seul coût est de tromper un futur lecteur. Le corriger en une ligne, la prochaine fois qu'on touche ce fichier pour une autre raison, suffit ; ce n'est pas un chantier à part.

**Ce que ça apprend :** le code ne ment jamais, les commentaires si — sans mauvaise foi, juste parce qu'ils ne sont pas exécutés. C'est le réflexe le plus utile face à toute documentation, humaine ou générée.`,
    criteres: [
      { dimension: "comprehension", libelle: "J'ai identifié précisément les deux affirmations contradictoires" },
      { dimension: "justification", libelle: "J'ai déterminé laquelle décrit l'état réel en m'appuyant sur le code, pas sur le commentaire" },
      { dimension: "integration", libelle: "J'ai proposé une réponse proportionnée plutôt qu'un chantier de correction immédiat" },
    ],
  },

  /* ------------------------------- DEV-08 -------------------------------- */
  {
    id: "diag-dev-08",
    titre: "Chasser une trace morte par recherche structurée",
    domaine: "developpement",
    type: "application",
    difficulte: 4,
    competences: ["DEV-08"],
    dureeEstimeeMin: 25,
    diagnostic: true,
    origine: "seed",
    enonce: `Une mécanique a été supprimée d'un projet réel — code, types, écran associé, tout retiré du même geste. Une recherche insensible à la casse sur son nom dans le code source (\`grep -ri <motif> src\`) remonte encore des occurrences.

**Exercice :** choisis, dans un dépôt que tu as sous la main (ce projet convient), un élément qui a été officiellement supprimé ou renommé (une décision d'architecture ou un changelog en garde généralement la trace). Lance une recherche structurée (grep, ou la recherche globale de ton éditeur) sur son ancien nom dans tout le code source, et relève chaque occurrence restante avec son fichier et sa ligne.

**Questions :**
1. Liste les fichiers et les lignes trouvées.
2. Pour chaque occurrence : est-ce un bug fonctionnel (ça casse quelque chose) ou un mensonge à l'utilisateur (l'interface promet quelque chose qui n'existe plus) ? Justifie chaque fois.
3. Si la même occurrence apparaît à l'identique dans plusieurs fichiers, qu'est-ce que ça t'indique sur la façon dont ces fichiers ont été écrits ?`,
    indices: [
      "Relire tout un dépôt fichier par fichier pour vérifier qu'une suppression est complète ne passe pas à l'échelle — c'est exactement pour ça que grep existe.",
      "Un commentaire qui explique *pourquoi* une ancienne mécanique a disparu est légitime et peut rester ; un texte visible par l'utilisateur qui la mentionne au présent ne l'est pas.",
      "Une même phrase identique dans deux fichiers différents indique rarement une coïncidence.",
    ],
    correction: `Il n'y a pas de résultat unique ici : ce qui compte est la méthode (recherche structurée sur tout le code source, pas fichier par fichier) et la qualité de la justification pour chaque occurrence trouvée — bug fonctionnel contre mensonge à l'utilisateur ne se tranchent pas de la même façon.

**Ce que ça apprend :** une recherche structurée (grep ou équivalent) pose une question précise à tout un dépôt d'un coup. C'est l'outil de vérification d'une suppression complète — pas la relecture fichier par fichier, qui ne passe pas à l'échelle dès que le dépôt grossit.`,
    criteres: [
      { dimension: "application", libelle: "J'ai utilisé une recherche structurée plutôt qu'une lecture fichier par fichier" },
      { dimension: "comprehension", libelle: "J'ai distingué un commentaire légitime sur une ancienne mécanique d'un texte visible trompeur" },
      { dimension: "justification", libelle: "J'ai justifié chaque occurrence trouvée individuellement, sans généraliser à l'aveugle" },
    ],
  },

  /* ------------------------------- DEV-09 -------------------------------- */
  {
    id: "diag-dev-09",
    titre: "Corriger un défaut réel avec le filet de sécurité",
    domaine: "developpement",
    type: "programmation",
    difficulte: 5,
    competences: ["DEV-09"],
    dureeEstimeeMin: 30,
    diagnostic: true,
    origine: "seed",
    enonce: `Reprends l'occurrence trouvée à l'exercice précédent (ou, si elle a déjà été corrigée entre-temps, une autre que tu identifies toi-même par la même méthode — un texte d'interface obsolète, un commentaire faux, un \`TODO\` non résolu).

**Exercice :** corrige-la, dans le ou les fichiers concernés, sans toucher à autre chose. Puis lance la suite de vérification complète du projet (typage statique, lint, tests — dans ce dépôt : \`cd app && npm run verify\`). Les trois étapes doivent passer.

**Questions :**
1. Si le vérificateur de types échouait sur ce changement précis (un simple texte modifié), qu'est-ce que ça t'apprendrait sur ce que faisait réellement cette ligne — qu'un texte d'affichage ne devrait normalement pas casser ?
2. Un process du type « une branche par fonctionnalité, une revue avant de fusionner » a un coût. Pour un changement de cette taille, en solo, est-ce proportionné, ou est-ce le genre de rituel pensé pour une équipe qu'il faut savoir alléger ? Prends position.`,
    indices: [
      "Un texte JSX statique ne devrait techniquement rien casser au typage — si c'est le cas, cherche ce qu'il y avait vraiment autour de ce texte.",
      "La suite de vérification (typage, lint, tests) est le filet de sécurité : c'est elle qui te dit si la correction est sûre, pas ton impression.",
      "La question 2 n'a pas de bonne réponse universelle — ce qui est jugé, c'est si ta position est justifiée et proportionnée à la taille réelle du changement.",
    ],
    correction: `**1.** Ça t'apprendrait que la ligne portait une dépendance de type (une variable, un import) et pas seulement du texte d'affichage — auquel cas le problème serait plus profond que sa seule apparence visible.

**2.** Position attendue : pour un changement isolé et petit, en solo, un rituel de revue à plusieurs est disproportionné. Ce qui reste utile, c'est de lancer la suite de vérification avant de committer — le filet de sécurité, pas le rituel social.

**Ce que ça apprend :** un filet de sécurité automatisé (typage, lint, tests) existe pour que la correction n'ait pas besoin d'être validée « à l'œil ». Savoir s'en servir, et savoir doser le process autour d'un changement à sa taille réelle, sont deux compétences distinctes et toutes deux nécessaires pour mener un projet seul.`,
    criteres: [
      { dimension: "application", libelle: "Ma correction fait passer la suite de vérification complète (typage, lint, tests)" },
      { dimension: "justification", libelle: "J'ai expliqué ce qu'un échec du typage sur ce changement m'aurait appris" },
      { dimension: "transfert", libelle: "J'ai jugé le process (branche, revue) proportionné à la taille réelle du changement, avec un argument" },
    ],
  },

  /* ------------------------------- DEV-10 -------------------------------- */
  {
    id: "diag-dev-10",
    titre: "Arbitrer soi-même une décision, avec une grille explicite",
    domaine: "developpement",
    type: "etude-de-cas",
    difficulte: 5,
    competences: ["DEV-10"],
    dureeEstimeeMin: 30,
    diagnostic: true,
    origine: "seed",
    enonce: `Reprends une question ouverte réelle d'un projet que tu connais (dans ce dépôt : la question de l'exercice DEV-05, « que faire des compétences non mesurées dans le score global »), et une grille de décision en 6 points telle que celle-ci :

1. Quel problème réel — pas une impression, quelque chose d'observable dans le code ou l'usage.
2. Quel besoin, distinct de la solution.
3. Quels effets secondaires (sur les calculs, l'affichage, une décision future).
4. Compatible avec les principes déjà posés du projet ?
5. Quelle alternative — « ne rien faire » compte comme une option recevable.
6. Ta recommandation, tranchée, pas une liste d'options équilibrées.

**Exercice :** écris ta propre note de décision (une demi-page suffit), en suivant exactement les 6 points, sans en esquiver aucun. Range ta conclusion dans un statut explicite (décision tranchée / hypothèse / question ouverte / abandonné) et assume que tant que tu ne l'as pas décidée toi-même, une analyse — même convaincante, même produite par un assistant — reste une hypothèse ou une question ouverte, jamais une décision.

**Ce que cet exercice teste réellement :** pas ta capacité à coder, mais ta capacité à dire non, ou à trancher différemment de ce qu'on t'aurait proposé, avec un argument aussi solide.`,
    indices: [
      "Le point 2 est le plus souvent sauté : retire la solution de la demande et redemande-toi ce qui est réellement en jeu.",
      "Le point 5 doit être une vraie option pesée, pas une formalité qu'on écarte en une phrase.",
      "Un avis qui rapporte les options sans en choisir une n'est pas une réponse acceptable au point 6, même si chaque option individuelle est bien analysée.",
    ],
    correction: `Il n'y a pas de corrigé unique ici. La seule vraie erreur possible est de rendre un avis qui esquive un des 6 points, ou qui se contente de rapporter les options sans trancher.

**Ce que ça apprend :** appliquer une grille de décision explicite, point par point, est ce qui transforme une opinion en argument vérifiable — et c'est la compétence qui permet de challenger une proposition (la sienne ou celle d'un tiers) plutôt que de la subir.`,
    criteres: [
      { dimension: "integration", libelle: "J'ai suivi les 6 points de la grille sans en esquiver aucun" },
      { dimension: "justification", libelle: "Ma recommandation est tranchée, pas une liste d'options équilibrées" },
      { dimension: "transfert", libelle: "J'ai rangé ma conclusion dans un statut explicite et justifié pourquoi" },
    ],
  },
];
