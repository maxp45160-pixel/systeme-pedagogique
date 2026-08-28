# Orchestration pédagogique — plan d'implémentation et prompts

> Statut : **plan de chantier à valider — non construit**.
>
> La direction produit est fixée par `PRODUCT.md` et l'ADR-139. La référence
> visuelle du tableau de bord a été validée par Maxime le 27/08/2026. Ce
> document séquence l'implémentation ; il ne vaut ni migration appliquée, ni
> preuve de fonctionnement.

![Référence visuelle validée](./assets/tableau-de-bord-orchestration-cible.png)

## 1. Résultat final attendu

Le chantier est terminé uniquement lorsque :

- le tableau de bord réel reprend la composition, la densité, la hiérarchie et
  le langage visuel de l'image ci-dessus ;
- le plan reste dérivé et n'est jamais persisté comme vérité ;
- seules les séances acceptées deviennent des `LearningSession` ;
- une `LearningSession` peut faire résoudre, expliquer, rappeler, lire,
  synthétiser, produire, diagnostiquer ou demander de l'aide ;
- chaque intervention distingue mesure, préparation et soutien ;
- une séance manquée, déplacée ou abandonnée replanifie sans produire de
  mesure ni de dette ;
- le calendrier externe projette uniquement les séances acceptées ;
- les anciens chemins ne sont retirés qu'après parité fonctionnelle ;
- l'utilisateur confirme les ambiguïtés et les changements importants, mais
  n'administre jamais la maintenance interne de Twiny.

La référence visuelle n'est pas un dessin décoratif. Pour les lots UI, elle
sert de critère d'acceptation au même titre que les tests métier.

## 2. Ordre et dépendances

| Lot | Résultat livrable | Dépend de |
|---|---|---|
| 0 | audit réel et matrice de migration | documentation actuelle |
| 1 | langage commun des interventions | lot 0 |
| 2 | planificateur pur v0 et préparation qualitative | lot 1 |
| 3 | acceptation et matérialisation atomique | lots 1–2 |
| 4 | tableau de bord fidèle à la référence | lot 3 |
| 5 | revue groupée de replanification | lots 3–4 |
| 6 | chronologie À venir dans Séances | lots 3–4 |
| 7 | exécution multi-interventions | lots 1 et 6 |
| 8 | cours et protocoles raccordés au plan global | lots 2–3 et 7 |
| 9 | contexte progressif et besoins concurrents | lots 2–6 |
| 10 | calendrier externe | lots 3 et 5, ADR d'infrastructure |
| 11 | hypothèses de motifs | historique suffisant après lots précédents |
| 12 | retraits, promesse publique et vérification finale | tous les lots utiles |

Chaque lot doit pouvoir être fusionné sans exiger que le suivant existe. Un lot
qui laisse le produit inutilisable ou deux sources de vérité n'est pas
vertical.

## 3. Prompt socle à préfixer à chaque lot

Copier ce bloc au début de chaque nouveau chantier, puis ajouter le prompt du
lot concerné.

```text
Travaille dans le dépôt « Système pédagogique ».

Avant toute décision, lis AGENTS.md, PRODUCT.md, ARCHITECTURE_DECISIONS.md,
docs/architecture/TWINY_MODEL.md, ENGINE_CONTRACTS.md et
docs/design/PLAN_INTERFACE_ORCHESTRATION_PEDAGOGIQUE.md. Pour tout écran du
tableau de bord, ouvre et inspecte réellement
docs/design/assets/tableau-de-bord-orchestration-cible.png.

Respecte les six couches. Connaît et Observe sont stockés et jamais fabriqués ;
Décide est dérivé et jamais autoritatif. Le plan ne se persiste pas. Seules les
séances acceptées deviennent des LearningSession. Ne crée aucune nouvelle
entité de travail. Une intervention terminée ne produit une observation que si
un contrat de preuve recevable le permet.

Commence par le skeleton : signatures, imports, types et dépendances. Ne lis un
corps de fonction que si tu dois le comprendre ou le modifier. Compare toujours
la cible au code réel. Préserve les modifications utilisateur sans rapport.

Ne modifie pas silencieusement .env.local, app/supabase/schema.sql ou
app/data/00_instructions/. Toute modification de base commence par la
vérification Supabase réelle, la lecture des ADR et une migration additive.
N'installe aucune dépendance sans validation. Ne fais pas de refonte big bang.

Réutilise les composants, tokens, espacements et variantes de boutons existants.
Pas d'emoji dans le frontend. Pas de nouvelle route Plan ou Calendrier. La
logique métier non triviale vit dans lib/, jamais dans un composant.

Avant de coder, présente un plan court et les décisions irréversibles. Implémente
ensuite seulement le lot demandé, avec ses tests. Exécute les tests ciblés puis
les vérifications proportionnées au risque. Pour un lot UI, vérifie clair/sombre,
mobile/bureau, clavier, contraste et reduced motion. Capture le rendu à
1440 × 1024 et compare-le visuellement à la référence ; corrige les écarts de
hiérarchie, largeur, densité, espacements, typographie, bordures et boutons.

Avant de conclure, relis les sections touchées de PRODUCT.md et des ADR et mets
la documentation à jour dans le même changement. Ne monte aucun statut. Donne
le diff fonctionnel, les tests exécutés, les limites et la prochaine étape sûre.
```

