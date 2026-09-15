# Audit du système existant

Date : 15/09/2026. Auteur : Codex. Nature : faits locaux et inférences signalées,
sans validation produit. Phase 0 réalisée avant création des rôles.

## Périmètre et méthode

Inventaire transversal des fichiers visibles, y compris instructions cachées,
code non suivi et suppressions locales ; lecture des instructions, manifestes,
configurations, sections documentaires et signatures/types des points centraux.
Les corps applicatifs n'ont pas été chargés pour cette infrastructure documentaire.
Ce relevé n'est donc ni une revue exhaustive de chaque fonction ni un audit sécurité.
Les dépendances installées, sorties de build, secrets, données pédagogiques et
historiques privés des outils ne sont pas des sources institutionnelles inspectées.

Au relevé initial : 869 fichiers inventoriés par `rg --files --hidden` hors
répertoires ignorés, 218 fichiers `*.test.ts`, 75 migrations et 11 scripts de
tests SQL. Les compteurs ne prouvent ni réussite des tests ni application en base.
Branche locale : `master`. HEAD : `e0c591aaa00e539b7cc22997cd89cf9f6509346f`
(07/09/2026). Nombreux changements préexistants, suivis et non suivis, sur le
pilote, le chat, Qwen, la documentation et le schéma. Ne pas les attribuer à ce
chantier, les committer ensemble ni assimiler HEAD au déploiement.

## Ce qui existe et ce qui se réutilise

| Sujet | Évidence locale | Usage pour l'organisation |
|---|---|---|
| Vision et limites | [PRODUCT](../PRODUCT.md), état courant du 15/09, public, huit principes, critère d'arrêt | Source produit conservée ; index courts, pas de deuxième vision normative. |
| Instructions | [AGENTS racine](../AGENTS.md), [AGENTS app](../app/AGENTS.md), [CLAUDE app](../app/CLAUDE.md), [.clinerules](../.clinerules) | La racine porte les invariants ; CLAUDE importe les règles de l'app ; Cline renvoie à la racine. Aucun CLAUDE racine trouvé. |
| Décisions | [Registre ADR](../ARCHITECTURE_DECISIONS.md), jusqu'à ADR-145 dans le corps | Historique et statuts humains à préserver, y compris décisions remplacées. |
| Arbitrages | [Propositions ouvertes](../docs/architecture/PROPOSITIONS_ADR_OUVERTES.md) | Calendrier externe sans fournisseur/architecture validés ; ne pas créer un second dossier de décision identique. |
| Modèle cible | [TWINY_MODEL](../docs/architecture/TWINY_MODEL.md), [contrats moteur](../ENGINE_CONTRACTS.md), [migration](../docs/architecture/TWINY_MIGRATION.md) | Vocabulaire, contrats proposés et constats datés ; aucun n'est un schéma à implémenter automatiquement. |
| Stack déclarée | [Racine npm](../package.json), [app npm](../app/package.json), [TypeScript](../app/tsconfig.json) | Workspace npm unique `app`, Next 16.3.0, React 19.2.4, TypeScript strict, Tailwind 4, Supabase, Vitest 4. Versions déclarées locales, pas vérification de versions distantes. |
| Architecture réelle | [types](../app/src/lib/domain/types.ts), [état](../app/src/lib/engine/skill-state.ts), [action](../app/src/lib/engine/action-unifiee.ts), [store](../app/src/lib/store/db.ts) | Les chemins réels commencent par `app/src/lib/` ; domaine, moteur, persistance séparés. `SkillObservation` et `LearningSession` existent dans les types. |
| Autres zones de code | `app/src/lib/documents`, `simulation`, `profiling`, `dev`, `ui`, `supabase`, routes et composants sous `app/src/` | Ne pas confondre une bibliothèque de simulation ou un graphe de workflow produit avec une organisation d'agents. |
| Tuteur | [env-requete](../app/src/lib/tutor/env-requete.ts), [moteurs](../app/src/lib/tutor/moteurs/index.ts), [contexte](../app/src/lib/tutor/contexte.ts), [protocoles](../app/data/00_instructions/) | IA du produit, quotas et contexte borné ; ne pas y injecter la mémoire d'entreprise. |
| Données et migrations | [schéma](../app/supabase/schema.sql), [migrations](../app/supabase/migrations/), [tests SQL](../app/supabase/tests/) | Supabase fait autorité à distance. Aucun accès DB nécessaire pour cette V1 ; état distant UNKNOWN. Le dossier racine `supabase/migrations` est vide au relevé. |
| Tests et scripts | [Vitest](../app/vitest.config.ts), [campagne](../app/vitest.campagne.config.ts), [scripts app](../app/scripts/) | `npm run verify` = TypeScript + ESLint + Vitest ; `npm run build` distinct. La campagne de simulation a sa commande dédiée. Ne pas créer un nouveau runner applicatif. |
| CI et lancement | [.claude/launch.json](../.claude/launch.json), [app launch](../app/.claude/launch.json), [archive exploitation](../archive/README.md) | Lancement local existant. Aucun workflow CI versionné trouvé sous `.github` ; CI externe et déploiement non inspectés. |
| Revue | [diff-audit](../.agents/skills/diff-audit/SKILL.md), [design QA](../design-qa.md) | Réutiliser le skill pour une revue de code ; le rapport visuel indique une vérification authentifiée bloquée. Il n'est pas une preuve visuelle actuelle. |
| Intégrations outils | [.codex/config.toml](../.codex/config.toml), [opencode.json](../opencode.json) | MCP Supabase configuré ; la configuration ne prouve pas la disponibilité ni l'état DB. Pas de rôles d'entreprise configurés dans ces fichiers. |
| Logs | [journal moteur](../app/src/lib/store/journal-moteur.ts), migrations de journal, registres pilote/design, Git | Traces métier et techniques existantes ; ne pas les détourner en mémoire d'entreprise ou consulter des données privées sans besoin. |
| État des travaux | [pilote](../docs/pilotes/DEPOT_DOCUMENTAIRE.md), [assistant](../docs/design/ASSISTANT_ENTREE_REFERENCE.md), Git | Sources les plus proches du travail récent ; distinguer demande humaine, réalisation locale, essai réel, réserves et déploiement. |

