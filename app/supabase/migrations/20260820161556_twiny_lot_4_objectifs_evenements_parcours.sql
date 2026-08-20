-- Twiny — Lot 4 : objectifs structurés, événements et parcours privés
-- Additif, privé au compte, sans migration des textes historiques.

create or replace function public.provenance_lot4_valide(p_provenance jsonb)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_provenance) = 'object'
    and pg_catalog.jsonb_typeof(p_provenance->'type') = 'string'
    and pg_catalog.length(pg_catalog.btrim(p_provenance->>'type')) between 1 and 100
    and pg_catalog.jsonb_typeof(p_provenance->'reference') = 'string'
    and pg_catalog.length(pg_catalog.btrim(p_provenance->>'reference')) between 1 and 500
    and (
      not (p_provenance ? 'note')
      or p_provenance->'note' is null
      or (
        pg_catalog.jsonb_typeof(p_provenance->'note') = 'string'
        and pg_catalog.length(p_provenance->>'note') <= 1000
      )
    );
$$;

revoke all on function public.provenance_lot4_valide(jsonb) from public, anon;
grant execute on function public.provenance_lot4_valide(jsonb) to authenticated;

create table public.objectifs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  formulation text not null check (btrim(formulation) <> '' and length(formulation) <= 4000),
  cible_type text not null check (cible_type in ('element-global', 'domaine-local', 'competence-locale', 'relation-globale')),
  cible_element_global_id uuid references public.carte_globale_elements(id) on delete restrict,
  cible_domaine_local_id text,
  cible_competence_local_code text,
  cible_relation_globale_id uuid references public.carte_globale_relations(id) on delete restrict,
  priorite integer not null check (priorite between 1 and 5),
  horizon text not null check (horizon in ('court-terme', 'moyen-terme', 'long-terme')),
  echeance_le date,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'actif', 'en-pause', 'atteint', 'abandonne')),
  version integer not null default 1 check (version > 0),
  archive_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint objectifs_cible_domaine_local_fk
    foreign key (user_id, cible_domaine_local_id)
    references public.domaines(user_id, id) on delete restrict,
  constraint objectifs_cible_competence_locale_fk
    foreign key (user_id, cible_competence_local_code)
    references public.competences(user_id, code) on delete restrict,
  constraint objectifs_cible_coherente check (
    (cible_type = 'element-global'
      and cible_element_global_id is not null
      and cible_domaine_local_id is null
      and cible_competence_local_code is null
      and cible_relation_globale_id is null)
    or (cible_type = 'domaine-local'
      and cible_element_global_id is null
      and cible_domaine_local_id is not null
      and cible_competence_local_code is null
      and cible_relation_globale_id is null)
    or (cible_type = 'competence-locale'
      and cible_element_global_id is null
      and cible_domaine_local_id is null
      and cible_competence_local_code is not null
      and cible_relation_globale_id is null)
    or (cible_type = 'relation-globale'
      and cible_element_global_id is null
      and cible_domaine_local_id is null
      and cible_competence_local_code is null
      and cible_relation_globale_id is not null)
  )
);

create index objectifs_compte_statut_idx on public.objectifs (user_id, statut, priorite desc);
create index objectifs_cible_element_idx on public.objectifs (cible_element_global_id) where cible_element_global_id is not null;
create index objectifs_cible_relation_idx on public.objectifs (cible_relation_globale_id) where cible_relation_globale_id is not null;

create trigger objectifs_updated_at
  before update on public.objectifs
  for each row execute function public.touch_updated_at();