## 4. Lot 0 — audit réel avant migration

### But

Établir ce qui peut être étendu sans duplication : forme réelle de
`LearningSession`, stockage de `activites`, création/annulation de séance,
protocoles de cours, recommandation, engagements, clés navigateur et schéma
Supabase effectivement appliqué.

### Prompt du lot

```text
Réalise le lot 0 de l'orchestration pédagogique : audit uniquement, sans
modifier le code, le schéma ni les données.

Inspecte d'abord les types et frontières autour de LearningSession,
BlueprintSeance, creerSeance, annulerSeance, chargerContexte,
recommendLearningAction, recommander, ProtocoleCoursPanel, la page tableau de
bord et la page Séances. Vérifie ensuite la base Supabase réelle : tables,
colonnes, contraintes, RLS et migrations effectivement appliquées concernant
les séances, engagements et activités. Inventorie aussi les clés localStorage
du tableau de bord.

Produis une matrice : contrat cible, implémentation actuelle, écart, réemploi,
migration nécessaire ou non, risque, test de non-régression. Identifie les
endroits exacts où le code centré exercice empêche une intervention plus large.
N'infère jamais qu'une migration présente dans le dépôt est appliquée.

Termine par un plan de transition additive et réversible pour les lots 1 à 3,
avec les décisions qui exigent une validation humaine. N'écris rien dans la
base et ne transforme pas l'audit en décision validée.
```

### Sortie attendue

- rapport d'audit lié aux fichiers et au schéma réels ;
- stratégie de compatibilité pour les séances historiques ;
- liste des migrations éventuellement nécessaires, sans application ;
- inventaire des tests à sécuriser avant le premier changement.

## 5. Lot 1 — langage commun des interventions

### But

Étendre `LearningSession` par composition, sans casser les séances historiques
et sans créer de nouvelle entité.

### Prompt du lot

```text
Implémente le lot 1 : le langage métier commun des interventions dans
LearningSession.

À partir de l'audit validé, introduis une seule définition partagée pour les
types resoudre, expliquer, rappeler, lire, synthetiser, produire,
diagnostiquer et demander-aide, ainsi que les effets mesure, preparation et
soutien. Définis un contrat InterventionSeance minimal : identité stable dans
la séance, type, libellé, durée estimée facultative, source explicite, cibles
facultatives, effet attendu et contrat de preuve facultatif.

Réemploie ou adapte LearningSession.activites et BlueprintSeance si leur forme
réelle le permet. Les anciennes séances doivent rester lisibles par un
adaptateur pur et testé. Ne duplique aucune validation. Une valeur inconnue ou
invalide est rejetée ou mise en réserve, jamais convertie en exercice ou en
mesure par défaut.

Ajoute les tests de domaine suivants : lecture historique, chaque type
d'intervention accepté, effet obligatoire, préparation sans preuve, soutien
sans preuve, abandon sans observation, type invalide refusé. Ne modifie encore
ni le classement pédagogique, ni le tableau de bord.

Si la persistance exige une migration, arrête-toi après avoir préparé la
proposition et demande sa validation ; ne modifie pas silencieusement le schéma.
```

### Critère de passage

Une séance historique et une séance multi-interventions peuvent être validées
par la même frontière, sans changement de leur sens et sans nouvelle table de
travail.

## 6. Lot 2 — planificateur pur v0

### But

Produire un plan explicable et une préparation qualitative à partir de faits,
sans aucune écriture.

### Prompt du lot

