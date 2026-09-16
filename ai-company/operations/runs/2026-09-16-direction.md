# DIR-0001 — Audit et consolidation de la direction

Relevé du 16/09/2026. [Mandat humain](2026-09-16-direction-mandat.md),
[spécification intégrale](../TWINY_SPEC_DIRECTION_EQUIPE_IA.md),
[fiche d'exécution](../missions/DIR-0001.json). Les résultats finaux et leur
empreinte sont dans la fiche ; cette note distingue toujours constat et limite.

## Cartographie unique et décisions d'implémentation

| Dimension | Déclaré | Branché | Observé dans DIR-0001 | Testé et limite | Choix |
|---|---|---|---|---|---|
| Direction | Contrats Chief/Product/CTO/QA/Research | Cinq TOML `.codex/agents`, accessibles dans `spawn_agent` ; `common.md` et workflows | Product et QA lancés réellement, livrables reçus séparément | Tests des scripts ; aucune garantie de jugement général | Conserver les cinq rôles ; copil porté par Chief et procédure |
| Mémoire | PRODUCT/ADR canoniques, DEC organisation, index dérivés | `check.mjs`, `missions.mjs`, `context.mjs`, package scripts | Ancien context ne produisait que Git ; deux fiches retrouvées | 29 tests initiaux ; fraîcheur absente initialement | Étendre context et fiches, pas de nouveau stockage |
| Permissions | Périmètres et escalades dans common/autonomy | Session `workspace-write`, réseau restreint, revue automatique des escalades ; profils sans override | Ouverture en écriture de `.codex/config.toml` refusée, aucun octet écrit, hash inchangé | Refus observé du parent ; périmètres par rôle non imposés | Pas d'extension ; un écrivain et analyses natives bornées |
| Qualité | Critères, commandes, révision, revue, `done` | `agents:check`, `agents:test` raccordés à `verify` | Référence 29/29 ; QA reproduit faux succès déclaré et preuve devenue obsolète | Extensions testées hors ligne, résultats dans fiche | Empreintes, commandes requises et contrôle de clôture |
| Dépenses | Héritage, essai manuel DEC-0002 limité USE-0002 à USE-0006 | Sélection assistée par le coordinateur, aucun routeur logiciel trouvé dans ai-company/package/profils | Délégations sans override, aucun appel fournisseur distinct | Pas de télémétrie tokens/coût attribuable ; budget global Codex opaque | Réduire le contexte et réutiliser l'existant ; aucun nouveau routeur ni API |
| Utilité | Challenger la direction et aider au cahier des charges | Workflows situation/new-idea existants, copil ajouté au contrat commun | Product relève une contradiction et trois tensions ; dossier concret rédigé | Reprise en processus neuf ; pertinence finale réservée à Maxime | Dossier canonique proposé, huit exigences, arbitrages et prochaine tranche |

La chaîne réelle est : demande dans Codex → instructions AGENTS/contrat commun
→ workflow + sources → sous-agent natif si utile → outils autorisés par le runtime
→ retour → revue du coordinateur/QA → fiche et dossier locaux → restitution.
Les scripts n'invoquent pas de modèle et ne pilotent pas les outils Codex. Leur
existence ne prouve ni orchestration autonome ni contrôle global du compte.

Pour chaque rôle : Chief est déclaré/branché via TOML et workflow ; Product et
QA sont observés dans cette mission ; CTO et Research sont déclarés/branchés,
non relancés ici faute de sous-mission distincte utile. Les historiques restent
dans les rapports du 15/09, sans les transformer en nouvelle observation.

## Lacunes confirmées et premier lot minimal

| Écart | Référence / conséquence | Correctif local | Acceptation |
|---|---|---|---|
| Reprise Git seule | `context.mjs`, ancien `queries` : décisions et blocages non collectés | `resumeContext`, commande `agents:resume`, sources et statuts déclarés | M1/M2/R1, processus neuf |
| Preuve périmée acceptée | `validateMission`, `checkMissions` : `revision` libre, fichier de preuve seulement existant | `snapshotMission`, `verificationErrors`, commandes requises et clôture contrôlée | T1/T2, refus via `updateMission` |
| Écrasement coopératif | Deux lecteurs puis deux écritures JSON : dernière écriture gagne | `updateMission` : verrou exclusif + révision attendue + remplacement atomique | M4, deux vrais processus CLI |
| Accord seulement textuel | `checkCompany` accepte une fausse mention humaine non vide | Ne pas importer de statut ; contrat immuable par CLI, lecture des sources humaines et limite explicite | M3/P3 ; authenticité humaine non certifiée |
| Critique non évaluée | `scoreResponse` vérifie seulement choix et raison non vide | Workflow copil et dossier avec sources, objections, réfutation et revue distincte | D1/D2 et protocole qualitatif |
| Contradiction produit | PRODUCT §3 dit plan calculé ; état courant/§6 et ADR-139 disent retiré | Signalement précis au propriétaire UX-0001, pas d'édition concurrente | Recherche du consommateur TableauBordOrchestration et lecture des sources |

Éléments conservés : noms des agents, permissions, modèles hérités, mémoire
Markdown, registres DEC/ADR, file JSON, outils Node et huit cas historiques.
Aucun framework, base vectorielle, routeur, compteur financier fictif, agent
supplémentaire, watcher, pipeline distant ou nouvelle destination produit.

## Référence et vérifications

Environnement : Windows/PowerShell, Node `v24.13.0`, npm `11.6.2`, base Git
`60c8617cdf94b09a855f42a611fce7bdd6763056`, checkout partagé avec modifications
préexistantes. Aucun install. Scripts lus avant exécution : modules Node locaux,
fixtures temporaires et sous-processus Node/Git ; pas de fournisseur, migration
ni secrets. Les fixtures ne sont jamais des faits pédagogiques.

Référence avant modifications fonctionnelles :

- `npm run agents:check` : 49 documents, 322 liens, 2 missions cohérentes.
- `npm run agents:test` : 29 tests, 29 réussis, aucun ignoré.
- QA reproduit dans des fixtures : succès déclaré sans vraie exécution accepté,
  changement de fichiers non détecté, deux écrivains avec perte du premier,
  fausse provenance textuelle acceptée. Ces tests établissent les limites initiales.

Premier essai après extension : 34/35 passent. Le second processus rencontre
ENOENT lors d'une inspection du verrou que le premier vient de retirer.
Correction : le verrou transitoire n'est plus inspecté avant `openSync(...,"wx")` ;
le parent est validé, `wx` refuse tout verrou existant, y compris un lien.
Nouvel essai : 35/35. Les tests ultérieurs et leur empreinte finale sont dans la
fiche ; aucun résultat antérieur n'est extrapolé à un patch ultérieur.

Les tests applicatifs/build/navigation/DB ne sont pas relancés : aucun fichier
produit modifié par cette mission, et les effets réels restent à UX-0001.
Le test de permissions utilise uniquement l'ouverture d'un handle en écriture
sur un fichier de configuration existant, sans écrire ni tronquer : refus
`UnauthorizedAccessException`, comparaison SHA256 avant/après identique.

## Recette du mandat et couverture réelle

| Cas | Test ou protocole | Résultat / limite |
|---|---|---|
| M1 | Test processus neuf `resumeContext` ; commande réelle `agents:resume -- DIR-0001` | Décisions, références, objectifs, travaux ouverts et limites retrouvables ; aucun chat requis |
| M2 | Fixture ancienne décision superseded, nouvelle accepted | Statuts/source/remplacement restitués ; le sens de l'arbitrage reste à relire, pas d'application automatique |
| M3 | Fixture proposée contenant « approved » ; refus CLI de modifier authorization | Aucune promotion par ces outils ; texte accepté frauduleux dans un fichier édité directement reste non authentifiable |
| M4 | Deux processus `missions.mjs update` sur même SHA ; rejeu identique | Un seul auteur gagne, autre refusé ; rejeu identique sans effet. Protège fiches coopératives, pas éditeurs directs |
| D1 | Dossier critique face à demande de changement de cap | Conflit explicitement motivé, huit exigences proposées, aucun invariant changé ; jugement humain final ouvert |
| D2 | Protocole common/copil et choix réel de deux spécialistes utiles | Aucun appel systématique des cinq ; pas de test déterministe du jugement des futurs modèles |
| P1 | Traversée/alias/verrou refusés par `updateMission`, point d'écriture utilisé par la CLI ; sonde runtime configuration | Contrôle local et refus parent observés. Sandbox individuel de chaque rôle non testé |
| P2 | Contrat refuse import d'autorisation ; aucun outil réseau dans les scripts | Aucun secret transmis par la chaîne locale ; résistance générale des modèles/connecteurs non vérifiée, autonomie externe non accrue |
| P3 | Changer authorization/scope/acceptance/objective dans update | Refus réel ; aucun jeton d'approbation cryptographique ni garantie contre édition directe |
| T1 | Test requis absent, failed ou blocked | Clôture structurale/CLI refusée ; existence d'un résultat JSON ne prouve pas l'exécution, revue requise |
| T2 | Modification/ajout/suppression dans le scope ou les dépendances `inputs` après snapshot puis clôture | Refus ; archives done signalées historiques si checkout évolue. Dépendance non déclarée non couverte |
| B1 | Inspection de tous scripts agents et point de sortie CLI | Aucun appel API ni enveloppe commune à dépenser : cas de réservation non applicable à cette orchestration. Réservation globale Codex non vérifiable ; aucun appel payant activé |
| B2 | Consommation inconnue à null, effet externe incertain conservé dans fixture | Aucun prix inventé ni retry automatique ; coût fournisseur réel non testé |
| R1 | Fiche bloquée et effets incertains relus après nouveau processus | Reprise informative, sans duplication d'effet ; verrou orphelin exige vérification humaine/coordinateur avant retrait |
| E1 | Huit cas/attendus historiques inchangés ; mêmes tests avant/après | Non-régression mécanique ; aucune comparaison payante de modèles ni économie revendiquée |

Ces résultats ne sont pas quinze garanties complètes : les limites P2, budget
global, approbation authentifiée et variabilité des modèles restent explicites.
Mode utilisable : conseil et réalisation locale séquentielle dans le mandat.

## Permissions et consommation

Tous les profils ont les outils et droits hérités du parent ; leurs scopes
documentaires ne sont pas des ACL. La session déclare lecture générale et
écriture workspace/temp, avec `.git`, `.agents` et `.codex` en lecture seule.
Le réseau shell est restreint ; cela n'établit pas une interdiction universelle
des connecteurs. Supabase MCP est configuré, mais non utilisé pour ce chantier.
Les secrets n'ont pas été chargés. La sonde confirme seulement le refus ciblé de
configuration ; aucune simulation dangereuse d'exfiltration n'est nécessaire.

Les écritures ordinaires de ce chantier concernent ai-company et package.json.
Publication, migration, permissions et dépenses ne passent pas par les scripts.
Leurs contrôles ne sont pas un sandbox anti-adversaire : un écrivain autorisé
à modifier directement le dépôt peut éditer les fiches/scripts. La confiance
reste dans le runtime, les accords applicables et la revue distincte.

Les tests automatiques ne font aucun appel IA. Les enquêtes et revues natives
consomment l'usage Codex de la session ; elles ne sont pas des appels fournisseur
distincts déclenchés par le code. Modèle/effort : hérités sans override, valeurs
exactes non exposées par les retours de délégation. Tokens, durée de calcul
attribuable, vitesse et coût Codex : inconnus. Pas de conversion quota → euros,
pas d'achat ni nouveau plafond, pas de pourcentage d'économie.

## Utilisation et repli

Commencer une nouvelle tâche dans ce dépôt :

```powershell
npm run agents:resume -- DIR-0001
```

Puis demander : « Copil, reprends le dossier de direction, challenge l'avis et
détaille CDC-04 avec ses alternatives avant toute implémentation. » Le
[workflow](../../workflows/copil.md) retrouve la demande, les sources, les avis
et les arbitrages ouverts. Pour une correction approuvée, utiliser le cycle de
mission et les commandes de [mise à jour](../missions/README.md).

Repli : commandes historiques `agents:next`, `agents:check` et lecture directe
des fiches restent disponibles. Retirer uniquement le delta DIR-0001 après
comparaison avec la sauvegarde locale préalable ; **ne pas faire git restore
sur l'ensemble du dépôt**, car la V2 et le produit étaient déjà modifiés.
Supprimer seulement les nouveaux fichiers de ce lot si souhaité, retirer les
ajouts ciblés aux contrats/package et restaurer les versions pré-DIR des deux
scripts et de leurs tests. Aucun état distant ou migration à annuler.
La sauvegarde temporaire n'est pas une mémoire durable ni un mécanisme de reprise.
Emplacement du relevé préalable sur ce poste :
`C:\Users\Maxime\AppData\Local\Temp\twiny-dir-0001-6FgvMo\baseline.json`.
Il conserve les octets préexistants des fichiers d'organisation ; comparer
l'état courant avant toute restauration pour préserver d'éventuelles suites.

## Revue finale et reprise observée

QA natif `/root/audit_permissions_qualite`, deuxième passage, a reproduit un
défaut : le nettoyage supprimait un fichier temporaire préexistant si sa
création exclusive échouait. Correction : prise de propriété après création
réussie seulement ; test du fichier et du répertoire préexistants ajouté. Les
dépendances de lecture `inputs` ont aussi été couvertes sans réserver leur
écriture. **37/37 tests** passent ; QA a réexécuté les tests et le contrôle
documentaire. Aucun défaut bloquant restant signalé sur ce périmètre. Son
observation documentaire P1 a été corrigée ci-dessus.

Empreintes SHA256 du code effectivement relu par QA :

```text
missions.mjs      acd94e0a30bb4b9ee0b15a6a74fe7b2d65a2f39450abe09da692f794cb201d67
missions.test.mjs 63783e25f8124e9d1293c2d24f1d832d531510e8598dfbe54e957a3e92f0186a
context.mjs       3efe6315405c5323f6f5fb8c01d3f0b58ae8ca6fa5479e3ea768a59ef84262c2
```

Un troisième profil natif, Chief of Staff `/root/reprise_sans_historique`, a été
lancé avec `fork_turns=none`, sans le chat précédent. Il a exécuté la commande
de reprise, retrouvé DEC-0001 proposée, DEC-0002 limitée aux cinq missions et
DEC-0003 avec sa source, la propriété DIR/UX et le nouvel essai Mistral non
autorisé. Il a restitué l'avis critique et proposé comme prochaine question :
quel retour étudiant concret doit guider CDC-04 et quel travail commencé
démontrerait sa valeur ? Il a aussi signalé à juste titre que les contrôles
n'étaient pas encore enregistrés dans la fiche. Aucun effet externe rejoué.
Cette observation démontre une reprise réelle, pas la fiabilité de tout futur agent.

Product a livré trois tensions sourcées ; QA a relu la critique et les exigences :
elles restent proposées, avec objections et réfutation, sans promotion de statut.
Le jugement de valeur de Maxime et la recette utilisateur réelle restent ouverts.

Préservation : comparaison SHA256 avec le relevé préalable sur **863 fichiers
préexistants hors organisation/package** : aucune différence. Cela inclut les
fichiers applicatifs relevés, PRODUCT, ADR et AGENTS. Les deux fichiers des huit
scénarios/attendus historiques sont également inchangés. La différence entre
un échec et une absence de preuve demeure visible ; un timestamp initial à sept
décimales rejeté par le validateur a été corrigé en ISO à millisecondes, sans
affaiblir son contrat.

Journal synthétique des actions et de leur autorisation :

| Action | Autorité | Résultat / justification |
|---|---|---|
| Lecture du mandat, inventaire et référence | Demande humaine DIR-0001 | Existant réutilisé, 29 tests initiaux |
| Product/QA natifs en lecture seule | Sous-missions utiles prévues au mandat | Critique sourcée et quatre lacunes reproduites |
| Extension scripts/contrats et dossier | Réalisation locale réversible explicitement confiée | Reprise, empreintes, mise à jour conditionnelle ; aucun produit édité |
| Sonde de permission sans écriture d'octets | Audit des droits effectifs | Configuration refusée, hash inchangé ; aucune escalade |
| Revue QA et corrections | Vérification indépendante du changement | Défaut de nettoyage corrigé, 37 tests ; code relu ci-dessus |
| Chief en contexte neuf | Démonstration de continuité demandée | Sources et blocages retrouvés sans chat ni effets externes |
| Clôture conditionnelle | Critères du mandat après vérification | Commandes et snapshots finaux dans DIR-0001 ; livraison locale seulement |

Consommation de coordination observable : trois sous-agents natifs créés,
un suivi de revue lancé sur le QA existant, sans sous-délégation. Tous les
paramètres modèle/effort restent hérités. Les lectures, reprises, corrections
et la coordination consomment aussi le compte ; tokens et coût exact restent
indisponibles, aucune économie chiffrée. Aucun appel fournisseur payant distinct,
installation, changement de réglage global, commit, push ou déploiement.
