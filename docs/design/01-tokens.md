# Jetons de design — Phase 1

Fichier source : [`app/src/app/tokens.css`](../../app/src/app/tokens.css).
Importé par `globals.css`, qui ne définit plus aucune valeur.

## Comment lire ce document

Le système a **deux étages**, et la règle tient en une phrase :

> Un composant n'écrit jamais une valeur, et ne référence jamais une
> primitive — il référence un **rôle**.

| Étage | Exemple | Qui l'utilise |
|---|---|---|
| **Primitive** — une valeur brute, sans intention | `--neutre-600`, `--prune-base` | uniquement `tokens.css` |
| **Sémantique** — un rôle, pas une couleur | `--texte-discret`, `--danger`, `--statut-inconnu` | les composants |

Le thème sombre est prévu à l'étage primitif : les deux rampes portent les
mêmes noms et le même ordre (50 = le plus clair, 900 = le plus sombre), et ce
sont les jetons de rôle qui piochent aux extrémités opposées. Écrire
`text-texte-discret` fonctionne dans les deux thèmes sans condition.

---

## 1. Rampe neutre

Chaude, dérivée du papier crème existant. 10 pas.

| Jeton | Clair | Sombre | Rôle tenu |
|---|---|---|---|
| `--neutre-50` | `#fffdf8` | `#f0eadd` | surface la plus élevée (clair) / texte (sombre) |
| `--neutre-100` | `#f6f2e9` | `#d6cdb9` | fond de page (clair) |
| `--neutre-200` | `#efe9db` | `#b7ac96` | surface alternée (clair) / texte atténué (sombre) |
| `--neutre-300` | `#e2d9c6` | `#968b73` | bordure décorative (clair) / texte discret (sombre) |
| `--neutre-400` | `#c9bd9f` | `#776e5a` | bordure appuyée (clair) / contour de contrôle (sombre) |
| `--neutre-500` | `#91856d` | `#4a4234` | contour de contrôle (clair) / bordure appuyée (sombre) |
| `--neutre-600` | `#726853` | `#352f25` | texte discret (clair) / bordure (sombre) |
| `--neutre-700` | `#5b5240` | `#2a251d` | texte atténué (clair) / surface alternée (sombre) |
| `--neutre-800` | `#3a3427` | `#201c16` | réserve (clair) / surface élevée (sombre) |
| `--neutre-900` | `#262117` | `#17140f` | texte (clair) / fond de page (sombre) |

### Rôles dérivés

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--fond` | `neutre-100` | `neutre-900` | fond de page, sous la trame de carnet |
| `--surface` | `neutre-50` | `neutre-800` | carte, panneau, modale |
| `--surface-2` | `neutre-200` | `neutre-700` | ligne alternée, bloc de code, en-tête de tableau |
| `--surface-3` | `neutre-300` | `neutre-600` | creux, zone enfoncée — **à border avec `--bordure-forte`**, jamais `--bordure` (même valeur) |
| `--bordure` | `neutre-300` | `neutre-600` | séparateur décoratif, contour de carte |
| `--bordure-forte` | `neutre-400` | `neutre-500` | séparateur appuyé, filet de citation |
| `--bordure-controle` | `neutre-500` | `neutre-400` | **contour de champ, case, interrupteur** — ≥ 3:1, obligatoire |
| `--texte` | `neutre-900` | `neutre-50` | texte principal |
| `--texte-attenue` | `neutre-700` | `neutre-200` | texte secondaire, légende |
| `--texte-discret` | `neutre-600` | `neutre-300` | métadonnée, horodatage — plancher AA, ne pas éclaircir |

---

## 2. Marque

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--primaire` | `#2f6b4f` | `#6fae86` | action principale, lien, élément actif |
| `--primaire-fort` | `#265a41` | `#8bc4a0` | survol de l'action principale |
| `--primaire-faible` | `#e4eee6` | `#1c2c22` | fond d'une pastille ou d'un état actif |
| `--primaire-contraste` | `#ffffff` | `#12241a` | texte posé sur `--primaire` |
| `--accent` | `#6d4a7c` | `#c39ad2` | **moment de progression** : jalon, série, palier |
| `--accent-fort` | `#5a3b68` | `#d4b3e0` | survol de l'accent |
| `--accent-faible` | `#f0e9f3` | `#2a1f30` | fond d'une pastille d'accent |
| `--accent-contraste` | `#ffffff` | `#231a29` | texte posé sur `--accent` |

