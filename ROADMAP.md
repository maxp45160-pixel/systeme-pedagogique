# ROADMAP.md — Système pédagogique

**Version 1.0 — 27/07/2026.**

Cette feuille de route est **ordonnée par contrainte réelle**, pas par envie.
Chaque entrée porte son statut, et les statuts ont un sens strict (voir
`PRODUCT_VISION.md`).

> ⚠️ **Un seul fait commande cette feuille de route.**
> Il reste **3 exercices** (`diag-prod-03`, `diag-algo-05`, `diag-tech-01`) et
> **0 exercice créé**. 31 compétences sur 43 n'ont aucun support de travail.
> À partir de la 4ᵉ recommandation, l'application n'a plus rien à proposer.
> Tout ce qui passe avant la résolution de ce point retarde le moment où
> l'application cesse de fonctionner.

---

## Maintenant — débloquer le contenu

### R1 · Rendre le moteur du tuteur configurable ✅ décidé (ADR-007)

**Pourquoi en premier.** C'est le préalable technique de R2 : sans moteur en
service, la boucle exercice ne peut être ni essayée ni mesurée.

**Ce que c'est.** Extraire l'appel modèle de `app/api/tutor/route.ts` derrière
une interface unique, choisie par variable d'environnement — même patron que
`lib/store/db.ts` pour les données. Le contexte, le parseur, le chat et la
validation humaine ne changent pas.

**Trois moteurs prévus.** Anthropic (existant, payant) · compatible OpenAI
(paliers gratuits — Groq, OpenRouter, Mistral… un seul module en `fetch`,
**aucune dépendance nouvelle**) · aucun → repli « copier le contexte » déjà
construit.

**Critère d'acceptation d'un moteur gratuit** — le test de réfutation d'ADR-007 :
10 échanges réels, **au plus une** violation de protocole.

---

### R2 · Fermer la boucle tuteur → exercice ✅ décidé (ADR-004)

**Pourquoi.** Sans elle, l'application n'a plus rien à proposer après
3 exercices.

**Ce que c'est.** La symétrie exacte de la boucle de preuves, qui existe déjà
et fonctionne : gabarit structuré → parseur → formulaire pré-rempli →
validation humaine → écriture. Le patron est écrit et testé
(`lib/tutor/proposition.ts`, 47 lignes) ; `Exercise.origine: "tuteur"` est déjà
déclaré dans le type et inatteignable dans le code.

**Ne comprend pas.** La génération automatique d'exercices sans validation.
Contraire à P5.

---

## Ensuite — corriger avant de multiplier

### R3 · Traitement des compétences non mesurées dans le score ❓ ouvert (ADR-006)

Le score global affiche **10/100** en comptant 31 compétences non mesurées
comme des zéros, ce que le principe P2 interdit. Coût de correction
aujourd'hui : faible. Coût après généralisation : un changement visible par
tous les utilisateurs.

**Recommandation :** traiter avant R7. **Non décidé.**

### R4 · Aide externe dans la mesure d'autonomie ❓ ouvert (ADR-008)

Des preuves enregistrées **A3 « résolution autonome »** portent des
commentaires disant explicitement qu'une aide externe a été utilisée. Le
moteur ne peut pas lire ces commentaires. Touche P8, le principe d'entrée de
toute la chaîne.

**Si retenu :** amender aussi le protocole d'évaluation §5, conformément à P6
(protocole et code ne divergent jamais).

**Non décidé.**

### R5 · Performance — déduplication des appels d'authentification 🔬 hypothèse

