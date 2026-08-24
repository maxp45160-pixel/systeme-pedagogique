# Ce que « Mes cours » alimente, et ce qui vit à côté

**Relevé du 24/08/2026.** Inventaire préparatoire à un arbitrage produit — pas
une décision, pas un plan de retrait. Aucune ligne n'a été retirée sur la foi de
ce document.

La question posée : **qu'est-ce qui, dans « Mes cours », alimente la boucle
génération → évaluation → adaptation, et qu'est-ce qui vit à côté ?**

Le critère retenu est étroit et vérifiable : une capacité **alimente** la boucle
si l'on peut nommer le chemin de code par lequel ce qu'elle produit entre dans
une génération, une évaluation ou une recommandation. Tout le reste vit à côté —
ce qui n'est pas un jugement de valeur, seulement un constat de câblage.

---

## 1. Le fait qui domine tout le reste

**Le contexte envoyé au tuteur ne contient aucun document.**

`lib/tutor/contexte.ts` assemble le prompt à partir de sept blocs, tous
recensés par son propre manifeste :

| Bloc | Origine |
|---|---|
| Protocoles (`00_instructions/`) | fichier |
| État courant des compétences | calculé |
| Travail récent | calculé |
| Trajectoire | calculé |
| Calibrage du prochain exercice | calculé |
| Exercices existants | calculé |
| Exercice en cours | calculé |
| Priorités calculées | calculé |
| Outils de proposition (schémas) | calculé |

Il n'y a pas de huitième ligne. `grep -c "note" lib/tutor/contexte.ts` rend
**0**. Aucune route d'API ne reçoit de document. Le bloc nommé « corpus » dans
le code désigne les **exercices** existants (`serialiserCorpus`), pas les
fiches.

Conséquence directe : une fiche de cours rédigée avec soin, ses formules, ses
wikiliens et son PDF joint **ne changent rien à l'exercice suivant**. Le tuteur
ne les a jamais lus.

C'est le fait central de cet inventaire. Il ne dit pas que l'éditeur est
inutile — il dit que son utilité, si elle existe, est pour la personne qui
écrit, pas pour la machine qui génère.

---

## 2. Le poids, mesuré

Lignes hors tests, au 24/08/2026, après le retrait de l'onglet Arbre (ADR-121).

| Ensemble | Lignes |
|---|---:|
| `components/atelier` | 8 520 |
| `lib/documents` | 3 755 |
| `components/competences/graphe` | 1 585 |
| **Total « Mes cours »** | **13 860** |
| `lib/engine` + `lib/domain` — la boucle elle-même | 18 234 |
| Dépôt entier, hors tests | 98 631 |

« Mes cours » pèse **14 % du dépôt**, et **76 % du poids du moteur**.

---

## 3. Capacité par capacité

### ✅ Alimente la boucle — le chemin existe et se nomme

| Capacité | Coût | Le chemin |
|---|---:|---|
| **Le référentiel** — domaines, compétences, fiches, paliers, prérequis, tags, classement | ~3 170 l. | La compétence **est** l'unité de mesure. `Skill.code` est la clé étrangère des Observations ; `recommander()` et `calibrerToutes()` ne lisent rien d'autre. Sans cette partie, il n'y a pas de produit. |
| **Le PDF lu par le tuteur** | ~245 l. | `composerSujetLecture()` fabrique « propose un référentiel couvrant son contenu » à partir du texte extrait, l'envoie à `/api/referentiel/proposer`, et la modale écrit des compétences après relecture case par case. **C'est le seul endroit où le contenu d'un document remonte au tuteur** — et il y remonte une fois, à la création, pas à chaque génération. |
| **La marge** | ~290 l. | `TraiterLigneMarge` ouvre la capture d'intention pré-remplie avec la phrase notée. « je bloque sur les conversions » devient une séance. Chemin court, explicite, et le seul qui parte d'une note vers du travail. |
| **Le graphe de compétences** | ~1 585 l. | N'alimente pas la génération, mais rend lisible ce qui la gouverne : prérequis, hubs d'exercices, isolats. Un isolat visible est une information actionnable sur le référentiel. *Cas limite : il sert à décider, pas à générer.* |

**Sous-total du câblé : ~5 290 l.**

### ⚪ Vit à côté — utile peut-être, mais sans chemin vers la boucle

