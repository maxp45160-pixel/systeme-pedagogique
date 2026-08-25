-- ADR-137 — Le lien échéance → module est un fait déclaré.
--
-- Un module de cours est un cadre existant : un domaine du référentiel, qui
-- rassemble déjà ses PDFs (front-matter `domaine`), ses compétences
-- (`competence_domaines`) et ses sous-parties (sous-domaines). Une échéance
-- peut désormais se lier à lui : colonne nullable, écrite une seule fois à la
-- création par l'application, après validation contre les domaines vivants du
-- compte. Append-only intact : ni report ni clôture ne réécrivent ce champ.
-- Le sens inverse — les échéances d'un module — se DÉRIVE à la lecture et ne
-- se stocke nulle part (P1). Aucune entité nouvelle (ADR-135 respectée).
ALTER TABLE public.engagements
  ADD COLUMN IF NOT EXISTS module_domaine_id TEXT;
