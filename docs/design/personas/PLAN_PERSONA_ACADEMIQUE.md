# Plan d'implémentation — persona académique (Léa)

**Version 0.2 — 22/08/2026. Plan proposé, rien de tranché.**

> **v0.2.** Déplacé dans `docs/design/personas/` (lien vers la simulation
> corrigé) ; vérifié contre l'état du code après les commits du 22/08
> (`2af9b83`, `80b2431`, `4cd3323`) : toutes les références citées restent
> exactes (`capture-intention.tsx:369`, `formulaire-amorcage.tsx:253`,
> plafond `outils.ts:754`). Absorbe l'esquisse `PLAN_UI_ACADEMIQUE.md`
> écrite le même jour, qui lui était inférieure.

Ce document organise les écarts remontés par la simulation persona
([SIMULATION_PERSONA_ACADEMIQUE.md](SIMULATION_PERSONA_ACADEMIQUE.md) v1.2) en
chantiers implémentables, avec leur UI, leur UX et leurs garde-fous.

> **Statut de tout ce qui suit : ❓ question ouverte ou 🔬 hypothèse.**
> Conformément à PRODUCT.md §7 et AGENTS.md :
>
> - aucun statut ne monte sans décision humaine explicite ;
> - chaque chantier commence par ses **arbitrages préalables** — ils bloquent,
>   le code attend ;
> - une décision qui retire ou contredit un contrat existant met à jour
>   `PRODUCT.md` / `ARCHITECTURE_DECISIONS.md` **dans le même commit** ;
> - les seuils et barèmes proposés sont des points de départ à confronter à
>   l'usage, jamais des calibrations (P8, ADR-066).

---

## 0. Vue d'ensemble

| # | Chantier | Couvre | Verdict persona visé | Dépend de |
|---|---|---|---|---|
| A | **Le fait daté** — engagements (examen, rendu) | S5, S7, S8, S10 | ❌❌❌ → 🟡 minimum, ✅ si boucle complète | Arbitrages A0 |
| B | **La classe** — regroupement sans nouvelle entité | S2, S4 | 🟡 → ✅ partiel | Rien |
| C | **Le PDF nourrit la boucle** | S3, S4 | 🟡 → ✅ partiel | Arbitrage C0 |
| D | **Micro-frictions** | S2, S3 | frictions locales | Rien |

Ordre recommandé : **D → B → A → C**. D et B sont petits et autonomes ; A est
le seul chantier structurant mais il est bloqué par des arbitrages produit ;
C est le plus coûteux et le moins certain (lecture documentaire par le tuteur).

La carte de navigation n'a **aucun défaut structurel à corriger** (§4 de la
simulation) : tout ce qui suit s'ajuste aux surfaces existantes — tableau de
bord, `+`, Cahier/Bureau, Atelier — sans nouvelle route racine, sauf mention
contraire.

---

## Chantier A — Le fait daté (engagements)

### A0. Arbitrages préalables — bloquants, à rendre par une personne

| # | Question | Pourquoi elle bloque |
|---|---|---|
| A0.1 | La position « pas un outil de révision » (PRODUCT.md §2) interdit-elle de retenir une date d'examen ? Sinon, quelle reformulation de la phrase ? | Sans réponse, rien ne se construit. La réponse modifie PRODUCT.md — même commit obligatoire. |
| A0.2 | Un engagement déclaré est-il un **fait stocké** légitime au sens de la couche 2 (Observé/Déclaré), alors qu'ADR-096 vient de retirer les objectifs ? Quelle différence de nature justifie de recréer un objet ? | Risque exact de refaire le lot 4. La réponse doit nommer ce qui distingue « examen le 15/12 » d'un objectif structuré (hypothèse de travail : l'engagement affirme un événement extérieur daté, il n'affirme rien sur la personne ni sur son apprentissage). |
| A0.3 | Périmètre des types : examen seulement ? examen + devoir à rendre + soutenance ? | Conditionne le vocabulaire UI et le schéma. Recommandation : commencer par deux types max (`examen`, `rendu`). |
| A0.4 | L'engagement peut-il cibler des compétences, ou seulement un domaine, ou rien ? | Conditionne le branchement moteur. Recommandation : ciblage facultatif par compétences (codes de l'enum du compte uniquement), jamais inventées par le tuteur. |

### A1. Données (après A0)

Une table minimale, append-only en pratique, archivage jamais suppression
(même règle que compétence avec preuves / exercice avec tentatives) :

```
engagements
  id            uuid pk
  compte_id     uuid        -- RLS stricte, propriétaire seul
  type          text        -- enum contraint ('examen', 'rendu') — A0.3
  libelle       text        -- verbatim de la personne
  echeance_le   date        -- la date déclarée, seule donnée dure
  codes         text[] null -- codes du référentiel du compte, validés (A0.4)
  cree_le       timestamptz
  cloture_le    timestamptz null  -- archivage explicite ou automatique après date
```

Garde-fous :

- **P1 respecté** : la date est déclarée, non dérivable — son stockage est
  légitime. Tout le reste (J-x, urgence, couverture) est **dérivé à la
  lecture**, jamais stocké ;
