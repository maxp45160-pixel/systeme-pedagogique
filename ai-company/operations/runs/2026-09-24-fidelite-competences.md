# Fidélité des compétences — P01-0014

## Mandat

Maxime demande « cible la fidélité des compétences » après la recette P01-0013. Réalisation locale autorisée pour corriger le contrat fournisseur et son traitement partagé, avec tests et documentation. Aucun nouvel appel fournisseur, changement de schéma DB, dépendance, commit, push ou déploiement.

Base : 11ab9ea8176303241c7ff25406f6d5faa4bcf364 et modifications locales P01-0012/P01-0013 conservées. Les six essais réels ont terminé, mais les compétences restent parfois infidèles au geste réellement demandé ou enseigné. Les 108 citations sont présentes sans garantir cette fidélité. [Constats](../../../docs/pilotes/REESSAIS_CORPUS_2026-09-24.md).

## Plan

Exiger un appui temporaire par proposition : passage, nature de l'appui, action et résultat attendus. Contrôler son lien aux sources, écarter les appuis déclarés comme simples mentions ou incertains avec réserve visible, conserver les démonstrations sans impératif. Même appel et mêmes bornes ; aucune prétention de validation sémantique déterministe. Les champs d'appui sont retirés avant persistance. Les anciens résultats restent lisibles.

Vérifier les branches réelles Mistral/Qwen avec réponses simulées, des cas positifs et négatifs, puis la suite locale et une revue QA. La qualité réelle et les omissions nécessiteront une nouvelle recette humaine/fournisseur explicitement déclenchée.

## Réalisation locale

- Contrat obligatoire `ancrage:{nature,passageId,attendu}` avant les champs de compétence, pour références existantes et nouveautés. Nature et résultat attendu sont déclarés par le modèle ; le serveur ne les présente pas comme un jugement indépendant.
- Contrôle commun Mistral/Qwen : validation métier complète avant tout retrait, appui principal dans les sources, retrait des champs temporaires, abstentions visibles avec libellé/code et motif. Consignes et démonstrations gardent leurs autres sources.
- Une réserve tient dans 700 caractères avec trois repères au plus ; regroupement sans couper ni perdre de libellé. Sept éléments fournisseur V2 laissent une place disponible, huit au plus après contrôle. Si les réserves ne tiennent pas, refus explicite de l'ensemble plutôt que restitution partielle cachée. Par exemple sept éléments et quatre abstentions à sources distinctes peuvent dépasser la capacité : ce cas reste un refus connu, pas une réussite partielle.
- Contrat schéma v3 et qualité v4. Les réussites historiques sous `propositions-hierarchie-v2` et `propositions-transfert-geste-v3` restent reconnues pour Mistral et Qwen ; les anciens devis non exécutés sont invalidés avant réservation.
- Aucun nouvel appel payant, changement de quota, migration ou déploiement. Ni code de compétence ni mesure inventés. PRODUCT et ADR synchronisés avec le comportement et ses limites.

## Vérifications et revue

Les premiers tests ciblés ont couvert 79 cas du filtre et du store, puis 67 cas des adaptateurs et du schéma. Ils exécutent le traitement réel avec des réponses fournisseur simulées : conservation d'une démonstration multi-passage, refus d'appui absent/hors sources, mentions rendues visibles, compteurs sans réessai et anciennes réussites préservées. Ils ne simulent pas une vérité sémantique humaine.

La revue QA indépendante a fait corriger deux défauts : les propositions écartées ne doivent pas court-circuiter les validations métier (notamment un code inventé) ; la compatibilité doit couvrir aussi la qualité historique v2, pas seulement v3. Les deux contre-exemples ont des régressions locales. Une première vérification TypeScript a signalé un accès à `intitule` sans discrimination du mode dans un test ; assertion corrigée, sans modification du comportement produit.

La clôture exige `npm run verify --workspace=app -- --maxWorkers=2` et `npm run agents:check` sur le snapshot final. Les résultats effectifs, dates et empreintes sont dans [la fiche P01-0014](../missions/P01-0014.json). Logs locaux : `scratch/corpus-classification-2026-09-22/fidelite-verify-final.log`, `fidelite-agents-final.log` et revue `fidelite-qa.md`. Le premier échec TypeScript reste dans `fidelite-verify.log`.

## Limite et suite

**Aucun gain sémantique réel nouveau n'est déclaré.** Un test conserve explicitement la limite : une fausse déclaration `demonstration` peut encore franchir le contrôle structurel. Les mots tronqués, les gestes substitués et les catégories techniques erronées ne sont pas détectables de façon générale par ce seul contrôle. Les nouveaux champs prennent une partie des 8 192 jetons existants ; une omission excessive ou une réponse trop longue restent possibles.

La prochaine recette doit reprendre les contre-exemples C01/C02/C04/C05/C08/C10 avec des attentes humaines : donnée contre inconnue recherchée, consigne contre synthèse inventée, sommaire contre méthode démontrée, distinctions techniques et généralisation transférable. Elle doit compter séparément erreurs et omissions, et conserver aussi les propositions correctes. Une nouvelle génération fournisseur demande un geste explicite de réessai ; aucune dépense n'est déclenchée dans cette correction. Le jalon inférieur à 5 % reste non démontré.
