# Proposition de chantier — orchestration de « Nouveau besoin »

**Statut :** proposition de conception, non validée comme décision produit ou
architecturale.

## Intention

La personne ne gère pas un référentiel. Elle exprime ce dont elle a besoin ; le
système situe ce besoin, propose son intégration dans l’Atelier, puis la conduit
vers le travail.

Le référentiel, la carte globale, les relations et les diagnostics restent des
mécanismes internes ou des explications contextuelles. Ils ne deviennent pas
des destinations que la personne doit comprendre avant de pouvoir apprendre.

## Parcours cible

```text
Nouveau besoin
    ↓
Traduction explicite en fiche, séance, projet ou intégration
    ↓
Pour une intégration : proposition concrète de domaine / branche
    ↓
Confirmation minimale ou correction de la proposition
    ↓
Confirmation minimale ou correction du repère
    ↓
Travail immédiat
```

La traduction est la même quelle que soit la destination. L’écran explique
toujours l’action retenue, pourquoi elle répond au besoin et ce qui va se
passer après confirmation. Les autres lectures possibles restent secondaires.
Pour le référentiel, le système ne montre les informations de positionnement
qu’après avoir obtenu un sujet concret et une première proposition de domaine.
Le référentiel n’est donc pas une branche qui contourne « Nouveau besoin » :
c’est une conséquence particulière de la traduction.

Le parcours doit rester exploitable même si le tuteur est indisponible ou si la
carte globale ne contient aucun repère pertinent. Dans ce cas, le système dit ce
qu’il ne sait pas situer et propose une extension locale relue par la personne.

## Proposition d’intégration

La proposition est éphémère. Elle ne constitue ni un nouvel état, ni une
nouvelle entité persistée.

```ts
type ProvenanceIntegration =
  | "carte-globale"
  | "observé-dans-le-travail"
  | "proposé-par-le-tuteur"
  | "déclaré";

interface PropositionIntegration {
  besoin: string;
  ancrageGlobal?: {
    id: string;
    chemin: string[];
    nom: string;
    description: string;
    provenance: ProvenanceIntegration;
  };
  correspondancesLocales: Array<{
    code: string;
    intitule: string;
    domaine: string;
    raison: string;
    provenance: ProvenanceIntegration;
  }>;
  competencesNouvelles: Array<{
    intitule: string;
    domainePropose?: string;
    palierPropose?: string;
    raison: string;
    provenance: ProvenanceIntegration;
  }>;
  relations: Array<{
    amont?: string;
    aval?: string;
    libelle: string;
    type: "prerequis" | "ouvre" | "connexe";
    raison: string;
    provenance: ProvenanceIntegration;
  }>;
  reserves: string[];
}
```

Les identifiants globaux, les codes locaux et les domaines utilisables sont
toujours fournis par le serveur. Le tuteur peut proposer ; il ne peut ni
inventer un code, ni publier dans la carte globale, ni écrire une mesure.

## Écran de relecture

Le corps de la modale ou du panneau contient quatre blocs, dans cet ordre :

1. **Ce que tu veux faire** — reformulation courte du besoin.
2. **Où cela se situe** — chemin global proposé, avec source et niveau de
   confiance explicatif ; une alternative permet de corriger le repère.
3. **Ce que cela change dans ton Atelier** — compétences locales réutilisées,
   compétences nouvelles, domaines concernés et absence éventuelle de doublon.
4. **Ce qui vient avant et après** — prérequis, évolutions possibles et liens,
   chaque ligne portant sa provenance.

L’action principale est unique : **Ajouter à mon Atelier et commencer**. Elle
confirme uniquement les éléments explicitement retenus, puis ouvre le geste de
travail approprié. Une correction légère doit être possible par **Corriger le
repère**, sans renvoyer vers une page d’administration.

Les termes « code », « préfixe », « importance » et « gérer le référentiel » ne
doivent pas apparaître dans le parcours nominal.

## Intégration progressive dans l’existant

### Lot A — contrat et lecture pure

- Préparer un contrat de proposition d’intégration dans `lib/domain/`, mais ne
  l’exposer qu’après une première proposition de domaine concrète.
