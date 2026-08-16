-- Une compétence peut servir plusieurs domaines, sans être dupliquée.
--
-- Le contrôle de doublon élargi au référentiel (étape 1) empêche désormais de
-- recréer « Lire un tableau de données » sous un second code. Mais il laissait
-- la compétence partagée invisible depuis le domaine qui la réclame. Cette
-- migration lui donne le rattachement qui manquait.
--
-- **Porteur unique.** `competences.domaine` reste la propriété : c'est de son
-- préfixe que vient le code (`STA-01`), et c'est lui que la gouvernance
-- d'ADR-065 tient pour responsable du retrait, de l'archivage et de la
-- succession. Les rattachements sont des lectures supplémentaires, jamais une
-- seconde propriété. La migration est donc **additive** : aucune colonne
-- existante ne change, `domaine` reste NOT NULL.

create table if not exists public.competence_domaines (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  domaine text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, code, domaine),
  foreign key (user_id, code) references public.competences(user_id, code) on delete cascade,
  foreign key (user_id, domaine) references public.domaines(user_id, id) on delete cascade
);

comment on table public.competence_domaines is
  'Domaines supplémentaires servis par une compétence. Le domaine porteur reste competences.domaine : il donne le code et porte la gouvernance.';

create index if not exists competence_domaines_domaine_idx
  on public.competence_domaines (user_id, domaine);

-- Un rattachement vers le domaine porteur compterait la compétence deux fois
-- dans sa propre couverture. La clause vit ici plutôt que dans la seule
-- fonction : la base reste vraie même si un autre chemin écrit un jour.
create or replace function public.rattachement_hors_porteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.competences c
    where c.user_id = new.user_id and c.code = new.code and c.domaine = new.domaine
  ) then
    raise exception '% est déjà portée par le domaine « % » : un rattachement ne se superpose pas au porteur.', new.code, new.domaine;
  end if;
  return new;
end;
$$;

drop trigger if exists competence_domaines_hors_porteur on public.competence_domaines;
create trigger competence_domaines_hors_porteur
  before insert or update on public.competence_domaines
  for each row execute function public.rattachement_hors_porteur();

alter table public.competence_domaines enable row level security;

-- Mêmes barrières que `competences` : isolation par compte, `compte_actif()`
-- pour qu'un compte suspendu cesse de lire (ADR-074), et écriture réservée au
-- chemin transactionnel du référentiel (ADR-065).
drop policy if exists referentiel_lecture_compte on public.competence_domaines;
create policy referentiel_lecture_compte on public.competence_domaines
  for select using ((select auth.uid()) = user_id and public.compte_actif());

drop policy if exists referentiel_commande_insertion on public.competence_domaines;
create policy referentiel_commande_insertion on public.competence_domaines
  for insert with check (
    (select auth.uid()) = user_id
    and (select current_setting('app.referentiel_command', true)) = 'on'
    and public.compte_actif()
  );

drop policy if exists referentiel_commande_suppression on public.competence_domaines;
create policy referentiel_commande_suppression on public.competence_domaines
  for delete using (
    (select auth.uid()) = user_id
    and (select current_setting('app.referentiel_command', true)) = 'on'
    and public.compte_actif()
  );

grant select, insert, delete on public.competence_domaines to authenticated;

-- Le geste de rattachement, transactionnel comme les autres.
--
-- Il ne rejoint pas `appliquer_commande_referentiel` : cette fonction liste ses
-- types autorisés dans un bloc unique de plus de 13 Ko, et l'étendre ferait
-- porter à un ajout périphérique le risque de réécrire tout le chemin
-- d'écriture du référentiel. Les garanties d'ADR-065 sont reprises ici telles
-- quelles : idempotence par `request_id`, version optimiste, journal
-- append-only, drapeau de commande.
create or replace function public.rattacher_competences_domaine(
  p_request_id text,
  p_expected_version integer,
  p_origine text,
  p_motif text,
  p_domaine_id text,
  p_codes text[],
  p_rattache boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
DECLARE
  v_uid UUID := auth.uid();
  v_version_avant INTEGER;
  v_version_apres INTEGER;
  v_resultat JSONB;
  v_code TEXT;
  v_porteur TEXT;
  v_touches JSONB := '[]'::JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire.'; END IF;
  IF p_origine NOT IN ('utilisateur', 'tuteur', 'migration', 'manuel') THEN RAISE EXCEPTION 'Origine inconnue : %', p_origine; END IF;
  IF length(btrim(coalesce(p_motif, ''))) = 0 THEN RAISE EXCEPTION 'Le motif est obligatoire.'; END IF;
  IF coalesce(array_length(p_codes, 1), 0) = 0 THEN RAISE EXCEPTION 'Aucune compétence à rattacher.'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':request:' || p_request_id, 0));

  SELECT diff -> 'resultat' INTO v_resultat
  FROM public.referentiel_changes
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_resultat; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':' || p_domaine_id, 0));

  SELECT version INTO v_version_avant FROM public.domaines
  WHERE user_id = v_uid AND id = p_domaine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Domaine inconnu : %', p_domaine_id; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_version_avant THEN
    RAISE EXCEPTION 'Le domaine a changé depuis ta lecture (version % attendue, % en base).', p_expected_version, v_version_avant;
  END IF;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);

  FOREACH v_code IN ARRAY p_codes LOOP
    SELECT domaine INTO v_porteur FROM public.competences
    WHERE user_id = v_uid AND code = v_code;
    IF NOT FOUND THEN RAISE EXCEPTION 'Compétence inconnue : %', v_code; END IF;
    IF v_porteur = p_domaine_id THEN
      RAISE EXCEPTION '% est déjà portée par ce domaine.', v_code;
    END IF;

    IF p_rattache THEN
      INSERT INTO public.competence_domaines (user_id, code, domaine)
      VALUES (v_uid, v_code, p_domaine_id)
      ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.competence_domaines
      WHERE user_id = v_uid AND code = v_code AND domaine = p_domaine_id;
    END IF;
    v_touches := v_touches || to_jsonb(v_code);
  END LOOP;

  UPDATE public.domaines SET version = version + 1
  WHERE user_id = v_uid AND id = p_domaine_id
  RETURNING version INTO v_version_apres;

  v_resultat := jsonb_build_object(
    'domaineId', p_domaine_id,
    'version', v_version_apres,
    'rattachees', CASE WHEN p_rattache THEN v_touches ELSE '[]'::JSONB END,
    'detachees', CASE WHEN p_rattache THEN '[]'::JSONB ELSE v_touches END
  );

  INSERT INTO public.referentiel_changes (user_id, request_id, domaine_id, type, version_avant, version_apres, origine, motif, diff)
  VALUES (
    v_uid, p_request_id, p_domaine_id,
    CASE WHEN p_rattache THEN 'rattacher_competences' ELSE 'detacher_competences' END,
    v_version_avant, v_version_apres, p_origine, btrim(p_motif),
    jsonb_build_object('resultat', v_resultat)
  );

  RETURN v_resultat;
END;
$$;

revoke execute on function public.rattacher_competences_domaine(text, integer, text, text, text, text[], boolean) from public;
grant execute on function public.rattacher_competences_domaine(text, integer, text, text, text, text[], boolean) to authenticated;

-- Une fonction de trigger n'a pas à être appelable depuis l'API REST.
-- Le trigger s'exécute sans passer par le GRANT ; seul l'accès direct se ferme.
revoke execute on function public.rattachement_hors_porteur() from public;
revoke execute on function public.rattachement_hors_porteur() from anon;
revoke execute on function public.rattachement_hors_porteur() from authenticated;
