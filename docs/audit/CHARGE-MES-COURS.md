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

`lib/tutor/contexte.ts` assemble le prompt à partir de **onze blocs** sur un
message ordinaire — trois protocoles, le cadre d'intervention, les schémas
d'outil, et six lectures dérivées des compétences, des Observations et des
exercices. Tous sont recensés par son propre manifeste, qui en donne la taille
(chiffres du 24/08/2026, après ADR-125) :

| Bloc | Origine | Car. |
|---|---|---:|
| Instructions principales | fichier | 7 924 |
| Protocole d'évaluation (essentiel) | fichier | 6 322 |
| Protocole anti-hallucination | fichier | 4 660 |
| Outils de proposition (schémas) | calculé | 4 255 |
| Cadre d'intervention dans l'interface | calculé | 2 931 |
| État courant des compétences | calculé | · |
| Travail récent | calculé | · |
| Trajectoire | calculé | · |
| Calibrage du prochain exercice | calculé | · |
| Exercices existants | calculé | · |
| Exercice en cours | calculé | · |
| Priorités calculées | calculé | · |

Deux autres blocs s'ajoutent sur déclencheur : le protocole d'évaluation complet
et la charte du référentiel. Aucun des treize n'est un document. `grep -c "note" lib/tutor/contexte.ts` rend
**0**. Aucune route d'API ne reçoit de document. Le bloc nommé « corpus » dans
le code désigne les **exercices** existants (`serialiserCorpus`), pas les
fiches.

Conséquence directe : une fiche de cours rédigée avec soin, ses formules, ses
wikiliens et son PDF joint **ne changent rien à l'exercice suivant**. Le tuteur
ne les a jamais lus.

C'est le fait central de cet inventaire. Il ne dit pas que l'éditeur est
inutile — il dit que son utilité, si elle existe, est pour la personne qui
écrit, pas pour la machine qui génère.

### Ce que ADR-124 a changé, et ce qu'il n'a pas changé (24/08/2026)

**Le contexte, lui, n'a pas bougé** : `contexte.ts` assemble toujours les mêmes
blocs, il n'y a toujours pas de douzième ligne au manifeste, et aucune fiche
n'est envoyée automatiquement. Tout le §1 ci-dessus reste exact.

Ce qui existe désormais est un **geste** : sur une fiche de connaissance,
« Travailler à partir de cette fiche » compose un message — titre plus corps
borné à 4 000 caractères — et le pose en brouillon dans la saisie du tuteur.
La personne le relit et l'envoie. La matière entre donc par la conversation,
une fois, quand elle est demandée, et jamais par le contexte permanent.

La phrase « une fiche ne change rien à l'exercice suivant » n'est donc plus
vraie **quand la personne fait ce geste** ; elle le reste tant qu'elle ne le
fait pas. Q1 a été tranchée « non » pour le contexte permanent, et le moteur
reste hors de portée : rien de ce qui vient d'une fiche ne devient une mesure.

---

## 2. Le poids, mesuré

Lignes hors tests, au 24/08/2026, après le retrait de l'onglet Arbre (ADR-121)
et l'ajout du geste d'ADR-124.

| Ensemble | Lignes |
|---|---:|
| `components/atelier` | 8 551 |
| `lib/documents` | 3 880 |
| `components/competences/graphe` | 1 585 |
| **Total « Mes cours »** | **14 016** |
| `lib/engine` + `lib/domain` — la boucle elle-même | 18 234 |
| Dépôt entier, hors tests | 98 818 |

« Mes cours » pèse **14 % du dépôt**, et **77 % du poids du moteur**.

---

## 3. Capacité par capacité

### ✅ Alimente la boucle — le chemin existe et se nomme

