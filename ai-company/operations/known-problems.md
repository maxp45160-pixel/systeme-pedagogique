# Problèmes et réserves connus

Relevé : 15/09/2026. Les états ci-dessous qualifient les preuves disponibles,
sans revérification du produit dans cette session.

| ID | Objet | Évidence / limite | Prochaine action proposée |
|---|---|---|---|
| KP-01 | Parcours fournisseur et fidélité documentaire non démontrés | [Pilote](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md), [ADR-145](../../ARCHITECTURE_DECISIONS.md) ; un essai limité n'est pas un succès de bout en bout | Reprendre le protocole existant sur corpus autorisé ; noter fournisseur/date et résultat sans réessai payant automatique. |
| KP-02 | Vérification visuelle de fiche domaine bloquée | [design-qa](../../design-qa.md) rapporte une redirection login et aucune capture correspondante | Vérification authentifiée si cette surface est reprise ; ne pas annoncer une régression visuelle certaine. |
| KP-03 | État local étendu, déploiement et validation de l'ensemble inconnus | Git initial et [audit](../CURRENT_SYSTEM_AUDIT.md) | Délimiter le diff du chantier, exécuter ses checks ; vérifier séparément le déploiement si nécessaire. |
| KP-04 | Mémoire institutionnelle exposée au vieillissement | Dates divergentes signalées par l'audit ; aucune automatisation ne peut valider le sens des documents | Chief of Staff vérifie les sources actives à chaque bilan ; un lien valide ne prouve pas une phrase vraie. |

Dette connexe : [registre de dette](../engineering/technical-debt.md).
Un problème clos garde sa preuve et sa date de résolution ; ne pas effacer
l'historique ni clôturer sur une simple absence de nouvel échec.