create table public.parcours (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  objectif_id uuid,
  contexte text not null check (btrim(contexte) <> '' and length(contexte) <= 4000),
  cible_type text not null check (cible_type in ('element-global', 'domaine-local', 'competence-locale', 'relation-globale')),
  cible_element_global_id uuid references public.carte_globale_elements(id) on delete restrict,
  cible_domaine_local_id text,
  cible_competence_local_code text,
  cible_relation_globale_id uuid references public.carte_globale_relations(id) on delete restrict,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'actif', 'en-pause', 'termine', 'abandonne')),
  version integer not null default 1 check (version > 0),
  archive_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint parcours_objectif_fk
    foreign key (user_id, objectif_id)
    references public.objectifs(user_id, id) on delete restrict,
  constraint parcours_cible_domaine_local_fk
    foreign key (user_id, cible_domaine_local_id)
    references public.domaines(user_id, id) on delete restrict,
  constraint parcours_cible_competence_locale_fk
    foreign key (user_id, cible_competence_local_code)
    references public.competences(user_id, code) on delete restrict,
  constraint parcours_cible_coherente check (
    (cible_type = 'element-global'
      and cible_element_global_id is not null
      and cible_domaine_local_id is null
      and cible_competence_local_code is null
      and cible_relation_globale_id is null)
    or (cible_type = 'domaine-local'
      and cible_element_global_id is null
      and cible_domaine_local_id is not null
      and cible_competence_local_code is null
      and cible_relation_globale_id is null)
    or (cible_type = 'competence-locale'
      and cible_element_global_id is null
      and cible_domaine_local_id is null
      and cible_competence_local_code is not null
      and cible_relation_globale_id is null)
    or (cible_type = 'relation-globale'
      and cible_element_global_id is null
      and cible_domaine_local_id is null
      and cible_competence_local_code is null
      and cible_relation_globale_id is not null)
  )
);

create index parcours_compte_statut_idx on public.parcours (user_id, statut, created_at);
create index parcours_objectif_idx on public.parcours (user_id, objectif_id) where objectif_id is not null;

create trigger parcours_updated_at
  before update on public.parcours
  for each row execute function public.touch_updated_at();

create table public.evenements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  request_id text not null check (btrim(request_id) <> '' and length(request_id) <= 200),
  type text not null check (type in (
    'objectif-cree', 'objectif-modifie', 'objectif-statut-change', 'objectif-archive',
    'parcours-cree', 'parcours-modifie', 'parcours-statut-change', 'parcours-archive',
    'session-rattachee'
  )),
  acteur text not null check (acteur in ('personne', 'systeme')),
  consentement boolean not null,
  survenu_le timestamptz not null default now(),
  objectif_id uuid,
  parcours_id uuid,
  session_id text,
  provenance jsonb not null check (public.provenance_lot4_valide(provenance)),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, request_id),
  constraint evenements_objectif_fk
    foreign key (user_id, objectif_id)
    references public.objectifs(user_id, id) on delete restrict,
  constraint evenements_parcours_fk
    foreign key (user_id, parcours_id)
    references public.parcours(user_id, id) on delete restrict,
  constraint evenements_session_fk
    foreign key (user_id, session_id)
    references public.sessions(user_id, id) on delete restrict,
  constraint evenements_reference_coherente check (
    (type like 'objectif-%' and objectif_id is not null)
    or (type like 'parcours-%' and parcours_id is not null)
    or (type = 'session-rattachee' and parcours_id is not null and session_id is not null)
  )
);

create index evenements_compte_date_idx on public.evenements (user_id, survenu_le, created_at);
create index evenements_objectif_idx on public.evenements (user_id, objectif_id, survenu_le) where objectif_id is not null;
create index evenements_parcours_idx on public.evenements (user_id, parcours_id, survenu_le) where parcours_id is not null;
create unique index evenements_session_rattachee_uidx
  on public.evenements (user_id, parcours_id, session_id)
  where type = 'session-rattachee';

create or replace function public.refuser_mutation_evenements_lot4()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Le journal des événements du lot 4 est append-only.' using errcode = '55000';
end;
$$;

drop trigger if exists evenements_lot4_append_only on public.evenements;
create trigger evenements_lot4_append_only
  before update or delete on public.evenements
  for each row execute function public.refuser_mutation_evenements_lot4();

revoke all on function public.refuser_mutation_evenements_lot4() from public, anon, authenticated;

alter table public.objectifs enable row level security;
alter table public.parcours enable row level security;
alter table public.evenements enable row level security;

revoke all on table public.objectifs, public.parcours, public.evenements from anon, authenticated;
grant select, insert, update on table public.objectifs, public.parcours to authenticated;
grant select, insert on table public.evenements to authenticated;