| Capacité | Coût | Le chemin |
|---|---:|---|
| **Le référentiel** — domaines, compétences, fiches, paliers, prérequis, tags, classement | ~3 170 l. | La compétence **est** l'unité de mesure. `Skill.code` est la clé étrangère des Observations ; `recommander()` et `calibrerToutes()` ne lisent rien d'autre. Sans cette partie, il n'y a pas de produit. |
| **Le PDF lu par le tuteur** | ~245 l. | `composerSujetLecture()` fabrique « propose un référentiel couvrant son contenu » à partir du texte extrait, l'envoie à `/api/referentiel/proposer`, et la modale écrit des compétences après relecture case par case. **C'est le seul endroit où le contenu d'un document remonte au tuteur** — et il y remonte une fois, à la création, pas à chaque génération. |
| **Le geste « Travailler à partir de cette fiche »** (ADR-124) | ~125 l. | `composerSujetFiche()` compose titre + corps borné à 4 000 caractères et le pose en brouillon dans la saisie du tuteur ; la personne l'envoie. La matière entre par la conversation, une fois, quand elle est demandée. Elle peut changer un énoncé — jamais un niveau. |
| **La marge** | ~290 l. | `TraiterLigneMarge` ouvre la capture d'intention pré-remplie avec la phrase notée. « je bloque sur les conversions » devient une séance. Chemin court, explicite, et le seul qui parte d'une note vers du travail. |
| **Le graphe de compétences** | ~1 585 l. | N'alimente pas la génération, mais rend lisible ce qui la gouverne : prérequis, hubs d'exercices, isolats. Un isolat visible est une information actionnable sur le référentiel. *Cas limite : il sert à décider, pas à générer.* |

**Sous-total du câblé : ~5 415 l.**

### ⚪ Vit à côté — utile peut-être, mais sans chemin vers la boucle

| Capacité | Coût | Ce qui est vérifié |
|---|---:|---|
| **L'éditeur Markdown WYSIWYG** | ~1 015 l. de `lib` + une grande part des 2 550 l. de `espace-documentaire.tsx` | Édition in-place, front-matter, formatage détecté, nœuds de formule. Rien de ce qui est saisi n'atteint `contexte.ts` — et cela reste vrai après ADR-124, qui fait passer la matière par un message, pas par le contexte. Ce qui a changé : le corps d'une fiche de connaissance peut désormais atteindre le tuteur, sur geste explicite (`composerSujetFiche`). Le WYSIWYG lui-même n'y gagne rien : le geste ne lit que du Markdown. |
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

**Q1 — Le contexte du tuteur doit-il lire les fiches ?** → **tranchée le
24/08/2026 : non** (ADR-124).
Le contexte permanent ne lira pas les fiches : `fenetre.ts` chiffre le pire cas
à ~120 K jetons pour une limite de 128 K, et choisir *quelles* fiches envoyer
aurait demandé une heuristique que personne ne peut valider. La matière passe
par un geste explicite, dans la conversation, une fois. Le moteur, lui, ne lit
rien : une fiche est une déclaration, pas une Observation.

**Q2 — « Mes cours » est-il un espace de notes personnel, ou le magasin de
matière que le tuteur consomme ?** → **tranchée : espace personnel, avec une
porte** (ADR-124).
Le corpus reste ce que la personne écrit pour elle. Rien n'en part sans qu'elle
le demande ; ce qui part, elle le voit avant l'envoi. Le nom cesse de mentir
sans que l'atelier devienne un magasin.

**Q3 — Le WYSIWYG mérite-t-il ses ~1 000 lignes de `lib` ?** → **ouverte.**
ADR-124 ne la touche pas : le geste ne lit que du Markdown, quel que soit
l'éditeur qui l'a écrit. La question se juge sur l'usage réel du corpus —
combien de fiches existent, combien sont éditées deux fois — et ce chiffre
n'a toujours pas été relevé.

---

## Annexe — comment ce relevé a été fait

```bash
# Le contexte du tuteur ne mentionne aucun document
grep -c "note" app/src/lib/tutor/contexte.ts        # 0

# Aucune route IA ne reçoit de document — la matière d'ADR-124 voyage comme
# TEXTE DE MESSAGE, pas comme paramètre : cette commande reste vide après lui.
grep -rn "documents\|notes\|corpus" app/src/app/api/*/route.ts app/src/app/api/*/*/route.ts

# Le poids
find app/src/components/atelier app/src/components/competences/graphe app/src/lib/documents \
  \( -name '*.tsx' -o -name '*.ts' \) ! -name '*.test.*' | xargs wc -l | tail -1

# Le budget du prompt système, bloc par bloc (ADR-125)
npx vitest run src/lib/tutor/budget-contexte.test.ts
```

Chaque affirmation de la section 3 est adossée à un fichier nommé. Une
capacité rangée « vit à côté » l'est parce que la recherche du chemin inverse
n'a rien rendu — pas parce qu'elle a semblé accessoire.
