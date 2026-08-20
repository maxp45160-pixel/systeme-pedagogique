-- Lot 7 — verrouillage append-only des Observations.
-- La clôture atomique conserve le seul chemin d'insertion applicatif.

begin;

alter table public.observations enable row level security;

drop policy if exists isolation_par_compte on public.observations;
drop policy if exists observations_lecture_compte on public.observations;
drop policy if exists observations_cloture_insertion on public.observations;

create policy observations_lecture_compte
  on public.observations
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

create policy observations_cloture_insertion
  on public.observations
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.cloture_exercice', true)) = 'on'
  );

revoke all on table public.observations from anon, authenticated;
grant select, insert on table public.observations to authenticated;
grant select, insert, update, delete on table public.observations to service_role;

create or replace function public.verifier_observations_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.purge_compte', true), '') <> 'on' then
    raise exception 'Les Observations sont append-only : aucune modification ni suppression individuelle.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.verifier_observations_append_only() from public, anon, authenticated;

drop trigger if exists observations_append_only on public.observations;
create trigger observations_append_only
before update or delete on public.observations
for each row
execute function public.verifier_observations_append_only();

-- Chemin privilégié, explicite et authentifié pour la purge volontaire d'un
-- compte. Il ne rend pas la table modifiable via la Data API.
create or replace function public.purger_observations_compte()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.compte_actif(v_uid) then
    raise exception 'Compte authentifie actif requis.' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('app.purge_compte', 'on', true);
  delete from public.observations where user_id = v_uid;
end;
$$;

revoke all on function public.purger_observations_compte() from public, anon;
grant execute on function public.purger_observations_compte() to authenticated;

commit;
