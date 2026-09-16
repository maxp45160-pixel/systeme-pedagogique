# P01-0002 — Vérification finale locale

16/09/2026. Base `bb5aaa7fe0af28cc6e0b8a14ef73ffd216aca61f` + diff local P01-0002.
Périmètre et empreinte exacte : `checks[].snapshot` dans la fiche P01-0002.
Livré et réserves : [transmission](2026-09-16-p01-domaines-livraison.md).

## Résultats

- `npm run verify --workspace=app -- --maxWorkers=2` : code 0 ; TypeScript passe, ESLint sans erreur (10 avertissements préexistants), **2 417 tests passent dans 235 fichiers**. Exécution finale Vitest à 20:22:55 locale, durée 49,83 s.
- `npm run agents:check` : code 0 ; contrats et continuité cohérents. Avertissements de preuves historiques périmées pour le checkout courant sur DIR-0001, GRAPH-0001 et P01-0001 ; ils ne valident pas le nouveau travail.
- `git diff --check` : code 0. Avertissements Git de conversion LF/CRLF uniquement.
- Snapshot capturé avant l'exécution finale, comparé après : inchangé.

Le premier passage global avait trouvé un seul échec : le test de non-dérive SQL comparait le schéma amendé à la migration précédente. Il reconstruit désormais la fonction après le remplacement ciblé, exige une occurrence unique de l'ancienne garde, puis compare toujours le corps entier au schéma. Les quatre tests SQL statiques passent ; revue QA indépendante sans défaut relevé dans cette adaptation. Aucun historique de migration appliquée n'a été modifié.

La revue QA a aussi reproduit puis fait corriger la création SQL aboutissant pendant un choix humain : le domaine créé est signalé, le choix reste intact. Les tests couvrent réponse perdue aux différentes étapes, relecture/reprise, identité compte/document/analyse, collisions/archives, changement d'analyse, refus durable et absence de relance IA.

## Base distante et limites

Lecture seule Supabase : la garde exacte attendue par la migration apparaît **une fois** dans `pg_get_functiondef(public.appliquer_commande_referentiel(text,integer,text,text,jsonb))`. L'état distant initial et son empreinte sont consignés dans le mandat. Aucune migration distante exécutée, aucune permission changée, aucune publication et aucun appel fournisseur payant.

`20260916183000_domaines_organisation_vides.sql` reste **en attente**. Cette livraison est locale ; elle ne prouve ni activation distante, ni recette PostgreSQL, ni parcours navigateur interactif, ni pertinence du classement sur corpus réel. L'application distante requiert un accord distinct. Les modifications concurrentes sont conservées ; les tests d'app ne certifient pas les scripts organisationnels de CONT-0001.
