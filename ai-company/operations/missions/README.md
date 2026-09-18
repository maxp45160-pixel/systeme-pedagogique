# Fiches d'exécution

Une fiche JSON par réalisation non triviale, nommée comme son `id`.
L'ordre lexical des identifiants départage les missions `ready`. Le coordinateur
attribue cet ordre dans le périmètre de priorité approuvé ; il ne crée pas de
priorité produit par renumérotation. La [procédure](../../workflows/mission.md)
et le [mandat](../autonomy.md) décident, le script vérifie la structure.

Commandes : `npm run agents:check`, `npm run agents:next`, `npm run agents:test`.
La sélection est en lecture seule ; aucun script n'exécute le travail ni ne
réserve les fichiers du produit. Un seul coordinateur écrit la file par checkout.
La mise à jour conditionnelle ci-dessous protège les fiches entre écrivains
coopératifs ; un éditeur direct peut la contourner.

## Champs

| Champ | Contrat |
|---|---|
| `id`, `title`, `objective` | Identité stable, résultat demandé. Le nom du JSON correspond à l'id. |
| `authorization` | `source` : fichier du dépôt portant la demande/décision ; `summary` : portée, accords déjà donnés et limites, y compris tout budget exceptionnel. Une source existante ne prouve pas un accord. |
| `status` | `ready`, `running`, `blocked`, `done`, `cancelled` : états d'exécution uniquement. |
| `scope` | Chemins relatifs réels de fichiers ou répertoires possédés, éventuellement futurs ; aucun secret ou chemin hors dépôt. Les alias et jonctions, même internes, sont refusés pour empêcher le contournement des collisions. |
| `owner` | Tâche/coordonateur responsable ; obligatoire en cours, bloqué et terminé. |
| `baseCommit` | Base Git de 7 à 40 caractères hexadécimaux ; relire le diff courant en plus. |
| `acceptance` | Critères observables non vides. Leur présence n'atteste pas leur satisfaction. |
| `nextAction`, `blocker` | Étape concrète ; motif non vide si bloqué, sinon `null`. |
| `checks` | Liste de `{command, result, at, revision}` ; résultat `passed`, `failed` ou `blocked`. Date ISO avec fuseau. Une preuve version 1 porte `snapshot` ou `snapshotRef`, exclusivement. |
| `snapshots` | Pool facultatif des preuves version 1, indexé par le SHA-256 du `JSON.stringify(snapshot)` exact. Plusieurs contrôles peuvent référencer le même objet. |
| `externalActions` | Effets externes accomplis ou incertains et leur preuve, sans secret ; liste vide si aucun. |
| `updatedAt` | Date ISO avec fuseau du dernier point de reprise. |
| `completion` | `null` avant clôture ; `{summary, evidence, at}` ensuite. `evidence` contient des fichiers de preuve du dépôt. `done` exige des contrôles tous passés ; `cancelled` exige motif/source. |

Une nouvelle étape de test remplace son ancien résultat dans `checks` ; garder
les échecs historiques et leur résolution dans le fichier de preuve. Ne pas
supprimer un échec non résolu. Aucun transcript privé ne rejoint ces fiches.

`next` ignore les missions closes, en cours et bloquées ; il exclut aussi les
missions prêtes qui chevauchent les chemins d'une mission en cours ou bloquée.
Deux missions en cours ou bloquées ne peuvent pas réserver des chemins qui se chevauchent.
Une fiche invalide fait échouer le contrôle et empêche la sélection. Les conflits
de chemins sont comparés sans casse, conformément au poste Windows partagé.

Les chantiers antérieurs suivis ailleurs restent à leur propriétaire. Une
migration vers ces fiches exige un transfert explicite ; elle n'autorise pas
de reprendre leur code ou de les déclarer terminés.

## Mise à jour et preuves du checkout — extension DIR-0001

### Transmission au copil — extension CONT-0001

Pour une nouvelle mission produit liée au plan, appliquer la
[continuité direction-terrain](../../workflows/continuity.md). `planLinks` contient
des `{source, requirement, scope}` : document d'exigences, identifiant stable et
contribution bornée. Les sources/identifiants sont contrôlés par `agents:check`.
Les liens font partie du contrat protégé par `update`.

`handoff` conserve `{delivered, remaining, evidence, deployment}` ; déploiement
`{status, evidence}`, statut parmi `not-deployed`, `unknown`, `verified`.
Une mission liée ne peut passer en `done` sans transmission ; `verified` exige
une preuve locale pointant vers l'observation distante. La véracité de cette
preuve n'est pas certifiée par le script. Préparer la transmission avant les
tests finaux : son contenu et ses preuves participent au snapshot.

