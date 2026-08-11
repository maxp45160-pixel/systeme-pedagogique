# ROADMAP — fermer la boucle pédagogique

**Version :** 11/08/2026  
**Source principale :** `docs/audits/2026-08-audit-produit.md`.  
**Cap :** faire passer le produit d'un moteur intelligent alimenté par des écrans séparés à un environnement qui observe une séance complète et adapte explicitement l'activité suivante.

## Règle d'ordre

La priorité n'est pas « la feature la plus séduisante ». Elle est : **quelle capacité produit rend les observations suivantes possibles ?**

```text
lever l'inconnue sur la séance
        ↓
borner et nourrir le périmètre de travail
        ↓
fiabiliser les faits
        ↓
workspace focus + relation séance↔tentative
        ↓
traces d'aide contextualisées
        ↓
motifs d'erreur → exercices ciblés
        ↓
ressources et notes dans la boucle
        ↓
mesure de l'effet → plan proposé et modèle auto-calibré
```

Les durées ci-dessous sont des ordres de grandeur pour une personne travaillant avec un agent, validation et tests compris. Elles donnent un horizon, pas une promesse calendaire.

## Priorisation synthétique

Score indicatif de dette/capacité : `(impact + risque) × (6 − effort)`, sur 5. Les dépendances priment sur le score.

| Élément | Impact | Risque si absent | Effort | Score | Ordre réel |
|---|---:|---:|---:|---:|---:|
| Périmètre actif + couverture actionnable | 5 | 5 | 2 | 40 | 1 |
| Validation runtime Supabase | 5 | 5 | 3 | 30 | 0 |
| Workspace focus + `sessionId` | 5 | 5 | 4 | 20 | 2 |
| Traces d'aide et autonomie | 5 | 4 | 3 | 27 | 3 |
| Motifs d'erreur adaptatifs | 5 | 4 | 4 | 18 | 4 |
| Hiérarchie, notes et ressources | 4 | 3 | 4 | 14 | 5 |
| Mesure de l'effet des décisions | 5 | 3 | 3 | 24 | 6 |
| Replanification automatique | 3 | 4 | 5 | 7 | non planifiée |

## LOT 0 — Fiabiliser ce que le moteur reçoit

**Horizon :** 2 à 4 jours.  
**Débloque :** tous les lots suivants.

### 0.0 Expliquer la coquille de séance

- **Fait de départ :** 51 séances en production, 50 auto-générées, une seule composée ; `statut`, `planifiee_pour`, `blueprint` et `besoin_declare` sont absents des lignes observées.
- **Méthode :** créer une séance planifiée par le parcours actuel, puis relire immédiatement sa ligne dans Supabase.
- **Sorties possibles :** si les quatre champs manquent, réparer le chemin d'écriture avant toute conception ; s'ils sont présents, le problème est bien le non-usage du parcours et le lot 2 doit le remplacer par le workspace décidé dans ADR-059.
- **Temps :** environ une heure, sans refonte préalable.

### 0.1 Valider les données à la frontière Supabase

- **Résultat attendu :** chaque ligne lue devient soit une entité de domaine valide, soit une erreur explicite ; aucun cast générique ne suffit.
- **Méthode :** validateurs runtime uniques par entité, appliqués au RPC et aux lectures séparées ; commencer par `SkillEvidence`, `ExerciseAttempt`, `Exercise`, `LearningSession`, `Skill` et `Domaine`.
- **Preuve :** des lignes avec enum, nombre, champ obligatoire, `source` ou `dimensions` invalides sont rejetées par les deux chemins de lecture.
- **Décision/dépendance :** vérifier d'abord le schéma Supabase réellement appliqué ; confirmation requise avant toute dépendance éventuelle.

### 0.2 Trancher la dimension absente

- **Résultat attendu :** l'absence d'une dimension ne pénalise plus silencieusement le score comme un échec observé.
- **Méthode :** construire trois sorties sur les données existantes — renormalisation sur dimensions observées, score absent sous couverture minimale, score + couverture dimensionnelle — puis choisir celle qui répond le mieux à « que peut-on affirmer ? ».
- **Preuve :** ajouter une dimension non observée ne fait pas baisser un score sans que l'interface indique explicitement la convention choisie.
- **Condition de démarrage :** arbitrage humain après comparaison des trois sorties ; aucun seuil inventé.

### 0.3 Nettoyage court

- supprimer l'ancien `lib/domain/referentiel.ts` après vérification d'absence d'import et adaptation éventuelle des fixtures ;
- corriger les deux erreurs ESLint du graphe ;
- dater l'état réel des migrations avant la modification de `attempts` du lot 2.

**Sortie de lot :** `npm run verify` vert et frontière de données testée.

## LOT 1 — Rendre le périmètre de travail actionnable

**Horizon :** fin de semaine 1, 2 à 4 jours après le diagnostic du lot 0.  
**Fait de départ :** 106 compétences actives, 23 exercices, 11 compétences couvertes ; le référentiel grossit plus vite que le corpus.

### Décision de design appliquée

