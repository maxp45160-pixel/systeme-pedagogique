# Audit indépendant du dépôt — Codex

**Date :** 11/08/2026  
**Périmètre :** dépôt local, schéma SQL de référence, documentation et tests.  
**Méthode :** lecture statique des huit axes imposés par la mission ⑥, sans modification du code et sans lecture de l'audit Claude.

## Synthèse

L'architecture générale respecte la séparation déclaré / observé / dérivé et concentre bien la logique pédagogique dans `lib/`. Deux écarts touchent toutefois directement le cœur de confiance du produit : les lignes Supabase ne sont pas réellement validées avant le moteur, et une dimension non documentée devient actuellement un zéro dans le score d'une compétence évaluée.

| Référence | Gravité | Résumé |
|---|---|---|
| C-01 | Haute | Les données Supabase sont renommées puis forcées par assertion de type, sans validation du contenu |
| B-01 | Haute | Une dimension absente devient `0` et pénalise le score comme une faiblesse observée |
| D-01 | Moyenne | Les mesures de profilage navigateur ne sont pas isolées par compte |
| D-02 | Moyenne | Le schéma RLS de référence paraît correct, mais son état réellement appliqué et son comportement ne sont pas vérifiés |
| H-01 | Faible | La carte et l'index des ADR contiennent des pointeurs et statuts devenus faux |
| G-01 | Faible | La suite n'a ni mesure de couverture ni cas de régression sur les deux chemins critiques ci-dessus |

## (a) Écart code ↔ carte

### C-01 — La « validation d'entrée » déclarée par la carte n'existe pas

- **Gravité :** haute
- **Invariant concerné :** 2 — absence de preuve ≠ zéro ; 6 — ne jamais inventer de données ; garde-fou « les données venant de Supabase doivent être validées avant d'entrer dans le moteur ».
- **Emplacements :** `PRODUCT_SPECIFICATION_MAP.md:138`, `docs/MODELE.md:74`, `app/src/lib/store/supabase-backend.ts:60-67`, `app/src/lib/store/supabase-backend.ts:163-184`, `app/src/lib/store/db.ts:116-145`, `app/src/lib/store/supabase-backend.test.ts:45-67`.
- **Preuve :** `ligneVersEntite<T>` retire les colonnes techniques, renomme les clés puis retourne `sortie as T`. Elle ne vérifie ni les champs obligatoires, ni les unions (`A0`–`A4`, qualité, résultat), ni les nombres, ni les objets JSON imbriqués. Le chemin RPC vérifie seulement la présence des clés de premier niveau avant d'appliquer la même conversion. Le chemin de lecture séparée fait de même. Le test de conversion accepte même `autonomie: "seul"`, `qualite: "correcte"` et la dimension `miseEnOeuvre`, absentes des types actuels (`Autonomie`, `QualitePreuve`, `Dimension`). Ces valeurs peuvent donc atteindre `computeAllSkillStates`, contrairement au statut ✅ de la carte et à l'affirmation de `MODELE.md`.
- **Action à instruire :** définir un validateur runtime unique par entité persistée, refuser la ligne entière sans produire de valeur de repli, tester les JSON imbriqués et les deux chemins de chargement, puis seulement réévaluer le statut de la carte.

### H-01 — Pointeurs et statuts documentaires contradictoires

- **Gravité :** faible
- **Invariant concerné :** traçabilité des décisions ; aucun invariant métier directement violé.
- **Emplacements :** `PRODUCT_SPECIFICATION_MAP.md:41`, `PRODUCT_SPECIFICATION_MAP.md:58`, `ARCHITECTURE_DECISIONS.md:21-24`, `ARCHITECTURE_DECISIONS.md:251`, `ARCHITECTURE_DECISIONS.md:413`, `ARCHITECTURE_DECISIONS.md:463`, `app/src/lib/domain/theme.ts:1-3`, `app/src/lib/store/theme-actions.ts:1-4`.
- **Preuve :** la carte associe `calculerEtatGlobal` à `engine/skill-state.ts`, alors que la fonction vit dans `engine/progression.ts`. Elle présente encore `domain/referentiel.ts` comme emplacement courant du référentiel par compte alors que ce fichier est l'ancien référentiel compilé et que le modèle actif passe par `domain/types.ts` et `domain/referentiel-compte.ts`. L'index des ADR annonce encore ADR-006, ADR-008 et ADR-009 ouvertes, alors que leurs sections les donnent respectivement acceptée ou fermées. Enfin, les commentaires des thèmes citent ADR-053 au lieu d'ADR-055.
- **Action à instruire :** faire une passe mécanique de cohérence des index, chemins et références ADR, sans changer les statuts portés par les sections de décision.

