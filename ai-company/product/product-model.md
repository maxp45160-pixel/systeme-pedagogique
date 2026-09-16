# Modèle produit — carte

Relevé : 15/09/2026. Lire [PRODUCT](../../PRODUCT.md) avant tout arbitrage.

| Élément | Lecture correcte | Source |
|---|---|---|
| Boucle | Activité, preuve recevable, observation, état recalculé, prochaine action | PRODUCT ; [types réels](../../app/src/lib/domain/types.ts) |
| Référentiel | Appartient au compte ; un module de cours est un domaine | ADR-137/138 dans [ADR](../../ARCHITECTURE_DECISIONS.md) |
| Travail | `LearningSession` est l'épisode unique ; les gestes de préparation ne mesurent rien | [Interventions](../../docs/architecture/INTERVENTIONS_LEARNING_SESSION.md) |
| Plan global | Cible et fondations gelées ; composition retirée, non raccordée | PRODUCT, état courant et capacités/limites |
| Documents/assistant | Pilote et réalisation progressive ; ressource conservée distincte d'une mesure | [Pilote](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md), ADR-143 à 145 |

[Le modèle cible](../../docs/architecture/TWINY_MODEL.md) sert à raisonner.
Ne pas convertir ses concepts en tables ni annoncer sa totalité comme construite.
Une nouvelle idée doit passer le critère d'arrêt de PRODUCT et indiquer le
problème observé auquel elle répond.

Le [dossier de direction du 16/09](cadrage-direction.md) prépare le cahier des
charges : critique, exigences proposées, recettes et arbitrages ouverts. Aucune
de ses recommandations ne remplace PRODUCT ou une décision humaine.
