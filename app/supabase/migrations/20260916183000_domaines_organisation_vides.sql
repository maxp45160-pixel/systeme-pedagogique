-- P01-0002 : domaine d'organisation sans compétence ni usage déduit.
-- Préparée puis appliquée le 16/09/2026 avec accord humain explicite.
-- Version distante Supabase : 20260916183753_domaines_organisation_vides.
-- Corps après application : MD5 b1b8253dfafab2763c34db60e9e6e23c.
-- État distant relu : appliquer_commande_referentiel(text,integer,text,text,jsonb),
-- MD5 prosrc 85ff24629e3d0f8966fcbecdaf98d336 ; dernière migration 20260915220807.
-- Seule la garde de création vide change. La définition courante préserve
-- signature, configuration, sécurité et corps ; aucun changement de permissions.
DO $$
DECLARE
  v_signature TEXT := 'public.appliquer_commande_referentiel(text,integer,text,text,jsonb)';
  v_definition TEXT;
  v_ancien TEXT := $ancien$    IF jsonb_array_length(coalesce(p_commande -> 'competences', '[]'::JSONB)) = 0
       AND jsonb_array_length(coalesce(p_commande -> 'rattachementsExistants', '[]'::JSONB)) = 0
       AND v_usage_type IS DISTINCT FROM 'module' THEN
      RAISE EXCEPTION 'Seul un module académique peut naître sans compétence ni rattachement.';
    END IF;$ancien$;
  v_nouveau TEXT := $nouveau$    IF jsonb_array_length(coalesce(p_commande -> 'competences', '[]'::JSONB)) = 0
       AND jsonb_array_length(coalesce(p_commande -> 'rattachementsExistants', '[]'::JSONB)) = 0
       AND v_usage_type = 'continu' THEN
      RAISE EXCEPTION 'Un domaine continu exige au moins une compétence ou un rattachement.';
    END IF;$nouveau$;
  v_occurrences INTEGER;
  v_corrigees INTEGER;
BEGIN
  IF to_regprocedure(v_signature) IS NULL THEN
    RAISE EXCEPTION 'La définition déployée % est absente.', v_signature;
  END IF;
  SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_definition;
  -- Accepte les deux fins de ligne sans réécrire le reste de la fonction.
  v_ancien := replace(v_ancien, chr(13), '');
  v_nouveau := replace(v_nouveau, chr(13), '');
  IF position(chr(13) || chr(10) IN v_definition) > 0 THEN
    v_ancien := replace(v_ancien, chr(10), chr(13) || chr(10));
    v_nouveau := replace(v_nouveau, chr(10), chr(13) || chr(10));
  END IF;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_ancien, ''))) / length(v_ancien);
  v_corrigees := (length(v_definition) - length(replace(v_definition, v_nouveau, ''))) / length(v_nouveau);
  IF v_occurrences = 0 AND v_corrigees = 1 THEN
    RETURN;
  END IF;
  IF v_occurrences <> 1 OR v_corrigees <> 0 THEN
    RAISE EXCEPTION 'La définition déployée % ne contient pas exactement la garde attendue.', v_signature;
  END IF;
  v_definition := replace(v_definition, v_ancien, v_nouveau);
  IF position(v_ancien IN v_definition) > 0
     OR (length(v_definition) - length(replace(v_definition, v_nouveau, ''))) / length(v_nouveau) <> 1 THEN
    RAISE EXCEPTION 'La modification de la garde de % ne peut pas être vérifiée.', v_signature;
  END IF;
  EXECUTE v_definition;
END;
$$;
