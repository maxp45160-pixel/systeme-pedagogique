-- Lot 1 : contrôle transactionnel sous RLS. Aucune donnée de test conservée.
-- Requiert un compte pilote administrateur actif existant ; n'en crée aucun.
begin;
select set_config('test.accueil.user_id', (
  select user_id::text from public.comptes_acces
  where role = 'admin' and depot_pilote and suspendu_le is null limit 1
), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.accueil.user_id'), 'role', 'authenticated'
)::text, true);
set local role authenticated;
do $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Compte pilote actif requis'; end if;
  insert into public.engagements(user_id,id,type,libelle,echeance_le,codes)
  values(auth.uid(),'test-lot1-rollback','examen','Test transactionnel lot 1','2026-09-18','{}');
  select count(*) into n from public.engagements where id='test-lot1-rollback';
  if n<>1 then raise exception 'Écriture illisible'; end if;
  begin
    insert into public.engagements(user_id,id,type,libelle,echeance_le,codes)
    values(auth.uid(),'test-lot1-rollback','examen','Doublon','2026-09-18','{}');
    raise exception 'Doublon accepté';
  exception when unique_violation then null;
  end;
  begin
    insert into public.engagements(user_id,id,type,libelle,echeance_le,codes)
    values('00000000-0000-4000-8000-000000000001','test-hors-compte','examen','Hors compte','2026-09-18','{}');
    raise exception 'RLS contournée';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Un autre sujet JWT ne peut pas relire le reçu du compte pilote.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  if exists(select 1 from public.engagements where id='test-lot1-rollback') then
    raise exception 'Lecture hors compte permise';
  end if;
end $$;
select 'Écriture, relecture, unicité et isolation vérifiées ; transaction annulée' as resultat;
rollback;
