-- Twiny lot 3 : noyau minimal de carte globale et overlay prive.
--
-- La migration est strictement additive : aucun domaine, competence, theme,
-- document ou fait prive existant n'est copie ou rapproche automatiquement.
-- La carte globale nait vide. L'overlay ne stocke qu'une selection personnelle
-- vers un element global ; le referentiel prive et le moteur restent inchanges.

-- ---------------------------------------------------------------------------
-- 1. Provenance partagee par toutes les frontieres de publication
-- ---------------------------------------------------------------------------

create or replace function public.provenance_carte_globale_valide(p_provenance jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    jsonb_typeof(p_provenance) = 'object'
    and jsonb_typeof(p_provenance -> 'type') = 'string'
    and btrim(p_provenance ->> 'type') <> ''
    and length(p_provenance ->> 'type') <= 100
    and jsonb_typeof(p_provenance -> 'reference') = 'string'
    and btrim(p_provenance ->> 'reference') <> ''
    and length(p_provenance ->> 'reference') <= 1000
    and (
      not (p_provenance ? 'note')
      or (
        jsonb_typeof(p_provenance -> 'note') = 'string'
        and btrim(p_provenance ->> 'note') <> ''
        and length(p_provenance ->> 'note') <= 2000
      )
    )
    and (p_provenance - array['type', 'reference', 'note']) = '{}'::jsonb;
$$;

revoke all on function public.provenance_carte_globale_valide(jsonb)
  from public, anon;
grant execute on function public.provenance_carte_globale_valide(jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Role de gouvernance distinct des administrateurs de comptes
-- ---------------------------------------------------------------------------

create table public.carte_globale_curateurs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  nomme_le timestamptz not null default now()
);

comment on table public.carte_globale_curateurs is
  'Habilitation de publication de la carte globale. Aucun compte n est promu automatiquement.';

-- ---------------------------------------------------------------------------
-- 3. Faits globaux publies : elements et relations explicites
-- ---------------------------------------------------------------------------

create table public.carte_globale_elements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('domaine', 'connaissance', 'competence')),
  nom text not null check (btrim(nom) <> '' and length(nom) <= 200),
  description text not null default '' check (length(description) <= 4000),
  statut text not null default 'publie' check (statut in ('publie', 'retire')),
  provenance jsonb not null check (public.provenance_carte_globale_valide(provenance)),
  version integer not null default 1 check (version > 0),
  valide_par uuid not null references public.profiles(id) on delete restrict,
  valide_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index carte_globale_elements_valide_par_idx
  on public.carte_globale_elements (valide_par);
create index carte_globale_elements_type_nom_idx
  on public.carte_globale_elements (type, nom)
  where statut = 'publie';

create table public.carte_globale_relations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.carte_globale_elements(id) on delete restrict,
  cible_id uuid not null references public.carte_globale_elements(id) on delete restrict,
  type text not null check (type in ('PART_OF', 'RELATED_TO')),
  statut text not null default 'publie' check (statut in ('publie', 'retire')),
  provenance jsonb not null check (public.provenance_carte_globale_valide(provenance)),
  version integer not null default 1 check (version > 0),
  valide_par uuid not null references public.profiles(id) on delete restrict,
  valide_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carte_globale_relations_cibles_distinctes check (source_id <> cible_id),
  constraint carte_globale_related_to_canonique check (
    type <> 'RELATED_TO' or source_id::text < cible_id::text
  )
);

create index carte_globale_relations_source_idx
  on public.carte_globale_relations (source_id)
  where statut = 'publie';
create index carte_globale_relations_cible_idx
  on public.carte_globale_relations (cible_id)
  where statut = 'publie';
create index carte_globale_relations_valide_par_idx
  on public.carte_globale_relations (valide_par);
create unique index carte_globale_relations_actives_uidx
  on public.carte_globale_relations (type, source_id, cible_id)
  where statut = 'publie';

-- ---------------------------------------------------------------------------
-- 4. Versionnement auditable : etat courant + snapshots append-only
-- ---------------------------------------------------------------------------

create table public.carte_globale_changes (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique check (btrim(request_id) <> '' and length(request_id) <= 200),
  action text not null check (
    action in (
      'publier_element', 'corriger_element', 'retirer_element',
      'publier_relation', 'retirer_relation'
    )
  ),
  objet_type text not null check (objet_type in ('element', 'relation')),
  objet_id uuid not null,
  version_avant integer check (version_avant is null or version_avant > 0),
  version_apres integer not null check (version_apres > 0),
  provenance jsonb not null check (public.provenance_carte_globale_valide(provenance)),
  snapshot_avant jsonb,
  snapshot_apres jsonb not null,
  valide_par uuid not null references public.profiles(id) on delete restrict,
  valide_le timestamptz not null default now()
);

