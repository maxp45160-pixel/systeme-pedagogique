# Consulter les graphes du projet

Autorisation et preuves : [GRAPH-0001](../operations/runs/2026-09-16-graphes-raccordement.md).
Ces outils servent à choisir les sources utiles ; ils ne valident ni une
décision produit ni l'existence exhaustive des dépendances. Pas de Graphify
supplémentaire, de serveur permanent ou de changement des modèles.

## Choisir une vue

Depuis la racine du dépôt, les agents peuvent exécuter directement :

```powershell
# Pages disponibles ; pas de chargement du graphe entier
npm run agents:graph -- ux

# Parcours local et conditions des interactions
npm run agents:graph -- ux page:/seances --depth 1

# Routes et actions détectées dans le code
npm run agents:graph -- architecture page:/seances --depth 1

# Synthèse de parcours, partiellement écrite à la main
npm run agents:graph -- macro page:/seances

# Appelants / appels sortants / localisation d'une fonction
npm run agents:graph -- code callers envTuteur
npm run agents:graph -- code callees scannerWorkflow --limit 10
npm run agents:graph -- code find scannerWorkflow
```

Pour parser uniquement du JSON sans l'en-tête npm :
`node ai-company/scripts/graph.mjs ...` ou `npm run --silent agents:graph -- ...`.

Question de parcours utilisateur : vue `ux` ; routes/actions : `architecture` ;
appelants/dépendances entre fonctions : `code`. Une recherche textuelle reste
adaptée aux mots exacts, documents, SQL et questions hors couverture. Ne pas
imposer un index de code à une question produit qui ne le nécessite pas.

## Fraîcheur réelle

Les vues parcours exécutent les **scanners existants** à chaque consultation.
Leur cache de modules/contenus est recréé : un fichier ajouté, modifié même à
mtime conservée, ou supprimé est relu lors de la requête suivante. Aucun export
stocké n'est considéré automatiquement comme courant. La macro reste une
synthèse en partie manuelle ; sa régénération n'invente pas de nouveaux concepts.
Le scan parcours n'est pas une transaction : des modifications concurrentes
de plusieurs fichiers peuvent donner une vue intermédiaire ; relancer après
la fin de l'édition avant de conclure. Le mode technique vérifie, lui, l'empreinte
de son corpus avant et après la consultation.

L'administration recalcule ses graphes lors d'une exécution serveur de son
onglet Workflow. Un écran déjà affiché n'est pas une surveillance en direct.
Ces scanners dépendent des fichiers sources accessibles au processus ; les
tests locaux ne prouvent pas leur disponibilité dans un déploiement distant.

Le mode `code` reconstruit un index temporaire à chaque requête, puis le
supprime. Il inclut les `.ts`/`.tsx` de `app/src` présents sur disque, suivis
ou nouveaux non ignorés, hors tests, déclarations et répertoires de fixtures.
Les suppressions du checkout sont prises en compte. Il copie aussi les
`package.json` et `app/tsconfig.json` suivis ou non ignorés. Aucun document,
`.env`, donnée pédagogique ou SQL n'entre dans cet index.

Une empreinte des noms et contenus est comparée avant/après l'indexation et
la requête : si les sources ont changé, le résultat est rejeté. L'horodatage
`checkedAt` indique la consultation, pas une garantie sur des modifications
ultérieures. Aucun ancien index ne sert de secours. Cette stratégie privilégie
la fraîcheur ; elle coûte quelques secondes de calcul local par demande.

Le binaire déjà installé est recherché dans `~/.local/bin/codebase-memory-mcp`
(`.exe` sur Windows). `CODEBASE_MEMORY_BIN` peut désigner explicitement un
autre emplacement de ce même outil. Version vérifiée : 0.9.0. S'il manque ou
échoue, la commande échoue clairement ; elle ne l'installe pas, ne télécharge
rien et ne déclenche aucun modèle. UI et surveillance sont désactivées dans
une configuration temporaire isolée. Le MCP global reste inchangé.

## Lire la réponse et ses limites

- Les sorties parcours gardent conditions, déclencheurs et heuristiques.
  `truncated` et `omitted` signalent ce qui a été retiré. Sans racine, `roots`
  donne les pages disponibles ; une racine inconnue renvoie une erreur et
  ces suggestions. Une route possède un identifiant comme `page:/seances`.
- Défauts : profondeur 1, 40 nœuds, 100 liens, sans liens de cadre.
  Options : `--depth` (0–10), `--max-nodes` (1–200), `--max-edges` (0–500),
  `--include-frame`. Ces limites bornent les éléments, pas les tokens.
- Le mode code retourne au plus `--limit` lignes (20 par défaut, 100 maximum),
  les chemins et lignes, et pour les appels la stratégie et la confiance.
  Des fonctions homonymes peuvent appartenir à des fichiers différents.
- Une arête peut être heuristique ou fausse. Le faux appel récursif attribué
  à `scannerWorkflow` dans l'[essai](../operations/runs/2026-09-16-graphes.md)
  interdit d'utiliser l'index comme preuve unique. Lire le code concerné.
- Absence de résultat, troncature ou route non reconnue ne prouve jamais une
  absence fonctionnelle. Les chemins dynamiques et conventions peuvent
  échapper aux scanners ; `find` ne recherche que les fonctions.

Ne pas charger les trois vues ni tous les appels par défaut. Poser une question,
consulter un sous-graphe, puis lire les sources qui changent la conclusion.
Une réduction de sortie n'est pas une économie totale de tokens démontrée.

## Reprise et vérification

Une nouvelle session lit le contrat commun puis ce guide selon sa question.
Elle utilise la même commande sur le checkout courant ; aucune reconstruction
manuelle de l'index n'est nécessaire. `agents:resume -- GRAPH-0001` retrouve
l'autorisation, le périmètre, les preuves et les limites de cette livraison.

Tests : `npm run agents:test`. Les tests code utilisent un exécuteur simulé,
les tests parcours les vrais scanners sur une copie de fixture. Les essais
du binaire réel sont rapportés séparément, sans fournisseur API payant.

Repli : ne plus utiliser `agents:graph`, conserver recherche ciblée et scanners
existants. Aucun état produit ni migration à annuler, aucun daemon à arrêter.
