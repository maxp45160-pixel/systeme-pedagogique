# Plan d'implémentation — Audit UX/UI du 21/08/2026

Source : audit par captures d'écran (desktop 1440 px + mobile 390 px) de toutes les
routes produit, croisé avec le graphe UX (`lib/domain/workflow-ux-scanner.ts`) et le
code. Les constats sont transformés ici en chantiers concrets, priorisés, avec
fichiers à toucher et critères d'acceptation.

Compte de test utilisé pour l'audit : `audit-ux@test.example.org` (admin).
À supprimer après le chantier P1 si plus utile.

---

## Vue d'ensemble

| # | Chantier | Priorité | Effort estimé |
|---|----------|----------|---------------|
| 1 | Échelle de superpositions + verrou tour/modale | P1 | 2–4 h |
| 2 | Parcours clé IA sans cul-de-sac | P1 | 1–2 h |
| 3 | Récupération de mot de passe (décision + implémentation ou documentation) | P1 | 0,5 j (si implémenté) |
| 4 | Mobile : débordements filtres Atelier + safe-area barre inférieure | P2 | 1 h |
| 5 | Garde sur les variantes d'URL (?document, ?session…) | P2 | 2–3 h |
| 6 | État actif du rail pour `/admin/*` | P2 | 30 min |
| 7 | Aération de `/aide` et `/demarrer` | P2 | 0,5–1 j |
| 8 | Contraste des textes discrets (audit tokens) | P3 | 2 h |
| 9 | CTA contextuels dans les vides (Atelier / Cahier) | P3 | 2 h |
| 10 | Désactivation du badge dev hors développement | P3 | 15 min |
| 11 | Unification du vocabulaire rail / titres / graphe | P3 | 1 h |

Ordre recommandé : 1 → 2 → 4 → 6 (quick wins à fort effet), puis 5, 7, puis le
reste. Le chantier 3 demande d'abord une décision produit (voir ci-dessous).

---

## P1

### 1. Échelle de superpositions et conflit tour / modale

> **Fait le 21/08/2026** (non commité à ce jour). Échelle `--superposition-*`
> ajoutée à `tokens.css` et documentée dans `docs/design/01-tokens.md` ;
> 13 surfaces converties (`ui/modale`, `guide-tour` avec suppression du
> `z-[101]`, `nav-mobile`, bouton flottant du tuteur, bandeau dev flottant,
> infobulle des graphiques, rideau + panneau latéral de l'Atelier,
> `coquille-workspace`, modale d'orientation profil, panneau et plein écran de
> séance, calendrier du cahier) ; verrou « un seul overlay » posé dans
> `fournisseur-intention.tsx`. Vérifié en conditions réelles : pendant le tour,
> `+` n'ouvre rien ; sans tour, la modale s'ouvre seule à z = 50.
> Les empilements purement locaux (panneaux absolus dans leur conteneur)
> restent volontairement inchangés.

**Constat.** Sur `/demarrer`, trois surfaces se superposent : le tour auto
(`components/onboarding/demarrer-tour.tsx`, backdrop `z-[100]`), la modale
d'intention (`components/ui/modale.tsx:229`, `z-50`) et la bannière clé IA
(`components/demarrer/formulaire-amorcage.tsx`). La fiche « Votre clé IA » flotte
au-dessus de la modale ; les deux backdrops se cumulent et rendent le contenu
illisible. Captures : `desktop-demarrer.png`, `desktop-modal-intention.png`.

**Cause racine.** Pas d'échelle de superpositions partagée : chaque surface
improvise sa couche (z-20/30/40/50/[100] relevés dans le code).

**Implémentation.**

1. Définir une échelle documentée dans `docs/design/01-tokens.md` et
   `app/src/app/tokens.css` :

   ```
   --z-sticky: 10;      /* en-têtes collants, barres internes */
   --z-dropdown: 30;    /* menus, calendriers, panneaux latéraux */
   --z-tiroir: 40;      /* tiroir tuteur, volets */
   --z-modale: 50;      /* modales pleines pages */
   --z-tour: 60;        /* guide tour au-dessus des modales */
   --z-toast: 70;       /* notifications, dernier mot */
   ```