create policy objectifs_lecture_compte on public.objectifs
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));
create policy objectifs_creation_commande on public.objectifs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );
create policy objectifs_modification_commande on public.objectifs
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  )
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );

create policy parcours_lecture_compte on public.parcours
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));
create policy parcours_creation_commande on public.parcours
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );
create policy parcours_modification_commande on public.parcours
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  )
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );

create policy evenements_lecture_compte on public.evenements
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));
create policy evenements_creation_commande on public.evenements
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );

create or replace function public.inscrire_evenement_lot4(
  p_user_id uuid,
  p_request_id text,
  p_type text,
  p_acteur text,
  p_consentement boolean,
  p_objectif_id uuid,
  p_parcours_id uuid,
  p_session_id text,
  p_provenance jsonb,
  p_payload jsonb
)
returns public.evenements
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_evenement public.evenements%rowtype;
begin
  if not p_consentement then
    raise exception 'Le consentement explicite est obligatoire pour un événement du lot 4.' using errcode = '22023';
  end if;
  insert into public.evenements (
    user_id, request_id, type, acteur, consentement, objectif_id,
    parcours_id, session_id, provenance, payload
  ) values (
    p_user_id, p_request_id, p_type, p_acteur, p_consentement, p_objectif_id,
    p_parcours_id, p_session_id, p_provenance, coalesce(p_payload, '{}'::jsonb)
  ) returning * into v_evenement;
  return v_evenement;
end;
$$;

