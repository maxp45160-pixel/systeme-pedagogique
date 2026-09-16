# D — Revue de changement

## Entrée

Spec ou demande approuvée, base Git explicite, périmètre du changement et validations.
Lire le [contrat QA](../agents/qa.md) et le contrat commun.

## Contrôles

Pour le code, réutiliser [diff-audit](../../.agents/skills/diff-audit/SKILL.md),
sans relire aveuglément tous les changements d'un arbre de travail partagé.

1. Délimiter suivi, staged et non suivi ; distinguer l'état initial du chantier.
2. Vérifier spec et critères, types/imports et appelants concernés.
3. Chercher régression, cas limite, ancien chemin réintroduit, dette/abstraction
   inutile et rupture des invariants.
4. Examiner autorisation, RLS, validation d'entrée, secrets et données intercompte
   si le changement les touche ; ne pas inventer un audit sécurité global.
5. Examiner la qualité des tests : comportement garanti, environnement, sorties
   réelles. Un build ne prouve pas une interaction authentifiée.
6. Vérifier documentation, liens et état des décisions. Pour l'AI Company,
   contrôler également absence de promotion de statut, autorité des sources,
   routage, coût/contexte et isolation du produit.
7. Rapporter les constats avec gravité, déclencheur, impact, preuve et correction.
   Les inconnues sont distinctes des défauts démontrés.

## Sortie et clôture

Verdict borné au périmètre inspecté, constats actionnables, réserves et checks
exécutés/non exécutés. Corriger les défauts avant de conclure.
Chief of Staff met à jour les index d'état seulement si le changement le justifie ;
l'avis QA n'est pas une décision validée ni une autorisation de merge.
Vérifier également la fiche de mission : accord applicable, critères satisfaits,
contrôles sur la version livrée et effets externes connus. Pour un changement
d'instructions, appliquer l'[évaluation des améliorations](improvement.md).
