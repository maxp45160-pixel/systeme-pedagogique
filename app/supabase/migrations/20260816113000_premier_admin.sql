-- Premier administrateur (ADR-074)
--
-- Le rôle ne s'accorde que depuis le panel, et le panel n'est ouvert qu'aux
-- administrateurs : il faut bien un amorçage en SQL. C'est le seul endroit du
-- dépôt où une adresse est écrite en dur, et c'est volontaire — le passage par
-- l'interface serait un chemin d'élévation de privilège.
--
-- Idempotente : rejouée, elle ne fait rien.

UPDATE public.comptes_acces a
SET role = 'admin'
FROM auth.users u
WHERE u.id = a.user_id
  AND u.email = 'maxime.peyredieu@gmail.com'
  AND a.role <> 'admin';