Une compétence non mesurée reste en veille et remobilisable. Elle n'a pas besoin d'être **active maintenant**. `active` doit donc désigner le petit périmètre de travail courant, pas tout ce que le compte connaît.

### Deux gestes complémentaires

1. **Borner le périmètre actif.** Afficher `actives / couvertes`, proposer de mettre en veille un lot de compétences sans exercice et sans intention actuelle, sans rien supprimer.
2. **Nourrir les trous prioritaires.** Une action génère, par lots validés, les exercices manquants pour les meilleures recommandations du périmètre actif. Elle réutilise `composerSeance`, ses `manquants` et la génération groupée existante ; elle ne crée pas un second moteur.

### Preuve de réussite

- les dix premières recommandations du périmètre actif disposent chacune d'au moins un exercice éligible ou d'un lot prêt à valider ;
- la prochaine action dominante devient « commencer » plus souvent que « générer » ;
- le nombre de compétences actives cesse de croître plus vite que le corpus ;
- les compétences mises en veille restent visibles et remobilisables.

### Refus

Ne pas viser mécaniquement 60 % des 106 compétences en générant des dizaines d'exercices sans intention. La bonne couverture porte sur le périmètre réellement travaillé.

## LOT 2 — Faire de la séance le workspace focus

**Horizon :** semaines 2 à 3, 7 à 10 jours.  
**Débloque :** mesure réelle de l'aide, reprise, motifs, évaluation des recommandations.

### Parcours cible

1. La personne compose et démarre une séance.
2. `/seances/[id]` affiche une activité courante, pas seulement une liste.
3. L'exercice se déroule dans le contexte du workspace, en réutilisant le flux existant Chercher → Comparer → Mesurer.
4. La tentative porte `sessionId` et l'activité d'origine.
5. Après le bilan, le workspace sélectionne la prochaine activité et explique pourquoi.
6. Une fermeture puis réouverture reprend exactement la séance en cours.
7. La clôture calcule le bilan uniquement depuis les tentatives explicitement rattachées.

### Architecture

- étendre `ExerciseAttempt` avec `sessionId?: string` ; l'absence conserve la compatibilité historique ;
- transmettre `sessionId` depuis le workspace jusqu'à `demarrerTentative` ;
- remplacer progressivement l'association `exerciseId + date >= début` par la relation explicite ;
- conserver `LearningSession` comme seule entité de séance ;
- extraire du composant de 1 016 lignes les étapes de composition, l'état de workspace et la liste des activités ;
- ne pas dupliquer la page exercice : isoler ses trois actes en composants réutilisables.

### Preuve de réussite

- une séance de trois exercices se déroule sans revenir à une page d'index ;
- une tentative ultérieure du même exercice ne modifie pas l'ancienne séance ;
- pause/reprise conserve l'activité courante ;
- terminer deux fois ne crée pas deux entrées de journal ;
- tests unitaires d'attribution et test de parcours complet.

### Critère d'échec

Si le workspace n'est qu'une iframe ou une suite de liens redessinée, le lot est refusé : il doit porter le contexte, la progression et la reprise.

## LOT 3 — Mesurer l'aide avant de la demander

**Horizon :** semaine 4, 5 à 8 jours.  
**Dépend de :** lot 2.

### Tranche verticale initiale

Ajouter quatre traces reliées à la tentative :

- `indice-ouvert` avec son rang ;
- `tuteur-sollicite` avec le contexte d'appel, sans stocker une mesure produite par le LLM ;
- `correction-revelee` ;
- `ressource-ouverte` lorsque le lot 5 existera.

Une trace porte `kind`, `occurredAt`, `source` et les métadonnées strictement consommées par le moteur. Elle peut commencer comme tableau JSONB borné sur `ExerciseAttempt` ; une table d'événements séparée n'est justifiée que si les requêtes ou le volume l'exigent.

### Comportement

- `autonomieObservee` lit d'abord les traces internes ;
- le bilan affiche ce qui a déjà été observé ;
- il demande seulement l'aide extérieure invisible ;
- la valeur la plus contraignante l'emporte ;
- l'utilisateur peut corriger une trace erronée avant validation du bilan.

### Preuve de réussite

- solliciter le tuteur pendant un exercice modifie l'autonomie proposée ;
- ne pas avoir de trace n'est jamais présenté comme « aucune aide » ;
- chaque autonomie affichée cite les traces et la déclaration qui la fondent ;
- la correction assistée est intégrée au workspace et commence à produire assez de verdicts archivés pour le lot 4 ;
- 10 à 20 bilans réels fournissent la première confrontation de `PLAFOND_AIDE`.

## LOT 4 — Transformer les erreurs récurrentes en intervention

**Horizon :** semaine 5, 6 à 10 jours.  
**Dépend de :** lots 2 et 3 ; au moins deux verdicts comparables sur une compétence. Aujourd'hui, un seul verdict est archivé sur 49 tentatives : la donnée doit d'abord être produite.

### Version 1