Les anciennes missions restent compatibles. Les liens historiques dans
`product/plan-index.json` n'altèrent ni leurs accords ni leurs preuves. La vue
`agents:progress` et `agents:resume` les rendent visibles, même terminées, sans
conclure que l'exigence entière est satisfaite. Les tâches non reliées restent
visibles pour repérer un oubli de rattachement.

### Empreintes et mises à jour conditionnelles

Les nouvelles réalisations utilisent `verificationVersion: 1` et une liste
`requiredChecks` de commandes requises, fixée avant leur exécution. Les anciennes
fiches restent des archives déclaratives, sans promotion automatique.

`node ai-company/scripts/missions.mjs snapshot ID` produit une empreinte du
contrat et de tous les fichiers des scopes (ajouts/suppressions inclus), plus
la source d'autorisation et les dépendances de lecture facultatives `inputs`.
Ces chemins lus n'attribuent aucune propriété d'écriture. La fiche elle-même et les fichiers temporaires cachés
du registre sont exclus pour éviter l'autoréférence. Une dépendance lue mais
hors scope/inputs n'est pas couverte : la déclarer dans `inputs` si elle
conditionne la preuve. Ne pas inclure secrets ou répertoires sans rapport.

Avant les contrôles, conserver cette empreinte ; après leur exécution, vérifier
qu'elle est inchangée et joindre cet objet dans `checks[].snapshot`, avec la
commande exacte, résultat, date et révision. Pour éviter de recopier un snapshot
identique, on peut le placer une fois dans `snapshots[empreinte]` et porter cette
empreinte dans `checks[].snapshotRef`. `empreinte` est le SHA-256 du
`JSON.stringify(snapshot)` sans indentation, avec l'ordre des champs conservé.
Les anciennes preuves inline restent acceptées, ainsi qu'une fiche mixte.
La version de vérification reste 1 : seul le rangement des preuves change.

Une référence inconnue, un pool mal formé, une empreinte incorrecte ou un
contrôle portant à la fois `snapshot` et `snapshotRef` sont refusés. Le snapshot
résolu est toujours comparé intégralement au snapshot courant, contrat compris.
La reprise affiche `snapshotPresent` et la référence sans développer le pool ;
la présence seule ne garantit pas la fraîcheur.

`compactMissionSnapshots(mission)`, exporté par `ai-company/scripts/missions.mjs`,
retourne une copie dédupliquée d'une fiche version 1. Cette fonction pure ne lit
pas le checkout, n'écrit aucun fichier, ne remplit aucune preuve manquante et ne
modifie ni résultats, ni dates, ni contrat. Elle ne promeut pas les archives
déclaratives en preuves vérifiées. Le coordinateur enregistre le candidat avec
`update` ci-dessous ; une archive périmée reste refusée, même pour sa conversion.

Un snapshot **ne lance aucun test**.
Le coordinateur conserve aussi le résultat réel et la revue dans la preuve de
clôture. Aucun succès n'est inféré d'un JSON écrit par le développeur.

Pour enregistrer le candidat JSON préparé, utiliser :

```powershell
# SHA256 de la fiche lue, disponible aussi dans agents:resume.
Get-Content -LiteralPath $candidat -Raw | node ai-company/scripts/missions.mjs update DIR-0001 $empreinteLue
```

`update` prend un verrou exclusif du registre, compare l'empreinte attendue,
valide les chemins/collisions et remplace atomiquement la fiche. Un même candidat
déjà appliqué est sans effet ; une autre écriture concurrente est refusée, sans
réessai automatique. Autorisation, périmètre, objectif, critères et commandes
requises ne se modifient pas par cette commande. Un changement de contrat exige
une relecture de l'accord et une édition explicite par le coordinateur, dans le
mandat applicable ; cette édition n'est pas une authentification humaine.

Clore via `update` en `done` refuse tout contrôle requis manquant/échoué et toute
empreinte périmée. `done` désigne une clôture locale **à sa date**, pas un merge
ni un déploiement. Quand un chantier ultérieur change les entrées, `check` avertit
que les preuves historiques sont périmées pour le nouveau checkout ; il ne
rouvre pas les anciennes missions. `resume` expose ces limites. Ne pas présenter
une preuve historique comme validation du nouveau travail.

Un verrou laissé après interruption reste bloquant : lire son propriétaire/PID,
vérifier qu'aucun écrivain ne travaille et organiser explicitement la reprise
avant de retirer ce seul verrou. Son âge ne suffit pas. L'outil n'effectue aucune
écriture externe, approbation, réservation d'API ni lancement d'agent.
