# DEC-0002 — Essai manuel de choix du modèle et de l'effort

- Identifiant : DEC-0002
- Date : 2026-09-15
- Statut : accepted
- Auteur de la proposition : coordinateur, après avis Product, CTO et QA
- Décideur : Maxime
- Validation humaine : « parfait faisons ça », le 15/09/2026
- Source de la validation : échange Compute Router dans la tâche Codex de l'AI Company ; extrait et périmètre conservés ci-dessous.
- Décisions liées / remplacées : aucune décision produit modifiée ; DEC-0001 reste inchangée.

## Contexte

Maxime demande un avis sur sa spec Compute Router. Trois sous-agents natifs
Product, CTO et QA l'examinent. Product recommande d'observer des missions avant
de construire ; CTO estime un petit outil faisable ; QA relève des ambiguïtés
de priorité des règles, d'effort, d'escalade et de comptage des tentatives.
Le coordinateur recommande : « Éprouver quelques règles simples sur cinq
missions réelles », puis construire seulement si les observations le justifient.
Maxime répond : « parfait faisons ça ». Cet accord porte sur l'essai limité,
pas sur l'implémentation complète de la spec ni sur des économies démontrées.

## Problème

Nous ignorons si d'autres choix de modèle/effort améliorent le coût total d'un
livrable utilisable. Le [registre](../operations/metrics.md) ne fournit encore
aucune mesure comparative attribuable. Une interruption de quota ne suffit pas
à diagnostiquer un mauvais choix de modèle.

## Options étudiées

- Conserver uniquement l'héritage : simple, sans observation structurée des alternatives.
- Construire la spec complète : règles reproductibles, mais seuils non éprouvés et entretien supplémentaire.
- Essai manuel avec le registre existant : option retenue, réversible et bornée.

## Décision

Observer les cinq prochaines missions réelles autorisées après cette mise en
place, analyses et recherches comprises. Une demande et ses sous-missions ou
reprises comptent pour une seule mission. Inclure les missions simples exécutées
sans délégation ; ne pas créer de travail pour remplir l'essai. La revue de spec
antérieure et l'installation de ce protocole restent hors échantillon.

Le coordinateur applique les règles suivantes, sans appel LLM de classification :

1. Avant exécution, noter le choix habituel (héritage par défaut), l'alternative
   éventuelle et une phrase de justification. Une mission simple reste dans la
   tâche courante ; le protocole ne justifie jamais une délégation à lui seul.
2. Un geste mécanique, au périmètre connu et au résultat directement vérifiable,
   peut justifier un modèle disponible supposé moins coûteux et un effort réduit.
   Cette économie reste une hypothèse jusqu'à mesure ; aucun classement tarifaire
   ou de qualité n'est présumé à partir du nom du modèle.
3. Une cause inconnue, un arbitrage architectural ou une conséquence difficile
   à annuler justifie de conserver une capacité de raisonnement adaptée. Séparer
   ensuite un geste mécanique seulement si le choix complexe est résolu et tracé.
   Le rôle et les vérifications restent requis indépendamment du modèle choisi.
4. Le coordinateur peut sélectionner explicitement modèle et effort au lancement
   d'un sous-agent. Vérifier leur disponibilité et les contraintes de l'outil à
   chaque lancement ; ne jamais modifier les paramètres de la tâche utilisateur.
   Si l'outil interdit l'override avec l'historique complet, utiliser un contexte
   borné suffisant ou conserver l'héritage, en expliquant le choix. Si le modèle
   hérité n'est pas observable, écrire « inconnu », pas un identifiant supposé.
5. Après un échec, diagnostiquer la cause avant de réessayer : raisonnement/code,
   contexte manquant, environnement/outil, quota ou cause indéterminée. Un quota
   ou outil indisponible est un blocage, pas un motif automatique de montée en
   gamme. Une nouvelle exécution reçoit les faits utiles, fichiers modifiés,
   vérifications et échecs précédents ; ne pas prétendre reconfigurer un agent actif.
6. Consigner la recommandation et les paramètres réellement transmis séparément,
   puis résultat, preuve, reprises et surcharge. Aucune double exécution à seule
   fin de comparaison ; aucun achat, crédit ou nouvelle dépense externe autorisé.

Le [gabarit du registre](../operations/metrics.md#essai-manuel-compute--dec-0002)
est rempli par le coordinateur, une fiche par mission et une ligne par tentative.
Le rang se déduit des missions distinctes rattachées à DEC-0002, sans compteur
parallèle. Une recommandation non exécutée n'est pas une tentative échouée.
Une mission terminale partielle, échouée ou bloquée compte aussi ; sa reprise
conserve le même identifiant et n'ajoute pas une sixième mission.

À la clôture de la cinquième mission, le coordinateur produit dans la tâche
active un bilan des cinq fiches, y compris les échecs : résultats vérifiés,
choix effectivement différents, reprises, surcharge et usage observable.
Pas de réveil planifié ni d'activité hors mission. Si les traces sont incomplètes,
le bilan expose cette limite ; il ne fabrique pas de mesure et n'étend pas l'essai.
Les modèles ne sont pas comparés par taux brut sur des tâches différentes.

## Justification

La séparation modèle/effort et le suivi de toute la chaîne de tentatives sont
utiles à éprouver. Cinq missions fixent un point de revue, pas un seuil de preuve
statistique. Temps, tokens, euros et quota sont des mesures distinctes ; les
limites partagées du compte n'attribuent pas un coût à une mission.

## Conséquences

Quelques notes dans le registre existant. Aucun moteur, score numérique, mode
Economy/Quality, rapport automatisé, nouvelle dépendance ou infrastructure.
La sélection reste une action du coordinateur avec les outils disponibles.
L'accord permet cette observation minimale ; les contenus confidentiels et
les transcriptions complètes ne rejoignent pas la mémoire.

## Éléments de remise en cause

À la revue : proposer un petit outil seulement si des choix récurrents et
exécutables résolvent une friction documentée. Simplifier ou arrêter si les
choix restent identiques, sont inexécutables ou coûtent plus d'entretien qu'ils
n'apportent de bénéfice discernable. Sans usage attribuable, ne revendiquer
aucune économie. Toute construction logicielle ultérieure reste une proposition.

## Historique

- 2026-09-15 : accord explicite de Maxime transcrit ; protocole installé dans les
  contrats de coordination et le registre. Aucune mission pilote encore exécutée.
