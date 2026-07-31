-- ====================================================================
-- Migration du référentiel codé en dur vers les tables par compte (ADR-026).
--
-- GÉNÉRÉ par `scripts/migrer-referentiel.ts` — ne pas éditer à la main :
-- régénérer. Idempotent (ON CONFLICT DO NOTHING), applicable plusieurs fois.
--
-- Prérequis : la section 2 de `schema.sql` doit avoir été appliquée.
-- Ensuite : réexécuter `schema.sql`, qui posera alors evidence_competence_fk.
-- ====================================================================

-- Refus net si les comptes visés n'existent pas : mieux vaut une erreur qu'une
-- migration silencieusement vide.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'd4210770-e9ed-44d8-be57-36d2151f896a') THEN
    RAISE EXCEPTION 'Compte d4210770-e9ed-44d8-be57-36d2151f896a introuvable — vérifier les identifiants avant d''appliquer.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '5a6b80a4-6421-48ba-a254-ee4220c34ccb') THEN
    RAISE EXCEPTION 'Compte 5a6b80a4-6421-48ba-a254-ee4220c34ccb introuvable — vérifier les identifiants avant d''appliquer.';
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- maxime.peyredieu — les 8 domaines et les 53 compétences.
-- `active` reprend le domaine pilote d'ADR-020 : 10 compétences DEV.
-- --------------------------------------------------------------------

