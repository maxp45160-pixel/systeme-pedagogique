/**
 * Exercices de diagnostic initial.
 *
 * Un exercice par compétence listée dans `01_PLAN_EVALUATION_INITIALE.txt`,
 * dans l'ordre de priorité qu'il fixe. Objectif de ces exercices : SITUER un
 * niveau réel, pas enseigner — d'où des énoncés courts, sans aide préalable,
 * et une correction qui distingue méthode et résultat.
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
];
