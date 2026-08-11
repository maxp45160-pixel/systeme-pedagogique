# Questions ouvertes

Registre produit par la mission ④ le 11/08/2026, puis mis à jour après arbitrage de Maxime le même jour. Une réponse « je ne sais pas » ou « je te laisse décider » ne devient pas une décision validée : elle reste ouverte jusqu'à un arbitrage humain explicite.

## Arbitrages rendus le 11/08/2026

| ID | Décision humaine | Effet documentaire | ADR |
|---|---|---|---|
| Q-01 | Les compétences non mesurées restent en veille, disponibles pour être remobilisées ; elles ne valent jamais zéro. | Confirme ADR-006 et P2. | ADR-006 |
| Q-03 | L'autonomie est mesurée autant que possible par les traces du produit (tuteur, indices, aides internes) ; ce qui reste invisible est demandé à la personne. | Étend ADR-033 sans valider le barème `PLAFOND_AIDE`. | ADR-057 |
| Q-04 | Le produit recueille le maximum de signaux pédagogiquement pertinents pour établir un bilan précis, dans les limites des huit invariants. | Décide le principe d'observation ; les champs concrets restent à spécifier avant chaque implémentation. | ADR-060 |
| Q-07 | La granularité thématique n'a pas de profondeur maximale ; thèmes et sous-thèmes apparaissent dans la liste, les notes dans le graphe. | Décide la forme cible du modèle, pas encore sa persistance. | ADR-058 |
| Q-08 | La garantie « le tuteur n'écrit aucune mesure » reste une garantie du moteur et de maintenance ; elle n'a pas à être exposée dans l'interface. | Ferme la question d'interface, sans modifier P5. | ADR-037 |
| Q-09 | Créer une séance conduit au workspace focus où elle est travaillée. | Décide la destination du geste de création ; route et mise en œuvre restent à concevoir. | ADR-059 |
| Q-10 | Aucun écran de reporting long terme pour l'instant : les données sont insuffisantes et les KPI actuels suffisent. | Écarte cette brique de la prochaine roadmap ; elle ne se rouvre que sur fait nouveau. | — |
| Q-11 | Les notes servent la boucle pédagogique ; elles ne constituent pas un second produit. | Ferme la question de finalité des notes. | ADR-058 |
| Q-16 | Cours, curiosité personnelle et besoins professionnels doivent pouvoir apporter des notions spécifiques, personnaliser l'apprentissage et disposer d'un stockage organisé. | Valide le besoin de connaissance liée ; ne choisit ni format d'import ni schéma. | ADR-058 |

## Questions encore ouvertes

| ID | Question | Ce que cela bloque ou oriente | Fait observable qui y répondrait | Qui tranche | Sources |
|---|---|---|---|---|---|
| Q-02 | Quel barème `PLAFOND_AIDE` relie documentation, assistant IA et correction aux paliers d'autonomie ? | La validation empirique de P8 et toute évolution du barème. | Des bilans terminés comparant traces internes, aide déclarée et résultats observés. | Maxime | `PRODUCT.md` §5 P8 ; ADR-057 |
| Q-05 | Quel fait observable pourrait justifier de détecter une triche sans accuser une personne sur une donnée insuffisante ? | Toute fonctionnalité de détection de triche. | Une définition de signal observable, vérifiable et non accusatoire, assortie de sa finalité. | Maxime | `PRODUCT_SPECIFICATION_MAP.md` couches 0 et 2 ; P7 |
| Q-06 | Quels motifs d'erreur peuvent être dérivés des verdicts archivés, et à partir de quelle répétition ? | La brique « erreurs récurrentes / motifs ». | Des verdicts suffisamment nombreux et cohérents pour identifier un motif sans en inventer la cause. | Maxime | `PRODUCT_SPECIFICATION_MAP.md` couche 2 ; ADR-046 |
| Q-12 | Des widgets modulables répondent-ils à une différence de besoins réellement observée entre comptes ? | Toute personnalisation persistée de l'accueil. | Deux comptes utilisant des compositions d'accueil incompatibles. | Maxime | `PRODUCT_SPECIFICATION_MAP.md` couche 1 et annexe |
| Q-13 | Tout doit-il être replanifié ? Si oui, selon quelles observations et avec quel droit de reprise humaine ? Sinon, quelles entités doivent être planifiées ? | Le périmètre et l'autorité d'une éventuelle replanification. | Des plans réellement suivis ou ignorés, avec les causes observables et l'effet attendu d'une replanification. | Maxime | `PRODUCT_SPECIFICATION_MAP.md` couche 3 ; ADR-042, ADR-050 |
| Q-14 | Quel manque de la vue longitudinale justifierait plus tard des rapports périodiques ? | Toute synthèse périodique et sa fréquence. | Des usages répétés montrant qu'une question reste sans réponse dans les KPI actuels. | Maxime | Décision Q-10 ; `PRODUCT_SPECIFICATION_MAP.md` couche 3 |
| Q-15 | Quelle finalité, quel consentement et quelles données rendraient compatibles des analytics ou modèles prédictifs avec P8 ? | Toute collecte partagée ou prédiction sur les données personnelles. | Une finalité écrite, un consentement explicite et une démonstration d'isolation. | Maxime | `PRODUCT_SPECIFICATION_MAP.md` couche 5 ; P8 |
| Q-16b | Quels formats d'entrée et de sortie sont réellement nécessaires pour les cours, notes et ressources : markdown, Obsidian, PDF ou autre ? | Les intégrations et le pipeline d'import. | Des ressources réelles à intégrer et le flux de travail qui doit les consommer. | Maxime | Décision Q-16 ; ADR-058 |
| Q-17 | Par quelle mesure le choix du moteur gratuit configurable est-il considéré résolu ? | Le test de réfutation de l'hypothèse de moteur. | Une mesure de disponibilité, coût, configuration et usage. | Maxime | `PRODUCT.md` §6 ; ADR-007 |

## Portée de l'arrêt humain

L'arrêt après ④ est levé pour les décisions du premier tableau. Les questions du second ne peuvent entrer dans une roadmap comme briques tranchées. La mission ⑤ peut commencer en conservant explicitement ces inconnues.
