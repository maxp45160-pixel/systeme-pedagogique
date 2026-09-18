# P01-0002 — Application distante autorisée le 16/09/2026

Accord de Maxime : « oui j'autorise. Une fois que c fait, bosse la tranche 3 », en réponse à la demande d'application de `20260916183000_domaines_organisation_vides.sql`. Suivi courant dans P01-0003 ; les preuves P01-0002 décrivent l'état antérieur à cet accord.

- Projet Supabase : `vxkjzzshlqulexydgfpc` (systeme-pedagogique).
- Fonction relue avant effet : `public.appliquer_commande_referentiel(text,integer,text,text,jsonb)` ; MD5 du corps `85ff24629e3d0f8966fcbecdaf98d336`.
- Migration appliquée via `apply_migration`, nom `domaines_organisation_vides`, réponse `success: true`.
- Version attribuée et relue dans le registre distant : **20260916183753**. Correspond au fichier local préparé **20260916183000_domaines_organisation_vides.sql** ; ne pas le rejouer pour aligner les horodatages.
- MD5 attendu après les seuls remplacements : `b1b8253dfafab2763c34db60e9e6e23c` ; MD5 réellement relu après application : identique.
- Sécurité inchangée : `SECURITY INVOKER`, `search_path` vide, ACL `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` avant/après.

Le contrôle porte sur le corps distant complet et sa configuration. Il prouve l'application de l'amendement qui permet un domaine sans compétence à usage absent et conserve les refus d'usage continu vide et de module sans année. Aucun document utilisateur ni domaine n'a été créé pour cet examen. Aucun appel fournisseur, aucune permission modifiée, aucune publication du frontend. La recette de bout en bout et la pertinence sur corpus réel restent distinctes.
