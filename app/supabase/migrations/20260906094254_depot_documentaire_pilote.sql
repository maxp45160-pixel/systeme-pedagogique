-- ADR-143 : infrastructure du pilote, sans nouvel état pédagogique.
ALTER TABLE public.comptes_acces ADD COLUMN depot_pilote boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.comptes_acces.depot_pilote IS 'Activation explicite du pilote documentaire, réservée à un administrateur actif.';
CREATE TABLE public.document_depot_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id text NOT NULL,
  empreinte text NOT NULL CHECK (length(empreinte) = 64),
  statut text NOT NULL DEFAULT 'en-cours' CHECK (statut IN ('en-cours','terminee','interrompue','echec')),
  tentative uuid NOT NULL DEFAULT gen_random_uuid(),
  pages jsonb NOT NULL DEFAULT '[]',
  couvertures jsonb NOT NULL DEFAULT '[]',
  restitution jsonb,
  note_source text NOT NULL DEFAULT '',
  erreur text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_id, empreinte),
  FOREIGN KEY(user_id, document_id) REFERENCES public.documents(user_id,id) ON DELETE CASCADE
);
CREATE INDEX document_depot_analyses_compte ON public.document_depot_analyses(user_id,document_id,created_at);
CREATE TABLE public.document_depot_corrections (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  document_id text NOT NULL,
  element_id text,
  texte text NOT NULL CHECK (length(btrim(texte)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(user_id,document_id) REFERENCES public.documents(user_id,id) ON DELETE CASCADE
);
CREATE INDEX document_depot_corrections_compte ON public.document_depot_corrections(user_id,document_id,created_at);
CREATE TABLE public.document_depot_usage (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation text NOT NULL,
  periode date NOT NULL DEFAULT date_trunc('month',now() AT TIME ZONE 'UTC')::date,
  reserve_micro_euros bigint NOT NULL CHECK (reserve_micro_euros > 0),
  facture_micro_euros bigint CHECK (facture_micro_euros >= 0 AND facture_micro_euros <= reserve_micro_euros),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,operation)
);
CREATE INDEX document_depot_usage_mois ON public.document_depot_usage(user_id,periode);
ALTER TABLE public.document_depot_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_depot_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_depot_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY depot_analyses_lire ON public.document_depot_analyses FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) AND public.compte_actif());
CREATE POLICY depot_corrections_lire ON public.document_depot_corrections FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) AND public.compte_actif());
CREATE POLICY depot_corrections_ecrire ON public.document_depot_corrections FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()) AND public.compte_actif() AND public.est_admin()
    AND EXISTS (SELECT 1 FROM public.comptes_acces a WHERE a.user_id=(SELECT auth.uid()) AND a.depot_pilote)
    AND EXISTS (SELECT 1 FROM public.documents d WHERE d.user_id=document_depot_corrections.user_id
      AND d.id=document_id AND d.frontmatter->>'depot_version'='1'));
CREATE POLICY depot_usage_lire ON public.document_depot_usage FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) AND public.compte_actif());
REVOKE ALL ON public.document_depot_analyses, public.document_depot_corrections, public.document_depot_usage FROM anon,authenticated;
GRANT SELECT ON public.document_depot_analyses,public.document_depot_corrections,public.document_depot_usage TO authenticated;
GRANT INSERT ON public.document_depot_corrections TO authenticated;
GRANT ALL ON public.document_depot_analyses,public.document_depot_corrections,public.document_depot_usage TO service_role;

