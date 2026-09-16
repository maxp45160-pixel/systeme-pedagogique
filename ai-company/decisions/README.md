# Registre de décisions — consulter avant de proposer

## Où chercher et où écrire

1. Lire [PRODUCT](../../PRODUCT.md), puis chercher le sujet et ses synonymes dans
   [les ADR existants](../../ARCHITECTURE_DECISIONS.md).
2. Lire le corps de chaque décision pertinente et les amendements/remplacements,
   pas uniquement son statut dans le sommaire.
3. Consulter les [propositions ouvertes](../../docs/architecture/PROPOSITIONS_ADR_OUVERTES.md)
   et le registre actif du chantier. Vérifier types et appelants réels.
4. Mentionner ces décisions dans l'analyse, ou « aucune décision pertinente trouvée »
   avec le périmètre de recherche. Ne pas rediscuter un retrait par oubli.

| Sujet durable | Emplacement unique |
|---|---|
| Produit, pédagogie, UX, données, architecture applicative, infrastructure IA du produit | Registre ADR existant ; proposition ouverte existante si le sujet y figure déjà |
| Organisation interne, mémoire, rôles, coordination, automatisation d'entreprise | `DEC-XXXX-titre.md` dans ce dossier |
| Petite correction ou implémentation d'un contrat existant | Git et changelog pertinent ; pas de nouvelle décision obligatoire |

Le format [TEMPLATE](TEMPLATE.md) peut structurer une future entrée ADR sans
déplacer ni renuméroter les décisions historiques. Une décision qui touche les
deux domaines possède une référence canonique et un lien depuis l'autre registre,
jamais deux versions de sa justification.

## Cycle de vie

- `proposed` : préparation par un agent ou une personne ; aucune validation implicite.
- `accepted` : décision explicite de Maxime, avec date, auteur et source durable.
- `rejected` : refus explicite, motifs conservés.
- `superseded` : décision remplacée explicitement ; lien réciproque vers la suivante.

Seule une personne arbitre ces transitions. Un agent peut transcrire sa décision
et sa provenance, pas la déduire d'un silence, d'un commit ou d'un test vert.
Les statuts historiques ADR restent inchangés : une hypothèse scientifique
n'est pas automatiquement traduite en `proposed`.

Attribuer le prochain numéro libre après relecture de l'index et du dossier.
Conserver l'ancienne décision lors d'un remplacement. Une réouverture expose le
fait nouveau et le critère de révision, sans effacer le choix antérieur.
Une autorisation d'implémentation réversible ne valide pas une architecture durable.

## Index interne

| Identifiant | Sujet | Statut |
|---|---|---|
| [DEC-0001](DEC-0001-memoire-et-roles-documentaires.md) | Mémoire sourcée et rôles documentaires sans orchestrateur | proposed |
| [DEC-0002](DEC-0002-essai-manuel-compute.md) | Essai manuel de choix modèle/effort sur cinq missions | accepted |
| [DEC-0003](DEC-0003-autonomie-et-reprise.md) | Autonomie bornée, reprise et amélioration évaluée, à la demande | accepted |

Aucune nouvelle décision produit acceptée par cette V1.
