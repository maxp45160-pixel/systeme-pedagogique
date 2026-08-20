-- Lot 7 — compatibilité du contrat d'objectifs du profil.
--
-- Les colonnes objectif_moyen_terme et objectif_long_terme restent la source
-- déclarative du profil : le moteur les lit pour calibrer ses recommandations
-- internes. Cette migration ne doit donc pas les supprimer, ni supprimer les
-- données déjà saisies dans les comptes.

begin;

drop function if exists public.admin_comptes();

create function public.admin_comptes()
returns table (
  user_id uuid, email text, prenom text, role text,
  suspendu_le timestamptz, motif text, cree_le timestamptz,
  observations bigint, exercices bigint, seances bigint, competences bigint,
  derniere_activite timestamptz
)
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.est_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  return query
  select a.user_id, p.email, p.prenom, a.role, a.suspendu_le, a.motif, a.created_at,
    (select count(*) from public.observations e where e.user_id = a.user_id),
    (select count(*) from public.exercises x where x.user_id = a.user_id),
    (select count(*) from public.sessions s where s.user_id = a.user_id),
    (select count(*) from public.competences c where c.user_id = a.user_id),
    greatest(
      (select max(e.created_at) from public.observations e where e.user_id = a.user_id),
      (select max(t.created_at) from public.attempts t where t.user_id = a.user_id),
      (select max(s.created_at) from public.sessions s where s.user_id = a.user_id)
    )
  from public.comptes_acces a
  left join public.profiles p on p.id = a.user_id
  order by a.created_at desc;
end;
$$;

revoke all on function public.admin_comptes() from public, anon;
grant execute on function public.admin_comptes() to authenticated;

commit;