- **P3** : chaque usage du facteur porte sa source (« engagement déclaré le… ») ;
- migration unique, documentée appliquée/en attente là où elle est décrite ;
- validation entrée : les `codes` sont relus contre le référentiel du compte
  avant d'entrer — un code invalide est refusé bruyamment, pas ignoré
  (défaut corrigé du comportement supprimé avec le lot 4).

### A2. Moteur

Un seul facteur nouveau dans le classement (`lib/engine/recommend.ts`) :

- **Proximité d'échéance** : pour chaque compétence ciblée par un engagement
  non clôturé, un bonus croissant à mesure que la date approche, actif sur une
  fenêtre (proposition : J-21 → veille). Hors fenêtre : zéro, pas de pénalité.
- Le facteur s'affiche dans le dépliant « Pourquoi cette action plutôt qu'une
  autre ? » avec sa source — jamais un score muet.
- **Pas de recalibration des seuils existants** : le facteur s'ajoute, les
  barèmes actuels ne bougent pas sans données (garde-fou AGENTS.md).
- Test de réfutation à écrire avec le code : *un engagement visible et pesant
  change-t-il l'acceptation des actions recommandées ?* Mesures : taux
  d'acceptation des cartes pendant fenêtre vs hors fenêtre.

### A3. UX — la capture

Principe dur : **la création d'un engagement est un geste explicite**, jamais
un effet de bord d'un besoin (c'est la leçon d'ADR-096 et l'invariant
d'intention). Deux chemins :

