-- Abandon d'une séance (chantier « cahier », 16/08/2026).
--
-- Une séance en cours n'avait qu'une seule sortie : `terminerSeance`. Une
-- séance qu'on ne veut pas mener restait ouverte indéfiniment — et comme une
-- seule séance pouvait être en cours à la fois, elle bloquait toutes les
-- suivantes.
--
-- `abandonnee` est le pendant, pour la séance, de ce que `attempts.statut`
-- porte déjà pour la tentative : une trace conservée, sans mesure. Ce que
-- l'abandon a produit reste écrit (les tentatives menées gardent leurs
-- preuves) ; ce qui n'a pas eu lieu ne devient pas un zéro.
--
-- Aucune ligne existante n'est touchée : au 16/08/2026, `sessions` porte 46
-- statuts NULL (séances historiques auto-générées), 4 `terminee` et 1
-- `en-cours`. La contrainte est seulement élargie.

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_statut_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_statut_check
  CHECK (
    statut IS NULL
    OR statut IN ('planifiee', 'en-cours', 'terminee', 'abandonnee')
  );