- Construire cette proposition à partir des faits déjà disponibles :
  référentiel local, carte globale, correspondances et relations déclarées.
- Garder une sortie explicite quand aucun rapprochement n’est justifié.
- Tester les cas : compétence locale existante, sujet nouveau, carte globale
  vide, correspondance ambiguë, proposition sans relation.

### Lot B — orchestration du bouton

- Garder une traduction unique pour `fiche`, `séance`, `projet` et
  `référentiel`.
- Pour `référentiel`, envoyer directement le sujet vers la proposition
  concrète de domaine/branche ; ne pas intercaler une page de positionnement
  abstraite.
- Réserver la relecture d’intégration aux domaines effectivement proposés.

**État du premier raccord :** la phase de traduction est commune aux quatre
genres actuels. Pour `referentiel`, elle ouvre directement la proposition
concrète de domaine/branche avec le sujet déjà exprimé. La page intermédiaire
de positionnement global a été écartée : elle ajoutait une relecture avant que
la personne ne sache ce qui allait réellement être ajouté.

### Lot C — écriture confirmée

- Ajouter une commande serveur unique pour réutiliser, créer, rattacher et
  déclarer les relations retenues.
- Préserver l’archivage des compétences portant de l’historique.
- Ne jamais publier automatiquement un élément local dans la carte globale.
- Après confirmation, rediriger vers le travail et non vers la maintenance du
  référentiel.

### Lot D — Atelier

- Faire de la carte personnelle la surface par défaut de l’Atelier.
- Remplacer les cartes « Ajouter un domaine » et « Ajouter une compétence » par
  des entrées secondaires vers le même flux de besoin.
- Transformer « Entretien » en suggestions contextuelles seulement lorsqu’un
  fait justifie une action.
- Exposer les relations établies et les propositions avec deux statuts visuels
  distincts.

Les entrées de création visibles dans l’Atelier sont déjà raccordées au même
contexte `Nouveau besoin` : elles préremplissent une phrase, mais ne choisissent
plus un objet technique ni une modale de maintenance.

### Lot E — carte globale

- Valider humainement un petit catalogue initial sourcé avant de le rendre
  visible comme repère.
- Ajouter la navigation macro → micro dans l’Atelier.
- Ne pas construire une ontologie exhaustive ni inférer automatiquement des
  correspondances personnelles.

## Critères d’acceptation du premier vertical slice

- Une personne peut exprimer un sujet nouveau sans choisir « domaine »,
  « compétence » ou « référentiel ».
- Le système affiche d’abord une proposition concrète de domaine avant toute
  écriture.
- Les prérequis, évolutions et liens sont visibles lorsqu’ils sont justifiés ;
  leur absence est dite plutôt que remplacée par une invention.
- Une seule confirmation suffit dans le cas nominal.
- Les propositions globales, locales, observées et simplement inférées sont
  distinguées à l’écran.
- Le tuteur indisponible ne bloque pas la possibilité de travailler ou de
  demander une extension locale.
- Aucun code, niveau, score ou état n’est fabriqué par l’interface.

## États d’interface

| État | Affichage |
| --- | --- |
| Saisie | Phrase libre, aide courte, validation à partir de 3 caractères |
| Traduction | Progression annoncée, possibilité d’arrêter |
| Proposition | Action principale et alternatives actuelles |
| Intégration | Carte de positionnement et changements proposés après le domaine |
| Carte vide | « Aucun repère global justifié » + extension locale relue |
| Erreur | Cause réelle, relance et repli manuel explicite |
| Confirmation | Écriture en cours, boutons désactivés, retour vers le travail |

## Responsive et accessibilité

- Desktop : panneau de relecture large, deux colonnes pour la position et les
  conséquences locales.
- Mobile : une seule colonne ; les relations et réserves sont des sections
  repliables, sans perte d’information.
- La modale conserve `role="dialog"`, le piège de focus et `Échap` via la
  primitive existante.
- Après la traduction, le focus est déplacé sur le titre de la proposition.
- Les statuts de provenance ne reposent pas uniquement sur la couleur.
- Chaque proposition possède un intitulé lisible par lecteur d’écran et une
  action explicite de confirmation ou d’écartement.
