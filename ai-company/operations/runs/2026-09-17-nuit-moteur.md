# NUIT-0002 — Robustesse du moteur longitudinal

Mandat : [autonomie nocturne](2026-09-17-nuit-mandat.md).
Base : e9c6fc76c1866a4dee876e541bda8394abc0bd60 + diff local de la nuit.
Aucun seuil, poids, protocole de mesure ni donnée distante modifié.

## Corrections et preuve

- Les observations étaient triées par leur chaîne de date : un décalage horaire
  pouvait inverser les deux derniers faits. Elles sont comparées par instant.
- Des faits simultanés donnaient niveau 3 ou 4, et changeaient la maîtrise,
  selon l'ordre de chargement. Leur identifiant stabilise la présentation,
  mais n'établit pas de chronologie : les candidats à la frontière des deux
  dernières observations doivent tous être des échecs A2+ pour affirmer la
  baisse existante. Un groupe ambigu est signalé ; les contradictions restent
  conservées. Les gardes de trois observations et de deux derniers échecs sont
  inchangées, comme les cas non ambigus et les échecs simultanés unanimes.
- Les facteurs d'explication affichaient `0.00` pour une dimension absente.
  Ils affichent désormais « non observée ». Un zéro explicitement observé
  reste `0.00`. Une réserve signale la couverture partielle et la limite du
  calcul actuel. Aucun score n'a été renormalisé.
- La prose d'ADR-042 promettait qu'une contradiction retirait automatiquement
  la maîtrise, contrairement à sa formule et au code. La phrase est corrigée ;
  le prédicat de maîtrise ne change pas. PRODUCT conserve les statuts humains
  tout en précisant la réserve P2 au niveau des dimensions.

QA a reproduit quatre scénarios de chronologie rouges avant correction puis
verts. Le test de transparence a également échoué sur `0.00` avant correction.
Les tests portent sur permutations (y compris identifiants extrêmes), fuseaux,
échecs simultanés, frontière de l'avant-dernier fait et gardes inchangées.

## Couverture supplémentaire

`invariants-longitudinaux.test.ts` couvre 24 historiques synthétiques × quatre
propriétés : invariance des états/agrégats à la permutation ; invalidation de
toutes les preuves puis restauration ; extension sans preuve qui ne réduit
pas le score existant ; rectification sans effet sur les compétences voisines.
La précondition exige des états effectivement évalués et un score non nul ;
un moteur ignorant toutes les preuves ne peut pas satisfaire ces tests.
Les données d'entrée sont comparées avant/après pour contrôler leur intégrité.

La campagne existante croise six archétypes, cinq graines et huit politiques,
soit 240 parcours de 540 jours. Le répertoire de sortie peut désormais être
fourni par `CAMPAGNE_SORTIE` ; la valeur par défaut reste `.simulation`.
La recette nocturne écrit dans `app/.simulation/nuit-20260917/` afin de préserver
les rapports historiques. Les résultats effectifs, commandes et empreintes
finales sont conservés dans [la fiche](../missions/NUIT-0002.json).

## Limites

La campagne est synthétique : ses aptitudes et « vérités terrain » sont celles
du simulateur, pas des étudiants. Elle ne valide ni calibration ni efficacité
pédagogique réelle. Les constats de comparaison aux témoins ne justifient aucun
changement de seuil dans cette mission.

P2 n'est pas entièrement résolu à l'échelle des dimensions : le tableau
numérique et le score existants utilisent encore zéro pour certaines absences.
Leur nouvelle explication rend cette limite visible ; le choix d'un score
partiellement observé nécessite un arbitrage distinct. Aucun remplacement
silencieux de la formule du protocole n'a été effectué.

La correction des ex aequo applique le refus d'inventer l'ordre (protocole
anti-hallucination §7). Elle ne prouve pas une chronologie réelle lorsque les
timestamps sont égaux et ne supprime aucune faiblesse historique.
Les audits et tests sont locaux, sans fournisseur, migration ou publication.
