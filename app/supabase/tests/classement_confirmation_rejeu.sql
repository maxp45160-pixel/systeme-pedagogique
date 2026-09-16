-- Contrat SQL utilisé par la confirmation documentaire. Tout est annulé.
begin;
select set_config('test.classement.user_id', (
  select user_id::text from public.comptes_acces
  where role='admin' and depot_pilote and suspendu_le is null limit 1
), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.classement.user_id'), 'role', 'authenticated'
)::text, true);
set local role authenticated;
do $$
declare
  commande jsonb := '{"type":"creer_domaine","domaine":{"id":"test_classement_20260915","nom":"Test classement transactionnel","prefixe":"ZQX","description":"Test annulé","ordre":999,"origine":"utilisateur"},"usage":{"type":"continu"},"competences":[{"intitule":"Calculer une somme de test","palier":"fondamentaux","importance":0.5,"prerequis":[],"ordre":0,"origine":"utilisateur"}]}'::jsonb;
  premier jsonb;
  second jsonb;
  n integer;
begin
  if auth.uid() is null then raise exception 'Compte pilote requis'; end if;
  if exists(select 1 from public.domaines where id='test_classement_20260915' or prefixe='ZQX') then
    raise exception 'Identité de test déjà utilisée : ne pas modifier les données existantes';
  end if;
  premier := public.appliquer_commande_referentiel('classement:test-rejeu-20260915:domaine',null,'utilisateur','Test de confirmation annulé',commande);
  second := public.appliquer_commande_referentiel('classement:test-rejeu-20260915:domaine',null,'utilisateur','Test de confirmation annulé',commande);
  if premier is distinct from second or premier->>'domaineId' <> 'test_classement_20260915' then
    raise exception 'Reçu de rejeu incorrect';
  end if;
  select count(*) into n from public.referentiel_changes
    where user_id=auth.uid() and request_id='classement:test-rejeu-20260915:domaine'
      and type='creer_domaine' and domaine_id='test_classement_20260915';
  if n<>1 then raise exception 'Création dupliquée ou reçu inaccessible'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.referentiel_changes where request_id='classement:test-rejeu-20260915:domaine') then
    raise exception 'Reçu lisible hors compte';
  end if;
end $$;
rollback;
select 'Création, reçu, rejeu et isolation vérifiés ; transaction annulée' as resultat;