L'accent est nouveau. Il existe pour que la boucle de motivation ait une
couleur qui **n'affirme rien sur la personne** : ni « réussi » (`--succes`),
ni « échoué » (`--danger`), ni « niveau » (`--statut-*`). Une teinte hors de la
famille verte, précisément pour qu'un encouragement ne puisse jamais être lu
comme une mesure.

---

## 3. État d'une action

Inchangés — tous étaient déjà conformes AA et le restent.

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--succes` / `-faible` | `#3d7a2b` / `#eef3e6` | `#7cbf5f` / `#182410` | action réussie, validation acceptée |
| `--alerte` / `-faible` | `#9a5a13` / `#f7efdf` | `#d99a3f` / `#2a1e0a` | attention requise, geste irréversible annoncé |
| `--info` / `-faible` | `#2a6f97` / `#e8f0f4` | `#5fb0dc` / `#0e2130` | information neutre, explication |
| `--danger` / `-faible` | `#a83232` / `#f6e9e5` | `#e07a6a` / `#2c1410` | erreur, refus, suppression |

---

## 4. Statut d'une compétence

**Cinq états sur deux axes distincts**, et c'est le point le plus important
de cette phase :

| Axe | États |
|---|---|
| Maîtrise | `inconnu` → `emergent` → `pratique` → `solide` |
| Temps | `a-rafraichir`, qui **se superpose** à n'importe lequel des quatre |

Une compétence solide et ancienne est à rafraîchir *sans cesser d'être
solide*. C'est pourquoi `--statut-a-rafraichir` porte sa propre teinte (ocre)
plutôt qu'une place dans la rampe verte.

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--statut-inconnu` / `-faible` | `#6e6653` / `#eae5d8` | `#a89c85` / `#282319` | aucune preuve — **neutre chaud, jamais rouge** |
| `--statut-emergent` / `-faible` | `#4d773e` / `#eaf1e3` | `#9ccb8b` / `#1b2614` | premières preuves, confiance faible |
| `--statut-pratique` / `-faible` | `#26694a` / `#e0ebe3` | `#6fae86` / `#1c2c22` | preuves répétées, niveau tenu |
| `--statut-solide` / `-faible` | `#12452c` / `#d5e3d8` | `#4d9f77` / `#15251c` | niveau démontré, confiance haute |
| `--statut-a-rafraichir` / `-faible` | `#8a5c2a` / `#f3ecdd` | `#cfa46a` / `#2a2114` | dernière preuve trop ancienne |

### `inconnu` est un état légitime, pas un échec

Le produit repose sur « l'absence de mesure n'est pas un zéro ». Ce principe
est intenable si l'interface peint l'inconnu en rouge : la couleur dirait
« raté » là où le moteur dit « je n'en sais rien ». D'où un neutre chaud, du
même monde que le texte discret — **présent, lisible, sans jugement**.

### La couleur ne porte jamais seule l'information

Les cinq fonds `-faible` ont des luminosités volontairement voisines
(0,74 → 0,86 en clair). **Ils ne peuvent pas servir de seul signal**, et c'est
délibéré : un statut s'affiche toujours avec son libellé écrit. Là où le
libellé ne tient pas — dans un graphique — `--trame-inconnu` donne à l'inconnu
une texture diagonale, donc une existence sans couleur.

### Échelle de niveaux (graphiques uniquement)

`--niveau-vide`, `--niveau-0` … `--niveau-5` : une seule teinte verte qui
monte, inchangée. Les paliers voisins ne sont pas séparables au contraste —
c'est l'exemption WCAG des dégradés, pas un oubli. Tout graphique qui les
emploie porte le nombre écrit.

