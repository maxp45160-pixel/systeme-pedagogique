# Recette du corpus documentaire — 22 septembre, reprise le 24 septembre 2026

## Mandat et périmètre

Demande de Maxime : « vas-y fais les tests avec ce corpus puis dis moi le résultat. » Accord complémentaire : « Oui, jusqu’à 2,80 € » pour les appels Mistral des six entrées C01, C02, C04, C05, C08 et C10, avec conservation des documents et résultats dans son compte pilote. Aucun réessai payant implicite.

Base Git : `11ab9ea8176303241c7ff25406f6d5faa4bcf364`. Code produit inchangé pendant cette recette. Le catalogue du corpus était un fichier non suivi préexistant. Documents publics téléchargés dans `scratch/corpus-classification-2026-09-22/`, ignoré par Git ; manifeste et empreintes SHA-256 conservés avec les résultats.

Cette recette distingue lecture technique, appels réels et jugement indicatif de l'agent. Elle ne constitue pas une annotation humaine ni une validation du seuil de 5 %.

## Lecture locale des 12 entrées

Commande : `node scratch/corpus-classification-2026-09-22/test-lecteurs.mjs`.

Le harnais appelle le lecteur EPUB et la validation de fichiers du produit. Pour les PDF, il utilise `unpdf`, présent dans le produit, pour le comptage et l'extraction locale du texte : cette extraction ne remplace pas l'OCR Mistral du pilote. Pour les images, il vérifie seulement le décodage.

| Entrées | Résultat constaté |
|---|---|
| C01, C02, C03 | PDF lisibles : 4, 6 et 18 pages ; aucune page sans texte extractible. |
| C04 | PDF lisible : **82 pages physiques**, contrairement aux 78 pages annoncées par la fiche éditeur ; 3 pages sans texte extractible. |
| C05 | EPUB lu : 54 sections, dont 52 signalées incertaines et une sans texte. La couverture textuelle ne garantit pas celle des illustrations/formules. |
| C06, C07 | **Refusés** par le lecteur réel : une section dépasse 50 000 octets de texte. Aucun extrait retourné. |
| C08, C09 | JPG décodables, 975 × 500 pixels chacun. |
| C10 | PNG décodable, 1652 × 2338 pixels. Transcription ALTO XML valide. Présence du texte imprimé de référence : un essai sur l'image entière ne mesure pas isolément la reconnaissance manuscrite. |
| C11 | JPG décodable, 3345 × 4365 pixels. Transcription ALTO XML valide. |
| C12 | UTF-8 lisible, 711 751 caractères ; le texte entier dépasse la saisie de 12 000 caractères. Un passage est nécessaire, comme prévu dans le catalogue. |

Les 11 pièces jointes satisfont les contrôles de type et de taille ; ce contrôle ne suffit donc pas à prouver leur lisibilité EPUB. Les erreurs de chemin URL Windows et de nettoyage PDF rencontrées dans la première version du harnais ont été corrigées avant la mesure finale ; ce n'étaient pas des défauts du produit.

## Contrôles automatisés complémentaires

`npm run test --workspace=app -- src/lib/documents/extraction-epub.test.ts src/lib/documents/extraction-pdf.test.ts src/lib/documents/evaluation-classification.test.ts src/lib/documents/dialogue-documentaire.test.ts --maxWorkers=2`

Résultat du 22 septembre à 17 h 52 : **67 tests passent, 4 fichiers**. Ces tests n'évaluent pas la pertinence d'un fournisseur réel.

La passe complète lancée le 22 septembre à 17 h 59 a aussi terminé : **2 728 tests passent, 243 fichiers**, en 88,91 s (`full-test.log`). Résultat retrouvé le 24 septembre ; pas de relance nécessaire sur ce code inchangé.

## Diagnostic EPUB approfondi — 24 septembre

La QA a reproduit les refus avec le lecteur public inchangé. C06 comporte 10 sections dépassant la limite : première section bloquante n°12, 73 166 octets. C07 en comporte 5 : première n°2, 186 662 octets. Le refus n'est pas lié à la taille compressée des fichiers.

Pour C05, 52 avertissements ne signifient pas 52 sections entièrement perdues : 44 sections ne contiennent que des icônes parmi leurs médias. Le diagnostic identifie toutefois 44 blocs MathML omis, 42 figures raster omises (avec certaines légendes/descriptions conservées), et 176 indices/exposants encodés en CSS qui sont aplatis. Exemple confirmé : `N(0,1.5²)` devient `N(0,1.52)`. Cette dernière altération peut changer le sens mathématique du texte. Ce sont des occurrences de balises et des défauts de lecture, pas un taux d'erreur de compétences.