| Capacité | Coût | Ce qui est vérifié |
|---|---:|---|
| **L'éditeur Markdown WYSIWYG** | ~1 015 l. de `lib` + une grande part des 2 550 l. de `espace-documentaire.tsx` | Édition in-place, front-matter, formatage détecté, nœuds de formule. Rien de ce qui est saisi n'atteint `contexte.ts`. |
| **Les wikiliens `[[…]]`** | inclus ci-dessus | `REGEX_INLINE_MARKDOWN` les repère pour la **navigation entre fiches**. Aucun lien n'est lu par le moteur, aucune relation de compétence n'en est dérivée. |
| **Le rangement du corpus** — arborescence, groupes, fils, tri | ~1 415 l. | Organise l'affichage des fiches. Purement présentation. |
| **Les repères de lecture** | inclus dans les 290 l. de marge | Le module le déclare lui-même en en-tête : « un repère n'entre dans aucun calcul — ni niveau, ni score, ni recommandation ». Stocké dans le navigateur, jamais côté serveur. |
| **Les pièces jointes hors lecture tuteur** | inclus dans les 245 l. | Un PDF qu'on joint sans demander la lecture est un fichier stocké. |

**Sous-total du non câblé : ~5 000 l., dont la moitié dans un seul fichier.**

### 🟡 Cas mixtes — la fiche est un support de la boucle, pas une saisie

| Capacité | Coût | Nuance |
|---|---:|---|
| **Fiche d'exercice, production, journal de séance, fiche projet** | ~795 l. | Ces documents sont **écrits par le système**, pas saisis. Ils rendent lisible ce que la boucle a produit (`production.ts` : « Énoncé au moment de la production »). Ils sont une **sortie** de la boucle, pas une entrée. Les retirer ne casserait aucune génération — mais retirerait la trace relisible du travail. |
| **La progression par domaine** | ~146 l. | Lecture dérivée des états. Sortie, pas entrée. |

---

## 4. Ce que ce relevé ne dit pas

- **Il ne dit pas que l'éditeur ne sert à personne.** Écrire une fiche est un
  geste d'apprentissage reconnu, et `PRODUCT.md` §1 range le mini-projet parmi
  les gestes qui produisent « du travail et du contexte, pas encore une
  mesure » (ADR-070). Ce relevé constate seulement que ce contexte **ne circule
  pas** jusqu'au tuteur.
- **Il ne mesure aucun usage.** Combien de fiches existent, combien portent un
  PDF, combien ont été éditées deux fois : Supabase le dirait, personne ne l'a
  demandé. Un éditeur que personne n'a rempli et un éditeur central se
  ressemblent dans le code.
- **Il ne propose aucun retrait.** Les trois questions ci-dessous sont
  l'arbitrage ; elles appartiennent à une personne.

---

## 5. Les trois questions à trancher

**Q1 — Le contexte du tuteur doit-il lire les fiches ?**
Si oui, l'éditeur devient câblé et son poids se justifie ; il faut alors décider
*quelles* fiches, et comment borner la fenêtre (le contexte tourne autour de
12 K jetons par message). Si non, l'éditeur reste un outil de la personne, et
c'est à ce titre-là qu'il doit se juger — pas comme une brique de la boucle.

**Q2 — « Mes cours » est-il un espace de notes personnel, ou le magasin de
matière que le tuteur consomme ?**
Les deux réponses sont défendables ; ce qui ne l'est pas, c'est de ne pas
choisir. Aujourd'hui le code répond « espace de notes personnel » (rien ne
circule) pendant que le nom et la place au rail suggèrent l'autre.

**Q3 — Le WYSIWYG mérite-t-il ses ~1 000 lignes de `lib` ?**
Un éditeur Markdown en texte brut avec aperçu coûte une fraction de cela.
L'édition in-place a été construite pour le confort ; si Q1 répond « non »,
c'est un confort qu'on paie au prix d'un dixième du moteur.

---

## Annexe — comment ce relevé a été fait

```bash
# Le contexte du tuteur ne mentionne aucun document
grep -c "note" app/src/lib/tutor/contexte.ts        # 0

# Aucune route IA ne reçoit de document
grep -rn "documents\|notes\|corpus" app/src/app/api/*/route.ts app/src/app/api/*/*/route.ts

# Le poids
find app/src/components/atelier app/src/components/competences/graphe app/src/lib/documents \
  \( -name '*.tsx' -o -name '*.ts' \) ! -name '*.test.*' | xargs wc -l | tail -1
```

Chaque affirmation de la section 3 est adossée à un fichier nommé. Une
capacité rangée « vit à côté » l'est parce que la recherche du chemin inverse
n'a rien rendu — pas parce qu'elle a semblé accessoire.
