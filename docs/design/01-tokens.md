# Jetons de design

Source unique : `app/src/app/tokens.css`. `globals.css` consomme ces jetons et
ne définit que des comportements globaux.

## Architecture

Deux niveaux suffisent :

1. les primitives portent les valeurs brutes (`--neutre-600`,
   `--vert-succes`) ;
2. les jetons sémantiques portent un rôle (`--texte-discret`, `--danger`,
   `--surface`).

Les composants utilisent les rôles, jamais les primitives. Le thème sombre
réaffecte les mêmes rôles à une rampe adaptée ; aucune condition de thème ne
doit apparaître dans un composant.

## Familles actives

- surfaces, texte et bordures ;
- marque primaire et accent ;
- états d'action : succès, alerte, information et danger ;
- niveaux de compétence pour les graphiques, toujours accompagnés d'une valeur
  lisible ;
- superpositions : une échelle unique, un seul ordre —
  `--superposition-collant` (10) < `--superposition-barre` (20) <
  `--superposition-menu` (30) < `--superposition-tiroir` (40) <
  `--superposition-modale` (50) < `--superposition-tour` (60) <
  `--superposition-notification` (70). Toute surface flottante pioche ici via
  `z-[var(--…)]` ; écrire un `z-<nombre>` littéral est le défaut que cette
  famille existe pour rendre impossible. Le contrat associé est « une seule
  surface pleine page à la fois » : pendant qu'un tour est actif, la capture
  d'intention ne s'ouvre pas (verrou du fournisseur d'intention) ;
- couleurs du rail et ornements du cahier ;
- corps de texte, espacement de base, rayons réellement consommés ;
- ombres encore utilisées et mouvement d'apparition.

Les alias Tailwind exposés sont limités aux rôles effectivement référencés dans
le code. Ajouter une valeur exige un usage réel ; retirer un jeton exige une
recherche des références CSS et Tailwind.

## Accessibilité

- le texte vise au moins 4,5:1 et les contours interactifs 3:1 ;
- la couleur ne porte jamais seule une information ;
- `prefers-reduced-motion` neutralise animations et transitions ;
- toute modification de palette doit être vérifiée dans les deux thèmes.
