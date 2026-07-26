-- ====================================================================
-- Schéma PostgreSQL — Système pédagogique (multi-comptes)
--
-- Idempotent : réexécutable sans erreur sur une base déjà migrée.
-- À appliquer dans Supabase Studio › SQL Editor, ou via `supabase db push`.
--
-- Conventions, alignées sur `src/lib/store/supabase-backend.ts` :
--   * une colonne snake_case par champ camelCase de premier niveau ;
--   * tout objet imbriqué (dimensions, source, activites, bilan…) va en
--     `jsonb` et conserve son camelCase — le moteur le relit tel quel ;
--   * `id` est le TEXT généré par l'application (`nouvelId`), pas un uuid :
--     l'identifiant reste lisible et trié chronologiquement.
--
-- Sécurité : chaque table est protégée par RLS avec la même politique —
-- un compte ne voit et n'écrit que ses propres lignes. C'est la seule
-- barrière d'autorisation à laquelle le système accorde sa confiance ;
-- les redirections côté proxy ne sont qu'un confort d'affichage.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Profils (adossés à auth.users)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id                        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                     TEXT UNIQUE NOT NULL,
  prenom                    TEXT NOT NULL DEFAULT 'Utilisateur',
  avatar_url                TEXT,
  formation                 TEXT NOT NULL DEFAULT 'Formation à renseigner',
  objectif_moyen_terme      TEXT NOT NULL DEFAULT 'Objectif à moyen terme à renseigner',
  objectif_long_terme       TEXT NOT NULL DEFAULT 'Objectif à long terme à renseigner',
  debut_suivi               TEXT NOT NULL DEFAULT CURRENT_DATE::text,
  preferences_pedagogiques  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profil_proprietaire" ON public.profiles;
CREATE POLICY "profil_proprietaire"
  ON public.profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Création automatique du profil à l'inscription (e-mail comme SSO Google).
