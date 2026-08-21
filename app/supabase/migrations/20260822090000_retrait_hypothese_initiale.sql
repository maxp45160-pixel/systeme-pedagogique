-- Retrait de `competences.hypothese_initiale`.
--
-- Décision du 22/08/2026 : jamais écrite depuis l'import initial ; les onze
-- valeurs restantes sont homogènes et archivées ici même — rien
-- d'irremplaçable ne disparaît.
--
-- Valeurs archivées (`niveauSuppose` = "0-1" partout) :
--   LOG-01, LOG-02, LOG-03, PROD-01, PROD-02, PROD-03, PROD-04, PROD-06 :
--     « Cœur du BUT QLIO — hypothèse de niveau D, à confirmer. »
--   STAT-01, STAT-02, STAT-05 :
--     « Domaine couvert par le BUT QLIO — hypothèse de niveau D, à confirmer. »
--
-- Le statut moteur « hypothese » (hypothèse de formation déclarée, sans
-- preuve) est retiré avec la donnée qui le portait : une compétence sans
-- observation est désormais simplement non évaluée — c'est l'invariant 3,
-- absence de preuve ≠ zéro, sans intermédiaire déclaratif.

ALTER TABLE public.competences DROP COLUMN IF EXISTS hypothese_initiale;
