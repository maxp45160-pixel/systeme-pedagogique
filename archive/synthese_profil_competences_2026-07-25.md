# Synthèse du profil de compétences

**Date de synthèse :** 25/07/2026
**Thématique couverte :** Concevoir et piloter un système de production sous incertitude
**Séquences couvertes :** Niveau 1 (Fondamentaux) — clos ; Niveau 2 (Application) — clos ; Niveau 3 (Intégration) — démarré, exercice en cours (script Python non encore exécuté)

> **Note méthodologique** — Cette synthèse est construite conformément au protocole d'évaluation et au protocole anti-hallucination du projet : chaque niveau est justifié par une preuve directe observée dans les échanges (Niveau A), aucune compétence n'est déduite sans preuve, et les zones d'incertitude sont explicitement signalées. Elle repose sur une **seule séquence d'exercices** — la robustesse de plusieurs compétences reste donc à confirmer par un retest dans un contexte différent avant de les considérer comme acquises durablement.

---

## C1 — Identifier et typer les sources d'incertitude d'un système de production

- **DOMAINE :** Logistique industrielle / Systèmes complexes
- **NIVEAU :** 3 — Application autonome (avec réserve, voir lacunes)
- **SCORE :** ≈ 3,5/5
- **ROBUSTESSE :** Faible (un seul contexte testé)
- **CONFIANCE :** Moyenne
- **DERNIÈRE PREUVE :** Niveau 1, Exercice 1 + discussion takt time / temps de cycle
- **PREUVES PRINCIPALES :**
  - Classification initiale correcte et autonome de 6 paramètres de planification (demande, temps de cycle, taux de rebut, délai fournisseur, disponibilité opérateurs, nomenclature) selon déterministe/incertain, avec typologie correcte (demande, capacité/process, approvisionnement).
  - Confusion initiale sur la relation takt time / temps de cycle (a inversé la relation causale), corrigée après échange et reformulée correctement ensuite sans aide ("takt time = rythme client, il faut takt time > temps de cycle").
- **ERREURS RÉCURRENTES :** Confusion entre calcul du takt time et du temps de cycle (corrigée une fois).
- **CONTEXTES TESTÉS :** 1 (exercice initial, un seul secteur/produit).
- **LACUNES :** Le paramètre-piège visé par l'exercice (la nomenclature, traitée à tort comme fiable) n'a pas été identifié de façon autonome — la réponse donnée portait sur le temps de cycle (réponse valable sur le fond, mais pas la cible de la question). L'angle "données de référence supposées fiables" reste un point aveugle à retester.
- **PROCHAINE ÉVALUATION :** Reproposer un exercice de classification dans un contexte différent (ex. réseau logistique plutôt que production) pour tester le transfert.
- **STATUT :** En consolidation.

---

## C2 — Calculer et interpréter les statistiques descriptives d'une série de demande

- **DOMAINE :** Méthodes statistiques
- **NIVEAU :** 3 — Application autonome
- **SCORE :** ≈ 4/5
- **ROBUSTESSE :** Faible (un seul jeu de données testé)
- **CONFIANCE :** Moyenne à forte
- **DERNIÈRE PREUVE :** Niveau 1, Exercice 2
- **PREUVES PRINCIPALES :**
  - Erreur initiale sur la valeur de la moyenne (104 au lieu de 116,9) détectée et corrigée seule après invitation à vérifier — bon réflexe de contrôle.
  - Interprétation qualitative du coefficient de variation correcte, avec une anticipation spontanée (non demandée à ce stade) du lien entre variabilité et dimensionnement du stock de sécurité — signe d'une bonne intuition transversale.
- **ERREURS RÉCURRENTES :** Risque de propager une valeur intermédiaire erronée (ex. la moyenne) dans un calcul à plusieurs étapes sans la re-vérifier.
- **CONTEXTES TESTÉS :** 1 (série de demande hebdomadaire).
- **LACUNES :** La distinction écart-type population (÷n) vs échantillon (÷n−1) n'a pas été abordée — INFORMATION NON DISPONIBLE, non testée à ce stade.
- **PROCHAINE ÉVALUATION :** Nouvelle série de données, dans un contexte différent (ex. variabilité d'un temps de cycle plutôt que d'une demande).
- **STATUT :** Acquis niveau 1, à retester pour la robustesse.

