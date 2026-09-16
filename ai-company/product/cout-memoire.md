# Coût de la mémoire intelligente — estimation de cadrage

Date : 16/09/2026. Demande : Maxime demande si le coût menace la chaîne supports
→ compréhension → proposition d'organisation dans le knowledge graph → challenge
personnel et plan de travail. Sources humaines dans le [dossier](cadrage-direction.md).
**Simulation explicite, pas un devis ni une facture ; aucune dépense autorisée.**

**Rectification du copil après discussion :** l'estimation a été présentée trop
rassurante au regard de sa portée. Elle rend plausible un coût API personnel
abordable sous les hypothèses ci-dessous ; elle ne démontre ni le coût total
d'une mémoire fiable, ni le temps de correction, ni la qualité du suivi personnel.
La priorité proposée est de mesurer fidélité et charge réellement déléguée avant
d'optimiser les coûts. Aucun plafond ni changement de budget n'est décidé.

**Précision humaine reçue après l'estimation :** Maxime considère déjà 100 nouvelles
pages mensuelles comme beaucoup, avec des cours environ la moitié de l'année en
alternance. Il privilégie la valeur du produit et se dit disposé à payer. Ce n'est
ni un plafond chiffré ni une autorisation de dépense ; stock initial et nombre
d'échanges restent inconnus. Le scénario 100 pages est donc un repère de discussion,
pas une prévision validée. [Source et portée](cadrage-direction.md#précision-humaine--volume-modeste-et-priorité-à-la-qualité).

## Tarifs vérifiés et hypothèses

Tarifs publics standard USD consultés le 16/09, sans réduction batch/cache ni
majoration régionale, hors taxes : [documentation Mistral](https://docs.mistral.ai/inference/pricing)
et [tarifs API](https://mistral.ai/pricing/api/).

| Opération | Modèle pris comme base de calcul | Tarif |
|---|---|---|
| OCR | OCR 4.1 | 4 USD / 1 000 pages |
| Analyse et échanges | Medium 3.5 | 1,50 USD / million de tokens entrants ; 7,50 USD / million sortants |
| Indexation sémantique | Mistral Embed | 0,10 USD / million de tokens |

Ce choix fournit une base comparable au pilote ; ce n'est pas une recommandation
exclusive de fournisseur ni une validation de qualité pour les manuscrits.

Hypothèses inventées pour la simulation, à remplacer par les volumes réels :

- Toutes les nouvelles pages passent par OCR une seule fois.
- Par page : 1 000 tokens indexés ; analyse et rapprochements totalisant
  4 000 tokens entrants (instructions et contexte ancien sélectionné inclus)
  et 400 sortants. Ce sont des budgets cumulés supposés, pas des mesures de Twiny.
- 100 échanges mensuels pour recherche, challenge ou plan, chacun totalisant
  20 000 tokens entrants et 2 000 sortants ; coût de ces échanges : 4,50 USD.
- Les tokens de raisonnement éventuellement facturés doivent tenir dans ces
  budgets de sortie ; s'ils s'y ajoutent, ce calcul sous-estime le coût.
- Pas de relecture intégrale de toute la bibliothèque à chaque apport ; pas de
  reprise supplémentaire ni de réindexation globale dans le calcul de base.

## Calcul reproductible

Pour P nouvelles pages par mois :
`C = P × (0,004 + 4000×1,5/1000000 + 400×7,5/1000000 + 1000×0,1/1000000) + 4,50`
soit `C = 0,0131 × P + 4,50` USD.

| Nouvelles pages/mois | OCR | Analyse et liens | Indexation | 100 échanges | Total API simulé |
|---|---|---|---|---|---|
| 100 | 0,40 USD | 0,90 USD | 0,01 USD | 4,50 USD | 5,81 USD |
| 500 | 2,00 USD | 4,50 USD | 0,05 USD | 4,50 USD | 11,05 USD |
| 2 000 | 8,00 USD | 18,00 USD | 0,20 USD | 4,50 USD | 30,70 USD |

Import initial distinct : 10 000 pages coûteraient 131 USD avec les mêmes
hypothèses d'analyse, avant échanges, sans prétendre qu'un tel corpus est celui
de Maxime. Doubler arbitrairement toute l'enveloppe du scénario 500 pages pour
une marge d'essais/contrôles donne 22,10 USD : sensibilité, pas plafond garanti.

Exclus : stockage, base, recherche/reranking supplémentaire, hébergement, transferts,
abonnements de développement/Codex, temps d'ingénierie et relectures humaines,
reprises et contrôles au-delà des budgets supposés, TVA et change. Les engagements
existants d'hébergement n'ont pas été inspectés ; aucun coût total mensuel garanti.

## État réel examiné par le CTO

Sous-agent natif `cout_memoire`, lecture seule, modèle/effort hérités. Références :
[contrat/tarifs](../../app/src/lib/documents/depot.ts),
[traitement](../../app/src/lib/store/depot-analyse.ts),
[requête](../../app/src/lib/tutor/depot-mistral.ts),
[registre des essais](../../docs/pilotes/DEPOT_DOCUMENTAIRE.md).

- Branché : originaux → OCR sur tranche de 20 pages au plus → restitution sourcée
  et proposition de domaines/compétences. Le référentiel actif entier accompagne
  la restitution ; la bibliothèque documentaire entière ne l'accompagne pas.
- Modèles locaux versionnés OCR 4.1 et Medium 3.5, tarifs de référence datés
  du 06/09, cohérents avec la vérification web de ce tour.
- Transcriptions conservées et réutilisables aux reprises explicites. Pas de
  retry payant automatique. Les PDF numériques passent aussi par l'OCR ici.
- Compteur documentaire : 5 EUR/mois, avec conversion volontairement majorante
  de 2 EUR par USD. Ce compteur n'est ni une facture ni un taux de change réel.
  Réservation maximale actuelle : 0,42288 EUR par synthèse V2 ; 0,58288 EUR avec
  20 pages OCR. Ne pas confondre maximum réservé et consommation finale.
- Observations historiques : 13 pages, un OCR et cinq synthèses pour une première
  restitution aboutie, 0,508121 EUR décomptés prudemment. Essai ultérieur interrompu :
  0,299466 EUR restés réservés, facture inconnue ; reprise : 0,138984 EUR décomptés,
  citation recomposée rejetée. Ces essais de développement ne sont pas une moyenne
  d'usage. Le coordinateur a relu les échecs et montants dans le registre.
- Le chemin de restitution exclut tâches/priorités/échéances ; mémoire transversale
  intelligente et plan global ne sont pas démontrés par ce pipeline. Le plan global
  reste non raccordé. La borne de 100 000 octets et l'envoi de tout le référentiel
  limitent aussi l'extrapolation vers une grande bibliothèque.

## Avis et condition de révision

Avis : le coût variable API ne justifie pas d'abandonner cette direction pour un
usage personnel. Confiance modérée pour l'ordre de grandeur conditionnel ; faible
pour la facture finale tant que volumes, corpus et taux de reprise sont inconnus.
Recommandation : analyser les nouveautés, conserver les extractions, rechercher des
candidats pertinents dans la mémoire, approfondir seulement les liens utiles. C'est
une orientation à instruire, pas une architecture validée.

Meilleure objection : cette sélection peut rater les rapprochements inattendus
qui font la valeur de Twiny. Changer de méthode si les exemples attendus par Maxime
restent introuvables ; changer de budget ou de périmètre si atteindre la qualité
exige des relectures massives, des modèles plus chers ou trop de reprises.
L'option minimale à comparer serait la recherche de sources sans organisation
intelligente, mais elle ne satisfait pas toute la valeur explicitement demandée.

Prochaine information : nouvelles pages mensuelles et stock initial à reprendre.
Avant toute dépense : corpus représentatif et enveloppe explicitement autorisés,
avec mesure coût, fidélité des formules/citations, pertinence des liens et corrections
humaines. Aucun essai fournisseur ni nouveau budget dans cette mission.
