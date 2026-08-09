-- --------------------------------------------------------------------
-- Migration — le verdict du tuteur est conservé (ADR-046)
--
-- Date : 09/08/2026, lot 4 du chantier de stabilisation.
--
-- ## Ce que cette migration répare
--
-- Le tuteur rendait déjà un jugement critère par critère, avec sa
-- justification. Le formulaire de bilan l'affichait, la personne validait —
-- et le texte mourait avec la page. `terminerExercice` ne recevait que
-- `resultat`, `autoEvaluation`, `dureeMin`, `notes` et `aideExterne`.
--
-- Conséquence : le tuteur ne pouvait pas relire ce qu'il avait dit la fois
-- d'avant. « Cette erreur revient » n'avait aucune matière à lire. C'était le
-- maillon manquant de la détection de motifs — une écriture absente, pas un
-- prompt mal écrit.
--
-- ## Propriétés
--
-- **Additive et idempotente.** Aucun `DROP`, aucune donnée touchée. Elle peut
-- être rejouée sans effet. Les tentatives déjà enregistrées gardent un
-- `verdict_tuteur` à `NULL` : on ne fabrique pas rétroactivement un jugement
-- que personne n'a porté (P2).
--
-- **Sans urgence.** Tant qu'elle n'est pas appliquée, l'application fonctionne
-- à l'identique : l'écriture du verdict est délibérément non bloquante
-- (`lib/store/actions.ts`), parce qu'un conseil perdu ne doit jamais empêcher
-- l'écriture d'une preuve.
--
-- ## Application
--
-- Supabase Studio › SQL Editor › coller ce fichier › Run.
-- `schema.sql` porte la même colonne pour une installation neuve.
-- --------------------------------------------------------------------

-- --------------------------------------------------------------------
-- 1. La colonne
--
-- JSONB et non un ensemble de colonnes : la forme du verdict appartient au
-- domaine (`VerdictTuteur`), elle n'est jamais interrogée champ par champ en
-- SQL, et l'élargir ne doit pas demander une migration à chaque fois.
-- --------------------------------------------------------------------

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS verdict_tuteur JSONB;

COMMENT ON COLUMN public.attempts.verdict_tuteur IS
  'Verdict proposé par le tuteur (ADR-046) : resultat, appreciations, justifications, bilan, date. '
  'NULL quand le bilan a été rempli sans assistance. '
  'Ce n''est PAS une mesure — la mesure est ce que la personne a validé, dans resultat et auto_evaluation.';

-- --------------------------------------------------------------------
-- 2. Vérification
--
-- À lire après exécution : la colonne doit exister, et aucune tentative
-- existante ne doit avoir été modifiée.
-- --------------------------------------------------------------------

DO $$
DECLARE
  colonne_posee BOOLEAN;
  avec_verdict INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attempts'
      AND column_name = 'verdict_tuteur'
  ) INTO colonne_posee;

  SELECT COUNT(*) INTO avec_verdict
  FROM public.attempts WHERE verdict_tuteur IS NOT NULL;

  IF colonne_posee THEN
    RAISE NOTICE 'attempts.verdict_tuteur : posée. % tentative(s) portent déjà un verdict.', avec_verdict;
  ELSE
    RAISE WARNING 'attempts.verdict_tuteur : ABSENTE après migration — vérifier les droits.';
  END IF;
END $$;
