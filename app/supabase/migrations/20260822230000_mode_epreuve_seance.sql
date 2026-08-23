-- Mode épreuve d'une séance (22/08/2026).
--
-- Une séance peut être composée pour être menée dans des conditions réelles
-- (persona concours daté) : chrono affiché, aides masquées pendant le
-- déroulé, correction à la fin. `mode_epreuve` porte cette déclaration.
--
-- C'est un fait déclaré AU DÉPART de la séance (`creerSeance` est le seul
-- écrivain), jamais dérivé ni modifiable après coup — voir
-- `motifRefusChangementModeEpreuve` (lib/domain/seance.ts). Il n'entre dans
-- aucun calcul du moteur : c'est un habillage de séance, pas une mesure.
--
-- Type BOOLEAN nullable : même convention que `statut`, que le domaine lit
-- comme absence — NULL = non posé = séance ordinaire. Les séances écrites
-- avant ce chantier ne portent rien, et on ne leur fabrique pas
-- rétroactivement un régime qu'elles n'ont pas eu.
--
-- ⚠️ ÉTAT : APPLIQUÉE le 22/08/2026 sur le projet distant ; `schema.sql`
-- (référence) porte la même colonne depuis la même journée.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS mode_epreuve BOOLEAN;