- injecter dans la correction les 2–3 verdicts antérieurs de la même compétence, avec leurs dates et sans correction complète ;
- normaliser les entrées `aRetravailler` sans en changer le sens ;
- regrouper les formulations identiques ou proches ;
- rendre un `MotifCandidat` dérivé : libellé, occurrences, dates, tentatives sources, confiance ;
- ne montrer un motif qu'avec au moins deux observations ;
- afficher les preuves qui le soutiennent et permettre de le réfuter ;
- ajouter le motif au contrat de génération avec difficulté, dimension faible et exigence de contexte différent.

### Boucle testée

```text
erreur observée deux fois
  → motif candidat expliqué
  → exercice ciblé généré et validé
  → nouvelle tentative
  → motif confirmé, nuancé ou non retrouvé
```

### Preuve de réussite

- le moteur ne produit aucun motif depuis une occurrence unique ;
- l'exercice généré contient un critère qui teste le motif visé ;
- le résultat ultérieur peut diminuer la confiance du motif sans effacer son histoire ;
- le tuteur ne crée aucun code de compétence ni aucune mesure.

## LOT 5 — Construire la connaissance personnelle dans la boucle

**Horizon :** semaines 6 à 7, 8 à 12 jours.  
**Dépend de :** lot 0 ; peut avancer après stabilisation du workspace.

### Modèle cible minimal

- `Theme.parentId?: string` pour une hiérarchie récursive sans profondeur imposée ;
- une note/ressource avec titre, contenu Markdown, source facultative, liens vers thèmes et compétences, dates et archivage ;
- aucune mesure dans ces entités ;
- graphe enrichi de nœuds note/ressource et de liens déclarés ;
- contexte tuteur chargé à la demande, borné aux ressources liées au sujet courant.

### Ordre d'implémentation

1. thèmes et sous-thèmes récursifs dans la liste ;
2. note Markdown créée et liée manuellement ;
3. note visible dans le graphe ;
4. sélection explicite d'une note comme matériau d'une séance ou d'un exercice ;
5. import Markdown seulement après validation du parcours manuel ;
6. PDF/Obsidian uniquement à partir d'exemples réels.

### Preuve de réussite

Un utilisateur ajoute une note de cours, la classe sous deux niveaux de thèmes, la lie à une compétence, la sélectionne pour une séance, puis reçoit un exercice dont la source est citée — sans que cette note devienne une preuve de maîtrise.

## LOT 6 — Mesurer l'intelligence du produit

**Horizon :** instrumentation après le lot 2 ; analyse après au moins 20 à 30 recommandations suivies d'une décision et d'une tentative.  
**Dépend de :** lots 2 à 4.

### Faits à conserver

- recommandation servie et facteurs ;
- acceptée, passée ou ignorée ;
- exercice réellement commencé ;
- issue, durée, aide et dimension mesurée ;
- motif ciblé éventuel ;
- séance et délai associés.

### Questions auxquelles répondre

- les premières recommandations sont-elles réellement suivies ?
- la difficulté conseillée maintient-elle un effort productif ?
- cibler une dimension faible ou un motif améliore-t-il la tentative suivante ?
- les séances planifiées sont-elles démarrées, déplacées ou ignorées ?

### Sorties possibles, pas encore décidées

- ajuster un poids ou un seuil sur données observées ;
- conserver les heuristiques si elles font aussi bien ;
- proposer une file glissante de prochaines séances ;
- replanifier uniquement les suggestions non acceptées.

Le lot ne peut pas conclure avant d'avoir les données. Il n'autorise aucune replanification silencieuse.

## Calendrier recommandé

| Période | Objectif visible |
|---|---|
| **Jour 1** | Le vide des colonnes de séance est expliqué : bug ou non-usage |
| **Jours 1–4** | Données fiables, convention de dimension instruite, vérification verte |
| **Fin semaine 1** | Le périmètre actif est borné et ses premières recommandations sont actionnables |
| **Semaines 2–3** | Une séance complète se déroule et se reprend dans le workspace focus |
| **Semaine 4** | Le système observe indices et sollicitations du tuteur avant de demander l'aide invisible |
| **Semaine 5** | Une erreur répétée peut déclencher un exercice ciblé et traçable |
| **Semaines 6–7** | Une note de cours organisée entre dans le graphe puis dans une séance |
| **À partir de 20–30 décisions suivies** | Première mesure de la qualité des recommandations et décision sur la planification |

## Backlog explicitement repoussé

- reporting hebdomadaire et nouvel écran long terme ;
- widgets configurables ;
- détection de triche ;
- comparaison entre comptes ;
- modèle prédictif externe ;
- import universel de ressources ;
- replanification automatique de tout le parcours ;
- nettoyage sans lien avec un lot fonctionnel.

## Définition de « terminé » pour une feature

Une brique n'est terminée que si :

1. le geste utilisateur complet existe ;
2. les faits produits ont une source et une finalité ;
3. la dérivation reste recalculable ;
4. l'action suivante change à partir de ces faits ;
5. le « pourquoi » est visible ;
6. un test de parcours et un usage réel confirment la boucle ;
7. l'ADR et la carte reflètent le résultat sans promotion automatique de statut.
