# Première mission Product — 15/09/2026

Analyse proposée ; aucune décision ni statut produit modifié.

## PROBLÈME

Le prochain problème à vérifier est le passage **d'une ressource confiée à un travail effectivement repris** : l'organisation conversationnelle permet-elle de retrouver la bonne matière et de commencer une activité utile, avec moins d'administration ?

Ce bénéfice est demandé dans la vision ; sa fréquence et sa réalité chez les étudiants ne sont pas établies. Le risque produit est de perfectionner le rangement sans démontrer ce qu'il permet de faire ensuite.

## HYPOTHÈSE

Sur un besoin réel de Maxime, l'assistant conserve et organise assez fidèlement les éléments utiles pour permettre leur reprise après rechargement, sans réécriture importante ni aide sur le fonctionnement de Twiny. Cette reprise facilite le démarrage d'une activité existante. Une restitution élégante ne suffit pas à soutenir cette hypothèse.

## SOLUTION ENVISAGÉE

| Prochaine action | Intérêt | Limite |
|---|---|---|
| **A. Éprouver le parcours existant sur un cas réel** | Localiser la rupture entre compréhension, rangement, récupération et travail ; aucun développement préalable | Un cas fondateur ne représente pas les étudiants |
| **B. Construire la recherche et les relations dans la mémoire personnelle** | Sert directement la direction des 14–15/09 | Risque d'indexer des restitutions infidèles ; difficulté de récupération encore non observée |
| **C. Étendre aux prochaines actions et au plan** | Se rapproche de « quoi travailler maintenant » | Cumule sélection, priorisation et délégation alors que le parcours précédent reste à éprouver |

Ne rien construire pendant l'essai est l'alternative minimale. A répond au critère d'arrêt de PRODUCT, question 4 : vérifier une réduction de friction au service du travail. B ou C deviennent défendables si l'essai désigne précisément leur manque.

## PREUVE DISPONIBLE

**Lecture documentaire actuelle, 15/09 :** PRODUCT décrit une organisation corrigeable, un contexte partiel, une planification globale non raccordée et une fidélité documentaire à éprouver. La référence demande un essai réel avant de déclarer le lot 2 complet. ADR-145 confirme que l'autorisation de poursuivre du 13/09 n'a pas validé rétroactivement l'usage.

**Résultats historiques rapportés :** les contrôles automatisés et SQL des 11–14/09 couvrent notamment écritures, reprise et droits. L'essai navigateur du 11/09 a rencontré HTTP 429 ; le dernier essai Qwen consigné rencontre HTTP 403 `AccessDenied.Unpurchased`, sans réponse réelle validée. Ces résultats ne démontrent ni fidélité ni utilité. Le compte tiers historiquement à trois preuves ne renseigne pas l'usage actuel de l'assistant.

**Vérification effectuée ici :** lecture des documents uniquement ; aucun test applicatif, contrôle distant ou appel fournisseur. Les états historiques ne sont pas requalifiés en état technique actuel.

## INCERTITUDE

Documents et besoin immédiat disponibles, état fournisseur actuel, difficulté réellement rencontrée et utilité perçue : **UNKNOWN / À VALIDER AVEC LE FONDATEUR**. Confiance modérée dans la priorité de l'essai ; faible dans l'hypothèse de bénéfice.

## Recommandation et vérification concrète proposée

Retenir A : observer une reprise complète avant d'élargir les capacités.

1. Choisir avec Maxime un besoin qu'il veut réellement travailler et deux ressources pertinentes. Relever hors entrée IA les passages indispensables et ambiguïtés ; conserver les documents privés hors dépôt Git.
2. Une fois le blocage fournisseur réellement levé, utiliser le consentement et le budget existants. Observer dépôt, analyse, correction éventuelle, puis rechargement. Arrêter au premier échec ; relever sa cause sans réessai automatique.
3. Sans guider la navigation, faire retrouver un passage et commencer une activité existante. Consigner omissions, écritures annoncées/réelles, temps de correction, temps avant travail et aides nécessaires ; vérifier qu'aucune Observation ne résulte du seul dépôt.
4. Échec si passage essentiel perdu, réécriture importante ou aide nécessaire pour reprendre. Le seuil proposé de correction inférieur à une minute vient du registre pilote. Un succès autorise une enquête plus large, pas une validation générale.

**Meilleur contre-argument :** l'absence de recherche transversale pourrait être le vrai obstacle. Si les ressources sont fidèles mais introuvables à la reprise, je recommanderais B avant tout enrichissement du rangement.

**Décision requise :** choix du cas et organisation de l'essai par Maxime ; aucune extension engagée.

## Sources produit lues

- [PRODUCT](../../../PRODUCT.md) : état courant, vision, public, critère d'arrêt.
- [Référence assistant](../../../docs/design/ASSISTANT_ENTREE_REFERENCE.md).
- [Registre pilote](../../../docs/pilotes/DEPOT_DOCUMENTAIRE.md).
- [ADR-145 dans le registre](../../../ARCHITECTURE_DECISIONS.md) et [propositions ouvertes](../../../docs/architecture/PROPOSITIONS_ADR_OUVERTES.md).
