-- =====================================================================
-- Journal du moteur — ADR-084
--
-- Le moteur décide et prédit tous les jours, puis jette. `recommend.ts`
-- calcule un score et des facteurs, `difficulteVisee()` affirme qu'une
-- difficulté est calibrée, `spaced.estDue()` affirme qu'une compétence est
-- encore sue, `calibration.ts` estime une durée. Rien de tout cela n'est
-- conservé, si bien qu'aucune de ces affirmations n'a jamais été confrontée
-- au réel. Seuls les REFUS l'étaient (34 lignes) : on sait ce que la personne
-- a écarté, jamais si le moteur avait raison.
--
-- P1 dit « rien de ce qui est dérivable n'est stocké ». Une décision et une
-- prédiction ne sont PAS dérivables après coup : l'état qui les a produites a
-- changé. Ce sont des faits datés, au même titre que `BesoinDeclare`
-- (ADR-050) et `verdictTuteur` (ADR-046), et c'est à ce titre — et à ce titre
-- seul — qu'elles sont écrites ici.
--
-- Ce qui reste dérivé : les métriques. Aucune table ne stocke un score de
-- Brier ni une erreur de calibration ; `lib/engine/auto-evaluation.ts` les
-- recalcule à la lecture en rejouant ces prédictions contre les faits.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le refus de mutation — deux verrous plutôt qu'un
--
-- Aucune politique UPDATE/DELETE n'est posée plus bas, ce qui suffirait pour
-- un client `authenticated`. Le trigger existe pour ce que RLS ne couvre
-- pas : une connexion `service_role`, un script de maintenance, une console.
-- Un journal qui se réécrit ne vaut rien — c'est le même raisonnement que
-- pour `referentiel_changes` (ADR-065), dont ce déclencheur est le calque.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refuser_mutation_journal_moteur()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  -- L'immutabilité vaut pendant la vie du compte. La suppression explicite du
  -- compte doit néanmoins pouvoir cascader ses données personnelles.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Le journal du moteur est append-only';
END;
$fn$;

-- ---------------------------------------------------------------------
-- 2. Les décisions
--
-- Une ligne par action RÉELLEMENT présentée. `request_id` porte
-- l'idempotence : la clé applicative est (compte, cible, politique, jour),
-- si bien qu'un rafraîchissement de page ne crée pas de ligne et qu'un
-- compte actif produit quelques lignes par jour, pas quelques milliers.
--
-- Pas de colonne `status`. L'analyse qui a lancé ce chantier confondait sous
-- ce mot trois choses distinctes — la livraison, la réponse de la personne,
-- l'exécution. Ce qu'il advient d'une décision se LIT dans les faits qui la
-- suivent : une tentative sur l'exercice ciblé, un refus dans
-- `refus_recommandations`, ou rien. Une colonne mutable aurait de toute façon
-- contredit l'append-only.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moteur_decisions (
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id                UUID NOT NULL DEFAULT gen_random_uuid(),
  request_id        TEXT NOT NULL,
  prise_le          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type              TEXT NOT NULL CHECK (type IN (
                      'recommandation', 'composition-seance', 'revision-due', 'calibration')),
  politique_version TEXT NOT NULL CHECK (length(btrim(politique_version)) > 0),
  -- Volontairement SANS clé étrangère vers `competences`.
  --
  -- Une décision est un fait historique : elle doit rester lisible quand la
  -- compétence visée a été supprimée depuis (ADR-027 l'autorise tant qu'aucune
  -- preuve n'existe). Même précédent que `themes.codes` et
  -- `competences.prerequis`, qui n'en portent pas pour cette raison exacte.
  cible_code        TEXT,
  -- Exercice ou séance visés. NULL = la décision portait sur la compétence
  -- seule, cas normal quand aucun exercice n'existe pour elle.
  cible_ref         TEXT,
  -- `Facteur[]` tel que `recommend.ts` le produit — libellé, contribution,
  -- phrase. C'est le « Pourquoi ? » de P3, figé au moment où il a été montré.
  facteurs          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Empreinte de l'état lu : niveau, confiance, robustesse, nombre de preuves,
  -- jours depuis la dernière. Pas l'état entier — ce qu'il faut pour rejouer
  -- la décision et comprendre ce qu'elle voyait.
  etat_entree       JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id)
);