## (b) Les huit invariants

| # | Invariant | Résultat de l'audit | Éléments vérifiés |
|---|---|---|---|
| 1 | Ne pas stocker ce qui est dérivable | Aucun contre-exemple trouvé | `app/src/lib/store/context.ts:90-180` recalcule états, score, calibrations, recommandations et maîtrises à la lecture |
| 2 | Toute mesure a une source explicite | Garantie incomplète | Le type et les créations prévoient `source`, mais C-01 permet à une ligne SQL invalide de traverser ; B-01 fabrique un zéro sans source |
| 3 | Absence de preuve ≠ zéro | Violation sur un sous-chemin | Le niveau et le score restent `null` sans aucune preuve (`skill-state.ts:309-338`), mais une dimension absente devient zéro dès qu'une autre dimension est mesurée (B-01) |
| 4 | Une faiblesse ne disparaît pas sans démonstration | Aucun contre-exemple trouvé | Les contradictions sont conservées (`skill-state.ts:341-375`) et l'historique reste append-only par conception |
| 5 | Le tuteur produit du contenu, pas des mesures | Aucun contre-exemple trouvé | Les verdicts sont des propositions archivées puis validées ; aucune écriture directe de niveau ou score trouvée |
| 6 | Ne jamais inventer de données | Violation potentielle | C-01 accepte des formes invalides ; B-01 matérialise l'inconnu comme zéro |
| 7 | Le référentiel appartient au compte | Schéma conforme, assurance incomplète | FK composites et politiques RLS dans `schema.sql:126-168` et `schema.sql:420-441`; état réel non vérifié (D-02) |
| 8 | Pas de partage de données personnelles sans consentement | Aucun partage serveur trouvé ; fuite locale possible | RLS du schéma isole les données pédagogiques, mais le profilage navigateur partage ses clés entre comptes sur un même navigateur (D-01) |

### B-01 — Une dimension inconnue est comptée comme une dimension nulle

- **Gravité :** haute
- **Invariant concerné :** 2 — toute mesure a une source explicite ; 3 — absence de preuve ≠ zéro ; 6 — ne jamais inventer de données.
- **Emplacements :** `app/src/lib/engine/skill-state.ts:236-255`, `app/src/lib/engine/skill-state.ts:365-370`, `docs/MODELE.md:140`.
- **Preuve :** pour chaque dimension sans preuve pertinente, `calculerDimensions` écrit `out[d] = 0`. Le score pondère ensuite systématiquement les cinq dimensions. Ainsi, une preuve qui ne documente que la compréhension fait baisser le score via quatre zéros qui ne sont pas des échecs observés. Le cas sans aucune preuve est correctement traité avec `score: null`, mais le cas partiellement documenté réintroduit la confusion que P2 interdit.
- **Action à instruire :** décider explicitement si le score porte seulement sur les dimensions documentées, s'il doit rester absent tant que la couverture dimensionnelle est insuffisante, ou s'il doit afficher séparément score et couverture. Ajouter un test de réfutation avant toute correction.

## (c) Validation des données Supabase avant le moteur

Le constat C-01 est bloquant pour cet axe. Les contraintes SQL limitent certains champs (`difficulte`, `palier`, `importance`, quelques origines), mais `evidence` garde notamment ses enums en `TEXT` et ses dimensions/source en `JSONB` sans contrainte de forme (`app/supabase/schema.sql:174-190`). Même un schéma SQL plus strict ne remplacerait pas une validation à la frontière applicative, car l'état appliqué peut dériver du fichier de référence.

