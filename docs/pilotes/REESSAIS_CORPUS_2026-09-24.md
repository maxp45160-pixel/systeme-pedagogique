# Réessais du corpus — 24 septembre 2026

## Mandat

Après les corrections P01-0012, Maxime demande explicitement : « relance les essais ». Ce geste autorise les réessais du lot initial C01, C02, C04, C05, C08 et C10 avec Mistral, dans le plafond cumulé déjà accepté de 2,80 €, conservation des originaux et résultats comprise. Aucun classement ni compétence ne sera accepté pendant la recette.

Base Git : 11ab9ea8176303241c7ff25406f6d5faa4bcf364 avec diff local correctif P01-0012 (lecteur EPUB v2 et contrat de proposition v3), vérifié par 2 760 tests et build. Les changements préexistants sont conservés.

Budget initial relu en base : 414 718 micro-euros comptés pour le lot précédent, dont 160 000 de coût incertain ; 3 341 835 sur le quota mensuel de 5 €. Le disponible réel est donc 1 658 165 micro-euros, inférieur au reste de l’autorisation (2 385 282). Vérification séquentielle avant chaque appel ; aucun contournement ou remise à zéro du compteur.

La comparaison est un jugement d’agent sur documents et propositions, pas une annotation humaine ni la certification d’un taux inférieur à 5 %. Les sorties précédentes sont conservées dans scratch/corpus-classification-2026-09-22/retest-baseline.json.

## Exécution

Les six appels ont terminé via le parcours normal du pilote local, avec Mistral `mistral-medium-3-5`, compteur `envTuteur`, sans changement de code pendant les essais. Aucun bouton « Appliquer ce choix » n’a été actionné ; les propositions sont restées à vérifier, sans création de compétence ni acceptation de classement par l’agent.

C04 a été repris explicitement depuis son échec, avec nouvel OCR. C05 a reçu son fichier EPUB original dans la ressource existante puis a été analysé. La réouverture d’un résultat terminé ne propose pas de réanalyse dans la fenêtre actuelle : C01, C02, C08 et C10 ont donc été réimportés sous un nom daté, avec des octets identiques vérifiés par SHA-256. Leur OCR a été refait ; ce ne sont pas des reprises gratuites du cache. Les anciens résultats sont conservés.

## Résultats et coûts

| Cas | Couverture réellement lue | Propositions | Résultat principal | Coût du réessai |
| --- | --- | ---: | --- | ---: |
| C01 PDF exercices | 4/4 pages | 15 (avant : 13) | Titres anecdotiques et mots tronqués persistent | 0,098510 € |
| C02 PDF exercices | 6/6 pages | 9 (avant : 10) | Erreur « répétitions » disparue ; autres gestes mal identifiés | 0,109035 € |
| C04 PDF bayésien | 20/82 pages | 13 | Échec fournisseur levé ; extrapolations depuis le sommaire | 0,256075 € |
| C05 EPUB bayésien | 6/54 sections | 12 | Transfert et analyse réels réussis ; erreurs de compétence restantes | 0,104442 € |
| C08 image imprimée | 1/1 page | 4 (avant : 4) | « Modéliser » remplacé par « Évaluer », équivalence encore discutable | 0,032834 € |
| C10 image avec manuscrit | 1/1 page | 2 (avant : 0) | Régression : ajout injustifié de « Synthétiser consignes de contribution » | 0,030737 € |

Total de cette relance : **0,631633 €**. Cumul du lot initial et de cette relance : **1,046351 € sur 2,80 € autorisés**. Ce cumul inclut toujours la réservation incertaine de 0,16 € du premier échec C04. Compteur mensuel distant relu après les six appels : **3,973468 € sur 5 €**, soit 1,026532 € disponibles. Ces montants viennent du registre Twiny, pas d’une facture fournisseur vérifiée. Aucun compteur réinitialisé, aucune réservation incertaine libérée manuellement.

C05 a lu les sections **2, 3, 4, 5, 7 et 15**, sélectionnées dans les bornes de texte ; elles ne sont pas contiguës. La couverture graphique et les notations non prises en charge restent explicitement exclues. C04 et C05 ne représentent donc pas deux lectures alignées du même contenu. Aucune tranche suivante n’a été lancée : le parcours demande d’abord une confirmation humaine du classement courant.

## Comparaison sémantique indépendante

Relecture par le sous-agent QA sur les textes réellement transmis, avec examen de l’image C08. Les défauts suivants sont des jugements d’agent sourcés, pas une annotation de référence humaine :

