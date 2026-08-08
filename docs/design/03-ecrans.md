# Patterns d'écran — Phase 3 (spec)

Spécification **avant implémentation**. Aucun code n'est modifié par ce
document ; il est le contrat que l'implémentation devra tenir, écran par écran.

Chaque écran est spécifié sur six axes : **layout · breakpoints · jetons ·
états · motion · ordre de focus**.

Périmètre inchangé depuis la phase 2 : tout `src/` **sauf**
`src/components/dev/**` (outillage hors produit, ADR-019).

---

## 0. Trois faits qui corrigent la consigne

Vérifiés par lecture du code au moment d'écrire, pas supposés.

**Le radar n'est pas sur la page d'accueil.** `app/(app)/page.tsx` n'importe
rien de `charts/`. `Radar` a un seul site de rendu —
`competences/domaine/[id]/page.tsx:150` — et y reçoit **un axe par compétence**
du domaine. Son `aria-label` annonce pourtant « Radar des domaines »
(`charts/index.tsx:367`) : le libellé décrit une donnée qu'aucun appelant ne
lui passe.

**Il n'existe pas de palier tablette.** Décompte des préfixes responsives dans
`src/**/*.tsx` hors `dev/` : **29 `lg:`, 10 `sm:`, zéro `md:`, zéro `xl:`**. Le
choix de spécifier deux paliers n'est pas un confort — c'est la description de
ce que l'application est.

**Les filtres ne s'ajoutent pas.** CLAUDE.md l'interdit pour la liste
d'exercices, et la règle est recopiée dans le source
(`exercices/page.tsx:236-243`). « Filtres définis à un seul endroit et partagés
entre pages » se lit donc : **factoriser le composant écrit trois fois**, sans
toucher au nombre d'axes filtrables.

---

## 1. Les deux paliers (transverse)

| Palier | Borne | Ce qui change |
|---|---|---|
| **Compact** | `< 1024px` (défaut) | Barre haute mobile (`h-12`), barre basse fixe, contenu `px-4` puis `sm:px-6`, `pb-24` pour dégager la barre basse |
| **Étendu** | `≥ 1024px` (`lg:`) | Rail collant à gauche (240 px, ou 64 px replié via `data-rail`), filet de marge `lg:border-l`, contenu `lg:px-10 lg:pl-10` |

`sm:` (640px) n'est **pas** un palier de navigation : il ne sert qu'à passer les
grilles de contenu de 1 à 2 colonnes. Il ne change ni le chrome, ni la
navigation, ni aucun ordre de focus.

Le rail replié est piloté par un attribut posé sur `<html>` **avant peinture**
(`app/layout.tsx:29`), pas par un état React — c'est ce qui garantit qu'un
rechargement en mode réduit n'affiche jamais, même une image, un rail à sa
largeur pleine. Toute spec qui toucherait au rail doit préserver cette
propriété.

---

## 2. Shell de navigation

### Constat

Les destinations vivent dans un seul fichier (`components/layout/navigation.ts`)
— mais y sont **écrites deux fois** :

- `NAVIGATION` (`:38-58`) — groupée en trois pôles, consommée par le rail ;
- `NAV_MOBILE` (`:64-68`) — plate, consommée par la barre basse.

Les trois entrées de `NAV_MOBILE` sont une recopie littérale des `entrees` de
`NAVIGATION` : mêmes `href`, `libelle`, `court`, `icone`. Ajouter une
destination demande aujourd'hui d'éditer les deux exports, et rien ne signale
l'oubli.

Trois autres écarts, tous dans `nav-mobile.tsx` :

| Écart | Ligne | Conséquence |
|---|---|---|
| `grid-cols-5` pour 3 entrées | `:14` | Les items occupent 3/5 de la barre, 2/5 restent vides |
| JSDoc « les cinq destinations » | `:8` | Le commentaire décrit un état antérieur |
| `pathname.startsWith(e.href)` sans frontière | `:16` | Diverge de `estActif` (`sidebar.tsx:10-13`) qui borne avec `` `${href}/` `` |