1. **Chemin direct** — geste dédié sur le tableau de bord :
   - dans la zone du `+`, une seconde entrée sobre : « Déclarer une échéance »
     (texte, pas d'icône inventée ; icône SVG du jeu existant si besoin) ;
   - formulaire minimal en modale : type (2 choix), libellé, date
     (saisie JJ/MM), ciblage facultatif de compétences via le sélecteur
     existant du référentiel. Trois champs, zéro étape de plus ;
   - validation → retour tableau de bord, la carte « À venir » apparaît.
2. **Chemin assisté** — dans la capture d'intention existante :
   - après traduction du besoin, si `extraireEcheanceBesoin` détecte une date,
     le panneau propose une **action alternative** (mécanique des pistes
     alternatives déjà en place) : « Garder cette date ? Créer un engagement » ;
   - accepter ouvre le formulaire pré-rempli ; ignorer ne laisse **aucune
     trace** — le comportement actuel reste le défaut ;
   - le tuteur **propose**, la personne valide case par case (P5 : il ne
     mesure rien ; ici il ne retient rien seul).

### A4. UX — la restitution

- **Carte « À venir »** sur le tableau de bord, sous l'action prioritaire :
  liste des engagements ouverts triés par date, chacun « Libellé — J-9 »,
  avec ses compétences ciblées si elles existent. Vide tant que rien n'est
  déclaré — pas de grille de tirets (même règle que le compte neuf).
- Comportement à J-0 et après : l'engagement passe en section « Passé » repliée
  ; clôture manuelle possible (« passé », « reporté » — report demande une
  nouvelle date, jamais effacement).
- Dans le Bureau/Cahier : **aucun ajout** — l'engagement n'est ni une séance ni
  une activité ; il vit au tableau de bord et dans le pourquoi de la
  recommandation. Ne pas créer de surface autonome (leçon ADR-096 : jamais de
  vue « parcours » séparée).

### A5. UX — le plan avant examen (dérivé, jamais stocké)

- Sur la carte « À venir », un engagement de type `examen` se déplie en une
  **couverture dérivée** : pour chaque compétence ciblée, niveau observé
  actuel + dernière activité — calculée à la demande depuis l'état existant
  (P1), présentée comme lecture honnête (« rien encore observé sur X » vaut
  mieux qu'un 0 — P2).
- **Pas de répartition jour par jour fabriquée** : le plan EST la file
  d'actions déjà recommandée, réordonnée par le facteur A2. Ce que l'app
  ajoute, c'est la visibilité (« voici ce qui est couvert, ce qui ne l'est
  pas, et pourquoi l'action du jour sert ton partiel »).
- Si A0.1 tranche pour une position plus large, une vue de couverture plus
  riche pourra être étudiée — hors périmètre de ce plan.

### A6. Tests

- Unitaires : extraction → validation → création ; refus bruyant des codes
  invalides ; facteur moteur (fenêtre, sources, hors fenêtre) ; archivage.
- Parcours : la boucle complète avec un engagement — déclaration →
  recommandation réordonnée → séance faite → observation → carte à jour ;
  vérifier qu'une séance ne produit toujours pas de double entrée au journal.
- RLS : un compte B ne lit jamais les engagements de A.

---

## Chantier B — La classe, sans nouvelle entité

**Position : ne pas créer d'entité « classe ».** Les thèmes persistants ont été
retirés (ADR-104) précisément contre ce genre d'objet ; le domaine existe déjà
et se gouverne. Ce chantier est **de l'UX pure** sur l'existant :

1. **Amorçage pluriel** (`formulaire-amorcage.tsx`) :
   - le champ « Le sujet à travailler » devient accueillant au pluriel :
     libellé « Vos sujets » ou « Ce que vous étudiez ce semestre », placeholder
     explicite (« Ex : macroéconomie, statistiques, développement web ») ;
   - la consigne du tuteur à l'amorçage (compte vide, pas de plafond) demande
     explicitement **une branche par sujet déclaré** — c'est déjà le cas en
     pratique, on l'affirme dans le prompt (`generation-referentiel.ts`).
2. **Corpus groupé** (`atelier/espace-documentaire.tsx`) : les fiches de type
   cours/support se regroupent visuellement par domaine (le rattachement
   existe en base via les liens de compétences / `domaineConnu` du rangement) ;
   l'entête de groupe porte le nom du domaine. Aucun changement de données.
3. **Vocabulaire** : ne jamais dire « classe » ni « cours » comme entité à
   l'écran — dire les noms des domaines de la personne. Le système n'affirme
   pas que « macroéconomie est une classe » ; il montre les fiches regroupées.

Ce qui reste **hors périmètre, sciemment** : calendrier/horaires/récurrence
hebdomadaire — c'est de la gestion de planning, hors boucle, à ne construire
que si un fait nouveau le justifie.

Test de réfutation inchangé (PRODUCT.md §4) : 10 preuves d'un compte tiers
sans assistance. Ce chantier ne prétend pas y suffire, il retire des frictions.

---

## Chantier C — Le PDF nourrit la boucle

### C0. Arbitrage préalable

Le tuteur peut-il **lire** le corpus déposé ? P5 reformulé (ADR-037) lui permet
d'écrire du contenu ; la lecture d'un document fourni par la personne pour
proposer des branches/exercices reste dans son rôle de contenu. Mais le coût
(extraction PDF, contexte LLM, fiabilité) et le risque (proposer des
compétences hors référentiel) imposent une décision explicite avant tout
chantier.

### C1. Périmètre minimal proposé (si C0 = oui)

Une seule valeur d'abord : **« Faire lire par le tuteur »** sur une fiche
support attachée à un PDF :

1. extraction texte côté serveur (pièce jointe existante, bucket
   `pieces-jointes`, ≤ 10 Mo) — aucune nouvelle entité, le texte extrait est
   un cache jetable rattaché à la fiche ;
2. le contenu extrait alimente la **proposition de branches** existante
   (`generation-referentiel.ts`) : le tuteur propose des compétences couvrant
   le document, l'écran de validation case par case existant
   (`modale-referentiel`) reste la seule écriture ;
3. ensuite, les fiches cours rattachées enrichissent déjà le classement
   (hypothèse documentaire, `recommend.ts`) — rien à ajouter.

UI : un bouton sobre sur la fiche, état d'avancement (extraction →
proposition → à valider), et **jamais** d'écriture silencieuse dans le
référentiel.

Hors périmètre de ce plan : lecture des PDFs hebdomadaires en continu,
résumés automatiques, ingestion de masse — sur-ingénierie tant que le premier
cas n'est pas démontré utile.

---

## Chantier D — Micro-frictions (petits chantiers autonomes)

| # | Friction | Correction proposée | Touché |
|---|---|---|---|
| D1 | Note créée via `+` naît transversale (`capture-intention.tsx:369`) | Quand la traduction du besoin vise des codes, proposer le domaine de ces compétences comme rattachement de la fiche — **proposé, confirmé**, jamais dérivé silencieusement (le défaut serait de deviner). À défaut de confirmation, rester transversal. | `capture-intention.tsx`, `creerNoteAction` |
| D2 | Amorçage singulier | Couvert par B.1 | `formulaire-amorcage.tsx` |
| D3 | Recherche du Cahier hors corpus | Ne pas construire maintenant : la recherche Corpus de l'Atelier couvre le besoin déclaré ; rouvrir si usage remonte. | — |

---

## Séquencement et mesure

```
Semaine 1   D1 (½ j)  →  B.1 + B.2 (1–2 j)
Parallèle   Arbitrages A0 + C0 (décision humaine, zéro code)
Si A0 = oui Semaine 2–3   A1 → A2 → A3/A4 (A5 après première mesure)
Si C0 = oui Après A       C1
```

Mesures post-chantier (à poser AVANT le code, sinon elles seront contées) :

- taux d'acceptation des actions recommandées pendant/hors fenêtre
  d'engagement (test de réfutation A2) ;
- part des notes créées via `+` rattachées à un domaine après D1 ;
- reprise du parcours persona : S5/S7/S8 passent-elles 🟡 ?

## Synchronisation documentaire (non négociable)

- A0.1 oui → reformulation immédiate de PRODUCT.md §2, même commit.
- A0.2 oui → nouvel ADR « l'engagement n'est pas un objectif » citant ADR-096,
  section Horizon de PRODUCT.md mise à jour, même commit.
- B → phrase « mes classes » de la simulation persona mise à jour.
- Toute migration → statut réel (appliquée/en attente) consigné où elle est
  décrite.