**Diagnostic** (`ETAT_DES_LIEUX_2026-07-27.md` §7.1, chemin d'appel vérifié) :
`lireTout()` appelle `lire()` 10 fois ; chaque `lire()` refait
`dorsaleCompte()` → `compteCourant()` → `auth.getUser()`. Avec le proxy :
**11 appels réseau d'authentification par page.**

**Correctif pressenti :** `cache()` de React sur `compteCourant` et
`createServeurClient` — une dizaine de lignes.

**Pourquoi 🔬 et non ✅ :** aucune mesure de performance réelle n'a été faite.
Le chemin d'appel est certain, le gain ne l'est pas.
**Test :** mesurer le temps de réponse serveur avant / après.

### R6 · Édition du profil utilisateur 🔬 hypothèse (pré-requis de R7)

Les colonnes `formation`, `objectifMoyenTerme`, `objectifLongTerme`,
`preferencesPedagogiques` existent en base ; **rien dans l'interface ne les
renseigne**. Deux des trois comptes affichent « Formation à renseigner ».

Petit, sans risque, et bloquant pour tout diagnostic initial personnalisé.

---

## Chantier de fond — pas avant que ce qui précède soit stabilisé

### R7 · Généralisation du référentiel + diagnostic initial ❓ ouvert (ADR-009)

Les points 8 et 9 de `CLAUDE.md` §5 sont **un seul chantier**.

**Volontairement reporté.** Généraliser maintenant figerait trois modèles non
validés : granularité du référentiel, calcul du score (R3), barème de
recommandation (ADR-005).

**Ordre imposé :** R1 → R3 → R7. R1 est un **prérequis technique** : un
référentiel de droit ou d'informatique n'aura jamais d'exercices écrits à la
main.

**À produire avant de coder :** une spécification qui tranche explicitement
entre les options A / B / C d'ADR-009.

---

## Chantier UI — utile, non urgent

Ces points viennent de `CLAUDE.md` §5. **Vérification faite dans le code au
27/07, plusieurs sont plus petits qu'annoncé** :

| # | Demande | État réel vérifié | Reste à faire |
|---|---|---|---|
| 4 | Réduire boutons / filtres / doublons | La navigation est **déjà** réorganisée en « Travailler » / « Suivre », et les écrans « Bientôt » sont **déjà** relégués en section discrète (`navigation.ts`) | Dédoublonner les filtres entre pages |
| 5 | Emplacement du radar et de l'arbre | Radar et arbre **existent déjà** comme sélecteur à 3 vues sur `/competences` | Décider si c'est le bon endroit — question de design, pas de construction |
| 6 | Flèches ouvrir/fermer les sections compétences | **Pas fait.** `/competences/page.tsx` n'a aucune section repliable | Réutiliser `<Depliant>` (`ui/explication.tsx`), déjà employé à 6 endroits |
| 7 | Polish général UI/UX | — | À traiter comme un seul chantier avec 4, 5, 6 |

🔬 **Hypothèse de séquencement :** faire R5 (performance) avant le chantier UI.
Une interface rapide paraît meilleure qu'une interface repensée mais lente.
Non vérifié.

---

## Reporté, avec condition de déclenchement explicite

Ces éléments **ne sont pas abandonnés**. Ils attendent un fait, pas une envie.

| Élément | Statut | Se déclenche quand… |
|---|---|---|
| **Relance interne des compétences anciennes** (`CLAUDE.md` §5-10) | ❓ reporté | R1 est fait et le corpus dépasse ~30 exercices. Le moteur sait déjà calculer l'ancienneté (`engine/dates.ts`, `historique.ts`) — la matière existe |
| **Export `.ics` / Google Calendar** | ❓ reporté | La relance interne existe **et** est ignorée en pratique. Alors seulement l'export `.ics` (un fichier, zéro OAuth) se justifie. Google Calendar reste hors de portée : OAuth, jetons, synchronisation bidirectionnelle |
| **Recherche d'exercices** (§5-11) | ❓ reporté | Le corpus dépasse ~50 exercices. Il en compte 11 |
| **Système d'amis** (§5-12) | ❓ reporté | Après R7. Comparer des progressions n'a de sens qu'entre profils partageant un référentiel. Tension avec le principe fondateur à documenter avant, pas pendant : opt-in, par compétence, **jamais de classement** |
| **Écrans Projets / Lectures / Connaissances** (§5-13) | ❓ reporté | Un projet réel ou une lecture en cours existe et doit être suivi. Pas avant — construire par anticipation contredit P7 |
| **Restriction du widget TODOs dev** (ADR-010) | ❓ reporté | Un utilisateur tiers réel existe. **3 comptes existent déjà** : à confirmer par Maxime |
| **Outil de migration de schéma** (ADR-012) | ❓ reporté | Avant le premier changement de schéma destructif sur données existantes |

---

## Abandonné

🗑️ **Geler le développement pour n'utiliser que l'application.**
Proposé le 27/07, écarté le jour même par Maxime : le temps disponible permet
de mener les deux de front, et voir l'outil évoluer fait partie de la
motivation. **Les données confirment qu'il n'y a pas eu d'éviction** —
4 séances de travail le 27/07 (07:46, 08:53, 10:16, 15:02), le jour même où
l'application était modifiée. Ne pas reproposer sans fait nouveau.

🗑️ **Écrire des exercices seed supplémentaires à la main.**
Remplacé par ADR-004.

🗑️ **Dépendre de l'API Anthropic payante pour le tuteur.**
Écarté par la contrainte de gratuité du 27/07. Le code existant
(`app/api/tutor/route.ts`) reste correct et peut demeurer en place comme
chemin optionnel — mais il ne peut plus être le chemin nominal.

🗑️ **Implémenter tous les écrans « bientôt » par anticipation.**
Contredit P7 et triplerait la surface de l'application sans besoin établi.
Reformulé en condition de déclenchement ci-dessus.

---

## Ce que cette feuille de route ne dit pas

Elle ne fixe **aucune date**. Le projet a trois jours d'existence, un
utilisateur actif et un rythme de travail qui n'est pas encore mesurable.
Fixer des échéances maintenant produirait de la fiction.

Elle ne classe pas non plus les éléments par difficulté : à ce stade, la seule
hiérarchie qui compte est **ce qui débloque le reste** — R1 et R2 — et **ce qui
coûte plus cher si on le repousse** — R3 et R4.
