# Dossier de direction — d'une matière confiée à un travail utile repris

Date : 16/09/2026. Statut : **proposition de cadrage, aucun arbitrage produit
nouveau**. Demande et périmètre : [DIR-0001](../operations/runs/2026-09-16-direction-mandat.md).
Ce dossier prépare le cahier des charges détaillé ; PRODUCT et les ADR conservent
leur autorité. Il est utilisable en nouvelle session via `npm run agents:resume -- DIR-0001`.

## Avis de direction

**Nous risquons de perfectionner la gestion des documents avant de démontrer
qu'ils permettent de mieux reprendre un apprentissage.** Le danger n'est pas
le dépôt en lui-même : c'est de faire du classement réussi la preuve de la valeur
de Twiny. Ma recommandation est de centrer la prochaine tranche de cahier des
charges sur « je reviens avec un besoin, je retrouve une matière utile et je
commence un travail expliqué ». Chaque raffinement de classement doit justifier
ce qu'il change dans ce trajet.

Cette recommandation s'appuie sur la direction humaine des 14–15/09 dans
[PRODUCT, mémoire réutilisable](../../PRODUCT.md#une-mémoire-réutilisable-au-service-du-prochain-apprentissage),
sur le [critère d'arrêt](../../PRODUCT.md#7-critère-darrêt) et sur la
[première enquête Product](../operations/runs/2026-09-15-product-premiere-mission.md).
La présente enquête native Product retrouve cette tension ; cela n'en fait pas
une observation d'usage étudiant. Confiance élevée dans le risque, fréquence
réelle inconnue. Meilleure objection : une organisation fidèle peut être un
préalable. Elle justifie un classement suffisant et vérifiable, pas une fin en soi.

Deuxième avis : **ne pas reconstruire le plan global pour réparer une promesse
documentaire fausse**. PRODUCT §3 dit encore que le tableau de bord propose le
plan ; son état courant et §6, ainsi que l'amendement de retrait ADR-139, disent
le contraire. La [page réelle](../../app/src/app/%28app%29/app/page.tsx) importe
CarteProchaineAction et BlocAujourdHui ; le symbole TableauBordOrchestration n'a
pas de consommateur trouvé dans `app/src` hors tests. Les fondations existent,
la composition globale est retirée. La contradiction est confirmée au checkout
`60c8617` + travail local du 16/09 ; aucune inspection distante. Correction
descriptive à transmettre au propriétaire UX-0001, sans changer son travail.

Troisième avis : **un cahier des charges détaillé peut accélérer la mauvaise
construction s'il décrit les écrans avant le besoin**. Les tests actuels des
agents prouvent des mécanismes et des choix déclarés ; `scoreResponse` exige une
raison non vide, sans en juger le sens. La revue doit exiger une alternative et
un critère de réfutation, pas récompenser la longueur ou un accord entre agents.

## Ce qui est connu, et ce qui ne l'est pas

| Sujet | Déclaré | Branché localement | Observé | Testé |
|---|---|---|---|---|
| Dépôt et proposition | PRODUCT état courant, ADR-143/145 | Parcours assistant et actions documentaires, chantier UX-0001 | Échecs et reprises du livret dans sa fiche ; pas un parcours utilisateur rejoué ici | Tests historiques de cette fiche, non réexécutés par DIR-0001 |
| Reprise d'une matière utile | Direction humaine PRODUCT §1 | Existant à cartographier pour le besoin retenu ; pas déclaré absent | Réussite étudiante actuelle inconnue | Recette ci-dessous proposée, non exécutée |
| Plan global | Cible ADR-139 | Fondations gelées ; composition non raccordée | Aucun parcours global observé ici | Présence de tests unitaires ne prouve pas raccordement |
| Direction IA | Contrats Chief/Product/QA | Profils natifs et workflows existants | Product a rendu la critique, QA l'audit technique pendant DIR-0001 | Tests Node et revue du dossier, limites dans rapport |

## Tranche de référence proposée

Personne : étudiant du supérieur dans le positionnement actuel (PRODUCT §4).
Situation représentative à éprouver, **pas un entretien utilisateur** : il a
déposé un cours, revient plus tard préparer un travail et ne veut pas refaire
l'explication de son contexte. Son niveau ne peut être inféré de son dépôt.

Résultat visé : il retrouve la source utile, comprend une prochaine action et
commence une activité ; à la reprise suivante, il retrouve ses choix. Le succès
n'est ni le volume importé, ni le nombre de compétences proposées. Mesurer lors
de la recette le travail commencé, les corrections nécessaires, l'aide humaine
et les pertes de contexte. Aucun seuil chiffré nouveau n'est arbitré ici.

Non-objectifs de cette tranche proposée : plan global, nouveau modèle de données,
calendrier, refonte de navigation, mémoire conversationnelle totale, nouvelle
mesure de compétence, nouveau fournisseur ou nouveau budget.

## Exigences détaillées proposées

### CDC-01 — Comprendre le besoin présent

- Déclencheur : retour dans l'assistant avec une intention ou une question.
- Entrées : demande explicite ; contexte déjà autorisé et disponible ; échéance
  déclarée si connue. Absence de preuve et absence d'intention restent distinctes.
- Comportement : reformuler le résultat attendu, relever l'inconnue qui change
  l'action ; demander seulement une précision indispensable. Réutiliser les
  données retrouvées plutôt que les redemander.
- Erreur/refus : date relative ambiguë ou module non identifié ne devient pas
  une date ou un lien inventé. Une information déduite reste proposée.
- Écriture/reprise : aucune intention ni échéance structurée implicitement
  fabriquée ; respecter les commandes existantes et leurs validations.
- Recette : une demande suffisante avance sans questionnaire redondant ; une
  demande ambiguë conserve l'incertitude et ne produit aucune fausse déclaration.

### CDC-02 — Retrouver la matière et sa provenance

- Déclencheur : besoin identifié demandant de relire une matière personnelle.
- Entrées : originaux et transcriptions déjà conservés, références/pagination
  disponibles, accès du compte. La recherche future reste à concevoir.
- Comportement : désigner le passage utile, permettre de revenir à la source,
  rendre visible une couverture partielle. Une citation n'atteste pas le classement.
- Erreur : original inaccessible, OCR incomplet, passage absent ou lien invalide
  sont distingués ; ne pas inventer le passage manquant.
- Reprise : un rechargement retrouve le choix accepté avec les droits du compte ;
  la réouverture ne déclenche aucune nouvelle analyse payante.
- Recette : retrouver une référence préparée dans la fixture et son original ;
  variante manquante clairement signalée ; aucune requête fournisseur au rechargement.

### CDC-03 — Organiser sans imposer l'administration

- Déclencheur : proposition documentaire disponible.
- Comportement : distinguer matière enseignée et usages possibles ; permettre
  correction ou report du classement, dans les contrats ADR-144/145.
- Écritures : appliquer seulement le lot confirmé, préserver les choix acceptés
  lorsqu'une analyse ultérieure produit d'autres propositions.
- Erreur/reprise : ambiguïté, domaine archivé, échec partiel et double soumission
  conservent le résultat réel et un point de reprise sans doublons.
- Recette : refus/report n'invente aucune compétence ; correction puis
  rechargement conserve les choix ; le dépôt seul ne produit aucune Observation.
- Réemploi : fenêtre existante et commandes du chantier UX-0001. Ne pas prescrire
  ici une nouvelle destination ou une nouvelle taxonomie.

### CDC-04 — Commencer un travail utile

- Déclencheur : matière et besoin suffisamment connus, ou choix volontaire de
  travailler sans terminer le classement.
- Comportement : proposer une intervention explicable parmi les chemins
  réellement disponibles ; annoncer préparation, soutien ou mesure.
- Sources : cours choisi, besoin déclaré et preuves recevables lorsqu'elles
  existent. Une compétence non mesurée ne devient pas une faiblesse démontrée.
- Écriture : LearningSession demeure l'épisode unique ; pas de plan dérivé stocké.
- Refus : si le chemin nécessaire n'existe pas, signaler l'écart précis et
  proposer une étape disponible, sans prétendre que le plan global est construit.
- Recette : démarrage réel de l'activité proposée ; un dépôt ou une synthèse
  réussis seuls ne satisfont pas cette exigence.

### CDC-05 — Expliquer et laisser corriger la proposition

- Sortie : action, raison reliée aux sources, réserves et possibilité de refuser.
- Pas de promesse « optimale » ni de score de préparation sans contrat.
- Erreur : preuve contradictoire ou ancienne reste visible ; aucune fusion
  silencieuse vers une certitude. Un refus n'est pas une dette ni une pénalité.
- Recette : un lecteur peut retrouver le fait à l'origine du conseil ; enlever
  ce fait conduit à une réserve, pas à une justification fabriquée.

### CDC-06 — Reprendre sans perdre ni rejouer

- Déclencheur : fermeture, navigation, interruption ou retour ultérieur.
- État : distinguer choix accepté, proposition encore ouverte, résultat terminé
  et opération de résultat incertain. Ne pas étendre le stockage des conversations
  sans décision ; le fil actuel est limité à la session navigateur.
- Effets : vérifier le résultat d'une écriture incertaine avant relance ; analyse
  payante et consentement restent propres à l'opération autorisée.
- Recette : interrompre avant puis après confirmation ; aucun doublon ni
  réanalyse automatique ; les limites de conservation sont compréhensibles.

### CDC-07 — Préserver la frontière de mesure et de données

- Dépôt, classement, lecture achevée et demande d'aide ne mesurent rien par défaut.
- Seul le contrat probant applicable permet une Observation ; conserver source
  et rectification sans réécrire l'histoire. Absence de mesure n'est pas zéro.
- Un autre compte ne retrouve ni contenu ni clé de stockage personnelle ; les
  autorisations restent celles de Supabase/RLS, pas d'un composant d'interface.
- Recette : données synthétiques isolées ; vérifier les écritures attendues et
  les absences d'Observation ; tests automatiques sans connexion aux données réelles.

### CDC-08 — Consentement et coût compréhensibles

- Avant traitement réel : sources, pages couvertes, fournisseur et coût maximal
  selon ADR-143/145 ; le geste autorisé couvre seulement l'opération décrite.
- Réouverture : aucune facture nouvelle. Échec/timeout : conserver l'incertitude,
  pas de retry payant implicite, réutiliser les transcriptions disponibles.
- Recette : doubles de fournisseur pour coût connu/inconnu, timeout et plafond ;
  aucune valeur inventée. Un essai réel nécessite l'enveloppe correspondante.

## Arbitrages à préparer avec Maxime

| Question | Recommandation du copil | Alternative et coût | Fait qui ferait changer d'avis |
|---|---|---|---|
| Quelle preuve de valeur guide la prochaine tranche ? | Reprise → source utile → activité commencée | Raffiner d'abord le classement ; risque de retarder la preuve de travail | Observation montrant que le classement empêche à lui seul la reprise |
| Quel degré de mémoire doit traverser les sessions ? | Partir des choix et sources déjà conservés, cartographier le manque réel | Historique conversationnel complet ; coût, consentement et sélection à arbitrer | Besoin démontré impossible à satisfaire avec les faits conservés |
| Quand reconnecter une planification globale ? | Après identification du besoin que l'action immédiate ne couvre pas | Réactiver la cible maintenant ; intégration et risques à examiner | Plusieurs besoins datés impossibles à arbitrer avec les chemins actuels |

Ces recommandations ne sont ni une priorité validée ni une autorisation de
modifier UX-0001. Prochain pas de discussion : choisir le scénario de reprise
représentatif, compléter ses inconnues, faire relire ses exigences puis arbitrer
une tranche. Le copil peut déjà challenger et détailler ce dossier sans relancer
l'audit de son organisation.