-- ---------------------------------------------------------------------
-- 3. Les prédictions
--
-- Aucune colonne de résolution, aucune table de résultats : la résolution est
-- DÉRIVÉE en joignant la prédiction au fait qui la tranche.
--
--   reussite  → 1re tentative terminée sur `cible_ref` après `emise_le`
--   duree     → la même tentative, colonne `duree_min` (42 lignes existent déjà)
--   retention → 1re preuve sur `cible_code` après `horizon_le`
--
-- C'est la différence de fond avec le modèle qui a inspiré ce chantier :
-- stocker les résultats aurait dupliqué `attempts` et `evidence`, et créé une
-- seconde vérité à synchroniser. Une prédiction sans fait résolvant reste EN
-- ATTENTE, jamais comptée comme un échec (P2).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moteur_predictions (
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id             UUID NOT NULL DEFAULT gen_random_uuid(),
  request_id     TEXT NOT NULL,
  emise_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type           TEXT NOT NULL CHECK (type IN ('reussite', 'duree', 'retention')),
  -- Sans clé étrangère, même raison que `moteur_decisions.cible_code`.
  cible_code     TEXT NOT NULL,
  -- L'exercice sur lequel porte la prédiction. NULL pour 'retention', qui
  -- porte sur la compétence et non sur un support.
  cible_ref      TEXT,
  -- p(réussite) et p(niveau tenu) dans [0,1] ; minutes attendues pour 'duree'.
  -- La borne haute n'est pas contrainte ici : une durée n'a pas de maximum, et
  -- un CHECK conditionnel au type serait un garde-fou déplacé — c'est
  -- `prediction.ts` qui construit ces valeurs, et lui seul.
  valeur         DOUBLE PRECISION NOT NULL CHECK (valeur >= 0),
  -- La date à laquelle la prédiction devient vérifiable. Renseignée pour
  -- 'retention' (la date due), absente pour les deux autres, qui se résolvent
  -- à la première tentative.
  horizon_le     TIMESTAMPTZ,
  modele_version TEXT NOT NULL CHECK (length(btrim(modele_version)) > 0),
  -- Les valeurs lues qui ont produit la prédiction (P3 — aucune valeur sans sa
  -- source). Sans elles, une prédiction fausse ne s'explique pas.
  entrees        JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_id    UUID,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id),
  -- Une décision n'est jamais supprimée : la clé étrangère est sûre. NULL est
  -- admis (MATCH SIMPLE) pour une prédiction émise hors décision.
  FOREIGN KEY (user_id, decision_id)
    REFERENCES public.moteur_decisions(user_id, id)
);

-- ---------------------------------------------------------------------
-- 4. Append-only
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS moteur_decisions_append_only ON public.moteur_decisions;
CREATE TRIGGER moteur_decisions_append_only
  BEFORE UPDATE OR DELETE ON public.moteur_decisions
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_journal_moteur();

DROP TRIGGER IF EXISTS moteur_predictions_append_only ON public.moteur_predictions;
CREATE TRIGGER moteur_predictions_append_only
  BEFORE UPDATE OR DELETE ON public.moteur_predictions
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_journal_moteur();

-- ---------------------------------------------------------------------
-- 5. RLS — isolation par compte ET compte actif (ADR-074)
--
-- `compte_actif()` en plus de l'isolation : sans elle, un compte suspendu lit
-- à nouveau. C'est la règle que CLAUDE.md impose à toute table métier, et
-- l'état réel des politiques en service la respecte partout.
--
-- Aucune politique UPDATE ni DELETE : leur absence les interdit.
-- ---------------------------------------------------------------------
ALTER TABLE public.moteur_decisions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moteur_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moteur_decisions_lecture_compte" ON public.moteur_decisions;
CREATE POLICY "moteur_decisions_lecture_compte" ON public.moteur_decisions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND public.compte_actif());

DROP POLICY IF EXISTS "moteur_decisions_ecriture_compte" ON public.moteur_decisions;
CREATE POLICY "moteur_decisions_ecriture_compte" ON public.moteur_decisions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.compte_actif());

DROP POLICY IF EXISTS "moteur_predictions_lecture_compte" ON public.moteur_predictions;
CREATE POLICY "moteur_predictions_lecture_compte" ON public.moteur_predictions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND public.compte_actif());

DROP POLICY IF EXISTS "moteur_predictions_ecriture_compte" ON public.moteur_predictions;
CREATE POLICY "moteur_predictions_ecriture_compte" ON public.moteur_predictions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.compte_actif());

REVOKE ALL ON TABLE public.moteur_decisions, public.moteur_predictions FROM anon;
GRANT SELECT, INSERT ON TABLE public.moteur_decisions, public.moteur_predictions TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.moteur_decisions, public.moteur_predictions FROM authenticated;

-- ---------------------------------------------------------------------
-- 6. Index — les lectures réelles
--
-- L'auto-évaluation balaie les prédictions d'un compte par type et par date ;
-- la résolution cherche celles qui portent sur un exercice donné.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS moteur_decisions_user_prise_idx
  ON public.moteur_decisions (user_id, prise_le DESC);
CREATE INDEX IF NOT EXISTS moteur_predictions_user_type_emise_idx
  ON public.moteur_predictions (user_id, type, emise_le DESC);
CREATE INDEX IF NOT EXISTS moteur_predictions_user_cible_idx
  ON public.moteur_predictions (user_id, cible_ref, emise_le);
