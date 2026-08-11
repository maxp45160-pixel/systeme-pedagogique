# ⑧ — Roadmap orientée déblocage

## Objectif

Organiser le travail validé par ce qu'il débloque, jamais par simple difficulté.

## Entrées

`docs/QUESTIONS_OUVERTES.md`, `docs/MODELE.md`,
`docs/audits/2026-08-audit-produit.md`, `PRODUCT_SPECIFICATION_MAP.md`, et les
décisions humaines intervenues après ④. La synthèse technique
`docs/audits/2026-08-synthese.md` fournit des contraintes de fiabilité ; elle
ne définit ni les gaps fonctionnels ni leur priorité produit.

## Livrable

`ROADMAP.md` à la racine.

## Méthode

Ordonner les lots par fermeture de la boucle pédagogique : capacité actuelle,
gap fonctionnel, observation qui manque, action suivante débloquée. Le
nettoyage technique n'entre dans un lot que s'il en débloque directement la
feature. Pour chaque élément : dépendances, décision source, résultat attendu,
méthode, horizon, preuve de vérification et condition de démarrage.

## Critères de refus

Ne pas mettre en roadmap une brique dont la question ④ reste ouverte, transformer un constat d'audit en décision, ni modifier code, seuils ou statuts.

## Vérification

Chaque item remonte à une entrée de question, de synthèse ou à une décision humaine. Les dépendances rendent l'ordre d'exécution explicite.
