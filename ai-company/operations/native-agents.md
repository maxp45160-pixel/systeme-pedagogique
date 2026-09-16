# Collègues natifs — fonctionnement et utilisation

État du 15/09/2026, après la [demande complémentaire de Maxime](mandate.md).
Le report initial de phase 8 est levé pour l'exécution native sur mission.
Cela ne constitue pas une preuve de gain comparatif ni une décision produit.

## Ce qui existe réellement

Cinq profils TOML sous [.codex/agents](../../.codex/agents/), avec nom,
description et instructions de rôle, au format de la
[documentation officielle Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents).
Les cinq noms sont maintenant exposés par l'outil natif de délégation de cette
tâche. Les contrats Markdown restent leur référence ; ils ne sont plus le seul
mécanisme d'exécution.

| Collègue / profil | Travail pris en charge | Livrable typique |
|---|---|---|
| `twiny_chief_of_staff` | Relie vision, code, priorités et risques ; confie les sous-missions utiles, confronte leurs résultats | Bilan, recommandation argumentée, arbitrage précis |
| `twiny_product` | Enquête sur le besoin, challenge une idée et protège/questionne la vision | Analyse produit, spec, contre-argument et test de valeur |
| `twiny_cto` | Inspecte le code, compare les choix et mène une réalisation explicitement confiée | Options techniques, plan ou code vérifié selon la mission |
| `twiny_qa` | Cherche défauts, cas limites et contradictions ; exécute les contrôles utiles | Constats reproductibles et limites de la vérification |
| `twiny_research` | Recherche les sources scientifiques/techniques et leurs contradictions | Synthèse sourcée, incertitudes et expérience proposée |

Les agents utilisent par défaut le modèle, l'effort et les permissions hérités de la tâche.
L'[essai compute sur cinq missions](../decisions/DEC-0002-essai-manuel-compute.md)
porte sur USE-0002 à USE-0006. Sa revue ne démontre pas de gain comparatif ;
les nouvelles missions conservent l'héritage sans prolongation automatique.
Aucune dépendance, clé API supplémentaire, infrastructure cloud ou permission
élargie n'est ajoutée. Leur travail consomme l'usage Codex disponible.

## Une mission, concrètement

1. Vous confiez un dossier dans une tâche Codex ouverte sur ce dépôt, avec
   résultat attendu et limites utiles : analyser, préparer ou réaliser.
2. Le coordinateur lit la mémoire nécessaire et choisit les collègues utiles.
   Une petite correction ne mobilise pas les cinq personnes.
3. Il lance de vrais sous-agents : profil sélectionné, contexte distinct,
   outils disponibles, question bornée, fichiers possédés et critère de fin.
   Si le sélecteur de profil est absent, le sous-agent natif reçoit le TOML
   du rôle à lire explicitement ; ce mode doit être annoncé comme tel.
4. Les collègues choisissent leurs investigations, utilisent les outils,
   prennent position et produisent le livrable. Ils avancent sans microgestion
   dans le périmètre confié ; un vrai blocage est remonté avec ses preuves.
5. Le coordinateur attend leurs résultats, vérifie les éléments importants,
   conserve les désaccords et rend une synthèse exploitable. Il peut leur
   demander une suite pendant la vie de la mission.
6. Le coordinateur actualise la [fiche de mission](missions/README.md) après
   résultat significatif et avant transfert : accord, propriétaire, preuves,
   effets externes et prochaine action. Il corrige les index touchés et clôt
   selon le [cycle de mission](../workflows/mission.md). Les transcriptions
   complètes ne sont pas archivées ; une recommandation reste une proposition.

Une analyse produit n'autorise pas de coder. Une réalisation explicitement
demandée autorise ses modifications et vérifications ; le CTO peut alors utiliser
un worker natif existant. Les fichiers partagés ne sont pas des copies isolées :
le coordinateur attribue des périmètres distincts et préserve le travail existant.

## Comment leur parler

- « Chef, prends le dossier de l'assistant : où en sommes-nous, qu'est-ce qui
  manque comme preuve et quel est le prochain travail utile ? »
- « Product, challenge cette idée : … Compare-la à une solution plus simple.
  Fais examiner ta conclusion par QA et reviens avec ton avis. »
- « CTO, compare ces deux options à partir du code réel : … Produis le plan
  technique, sans implémenter. »
- « CTO, réalise ce correctif approuvé : … Tu peux modifier ces fichiers et
  exécuter les tests concernés ; fais vérifier le résultat par QA. »
- « Research, quelles preuves soutiennent cette hypothèse pédagogique : … ?
  Cherche aussi les résultats qui la contredisent. »

Vous pouvez ensuite dire « continue », « vérifie ce point », « ce raisonnement
ne me convainc pas » ou modifier le périmètre. Pas de syntaxe spéciale nécessaire.
Pour une nouvelle session, utiliser ce dépôt afin qu'AGENTS et les profils soient
accessibles ; les seuls faits utiles reportés dans la mémoire servent de reprise.

## Limites explicites

Le [mandat V2](autonomy.md) permet d'enchaîner le travail autorisé dans une tâche
active. Maxime a choisi le 15/09 le déclenchement à la demande pendant la
vérification de la V2. Aucun horaire, réveil automatique ou travail hors session
n'est configuré. File vide ou résultat atteint : synthèse puis arrêt.

Les agents peuvent être critiques sans avoir raison ; plusieurs agents peuvent
partager la même erreur. Ni leur accord ni un test vert ne valide votre vision.
Leur mémoire durable est dans le dépôt, pas une garantie de souvenir intégral
de toutes les conversations. Un quota épuisé ou un outil inaccessible peut
interrompre une mission : le résultat manquant doit rester signalé.

## Preuves de mise en service

- Les cinq fichiers TOML ont été parsés avec `tomllib` du Python fourni par Codex.
- Les cinq profils sont exposés comme types d'agents par l'environnement courant.
- Une mission QA indépendante a réellement lu les fichiers et rendu les
  contradictions documentaires ; ses constats ont servi aux corrections.
- Une première mission Product a été interrompue par la limite d'usage, puis
  terminée après la demande de reprise. Son [livrable](runs/2026-09-15-product-premiere-mission.md)
  a été reçu et relu ; il distingue options, preuves historiques, incertitude
  et test proposé. L'échec du premier essai reste dans l'historique.
- Le Chief of Staff a été lancé en sélectionnant explicitement
  `agent_type: twiny_chief_of_staff`. Il a inspecté le guide et le livrable
  Product, puis signalé des formulations à préciser. CTO et Research sont
  disponibles mais n'ont pas été exécutés dans cette vérification.
- Le contrôle CLI `debug prompt-input` n'a pas établi la liste des profils :
  l'absence des noms dans les messages rendus ne démontrait pas leur absence
  dans les outils. La preuve retenue est l'exposition dans l'outil natif courant.

Le [journal de validation](validation.md) et les [métriques](metrics.md)
conservent les résultats et limites des exécutions, sans prétendre à une mesure
d'efficacité de l'organisation.
