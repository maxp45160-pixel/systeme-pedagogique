# NUIT-0001 — Interruptions, reprise et écritures concurrentes

Mandat : [accord nocturne](2026-09-17-nuit-mandat.md).
Base : e9c6fc76c1866a4dee876e541bda8394abc0bd60 + seuls fichiers de NUIT-0001.
Livraison locale ; aucun déploiement, effet externe ou changement de schéma.

## Défauts reproduits et corrections

1. `ZoneReponse` conservait son état React lorsque le compte ou la tentative
   changeait sans démontage. L'éditeur pouvait alors afficher la réponse de
   l'identité précédente. Une clé du composant interne fondée sur les deux
   identifiants réinitialise désormais cet état.
2. Pendant une sauvegarde, revenir au texte initial supprimait le filet local
   et le gestionnaire de fermeture, alors que l'envoi pouvait encore remplacer
   la valeur en base. L'envoi en vol reste maintenant protégé.
3. Si le serveur avait écrit puis perdu sa réponse, revenir au texte initial
   faisait sauter la réécriture : l'ancienne valeur confirmée était prise pour
   la valeur actuelle. Après échec, cette connaissance devient inconnue (`null`)
   et la sortie attend une nouvelle sauvegarde ; la relance conserve son délai.
4. Retour A → B → A pendant un envoi : l'ancienne instance pouvait effacer ou
   remplacer le brouillon de la nouvelle à la réception de son succès/échec.
   Une instance démontée ne modifie plus ce filet dans ses continuations.
5. Deux clôtures d'interventions lisant la même séance pouvaient annoncer deux
   succès tout en perdant une clôture. L'UPDATE compare compte, id, date, statut
   et interventions précédentes. Un conflit ne modifie rien et demande une
   actualisation explicite.
6. Deux démarrages concurrents pouvaient déplacer la date de début. Le même
   UPDATE conditionnel conserve le premier début. Une relecture retrouve la
   séance ouverte après conflit ou perte de réponse, sans nouvelle écriture.

Les cas 1/2 étaient rouges dans le navigateur avant correction. Les cas 3/4
ont été reproduits indépendamment par QA ; le cas 3 a aussi échoué dans le
script conservé (navigation prématurée vers la correction). Les deux courses
serveur ont des tests rouges observés avant leur correctif, puis verts.

## Vérification et reprise

- `node app/scripts/verify-zone-reponse.mjs` : huit scénarios dans Edge local,
  vrais React et ZoneReponse ; éditeur, navigation et action serveur simulés.
  Couvre changement de compte/tentative, retour texte initial, double raccourci,
  réponse perdue, erreur réseau et continuations d'un ancien écran.
- Tests serveur : 27 tests passés sur actions, concurrence, clôture et réponse.
  Le vrai client PostgREST construit les requêtes ; seul `fetch` est simulé.
  Filtres JSONB, erreurs et retour d'identifiant mal formé sont vérifiés.
- Contrôles voisins : 31 tests passés sur tentative, réponse, clôture et
  démarrage automatique. TypeScript et ESLint ciblés passés.
- Première suite générale : 2438 succès, un timeout du rendu PDF
  `depot-qwen.test.ts` sous concurrence par défaut. Reprise isolée : 5/5 succès,
  621 ms de tests. Vérification finale avec `--maxWorkers=2`, mêmes tests et
  mêmes délais. Les résultats finaux et leurs empreintes sont dans
  [la fiche](../missions/NUIT-0001.json).

Revue indépendante : QA serveur puis QA client. Les deux défauts adjacents
signalés par QA client sont intégrés et couverts par la recette conservée.
Le script utilise Vite/Playwright déjà présents et Edge installé ; aucune
dépendance ni navigateur n'a été téléchargé. Il se lance depuis la racine.

## Contrats et limites

PRODUCT et ADR-030/048/136 relus : correction des comportements déjà décrits,
aucun contrat retiré/remplacé, aucun seuil changé ni statut produit promu.
Les documents courants modifiés par les autres missions sont préservés.
Les liens P02 ne prétendent pas livrer la mémoire future ni le plan global.

La clôture transactionnelle d'exercice est conservée : l'inspection du schéma
local retrouve les verrous et l'écriture conjointe tentative/observations/journal.
Cela ne prouve pas l'état de la base distante, qui n'a pas été interrogée.
Les courses reproduites concernent surtout plusieurs onglets/appareils : Next
sérialise les Server Actions d'un même client. Les autres transitions de séance
ne sont pas déclarées transactionnelles par ce correctif.

Pas de recette distante multi-onglets, de certification RLS, de dialogue natif
de fermeture ni de test de l'éditeur complet. La comparaison JSONB utilise
l'URL PostgREST ; les très grandes compositions restent non éprouvées.
La fermeture forcée d'un onglet, le stockage refusé et les modifications de la
même réponse depuis plusieurs appareils ne sont pas couverts par une promesse
de sauvegarde absolue. Supabase demeure la source de vérité.

Documentation fournisseur consultée pour les filtres et UPDATE :
[Supabase update](https://supabase.com/docs/reference/javascript/update),
[Using Filters](https://supabase.com/docs/reference/javascript/using-filters),
[changelog](https://supabase.com/changelog). Aucun changement pertinent de ces
opérations identifié ; la version installée est aussi testée directement.
