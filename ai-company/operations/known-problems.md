# Problèmes et réserves connus

Relevé : 15/09/2026. Les états ci-dessous qualifient les preuves disponibles,
sans revérification du produit dans cette session.

| ID | Objet | Évidence / limite | Prochaine action proposée |
|---|---|---|---|
| KP-01 | Parcours complet et fidélité sur corpus varié encore à éprouver | [Pilote](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md#reprise-mistral--15092026) : première analyse Mistral réussie consignée ; elle ne prouve pas le parcours de bout en bout ni la fidélité générale | Partir des preuves conservées ; tout nouvel essai suit son autorisation, sans réessai payant automatique. |
| KP-02 | Vérification visuelle de fiche domaine bloquée | [design-qa](../../design-qa.md) rapporte une redirection login et aucune capture correspondante | Vérification authentifiée si cette surface est reprise ; ne pas annoncer une régression visuelle certaine. |
| KP-03 | État local étendu, déploiement et validation de l'ensemble inconnus | Git initial et [audit](../CURRENT_SYSTEM_AUDIT.md) | Délimiter le diff du chantier, exécuter ses checks ; vérifier séparément le déploiement si nécessaire. |
| KP-04 | Mémoire institutionnelle exposée au vieillissement | Écart constaté dans l'[audit d'autonomie](runs/2026-09-15-audit-autonomie.md) ; index réconciliés dans [ORG-0001](missions/ORG-0001.json) | La fiche porte l'état actif et la clôture exige les index touchés ; vérifier encore les sources, car un contrôle de liens ne valide pas leur sens. |

Dette connexe : [registre de dette](../engineering/technical-debt.md).
Un problème clos garde sa preuve et sa date de résolution ; ne pas effacer
l'historique ni clôturer sur une simple absence de nouvel échec.
