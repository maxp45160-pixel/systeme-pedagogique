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

**Constat.** Sur `/admin/simulation`, le rail surligne « Comptes et accès » alors
que l'écran courant est Simulation. `aria-current` dit faux.

**Implémentation.** `estActif` (`components/layout/navigation.ts`) : matcher le
préfixe `/admin` pour l'entrée « Comptes et accès », comme le font probablement
les autres entrées pour leur sous-arbre. Vérifier le comportement symétrique
côté `nav-mobile`.

**Critères d'acceptation.** Sur toute route `/admin/*`, exactement une entrée de
rail active, la bonne, avec `aria-current="page"`.

### 7. Aération de `/aide` et `/demarrer`

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

**Constat.** Atelier et Cahier vides proposent une carte unique mais ne rappellent
pas le geste primaire du funnel (`+` → intention).

**Implémentation.** Dans chaque état vide, une ligne sobre : « Appuyez sur
Nouveau besoin (ou +) pour démarrer » avec lien déclenchant la capture
d'intention (même mécanique que `BoutonIntention`, réutilisée, pas dupliquée).
Pas d'emoji ; icônes du jeu existant (`components/ui/icones.tsx`).

**Critères d'acceptation.** Depuis n'importe quel vide, l'utilisateur voit le
geste d'entrée du funnel et peut le déclencher localement.

### 10. Badge dev hors développement

**Constat.** Le badge Next.js DevTools (« N » noir) apparaît dans toutes les
captures et démos ; il chevauche « Bord » sur mobile.

**Implémentation.** Désactiver l'indicateur hors `next dev` (variable
d'environnement / config Next 16 selon la doc embarquée
`node_modules/next/dist/docs/`). Vérifier la convention exacte de cette version
avant d'écrire le code.

**Critères d'acceptation.** `npm run build && npm start` n'affiche aucun badge.

### 11. Unification du vocabulaire

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