-- Ces trois RPC ne sont exécutables que par le serveur. Aucun tarif libre,
-- remboursement ni état IA ne peut être écrit avec un JWT navigateur.
CREATE FUNCTION public.depot_demarrer(p_user_id uuid,p_document_id text,p_empreinte text,p_reprise boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.document_depot_analyses; nouvelle boolean := false;
BEGIN
  IF NOT public.est_admin(p_user_id) OR NOT public.compte_actif(p_user_id)
    OR NOT EXISTS (SELECT 1 FROM public.comptes_acces WHERE user_id=p_user_id AND depot_pilote) OR NOT EXISTS (
    SELECT 1 FROM public.documents WHERE user_id=p_user_id AND id=p_document_id AND frontmatter->>'depot_version'='1'
  ) THEN RAISE EXCEPTION 'Dépôt inaccessible'; END IF;
  INSERT INTO public.document_depot_analyses(user_id,document_id,empreinte)
    VALUES(p_user_id,p_document_id,p_empreinte) ON CONFLICT DO NOTHING RETURNING * INTO a;
  IF FOUND THEN nouvelle := true;
  ELSE
    SELECT * INTO a FROM public.document_depot_analyses WHERE user_id=p_user_id AND document_id=p_document_id AND empreinte=p_empreinte FOR UPDATE;
    IF p_reprise AND (a.statut IN ('echec','interrompue') OR (a.statut='en-cours' AND a.updated_at < now()-interval '5 minutes')) THEN
      UPDATE public.document_depot_analyses SET statut='en-cours',tentative=gen_random_uuid(),erreur=NULL,updated_at=now()
        WHERE id=a.id RETURNING * INTO a;
      nouvelle := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('analyse',to_jsonb(a),'nouvelle',nouvelle);
END $$;

CREATE FUNCTION public.depot_reserver(p_user_id uuid,p_operation text,p_pages integer,p_entree_octets integer,p_sortie_max integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE montant bigint; utilise bigint; existant public.document_depot_usage;
BEGIN
  IF NOT public.est_admin(p_user_id) OR NOT public.compte_actif(p_user_id) THEN RAISE EXCEPTION 'Pilote inaccessible'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.comptes_acces WHERE user_id=p_user_id AND depot_pilote) THEN RAISE EXCEPTION 'Pilote non activé'; END IF;
  IF now() >= timestamptz '2026-10-06 00:00:00+00' THEN RAISE EXCEPTION 'Tarifs documentaires à revérifier'; END IF;
  IF p_pages IS NULL OR p_entree_octets IS NULL OR p_sortie_max IS NULL OR p_operation IS NULL
    OR length(p_operation) NOT BETWEEN 1 AND 200 OR p_pages NOT BETWEEN 0 AND 20
    OR p_entree_octets NOT BETWEEN 0 AND 100000 OR p_sortie_max NOT BETWEEN 0 AND 2500
    OR NOT ((p_pages>0 AND p_entree_octets=0 AND p_sortie_max=0) OR (p_pages=0 AND p_entree_octets>0 AND p_sortie_max>0))
    THEN RAISE EXCEPTION 'Réservation documentaire invalide'; END IF;
  -- Tarifs du 06/09/2026 majorés : 2 EUR/USD, incluant marge de change/taxes.
  montant := p_pages::bigint*8000 + p_entree_octets::bigint*3 + p_sortie_max::bigint*15;
  PERFORM pg_advisory_xact_lock(hashtextextended('depot-budget:'||p_user_id::text,0));
  SELECT * INTO existant FROM public.document_depot_usage WHERE user_id=p_user_id AND operation=p_operation;
  IF FOUND THEN
    IF existant.reserve_micro_euros<>montant THEN RAISE EXCEPTION 'Réservation différente'; END IF;
    RETURN jsonb_build_object('nouvelle',false,'reserve',montant);
  END IF;
  SELECT COALESCE(sum(COALESCE(facture_micro_euros,reserve_micro_euros)),0) INTO utilise
    FROM public.document_depot_usage WHERE user_id=p_user_id AND periode=date_trunc('month',now() AT TIME ZONE 'UTC')::date;
  IF utilise+montant>5000000 THEN RAISE EXCEPTION 'Budget documentaire de 5 € épuisé'; END IF;
  INSERT INTO public.document_depot_usage(user_id,operation,reserve_micro_euros) VALUES(p_user_id,p_operation,montant);
  RETURN jsonb_build_object('nouvelle',true,'reserve',montant);
END $$;

CREATE FUNCTION public.depot_finaliser_cout(p_user_id uuid,p_operation text,p_cout bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_cout IS NULL OR p_cout<0 THEN RAISE EXCEPTION 'Coût invalide'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('depot-budget:'||p_user_id::text,0));
  UPDATE public.document_depot_usage SET facture_micro_euros=p_cout
    WHERE user_id=p_user_id AND operation=p_operation AND facture_micro_euros IS NULL AND p_cout<=reserve_micro_euros;
  IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.document_depot_usage WHERE user_id=p_user_id AND operation=p_operation AND facture_micro_euros=p_cout)
    THEN RAISE EXCEPTION 'Réservation introuvable ou coût incohérent'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.depot_demarrer(uuid,text,text,boolean),public.depot_reserver(uuid,text,integer,integer,integer),public.depot_finaliser_cout(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.depot_demarrer(uuid,text,text,boolean),public.depot_reserver(uuid,text,integer,integer,integer),public.depot_finaliser_cout(uuid,text,bigint) TO service_role;
