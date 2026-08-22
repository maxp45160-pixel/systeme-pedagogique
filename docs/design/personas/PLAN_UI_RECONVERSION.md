# Plan d'implémentation UI/UX — persona reconversion autodidacte (Sofia)

**Version 1.0 — 22/08/2026. Proposition, aucune décision validée.**

> Marquage : **[S]** sans nouvelle entité ni décision · **[D]** décision humaine
> requise.

## Vue d'ensemble

| Chantier | Couvre | Type | Effort |
|---|---|---|---|
| R1. Désambiguïsation intention projet / compétences | S0/S1 | [S] | faible |
| R2. Ressource-lien (URL documentaire) | S2 | [D léger] | moyen |
| R3. Fils de progression du corpus | S2 | [S] | faible |

## R1 — Intention projet vs référentiel [S]

**Problème.** « Devenir data analyst » peut déclencher le genre `projet` au lieu
de proposer un référentiel — comportement tuteur non réfuté, mais le formulaire
peut lever l'ambiguïté sans toucher au moteur.

**UI.**
- À l'amorçage (`formulaire-amorcage.tsx`), après la phrase : deux puces
  radio sobres — « Organiser des compétences à faire monter » /
  « Mener un projet précis ». Pré-sélection par heuristique locale (mot-clé
  « devenir », « préparer » → projet), jamais contraignante.
- La puce choisie est passée en indice au tuteur (contexte, pas contrainte) :
  le choix du genre reste celui du tuteur (`intention.ts:49`).
- En compte établi, le `+` ne change pas — l'ambiguïté est surtout d'amorçage.
- Micro-copie de résultat : quand le tuteur choisit `referentiel`, afficher
  « Voici une première organisation — tu pourras tout ajuster » ; quand il
  choisit `projet`, ouvrir la fiche projet (note opérationnelle, ADR-070) et
  proposer ensuite « en dériver des compétences ? » via la modale référentiel
  existante.

**Données.** Aucune nouvelle ; l'indice n'est pas persisté.

## R2 — Ressource-lien [D léger]

**Périmètre exact à arbitrer.** Un nouveau type de pièce documentaire : URL +
titre + domaine/compétences rattachées. Pas d'extraction, pas de lecture du lien
— il documente, il ne nourrit pas (cohérence avec le PDF actuel).

**UI (si arbitrée favorablement).**
- Dans l'espace documentaire de l'Atelier (`espace-documentaire.tsx`) : action
  « Ajouter un lien » à côté du dépôt PDF ; même formulaire court (URL, titre,
  rattachement optionnel).
- Fiche ressource-lien dans le workspace (`workspace-document.tsx`) : titre,
  URL cliquable, zone de notes texte libre (« chapitre 3 vu le… »), rattachements.
- La zone « à trier » (`estATrier`) couvre les liens non rattachés, comme les notes.
- Mobile : ouverture de l'URL dans un nouvel onglet, retour à l'app préservé.

**Garde-fous.** Le lien n'est jamais converti automatiquement en Connaissance
(ADR-092) ; pas de scraping ; validation d'URL côté serveur unique.

**Pourquoi [D].** Nouveau type stocké = extension du schéma documentaire ;
même modeste, c'est un engagement de maintenance (validation, affichage, RLS).

## R3 — Fils de progression du corpus [S]

**Problème.** Corpus plat : impossible de suivre « où j'en suis dans ce cours ».

**UI.**
- Dans la fiche ressource (PDF ou lien), une liste de repères textuels libres
  (« Chapitre 1 … fait », saisi par Sofia) — des notes, pas des mesures : aucun
  chiffre dérivé, aucune mécanique de complétion automatique.
- Sur la carte du domaine (`atelier/vues/vue-domaine.tsx`), section « Ressources »
  ordonnée par dernière activité documentaire (dérivé du journal, non stocké).
- Ne PAS construire : barres de progression de cours, pourcentages — ils
  fabriqueraient une mesure à partir de déclarations (violation P3).

## Vérification

- R1 : tests sur le formulaire (heuristique + envoi d'indice) ; observation
  réelle du choix de genre du tuteur avant toute retouche supplémentaire.
- R3 : aucune donnée stockée nouvelle — vérifier que tout est recalculé depuis
  le journal existant.