create index carte_globale_changes_objet_idx
  on public.carte_globale_changes (objet_type, objet_id, version_apres);
create index carte_globale_changes_valide_par_idx
  on public.carte_globale_changes (valide_par);

create or replace function public.refuser_mutation_carte_globale_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Le journal de la carte globale est append-only.' using errcode = '55000';
end;
$$;

create trigger carte_globale_changes_append_only
  before update or delete on public.carte_globale_changes
  for each row execute function public.refuser_mutation_carte_globale_changes();

revoke all on function public.refuser_mutation_carte_globale_changes()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Overlay prive minimal : une selection, jamais une copie
-- ---------------------------------------------------------------------------

create table public.carte_globale_selections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  element_id uuid not null references public.carte_globale_elements(id) on delete restrict,
  selectionne_le timestamptz not null default now(),
  primary key (user_id, element_id)
);

create index carte_globale_selections_element_idx
  on public.carte_globale_selections (element_id);

-- ---------------------------------------------------------------------------
-- 6. RLS et privileges : global lisible, overlay strictement personnel
-- ---------------------------------------------------------------------------

alter table public.carte_globale_curateurs enable row level security;
alter table public.carte_globale_elements enable row level security;
alter table public.carte_globale_relations enable row level security;
alter table public.carte_globale_changes enable row level security;
alter table public.carte_globale_selections enable row level security;

create policy carte_globale_curateur_lecture_soi
  on public.carte_globale_curateurs
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

create policy carte_globale_elements_lecture
  on public.carte_globale_elements
  for select to authenticated
  using (
    (select public.compte_actif())
    and (
      statut = 'publie'
      or exists (
        select 1 from public.carte_globale_curateurs c
        where c.user_id = (select auth.uid())
      )
    )
  );

create policy carte_globale_elements_commande_insertion
  on public.carte_globale_elements
  for insert to authenticated
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

create policy carte_globale_elements_commande_modification
  on public.carte_globale_elements
  for update to authenticated
  using (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  )
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

create policy carte_globale_relations_lecture
  on public.carte_globale_relations
  for select to authenticated
  using (
    (select public.compte_actif())
    and (
      statut = 'publie'
      or exists (
        select 1 from public.carte_globale_curateurs c
        where c.user_id = (select auth.uid())
      )
    )
  );

create policy carte_globale_relations_commande_insertion
  on public.carte_globale_relations
  for insert to authenticated
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

create policy carte_globale_relations_commande_modification
  on public.carte_globale_relations
  for update to authenticated
  using (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  )
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

create policy carte_globale_changes_lecture_curateur
  on public.carte_globale_changes
  for select to authenticated
  using (
    (select public.compte_actif())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

create policy carte_globale_changes_commande_insertion
  on public.carte_globale_changes
  for insert to authenticated
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

create policy carte_globale_selections_lecture_compte
  on public.carte_globale_selections
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

create policy carte_globale_selections_creation_compte
  on public.carte_globale_selections
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and exists (
      select 1 from public.carte_globale_elements e
      where e.id = element_id and e.statut = 'publie'
    )
  );

create policy carte_globale_selections_suppression_compte
  on public.carte_globale_selections
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

revoke all on table
  public.carte_globale_curateurs,
  public.carte_globale_elements,
  public.carte_globale_relations,
  public.carte_globale_changes,
  public.carte_globale_selections
from public, anon, authenticated;

grant select on public.carte_globale_curateurs to authenticated;
grant select, insert, update on public.carte_globale_elements to authenticated;
grant select, insert, update on public.carte_globale_relations to authenticated;
grant select, insert on public.carte_globale_changes to authenticated;
grant select, insert, delete on public.carte_globale_selections to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Commande unique : validation humaine, provenance et journal atomiques
-- ---------------------------------------------------------------------------

