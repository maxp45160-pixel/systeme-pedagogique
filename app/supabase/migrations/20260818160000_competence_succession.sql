-- =====================================================================
-- Succession d'une compétence, un vers plusieurs — ADR-087
--
-- `competences.remplace_par` est mono-valué : il exprime « LOG-01 devient
-- LOG-20 ». Il ne peut PAS exprimer « LOG-01 devient LOG-20, LOG-21, LOG-22,
-- LOG-23 » — or c'est exactement ce qu'une atomisation produit. Relevé le
-- 18/08/2026 : la colonne compte **zéro ligne**, le mécanisme d'évolution du
-- référentiel n'a jamais servi.
--
-- Cette table ne le remplace pas : `remplace_par` reste la succession 1 → 1,
-- celle du changement de sens (ADR-027). Elle ajoute le cas 1 → N.
--
-- ⚠️ Une preuve ne bouge JAMAIS. Scinder LOG-01 laisse ses cinq preuves sur
-- LOG-01 archivée, et les compétences nées de la scission démarrent à zéro
-- preuve, niveau `null`. C'est la scission sèche, tranchée le 18/08/2026 :
-- l'ancienne reste lisible avec tout son historique, les nouvelles se mesurent
-- à neuf. Ce n'est pas une régression du système, c'est P2 appliqué — et
-- l'écran doit annoncer le recul AVANT de l'appliquer.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.competence_succession (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ancien_code  TEXT NOT NULL,
  nouveau_code TEXT NOT NULL,
  -- Pourquoi la scission. Sans motif, relire une succession ancienne
  -- demanderait de deviner ce qui l'avait décidée (P3).
  motif        TEXT NOT NULL CHECK (length(btrim(motif)) > 0),
  cree_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, ancien_code, nouveau_code),
  -- Les deux clés étrangères sont réelles : contrairement à une décision du
  -- moteur, une succession ne doit pas survivre à la disparition de ses deux
  -- bouts. Une compétence qui porte une succession porte des preuves, donc
  -- s'archive et ne se supprime pas (ADR-027) — la contrainte est tenable.
  FOREIGN KEY (user_id, ancien_code)  REFERENCES public.competences(user_id, code),
  FOREIGN KEY (user_id, nouveau_code) REFERENCES public.competences(user_id, code),
  CONSTRAINT competence_succession_distincts CHECK (ancien_code <> nouveau_code)
);

-- Append-only : une succession est un fait daté, elle ne se réécrit pas.
-- Réutilise le déclencheur du journal du moteur (ADR-084) — même règle, même
-- implémentation, y compris la cascade à la suppression du compte.
DROP TRIGGER IF EXISTS competence_succession_append_only ON public.competence_succession;
CREATE TRIGGER competence_succession_append_only
  BEFORE UPDATE OR DELETE ON public.competence_succession
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_journal_moteur();

ALTER TABLE public.competence_succession ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "succession_lecture_compte" ON public.competence_succession;
CREATE POLICY "succession_lecture_compte" ON public.competence_succession
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND public.compte_actif());

-- L'écriture passe par une commande du référentiel, comme tout le reste :
-- `app.referentiel_command` est le drapeau posé par `executerCommande`
-- (ADR-065). Sans lui, une scission pourrait s'écrire hors transaction, sans
-- entrée au journal `referentiel_changes`.
DROP POLICY IF EXISTS "succession_commande_compte" ON public.competence_succession;
CREATE POLICY "succession_commande_compte" ON public.competence_succession
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND public.compte_actif()
    AND (select current_setting('app.referentiel_command', true)) = 'on'
  );

REVOKE ALL ON TABLE public.competence_succession FROM anon;
GRANT SELECT, INSERT ON TABLE public.competence_succession TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.competence_succession FROM authenticated;

-- « Qu'est devenue LOG-01 ? » et « d'où vient LOG-20 ? » : les deux sens.
CREATE INDEX IF NOT EXISTS competence_succession_ancien_idx
  ON public.competence_succession (user_id, ancien_code);
CREATE INDEX IF NOT EXISTS competence_succession_nouveau_idx
  ON public.competence_succession (user_id, nouveau_code);