INSERT INTO public.domaines (user_id, id, nom, prefixe, description, ordre, archive, origine) VALUES
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'developpement', 'Développement logiciel', 'DEV', 'Lire, comprendre et faire évoluer un logiciel réel — typage, architecture, outillage, jugement technique.', 0, false, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'statistiques', 'Statistiques et probabilités', 'STAT', 'Décrire, modéliser et décider sous incertitude.', 1, false, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'logistique', 'Logistique industrielle', 'LOG', 'Stocks, prévision, approvisionnement, réseaux et résilience.', 2, false, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'production', 'Gestion de production', 'PROD', 'Capacité, planification, ordonnancement et amélioration continue.', 3, false, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'algorithmique', 'Algorithmique et programmation', 'ALGO', 'Structurer, implémenter et analyser une solution calculatoire.', 4, false, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'recherche-operationnelle', 'Recherche opérationnelle et optimisation', 'RO', 'Formuler et résoudre des problèmes de décision optimale.', 5, false, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'systemes-complexes', 'Systèmes complexes', 'SYSC', 'Interactions, rétroactions, simulation, robustesse.', 6, false, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'technologies-innovantes', 'Technologies innovantes', 'TECH', 'IA, IoT, jumeaux numériques, automatisation industrielle.', 7, false, 'migration')
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.competences (user_id, code, domaine, intitule, palier, prerequis, importance, ordre, active, archive, hypothese_initiale, origine) VALUES
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-01', 'developpement', 'Lire et exploiter un système de types statique pour borner les valeurs valides (unions, Record, garde-fous à la compilation)', 'fondamentaux', ARRAY[]::TEXT[], 1, 0, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-02', 'developpement', 'Exécuter mentalement une fonction pure pour prédire son résultat avant de lancer le code', 'fondamentaux', ARRAY[]::TEXT[], 1, 1, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-03', 'developpement', 'Reconnaître et utiliser les opérations de collection courantes (filter, map, Set) pour lire du code métier', 'fondamentaux', ARRAY['DEV-02']::TEXT[], 1, 2, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-04', 'developpement', 'Dérouler à la main un pipeline de plusieurs fonctions pures enchaînées et vérifier sa prédiction par un test', 'intermediaire', ARRAY['DEV-01', 'DEV-03']::TEXT[], 0.9, 3, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-05', 'developpement', 'Confronter une documentation produit au code qui l''implémente pour repérer un écart entre le principe énoncé et son application réelle', 'intermediaire', ARRAY['DEV-04']::TEXT[], 0.9, 4, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-06', 'developpement', 'Tracer le trajet complet d''une donnée dans une architecture client → serveur → base, en identifiant la frontière exacte entre les deux mondes', 'intermediaire', ARRAY['DEV-01']::TEXT[], 0.9, 5, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-07', 'developpement', 'Repérer une contradiction entre un commentaire de code et le comportement réel du code qu''il documente', 'avance', ARRAY['DEV-06']::TEXT[], 0.85, 6, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-08', 'developpement', 'Localiser tous les usages d''un symbole ou d''un motif dans un dépôt par recherche structurée (grep), plutôt que fichier par fichier', 'avance', ARRAY[]::TEXT[], 1, 7, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-09', 'developpement', 'Corriger un défaut réel identifié soi-même, en s''appuyant sur un filet de sécurité automatisé (typage, lint, tests) pour valider la correction', 'avance', ARRAY['DEV-08']::TEXT[], 0.9, 8, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'DEV-10', 'developpement', 'Arbitrer une décision technique avec une grille explicite (problème réel, besoin, effets de bord, alternatives, recommandation tranchée)', 'avance', ARRAY['DEV-05', 'DEV-09']::TEXT[], 0.85, 9, true, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'STAT-01', 'statistiques', 'Décrire et interpréter un jeu de données industriel avec les statistiques descriptives adaptées', 'fondamentaux', ARRAY[]::TEXT[], 1, 0, false, false, '{"niveauSuppose":"0-1","justification":"Domaine couvert par le BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'STAT-02', 'statistiques', 'Modéliser une variable aléatoire par une loi adaptée à un contexte industriel (Binomiale, Poisson, Normale)', 'fondamentaux', ARRAY['STAT-01']::TEXT[], 1, 1, false, false, '{"niveauSuppose":"0-1","justification":"Domaine couvert par le BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'STAT-03', 'statistiques', 'Construire et interpréter un intervalle de confiance en contexte industriel', 'intermediaire', ARRAY['STAT-02']::TEXT[], 0.85, 2, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'STAT-04', 'statistiques', 'Réaliser un test d''hypothèse pour comparer deux processus ou échantillons', 'intermediaire', ARRAY['STAT-03']::TEXT[], 0.85, 3, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'STAT-05', 'statistiques', 'Construire une carte de contrôle (SPC) et interpréter sa stabilité', 'intermediaire', ARRAY['STAT-02']::TEXT[], 0.75, 4, false, false, '{"niveauSuppose":"0-1","justification":"Domaine couvert par le BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'STAT-06', 'statistiques', 'Réaliser et interpréter une régression linéaire appliquée à un cas industriel', 'avance', ARRAY['STAT-03']::TEXT[], 0.8, 5, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'STAT-07', 'statistiques', 'Relier le z-score de la loi normale centrée réduite (z = (X−μ)/σ) à une application concrète de gestion industrielle (ex. stock de sécurité)', 'intermediaire', ARRAY['STAT-02']::TEXT[], 0.9, 6, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-01', 'logistique', 'Modéliser et résoudre un problème de gestion de stock à demande déterministe (quantité économique, point de commande)', 'fondamentaux', ARRAY[]::TEXT[], 0.95, 0, false, false, '{"niveauSuppose":"0-1","justification":"Cœur du BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-02', 'logistique', 'Calculer un stock de sécurité et un point de commande sous demande variable (niveau de service, loi normale)', 'intermediaire', ARRAY['LOG-01', 'STAT-02']::TEXT[], 0.95, 1, false, false, '{"niveauSuppose":"0-1","justification":"Cœur du BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-03', 'logistique', 'Élaborer une prévision de demande (moyenne mobile, lissage exponentiel) et évaluer sa précision', 'intermediaire', ARRAY['STAT-01']::TEXT[], 0.85, 2, false, false, '{"niveauSuppose":"0-1","justification":"Cœur du BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-04', 'logistique', 'Élaborer un plan d''approvisionnement sous contraintes de délais et de fournisseurs', 'intermediaire', ARRAY['LOG-01']::TEXT[], 0.7, 3, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-05', 'logistique', 'Analyser et optimiser un réseau logistique (implantation, flux, coûts de transport)', 'avance', ARRAY['RO-01']::TEXT[], 0.8, 4, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-06', 'logistique', 'Évaluer la résilience d''une chaîne logistique face à une perturbation (rupture, aléas de demande)', 'avance', ARRAY['LOG-02', 'SYSC-05']::TEXT[], 0.9, 5, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-07', 'logistique', 'Identifier et typer les sources d''incertitude d''un système de production (demande, capacité/process, approvisionnement), y compris les données de référence supposées fiables à tort', 'fondamentaux', ARRAY[]::TEXT[], 0.85, 6, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-08', 'logistique', 'Analyser l''arbitrage économique entre taux de service visé et stock de sécurité, et situer le modèle adapté (Wilson/EOQ en avenir certain vs newsvendor en avenir incertain)', 'avance', ARRAY['LOG-02']::TEXT[], 0.8, 7, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'LOG-09', 'logistique', 'Calculer un stock de sécurité sous incertitude combinée (variabilité de la demande ET du délai fournisseur)', 'avance', ARRAY['LOG-02']::TEXT[], 0.85, 8, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'PROD-01', 'production', 'Construire un Plan Industriel et Commercial (PIC) à partir de prévisions et de contraintes de capacité', 'fondamentaux', ARRAY['LOG-03']::TEXT[], 0.9, 0, false, false, '{"niveauSuppose":"0-1","justification":"Cœur du BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'PROD-02', 'production', 'Élaborer un Plan Directeur de Production (PDP) et vérifier sa faisabilité', 'intermediaire', ARRAY['PROD-01']::TEXT[], 0.8, 1, false, false, '{"niveauSuppose":"0-1","justification":"Cœur du BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'PROD-03', 'production', 'Calculer les besoins nets par la méthode MRP à partir d''une nomenclature et de stocks existants', 'intermediaire', ARRAY['PROD-02']::TEXT[], 0.9, 2, false, false, '{"niveauSuppose":"0-1","justification":"Cœur du BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'PROD-04', 'production', 'Ordonnancer un atelier selon une règle de priorité et évaluer la performance obtenue', 'intermediaire', ARRAY[]::TEXT[], 0.8, 3, false, false, '{"niveauSuppose":"0-1","justification":"Cœur du BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'PROD-05', 'production', 'Identifier une contrainte selon la Théorie des Contraintes (TOC) et proposer une action', 'avance', ARRAY['PROD-04']::TEXT[], 0.75, 4, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'PROD-06', 'production', 'Calculer et interpréter un TRS et en déduire un axe d''amélioration continue', 'fondamentaux', ARRAY[]::TEXT[], 0.7, 5, false, false, '{"niveauSuppose":"0-1","justification":"Cœur du BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'ALGO-01', 'algorithmique', 'Écrire un algorithme structuré (boucles, conditions, fonctions) pour un problème simple', 'fondamentaux', ARRAY[]::TEXT[], 1, 0, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'ALGO-02', 'algorithmique', 'Choisir une structure de données adaptée à un problème et justifier ce choix', 'intermediaire', ARRAY['ALGO-01']::TEXT[], 0.85, 1, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'ALGO-03', 'algorithmique', 'Analyser la complexité d''une solution algorithmique (notation grande-O)', 'intermediaire', ARRAY['ALGO-02']::TEXT[], 0.85, 2, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'ALGO-04', 'algorithmique', 'Manipuler des graphes (parcours, plus court chemin) pour un problème logistique', 'avance', ARRAY['ALGO-02']::TEXT[], 0.9, 3, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'ALGO-05', 'algorithmique', 'Écrire un programme Python pour traiter et analyser des données', 'fondamentaux', ARRAY['ALGO-01']::TEXT[], 1, 4, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'ALGO-06', 'algorithmique', 'Concevoir une simulation simple (file d''attente, stock) en Python', 'avance', ARRAY['ALGO-05', 'STAT-02']::TEXT[], 0.95, 5, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'RO-01', 'recherche-operationnelle', 'Formuler un problème industriel sous forme de programme linéaire (variables, contraintes, objectif)', 'fondamentaux', ARRAY[]::TEXT[], 0.95, 0, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'RO-02', 'recherche-operationnelle', 'Résoudre un programme linéaire et interpréter la solution (valeurs, coûts marginaux)', 'intermediaire', ARRAY['RO-01']::TEXT[], 0.9, 1, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'RO-03', 'recherche-operationnelle', 'Modéliser un problème d''affectation ou de transport et le résoudre', 'intermediaire', ARRAY['RO-01']::TEXT[], 0.85, 2, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'RO-04', 'recherche-operationnelle', 'Appliquer une métaheuristique simple (glouton, recuit simulé) à un problème combinatoire', 'avance', ARRAY['ALGO-03', 'RO-01']::TEXT[], 0.85, 3, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'RO-05', 'recherche-operationnelle', 'Modéliser un système de files d''attente et interpréter ses indicateurs de performance', 'avance', ARRAY['STAT-02']::TEXT[], 0.8, 4, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'SYSC-01', 'systemes-complexes', 'Identifier composants, interactions et boucles de rétroaction d''un système industriel', 'fondamentaux', ARRAY[]::TEXT[], 0.9, 0, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'SYSC-02', 'systemes-complexes', 'Construire un modèle causal (diagramme d''influence) et discuter sa cohérence', 'intermediaire', ARRAY['SYSC-01']::TEXT[], 0.85, 1, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'SYSC-03', 'systemes-complexes', 'Réaliser une simulation à événements discrets ou à base d''agents', 'avance', ARRAY['ALGO-06', 'SYSC-02']::TEXT[], 0.95, 2, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'SYSC-04', 'systemes-complexes', 'Analyser la sensibilité d''un système à la variation d''un paramètre clé', 'avance', ARRAY['SYSC-03']::TEXT[], 0.85, 3, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'SYSC-05', 'systemes-complexes', 'Discuter la robustesse et la résilience d''un système face à une perturbation', 'avance', ARRAY['SYSC-04']::TEXT[], 0.9, 4, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'TECH-01', 'technologies-innovantes', 'Expliquer les principes et cas d''usage du Machine Learning en contexte industriel', 'fondamentaux', ARRAY[]::TEXT[], 0.9, 0, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'TECH-02', 'technologies-innovantes', 'Expliquer l''architecture et les cas d''usage d''un système IoT industriel', 'fondamentaux', ARRAY[]::TEXT[], 0.75, 1, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'TECH-03', 'technologies-innovantes', 'Expliquer le concept de jumeau numérique et ses conditions de mise en œuvre', 'intermediaire', ARRAY['TECH-02', 'SYSC-03']::TEXT[], 0.85, 2, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'TECH-04', 'technologies-innovantes', 'Analyser un cas d''automatisation/robotique industrielle et ses impacts', 'intermediaire', ARRAY[]::TEXT[], 0.7, 3, false, false, NULL, 'migration'),
  ('d4210770-e9ed-44d8-be57-36d2151f896a', 'TECH-05', 'technologies-innovantes', 'Discuter enjeux et limites de l''intégration de l''IA dans un système de production', 'avance', ARRAY['TECH-01']::TEXT[], 0.85, 4, false, false, NULL, 'migration')
ON CONFLICT (user_id, code) DO NOTHING;

-- --------------------------------------------------------------------
-- cyril.hup2716 — uniquement les compétences que ses 3 preuves référencent,
-- archivées. Son référentiel de travail reste vide : il passe par l'amorçage
-- et déclare son propre thème.
-- --------------------------------------------------------------------

INSERT INTO public.domaines (user_id, id, nom, prefixe, description, ordre, archive, origine) VALUES
  ('5a6b80a4-6421-48ba-a254-ee4220c34ccb', 'developpement', 'Développement logiciel', 'DEV', 'Lire, comprendre et faire évoluer un logiciel réel — typage, architecture, outillage, jugement technique.', 0, true, 'migration'),
  ('5a6b80a4-6421-48ba-a254-ee4220c34ccb', 'statistiques', 'Statistiques et probabilités', 'STAT', 'Décrire, modéliser et décider sous incertitude.', 1, true, 'migration')
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.competences (user_id, code, domaine, intitule, palier, prerequis, importance, ordre, active, archive, hypothese_initiale, origine) VALUES
  ('5a6b80a4-6421-48ba-a254-ee4220c34ccb', 'DEV-01', 'developpement', 'Lire et exploiter un système de types statique pour borner les valeurs valides (unions, Record, garde-fous à la compilation)', 'fondamentaux', ARRAY[]::TEXT[], 1, 0, false, true, NULL, 'migration'),
  ('5a6b80a4-6421-48ba-a254-ee4220c34ccb', 'DEV-02', 'developpement', 'Exécuter mentalement une fonction pure pour prédire son résultat avant de lancer le code', 'fondamentaux', ARRAY[]::TEXT[], 1, 1, false, true, NULL, 'migration'),
  ('5a6b80a4-6421-48ba-a254-ee4220c34ccb', 'STAT-01', 'statistiques', 'Décrire et interpréter un jeu de données industriel avec les statistiques descriptives adaptées', 'fondamentaux', ARRAY[]::TEXT[], 1, 2, false, true, '{"niveauSuppose":"0-1","justification":"Domaine couvert par le BUT QLIO — hypothèse de niveau D, à confirmer."}'::jsonb, 'migration')
ON CONFLICT (user_id, code) DO NOTHING;

-- --------------------------------------------------------------------
-- Contrôle : aucune preuve ne doit rester sans compétence correspondante.
-- Tant que ce SELECT ne renvoie pas 0, evidence_competence_fk ne se posera pas.
-- --------------------------------------------------------------------

SELECT COUNT(*) AS preuves_orphelines
FROM public.evidence e
LEFT JOIN public.competences c
  ON c.user_id = e.user_id AND c.code = e.skill_code
WHERE c.code IS NULL;