-- SECURITY DEFINER : le trigger s'exécute avant que le compte n'ait de
-- session, il ne peut donc pas passer par RLS.
-- `search_path` est figé : sans cela, un schéma placé en tête par un rôle
-- appelant pourrait détourner l'INSERT d'une fonction privilégiée.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Horodatage de dernière modification du profil.
-- `search_path` figé ici aussi : le linter Supabase le réclame pour *toute*
-- fonction de `public`, pas seulement les SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Ces deux fonctions ne doivent tourner que comme triggers. PostgREST expose
-- en RPC tout ce qui est exécutable par `anon`/`authenticated` : on retire le
-- droit plutôt que de compter sur le type de retour TRIGGER pour l'empêcher.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- 2. Preuves de compétence (SkillEvidence) — journal append-only
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.evidence (
  id                     TEXT NOT NULL,
  user_id                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_code             TEXT NOT NULL,
  date                   TEXT NOT NULL,
  type                   TEXT NOT NULL,
  niveau_preuve          TEXT NOT NULL,
  autonomie              TEXT NOT NULL,
  qualite                TEXT NOT NULL,
  resultat               TEXT NOT NULL,
  contexte               TEXT NOT NULL,
  dimensions             JSONB NOT NULL DEFAULT '{}'::jsonb,
  competences_combinees  TEXT[],
  source                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  commentaire            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 3. Exercices créés par l'utilisateur ou le tuteur
--    (les exercices de diagnostic sont livrés avec le logiciel, pas stockés)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exercises (
  id                  TEXT NOT NULL,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titre               TEXT NOT NULL,
  domaine             TEXT NOT NULL,
  type                TEXT NOT NULL,
  difficulte          TEXT NOT NULL,
  competences         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  duree_estimee_min   INTEGER NOT NULL DEFAULT 0,
  enonce              TEXT NOT NULL,
  donnees             JSONB,
  indices             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  correction          TEXT NOT NULL DEFAULT '',
  criteres            JSONB NOT NULL DEFAULT '[]'::jsonb,
  diagnostic          BOOLEAN,
  origine             TEXT NOT NULL DEFAULT 'manuel',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 4. Tentatives (ExerciseAttempt)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attempts (
  id                TEXT NOT NULL,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id       TEXT NOT NULL,
  debut             TEXT NOT NULL,
  fin               TEXT,
  duree_min         INTEGER,
  indices_utilises  INTEGER NOT NULL DEFAULT 0,
  reponse           TEXT NOT NULL DEFAULT '',
  auto_evaluation   JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultat          TEXT NOT NULL DEFAULT 'partiel',
  statut            TEXT NOT NULL DEFAULT 'en-cours',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 5. Erreurs récurrentes (ErrorItem)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.errors (
  id              TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  concept         TEXT NOT NULL,
  skill_codes     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  description     TEXT NOT NULL,
  cause_probable  TEXT NOT NULL,
  correction      TEXT NOT NULL,
  exemple         TEXT,
  occurrences     JSONB NOT NULL DEFAULT '[]'::jsonb,
  statut          TEXT NOT NULL DEFAULT 'nouvelle',
  archivee        BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 6. Projets (Project)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
  id            TEXT NOT NULL,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titre         TEXT NOT NULL,
  objectif      TEXT NOT NULL,
  domaines      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  skill_codes   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  etapes        JSONB NOT NULL DEFAULT '[]'::jsonb,
  livrables     JSONB NOT NULL DEFAULT '[]'::jsonb,
  difficultes   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  statut        TEXT NOT NULL DEFAULT 'en-cours',
  date_debut    TEXT NOT NULL,
  date_fin      TEXT,
  bilan         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 7. Lectures (Reading)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.readings (
  id                      TEXT NOT NULL,
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titre                   TEXT NOT NULL,
  auteur                  TEXT NOT NULL DEFAULT '',
  domaine                 TEXT NOT NULL,
  statut                  TEXT NOT NULL DEFAULT 'a-lire',
  progression             INTEGER NOT NULL DEFAULT 0,
  concepts                TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  skill_codes             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes                   TEXT NOT NULL DEFAULT '',
  exercices_generes       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  comprehension_declaree  SMALLINT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 8. Connaissances (KnowledgeItem)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.knowledge (
  id           TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titre        TEXT NOT NULL,
  domaine      TEXT NOT NULL,
  skill_codes  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  contenu      TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT '',
  date         TEXT NOT NULL,
  validee      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 9. Séances (LearningSession)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sessions (
  id                       TEXT NOT NULL,
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date                     TEXT NOT NULL,
  duree_min                INTEGER,
  domaines                 TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  skill_codes              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  activites                JSONB NOT NULL DEFAULT '[]'::jsonb,
  resultat                 TEXT,
  difficulte               TEXT,
  apprentissage_principal  TEXT,
  prochaine_action         TEXT,
  note_personnelle         TEXT,
  genere_automatiquement   BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 10. Objectifs (Objectif)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.objectives (
  id              TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  horizon         TEXT NOT NULL,
  libelle         TEXT NOT NULL,
  skill_codes     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  cible           JSONB,
  date_creation   TEXT NOT NULL,
  date_echeance   TEXT,
  atteint         BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 11. RLS + index, appliqués uniformément aux tables de données
-- --------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'evidence', 'exercises', 'attempts', 'errors',
    'projects', 'readings', 'knowledge', 'sessions', 'objectives'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "isolation_par_compte" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "isolation_par_compte" ON public.%I FOR ALL TO authenticated '
      || 'USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);

    -- Toutes les lectures filtrent sur user_id ; la clé primaire composite
    -- (user_id, id) sert déjà d'index préfixé, cet index couvre les tris.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, created_at DESC)',
      t || '_user_created_idx', t);
  END LOOP;
END;
$$;

-- Accès le plus fréquent : l'état d'une compétence se recalcule à partir de
-- toutes ses preuves.
CREATE INDEX IF NOT EXISTS evidence_user_skill_idx
  ON public.evidence (user_id, skill_code);

CREATE INDEX IF NOT EXISTS attempts_user_exercise_idx
  ON public.attempts (user_id, exercise_id);