Le troisième est **latent, pas actif** : aucune route existante ne déclenche
l'écart. Il piège la prochaine — une route `/exercices-archives` s'afficherait
active sur mobile et inactive sur desktop.

### Layout

Inchangé. Rail à gauche en étendu, barre basse en compact, contenu au centre.
La spec ne redessine pas le shell : elle en supprime la duplication.

### Ce que l'implémentation doit tenir

- `NAV_MOBILE` **dérivé** de `NAVIGATION` (`flatMap` sur les `entrees`), plus
  recopié. Une seule liste éditable.
- Grille de la barre basse alignée sur le nombre réel d'entrées.
- `estActif` **exporté depuis `navigation.ts`** et employé par les deux barres.
  Une seule définition de « cette destination est la page courante ».
- JSDoc corrigé.

### Sélecteur segmenté partagé

Trois copies visuellement identiques — même conteneur
(`rounded-md border border-bordure p-0.5`), même item
(`rounded px-2.5 py-1 text-xs font-medium transition-colors`), même actif
(`bg-primaire-faible text-primaire`) :

| Copie | Fichier | Mode | État |
|---|---|---|---|
| Bascule de vue | `competences/page.tsx:56-71` | `<Link>` | URL `?vue=` |
| Période | `panneau-progression.tsx:47-66` | `<Link>` | URL `?periode=` |
| Apparence | `compte.tsx:602-630` | `<button aria-pressed>` | `useState` + `localStorage` |

**Les deux modes doivent survivre.** Un sélecteur qui pilote une vue partageable
doit rester un lien (bookmarkable, ouvrable dans un onglet) ; un sélecteur de
préférence locale doit rester un bouton. Forcer les trois dans un seul mode
casserait l'un ou l'autre. Le composant partagé porte donc **l'habillage et les
états**, et laisse l'élément au choix de l'appelant — même principe que
`classesLienBouton` en phase 2.

Manque à corriger au passage : les deux variantes `<Link>` n'ont **aucun**
`aria-current` ni `aria-pressed`. Seule la variante bouton annonce son état.

### États

| État | Applicable | Mécanisme |
|---|---|---|
| default / actif | oui | `aria-current="page"` (nav), `aria-pressed` ou `aria-current` (segmenté) |
| hover | oui | déjà présent, inchangé |
| focus | oui | **aucune classe** — règle globale `:focus-visible` |
| rail replié | oui | `data-rail="reduit"`, `aria-label` conservés (`sidebar.tsx:53-54`) |
| chargement / erreur / vide | sans objet | la navigation est statique : ses destinations ne se chargent pas et ne peuvent pas être vides |

### Motion

`--duree-vive` (150 ms) + `--courbe-standard` sur les changements de couleur des
items. La largeur du rail est une transition CSS pure, sans état React.
Rien d'autre ne bouge dans le shell.

### Ordre de focus

1. Rail (étendu) : bascule de réduction → groupes dans l'ordre `NAVIGATION` →
   pied de compte.
2. Barre haute (compact) : nom → compte.
3. Contenu principal.
4. Barre basse (compact) : entrées dans l'ordre.

La barre basse **après** le contenu est délibéré : au clavier, on traverse ce
qu'on est venu lire avant d'atteindre la navigation secondaire.

### Bug à corriger dans le même lot — 4 liens morts

`type Vue` n'accepte que `accueil | progression | journal`
(`competences/page.tsx:30`) et le parse retombe silencieusement sur `accueil`
(`:42-47`). Quatre liens vivants pointent ailleurs :