2. Remplacer les valeurs littérales par ces tokens dans :
   - `components/ui/modale.tsx`
   - `components/onboarding/guide-tour.tsx` (lignes 202 et 255)
   - `components/tuteur/tiroir-tuteur.tsx` (ligne 36)
   - `components/layout/nav-mobile.tsx` (ligne 17)
   - `components/atelier/coquille-workspace.tsx`, `espace-documentaire.tsx`,
     `competences/graphe/panneau-reglages.tsx`, `seances/vue-seance-detail.tsx`,
     `profil/assistant-orientation-profil.tsx`, `charts/index.tsx`.
   Vérifier la compatibilité Tailwind v4 (`z-(--z-modale)` ou alias utilitaire).

3. Contrat « un seul overlay plein écran » : pendant qu'un tour est actif,
   désactiver l'ouverture de la capture d'intention. Point unique :
   `components/intention/fournisseur-intention.tsx` — `ouvrir()` refuse si un
   tour est actif (contexte onboarding déjà disponible).

**Critères d'acceptation.**

- Ouvrir `+` pendant le tour : soit impossible, soit la modale passe au-dessus.
- Jamais deux backdrops sombres cumulés visibles.
- `npm run verify` vert.

**Décision à valider avant code :** le tour doit-il rester au-dessus de tout, ou
céder devant les modales ? Recommandation : verrou simple (option retenue ici),
moins risquée qu'une réorganisation complète des calques.

### 2. Parcours clé IA sans cul-de-sac

