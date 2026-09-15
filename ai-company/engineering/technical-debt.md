# Dette technique — index de constats

Relevé : 15/09/2026. Une réserve n'est ni une urgence validée ni une tâche autorisée.

| ID | Constat/source | Impact et prochaine vérification |
|---|---|---|
| DT-01 | [ADR-145](../../ARCHITECTURE_DECISIONS.md) décrit des écritures référentiel/Markdown/index non atomiques avec reprise | Cohérence à éprouver après interruption ; réutiliser les tests de reprise et scripts SQL avant de proposer une transaction nouvelle. |
| DT-02 | [Repères de migration](../../docs/architecture/TWINY_MIGRATION.md) : objets historiquement présents sans entrée de migration et fichiers non appliqués au relevé | Vérifier la base réelle avant intervention. Ni rejeu ni régularisation automatique. |
| DT-03 | [PRODUCT](../../PRODUCT.md), critère d'arrêt : préférence calculatrice active par défaut en écart avec ADR-122 | Réserve documentée le 05/09 ; vérifier le défaut actuel et l'arbitrage avant correction. |
| DT-04 | [Audit](../CURRENT_SYSTEM_AUDIT.md) : informations d'état réparties, datations différentes | Risque de reprise sur un ancien contrat. Les index sourcés de cette V1 réduisent la recherche ; entretien humain toujours nécessaire. |

Ordre de traitement : **UNKNOWN / À VALIDER AVEC LE FONDATEUR** après vérification
de l'impact réel. Les bugs établis sont suivis dans
[problèmes connus](../operations/known-problems.md), sans recopier cette table.
