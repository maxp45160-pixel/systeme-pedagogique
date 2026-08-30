# Mathématiques et figures

Document d’audit de l’état effectivement implémenté. Il ne constitue pas une
décision d’architecture validée.

## Inventaire des surfaces mathématiques

| Surface | Consultation | Édition | État |
|---|---|---|---|
| `components/ui/markdown.tsx` | énoncés, corrections, réponses relues, messages du tuteur, fiches et résumés | non | `FormuleMath` pour inline et blocs |
| `components/ui/formule-math.tsx` | composition commune | non | KaTeX, rôle `math`, libellé Unicode accessible, repli Unicode |
| `components/atelier/editeur-document.tsx` | document vivant | oui | nœuds atomiques composés ; clic pour rouvrir la source |
| `lib/documents/formule-noeud.ts` | composition WYSIWYG | oui, via l’éditeur | même composition KaTeX/repli que `FormuleMath` |
| `components/exercices/zone-reponse.tsx` | aperçu de la réponse avant envoi | oui | textarea + palette + aperçu immédiat |
| `components/tuteur/chat-input.tsx` | question composée dans la zone | oui | éditeur ContentEditable + palette ; nœud composé, source seulement sur geste d’édition |
| `components/seances/marge-cahier.tsx` | aperçu de la note | oui | textarea + aperçu immédiat |
| `components/atelier/espace-documentaire.tsx` | snapshot et sections | oui | éditeur vivant ou textarea + aperçu |
| `components/ui/champ.tsx` avec `formules` | intention, brief de projet et champs pédagogiques | oui | palette + aperçu automatique |
| autres zones `PaletteFormulesTexte` | intention, explication, protocole, fiche, création et révision | oui | palette + aperçu immédiat |

Les champs techniques (identifiant, recherche, authentification et notes
d’administration) restent exclus. Un champ sans formule ne reçoit pas de
panneau supplémentaire. Une syntaxe refusée par KaTeX reste visible sous sa
forme Unicode ; aucun message technique n’est affiché à l’utilisateur.

## Primitive commune

`lib/ui/rendu-formule.ts` est la seule composition bas niveau :

1. KaTeX compose la formule inline ou en bloc ;
2. `latexVersTexte` fournit le texte accessible dans tous les cas ;
3. `FormuleMath` masque la composition visuelle au lecteur d’écran et expose
   un rôle `math` avec son libellé ;
4. le nœud WYSIWYG réutilise exactement la même composition et conserve la
   source LaTeX pour la réédition.

Les zones textuelles qui restent des `textarea` réutilisent `Markdown` pour
l’aperçu, donc le rendu de l’aperçu et celui de la consultation suivent le
même chemin. Le chat réutilise l’éditeur ContentEditable et ses nœuds
atomiques : la formule composée est visible dans la zone elle-même, tandis
que sa source reste conservée pour un geste explicite d’édition. La valeur
Markdown sérialisée reste la seule valeur envoyée et persistée.

## Figures d’exercice : état du modèle

Les données existantes ne suffisent pas à porter ce contrat :

- `Exercise.donnees` et `exercises.donnees` représentent des couples
  `{libelle, valeur}` affichés dans le panneau « Données » ; détourner ce champ
  rendrait sa validation et son affichage ambigus ;
- `PieceJointeDocument` accepte déjà JPEG, PNG et WebP, mais la table
  `document_attachments` est rattachée à une note support, pas à un exercice ;
- aucun lecteur d’exercice ne résout aujourd’hui une pièce jointe en figure.

La modification persistée est donc indispensable pour qu’une figure soit
attachée durablement à un exercice. Elle n’est pas appliquée dans ce chantier.

### Contrat minimal proposé

```ts
type FigureExercice = {
  type: "image";
  source: string;       // identifiant stable d’une pièce jointe existante
  alt: string;          // obligatoire, non vide
  legende?: string;
  largeur?: number;     // entier positif, pixels intrinsèques
  hauteur?: number;     // entier positif, pixels intrinsèques
};
```

Dans l’interface, `source` est une URL déjà résolue et autorisée par la couche
de stockage. Dans la donnée persistée, elle devra être l’identifiant stable de
la pièce jointe, jamais une URL signée à durée de vie limitée. Le composant
`components/ui/figure-exercice.tsx` rend déjà ce contrat avec `<figure>`,
`<figcaption>`, une image responsive et un secours accessible si la source est
absente ou indisponible. Il ne téléverse ni ne génère rien.

### Dépendances de la migration candidate

- ajouter `figure JSONB NULL` à `public.exercises` ;
- ajouter `figure?: FigureExercice` à `Exercise` ;
- valider le contrat à la frontière Supabase, notamment le type, l’alt et les
  dimensions ;
- résoudre `source` via `document_attachments`, avec vérification du compte,
  du type MIME image et de la note support autorisée ;
- afficher la figure dans les trois vues d’exercice et dans leurs impressions,
  sans la transmettre au moteur comme une mesure ;
- ajouter RLS/contrainte de cohérence si le lien vers la pièce jointe est
  persisté dans la même colonne JSONB.

### Migration proposée, non appliquée

```sql
ALTER TABLE public.exercises
  ADD COLUMN figure JSONB;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_figure_contract_check
  CHECK (
    figure IS NULL
    OR (
      jsonb_typeof(figure) = 'object'
      AND figure ->> 'type' = 'image'
      AND btrim(coalesce(figure ->> 'source', '')) <> ''
      AND btrim(coalesce(figure ->> 'alt', '')) <> ''
      AND (
        figure ? 'largeur' IS FALSE
        OR (jsonb_typeof(figure -> 'largeur') = 'number'
            AND (figure ->> 'largeur')::numeric > 0
            AND (figure ->> 'largeur')::numeric = trunc((figure ->> 'largeur')::numeric))
      )
      AND (
        figure ? 'hauteur' IS FALSE
        OR (jsonb_typeof(figure -> 'hauteur') = 'number'
            AND (figure ->> 'hauteur')::numeric > 0
            AND (figure ->> 'hauteur')::numeric = trunc((figure ->> 'hauteur')::numeric))
      )
    )
  );
```

Cette proposition ne suffit pas seule à garantir que `source` pointe vers une
pièce jointe du même compte ; la résolution applicative et la RLS restent
nécessaires. Elle ajoute une colonne nullable sans toucher aux exercices
existants, mais implique la validation, la résolution d’URL signée, les vues,
les tests et la politique de suppression d’une pièce jointe. Elle doit être
présentée et autorisée avant toute application Supabase.
