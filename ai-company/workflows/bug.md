# C — Bug

## Entrée

Symptôme, comportement attendu, contexte et reproduction disponibles.
Pour un travail non trivial, reprendre le [cycle de mission](mission.md).
Un défaut local démontré peut être corrigé sous le [mandat](../operations/autonomy.md)
si le comportement attendu est déjà approuvé et le périmètre libre de conflit.

## Déroulement

1. Reproduire ou documenter précisément ce qui empêche la reproduction.
2. Inspecter le skeleton puis les dépendances ; diagnostiquer avant d'éditer.
3. Énumérer les hypothèses utiles, choisir la vérification qui les départage.
4. Confirmer la cause ; corriger au niveau responsable le plus étroit.
5. Exécuter un test qui démontre la correction et couvre la régression quand
   il apporte une garantie utile. Pas de test qui recopie seulement le code,
   ni de suite artificielle pour une petite retouche visuelle réversible.
6. Vérifier les appelants/cas limites pertinents ; ne pas élargir en refonte.
7. Documenter si un contrat ou comportement documenté change ; sinon Git et
   le registre du chantier suffisent.

## Sortie et escalade

Cause et preuve, correction, validation, limite résiduelle. Si la cause reste
inconnue, le dire ; ne pas inventer une explication. Un contrat produit contradictoire
ou une migration destructive requiert le choix humain concret. Une correction
simple ne convoque pas Product, Research et CTO automatiquement.
