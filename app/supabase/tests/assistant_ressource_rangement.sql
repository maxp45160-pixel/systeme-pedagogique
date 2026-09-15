-- Vérification transactionnelle du rangement documentaire sous RLS. Aucun appel IA.
begin;
select set_config('test.ressource.user_id', (
  select user_id::text from public.comptes_acces
  where role='admin' and depot_pilote and suspendu_le is null limit 1
), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.ressource.user_id'), 'role', 'authenticated'
)::text, true);
set local role authenticated;
do $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Compte pilote requis'; end if;
  insert into public.documents(user_id,id,contenu_md,titre,type,updated_at)
  values(auth.uid(),'test-rangement-rollback','# Test transactionnel','Test transactionnel','note','2000-01-01');
  update public.documents set contenu_md='# Test transactionnel rangé', titre='Rangé',
    frontmatter='{"depot_version":2,"rangement_origine":"assistant"}'::jsonb
  where user_id=auth.uid() and id='test-rangement-rollback' and updated_at='2000-01-01';
  get diagnostics n = row_count;
  if n<>1 then raise exception 'Écriture conditionnelle refusée'; end if;
  update public.documents set titre='Écrasement périmé'
  where user_id=auth.uid() and id='test-rangement-rollback' and updated_at='2000-01-01';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Version périmée acceptée'; end if;
  insert into public.document_links(user_id,source_id,cible,resolu)
  values(auth.uid(),'test-rangement-rollback','test-cible-non-metier',false);
  -- Même opération de réparation que l'index existant : suppression ciblée puis réinsertion.
  delete from public.document_links where user_id=auth.uid() and source_id='test-rangement-rollback';
  insert into public.document_links(user_id,source_id,cible,resolu)
  values(auth.uid(),'test-rangement-rollback','test-cible-non-metier',false);
  select count(*) into n from public.document_links where source_id='test-rangement-rollback';
  if n<>1 then raise exception 'Réparation non relisible'; end if;
  begin
    insert into public.document_links(user_id,source_id,cible,resolu)
    values('00000000-0000-4000-8000-000000000001','test-rangement-rollback','test-cible-non-metier',false);
    raise exception 'Écriture hors compte acceptée';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.documents where id='test-rangement-rollback')
    or exists(select 1 from public.document_links where source_id='test-rangement-rollback') then
    raise exception 'Lecture hors compte acceptée';
  end if;
end $$;
select 'Rangement, version attendue, index et isolation vérifiés ; transaction annulée' as resultat;
rollback;
