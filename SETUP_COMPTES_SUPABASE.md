# Mise en route — comptes, SSO Google et MCP Supabase

Tout ce qui suit se fait **une fois**. Tant que ce n'est pas fait, l'application
continue de tourner en mode local mono-utilisateur : rien n'est cassé.

Trois secrets interviennent. Ils ne se ressemblent pas et ne se rangent pas au
même endroit — c'est la seule chose vraiment importante de ce document :

| Secret | Où il va | Peut-il fuiter ? |
|---|---|---|
| `anon key` | `app/.env.local`, envoyé au navigateur | Oui, c'est prévu — RLS protège les données |
| `service_role key` | **nulle part dans ce projet** | Non — elle contourne RLS |
| Personal Access Token | variable d'environnement Windows, pour le MCP | Non |

---

## 1. Créer le projet Supabase

1. Aller sur [supabase.com/dashboard](https://supabase.com/dashboard), se connecter.
2. **New project**. Nom : `systeme-pedagogique`. Région : **West EU (Ireland)**
   ou **Frankfurt** — le plus proche, la latence se sent sur chaque page.
3. Choisir un mot de passe de base de données et **le garder dans ton
   gestionnaire de mots de passe** : il n'est plus jamais affiché.
4. Attendre ~2 min que le projet soit provisionné.

## 2. Appliquer le schéma

Dans le dashboard : **SQL Editor** › **New query**. Coller l'intégralité de
[`app/supabase/schema.sql`](app/supabase/schema.sql), puis **Run**.

Le script est idempotent : le relancer après une modification ne casse rien.

Il crée les 10 tables (profil + 9 collections), active **RLS** sur chacune avec
la même politique — *un compte ne voit que ses propres lignes* — et installe le
trigger qui crée automatiquement le profil à l'inscription.

Vérification : **Table Editor** doit lister `profiles`, `evidence`, `exercises`,
`attempts`, `errors`, `projects`, `readings`, `knowledge`, `sessions`,
`objectives`, chacune marquée « RLS enabled ».

## 3. Récupérer les clés publiques

**Project Settings** › **API** :

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Project API keys** › `anon` `public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Créer `app/.env.local` (ignoré par git — voir `app/.env.example`) :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Ne jamais copier la clé `service_role` dans ce fichier. Tout ce qui commence
> par `NEXT_PUBLIC_` part dans le navigateur ; `service_role` contourne RLS et
> donnerait à n'importe quel visiteur les données de tous les comptes.

Redémarrer le serveur (`npm run dev`) : les variables ne sont lues qu'au
démarrage. `/login` doit maintenant afficher le formulaire.

## 4. Activer le SSO Google

### 4a. Côté Google

1. [console.cloud.google.com](https://console.cloud.google.com) › créer un projet.
2. **APIs & Services** › **OAuth consent screen** : type **External**, remplir
   nom de l'app et e-mail de support. Tant que l'app est en mode *Testing*,
   ajouter ton adresse dans **Test users**.
3. **Credentials** › **Create credentials** › **OAuth client ID** › type **Web
   application**.
4. **Authorized redirect URIs** — une seule, celle de Supabase :

   ```
   https://xxxxxxxxxxxx.supabase.co/auth/v1/callback
   ```

   C'est bien le domaine **Supabase**, pas `localhost` : Google renvoie vers
   Supabase, qui renvoie ensuite vers l'application.
5. Copier le **Client ID** et le **Client Secret**.

### 4b. Côté Supabase

**Authentication** › **Providers** › **Google** : activer, coller Client ID et
Client Secret, **Save**.

**Authentication** › **URL Configuration** :

- **Site URL** : `http://localhost:3000` en développement, l'URL Vercel en production.
- **Redirect URLs** — ajouter les deux :

  ```
  http://localhost:3000/auth/callback
  https://<ton-app>.vercel.app/auth/callback
  ```

  Une URL absente d'ici est rejetée au retour, avec un message peu explicite —
  c'est la cause la plus fréquente d'un SSO qui « ne fait rien ».

### 4c. Essayer

`/login` › **Continuer avec Google**. Le parcours complet est :

```
/login → Google → Supabase → /auth/callback (échange du code) → /
```

Le passage par `/auth/callback` n'est pas optionnel : c'est là que le code
d'autorisation devient une session. Sans lui, Google renvoie bien vers le site
mais l'utilisateur reste anonyme.

## 5. Reprendre le journal local

Une fois connecté : rail de gauche › engrenage **Compte et synchronisation** ›
**Importer le journal local**.

Les preuves et séances de `app/data/store/` partent vers ton compte. L'import
est idempotent (aucun doublon si tu le relances) et **refuse d'écraser une
collection déjà peuplée** côté compte — un second clic après plusieurs séances
ne réécrira pas ton historique avec un instantané périmé.

## 6. Serveur MCP Supabase

Supabase héberge le serveur MCP : rien à installer, **aucun jeton à stocker**.
L'accès passe par OAuth, et `.mcp.json` (déjà versionné) ne contient qu'une URL
— pas un secret.

L'authentification **doit se faire dans un terminal classique**, pas depuis une
extension d'IDE ni depuis une session Claude Code non interactive :

```bash
claude /mcp
```

Sélectionner le serveur `supabase`, puis **Authenticate** et suivre le flux dans
le navigateur. Redémarrer Claude Code ensuite.

> Le serveur est limité au projet par le paramètre `project_ref` de l'URL. Les
> groupes de fonctionnalités activés se règlent via `features=` ; seul
> `database` est indispensable pour appliquer le schéma et vérifier RLS.

Pour régénérer la commande : dashboard › bouton **Connect** › onglet MCP.

Le MCP ne couvre **pas** le SSO Google (étape 4) : le consent screen et le
client OAuth se configurent dans Google Cloud Console, et le provider s'active
dans le dashboard.

## 7. Déploiement Vercel

### Qui a le droit de déclencher un déploiement

Vercel refuse les déploiements dont **l'auteur du commit** n'est pas membre de
l'équipe, et le déploiement part alors en état `BLOCKED` — sans aucun log de
build, ce qui donne l'impression trompeuse d'un échec de compilation.

C'est l'adresse inscrite dans le commit qui compte, pas le compte connecté dans
le navigateur. Vérifier avant de pousser :

```bash
git log -1 --format="%an <%ae>"
```

Cette adresse doit correspondre à un compte GitHub membre de l'équipe Vercel.
Le dépôt fixe donc son identité localement (`.git/config`), sans toucher à la
configuration globale de la machine :

```bash
git config --local user.email "<adresse-du-compte-membre>"
```

Symptôme associé : « *&lt;compte&gt; is not a member of this team* » sur la page du
déploiement.

### Variables d'environnement

**Settings** › **Environment Variables**, pour Production *et* Preview :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` (si le tuteur est utilisé)

Puis ajouter l'URL Vercel dans **Redirect URLs** côté Supabase (étape 4b).

> Sur Vercel, le disque est éphémère et en lecture seule : **le mode local n'y
> fonctionne pas**. Sans clés Supabase, un déploiement démarre avec un journal
> vide et perd toute écriture. Les clés ne sont donc pas optionnelles en
> production.

---

## Vérifier que l'isolation fonctionne

Le test qui compte vraiment, une fois deux comptes créés :

1. Se connecter avec le compte A, enregistrer une preuve.
2. Se déconnecter, se connecter avec le compte B.
3. Le compte B doit voir un référentiel **vide** — 0 preuve, aucun indicateur.

Si B voit les données de A, RLS n'est pas actif sur la table concernée :
reprendre l'étape 2. C'est PostgreSQL qui garantit l'isolation, pas
l'application — les redirections du proxy ne sont qu'un confort d'affichage.
