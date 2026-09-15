# État courant — relevé local du 15/09/2026

Nature : synthèse de sources locales, pas validation du produit.
Base du relevé : HEAD `e0c591a` du 07/09/2026 sur `master`, avec de nombreux
changements préexistants non committés. Relancer Git à chaque reprise.

## Objectif et réalisation

- **Direction documentée** : entrée conversationnelle qui administre progressivement
  les éléments justifiés, dans le cadre de la boucle pédagogique. Sources :
  [PRODUCT, état courant](../../PRODUCT.md) et
  [référence assistant](../../docs/design/ASSISTANT_ENTREE_REFERENCE.md).
- **Présence locale constatée** : types d'observation et de séance, moteur de
  recommandation, persistance, chat, routes assistant et Qwen, analyse documentaire
  et tests associés. Voir [audit](../CURRENT_SYSTEM_AUDIT.md).
- **Travail récent committé** : `e0c591a` (07/09) porte le feedback différé et
  la navigation pilote ; `6784777` (06/09) porte le pilote documentaire.
- **Travail local ultérieur** : conversation, rangement, Qwen, corrections et
  documentation figurent dans le statut Git ; cela ne prouve pas leur déploiement.
- **Limites documentées** : plan global non raccordé, programmation déléguée et
  calendrier externe non construits ; essais fournisseur/corpus réel encore
  nécessaires. Sources : PRODUCT et [pilote](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md).

## Vérification et inconnues

Les résultats applicatifs inscrits au registre pilote sont des résultats datés,
pas des tests relancés par ce chantier. Aucun contrôle Supabase, appel fournisseur
ou parcours authentifié effectué ici. Versions distantes, réussite du parcours
courant et priorité produit unique : **UNKNOWN / À VALIDER AVEC LE FONDATEUR**
ou à vérifier techniquement selon la question.

Ne pas réactiver le plan global à partir de ses seuls fichiers. Ne pas prendre
les scores/nombres historiques d'usage dans PRODUCT pour des mesures du jour.

## Organisation interne

La fondation documentaire est complétée, sur demande explicite du 15/09,
par cinq profils de sous-agents Codex natifs : mémoire, contrats, outils et
missions indépendantes coordonnées. La délégation QA a été réellement exécutée ;
voir les preuves dans [exécution native](../operations/native-agents.md).
L'utilité comparative reste à mesurer ; aucune tâche récurrente n'est activée.
Ses validations vivent dans le [changelog](../operations/changelog.md).
La prochaine synthèse doit rapprocher cet état des [problèmes](../operations/known-problems.md)
et des [priorités](priorities.md), puis recommander une action avec sa preuve attendue.