Preuves reproductibles : `scratch/corpus-classification-2026-09-22/diagnostic-epub.md`, `.mjs` et `.json`. Aucun seuil ni code produit modifié.

## Appels Mistral réels — six entrées essayées, quatre analyses abouties

Interface locale `http://localhost:3000/app`, session déjà authentifiée. Utilisation du parcours normal d'import/analyse, avec compteur serveur. Modèles configurés : `mistral-ocr-4-1`, puis `mistral-medium-3-5`. Le PDF original entier est transmis, avec sélection des pages à traiter ; les EPUB transmettent leur texte extrait. Aucun clic sur « Appliquer ce choix » pendant la recette.

| Entrée | Trace | Observation |
|---|---|---|
| C01 | `depot-54c5fe0d5c8c6df63070597c9f4db35f` | Analyse terminée, 4/4 pages. Sujet probabilités/dénombrement ; 13 nouvelles compétences proposées. Domaine laissé à vérifier car une incertitude est signalée. |
| C02 | `depot-ff49a2f7ba6319dfb0c90821d2cf1567` | Analyse terminée le 22/09, 6/6 pages. 10 nouvelles compétences proposées : probabilités conditionnelles/totales, récurrences, modèle de Markov, indépendance, combinatoire, fiabilité et Bayes. Domaine probabilités et statistiques laissé à vérifier. |
| C04 | `depot-0787d9ed07077f84073368af2df3fb96` | Échec le 22/09, confirmé en base le 24/09 : Mistral OCR HTTP 500, « Service unavailable ». Zéro page conservée ; aucun réessai. |
| C05 | `depot-d3a5423144c97dceb405be3338a16252` | Échec du transfert le 24/09. Le bucket distant `document-support` autorise PDF/JPEG/PNG/WebP, pas EPUB. Ressource créée sans pièce jointe ; aucun appel Mistral. La migration EPUB préparée reste à appliquer dans un chantier d'activation. |
| C08 | `depot-80833aa81a26863c206a25166190300d` | Analyse terminée le 24/09, 1/1 image. Sujet cybersécurité/vie privée ; 4 compétences proposées. Les quatre encadrés principaux sont présents dans la transcription. Un verbe proposé est inadéquat (voir ci-dessous). |
| C10 | `depot-f5fc7c2e9a3b92b2c27eb50282b8113b` | Analyse terminée le 24/09, 1/1 image. Transcription imprimée et manuscrite conservée ; sujet du formulaire de collecte HTR, aucun domaine ni compétence proposés. Incertitude pédagogique explicitée. |

Observation initiale C01 : plusieurs propositions correspondent à des contextes d'exercices (« nombre de bises », « nombre de tenues vestimentaires »), ce qui pose la question de leur réutilisation comme compétences générales. Un intitulé affiché se termine par « répons ». Aucun de ces constats n'est transformé ici en taux d'erreur humain.

Présélection expliquée le 24/09 : `modale-ressources.tsx`, `choixInitial`, sélectionne toutes les nouvelles propositions avant un rattachement lorsque `garderLiensActuels` est faux. Les incertitudes C01/C02 empêchent le rattachement délégué. La phrase de PRODUCT « Après ce rattachement » concerne précisément l'autre cas ; cette observation ne prouve pas une violation de cette phrase. Elle signifie néanmoins qu'un clic sur « Appliquer ce choix » peut accepter toutes les propositions présélectionnées. Aucun tel clic n'a été effectué pendant la recette.

Une grille indicative d'agent pour C01/C02 est conservée dans `grille-agent-probabilites.md` ; ce n'est pas une annotation humaine.

### Réserves de sens constatées

- **C01** : les contextes d'exercices sont parfois érigés en compétences très spécifiques. La généralisation demandée à l'exercice 9 n'apparaît pas explicitement dans l'intitulé ni la justification de la proposition correspondante. Il reste à décider humainement la granularité attendue ; aucun score d'omission n'en est déduit.
- **C02** : la proposition « événement avec répétitions » est justifiée par des « permutations avec répétitions » pour l'exercice 11 de formation de couples. Les personnes y sont distinctes : cette qualification est inadéquate. La couverture des gestes fins (seuil entier d'achats, emploi explicite de la matrice, généralisation) nécessite une annotation humaine ; les intitulés larges ne prouvent pas cette couverture.
- **C08** : « Modéliser comportement de publication (responsable) » ne correspond pas au geste demandé dans l'encadré sur les publications personnelles. La justification parle elle-même de modérer les publications ; elle ne justifie aucune modélisation. Les trois autres propositions correspondent aux thèmes visibles. Les deux vignettes renvoyées par l'OCR ne sont pas interprétées par l'étape textuelle suivante ; cette réserve est affichée.
- **C10** : le texte du passage manuscrit est présent dans l'OCR, mais le même passage est aussi imprimé sur la page. Impossible d'en faire une mesure indépendante de reconnaissance manuscrite. Le modèle retient le sujet global du formulaire, pas uniquement la musique évoquée dans le passage recopié. Cette sortie montre une abstention explicite sur les compétences ; elle ne valide pas le classement de notes de cours manuscrites.

