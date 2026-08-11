# Mise en route — comptes, Google SSO et Supabase

Supabase est obligatoire. Sans URL ou clé publique valide, l'application
affiche une erreur de configuration avant l'accès au produit ; il n'existe ni
mode JSON local ni identifiant de repli.

## Secrets et configuration

| Valeur | Emplacement | Exposition |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `app/.env.local` et Vercel | publique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `app/.env.local` et Vercel | publique, protégée par RLS |
| `service_role` | jamais dans le projet ni côté client | secrète, contourne RLS |
| Clé du moteur du tuteur | variable serveur `TUTEUR_CLE` | secrète |

Ne pas modifier silencieusement `app/.env.local`. Après une modification de
variables, redémarrer le serveur de développement.

## Appliquer le schéma

Dans le SQL Editor du projet Supabase, appliquer
`app/supabase/schema.sql`. Ce fichier est le schéma de référence ; les anciens
scripts SQL ponctuels ne font pas partie du dépôt.

Avant toute évolution de base : vérifier l'état réel, consulter les ADR,
appliquer une migration nommée, puis vérifier les objets et les conseillers
Supabase. RLS doit rester actif sur chaque table métier : l'isolation repose sur
PostgreSQL, pas sur les redirections de l'interface.

## Activer Google SSO

1. Dans Google Cloud, créer un client OAuth Web.
2. Autoriser `https://<project-ref>.supabase.co/auth/v1/callback` comme URI de
   retour Google.
3. Dans Supabase, activer le provider Google avec le Client ID et le secret.
4. Dans Authentication > URL Configuration, définir l'URL du site et autoriser
   `http://localhost:3000/auth/callback` ainsi que l'URL Vercel équivalente.

Le parcours attendu est :

```text
/login → Google → Supabase → /auth/callback → application
```

Un compte neuf déclare son sujet et son objectif dans `/demarrer`, valide une
première branche éditable, puis arrive dans `/competences`.

## MCP Supabase

Le MCP se connecte par OAuth et doit être limité au projet configuré. Il sert à
inspecter l'état réel, appliquer les migrations et lancer les conseillers. Il ne
remplace pas la configuration du provider Google ni les opérations Storage qui
doivent passer par l'API Storage ou le dashboard.

## Déploiement Vercel

Configurer, pour Production et Preview :

- `NEXT_PUBLIC_SUPABASE_URL` ;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ;
- les variables serveur du moteur du tuteur si ce moteur est activé.

Ajouter chaque URL de déploiement autorisée aux Redirect URLs de Supabase.
Vérifier aussi que l'auteur du commit appartient à l'équipe Vercel, faute de
quoi le déploiement peut rester bloqué avant le build.

## Vérifier l'isolation

Avec deux comptes : écrire une donnée pédagogique avec A, se connecter avec B,
et vérifier que B ne la voit pas. Toute fuite est un défaut RLS bloquant.