---

## C3 — Calculer un stock de sécurité à taux de service cible (formule z × σ, cas simple)

- **DOMAINE :** Logistique industrielle / Statistiques appliquées
- **NIVEAU :** 3 — Application autonome
- **SCORE :** ≈ 4/5
- **ROBUSTESSE :** Faible (une seule référence testée)
- **CONFIANCE :** Forte pour le calcul ; moyenne pour la justification théorique (voir C6)
- **DERNIÈRE PREUVE :** Niveau 2, Exercice 1
- **PREUVES PRINCIPALES :**
  - Calculs corrects pour z = 1,65 et z = 2,33 (résultat à un arrondi près sur le second).
  - Comparaison correcte des stocks à 90 %, 95 %, 99 % menant à la bonne conclusion (relation non proportionnelle) après un indice.
- **ERREURS RÉCURRENTES :** Arrondi effectué en cours de calcul plutôt qu'à la fin, avec un impact en cascade sur une question suivante.
- **CONTEXTES TESTÉS :** 1 (une seule référence produit).
- **LACUNES :** Voir C6 (justification théorique du coefficient z encore fragile).
- **PROCHAINE ÉVALUATION :** Application à une nouvelle référence avec un taux de service différent.
- **STATUT :** Acquis, robustesse à confirmer.

---

## C4 — Analyser la relation entre taux de service visé et stock de sécurité

