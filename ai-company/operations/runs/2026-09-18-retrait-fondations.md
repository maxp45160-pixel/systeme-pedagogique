# Retrait complémentaire — 18/09/2026

Accord de Maxime : « vas-y supprime tout ça », après présentation des fondations
de planification non raccordées (~3 300 lignes), d'Indicateur, du temporaire
de diagnostic et des répétitions de la fiche de vérification.

Retirer ces branches et leurs tests exclusifs, préserver les helpers réellement
appelés, les séances et protocoles actifs ainsi que les données/migrations.
Actualiser PRODUCT, ADR-139 et les contrats qui décrivaient leur conservation.
Supprimer uniquement `.tmp-direction-resume-18.txt` parmi les temporaires.

Le suivi stockera une seule copie de chaque empreinte et une référence par
contrôle, avec lecture des anciennes fiches et même contrôle de fraîcheur.
Le constat initial est 9 copies identiques dans MENAGE-0001 (1 718 lignes).
La conversion conserve les preuves historiques, sans les renouveler.

Livraison locale. Les résultats effectifs des contrôles et la transmission
figurent dans MENAGE-0002 ; aucun effet distant ni nouvelle dépendance.

Retrait réalisé : 15 fichiers supprimés, 6 allégés ; 3 409 lignes applicatives
et 1 333 lignes de tests exclusifs retirées nettes. Les moteurs utilisés et les
deux suites SQL historiques sont conservés. Après la première tranche, leurs
empreintes étaient identiques ; seuls deux helpers sans appelant, déjà inutilisés
avant le retrait, ont ensuite été retirés des modules partagés. Le test du refus
d'une proposition reste, avec deux références explicites distinctes.
Première tranche : 107 tests avant, 54 après retrait des 53 cas exclusifs, verts.
TypeScript strict et ESLint ciblé passent. Aucun import résiduel des retraits.
Derniers helpers : 28 tests avant, 26 après, verts ; les autres déclarations
et imports applicatifs sont identiques par comparaison AST.

Déduplication : 26 tests outillage de référence passent avant, 32 après.
MENAGE-0001 passe de 1 718 à 345 lignes, de 65 067 à 14 447 octets, par mise
à jour conditionnelle quand ses preuves étaient encore fraîches. Les neuf
contrôles conservent la même empreinte ; les changements documentaires
ultérieurs la rendent historique, sans la renouveler. Retour possible au
format inline puisque sa lecture est conservée ; aucun contrôle supprimé.

La revue indépendante du suivi a exécuté ses 32 tests : références inconnues,
empreintes altérées, preuves ambiguës et clôtures périmées restent refusées.
Une empreinte ne prouve toujours pas l'exécution d'une commande ; les résultats
sont ceux réellement observés, sans changement de permissions ni de critères.
La revue du retrait n'a trouvé aucun appelant actif perdu. Elle a vérifié les
compositions, helpers conservés et tests mixtes sans appel à la base distante.

Premier contrôle global interrompu par des erreurs de types du chantier
documentaire P01-0006 concurrent ; son propriétaire les a corrigées et annoncé
ses fichiers stables. Les résultats de la relance finale figurent dans la fiche.

Coordination documentaire P01-0006 : à la demande de sa tâche propriétaire,
intégration ciblée de ses faits vérifiés dans PRODUCT et ADR-143 sous la propriété
MENAGE-0002. Source : `2026-09-18-references.md`, accord local de Maxime et code
relus. Cette correction documentaire n'est pas un gain du ménage ni une
validation du fournisseur réel. Une fiche P01-0006 momentanément invalide a
bloqué une mise à jour ; son propriétaire l'a corrigée avant la clôture.