| Lien | Fichier |
|---|---|
| `?vue=gerer` | `app/(app)/profil/page.tsx:35` |
| `?vue=gerer` | `components/layout/compte.tsx:275` |
| `?vue=gerer` | `app/(app)/competences/referentiel/page.tsx:11` (cible d'un `redirect`) |
| `?vue=grille` | `components/suivi/panneau-progression.tsx:254` |

Les trois premiers promettent « gérer le référentiel » et livrent la vue par
défaut. Un repli silencieux sur une valeur inconnue est exactement le
comportement que le reste du produit refuse : la spec impose que le parse
**nomme** ce qu'il ne sait pas lire, ou que les liens pointent vers une
destination réelle.

---

## 3. Écran d'exercice

### Constat

Jusqu'à **~15 blocs en concurrence**. Dans la phase « correction visible +
réponse écrite », sont vivants **au même instant** : la zone de réponse, son
bouton d'enregistrement, le tiroir tuteur, le déblocage d'indice, la correction
complète, et un formulaire de bilan à six sections.

Trois messages pédagogiques distincts s'y disputent l'attention : l'économie
d'indices, le palier d'autonomie, et le moment de révéler la solution.

### Layout — trois actes

Un exercice a trois temps : **chercher**, **comparer**, **mesurer**. Aujourd'hui
les actes 2 et 3 s'empilent sur l'acte 1 sans jamais le retirer.

| Acte | Vivant | Replié | Action principale |
|---|---|---|---|
| **Chercher** | énoncé, données, zone de réponse | indices, tuteur | « Afficher la correction » |
| **Comparer** | énoncé, correction | réponse (rappel), indices, tuteur | « Passer à l'auto-évaluation » |
| **Mesurer** | formulaire de bilan | énoncé, correction, réponse | « Enregistrer la preuve » |

**L'énoncé reste toujours atteignable.** C'est le contexte, pas une action :
replié aux actes 2 et 3, jamais supprimé. Mesurer sa compréhension sans pouvoir
relire la question serait un piège, pas une épuration.

Le repli emploie `TiroirRepliable` (phase 2) — rien de neuf à construire.

### Breakpoints

Compact : un seul flux vertical, l'acte courant occupe la largeur. Étendu :
identique — cet écran n'a jamais eu de colonnes et n'en gagne pas. La
concentration recherchée est verticale, pas horizontale. La largeur reste
plafonnée (`max-w-3xl`, actuel).

### Jetons

- Espacement entre actes : échelle 4 px, `space-y-4` inchangé.
- L'action principale de chaque acte : `Bouton variante="principal"`. Les
  actions secondaires : `variante="secondaire"` ou `"discret"`. **Un seul
  bouton `principal` visible par acte** — c'est la règle qui rend « une idée
  par écran » vérifiable.
- Bandeaux de résultat : `BandeauInfo` `ton="succes"` / `"info"` (phase 2).
- Repli : `TiroirRepliable`.

### États — feedback immédiat

**Trois formulaires d'action serveur n'ont aucun état d'attente** — vérifié :

| Action | Ligne | Manque |
|---|---|---|
| Commencer | `:265-270` | pas de `disabled`, pas d'indicateur |
| Débloquer l'indice | `:364-368` | idem |
| Refaire cet exercice | `:516-520` | idem |

Aucun `useFormStatus` n'existe dans tout le dépôt (grep : zéro occurrence). Ces
trois boutons sont **double-soumettables** : un double-clic sur « Commencer »
lance deux tentatives. `Bouton enChargement` existe depuis la phase 2 et n'a que
trois appelants, tous ailleurs.

La spec impose : tout bouton qui déclenche une écriture serveur porte un état
d'attente. Pour une action serveur, cela demande un composant client mince
autour du `<button type="submit">` (`useFormStatus` vit dans l'enfant du
`<form>`, pas dans le formulaire lui-même).

| État | Applicable | Mécanisme |
|---|---|---|
| default | oui | acte courant, action principale unique |
| chargement | **oui, manquant aujourd'hui** | `Bouton enChargement` sur les 3 formulaires |
| erreur | oui | `BandeauInfo ton="danger"`, déjà en place pour le bilan et l'abandon |
| vide | sans objet | un exercice a toujours un énoncé — un exercice sans énoncé est une erreur de données, pas un état vide |
| terminé | oui | acte « mesurer » clos : correction + réponse d'alors + « Refaire » |

### Bandeaux de résultat

`?bilan=1` et `?abandon=1` (`:106-189`) empilent aujourd'hui leur contenu
**au-dessus** de tout, poussant l'exercice sous la ligne de flottaison, et
ajoutent chacun deux liens concurrents. Rien n'empêche `?bilan=1&abandon=1` de
rendre les deux — deux verdicts contradictoires sur le même écran.

Spec : un seul bandeau de résultat possible à la fois, et il appartient à
l'état « acte 3 clos », pas à une couche flottante au-dessus des trois actes.

### Motion

- Dépliage/repliage d'un acte : `--duree-moyenne` (250 ms) + `--courbe-sortie`.
- Changement d'état d'un bouton : `--duree-vive` (150 ms).
- Aucune animation sur l'apparition du bandeau de résultat : il annonce une
  écriture déjà faite, l'animer suggérerait qu'elle est en cours.

`prefers-reduced-motion` est déjà désarmé globalement dans `globals.css` — les
jetons de durée n'ont pas à s'en préoccuper individuellement.

### Ordre de focus

Par acte, invariablement : **contexte → action principale → actions repliées**.

L'action principale précède les replis. Au clavier, on atteint « Afficher la
correction » avant « Débloquer un indice » — l'ordre de tabulation encode la
hiérarchie que l'écran affirme visuellement.

Au passage d'un acte au suivant, le focus va au **titre du nouvel acte**, pas
au premier champ : annoncer où l'on vient d'arriver précède la possibilité
d'agir.

---

## 4. Radar de synthèse

### Disposition retenue

**Radar inter-domaines en tête de `?vue=progression`, un axe par domaine.**

Source de données : `ctx.global.parDomaine`, dont la forme a été vérifiée —
`{ domaine, nom, score: number | null, competencesEvaluees, competencesTotal,
preuves }`. C'est déjà exactement `AxeRadar { libelle, valeur }`, et `score`
est déjà sur 100. Aucune transformation, aucun calcul nouveau : la donnée
existe et sert déjà aux sparklines du même panneau
(`panneau-progression.tsx:238`).

**Pourquoi là.** Le radar répond « où suis-je fort ou faible **en ce
moment** ». La courbe répond « comment cela a bougé ». Le premier ouvre le
panneau, la seconde suit — on situe avant de raconter l'évolution.

Le radar par compétence **reste** sur la page domaine : à ce niveau, comparer
les compétences entre elles est la bonne question. Les deux radars coexistent
avec deux jeux d'axes différents, ce qui est légitime tant que chacun le dit.

### Layout

Ordre du panneau `?vue=progression` après la spec :

1. **Radar de synthèse** (nouveau) — où j'en suis, tous domaines confondus
2. Bilan de la période (existant)
3. Progression globale dans le temps (existant)
4. Par domaine — sparklines (existant)
5. Régularité de travail (existant)
6. Ce que ces chiffres ne disent pas (existant)

### Breakpoints

Le radar est plafonné à `taille` px et centré (`className="mx-auto"`,
`maxWidth: taille`) : il rétrécit sous cette borne mais ne grandit jamais.

| Palier | Taille |
|---|---|
| Compact | pleine largeur disponible, plafonnée à 260 px |
| Étendu | 320 px, centré dans sa carte |

### États

| État | Applicable | Mécanisme |
|---|---|---|
| **moins de 3 domaines mesurés** | **oui — le cas qui compte** | Un radar à 2 axes est un segment, à 1 axe un point : illisible. Sous 3 domaines mesurés, on **ne trace pas** et on laisse les sparklines déjà présentes faire le travail. |
| domaine sans preuve | oui | Tracé à zéro, point creux (`charts/index.tsx:398-399`) |
| aucune preuve du tout | oui | Le panneau entier retombe sur son `EtatVide` existant (`panneau-progression.tsx:108-116`) — le radar n'a pas à gérer ce cas |
| chargement | oui | Hérité du `<Suspense>` de `competences/page.tsx:76` |
| erreur | sans objet | Le radar ne charge rien lui-même : il reçoit des props déjà calculées |

### Le zéro tracé n'est pas une faiblesse mesurée

Un domaine sans preuve est dessiné au centre. Visuellement, c'est
indiscernable d'un domaine mesuré à zéro — et c'est exactement la confusion que
le protocole interdit (« l'absence de mesure n'est pas un zéro »).

Le point creux ne suffit pas : il faut le **texte**. Le disclaimer existant
(`domaine/[id]/page.tsx:151-156`) doit voyager avec le radar, et les domaines
non mesurés doivent être **nommés en toutes lettres sous le graphique** — la
propre docstring du composant l'exige déjà (`charts/index.tsx:335-341`).

### Accessibilité

L'`aria-label` actuel est faux dès qu'on ajoute le second appelant : il annonce
« Radar des domaines » quel que soit ce qu'on lui passe. Il doit **décrire la
donnée reçue**, ce qui implique de la faire décrire par l'appelant plutôt que
de la coder en dur dans le composant.

Les `<title>` par sommet (`:402-406`) sont conservés : ils disent déjà
« libellé — aucune preuve » ou « libellé — valeur/100 ».

### Motion

Aucune. Un radar de synthèse est une photographie ; l'animer suggérerait un
mouvement dans la donnée qui n'existe pas.

### Ordre de focus

Le radar est un `role="img"` : il n'est pas focusable et ne doit pas le
devenir. La liste des domaines non mesurés qui le suit est du texte, atteignable
normalement.

---

## 5. États vides, chargement, erreur

Le plus lourd des quatre chantiers, et le seul qui touche **tous** les écrans.

### Constat

**5 usages d'`EtatVide`** (vérifiés par grep) contre **~40 états vides
bricolés**, répartis en sept idiomes visuels distincts :

| Idiome | Exemple |
|---|---|
| `<p>` nu | `competences/[code]/page.tsx:380-386` |
| légende d'`EnTeteCarte` | `dashboard/activite.tsx:33-37` |
| `precision` de `Statistique` | `dashboard/etat-global.tsx:70-74` |
| `BandeauInfo` | `app/(app)/page.tsx:92-101` |
| boîte `surface-2` bordée | `panneau-journal.tsx:84-87` |
| boîte à bordure pointillée | `charts/index.tsx:80-88` |
| `return null` | `dashboard/prochaine-action.tsx:52` |

Les cinq usages d'`EtatVide` : `competences/[code]/page.tsx:207`,
`dashboard/progression-recente.tsx:34`, `exercices/page.tsx:285`,
`panneau-progression.tsx:108`, `panneau-journal.tsx:55`.

### Trois trous nommés

**1. La carte dominante du tableau de bord disparaît sans un mot.**
`dashboard/prochaine-action.tsx:52` : `if (!principale) return null`. C'est la
carte centrale de l'écran principal — celle dont le commentaire du fichier dit
« seule et dominante, rien ne la concurrence ». Quand le moteur ne recommande
rien, elle s'évapore et l'écran ne dit pas pourquoi.

**2. Aucun `not-found.tsx` nulle part** (grep : zéro occurrence). Les trois
appels `notFound()` — `exercices/[id]`, `competences/[code]`,
`competences/domaine/[id]` — tombent sur la page 404 par défaut de Next,
**hors du cadre du carnet** : sans rail, sans thème, sans retour.

**3. `/login` n'a ni `loading.tsx` ni `error.tsx`**, à aucun niveau — la racine
n'en a pas non plus. Une erreur sur l'écran de connexion sort de
l'application.

### Le tableau de décision

C'est le cœur de cette spec : **quel idiome, pour quelle absence.**

| Situation | Employer | Pourquoi |
|---|---|---|
| Collection vide qu'une action peut remplir | **`EtatVide`** | Titre + message + action. Au jour 0 ce n'est pas un cas dégradé, c'est l'écran normal |
| État du système, pas une collection | **`BandeauInfo`** | « Système en cours d'initialisation », « Aucun référentiel » |
| Mesure absente dans un indicateur chiffré | **`—`** via `Statistique` | Jamais un zéro. P1 du protocole |
| Recherche sans résultat | **`EtatVide`**, message citant la requête | Distinct de « la collection est vide » : l'action est de corriger la requête, pas de créer |
| Bloc entier sans objet | **`return null`** | **Uniquement** si l'utilisateur ne peut pas l'attendre. Jamais pour une carte annoncée ailleurs |

La ligne qui tranche le trou n° 1 : la carte « prochaine action » est attendue
— le tableau de bord la promet par son sous-titre (« Ta prochaine action — le
reste suit, en retrait »). Elle ne peut donc pas `return null`.

### Chargement

Cinq frontières `<Suspense>` existent, toutes avec `SqueletteContenu` sauf une
(`layout.tsx:78`, `fallback={null}`, délibéré pour le tiroir tuteur global).

**Les routes sans `<Suspense>` en page** héritent du squelette du groupe : une
grille de six cartes qui ne ressemble à aucune d'elles — `exercices/[id]`,
`competences/[code]`, `competences/domaine/[id]`, `profil`, `demarrer`. Un
squelette qui annonce une forme fausse est pire qu'un squelette générique : il
promet une mise en page qui n'arrivera pas.

Deux boîtes vides avant hydratation, sans texte ni `aria-busy` :

| Fichier | Taille | Problème |
|---|---|---|
| `zone-reponse.tsx:41-46` | `h-[15.5rem]` | `aria-hidden` — invisible aux lecteurs d'écran |
| `chat.tsx:383-390` | `h-[min(70vh,620px)]` | jusqu'à 620 px de vide silencieux |

Spec : toute zone d'attente porte `aria-busy` et une alternative textuelle.
`aria-hidden` sur un bloc de 250 px qui va se remplir cache l'attente au lieu
de l'annoncer.

### Erreur

`app/(app)/error.tsx` est bon et sert de modèle : il ne fabrique aucun chiffre,
explique que rien n'a été modifié, affiche la référence `digest`, propose
réessayer **et** se reconnecter.

À combler :
- Un `not-found.tsx` dans le cadre du carnet.
- Une frontière d'erreur pour `/login`.
- Les mutations du référentiel (~20 boutons dans `gestion.tsx` et
  `gestion-domaine.tsx`) ne changent ni libellé ni état pendant l'action,
  seulement `disabled` : l'écran paraît figé. `Bouton enChargement` répond
  exactement à ce besoin.

### Motion

`--duree-vive` pour l'apparition d'un message d'erreur (il doit être remarqué).
Aucune animation sur un état vide : il décrit une situation stable, pas un
événement.

### Ordre de focus

Quand un état vide **remplace** du contenu à la suite d'une action (une
recherche qui ne donne rien), le focus va au titre de l'état vide : sans cela,
un lecteur d'écran reste sur un bouton et n'apprend jamais que la liste s'est
vidée.

