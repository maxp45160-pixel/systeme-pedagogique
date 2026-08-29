-- Lot 5 — mémoriser le refus entier d’une proposition de plan.
--
-- Le refus reste dans la table existante des refus : il s’agit d’un fait
-- déclaré de planification, pas d’une nouvelle entité ni d’un plan persisté.
-- Une référence stable permet au moteur de ne pas reproposer la même
-- proposition tant que ses entrées matérielles n’ont pas changé.

ALTER TABLE public.refus_recommandations
  ADD COLUMN IF NOT EXISTS proposition_ref TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refus_recommandations_proposition_ref_non_vide'
      AND conrelid = 'public.refus_recommandations'::regclass
  ) THEN
    ALTER TABLE public.refus_recommandations
      ADD CONSTRAINT refus_recommandations_proposition_ref_non_vide
      CHECK (proposition_ref IS NULL OR btrim(proposition_ref) <> '');
  END IF;
END
$$;
