# Twiny — Situation

Relevé du 15/09/2026, exercice initial du workflow Situation pendant la phase 4.
Base inspectée : `master`, HEAD `e0c591a` du 07/09 ; changements locaux importants
préexistants. Ce rapport est un exemple réel daté, pas le prochain bilan automatique.

## Objectif actuel

**Fait :** Maxime demande les fondations internes AI Company dans le
[mandat](mandate.md). **Fait documentaire :** le chantier produit récent est
l'entrée conversationnelle ([PRODUCT](../../PRODUCT.md),
[référence assistant](../../docs/design/ASSISTANT_ENTREE_REFERENCE.md)).
L'ordre de la prochaine tranche produit reste inconnu ; cette synthèse ne le valide pas.

## Ce qui a changé

Git rapporte deux derniers commits sur le feedback/navigation pilote (07/09)
et le dépôt documentaire (06/09). Le statut local montre ensuite des changements
de chat, assistant, rangement et Qwen, des migrations non suivies et des retraits
documentaires. Ils ne sont pas des changements livrés prouvés par cette session.
Les phases 0–4 ajoutent audit, mémoire, registre interne, quatre contrats et bilan.

## État actuel

Les types d'observation et de séance et les points de calcul/persistance sont
présents ([audit](../CURRENT_SYSTEM_AUDIT.md)). PRODUCT décrit l'assistant en
pilote et le plan global non raccordé. Les réserves fournisseur du
[pilote](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md) restent ouvertes.
Les liens/contrats documentaires ont été contrôlés localement ; aucun test
applicatif, appel fournisseur, contrôle Supabase ou parcours navigateur exécuté ici.
Le déploiement actuel est inconnu. Les DEC internes restent proposés.

## Risques

- **Inférence, confiance élevée :** attribuer au produit livré les changements
  du dossier local donnerait un bilan trompeur ; Git et déploiement sont deux preuves distinctes.
- **Fait documentaire :** les écritures référentiel/Markdown/index restent
  non atomiques avec reprise (ADR-145 ; [dette DT-01](../engineering/technical-debt.md)).
  La cohérence après interruption mérite une vérification avant extension de pouvoirs.
- **Hypothèse à éprouver :** l'analyse sur les documents réels est assez fidèle
  pour être utile. La réussite de tests de validation ne suffit pas à le démontrer.

## Décisions nécessaires

Aucun arbitrage supplémentaire nécessaire pour terminer les fondations internes
autorisées. Pour le produit : choisir, après constat du parcours actuel, entre
fiabiliser le pilote et élargir la délégation. **Recommandation :** obtenir d'abord
la preuve du parcours existant ; coût d'attendre cette preuve : extension retardée,
mais diagnostic moins ambigu. Aucun chantier produit n'est déclenché par ce bilan.

## Priorités recommandées

1. Achever les workflows et contrôles internes déjà demandés ; résultat attendu :
   les six usages de reprise/analyse possibles avec des sources et limites explicites.
2. Cadrer un essai QA de l'assistant courant, puis exécuter seulement ses étapes
   autorisées ; résultat attendu : distinguer erreur fournisseur, problème de
   rangement et défaut d'interface sur une source identifiable.
3. Mesurer l'utilité des rôles sur des demandes réelles avant orchestration ;
   résultat attendu : recommandations et erreurs détectées attribuables, coût connu
   lorsqu'il est observable. L'absence de mesure ne sera pas inscrite comme zéro.

## Agent à consulter ensuite

**QA / Critic**, après les fondations : « Quel contrôle minimal permet d'établir
la fiabilité du parcours assistant actuel ? » Fournir la référence assistant,
le pilote, le diff délimité et les résultats de tests réellement disponibles.
Apport attendu : un protocole de vérification, pas une nouvelle architecture.
