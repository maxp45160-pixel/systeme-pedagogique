-- Lot 7 — correspondances privées local ↔ global et relations globales typées.
-- Migration additive : aucun fait historique ni aucun ancien champ de profil
-- n'est supprimé ici.

begin;

alter table public.carte_globale_relations
  drop constraint if exists carte_globale_relations_type_check;

alter table public.carte_globale_relations
  add constraint carte_globale_relations_type_check
  check (type in ('PART_OF', 'PREREQUISITE_OF', 'RELATED_TO', 'APPLIED_IN', 'ENABLES'));

-- Une correspondance est un fait privé déclaré par le compte. Elle n'est ni
-- une sélection, ni une mesure, ni une publication de la compétence locale.
create table public.carte_globale_correspondances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  competence_code text not null,
  element_global_id uuid not null references public.carte_globale_elements(id) on delete restrict,
  acteur text not null check (acteur in ('personne', 'systeme')),
  provenance jsonb not null check (public.provenance_carte_globale_valide(provenance)),
  rattache_le timestamptz not null default now(),
  primary key (user_id, competence_code, element_global_id),
  foreign key (user_id, competence_code)
    references public.competences(user_id, code) on delete cascade
);

create index carte_globale_correspondances_element_idx
  on public.carte_globale_correspondances (element_global_id);

alter table public.carte_globale_correspondances enable row level security;

create policy carte_globale_correspondances_lecture_compte
  on public.carte_globale_correspondances
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

create policy carte_globale_correspondances_creation_compte
  on public.carte_globale_correspondances
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.compte_actif()));

create policy carte_globale_correspondances_suppression_compte
  on public.carte_globale_correspondances
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

