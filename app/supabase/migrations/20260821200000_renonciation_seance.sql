-- Renonciation d'une séance abandonnée (21/08/2026).
--
-- Une séance `abandonnee` qui garde des exercices jamais ouverts reste
-- « en suspens » : le cahier la montre tant qu'elle demande un geste. Mais
-- aucun geste de fermeture n'existait — seule « Reprendre » était proposée,
-- et une séance qu'on ne reprendra jamais restait ouverte indéfiniment.
--
-- `renoncee_le` porte ce geste : l'utilisateur déclare qu'il ne reprendra
-- pas. C'est un fait daté, stocké une fois, jamais dérivé — il retire la
-- séance de la file « en suspens » (`peutReprendreSeance`) sans rien effacer
-- de ce que la séance porte déjà (tentatives, résultat, durée).
--
-- Type TEXT ISO : même convention que `planifiee_pour`, que le domaine lit
-- comme chaîne.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS renoncee_le TEXT;