- **DOMAINE :** Logistique industrielle / Analyse économique
- **NIVEAU :** 4 — Transfert (initiative au-delà de l'exercice demandé)
- **SCORE :** ≈ 3,5/5
- **ROBUSTESSE :** Faible (une seule preuve)
- **CONFIANCE :** Moyenne
- **DERNIÈRE PREUVE :** Niveau 2, Exercice 1, questions 3-4
- **PREUVES PRINCIPALES :**
  - A correctement quantifié et interprété la non-proportionnalité (+5 puis +10 unités pour des sauts de service décroissants).
  - Tentative spontanée de relier ce résultat au modèle de Wilson (EOQ) — bonne initiative de connexion interdisciplinaire, bien que le modèle exact pertinent soit différent (newsvendor).
- **ERREURS RÉCURRENTES :** Vocabulaire mathématique approximatif ("exponentiel" pour décrire une accélération sans preuve formelle) ; confusion entre modèles économiques de gestion de stock (Wilson vs newsvendor).
- **CONTEXTES TESTÉS :** 1.
- **LACUNES :** Distinction entre modèle en avenir certain (Wilson/EOQ) et modèle en avenir incertain (newsvendor).
- **PROCHAINE ÉVALUATION :** Question ciblée comparant explicitement les deux modèles.
- **STATUT :** En progression, point fort à valoriser (initiative de transfert).

---

## C5 — Calculer un stock de sécurité sous incertitude combinée (demande + délai fournisseur)

- **DOMAINE :** Logistique industrielle / Statistiques appliquées
- **NIVEAU :** 2 → 3 (en cours de consolidation)
- **SCORE :** ≈ 3/5
- **ROBUSTESSE :** Faible — compréhension acquise avec un accompagnement fort, non encore retestée sans aide
- **CONFIANCE :** Faible à moyenne
- **DERNIÈRE PREUVE :** Niveau 2, Exercice 2
- **PREUVES PRINCIPALES :**
  - Calculs numériques corrects dès le premier essai (Q1 : 122,5 ; Q2 : +435 %).
  - Erreur d'attribution des termes croisés en Q3 (a comparé D² et σ_D² directement au lieu des termes réellement combinés L×σ_D² et D²×σ_L²) — deux relances pédagogiques nécessaires avant une conclusion correcte et argumentée.
- **ERREURS RÉCURRENTES :** Comparer des grandeurs qui se "ressemblent" visuellement plutôt que les termes effectivement combinés dans une formule.
- **CONTEXTES TESTÉS :** 1.
- **LACUNES :** La compréhension intuitive du "pourquoi" de la formule combinée reste fragile — n'a pas encore été vérifiée sans support explicatif du tuteur.
- **PROCHAINE ÉVALUATION :** Reformuler un exercice similaire avec des données différentes, sans réexpliquer la formule, pour vérifier la rétention.
- **STATUT :** Fragile — prioritaire pour un retest rapproché.

---

## C6 — Relier le stock de sécurité à la loi normale centrée réduite (z = (X−μ)/σ)

- **DOMAINE :** Statistiques et probabilités
- **NIVEAU :** 1 → 2 (en cours)
- **SCORE :** ≈ 2/5
- **ROBUSTESSE :** Faible
- **CONFIANCE :** Faible
- **DERNIÈRE PREUVE :** Dernier échange (rappel actif sur z)
- **PREUVES PRINCIPALES :**
  - A retrouvé seul, après recherche externe, la formule z = (X−μ)/σ et le nom "loi normale centrée réduite".
  - Interprétation correcte de l'aire sous la courbe (95 % à gauche, 5 % exclus à droite).
  - N'a pas encore reformulé ce que représente concrètement X dans le contexte du stock de sécurité ("X = une valeur donnée" — définition encore vague) ; a explicitement indiqué avoir oublié ce point.
- **ERREURS RÉCURRENTES :** Définition de X non reliée explicitement au niveau de demande à couvrir.
- **CONTEXTES TESTÉS :** 1 (rappel, pas un nouvel exercice noté).
- **LACUNES :** Le lien complet entre le z-score générique et son application concrète au stock de sécurité n'est pas encore consolidé — à vérifier lors du prochain échange avant de considérer ce point acquis.
- **PROCHAINE ÉVALUATION :** Reprendre la question ouverte en début de prochaine session.
- **STATUT :** Lacune identifiée, en cours de comblement.

---

## C7 — Programmation Python appliquée à la logistique/production

- **DOMAINE :** Algorithmique et programmation
- **NIVEAU :** 0 — Exposition
- **SCORE :** INFORMATION NON DISPONIBLE (aucune preuve d'exécution à ce stade)
- **ROBUSTESSE :** N/A
- **CONFIANCE :** Faible (absence de preuve, pas contradiction)
- **DERNIÈRE PREUVE :** Aucune — un script de démarrage et une mission (boucle sur une liste de dictionnaires) ont été fournis, non encore exécutés au moment de cette synthèse.
- **PREUVES PRINCIPALES :** Aucune.
- **ERREURS RÉCURRENTES :** N/A.
- **CONTEXTES TESTÉS :** Aucun.
- **LACUNES :** L'ensemble du domaine — cohérent avec le niveau déclaré par l'utilisateur lui-même ("je ne sais pas encore programmer").
- **PROCHAINE ÉVALUATION :** À l'exécution du script du Niveau 3 (structure de données + boucle for).
- **STATUT :** À évaluer prochainement.

---

## Domaines non couverts à ce jour

Conformément au protocole (section 9, audit périodique), les domaines suivants n'ont fait l'objet d'aucune évaluation dans les échanges observés : **gestion de production au sens large (PIC/PDP/MRP/ordonnancement au-delà des notions de cours), recherche opérationnelle/optimisation, systèmes complexes (boucles de rétroaction, dynamique des systèmes), technologies innovantes (IA, IoT, jumeaux numériques)**. Aucun niveau ne doit leur être attribué — INFORMATION NON DISPONIBLE.

## Priorités recommandées pour la suite

1. **C6** (lien z-score / stock de sécurité) — lacune ouverte et explicitement reconnue par l'utilisateur, à combler en priorité avant de continuer à empiler des notions dessus.
2. **C5** (stock combiné) — compréhension acquise avec un fort accompagnement, à retester sans aide pour confirmer qu'elle est retenue.
3. **C7** (Python) — premier exercice donné (Niveau 3), en attente d'exécution.
4. Maintenir C1-C4 par un usage régulier plutôt que les laisser de côté, pour éviter l'érosion d'une compétence déjà démontrée mais non robuste (preuve unique).

## Préférences pédagogiques déclarées par l'utilisateur (à respecter dans le suivi)

- Souhaite une approche mixte calcul manuel + Python pour la suite du parcours (pas de passage à l'automatisation intégrale).
- Souhaite des rappels réguliers et être poussé à recalculer/reformuler les notions déjà vues plutôt que de se les faire simplement rappeler, dans une logique de base solide avant d'avancer.