## Ce qui manque

- Aucun point d'entrée institutionnel commun, contrat Chief of Staff ou workflow
  d'analyse d'idée identifié dans les fichiers versionnables inspectés.
- Aucun backlog global actif `TODO`/`TASKS`/`ROADMAP` trouvé. Les suites sont dans
  PRODUCT, les propositions, le pilote et la référence assistant. La recherche
  TODO/FIXME/HACK dans code/docs n'a trouvé qu'un exemple pédagogique de TODO.
- Aucun journal global de recherche ni mesure de l'utilité des rôles identifié.
- Priorité unique ordonnée pour le prochain chantier, responsable/calendrier
  d'essai et résultats d'usage actuels : **UNKNOWN / À VALIDER AVEC LE FONDATEUR**.
- Les échanges récents peuvent contenir arbitrages, essais, blocages et résultats
  non reportés. Leurs contenus exacts sont inconnus : pas de reconstruction de
  conversations. Les chemins `scratch/`, `.cline/`, configurations personnelles
  et fichiers temporaires ne constituent pas une mémoire partagée garantie.

## Doublons et risques

1. Une nouvelle vision ou un nouveau registre ADR concurrencerait les documents
   existants. Conserver une autorité par sujet et relier les nouveaux index.
2. Les sections historiques de PRODUCT/ADR décrivent parfois un système construit
   puis retiré. L'état courant indique le plan global non raccordé ; la présence
   de fonctions de planification ne démontre pas son usage. Lire les amendements.
3. Le résumé daté du 11/09 dans TWINY_MODEL précède les suites du 14–15/09 de
   l'assistant. Il faut vérifier le périmètre temporel avant de conclure à une
   contradiction. Aucun rafraîchissement automatique de statut.
4. Une migration rapportée appliquée dans un registre reste un constat daté,
   pas une vérification distante de cette session. Même limite pour les tests.
5. `.clinerules` conserve un ancien chemin de poste ; aucune hypothèse sur le
   poste courant ne doit en dépendre. Le bloc de commandes d'AGENTS racine n'a
   pas de clôture Markdown : le fermer lors de l'ajout du point d'entrée.
6. Des suppressions documentaires locales existent. La mémoire ne doit pas lier
   des fichiers supprimés simplement parce qu'ils restent présents dans Git HEAD.

## Adaptation des phases suivantes

- Phase 1 : créer une carte sourcée des connaissances, des réserves et de l'état,
  avec dates et règles d'entretien ; ne pas copier les grands documents.
- Phase 2 : ADR existants pour le produit et l'architecture ; DEC uniquement pour
  les décisions durables d'organisation interne. Pas de renumérotation historique.
- Phases 3–6 : contrats Markdown réutilisables, invocation naturelle par AGENTS,
  procédures d'analyse manuelle et formats de sortie. Aucun service ni API ajouté.
- Phase 7 : vérifier les liens/contrats et collecter un contexte Git à la demande,
  sans appel IA, écriture automatique, hook ni tâche récurrente.
- Phase 8 : condition non satisfaite ; aucune valeur comparative observée d'une
  orchestration. La reporter explicitement sans construire de framework.
- Phase 9 : registre minimal d'observations d'utilité, initialement sans données.

## Validation de la phase 0

Instructions et surfaces listées ci-dessus inspectées ; chemins et signatures
centraux vérifiés. Aucun fichier applicatif modifié, aucun test applicatif lancé,
aucune base ni fournisseur appelé. Les affirmations distantes restent inconnues.
Cet audit suffit à créer la mémoire documentaire ; il n'autorise pas un chantier
produit déduit de ses recommandations.
