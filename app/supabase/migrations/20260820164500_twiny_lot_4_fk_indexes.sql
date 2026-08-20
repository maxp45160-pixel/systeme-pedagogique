-- Twiny — Lot 4 : index couvrants des clés étrangères

create index objectifs_cible_domaine_fk_idx
  on public.objectifs (user_id, cible_domaine_local_id)
  where cible_domaine_local_id is not null;

create index objectifs_cible_competence_fk_idx
  on public.objectifs (user_id, cible_competence_local_code)
  where cible_competence_local_code is not null;

create index parcours_cible_element_fk_idx
  on public.parcours (cible_element_global_id)
  where cible_element_global_id is not null;

create index parcours_cible_relation_fk_idx
  on public.parcours (cible_relation_globale_id)
  where cible_relation_globale_id is not null;

create index parcours_cible_domaine_fk_idx
  on public.parcours (user_id, cible_domaine_local_id)
  where cible_domaine_local_id is not null;

create index parcours_cible_competence_fk_idx
  on public.parcours (user_id, cible_competence_local_code)
  where cible_competence_local_code is not null;

create index evenements_session_fk_idx
  on public.evenements (user_id, session_id)
  where session_id is not null;