```text
Implémente le lot 2 : un planificateur temporel pur v0 dans lib/engine/.

Ne remplace pas recommander() ou recommendLearningAction() : adapte leur sortie
en actions candidates puis compose ces candidats dans le temps. Le moteur doit
recevoir en paramètres les engagements ouverts, disponibilités déclarées,
états de compétence, candidats, refus observés et LearningSession déjà
acceptées. Il ne lit ni Supabase, ni l'horloge, ni les variables d'environnement.

Retourne un PlanPropose non persisté : créneaux candidats, durée, intervention,
effet, raisons, contraintes et réserves. Retourne aussi une préparation
qualitative par échéance : non-estimable, a-eclaircir, a-renforcer, en-bonne-voie
ou pret-d-apres-les-preuves-disponibles. N'ajoute aucun pourcentage ni nouveau
seuil de calibration.

La v0 doit être déterministe : respecter les séances acceptées, exclure les
créneaux indisponibles, préserver un besoin continu lorsque la capacité le
permet, proposer un diagnostic quand l'absence de preuve empêche d'estimer, et
signaler franchement les conflits impossibles.

Teste au minimum : même entrée même plan ; aucune disponibilité ; absence de
preuve ; deux échéances concurrentes ; besoin continu ; séance acceptée
protégée ; refus ; séance manquée sans pénalité ; replanification après nouvelle
preuve ; moteur sans écriture. Documente toute règle arbitraire comme hypothèse
et non comme vérité pédagogique.
```

### Critère de passage

Un scénario d'une semaine peut être recalculé intégralement depuis ses faits,
et supprimer le résultat du calcul ne fait perdre aucune donnée métier.

## 7. Lot 3 — acceptation et matérialisation

### But

Faire de l'acceptation le seul passage entre plan candidat et séance durable.

### Prompt du lot

```text
Implémente le lot 3 : accepter un plan et matérialiser uniquement les séances
acceptées sous forme de LearningSession.

Crée une frontière d'application unique qui reçoit la proposition affichée et
le choix explicite de la personne. Elle revalide le compte, les compétences,
les domaines, les créneaux et les invariants avant écriture. Le PlanPropose
complet ne doit jamais être stocké. Conserve seulement les faits nécessaires :
LearningSession acceptée, origine de la proposition et éventuels faits de
refus/déplacement utiles à la replanification.

L'acceptation d'un lot et l'ajustement groupé de séances existantes doivent
être atomiques et idempotents. Un double envoi ne crée pas deux séances. Une
candidate ignorée ne laisse aucune LearningSession. Déplacer ou annuler une
séance ne produit aucune observation. Respecte les règles d'archivage et les
sessions déjà en cours.

Vérifie l'état Supabase réel avant toute migration. Si un changement de schéma
est requis, crée la migration additive, documente son état réel et ne l'applique
qu'avec l'autorisation prévue par le workflow. Ajoute des tests de domaine,
store et intégration pour l'atomicité, l'idempotence, les droits compte et
l'absence d'observation fabriquée.
```

### Critère de passage

Calculer dix séances puis n'en accepter que deux crée exactement deux
`LearningSession`, même après un double envoi.

## 8. Lot 4 — tableau de bord fidèle à la cible

### But

Construire le rendu validé sans réinventer le design system.

### Prompt du lot

```text
Implémente le lot 4 : le nouveau tableau de bord, fidèle à
docs/design/assets/tableau-de-bord-orchestration-cible.png.

Inspecte l'image avant de coder et conserve la navigation actuelle. Recompose
la page existante, sans nouvelle route : en-tête “Bonjour {prénom}” et date ;
grille 8/4 ; grande surface “Votre journée” à gauche ; chronologie avec action
courante dominante, prochaine séance et espace disponible ; ligne repliable de
la semaine ; bandeau des jours ; carte d'échéance détaillée à droite avec état
qualitatif, preuves récentes et notions à éclaircir.

Réemploie CarteProchaineAction, CarteEcheances, BlocEcheancePrioritaire,
PistesAlternatives et les primitives existantes en déplaçant leur logique utile.
Ne maintiens pas deux compositions visibles concurrentes. “Commencer” utilise
le bouton principal existant ; “Changer l'ordre” et les détails utilisent les
variantes secondaire ou discrète. N'ajoute aucune couleur, rayon, ombre,
typographie ou classe de bouton ad hoc.

Les données absentes ont des états honnêtes : aucune preuve signifie “Non
estimable”, aucune séance acceptée produit une invitation courte, jamais une
grille vide. Sur mobile, empile “Votre journée” puis l'échéance ; conserve une
chronologie lisible et des cibles tactiles de 44 px. Tous les statuts sont
textuels, le changement d'ordre fonctionne au clavier et sans glisser-déposer.

Ajoute les tests de rendu et d'interaction. Lance l'application, capture le
tableau de bord à 1440 × 1024 et à un viewport mobile, puis compare la capture
à la référence dans une même vue. Corrige jusqu'à retrouver la même hiérarchie,
les mêmes proportions de colonnes, la même densité, les mêmes espacements, la
même sobriété des bordures et la même importance du bouton Commencer. Une
ressemblance générale ne suffit pas.
```

