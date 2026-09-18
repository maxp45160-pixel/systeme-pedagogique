# Ménage du code — 18/09/2026

Mandat humain : « vas-y envoie », après la proposition du 17/09.
Source : ai-company/operations/runs/2026-09-17-proposition-menage-code.md.
Réalisation locale des quatre lots ; aucune publication, dépendance nouvelle,
migration, écriture distante ou suppression de données. Les fondations gelées,
les figures préparées et les lectures historiques sont préservées.

Ordre : vestiges, suppression groupée, ancien accueil/création V1, doublons.
Les suppressions sont revérifiées sur le checkout propre de départ
1c7588e6a0e034681047e067906cadc09b4c91cd. UX-0001 garde ses chemins réservés.

Les preuves ciblées et limites figurent ci-dessous. Les résultats des contrôles
globaux et les empreintes de clôture sont conservés dans
`ai-company/operations/missions/MENAGE-0001.json`.

## Lot 1 — vestiges

Références revérifiées, suppression des quatre anciens blocs dashboard, des
deux variantes Dashboard d'intention, de CarteCreationPointillee, Reserves
et deux icônes. Rail/mobile/rappel conservés, comparés à HEAD par AST.
La façade serveur des candidats et dernierDeclencheurDeclare sont retirés,
ainsi que l'option de correction sans appelant dans ZoneReponse.
Trois déclarations inutilisées de tests sont nettoyées sans enlever leurs assertions.
Les trois tests des seules variantes Dashboard retirées disparaissent avec elles ;
les tests imposant leur absence du parcours restent.

Contrôles ciblés : TypeScript et ESLint ciblé verts, 21 tests de composition/
navigation et 94 tests de domaine/onboarding verts. La recette ZoneReponse
passe 8/8 avant et après ; son premier démarrage à froid avait dépassé les
5 secondes de navigation, puis la relance sans changement de code est verte.
Aucun délai du produit ou de la recette n'a été relevé.

## Suppression groupée — défaut corrigé

Recette initiale : deux échecs (attente/rejet) et bilan partiel vert.
La callback retourne maintenant la promesse de l'action réelle : la modale
possède son attente et son erreur ; états et transition doublés retirés.
Le reset de l'ancien état d'erreur à l'ouverture est aussi retiré.
Le sélecteur de la recette accepte le suffixe accessible « Chargement… »
du vrai bouton, tout en exigeant toujours les contrôles désactivés.
Après correction : 3/3 scénarios Edge verts. Actions et refresh simulés,
réseau externe bloqué, aucune suppression réelle. Le rafraîchissement serveur
réel n'est pas couvert par cette recette. TypeScript avec noUnusedLocals
et noUnusedParameters passe sans modifier la configuration.

## Ancien accueil et création V1

AccueilDepot, AccueilDuJour et ses descendants exclusifs OrganisationJour
et accueil-depot sont retirés, ainsi que la façade/écrivain de création V1.
DepotsRecents, VueDepot, création V2, lecteurs V1/V2, corrections et reprises
sont préservés. Comparaison AST de 28 fonctions conservées : identiques à HEAD
hors fins de ligne. Le helper lectureAProposer, appelé seulement par ses tests,
est retiré ; les assertions utiles passent par les sélections/préparations actives.
Les quatre tests du seul accueil quotidien retiré disparaissent avec lui.

Baseline 39 tests pertinents et 4 de l'ancien accueil verts ; après, 58 tests
verts, dont les validations documentaires et un test de lecture V1 complet
(note, restitution sourcée et correction). TS strict noUnused et ESLint ciblé
verts. PRODUCT et le passage historique d'ADR-143 rendent le retrait visible.

## Parcours d'imports partagé

Un collecteur interne unique remplace les deux copies de parcours d'imports
de resoudreNavigationPartagee et resoudreSurfacesPartagees. L'index reste local
à chaque invocation, le Set des visites reste propre à chaque parcours.
Aucun cache global ni changement de reconnaissance des imports.
Deux scénarios protègent cycles/index et fraîcheur après modification ou
suppression : 13 tests passent avant et après extraction (11 existants +2).

La revue indépendante confirme l'extraction exacte du collecteur. Son test de
fraîcheur a ensuite été renforcé : un import auparavant introuvable apparaît
entre deux scans et sa destination devient visible. Les 13 tests restent verts.

## Interactions des graphes partagées

Les deux canvas partagent leurs écouteurs dans lierInteractionsCanvas.
Caméra, simulation, dessin, hit-test et action au clic restent propres à chaque
composant. Bornes de zoom conservées : minimum 0,15 pour les compétences,
0,1 pour le workflow, maximum 4,5. Aucun cache ni état global ajouté.
Dix tests verts ; comparaison des anciens gestionnaires et du helper sur
21 étapes par graphe : traces identiques. TypeScript strict et ESLint ciblé verts.
La revue indépendante confirme refs courantes, callbacks, dépendances d'effets
et nettoyage des cinq écouteurs. Elle n'a pas réexécuté les traces.
Les tests EventTarget ne valident pas la capture native d'un navigateur ;
pointercancel et nettoyage conservent explicitement leur comportement historique.

## Bilan et vérification finale

Le diff des 26 fichiers applicatifs TypeScript modifiés ou supprimés retire
1 156 lignes nettes (180 ajouts, 1 336 retraits), hors tests et scripts de recette.
Ce compte inclut commentaires et espaces ; il ne mesure pas le poids du bundle.
L'inventaire exact des fichiers est le périmètre de MENAGE-0001.

La clôture exige, sur la même empreinte : verify de l'application, recettes
ZoneReponse, accessibilité et suppression groupée, agents:test, build et
agents:check. Les sorties et résultats effectifs sont inscrits dans la fiche de
mission après exécution ; ce rapport ne présume pas leur réussite.

## Revue et limites

Revue indépendante des lots vestiges et suppression groupée : aucun appelant
actif perdu ni import résiduel détecté ; sauvegarde avant navigation intacte,
rejet transmis à la confirmation et bilan partiel conservé. Revue React :
propriétaires des états et nettoyages d'effets préservés, aucun nouvel état métier.
La revue n'est pas une garantie exhaustive de tous les parcours en production.
Les scénarios serveur utilisent des doubles de test et ne prouvent pas un
rafraîchissement Next réel ou l'état des données distantes. Les seuils, règles
d'autorisation, migrations, fournisseurs et protocoles n'ont pas été changés.
