-- ADR-108, complément — le fait qu'une relecture a eu lieu.
--
-- ## Le défaut que cette table corrige
--
-- ADR-108 fait de la PÉREMPTION le déclencheur : une relecture est due quand
-- les versions de domaine ont bougé depuis la dernière. `20260824090000` a
-- livré les propositions et `scinder_domaine`, mais la péremption s'y déduisait
-- des propositions enregistrées :
--
--     relectureDue = enregistrees.length === 0 || ouvertes.length === 0
--
-- Ce raccourci marche tant qu'un lot produit quelque chose. Il se retourne dès
-- qu'un lot n'a RIEN à proposer — ce qui est le cas normal d'un référentiel
-- bien rangé. Le lot vide n'écrit aucune ligne, « à relire » reste donc vrai
-- indéfiniment, et la relecture repart à chaque ouverture de l'Atelier pour
-- rappeler le modèle et ne rien produire. Le pire des deux mondes : le coût
-- d'un appel à chaque chargement, et jamais de résultat.
--
-- Un lot vide est une RÉPONSE. Cette table est ce qui permet de l'enregistrer.
--
-- ## Ce qu'elle porte, et ce qu'elle ne porte pas
--
-- Un fait daté — « le J, une relecture a lu ces versions » — au même titre
-- qu'une proposition (précédent ADR-004). AUCUN état dérivé : « est-ce
-- périmé » se recalcule en comparant `versions_lues` aux versions courantes,
-- à chaque lecture (couche 3).
--
-- Additive et idempotente. Dépend de `20260824090000_relecture_referentiel`.

CREATE TABLE IF NOT EXISTS public.relectures_referentiel (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id            TEXT NOT NULL,
  -- Les versions des domaines au moment de la lecture. L'instantané porte le
  -- référentiel ENTIER : c'est bien tout le référentiel qui vient d'être relu,
  -- quand bien même chaque proposition ne retient que les versions des
  -- domaines qu'elle nomme.
  versions_lues JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Combien de propositions ce lot a produites. Zéro est une valeur normale,
  -- et c'est tout l'objet de cette table.
  produites     INTEGER NOT NULL DEFAULT 0 CHECK (produites >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

COMMENT ON TABLE public.relectures_referentiel IS
  'Fait daté : une relecture du référentiel a eu lieu, sur ces versions (ADR-108). Permet à un lot VIDE d''être une réponse enregistrée plutôt qu''une relecture éternellement due. La péremption s''en dérive, elle ne s''y stocke pas.';

CREATE INDEX IF NOT EXISTS relectures_referentiel_recentes_idx
  ON public.relectures_referentiel (user_id, created_at DESC);

ALTER TABLE public.relectures_referentiel ENABLE ROW LEVEL SECURITY;

-- ADR-074 : `compte_actif()` en plus de l'isolation par compte.
--
-- Pas de drapeau `app.referentiel_command`, pour la même raison que
-- `propositions_referentiel` : ADR-108 exige que la relecture tourne hors du
-- chemin d'écriture du référentiel. Inscrire une relecture ne mute aucun
-- agrégat et ne peut faire échouer aucune commande.
DROP POLICY IF EXISTS "relectures_lecture_compte" ON public.relectures_referentiel;
CREATE POLICY "relectures_lecture_compte" ON public.relectures_referentiel
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND (select public.compte_actif()));

DROP POLICY IF EXISTS "relectures_insertion_compte" ON public.relectures_referentiel;
CREATE POLICY "relectures_insertion_compte" ON public.relectures_referentiel
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select public.compte_actif()));

REVOKE ALL ON TABLE public.relectures_referentiel FROM anon;
GRANT SELECT, INSERT ON TABLE public.relectures_referentiel TO authenticated;
-- Un fait daté ne se réécrit pas, et ne s'efface pas.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.relectures_referentiel FROM authenticated;