---

## 5. Typographie

Six pas, deux graisses. Chaque pas porte son interligne : une taille sans
interligne associé est la porte d'entrée des blocs illisibles.

| Jeton | Utilitaire | Valeur | Interligne | Usage |
|---|---|---|---|---|
| `--pas-micro` | `text-micro` | `0.6875rem` (11 px) | 1.45 | étiquette, métadonnée, code de compétence |
| `--pas-mineur` | `text-mineur` | `0.8125rem` (13 px) | 1.5 | texte secondaire, légende de graphique |
| `--pas-corps` | `text-corps` | `0.9375rem` (15 px) | 1.6 | corps de texte — défaut du `<body>` |
| `--pas-majeur` | `text-majeur` | `1.0625rem` (17 px) | 1.5 | sous-titre, chiffre mis en avant |
| `--pas-titre` | `text-titre` | `1.375rem` (22 px) | 1.3 | titre de section |
| `--pas-affiche` | `text-affiche` | `1.75rem` (28 px) | 1.2 | titre de page, valeur héroïque |

| Jeton | Utilitaire | Valeur | Usage |
|---|---|---|---|
| `--font-weight-courant` | `font-courant` | `400` | tout le texte courant |
| `--font-weight-appuye` | `font-appuye` | `600` | titre, libellé de bouton, insistance |

**Le pas 10 px est supprimé, pas renommé.** L'audit en a compté 34 usages
(`text-[0.625rem]`) : sous 11 px, un libellé cesse d'être lisible pour une
partie des gens. Ces 34 appels remontent à `text-micro` en Phase 2.

---

## 6. Espacement

| Jeton | Valeur | Usage |
|---|---|---|
| `--socle-espacement` | `0.25rem` (4 px) | socle de toute l'échelle |

Tailwind multiplie ce socle : `p-3` = 12 px, `gap-6` = 24 px. Pas sanctionnés
— `1 2 3 4 5 6 8 10 12 16` (4 → 64 px). **Aucune valeur entre crochets pour
un espacement** : l'audit en a trouvé 197 toutes catégories confondues, c'est
la porte par laquelle une échelle meurt.

---

## 7. Rayons

| Jeton | Utilitaire | Valeur | Usage |
|---|---|---|---|
| `--coin-net` | `rounded-net` | `0.25rem` (4 px) | pastille, case à cocher, segment de jauge |
| `--coin-doux` | `rounded-doux` | `0.375rem` (6 px) | champ, bouton, petit bloc |
| `--coin-carte` | `rounded-carte` | `0.75rem` (12 px) | carte, panneau, **modale** |
| `--coin-plein` | `rounded-plein` | `9999px` | pilule, point, avatar |

L'audit a trouvé les modales en `rounded-xl` (10 usages) et les cartes en
`rounded-carte` (19) pour la même forme. Un seul jeton désormais : `carte`.

---

## 8. Ombres — trois niveaux, pas un de plus

| Jeton | Utilitaire | Usage |
|---|---|---|
| `--ombre-posee` | `shadow-posee` | carte au repos, posée sur la page |
| `--ombre-levee` | `shadow-levee` | survol, menu déroulant, élément saisi |
| `--ombre-surcouche` | `shadow-surcouche` | modale, tiroir — ce qui flotte au-dessus de tout |

`--ombre-carte` reste un alias de `--ombre-posee` : les 13 appels existants
continuent de fonctionner sans qu'un seul composant soit touché.

---

## 9. Motion

