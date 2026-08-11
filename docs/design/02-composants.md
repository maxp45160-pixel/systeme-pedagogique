# Composants d'interface

Les primitives partagées vivent dans `app/src/components/ui/`. Elles portent la
présentation et l'accessibilité ; la logique métier non triviale reste dans
`lib/`.

## Socle actif

| Famille | Composants et usage |
|---|---|
| Conteneurs | `Carte`, `EnTeteCarte`, `CorpsCarte`, `Modale` |
| Actions | `Bouton`, `BoutonSoumission`, `classesLienBouton` |
| Formulaires | `Champ`, `ChampSelect`, `classesChamp`, `SelecteurSegmente` |
| Information | `BandeauInfo`, `Etiquette`, `CodeCompetence`, `TagConfiance`, `NombrePreuves` |
| Mesure visible | `JaugeNiveau`, `BarreProgression`, `Statistique`, `FacteursRevision` |
| États | `EtatVide`, `PointActif`, squelettes de chargement |
| Divulgation | `PanneauPliable`, `TiroirRepliable`, `Depliant`, `PanneauExplication`, `Reserves` |
| Contenu | `Markdown`, `Glossaire`, `LienRetour` |

## Règles

- utiliser une primitive existante lorsqu'elle représente le même rôle ;
- ne pas forcer dans une primitive une forme sémantiquement différente ;
- les champs ont un vrai `label`, les erreurs sont reliées par ARIA et les
  boutons de chargement restent désactivés ;
- `BandeauInfo` porte les messages en place, pas des notifications flottantes ;
- `BarreProgression` expose la sémantique `progressbar` ;
- `PointActif` est décoratif quand un texte adjacent décrit l'activité ;
- le focus visible vient de la règle globale, sans styles locaux divergents.

Un composant sans appel de production n'est pas conservé « pour plus tard ».
Les composants réservés aux tests doivent vivre avec les fixtures de test.
