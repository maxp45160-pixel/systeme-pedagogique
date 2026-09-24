# Corpus de départ pour tester la classification

Sélection du 22 septembre 2026, en réponse à la demande de Maxime. Catalogue de recherche : aucun jalon validé, aucune annotation de compétences présentée comme acquise.

## État des vérifications

Les liens directs ci-dessous ont répondu sans authentification, avec le type de fichier attendu. Les pages de présentation et plusieurs PDF/textes ont été lus ; les couples manuscrit/transcription ont été contrôlés. Les fichiers n'ont pas été importés dans Twiny et leur compatibilité effective avec ses lecteurs reste à tester. Aucun appel OCR/LLM payant n'a été exécuté pour constituer cette sélection.

Il y a **12 entrées, dont deux paires de formats d'une même œuvre**. Ces variantes ne sont pas des documents indépendants pour une mesure de qualité.

## Documents et liens directs

Les objectifs ci-dessous sont des hypothèses de test proposées par l'agent, pas des annotations humaines de référence.

| ID | Document et fichier | Volume vérifié | Ce qu'on cherche à tester |
|---|---|---|---|
| C01 | Exo7, **Probabilité et dénombrement ; indépendance** — [PDF](https://exo7.emath.fr/ficpdf/fic00150.pdf) | 4 pages ; 114 360 octets | Sujet précis, compétences réparties dans les exercices et corrections ; distinguer les mathématiques du contexte des énoncés. |
| C02 | Exo7, **Probabilité conditionnelle** — [PDF](https://exo7.emath.fr/ficpdf/fic00151.pdf) | 6 pages ; 124 255 octets | Conditions, Bayes, distinction entre probabilités conditionnelles inversées ; rattachement au même domaine que C01. |
| C03 | Exo7, **Diagonalisation** — [PDF](https://exo7.emath.fr/cours/ch_diagon.pdf) | 18 pages ; 189 338 octets | Matrices et formules, concepts voisins, inventaire des compétences dans un document dense. |
| C04 | Olivier Gimenez, **Introduction à la statistique bayésienne — Avec le logiciel R**, Quæ, 2026 — [PDF](https://www.quae-open.com/open_access_download/638/1212) | 78 pages ; 4,69 Mo annoncés par l'éditeur | Document long, distinction sujet statistique/application écologique, compétences et prérequis. |
| C05 | Même ouvrage que C04 — [EPUB](https://www.quae-open.com/open_access_download/639/1213) | 3,64 Mo annoncés par l'éditeur | Comparer sujet et compétences sur les mêmes passages que C04 ; ordre des sections et couverture textuelle. |
| C06 | Gérard Swinnen, **Apprendre à programmer avec Python3**, édition 2012 — [EPUB](https://inforef.be/swi/download/apprendre_python3_5.epub) | 4 959 588 octets | Code, indentation, fonctions, exercices ; limites des longues sections. Version ancienne choisie comme document de test, pas comme conseil technique actuel. |
| C07 | René Descartes, **Discours de la méthode**, édition diffusée par Gutenberg — [EPUB](https://www.gutenberg.org/ebooks/13846.epub3.images) | 326 601 octets | Philosophie, contenu non scolaire, prudence sur les compétences qu'on peut réellement attribuer au texte. |
| C08 | CNIL, **Lorsque je navigue sur internet** — [JPG](https://www.cnil.fr/sites/cnil/files/thumbnails/image/1_6.jpg) | 361 079 octets | Texte dans une composition graphique ; gestes pratiques et domaine de rattachement. |
| C09 | CNIL, **Lorsque je quitte mon poste** — [JPG](https://www.cnil.fr/sites/cnil/files/thumbnails/image/3_2.jpg) | 318 027 octets | Document court voisin de C08 ; ne pas transformer une consigne à la première personne en déclaration de l'utilisateur. |
| C10 | CREMMA-Wikipedia, **batch1_01**, écriture contemporaine — [PNG](https://raw.githubusercontent.com/HTR-United/cremma-wikipedia/master/data/batch-01/batch1_01.out.png) · [référence ALTO XML](https://raw.githubusercontent.com/HTR-United/cremma-wikipedia/master/data/batch-01/batch1_01.out.xml) | Image : 1 305 434 octets ; XML : 9 867 | Mesurer séparément transcription et classification. **Isoler la zone manuscrite : l'image contient aussi le texte imprimé de référence.** |
| C11 | Peraire, **test_B.12.japon3_0048**, récit de voyage manuscrit — [JPEG](https://raw.githubusercontent.com/alix-tz/peraire-ground-truth/master/data/test/test_B.12.japon3_0048.jpg) · [référence ALTO XML](https://raw.githubusercontent.com/alix-tz/peraire-ground-truth/master/data/test/test_B.12.japon3_0048.xml) | Image : 1 646 499 octets ; XML : 41 747 | Écriture historique difficile, récit et contexte ; test de résistance OCR, peu représentatif de notes étudiantes actuelles. |
| C12 | Même édition que C07 — [texte UTF-8](https://www.gutenberg.org/cache/epub/13846/pg13846.txt) | Texte accessible ; taille non relevée | Copier un passage borné dans l'entrée de texte libre pour comparer avec l'EPUB. **Ce n'est pas un import de fichier TXT, ni un échantillon de formulation personnelle spontanée.** |

### Sources et conditions déclarées

- **Exo7** : [catalogue de deuxième année](https://exo7.emath.fr/deux.html), [présentation aux enseignants](https://www.exo7.emath.fr/prof.html). Accès gratuit ; licence précise de chaque document non relevée.
- **Quæ** : [fiche éditeur et sommaire](https://www.quae-open.com/produit/383/9782759242580/introduction-a-la-statistique-bayesienne). Ouvrage en français, annoncé en accès ouvert. Tailles issues de cette fiche ; licence précise non relevée.
- **Swinnen** : [page de l'auteur et téléchargements](https://inforef.be/swi/python.htm). La page annonce une licence Creative Commons avec attribution, usage non commercial et partage à l'identique ; conserver la notice jointe au livre.
- **Gutenberg** : [notice de l'édition](https://www.gutenberg.org/ebooks/13846). Domaine public aux États-Unis selon la notice, sans extrapolation à tous les pays. Le texte comprend du paratexte et un éloge de Descartes : le début du fichier ne correspond pas directement au début du Discours. Fixer le passage évalué par son contenu, pas seulement par le titre du téléchargement.
- **CNIL** : [page publiant les fonds d'écran](https://www.cnil.fr/fr/professionnels-du-secteur-social-comment-mieux-proteger-les-donnees-de-vos-usagers-demarches-en-ligne). Diffusion encouragée par la page ; licence précise non relevée. Variante supplémentaire : [affiche PDF d'une page](https://www.cnil.fr/sites/default/files/atoms/files/poster.pdf), utile pour une mise en page très graphique, sans la qualifier de scan.
- **CREMMA** : [présentation et licence CC BY 4.0](https://github.com/HTR-United/cremma-wikipedia). Des bénévoles recopient des extraits de Wikipédia ; il ne s'agit pas de notes spontanées. Respecter les conventions de transcription lors du calcul des erreurs.
- **Peraire** : [présentation et licence CC BY 4.0](https://github.com/alix-tz/peraire-ground-truth). Le dépôt demande de mentionner « Bibliothèque Sébert, Espéranto-France, Paris » pour les images. Conserver cette attribution et les conventions de transcription.

## Premier passage conseillé

Commencer par **C01, C02, C04, C05, C08 et C10** : deux PDF courts avec corrections, une paire PDF/EPUB, une image imprimée et une image manuscrite avec transcription.

Pour les livres longs, choisir et consigner un périmètre identique dans chaque format, compatible avec les limites actuelles du pilote : 20 pages/sections par analyse, fichier original de 10 Mio maximum. Une tranche ne permet pas de conclure sur toutes les compétences du livre. Les tailles relevées ou annoncées sont inférieures à la limite de fichier ; cela ne prouve pas que la structure de chaque EPUB est prise en charge.

Avant d'évaluer les résultats, faire annoter humainement chaque périmètre : sujet précis, domaine, compétences attendues avec passages justificatifs, et contexte de l'organisation utilisée pour juger les rattachements. Les corrigés aident cette annotation mais ne fournissent pas une liste de compétences déjà validée. Les XML servent de référence à la transcription, pas à la classification.

Mesurer séparément les propositions incorrectes/non justifiées et les compétences attendues omises. Le seuil demandé de moins de 5 % n'est pas démontré par ce catalogue. Documenter les analyses partielles, les abstentions et les troncatures, notamment face au plafond actuel de 30 compétences proposées. Garder les variantes d'une même œuvre dans le même groupe si l'on sépare un lot de réglage et un lot d'évaluation.

## Dialogue et couverture encore manquante

Le document ne révèle pas, à lui seul, ce que veut en faire l'utilisateur. On peut rejouer C01 avec trois **scénarios de test synthétiques**, explicitement étiquetés : préparer un examen, utiliser une méthode dans un projet, conserver une référence. Vérifier que le dialogue établit l'intention et sa place dans l'organisation avant de proposer un rattachement adapté. Ne pas présenter ces scénarios comme des données personnelles réelles.

Deux apports restent nécessaires pour une recette représentative : des notes de cours manuscrites avec formules et transcription vérifiée, et des formulations personnelles spontanées avec leur contexte. Des PDF réellement scannés restent aussi à ajouter. Ce premier corpus sert à trouver des défauts et préparer l'annotation ; il ne suffit pas à certifier le jalon.