### Critères visuels bloquants

- « Votre journée » domine sans écraser la carte d'examen ;
- la ligne temporelle organise, elle ne décore pas ;
- la carte d'examen contient bien preuves et inconnues, sans pourcentage ;
- il n'y a ni mur de cartes, ni nouvelle navigation, ni bouton inventé ;
- le rendu réel clair à 1440 × 1024 est reconnaissable comme la référence au
  premier regard.

## 9. Lot 5 — revue groupée de replanification

### But

Faire accepter un changement compréhensible, pas administrer une liste.

### Prompt du lot

```text
Implémente le lot 5 : la revue groupée des changements qui touchent des
LearningSession déjà acceptées.

Calcule un diff pur entre séances acceptées et plan recalculé : conserver,
déplacer, raccourcir, annuler ou ajouter. Regroupe les changements dans une
seule Modale existante avec résumé, avant/après, raison principale et réserves
repliables. Actions : “Appliquer ces ajustements” en principal, “Modifier” en
secondaire, “Garder mon plan” en discret.

Les changements de simples candidates non acceptées restent silencieux. Toute
modification d'une séance acceptée exige une action explicite. L'application du
lot est atomique et idempotente. Fermer ou refuser la modale conserve le plan
accepté. Une indisponibilité ou une séance manquée ne crée ni alerte morale, ni
observation, ni série brisée.

Teste les diffs, l'acceptation, le refus, le double envoi, un conflit devenu
impossible et le parcours clavier complet. Vérifie visuellement que la modale
utilise les mêmes espacements, boutons, bordures et divulgations que le reste de
Twiny.
```

## 10. Lot 6 — chronologie À venir dans Séances

### But

Donner une lecture opérationnelle des séances acceptées et reléguer la
composition manuelle à son rôle d'échappatoire.

### Prompt du lot

```text
Implémente le lot 6 sur /seances sans créer de route supplémentaire.

La vue par défaut devient “À venir” : chronologie verticale des LearningSession
acceptées, groupées par jour, avec heure, durée, intervention principale,
domaine, effet attendu et statut textuel. “Historique” conserve le Cahier et
son calendrier actuel. Ne transforme pas calendrier-cahier en planificateur.

Conserve VueSeanceDetail, CahierInteractif et le mode focus. Déplace
ConcepteurSeance derrière l'action secondaire “Préparer autre chose” ; ne
supprime pas encore ses internals. Une ligne de séance permet commencer,
déplacer ou annuler selon les règles existantes, puis laisse le moteur proposer
les conséquences.

Sur mobile, conserve une seule chronologie sans grille hebdomadaire. Ajoute les
tests de sélection de vue, ordre temporel, anciennes séances sans planifieePour,
séance active, navigation clavier et liens profonds existants. Vérifie que le
style prolonge exactement le tableau de bord validé.
```

## 11. Lot 7 — exécution multi-interventions

### But

Faire de la séance une coquille commune, sans transformer chaque geste en
mini-produit indépendant.

### Prompt du lot

```text
Implémente le lot 7 : l'exécution multi-interventions dans LearningSession.

Crée un registre de rendus exhaustif par type d'intervention, sans logique
métier dans le composant. Réemploie d'abord les chemins existants : VueExercice
pour résoudre et diagnostiquer, Feynman déterministe pour expliquer, cartes de
rappel pour rappeler, lecteur documentaire pour lire, espace d'écriture pour
synthétiser et produire, TiroirTuteur pour demander de l'aide.

Chaque intervention affiche type, durée, source et effet attendu. Le chemin de
correction reste confiné à outilCorrection. Une intervention de préparation ou
de soutien terminée affiche explicitement qu'aucune nouvelle mesure n'a été
produite. Seul le chemin de preuve validé peut alimenter les observations.
Respecte l'ADR-124 : un document n'atteint le tuteur que par le geste explicite,
composé côté client et relu avant envoi.

Implémente par tranches : résoudre/diagnostiquer, expliquer/rappeler,
lire/demander de l'aide, puis synthétiser/produire. À chaque tranche, teste
navigation, reprise, abandon, clôture unique du journal, preuve ou absence de
preuve, mode épreuve et compatibilité des séances historiques.
```