revoke all on table public.carte_globale_correspondances from anon, authenticated;
grant select, insert, delete on table public.carte_globale_correspondances to authenticated;

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
  if not exists (select 1 from public.carte_globale_curateurs c where c.user_id = v_uid) then
    raise exception 'La publication de la carte globale est reservee aux curateurs.' using errcode = '42501';
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
    return jsonb_build_object('action', v_action_existante, 'objetType', v_objet_type_existant,
      'objet', v_snapshot_apres, 'rejeu', true);
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
      if v_type_element not in ('domaine', 'connaissance', 'competence') or v_nom = '' then
        raise exception 'Element global invalide.' using errcode = '22023';
      end if;
      insert into public.carte_globale_elements (type, nom, description, provenance, valide_par, valide_le)
      values (v_type_element, v_nom, v_description, p_provenance, v_uid, now())
      returning id, version into v_objet_id, v_version_apres;
      select to_jsonb(e) into v_snapshot_apres from public.carte_globale_elements e where e.id = v_objet_id;
      v_objet_type := 'element'; v_version_avant := null;

    when 'corriger_element' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(e), e.version, e.statut into v_snapshot_avant, v_version_avant, v_statut
      from public.carte_globale_elements e where e.id = v_objet_id for update;
      if not found then raise exception 'Element global introuvable.' using errcode = 'P0002'; end if;
      if v_statut <> 'publie' then raise exception 'Un element retire ne se corrige pas.' using errcode = '55000'; end if;
      if p_expected_version is distinct from v_version_avant then
        raise exception 'Version globale obsolete.' using errcode = '40001';
      end if;
      v_nom := btrim(coalesce(p_commande ->> 'nom', ''));
      v_description := btrim(coalesce(p_commande ->> 'description', ''));
      if v_nom = '' then raise exception 'Le nom global est obligatoire.' using errcode = '22023'; end if;
      update public.carte_globale_elements set nom=v_nom, description=v_description, provenance=p_provenance,
        version=version+1, valide_par=v_uid, valide_le=now(), updated_at=now() where id=v_objet_id
        returning version into v_version_apres;
      select to_jsonb(e) into v_snapshot_apres from public.carte_globale_elements e where e.id=v_objet_id;
      v_objet_type := 'element';

    when 'retirer_element' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(e), e.version, e.statut into v_snapshot_avant, v_version_avant, v_statut
      from public.carte_globale_elements e where e.id=v_objet_id for update;
      if not found then raise exception 'Element global introuvable.' using errcode = 'P0002'; end if;
      if v_statut <> 'publie' then raise exception 'Element global deja retire.' using errcode = '55000'; end if;
      if p_expected_version is distinct from v_version_avant then raise exception 'Version globale obsolete.' using errcode = '40001'; end if;
      if exists (select 1 from public.carte_globale_relations r where r.statut='publie' and (r.source_id=v_objet_id or r.cible_id=v_objet_id)) then
        raise exception 'Retirer d abord les relations globales actives de cet element.' using errcode = '23503';
      end if;
      update public.carte_globale_elements set statut='retire', provenance=p_provenance, version=version+1,
        valide_par=v_uid, valide_le=now(), updated_at=now() where id=v_objet_id returning version into v_version_apres;
      select to_jsonb(e) into v_snapshot_apres from public.carte_globale_elements e where e.id=v_objet_id;
      v_objet_type := 'element';

    when 'publier_relation' then
      if coalesce(p_expected_version, 0) <> 0 then raise exception 'Une publication nouvelle attend la version 0.' using errcode = '22023'; end if;
      v_source_id := nullif(p_commande #>> '{relation,sourceId}', '')::uuid;
      v_cible_id := nullif(p_commande #>> '{relation,cibleId}', '')::uuid;
      v_relation_type := p_commande #>> '{relation,type}';
      if v_relation_type not in ('PART_OF','PREREQUISITE_OF','RELATED_TO','APPLIED_IN','ENABLES') then
        raise exception 'Type de relation globale invalide.' using errcode = '22023';
      end if;
      if v_source_id = v_cible_id then raise exception 'Une relation globale ne se relie pas a elle-meme.' using errcode = '22023'; end if;
      if not exists (select 1 from public.carte_globale_elements e where e.id=v_source_id and e.statut='publie')
         or not exists (select 1 from public.carte_globale_elements e where e.id=v_cible_id and e.statut='publie') then
        raise exception 'Les deux cibles globales doivent etre publiees.' using errcode = '23503';
      end if;

      if v_relation_type = 'PART_OF' then
        if not exists (select 1 from public.carte_globale_elements e where e.id=v_cible_id and e.type='domaine' and e.statut='publie') then
          raise exception 'PART_OF vise un domaine global publie.' using errcode = '22023';
        end if;
        if exists (with recursive parents(id) as (
          select v_cible_id union select r.cible_id from public.carte_globale_relations r join parents p on p.id=r.source_id
          where r.type='PART_OF' and r.statut='publie') select 1 from parents where id=v_source_id) then
          raise exception 'PART_OF creerait un cycle.' using errcode = '23514';
        end if;
      elsif v_relation_type = 'RELATED_TO' then
        if v_source_id::text > v_cible_id::text then
          v_objet_id := v_source_id; v_source_id := v_cible_id; v_cible_id := v_objet_id;
        end if;
      elsif v_relation_type = 'PREREQUISITE_OF' then
        if not exists (select 1 from public.carte_globale_elements e where e.id=v_source_id and e.type in ('connaissance','competence'))
           or not exists (select 1 from public.carte_globale_elements e where e.id=v_cible_id and e.type in ('connaissance','competence')) then
          raise exception 'PREREQUISITE_OF relie deux connaissances ou competences.' using errcode = '22023';
        end if;
        if exists (with recursive reach(id) as (
          select v_cible_id union select r.cible_id from public.carte_globale_relations r join reach x on x.id=r.source_id
          where r.type='PREREQUISITE_OF' and r.statut='publie') select 1 from reach where id=v_source_id) then
          raise exception 'PREREQUISITE_OF creerait un cycle.' using errcode = '23514';
        end if;
      elsif v_relation_type = 'APPLIED_IN' then
        if not exists (select 1 from public.carte_globale_elements e where e.id=v_source_id and e.type in ('connaissance','competence'))
           or not exists (select 1 from public.carte_globale_elements e where e.id=v_cible_id and e.type in ('domaine','connaissance','competence')) then
          raise exception 'APPLIED_IN vise un element apprenant vers un contexte.' using errcode = '22023';
        end if;
      elsif v_relation_type = 'ENABLES' then
        if not exists (select 1 from public.carte_globale_elements e where e.id=v_source_id and e.type in ('connaissance','competence'))
           or not exists (select 1 from public.carte_globale_elements e where e.id=v_cible_id) then
          raise exception 'ENABLES vise deux elements globaux.' using errcode = '22023';
        end if;
      end if;

      insert into public.carte_globale_relations (source_id,cible_id,type,provenance,valide_par,valide_le)
      values (v_source_id,v_cible_id,v_relation_type,p_provenance,v_uid,now()) returning id,version into v_objet_id,v_version_apres;
      select to_jsonb(r) into v_snapshot_apres from public.carte_globale_relations r where r.id=v_objet_id;
      v_objet_type := 'relation'; v_version_avant := null;

    when 'retirer_relation' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(r), r.version, r.statut into v_snapshot_avant,v_version_avant,v_statut
      from public.carte_globale_relations r where r.id=v_objet_id for update;
      if not found then raise exception 'Relation globale introuvable.' using errcode = 'P0002'; end if;
      if v_statut <> 'publie' then raise exception 'Relation globale deja retiree.' using errcode = '55000'; end if;
      if p_expected_version is distinct from v_version_avant then raise exception 'Version globale obsolete.' using errcode = '40001'; end if;
      update public.carte_globale_relations set statut='retire',provenance=p_provenance,version=version+1,
        valide_par=v_uid,valide_le=now(),updated_at=now() where id=v_objet_id returning version into v_version_apres;
      select to_jsonb(r) into v_snapshot_apres from public.carte_globale_relations r where r.id=v_objet_id;
      v_objet_type := 'relation';
    else
      raise exception 'Commande de carte globale inconnue.' using errcode = '22023';
  end case;

  insert into public.carte_globale_changes (request_id,action,objet_type,objet_id,version_avant,version_apres,provenance,
    snapshot_avant,snapshot_apres,valide_par,valide_le)
  values (p_request_id,v_action,v_objet_type,v_objet_id,v_version_avant,v_version_apres,p_provenance,
    v_snapshot_avant,v_snapshot_apres,v_uid,now());
  return jsonb_build_object('action',v_action,'objetType',v_objet_type,'objet',v_snapshot_apres,'rejeu',false);
end;
$$;

revoke all on function public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb) from public, anon;
grant execute on function public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb) to authenticated;

commit;
