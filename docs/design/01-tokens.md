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
- le contraste est **mesuré, pas estimé** : `node scripts/contraste.ts` affiche
  le tableau ratio + verdict par paire et par thème, et
  `src/lib/ui/contraste.test.ts` verrouille la règle dans les tests. Les paires
  mesurées sont celles réellement consommées (textes sur surfaces et fond,
  contours de contrôle, marque, états d'action, rail) ;
- valeurs mesurées au 22/08/2026 — toutes conformes. Correction notable :
  `--rail-texte-discret` passait sous le seuil sur `--rail` (4,07:1 en
  #7f9585) ; la valeur retenue #8ba091 remet la paire à 4,69:1 (`--rail`) et
  5,40:1 (`--rail-2`), sans franchir `--rail-texte-attenue` (6,52:1). Ratios
  de référence : `--texte × --surface` 15,74:1 / 14,14:1 ;
  `--texte-discret × --surface` 5,41:1 / 5,03:1 ;
  `--bordure-controle × --surface` 3,57:1 / 3,36:1 ;
- toute modification d'un jeton de couleur doit faire repasser le script et le
  test avant d'être poussée ;
- la couleur ne porte jamais seule une information ;
- `prefers-reduced-motion` neutralise animations et transitions ;
- toute modification de palette doit être vérifiée dans les deux thèmes.