Au **premier rendu**, aucun focus programmatique : voler le focus au chargement
est une gêne, pas une aide.

---

## 6. Ce que cette spec ne fait pas

- **Elle n'ajoute aucun filtre.** Interdit par CLAUDE.md, règle recopiée dans le
  source. Le seul axe filtrable de la liste d'exercices (le statut) reste seul.
- **Elle n'introduit pas de palier tablette.** Zéro `md:` aujourd'hui ; en
  inventer un ferait gagner un état à tenir à chaque composant, sans besoin
  observé.
- **Elle ne touche pas aux 9 modales.** Relevé en phase 0, jamais mis au plan —
  cela reste vrai.
- **Elle ne câble pas `EtiquetteStatut`.** Le badge existe depuis la phase 2 ;
  lui donner une source demande d'écrire une dérivation dans `lib/domain/`,
  décision produit hors du périmètre d'un chantier d'écrans.

---

## 7. Ordre d'implémentation

Un commit par spec, dans cet ordre :

1. **Shell** — le plus contenu, et il livre le sélecteur segmenté partagé dont
   la suite se sert.
2. **États vides / chargement / erreur** — transverse ; il pose les primitives
   que l'écran d'exercice réemploiera.
3. **Radar de synthèse** — isolé, sans dépendance sur les deux premiers.
4. **Écran d'exercice** — en dernier : c'est le seul qui touche à la pédagogie,
   et il bénéficie de tout ce qui précède.

Vérification à chaque étape : `npm run verify` (tsc, eslint, 501 tests),
`npm run build`, puis contrôle navigateur — capture claire et sombre, console
sans erreur, parcours clavier complet de l'écran touché.
