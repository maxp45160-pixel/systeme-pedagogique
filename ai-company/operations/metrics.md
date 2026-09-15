# Utilité des rôles — mesures manuelles

Créé le 15/09/2026, après examen de la phase 8 conditionnelle.
État initial avant intégration native : **NON MESURÉ**. Une mission réelle est
maintenant enregistrée ; l'utilité comparative et le coût restent non mesurés.
Les exercices de validation de cette V1 ne sont pas des observations d'utilité.

## Unité et registre

Une ligne par demande réelle, identifiant stable `USE-XXXX`, puis une entrée
détaillée si nécessaire. Plusieurs rôles consultés pour la même demande ne
comptent pas comme plusieurs tâches. Aucun tableau de bord ni collecte automatique.

| ID | Date | Demande / source durable | Rôles réellement consultés | Mode (session / isolé) | Résultat observable / preuve | Coût et surcharge connus |
|---|---|---|---|---|---|---|
| USE-0001 | 2026-09-15 | Collègues natifs et compte rendu demandés par Maxime ; [mandat](mandate.md) | QA, Product, Chief of Staff | Sous-agents natifs ; sélection explicite du profil pour Chief, profil lu sur instruction pour Product | Contradictions documentaires corrigées ; [analyse Product terminée](runs/2026-09-15-product-premiere-mission.md) ; guide relu par Chief | Coût/tokens/durée non mesurés ; une interruption Product pour limite d'usage, puis reprise réussie |

Pour USE-0001 : corrections QA/Chief appliquées par le coordinateur. La
recommandation produit reste proposée, sans accord humain enregistré. Aucun
gain comparatif ni décision produit évitée n'est revendiqué. Les constats
regroupés portent sur la cohérence du guide, pas sur des bugs de l'application.

Pour une entrée réelle, noter :

- Recommandations identifiées et décision explicite de Maxime (acceptée, refusée,
  en attente), avec source ; ne pas compter un silence comme acceptation.
- Défauts distincts détectés par QA, confirmation par reproduction/test/revue,
  et correction si réalisée. Une réserve ou un doublon ne compte pas comme erreur.
- Décision évitée ou corrigée : ancienne option, contre-élément, choix humain et
  trace. Sans contre-factuel raisonnablement documenté, laisser inconnu.
- Spec : première version, reprise substantielle nécessaire ou non, cause ;
  séparer nouvelle demande de Maxime et omission dans la spec initiale.
- Valeur de la consultation supplémentaire : constat accepté/refusé par Maxime,
  justification ; si elle n'apporte rien, le noter explicitement.
- Usage attribuable si fourni par l'outil : tokens/coût, devise, source et portée.
  Des limites de compte partagées ne mesurent pas le coût d'une tâche.
- Durée : début/fin observés, attentes et temps de coordination séparés lorsque
  mesurables. Complexité ajoutée : étapes, relectures ou entretien réellement requis.

Pas de secret, transcript apprenant ou donnée personnelle dans le registre.
Lier un artefact du dépôt ou conserver un extrait minimal de l'arbitrage humain.

## Indicateurs à calculer lors d'une revue

| Indicateur | Définition / limite |
|---|---|
| Recommandations acceptées | Nombre d'identifiants avec accord humain ; présenter aussi examinées et en attente. |
| Erreurs détectées par QA | Défauts confirmés et dédupliqués ; séparer gravité, simples soupçons et faux positifs. |
| Décisions évitées/corrigées | Cas avec option antérieure et arbitrage humain sourcés, sans gain fictif chiffré. |
| Taux de specs reprises | Specs nécessitant au moins une reprise substantielle / specs effectivement relues ; dénominateur absent = non mesuré. |
| Multi-rôles sans valeur supplémentaire | Tâches avec constat explicite de non-apport / tâches multi-rôles dont l'apport a été évalué ; ne pas confondre avec absence de réponse. |
| Coût/usage | Valeurs observées, source et unité ; montant inconnu reste inconnu, pas 0. |
| Durée/complexité ajoutée | Temps de coordination/entretien et étapes observées ; comparaison seulement à tâche/périmètre comparables. |

Ne pas maintenir des totaux à la main en parallèle des observations. Les
indicateurs sont recalculés lors de la revue, avec période et dénominateurs.
Pas de quota de performance ni de seuil artificiel pour justifier un agent.

## Essai manuel compute — DEC-0002

Essai autorisé par Maxime le 15/09/2026 : [périmètre, règles et fin de l'essai](../decisions/DEC-0002-essai-manuel-compute.md).
Au lancement, aucune mission pilote n'est enregistrée. Les fiches ci-dessous
feront foi ; USE-0001, la revue de spec et la mise en place ne comptent pas.
Le coordinateur complète ce gabarit pour chaque mission éligible, avec une ligne
dans le registre général et le prochain identifiant USE libre. Les cinq missions
sont comptées une seule fois chacune, quel que soit le nombre de collègues.

```markdown
### USE-XXXX — Titre de la demande

- Essai : DEC-0002 ; date ; source minimale de la demande autorisée.
- Résultat attendu / critère de fin : ...
- Choix habituel avant exécution : héritage ou paramètres connus ; source.
- Alternative envisagée : aucune, ou modèle/effort et raison en une phrase.
- Décision initiale : choix retenu et justification ; hypothèse d'économie éventuelle.

| Tentative | Rôle / périmètre | Recommandation modèle/effort | Paramètres transmis / agent de référence | Résultat et preuve | Cause d'échec / raison de reprise | Usage attribuable et source |
|---|---|---|---|---|---|---|
| USE-XXXX-A1 | ... | ... | hérité ou paramètres explicites ; identifiant si disponible | ... | sans objet ou cause documentée | inconnu si absent |

- Clôture : terminé / partiel / échoué / bloqué ; livrable et vérifications.
- Reprises : liens aux tentatives et transferts de contexte ; inconnues conservées.
- Surcharge : temps si mesuré, sinon étapes supplémentaires observées ; coût inconnu.
- Apport discernable du choix : constat ou inconnu ; aucune comparaison causale supposée.
```

Les consultations indépendantes d'une mission sont des tentatives distinctes
avec leur périmètre ; elles ne sont pas des reprises l'une de l'autre. Relier
explicitement toute reprise à sa tentative précédente. Compter tout usage connu
de la mission, coordination comprise si observable, et signaler la couverture
incomplète. Une valeur inconnue ne vaut pas zéro. Le gabarit vide n'est pas une
observation. À la cinquième clôture, produire le bilan prévu par DEC-0002.

## Décision de simplifier

Après quelques demandes réelles (calendrier à choisir par Maxime), comparer
valeur constatée, coût et entretien. Si un rôle n'apporte rien de discernable,
recommander de le fusionner, réduire ou retirer, avec les contre-exemples éventuels.
Une proposition de changement durable suit le registre DEC ; aucun rôle ne
s'étend, ne s'auto-valide ou ne se supprime automatiquement.