- **C01** : « Calculer nombre de bises échangées » et « Calculer nombre de tenues vestimentaires possibles » restent trop liés au récit. Les précisions « au moins 6 bonnes répons » et « enfants de sexes diffé » sont tronquées. L’union d’événements disjoints est mieux distinguée, mais la synthèse ajoute encore les probabilités conditionnelles sans consigne correspondante.
- **C02** : la catégorie fautive « avec répétitions » disparaît. En revanche, « Calculer probabilité d’une intersection » cite un exercice où l’intersection est déjà donnée et où l’on demande des probabilités conditionnelles. L’exercice demandant un nombre minimal d’achats est encore décrit comme un calcul de probabilité de succès. La précision « avec événements indépend » est coupée.
- **C04** : plusieurs gestes pratiques ne sont étayés que par le sommaire ou une annonce de chapitre futur. « Implémenter méthodes MCMC » cite de la quadrature et du tirage direct `rbeta`, qui ne démontrent pas une implémentation par chaîne de Markov. « Simplifier intégrale » n’est pas équivalent à l’approximer.
- **C05** : « Simplifier modèles linéaires généralisés » s’appuie sur des titres, sans geste de simplification. La régression linéaire est notamment justifiée par un exemple de régression logistique. D’autres propositions, dont la configuration de priors et l’évaluation de convergence, ont un support pratique dans la section 7.
- **C08** : « Évaluer risque de publication » est lexicalement plus plausible que « Modéliser comportement de publication ». Toutefois, le support prescrit de ne pas publier de contenu trop personnel ; il n’enseigne pas l’analyse des conséquences ajoutée par la justification.
- **C10** : la consigne demande de recopier un texte. Elle ne demande pas de synthétiser les consignes. L’apparition de cette seconde proposition constitue une régression par rapport à la sortie précédente, qui s’abstenait de proposer une compétence. Le rattachement HTR concerne le projet de collecte, pas une compétence technique démontrée chez le contributeur.

Pour C01, C02, C08 et C10, le texte OCR est strictement identique entre les deux essais. Les différences sont donc dans la restitution ; un seul tirage avant/après ne permet pas de séparer l’effet du prompt de la variabilité du modèle. Les 108 occurrences de citations des compétences sont présentes dans la page ou section désignée. Une citation présente au bon endroit ne suffit pas à prouver que la compétence proposée y est enseignée.

## Conclusion de recette et suite

**6/6 traitements techniques terminés ; jalon qualité non validé.** La lecture réelle de l’EPUB est débloquée et l’échec C04 ne s’est pas reproduit. Les consignes renforcées ne suffisent pas à fiabiliser les compétences : transfert entre situations, équivalence du geste, pertinence des preuves et formulation complète restent à corriger. Cette campagne n’établit ni un taux d’erreurs inférieur à 5 %, ni un taux d’omissions inférieur à 5 %.

La prochaine correction doit cibler ces contre-exemples conservés, en distinguant les titres de sommaire des gestes effectivement enseignés et en refusant les substitutions de geste. La validation du résultat demandera une référence humaine et une mesure séparée des erreurs et omissions. Le corpus C10 contient une version imprimée du texte manuscrit : il ne permet pas de certifier isolément la qualité de l’OCR manuscrit. Cette relance n’évalue pas non plus le dialogue prolongé sur le contexte personnel, ni le rattachement hiérarchique après validation humaine.

Les contrats PRODUCT/ADR restent exacts : limites de couverture explicites et seuils non démontrés. Aucun nouveau contrat produit, changement de code, commit, push ou déploiement frontend pendant cette recette.

## Traces reproductibles

Les transcriptions, couvertures, propositions et lignes de coût sont conservées localement dans `scratch/corpus-classification-2026-09-22/retest-results.json` ; les références précédentes dans `retest-baseline.json` et `retest-baseline-c10.json` ; la revue indépendante dans `retest-qa.md`.

| Cas | Analyse conservée | Ressource |
| --- | --- | --- |
| C01 | `281d6da7-1773-410b-ad9d-44ec7c58f7df` | `depot-008f6874c521d4a930b41b63beb0033a` |
| C02 | `b4c26c1a-f623-4fbe-94d4-24cc7b5c4e85` | `depot-22baef82ede31785d84ebf2c97aa319a` |
| C04 | `79ba33ab-4efc-4fc1-b2d4-a53b569100aa` | `depot-0787d9ed07077f84073368af2df3fb96` |
| C05 | `5694d41d-29d6-4138-909a-46a578a89d2d` | `depot-d3a5423144c97dceb405be3338a16252` |
| C08 | `d24fd351-8269-4b5e-8f26-91ed811afc76` | `depot-5f57ec12168dc224d6ae56ff62bb30b5` |
| C10 | `5dd57f30-ee25-4d3b-b164-11ecef400dde` | `depot-dd5da470c3f987c1937254202e33afa0` |