| Jeton | Utilitaire | Valeur | Usage |
|---|---|---|---|
| `--duree-vive` | `duration-150` | `150ms` | survol, focus, changement de couleur |
| `--duree-moyenne` | `duration-250` | `250ms` | apparition, dépliage, bascule d'onglet |
| `--duree-ample` | `duration-400` | `400ms` | transition d'écran, célébration d'un jalon |
| `--courbe-standard` | `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | déplacement sur place |
| `--courbe-sortie` | `ease-sortie` | `cubic-bezier(0.16, 1, 0.3, 1)` | **entrée** d'un élément (décélération) |
| `--courbe-entree` | `ease-entree` | `cubic-bezier(0.4, 0, 1, 1)` | **sortie** d'un élément (accélération) |

`prefers-reduced-motion` ramène toutes les durées à ~0 par une règle globale
unique dans `globals.css`. Les jetons n'ont pas à s'en préoccuper
individuellement.

---

## 10. Contraste — ce qui a été mesuré et ce qui a été corrigé

**90 paires jeton/fond** ont été calculées (WCAG 2.1 : 4.5:1 texte, 3:1
contour de contrôle). **Toutes sont conformes.** Trois défauts préexistants
sont apparus au calcul :

| Défaut trouvé | Avant | Mesure | Après | Mesure |
|---|---|---|---|---|
| `--texte-discret` clair illisible sur le fond de page | `#877c62` | **3.69:1** ❌ | `#726853` | 4.92:1 ✅ |
| `--texte-discret` sombre illisible sur une carte | `#8a7f68` | **4.29:1** ❌ | `#968b73` | 5.03:1 ✅ |
| Aucun contour de champ n'atteignait 3:1 | `--bordure-forte` `#c9bd9f` | **1.67:1** ❌ | nouveau `--bordure-controle` | 3.25:1 ✅ |

Sur le troisième : la lecture stricte de WCAG 1.4.11 ne vise que les
**contours de contrôles**, pas les séparateurs décoratifs. Forcer toutes les
bordures à 3:1 aurait alourdi chaque carte de l'application pour satisfaire
une règle qui ne les concerne pas. D'où un jeton dédié, appliqué là où la
norme l'exige.

**Exemption assumée** : un contrôle désactivé est hors du champ de WCAG 1.4.3.
`--neutre-500` (clair) atteint 2.64:1 dans ce rôle et n'est pas corrigé.

---

## 11. Ce qui a changé dans le produit

Aucun fichier de composant n'a été modifié. Tous les noms de jetons existants
continuent de fonctionner.

**Corrections d'accessibilité** (visibles, voulues) : les deux valeurs de
`--texte-discret` ci-dessus.

**Fusions** — deux paires de tons séparés par moins de 2 % de luminosité, donc
indistinguables :

| Thème | Fusionné | Vers | Écart |
|---|---|---|---|
| Clair | `--surface-3` `#e5ddca` | `--bordure` `#e2d9c6` | 1,5 % |
| Sombre | `--bordure` `#332d23` | `--surface-3` `#352f25` | 0,8 % |

Conséquence à retenir : **un bloc `--surface-3` doit être délimité par
`--bordure-forte`**, pas par `--bordure`, sinon son contour est invisible.

**Ajouts** : l'accent prune, les 10 jetons de statut, `--bordure-controle`,
`--ombre-levee`, 3 rayons nommés, 6 pas de texte, 2 graisses, 3 durées,
3 courbes, `--trame-inconnu`.

**Ajusté** : l'animation `.apparition` passe de `0.18s ease-out` à
`--duree-vive` (150 ms) `--courbe-sortie` — 30 ms plus rapide, imperceptible.

---

## 12. Ce que la Phase 2 devra faire de ces jetons

L'audit a compté ce qui ne les respecte pas encore. Aucun de ces chiffres
n'est corrigé par cette phase — la couche existe, la migration reste à faire :

| À migrer | Volume |
|---|---|
| `text-[0.6875rem]` → `text-micro` | 133 appels |
| `text-[0.625rem]` → `text-micro` (pas 10 px supprimé) | 34 appels |
| `rounded-xl` sur une modale → `rounded-carte` | 10 appels |
| Contour de champ → `--bordure-controle` | 6 constantes `champ` |
| `disabled:opacity-{40,50,60}` → une seule valeur | 3 valeurs en usage |
| Valeurs entre crochets, toutes catégories | 197 occurrences / 44 fichiers |