## 12. Lot 8 — cours et protocoles dans le plan global

### But

Conserver l'intelligence documentaire utile, retirer le second plan isolé.

### Prompt du lot

```text
Implémente le lot 8 : raccorder Mes cours et ProtocoleCours au plan global.

Le module reste un Domaine à usage académique. Ajoute à sa fiche des lectures
dérivées “Cette semaine” et “Échéances” à partir des séances acceptées,
engagements et estimations de préparation. Ne recopie aucune échéance et ne
stocke aucun état de préparation.

Transforme progressivement le protocole de cours en fournisseur d'actions
candidates : conserve analyse, ancrage dans l'extrait désigné, validation des
codes, exercices Feynman déterministes et cartes de rappel. La validation du
protocole ne doit plus créer à terme un plan concurrent. Maintiens l'ancien
chemin tant que le nouveau n'a pas sa parité et ses tests, puis retire la
matérialisation directe dans le même changement que sa relève.

Teste deux cours concurrents, deux PDF du même cours, document archivé, domaine
orphelin, codes invalides, génération différée au démarrage et interdiction
d'utiliser un autre document que l'origine. Ne modifie un protocole dans
app/data/00_instructions/ qu'après décision explicite et test de transcription.
```

## 13. Lot 9 — contexte progressif et besoins concurrents

### But

Collecter juste assez de contexte sans créer un centre d'administration.

### Prompt du lot

```text
Implémente le lot 9 : mise en contexte progressive et arbitrage des besoins
concurrents.

Conserve le premier succès rapide de /demarrer. Après celui-ci, affiche sur le
tableau de bord une carte temporaire “Préparer votre période” qui fait confirmer
progressivement période, modules, disponibilités et échéances. Chaque étape est
courte, facultative, préremplie avec les faits fiables et reprise sans demander
de maintenance. Une information déjà confirmée n'est pas redemandée.

“Déclarer un besoin” reste l'entrée unique. Un besoin continu peut porter un
rythme ou un horizon déclarés sans devenir un objectif structuré fabriqué. Le
planificateur arbitre échéances et continuité ; s'il ne peut tout placer, il
montre la tension et propose un compromis, sans supprimer silencieusement une
séance acceptée.

Teste reprise de l'assistant, étape ignorée, contexte partiel, deux échéances,
besoin continu, capacité insuffisante et absence de disponibilité. Vérifie que
la personne n'a jamais une boîte de tâches de configuration à vider.
```

## 14. Lot 10 — calendrier externe

### But

Importer uniquement la disponibilité utile et projeter uniquement le travail
accepté.

### Prompt du lot

```text
Prépare puis implémente le lot 10 : synchronisation avec un calendrier externe.

Commence par vérifier que le fournisseur, les portées OAuth, la politique de
confidentialité et l'ADR d'infrastructure ont été validés humainement. Sinon,
produis l'ADR proposée avec les alternatives et arrête-toi avant le code ou la
base. Vérifie le schéma Supabase réel avant toute migration.

Après validation, isole le connecteur dans l'infrastructure. Lis le minimum
nécessaire pour produire des plages occupées ; n'importe pas les titres ou
détails privés si free/busy suffit. Écris à l'extérieur uniquement les
LearningSession acceptées, avec un titre sobre sans compétence, preuve ni
diagnostic. Supabase reste la vérité Twiny.

Une modification externe devient un fait d'orchestration et une proposition de
replanification, jamais une observation. Rends la synchronisation idempotente,
résiliente aux webhooks doublés et révocable. Dans Compte > Calendrier, montre
consentement, portée, état et erreurs persistantes avec les primitives
existantes ; aucun écran principal supplémentaire.

Teste consentement, droits compte, indisponibilités, double événement, édition
externe, suppression externe, déconnexion, reprise après erreur et absence de
donnée pédagogique sensible dans le calendrier.
```