> **Fait le 21/08/2026** — périmètre corrigé après vérification en conditions
> réelles : la bannière de `/demarrer` ouvre **déjà** un panneau de réglages en
> ligne (flux testé de bout en bout : panneau → enregistrement → stockage local
> isolé par compte → bannière verte). Le deep-link bannière → `/compte`
> prévu ici était donc caduque. Réalisé à la place :
> 1. `formulaire-amorcage` ne ferme plus le panneau au même tick que le message
>    de succès (il n'apparaissait jamais) ;
> 2. `/compte?onglet=<id>&retour=/chemin` : onglet initial validé par liste
>    blanche, retour validé anti open-redirect — la logique pure vit dans
>    `lib/domain/onglets-compte.ts`, partagée par la page (serveur) et le
>    panneau (client) ; un export d'un module `"use client"` appelé depuis le
>    rendu serveur casse la page (constaté puis corrigé) ;
> 3. après l'enregistrement d'une clé avec `retour=`, retour automatique à
>    l'endroit bloqué (`panneau-compte` → `router.push`) ;
> 4. le bandeau « Aucune clé API configurée » du chat tuteur propose un lien
>    réel vers `/compte?onglet=tuteur&retour=<chemin courant>` (l'instruction
>    textuelle seule est retirée).

**Constat.** La bannière « Clé IA non configurée (Mistral, Groq gratuit,
Anthropic) » est la surface la plus visible de `/demarrer` mais son action ne
mène nulle part de manière traçable : la saisie vit dans
`/compte` → onglet « Tuteur IA & Clé » (`components/tuteur/reglages-tuteur.tsx`),
sans lien depuis la bannière. L'utilisateur découvre le blocage au moment de
cliquer sur « Analyser mon besoin ».

**Implémentation.**

1. La bannière devient un lien/bouton vers `/compte?onglet=tuteur&retour=/demarrer`
   (le composant `Compte` gère déjà des onglets ; ajouter la lecture du paramètre
   `onglet` à l'entrée de page, comme le font les variantes connues du graphe).
2. À l'enregistrement réussi de la clé : retour automatique vers `retour=` si
   présent, formulaire d'amorçage conservé (il l'est déjà via l'état serveur).
3. Dans le chat tuteur et partout où une requête échoue faute de clé, même
   deep-link au lieu d'un message mort.
4. Mettre à jour l'étape 1 du tour (« Votre clé IA ») pour pointer vers la même
   destination.

**Critères d'acceptation.**

- Depuis `/demarrer` sans clé : deux clics maximum jusqu'au champ de saisie, puis
  retour automatique.
- Aucun chemin ne termine sur un message d'erreur sans issue.

### 3. Récupération de mot de passe — décision d'abord

> **Fait le 22/08/2026 (option A, tranchée par le titulaire).** Implémenté :
> `/auth/mot-de-passe-oublie` (demande → `resetPasswordForEmail`),
> `/auth/nouveau-mot-de-passe` (redéfinition → `updateUser` + révocation des
> autres sessions), lien « Mot de passe oublié ? » sous le formulaire de
> `/login`. Décision et politique écrites : ADR-100 + `PRODUCT.md §4`
> (« Comptes et accès »), même commit que le code.
> **Écarts au plan initial, vérifiés en écrivant** : (1) aucune route publique
> à ajouter — `PUBLICS` couvrait déjà `/auth/*` ; (2) le jeton ne se consomme
> pas sur la page de redéfinition : le lien repasse par `/auth/callback`
> (`suite=`), qui établit la session avant la page — un seul chemin d'échange
> PKCE pour inscription, Google et récupération ; (3) GoTrue **ne révoque pas**
> les autres sessions à `updateUser` — la révocation est explicite
> (`signOut({ scope: "others" })`, ADR-100 §4).
> **Reste ouvert (opérationnel, pas code)** : SMTP dédié à configurer sur le
> dashboard Supabase — identifiants dont seul le titulaire dispose. En l'état,
> le flux fonctionne mais subit la limite du SMTP intégré (~2 e-mails/h), qui
> s'applique aussi au lien de récupération lui-même.

**Constat.** La page `/login` n'affiche aucun lien « mot de passe oublié » et
aucune implémentation de réinitialisation n'existe dans le dépôt. Un compte créé
par e-mail/mot de passe est perdu si le mot de passe tombe.

**Décision produit préalable** (à trancher avant tout code, conformément aux
règles du dépôt) :

- **Option A — implémenter** : flow Supabase `resetPasswordForEmail` + page
  `/auth/reset`. Attention : le SMTP intégré de Supabase est fortement limité en
  débit (constaté pendant l'audit : rate limit au-delà de 2–3 e-mails/heure) ;
  configurer un SMTP dédié est quasi indispensable.
- **Option B — assumer l'absence** : l'écrire explicitement (FAQ du login ou
  `PRODUCT.md`) et prévoir un canal humain de réinitialisation (l'admin peut
  suspendre/supprimer, pas réinitialiser un mot de passe aujourd'hui — vérifier
  si `service_role` est disponible côté serveur pour un flux admin).

Si option A : pages `/login` (lien), `/auth/reset` (demande),
`/auth/nouveau-mot-de-passe` (confirmation via jeton d'URL), routes publiques à
ajouter à `PUBLICS` dans `app/src/proxy.ts`.

**Critères d'acceptation (A).** Perdre son mot de passe permet de le redéfinir
en < 5 minutes sans intervention humaine. **(B).** La politique est écrite et
visible depuis `/login`.

---

## P2

### 4. Mobile : débordements et safe-area

> **Fait le 21/08/2026** — la cause réelle était double : le groupe
> tri + statut (`flex items-center gap-2`) **et** son parent direct ne
> wrapquaient pas, rognés par la section `overflow-hidden`. Deux
> `flex-wrap` ajoutés dans `espace-documentaire.tsx` ; « Archivés » est
> désormais entièrement visible à 390 px (vérifié : bord droit 204 ≤ 390).
> Safe-area posée sur la barre inférieure (`pb-[env(safe-area-inset-bottom)]`)
> et le bouton flottant tuteur (`bottom-[calc(5rem+env(...))]`).

**Constat.** Sur 390 px : l'onglet « Archivés (0) » de l'Atelier est coupé à
droite (rangée de filtres trop large) ; la barre inférieure
(`components/layout/nav-mobile.tsx:17`, `fixed bottom-0`) n'a aucune marge
`safe-area-inset-bottom` (risque de chevauchement avec l'indicateur home iPhone).

**Implémentation.**

1. Rangée de filtres de l'Atelier (`components/atelier/vues-synthese-atelier.tsx`)
   : passer en `overflow-x-auto` avec `scroll-snap`, ou wrap autorisé. Ne pas
   masquer le compteur d'archives : il porte une information (invariant « une
   compétence avec preuves est archivée, jamais supprimée »).
2. Barre mobile : `padding-bottom: env(safe-area-inset-bottom)` sur le `nav`,
   et même traitement pour le bouton flottant tuteur
   (`components/tuteur/tiroir-tuteur.tsx:36`, `bottom-20` → inclure la variable).
3. Vérifier les autres éléments fixes bas : `dev/profil-flottant.tsx`.

**Critères d'acceptation.** À 360 px de large, aucun élément de contrôle tronqué ;
sur simulateur iPhone (encoche), la barre ne chevauche pas l'indicateur système.

### 5. Gardes sur les variantes d'URL

> **Fait le 22/08/2026 (vérification partielle)** — exploration ayant réfuté
> deux des trois constats : `?session` est vivant (la séance s'ouvre inline sur
> la page du jour, ADR-079, et l'URL est normalisée volontairement vers
> `?jour=` par la synchronisation du cahier interactif) ; `?note` a déjà sa
> garde `notFound()`. Le seul défaut réel était `?document` sans garde :
> corrigé dans `app/(app)/atelier/page.tsx` (`notFound()` sur identifiant
> inexistant, même motif que `?note`). Le graphe AST dérive les variantes des
> `searchParams` déclarés — il reflète déjà le produit.
> **Reste** : E2E de non-régression (session de test expirée + compte jetable
> supprimé → recréer un compte, tester `?document`/`?note` invalides → 404,
> puis supprimer).
>
> **Fait le 22/08/2026** — E2E exécuté avec un compte jetable
> (`mailer_autoconfirm` activé via Management API, compte créé, restauré à
> `false` immédiatement ; compte et traces (`profiles`, `comptes_acces`)
> purgés après test). Résultat : les deux gardes rendent bien l'écran 404
> custom `(app)/not-found.tsx`, jamais l'Atelier.
>
> **Nuance de contrat HTTP.** Le statut reste `200`, pas `404` :
> `(app)/loading.tsx` flushe le shell à 200 avant la résolution de la page, et
> un `notFound()` mid-stream ne peut plus modifier les en-têtes (doc embarquée
> `next/dist/docs/01-app/02-guides/streaming.md`, « Status codes »). Next
> injecte alors `<meta name="robots" content="noindex">`. C'est le comportement
> de **tous** les `notFound()` du groupe `(app)` (`admin`, séances, etc.), pas
> un défaut du garde. Un vrai statut 404 exigerait soit de retirer le
> skeleton de groupe (coût UX global), soit une vérification d'existence dans
> `proxy.ts` (duplications d'accès base à chaque ouverture de fiche) — arbitrage
> ouvert, non tranché, aucun des deux retenu par défaut.

**Constat.** Le graphe atomique connaît `page:/atelier?document`, `?note`,
`page:/seances?session`, etc., mais sans identifiant ces URL rendent l'écran de
base sans aucun feedback (`/atelier?document` = `/atelier` à l'identique) ;
`/seances?session` est silencieusement remplacée par `/seances?jour=…`.

**Implémentation.**

1. `/atelier?document|note` sans cible valide : état vide explicite
   (« Choisissez une fiche dans l'Atelier ») ou redirection propre vers `/atelier`
   — choisir une seule stratégie et l'appliquer aux deux paramètres.
2. `/seances?session` obsolète : rediriger explicitement vers le cahier plutôt
   que de laisser la substitution implicite, et retirer la variante du graphe si
   elle n'existe plus côté produit (synchronisation doc/graphe exigée par le
   dépôt).
3. Ajouter ces cas aux tests existants du scanner UX pour que graphe et produit
   ne divergent plus.

**Critères d'acceptation.** Aucune variante listée dans le graphe atomique ne
rend un écran identique à sa page de base sans explication visible.

### 6. État actif du rail pour `/admin/*`

> **Réfuté le 21/08/2026** — `estActif` applique déjà la règle préfixe
> (`navigation.ts:151-153`) et la documente comme voulue : « une route enfant
> active son entrée parente ». Surligner « Comptes et accès » sur
> `/admin/simulation` est donc correct — l'alternative serait qu'aucune entrée
> du rail ne soit active sur cette page (état orphelin pire). Rien à faire.

**Constat.** Sur `/admin/simulation`, le rail surligne « Comptes et accès » alors
que l'écran courant est Simulation. `aria-current` dit faux.

**Implémentation.** `estActif` (`components/layout/navigation.ts`) : matcher le
préfixe `/admin` pour l'entrée « Comptes et accès », comme le font probablement
les autres entrées pour leur sous-arbre. Vérifier le comportement symétrique
côté `nav-mobile`.

**Critères d'acceptation.** Sur toute route `/admin/*`, exactement une entrée de
rail active, la bonne, avec `aria-current="page"`.

### 7. Aération de `/aide` et `/demarrer`

> **Fait le 22/08/2026.** `/aide` : sommaire ancré sticky en tête de page
> (`#fonctionnement`, `#premiere-heure`, `#vocabulaire`, `#niveaux`, `#faq`),
> ancres partageables, portée `--superposition-collant` de l'échelle de
> superpositions, `scroll-mt` pour compenser le bandeau lui-même. Une seule
> des deux approches proposées retenue (sommaire, pas d'accordéons sur les
> étapes). Critère tenu : « Abandonner une séance ? » est à un clic du
> sommaire, depuis n'importe quel point de défilement. `/demarrer` : bloc
> « Ensuite » replié derrière un `<details>` sobre — wording inchangé, seul
> le conteneur change ; le tour guidé ne porte plus son récit en double.
> Wording pédagogique non touché, `PRODUCT.md` relire sans correction
> nécessaire : le parcours décrit ne change pas.

**Constat.** `/aide` : colonne unique très longue (5 étapes × 3 paragraphes +
vocabulaire + FAQ) — contenu bon, forme épuisante. `/demarrer` : « ÉTAPE 1 SUR
2 » + exemples + bloc « ENSUITE » (4 paragraphes) s'empilent avant toute action,
et cohabitent avec le tour qui raconte déjà la même chose.

**Implémentation.**

1. `/aide` : sommaire ancré sticky (ou accordéons par étape). Le contenu existe ;
   seul le conteneur change. Ancres profondes partageables.
2. `/demarrer` : replier « ENSUITE » derrière un `?` (le tour couvre ce récit) ;
   viser trois champs visibles max au premier écran. Ne pas toucher au wording
   pédagogique sans validation produit.
3. Relire `PRODUCT.md` après chantier (règle de synchronisation documentaire) si
   le parcours décrit change.

**Critères d'acceptation.** Depuis `/aide`, atteindre « Abandonner une séance »
en ≤ 2 interactions. Sur `/demarrer`, le formulaire principal tient au-dessus de
la ligne de flottaison à 1440×900.

---

## P3

### 8. Audit de contraste des textes discrets

> **Fait le 22/08/2026.** Script de mesure `app/scripts/contraste.ts` (parse
> `tokens.css`, résout les chaînes `var()` par thème avec la cascade réelle —
> `:root` s'applique aux deux thèmes —, calcule WCAG 2.1) + test verrou
> `src/lib/ui/contraste.test.ts`. 22 paires consommées × 2 thèmes.
>
> **Un seul défaut réel trouvé** : `--rail-texte-discret × --rail` à 4,07:1
> (#7f9585). Corrigé au niveau primitive : #8ba091 → 4,69:1 sur `--rail`,
> 5,40:1 sur `--rail-2`, hiérarchie préservée sous `--rail-texte-attenue`
> (6,52:1). Toutes les autres paires passaient déjà, y compris
> `--bordure-controle × --surface` (3,57 / 3,36 ≥ 3:1) et
> `--texte-discret × --surface-2`, la paire la plus juste (4,54 clair).
> Valeurs finales documentées dans `docs/design/01-tokens.md`.

**Constat.** Plusieurs libellés secondaires (descriptions, placeholders,
« Rien en marge… ») paraissent sous les 4,5:1 visés par `docs/design/01-tokens.md`
en thème sombre.

**Implémentation.** Script de mesure sur les paires token réellement consommées
(`--texte-discret` × `--surface`, etc.) dans les deux thèmes ; corriger les rampes
primitives fautives (jamais les composants). Vérifier les contours interactifs à
3:1. Documenter les valeurs finales dans `01-tokens.md`.

**Critères d'acceptation.** Toutes les paires rôle/fond ≥ 4,5:1 (texte) et 3:1
(contours), mesurées, pas estimées, dans les deux thèmes.

### 9. CTA contextuels dans les vides

> **Fait le 22/08/2026.** `RappelNouveauBesoin` (exporté de
> `components/intention/bouton-intention.tsx`) : une ligne sobre — icône SVG
> du jeu existant + « Appuyez sur **Nouveau besoin** pour démarrer » — où le
> mot « Nouveau besoin » est lui-même le déclencheur (`useIntention().ouvrir()`,
> instance unique, aucune duplication du mécanisme). Posé dans les deux vides :
> Atelier sans domaine actif (au-dessus de la carte de création, conservée) et
> Cahier sans séance (sous l'état vide, hors cas recherche). Pas d'emoji.

**Constat.** Atelier et Cahier vides proposent une carte unique mais ne rappellent
pas le geste primaire du funnel (`+` → intention).

**Implémentation.** Dans chaque état vide, une ligne sobre : « Appuyez sur
Nouveau besoin (ou +) pour démarrer » avec lien déclenchant la capture
d'intention (même mécanique que `BoutonIntention`, réutilisée, pas dupliquée).
Pas d'emoji ; icônes du jeu existant (`components/ui/icones.tsx`).

**Critères d'acceptation.** Depuis n'importe quel vide, l'utilisateur voit le
geste d'entrée du funnel et peut le déclencher localement.

### 10. Badge dev hors développement

> **Fait le 22/08/2026.** Convention vérifiée dans la doc embarquée
> (`node_modules/next/dist/docs/.../devIndicators.md`) : l'indicateur n'est
> rendu qu'en `next dev` — `npm run build && npm start` n'en affiche déjà
> aucun. `devIndicators: false` posé en plus pour le retirer aussi des
> captures/démos sur serveur de développement (il chevauchait « Bord » sur
> mobile) ; les overlays d'erreur restent actifs.

**Constat.** Le badge Next.js DevTools (« N » noir) apparaît dans toutes les
captures et démos ; il chevauche « Bord » sur mobile.

**Implémentation.** Désactiver l'indicateur hors `next dev` (variable
d'environnement / config Next 16 selon la doc embarquée
`node_modules/next/dist/docs/`). Vérifier la convention exacte de cette version
avant d'écrire le code.

**Critères d'acceptation.** `npm run build && npm start` n'affiche aucun badge.

### 11. Unification du vocabulaire

> **Fait le 22/08/2026.** Source de vérité retenue : les libellés du rail —
> c'est ce que l'utilisateur lit en permanence. Aligné : le graphe macro
> `workflow-ux-scanner.ts` nomme `/seances` « Cahier » (était « Séances &
> Concepteur ») et `/admin` « Comptes et accès » ; la page `/admin`
> elle-même aligne son titre visible, sa metadata, l'aria-label de navigation
> et le lien retour de `/demarrer?apercu=1` sur la même entrée de rail
> (« Cockpit d'Administration/Administrateur » retiré des surfaces lisibles).
> `graphe-workflow.tsx` (groupe `seances`) suit. Les identifiants de code
> (`ConcepteurSeance`, `CockpitAdmin`) restent : ils ne sont pas lus par
> l'utilisateur. Aucun test à mettre à jour : le scanner dérive ses nœuds,
> aucun libellé codé en dur n'était asserté.

**Constat.** Le rail dit « Cahier », le titre de page aussi, mais le graphe macro
nomme le pôle « Séances & Concepteur » ; « Comptes et accès » (rail) vs
« Cockpit d'Administration » (page). Une chose, plusieurs mots selon la couche.

**Implémentation.** Table de correspondance terme officiel ↔ synonymes graphe ;
aligner les libellés des nœuds `workflow-ux-scanner.ts` sur ceux de l'UI (ou
l'inverse — choisir une source). Mise à jour des tests du scanner si les
libellés changent.

**Critères d'acceptation.** Un concept = un libellé utilisateur partout ;
le graphe utilise le même vocabulaire que l'interface.

---

## Nettoyage post-chantier

- [ ] Supprimer le compte de test `audit-ux@test.example.org` (visible dans le
      cockpit admin depuis le 21/08/2026) ou le garder comme fixture documentée.
- [ ] Vérifier que `mailer_autoconfirm` est bien resté à `false` côté projet
      Supabase (restauré lors de l'audit, à re-vérifier avant merge).
- [ ] Captures de référence refaites après P1/P2 pour mesurer l'écart
      (même protocole : headless Chrome + injection cookie `sb-*-auth-token`).

## Règles du dépôt à respecter pendant l'exécution

- Toute décision qui retire ou contredit un contrat existant met à jour
  `PRODUCT.md` / `ARCHITECTURE_DECISIONS.md` dans le même commit.
- Pas d'emoji dans le frontend (icônes SVG uniquement).
- Logique métier non triviale dans `lib/`, pas dans les composants.
- Ne rien stocker de dérivable ; ne pas créer d'entité nouvelle pour ces
  chantiers — tous sont UI/interaction pure, sauf l'option A du chantier 3.