revoke all on function public.inscrire_evenement_lot4(uuid, text, text, text, boolean, uuid, uuid, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.inscrire_evenement_lot4(uuid, text, text, text, boolean, uuid, uuid, text, jsonb, jsonb)
  to authenticated;

create or replace function public.executer_commande_lot4(
  p_request_id text,
  p_commande jsonb,
  p_provenance jsonb,
  p_acteur text,
  p_consentement boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_type text;
  v_existing public.evenements%rowtype;
  v_evenement public.evenements%rowtype;
  v_objectif public.objectifs%rowtype;
  v_objectif_avant public.objectifs%rowtype;
  v_parcours public.parcours%rowtype;
  v_parcours_avant public.parcours%rowtype;
  v_target jsonb;
  v_cible_type text;
  v_element_global_id uuid;
  v_domaine_local_id text;
  v_competence_local_code text;
  v_relation_globale_id uuid;
  v_objectif_id uuid;
  v_parcours_id uuid;
  v_session_id text;
  v_expected_version integer;
  v_new_statut text;
  v_echeance date;
begin
  if v_uid is null then
    raise exception 'Compte authentifié obligatoire.' using errcode = '28000';
  end if;
  if p_request_id is null or btrim(p_request_id) = '' or length(p_request_id) > 200 then
    raise exception 'request_id invalide.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_commande) is distinct from 'object' then
    raise exception 'La commande du lot 4 doit être un objet JSON.' using errcode = '22023';
  end if;
  if not public.provenance_lot4_valide(p_provenance) then
    raise exception 'Provenance du lot 4 invalide.' using errcode = '22023';
  end if;
  if p_acteur not in ('personne', 'systeme') then
    raise exception 'Acteur du lot 4 invalide.' using errcode = '22023';
  end if;
  if not p_consentement then
    raise exception 'Le consentement explicite est obligatoire.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.evenements
  where user_id = v_uid and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'requestId', p_request_id,
      'rejoue', true,
      'eventId', v_existing.id,
      'eventType', v_existing.type,
      'objectifId', v_existing.objectif_id,
      'parcoursId', v_existing.parcours_id,
      'sessionId', v_existing.session_id
    );
  end if;

  perform set_config('app.lot4_command', 'on', true);
  v_type := p_commande->>'type';

  if v_type = 'creer_objectif' then
    v_target := p_commande->'cible';
    if jsonb_typeof(v_target) is distinct from 'object' then
      raise exception 'Une cible structurée est obligatoire.' using errcode = '22023';
    end if;
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_echeance := nullif(p_commande->>'echeanceLe', '')::date;
    insert into public.objectifs (
      user_id, formulation, cible_type, cible_element_global_id,
      cible_domaine_local_id, cible_competence_local_code, cible_relation_globale_id,
      priorite, horizon, echeance_le
    ) values (
      v_uid, btrim(p_commande->>'formulation'), v_cible_type, v_element_global_id,
      v_domaine_local_id, v_competence_local_code, v_relation_globale_id,
      (p_commande->>'priorite')::integer, p_commande->>'horizon', v_echeance
    ) returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-cree', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance, jsonb_build_object('objectif', to_jsonb(v_objectif))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'modifier_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then
      raise exception 'Version d’objectif périmée.' using errcode = '40001';
    end if;
    if v_objectif_avant.archive_le is not null or v_objectif_avant.statut in ('atteint', 'abandonne') then
      raise exception 'Un objectif clos ou archivé ne se modifie pas.' using errcode = '22023';
    end if;
    v_target := p_commande->'cible';
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_echeance := nullif(p_commande->>'echeanceLe', '')::date;
    update public.objectifs set
      formulation = btrim(p_commande->>'formulation'),
      cible_type = v_cible_type,
      cible_element_global_id = v_element_global_id,
      cible_domaine_local_id = v_domaine_local_id,
      cible_competence_local_code = v_competence_local_code,
      cible_relation_globale_id = v_relation_globale_id,
      priorite = (p_commande->>'priorite')::integer,
      horizon = p_commande->>'horizon',
      echeance_le = v_echeance,
      version = version + 1
    where user_id = v_uid and id = v_objectif_id
    returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-modifie', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance,
      jsonb_build_object('avant', to_jsonb(v_objectif_avant), 'apres', to_jsonb(v_objectif))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'changer_statut_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    v_new_statut := p_commande->>'statut';
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then raise exception 'Version d’objectif périmée.' using errcode = '40001'; end if;
    if v_objectif_avant.archive_le is not null then raise exception 'Un objectif archivé ne change plus de statut.' using errcode = '22023'; end if;
    if not (
      (v_objectif_avant.statut = 'brouillon' and v_new_statut in ('actif', 'abandonne'))
      or (v_objectif_avant.statut = 'actif' and v_new_statut in ('en-pause', 'atteint', 'abandonne'))
      or (v_objectif_avant.statut = 'en-pause' and v_new_statut in ('actif', 'abandonne'))
    ) then
      raise exception 'Transition d’objectif interdite.' using errcode = '22023';
    end if;
    update public.objectifs set statut = v_new_statut, version = version + 1
      where user_id = v_uid and id = v_objectif_id returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-statut-change', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance,
      jsonb_build_object('avant', v_objectif_avant.statut, 'apres', v_objectif.statut)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'archiver_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then raise exception 'Version d’objectif périmée.' using errcode = '40001'; end if;
    if v_objectif_avant.archive_le is not null then raise exception 'Objectif déjà archivé.' using errcode = '22023'; end if;
    if v_objectif_avant.statut = 'actif' then raise exception 'Un objectif actif doit être mis en pause, atteint ou abandonné avant archivage.' using errcode = '22023'; end if;
    update public.objectifs set archive_le = now(), version = version + 1
      where user_id = v_uid and id = v_objectif_id returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-archive', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance, jsonb_build_object('archiveLe', v_objectif.archive_le)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'creer_parcours' then
    v_target := p_commande->'cible';
    if jsonb_typeof(v_target) is distinct from 'object' then raise exception 'Une cible structurée est obligatoire.' using errcode = '22023'; end if;
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_objectif_id := nullif(p_commande->>'objectifId', '')::uuid;
    if v_objectif_id is not null and not exists (
      select 1 from public.objectifs where user_id = v_uid and id = v_objectif_id and archive_le is null
    ) then raise exception 'Objectif lié introuvable ou archivé.' using errcode = '23503'; end if;
    insert into public.parcours (
      user_id, objectif_id, contexte, cible_type, cible_element_global_id,
      cible_domaine_local_id, cible_competence_local_code, cible_relation_globale_id
    ) values (
      v_uid, v_objectif_id, btrim(p_commande->>'contexte'), v_cible_type, v_element_global_id,
      v_domaine_local_id, v_competence_local_code, v_relation_globale_id
    ) returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-cree', p_acteur, p_consentement,
      v_objectif_id, v_parcours.id, null, p_provenance, jsonb_build_object('parcours', to_jsonb(v_parcours))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'modifier_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null or v_parcours_avant.statut in ('termine', 'abandonne') then raise exception 'Un parcours clos ou archivé ne se modifie pas.' using errcode = '22023'; end if;
    v_target := p_commande->'cible';
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_objectif_id := nullif(p_commande->>'objectifId', '')::uuid;
    if v_objectif_id is not null and not exists (
      select 1 from public.objectifs where user_id = v_uid and id = v_objectif_id and archive_le is null
    ) then raise exception 'Objectif lié introuvable ou archivé.' using errcode = '23503'; end if;
    update public.parcours set
      objectif_id = v_objectif_id,
      contexte = btrim(p_commande->>'contexte'),
      cible_type = v_cible_type,
      cible_element_global_id = v_element_global_id,
      cible_domaine_local_id = v_domaine_local_id,
      cible_competence_local_code = v_competence_local_code,
      cible_relation_globale_id = v_relation_globale_id,
      version = version + 1
    where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-modifie', p_acteur, p_consentement,
      v_objectif_id, v_parcours.id, null, p_provenance,
      jsonb_build_object('avant', to_jsonb(v_parcours_avant), 'apres', to_jsonb(v_parcours))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'changer_statut_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    v_new_statut := p_commande->>'statut';
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null then raise exception 'Un parcours archivé ne change plus de statut.' using errcode = '22023'; end if;
    if not (
      (v_parcours_avant.statut = 'brouillon' and v_new_statut in ('actif', 'abandonne'))
      or (v_parcours_avant.statut = 'actif' and v_new_statut in ('en-pause', 'termine', 'abandonne'))
      or (v_parcours_avant.statut = 'en-pause' and v_new_statut in ('actif', 'abandonne'))
    ) then raise exception 'Transition de parcours interdite.' using errcode = '22023'; end if;
    update public.parcours set statut = v_new_statut, version = version + 1
      where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-statut-change', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, null, p_provenance,
      jsonb_build_object('avant', v_parcours_avant.statut, 'apres', v_parcours.statut)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'archiver_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null then raise exception 'Parcours déjà archivé.' using errcode = '22023'; end if;
    if v_parcours_avant.statut = 'actif' then raise exception 'Un parcours actif doit être mis en pause, terminé ou abandonné avant archivage.' using errcode = '22023'; end if;
    update public.parcours set archive_le = now(), version = version + 1
      where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-archive', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, null, p_provenance, jsonb_build_object('archiveLe', v_parcours.archive_le)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'rattacher_session' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_session_id := p_commande->>'sessionId';
    select * into v_parcours from public.parcours
      where user_id = v_uid and id = v_parcours_id;
    if not found or v_parcours.archive_le is not null then raise exception 'Parcours introuvable ou archivé.' using errcode = 'P0002'; end if;
    if not exists (select 1 from public.sessions where user_id = v_uid and id = v_session_id) then
      raise exception 'Séance introuvable dans le compte courant.' using errcode = '23503';
    end if;
    select * into v_existing from public.evenements
      where user_id = v_uid and type = 'session-rattachee'
        and parcours_id = v_parcours_id and session_id = v_session_id;
    if found then
      return jsonb_build_object(
        'requestId', p_request_id, 'rejoue', true, 'eventId', v_existing.id,
        'eventType', v_existing.type, 'objectifId', v_existing.objectif_id,
        'parcoursId', v_existing.parcours_id, 'sessionId', v_existing.session_id
      );
    end if;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'session-rattachee', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, v_session_id, p_provenance,
      jsonb_build_object('sessionId', v_session_id)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id,
      'parcoursId', v_parcours.id, 'sessionId', v_session_id
    );
  end if;

  raise exception 'Type de commande lot 4 inconnu.' using errcode = '22023';
end;
$$;

revoke all on function public.executer_commande_lot4(text, jsonb, jsonb, text, boolean) from public, anon;
grant execute on function public.executer_commande_lot4(text, jsonb, jsonb, text, boolean) to authenticated;