## 15. Lot 11 — hypothèses de motifs d'apprentissage

### But

Présenter des hypothèses falsifiables seulement lorsque l'historique le permet.

### Prompt du lot

```text
Implémente le lot 11 : hypothèses de motifs dans Progression.

Avant le code, fais valider un seuil minimal d'échantillon et un protocole de
test ; ne modifie aucun seuil de calibration sans données. Construis un moteur
pur qui retourne une hypothèse, ses faits sources, sa taille d'échantillon, sa
confiance et ses réserves. Il ne conclut jamais à une causalité et n'infère rien
d'une seule séance, d'une absence ou du calendrier.

Affiche “Ce qui semble vous aider” avec deux actions : “Tester pendant une
semaine” et “Ne plus proposer cette hypothèse”. L'acceptation démarre une
expérience limitée ; elle ne change pas silencieusement une préférence
permanente. Le refus est un fait d'interaction, pas une mesure.

Teste seuil insuffisant, données contradictoires, hypothèse écartée, expérience
terminée, changement de règle et relecture de l'historique. Si aucune hypothèse
n'est étayée, n'affiche pas une carte vide.
```

## 16. Lot 12 — retraits et vérification finale

### But

Retirer l'ancien uniquement après preuve de parité et livrer une interface qui
ressemble réellement à la cible.

### Prompt du lot

```text
Réalise le lot 12 : audit de parité, suppressions devenues sûres et vérification
finale de l'orchestration.

Pour chaque candidat obsolète du plan d'interface, prouve sa relève avant
suppression : cartes séparées “Avant vos échéances” / “Progression continue”,
BlocEcheancePrioritaire et CarteEcheances dupliqués, PistesAlternatives autonome,
BandeauRepriseBienveillante et sa clé navigateur, ConcepteurSeance comme entrée
principale, planification autonome du protocole PDF. Conserve le calendrier du
Cahier pour l'historique.

Supprime le code mort, les imports, tests et clés devenus inutiles. Mets à jour
PRODUCT.md, les ADR, les documents design et la promesse publique “rien à
planifier” dans le même changement qui rend cette phrase fausse. Ne retire
aucune compatibilité historique encore consommée.

Exécute le scénario transversal complet : module, échéance, disponibilités,
plan candidat, acceptation partielle, deux types d'intervention, preuve sur le
diagnostic, aucune preuve sur la préparation, séance manquée, replanification
groupée, projection calendrier et absence de double journal.

Puis exécute tests, lint, build et audit accessibilité. Vérifie clair/sombre,
mobile/bureau et clavier. À 1440 × 1024, capture le tableau de bord réel et
place-le côte à côte avec
docs/design/assets/tableau-de-bord-orchestration-cible.png. Corrige les écarts
visibles jusqu'à retrouver la composition 8/4, la chronologie, l'équilibre de
la carte d'examen, la typographie, les espacements, les bordures et les boutons.
Ne conclus pas “similaire” sur la seule présence des mêmes sections.
```

## 17. Gates de qualité

Un lot ne passe au suivant que si ses critères propres sont vrais et que ces
garde-fous restent vrais :

1. aucune candidate refusée n'est persistée comme séance ;
2. aucun plan ni état de préparation n'est autoritatif ;
3. aucune intervention sans preuve ne fabrique une observation ;
4. aucune séance manquée ne diminue un état ;
5. aucune donnée Supabase invalide n'entre dans le moteur ;
6. aucun document n'entre dans le contexte permanent du tuteur ;
7. aucun changement de séance acceptée n'est silencieux ;
8. aucun nouvel écran principal n'est créé ;
9. aucun style local ne contourne les tokens ou les variantes de bouton ;
10. aucune suppression ne précède la parité ;
11. la documentation courante décrit le code effectivement livré ;
12. les captures UI restent fidèles à la référence validée.

## 18. Stratégie de commits

Préférer un commit vérifié par lot vertical. Un changement de code qui remplace
un contrat met à jour la documentation correspondante dans le même commit. Une
migration et son état réel restent ensemble. Ne pousser aucun lot non vérifié
sur `master`.

Les lots 4, 5, 6 et 12 ont une condition supplémentaire : joindre au compte
rendu la capture du rendu réel et la comparaison avec la référence. La fidélité
visuelle ne doit pas être reportée à un « polish » final ; elle se construit au
même rythme que les comportements.