Ces appréciations sont celles de l'agent, fondées sur les documents et restitutions. Aucune référence ni annotation n'a été déclarée humaine. Aucun taux inférieur à 5 % ne peut être annoncé.

### Coût enregistré et effets du test

Lecture du compteur serveur le 24/09, limitée aux opérations de ce lot :

| Entrée | Coût finalisé dans Twiny | Réservation au coût incertain |
|---|---:|---:|
| C01 | 0,088883 € | 0 € |
| C02 | 0,109743 € | 0 € |
| C04 | non finalisé | 0,160000 € |
| C05 | aucun appel | 0 € |
| C08 | 0,031967 € | 0 € |
| C10 | 0,024125 € | 0 € |
| Total | **0,254718 €** | **0,160000 €** |

Le total compté, réservation incertaine comprise, est **0,414718 €**, dans les 2,80 € autorisés. Ce sont les valeurs du compteur de Twiny, pas une facture fournisseur vérifiée. Aucune réservation n'a été libérée manuellement. Pas de réessai payant, migration ou application de propositions ; les six ressources de test restent dans le compte, dont C05 sans pièce jointe après son transfert refusé.

Le 22/09, l'accès navigateur avait été bloqué par l'échec de revue automatique lié au quota Codex. Cette condition était levée à la reprise du 24/09. Le serveur local arrêté a été redémarré ; son accès réseau a nécessité l'autorisation d'exécution hors sandbox. Les essais ont ensuite repris par le parcours normal.

## Verdict et périmètre restant

**Le jalon classification n'est pas démontré.** Les sujets simples sont généralement reconnus, mais le corpus révèle des refus EPUB, des pertes de notation mathématique et des propositions de compétences inexactes ou trop liées aux exemples. Les six entrées du lot fournisseur autorisé ont été essayées : quatre restitutions terminées, un échec fournisseur et un refus de transfert. Ces nombres décrivent l'exécution, pas un taux de justesse.

C03, C09, C11 et C12 ont seulement reçu les contrôles locaux ; ils ne faisaient pas partie des six appels autorisés. C06/C07 sont refusés localement. Aucun test chiffré du dialogue sur l'intention personnelle n'a été exécuté. La paire PDF/EPUB Quæ ne peut pas être comparée sémantiquement ici, puisque ses deux analyses n'ont pas abouti. Les notes de cours manuscrites avec formules et les formulations personnelles spontanées restent à ajouter au corpus.

Priorités proposées, sans décision produit ni implémentation dans cette recette : activer le stockage EPUB prévu, traiter les longues sections et préserver ou signaler les notations, revoir les gestes proposés et leur granularité, puis annoter un lot de référence humain avant toute conclusion de qualité. Une reprise payante de C04 doit être explicite.

## Preuves locales

- `scratch/corpus-classification-2026-09-22/manifest.json` : liens et noms locaux.
- `scratch/corpus-classification-2026-09-22/download-results.json` : tailles et empreintes des 14 fichiers (12 entrées et 2 transcriptions).
- `scratch/corpus-classification-2026-09-22/reader-results.json` : résultats par entrée.
- `scratch/corpus-classification-2026-09-22/test-lecteurs.mjs` : harnais reproductible, sans appel fournisseur.
- `scratch/corpus-classification-2026-09-22/C*-extraction.json` : textes locaux pour l'inspection, non publiés.
- `scratch/corpus-classification-2026-09-22/bilan-images-mistral.json` : sorties réelles C08/C10 et opérations de coût de ce lot, lues en base le 24/09.
- Analyses en base : C01 `73e374f4-d224-4c1e-baef-601b0eb6ef94`, C02 `bdf304d7-5e9d-4a6c-a446-a36df6ec7cfd`, C04 `71bff0f9-8956-4744-95b9-b4bfc0b6372d`, C08 `88a5d188-1b1e-4869-af55-9a735233daea`, C10 `25f2f382-0eba-4963-9bf6-f081bca78d9c`.

Les sources et conditions déclarées figurent dans [le catalogue](CORPUS_CLASSIFICATION_2026-09-22.md). Aucun changement de statut humain, migration ou déploiement n'est effectué par cette recette.