create or replace function public.appliquer_commande_carte_globale(
  p_request_id text,
  p_expected_version integer,
  p_commande jsonb,
  p_provenance jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := p_commande ->> 'type';
  v_objet_type text;
  v_objet_id uuid;
  v_source_id uuid;
  v_cible_id uuid;
  v_relation_type text;
  v_type_element text;
  v_nom text;
  v_description text;
  v_statut text;
  v_version_avant integer;
  v_version_apres integer;
  v_snapshot_avant jsonb;
  v_snapshot_apres jsonb;
  v_action_existante text;
  v_objet_type_existant text;
begin
  if v_uid is null or not public.compte_actif(v_uid) then
    raise exception 'Compte authentifie actif requis.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.carte_globale_curateurs c where c.user_id = v_uid
  ) then
    raise exception 'La publication de la carte globale est reservee aux curateurs.'
      using errcode = '42501';
  end if;

  if p_request_id is null or btrim(p_request_id) = '' or length(p_request_id) > 200 then
    raise exception 'request_id invalide.' using errcode = '22023';
  end if;

  if not public.provenance_carte_globale_valide(p_provenance) then
    raise exception 'Provenance globale invalide.' using errcode = '22023';
  end if;

  select c.action, c.objet_type, c.objet_id, c.version_avant, c.version_apres,
         c.snapshot_avant, c.snapshot_apres
    into v_action_existante, v_objet_type_existant, v_objet_id,
         v_version_avant, v_version_apres, v_snapshot_avant, v_snapshot_apres
  from public.carte_globale_changes c
  where c.request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'action', v_action_existante,
      'objetType', v_objet_type_existant,
      'objet', v_snapshot_apres,
      'rejeu', true
    );
  end if;

  perform set_config('app.carte_globale_command', 'on', true);

  case v_action
    when 'publier_element' then
      if coalesce(p_expected_version, 0) <> 0 then
        raise exception 'Une publication nouvelle attend la version 0.' using errcode = '22023';
      end if;

      v_type_element := p_commande #>> '{element,type}';
      v_nom := btrim(coalesce(p_commande #>> '{element,nom}', ''));
      v_description := btrim(coalesce(p_commande #>> '{element,description}', ''));

      if v_type_element not in ('domaine', 'connaissance', 'competence') then
        raise exception 'Type d element global invalide.' using errcode = '22023';
      end if;
      if v_nom = '' then
        raise exception 'Le nom global est obligatoire.' using errcode = '22023';
      end if;

      insert into public.carte_globale_elements (
        type, nom, description, provenance, valide_par, valide_le
      ) values (
        v_type_element, v_nom, v_description, p_provenance, v_uid, now()
      )
      returning id, version into v_objet_id, v_version_apres;

      select to_jsonb(e) into v_snapshot_apres
      from public.carte_globale_elements e where e.id = v_objet_id;
      v_objet_type := 'element';
      v_version_avant := null;

    when 'corriger_element' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(e), e.version, e.statut
        into v_snapshot_avant, v_version_avant, v_statut
      from public.carte_globale_elements e
      where e.id = v_objet_id
      for update;

      if not found then
        raise exception 'Element global introuvable.' using errcode = 'P0002';
      end if;
      if v_statut <> 'publie' then
        raise exception 'Un element retire ne se corrige pas.' using errcode = '55000';
      end if;
      if p_expected_version is distinct from v_version_avant then
        raise exception 'Version globale obsolete : attendu %, recu %.', v_version_avant, p_expected_version
          using errcode = '40001';
      end if;

      v_nom := btrim(coalesce(p_commande ->> 'nom', ''));
      v_description := btrim(coalesce(p_commande ->> 'description', ''));
      if v_nom = '' then
        raise exception 'Le nom global est obligatoire.' using errcode = '22023';
      end if;

      update public.carte_globale_elements
      set nom = v_nom,
          description = v_description,
          provenance = p_provenance,
          version = version + 1,
          valide_par = v_uid,
          valide_le = now(),
          updated_at = now()
      where id = v_objet_id
      returning version into v_version_apres;

      select to_jsonb(e) into v_snapshot_apres
      from public.carte_globale_elements e where e.id = v_objet_id;
      v_objet_type := 'element';

    when 'retirer_element' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(e), e.version, e.statut
        into v_snapshot_avant, v_version_avant, v_statut
      from public.carte_globale_elements e
      where e.id = v_objet_id
      for update;

      if not found then
        raise exception 'Element global introuvable.' using errcode = 'P0002';
      end if;
      if v_statut <> 'publie' then
        raise exception 'Element global deja retire.' using errcode = '55000';
      end if;
      if p_expected_version is distinct from v_version_avant then
        raise exception 'Version globale obsolete : attendu %, recu %.', v_version_avant, p_expected_version
          using errcode = '40001';
      end if;
      if exists (
        select 1 from public.carte_globale_relations r
        where r.statut = 'publie'
          and (r.source_id = v_objet_id or r.cible_id = v_objet_id)
      ) then
        raise exception 'Retirer d abord les relations globales actives de cet element.'
          using errcode = '23503';
      end if;

      update public.carte_globale_elements
      set statut = 'retire',
          provenance = p_provenance,
          version = version + 1,
          valide_par = v_uid,
          valide_le = now(),
          updated_at = now()
      where id = v_objet_id
      returning version into v_version_apres;

      select to_jsonb(e) into v_snapshot_apres
      from public.carte_globale_elements e where e.id = v_objet_id;
      v_objet_type := 'element';

    when 'publier_relation' then
      if coalesce(p_expected_version, 0) <> 0 then
        raise exception 'Une publication nouvelle attend la version 0.' using errcode = '22023';
      end if;

      v_source_id := nullif(p_commande #>> '{relation,sourceId}', '')::uuid;
      v_cible_id := nullif(p_commande #>> '{relation,cibleId}', '')::uuid;
      v_relation_type := p_commande #>> '{relation,type}';

      if v_relation_type not in ('PART_OF', 'RELATED_TO') then
        raise exception 'Type de relation globale invalide.' using errcode = '22023';
      end if;
      if v_source_id = v_cible_id then
        raise exception 'Une relation globale ne se relie pas a elle-meme.' using errcode = '22023';
      end if;
      if not exists (
        select 1 from public.carte_globale_elements e
        where e.id = v_source_id and e.statut = 'publie'
      ) or not exists (
        select 1 from public.carte_globale_elements e
        where e.id = v_cible_id and e.statut = 'publie'
      ) then
        raise exception 'Les deux cibles globales doivent etre publiees.' using errcode = '23503';
      end if;

      if v_relation_type = 'PART_OF' then
        if not exists (
          select 1 from public.carte_globale_elements e
          where e.id = v_cible_id and e.type = 'domaine' and e.statut = 'publie'
        ) then
          raise exception 'PART_OF vise un domaine global publie.' using errcode = '22023';
        end if;

        if exists (
          with recursive parents(id) as (
            select v_cible_id
            union
            select r.cible_id
            from public.carte_globale_relations r
            join parents p on p.id = r.source_id
            where r.type = 'PART_OF' and r.statut = 'publie'
          )
          select 1 from parents where id = v_source_id
        ) then
          raise exception 'PART_OF creerait un cycle.' using errcode = '23514';
        end if;
      elsif v_source_id::text > v_cible_id::text then
        v_objet_id := v_source_id;
        v_source_id := v_cible_id;
        v_cible_id := v_objet_id;
      end if;

      insert into public.carte_globale_relations (
        source_id, cible_id, type, provenance, valide_par, valide_le
      ) values (
        v_source_id, v_cible_id, v_relation_type, p_provenance, v_uid, now()
      )
      returning id, version into v_objet_id, v_version_apres;

      select to_jsonb(r) into v_snapshot_apres
      from public.carte_globale_relations r where r.id = v_objet_id;
      v_objet_type := 'relation';
      v_version_avant := null;

    when 'retirer_relation' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(r), r.version, r.statut
        into v_snapshot_avant, v_version_avant, v_statut
      from public.carte_globale_relations r
      where r.id = v_objet_id
      for update;

      if not found then
        raise exception 'Relation globale introuvable.' using errcode = 'P0002';
      end if;
      if v_statut <> 'publie' then
        raise exception 'Relation globale deja retiree.' using errcode = '55000';
      end if;
      if p_expected_version is distinct from v_version_avant then
        raise exception 'Version globale obsolete : attendu %, recu %.', v_version_avant, p_expected_version
          using errcode = '40001';
      end if;

      update public.carte_globale_relations
      set statut = 'retire',
          provenance = p_provenance,
          version = version + 1,
          valide_par = v_uid,
          valide_le = now(),
          updated_at = now()
      where id = v_objet_id
      returning version into v_version_apres;

      select to_jsonb(r) into v_snapshot_apres
      from public.carte_globale_relations r where r.id = v_objet_id;
      v_objet_type := 'relation';

    else
      raise exception 'Commande de carte globale inconnue.' using errcode = '22023';
  end case;

  insert into public.carte_globale_changes (
    request_id, action, objet_type, objet_id,
    version_avant, version_apres, provenance,
    snapshot_avant, snapshot_apres, valide_par, valide_le
  ) values (
    p_request_id, v_action, v_objet_type, v_objet_id,
    v_version_avant, v_version_apres, p_provenance,
    v_snapshot_avant, v_snapshot_apres, v_uid, now()
  );

  return jsonb_build_object(
    'action', v_action,
    'objetType', v_objet_type,
    'objet', v_snapshot_apres,
    'rejeu', false
  );
end;
$$;

revoke all on function public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb)
  from public, anon;
grant execute on function public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb)
  to authenticated;

comment on function public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb) is
  'Publication atomique de la carte globale par un curateur humain : provenance, version et journal obligatoires.';