Aucun autre validateur n'est interposé dans `chargerContexte` avant les appels au moteur : `app/src/lib/store/context.ts:90-180` consomme directement les collections issues de `chargerToutRPC` ou `lireTout`.

## (d) RLS et isolation par compte

### D-01 — Profilage et préférences navigateur non isolés par compte

- **Gravité :** moyenne pour le profilage ; faible pour les seules préférences visuelles.
- **Invariant concerné :** 7 — propriété par compte ; 8 — confidentialité ; garde-fou « toute clé de stockage navigateur doit être isolée par compte ».
- **Emplacements :** `app/src/lib/profiling/client.ts:49-65`, `app/src/lib/profiling/client.ts:133-152`, `app/src/lib/profiling/client.ts:169-192`, `app/src/lib/ui/stockage-session.ts:14-22`, `app/src/components/layout/theme.ts:23-40`, `app/src/components/layout/bascule-rail.tsx:15-22`, `app/src/app/layout.tsx:23-29`, `PRODUCT_SPECIFICATION_MAP.md:136`.
- **Preuve :** les clés `profilage-client-*`, `profilage-rendus` et `profilage-interactions` ne passent pas par `cleParCompte`. Les interactions comprennent type, libellé et horodatage ; deux comptes successifs dans le même navigateur peuvent donc lire ou prolonger le même journal local. `theme` et `rail` sont aussi globaux : leur sensibilité est faible, mais ils rendent fausse la garantie absolue affichée dans la carte.
- **Action à instruire :** passer au minimum les mesures et drapeaux de profilage par une clé de compte, purger ou migrer les anciennes clés globales, puis décider si thème/rail sont volontairement des préférences de navigateur et documenter cette exception — ou les isoler également.

### D-02 — Le fichier SQL est cohérent, l'état appliqué reste sans preuve

- **Gravité :** moyenne (défaut d'assurance, pas fuite démontrée).
- **Invariant concerné :** 7 — le référentiel appartient au compte ; 8 — confidentialité.
- **Emplacements :** `app/supabase/schema.sql:41-48`, `app/supabase/schema.sql:420-441`, `app/supabase/schema.sql:471-500`, `PRODUCT_SPECIFICATION_MAP.md:134-136`, `AGENTS.md:124-129`.
- **Preuve :** le schéma de référence active RLS sur le profil et les huit tables du compte, applique `auth.uid()`, garde `charger_tout` en mode invoker et retire son exécution à `anon`. En revanche, aucun test n'ouvre deux sessions pour vérifier les lectures/écritures croisées, et aucun élément du dépôt ne prouve que ces politiques et la version actuelle de la RPC sont effectivement appliquées dans Supabase. L'historique documente déjà une dérive de `charger_tout` (`schema.sql:466-469`). L'audit ne conclut donc ni à une fuite ni à une conformité réelle : la preuve manque.
- **Action à instruire :** relever l'état réel de chaque politique et privilège dans Supabase, tester lecture, insertion, mise à jour, suppression et RPC entre deux comptes, puis dater le résultat. Ne pas confondre présence dans `schema.sql` et application en production.

## (e) Logique métier hors `lib/`

Aucun constat bloquant. Les calculs de niveau, score, recommandation, calibration, maîtrise, séance et graphe sémantique vivent dans `app/src/lib/domain/` ou `app/src/lib/engine/`. Les composants inspectés appellent ces fonctions (`formulaire-bilan.tsx` appelle `autonomieObservee`; `concepteur-seance.tsx` appelle `motifRefusBesoin` et le compositeur) au lieu de recopier les règles.

Les fichiers `components/competences/graphe/moteur-force.ts` et `rendu-canvas.ts` contiennent des algorithmes non triviaux, mais ils règlent le placement et le rendu de l'interface ; la fabrication sémantique des nœuds et liens reste dans `lib/domain/graphe.ts`. Ils ne constituent donc pas un écart métier au sens du garde-fou.

## (f) Validations dupliquées

Aucun doublon métier contradictoire identifié. Les opérations de création et d'édition réutilisent les autorités partagées : `motifRefusExercice`, `motifRefusTerminerExercice`, `motifRefusBesoin`, `motifRefusDemande`, `motifRefusBlueprint` et `motifRefusTheme` vivent dans `lib/domain/` puis sont appelées par le store et, lorsque nécessaire, par l'écran.

Les fonctions `valider*` de `lib/tutor/outils.ts` valident la forme des appels d'outil du LLM ; les conversions appellent ensuite les règles métier communes. Ce sont deux frontières différentes, pas deux autorités concurrentes. Les petits tests `trim().length` dans les composants ne servent qu'à désactiver un geste incomplet ; la Server Action reste autoritaire.

## (g) Couverture des chemins de dérivation

### G-01 — Les deux écarts critiques ne sont pas protégés par des tests de réfutation

- **Gravité :** faible pour l'outillage, mais augmente le risque de régression de C-01 et B-01.
- **Invariant concerné :** 1 à 6 pour les dérivations ; en particulier 2, 3 et 6.
- **Emplacements :** `app/package.json:8-12`, `app/src/lib/store/supabase-backend.test.ts:45-67`, `app/src/lib/engine/moteur.test.ts:86-120`, `app/src/lib/engine/moteur.test.ts:511-586`.
- **Preuve :** la suite couvre de nombreux seuils de niveau, le score global vide, l'ajout d'une compétence non mesurée et la borne du score. Elle ne teste pas une compétence évaluée dont une partie seulement des dimensions est documentée. Les tests Supabase vérifient la traduction et la présence des collections, mais pas le rejet d'une ligne invalide ; le cas existant consacre même des valeurs obsolètes. Enfin, `verify` exécute TypeScript, ESLint et Vitest sans mesure ni seuil de couverture, donc l'exhaustivité des branches de dérivation n'est pas observable.
- **Action à instruire :** ajouter d'abord les cas de réfutation de C-01 et B-01, puis produire une couverture ciblée de `lib/engine` et des frontières `lib/store`; n'introduire un seuil global qu'après avoir mesuré la base actuelle.

Points déjà bien couverts : niveaux 0–5, contradictions, récence, score global et couverture du référentiel, maîtrise, calibration, recommandation, plan de séance, espacement et similarité textuelle disposent de suites dédiées dans `app/src/lib/engine/`.

## (h) Dette documentaire

H-01 recense les contradictions directement traçables. Deux affirmations demandent une correction prioritaire après instruction des constats :

- `docs/MODELE.md:74` dit que les données Supabase sont « converties et validées » ; seule la conversion existe aujourd'hui ;
- `PRODUCT_SPECIFICATION_MAP.md:138` attribue le statut ✅ à cette validation, et `PRODUCT_SPECIFICATION_MAP.md:136` affirme que toute clé navigateur est préfixée par le compte, malgré D-01.

Ces corrections documentaires ne doivent pas masquer les défauts ni promouvoir/rétrograder silencieusement un statut : elles doivent refléter les preuves et arbitrages issus des missions ⑥ et ⑦.

## Vérification locale

- `npm test` : **30 fichiers, 687 tests réussis**.
- `npm run verify` : TypeScript réussit, puis ESLint s'arrête sur deux erreurs existantes dans `app/src/components/competences/graphe/graphe-competences.tsx:82` (`setState` synchrone dans un effet) et `:213` (écriture d'une ref pendant le rendu), ainsi que trois avertissements. Vitest n'est donc pas atteint par cette commande ; il a été exécuté séparément ci-dessus.
- Conformément au critère de refus de la mission ⑥, ces erreurs n'ont pas été corrigées dans cet audit.

## Limites de l'audit

- Aucun accès à l'état réel Supabase n'était disponible dans ce passage ; D-02 est donc explicitement une absence de preuve.
- Aucun trafic réel ni donnée personnelle n'a été inspecté.
- L'audit Claude n'a pas été lu et doit rester indépendant jusqu'aux deux commits.
- Aucun fichier de code, schéma, protocole du tuteur ou configuration n'a été modifié.
