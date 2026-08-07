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
  -- Plan de travail rédigé par la personne. Sans défaut et nullable : un plan
  -- non déclaré doit rester absent, pas se voir prêter une intention.
  plan                      TEXT,
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
-- 2. Référentiel de compétences — UNE ARBORESCENCE PAR COMPTE (ADR-026)
--
-- Jusqu'au 31/07/2026 le référentiel était un fichier TypeScript compilé
-- (`src/lib/domain/referentiel.ts`, 53 compétences / 8 domaines centrés
-- BUT QLIO → Master ITI) et `DOMAINE_PILOTE` en fixait le périmètre actif
-- pour TOUS les comptes à la fois. Étendre le référentiel était un commit.
--
-- Il est désormais une donnée par compte, créée et étendue par le tuteur
-- sous validation humaine : un compte de philosophie construit son propre
-- arbre sans qu'une ligne de code soit écrite pour lui.
--
-- Deux règles portées par le schéma plutôt que par l'application :
--   * le `code` est IMMUABLE — c'est la clé étrangère des preuves ;
--   * un domaine qui porte encore des compétences ne peut pas être effacé
--     (ON DELETE RESTRICT) : la cascade se décide, elle ne s'improvise pas.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.domaines (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id           TEXT NOT NULL,                  -- slug, ex. « philosophie-morale »
  nom          TEXT NOT NULL,
  prefixe      TEXT NOT NULL,                  -- « PHI » → codes PHI-01, PHI-02…
  description  TEXT NOT NULL DEFAULT '',
  ordre        INTEGER NOT NULL DEFAULT 0,
  archive      BOOLEAN NOT NULL DEFAULT false,
  origine      TEXT NOT NULL DEFAULT 'utilisateur',  -- utilisateur | tuteur | migration
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  -- Le préfixe engendre les codes : deux domaines qui le partagent
  -- produiraient des collisions silencieuses.
  UNIQUE (user_id, prefixe)
);

CREATE TABLE IF NOT EXISTS public.competences (
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,           -- « PHI-01 » — attribué par l'app, jamais par le tuteur
  -- Nommée `domaine` et non `domaine_id` : `ligneVersEntite` convertit sans
  -- table d'exceptions (`supabase-backend.ts`), et le champ du domaine
  -- s'appelle `Skill.domaine`. Un suffixe ici imposerait une exception.
  domaine             TEXT NOT NULL,
  intitule            TEXT NOT NULL,
  palier              TEXT NOT NULL DEFAULT 'fondamentaux'
                      CHECK (palier IN ('fondamentaux', 'intermediaire', 'avance')),
  prerequis           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  importance          REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  ordre               INTEGER NOT NULL DEFAULT 0,
  -- Périmètre de travail, par compte : traduction d'ADR-020, dont le
  -- `DOMAINE_PILOTE` global disparaît. Une compétence hors périmètre n'est
  -- ni calculée ni affichée ; ses preuves restent intactes.
  active              BOOLEAN NOT NULL DEFAULT true,
  -- Archivée = retirée du référentiel de travail SANS perdre ses preuves.
  -- C'est le seul retrait possible dès qu'une preuve existe (P4, ADR-027).
  archive             BOOLEAN NOT NULL DEFAULT false,
  hypothese_initiale  JSONB,
  origine             TEXT NOT NULL DEFAULT 'utilisateur',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, code),
  FOREIGN KEY (user_id, domaine)
    REFERENCES public.domaines(user_id, id) ON DELETE RESTRICT
);

-- --------------------------------------------------------------------
-- 3. Preuves de compétence (SkillEvidence) — journal append-only
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

-- Une preuve n'est jamais orpheline (ADR-027).
--
-- Avant ADR-026 le lien preuve → compétence n'était qu'une chaîne libre, et
-- `lib/engine/historique.ts` faisait `if (!skill) continue` : une preuve dont
-- le code avait disparu du référentiel s'effaçait de l'historique EN SILENCE.
-- La contrainte déplace cette garantie dans la base, qui seule peut l'appliquer
-- à des codes produits par l'utilisateur.
--
-- Posée sous condition : sur une base antérieure à la migration du référentiel,
-- les preuves existent avant les compétences. On refuse alors de la créer
-- plutôt que de faire échouer tout le fichier — le schéma reste réexécutable.
DO $$
DECLARE
  orphelines INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_competence_fk'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO orphelines
  FROM public.evidence e
  LEFT JOIN public.competences c
    ON c.user_id = e.user_id AND c.code = e.skill_code
  WHERE c.code IS NULL;

  IF orphelines = 0 THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT evidence_competence_fk
      FOREIGN KEY (user_id, skill_code)
      REFERENCES public.competences(user_id, code);
  ELSE
    RAISE NOTICE
      'evidence_competence_fk NON posée : % preuve(s) sans compétence correspondante. Appliquer la migration du référentiel, puis réexécuter ce fichier.',
      orphelines;
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 4. Exercices créés par l'utilisateur ou le tuteur
--    (les exercices de diagnostic sont livrés avec le logiciel, pas stockés)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exercises (
  id                  TEXT NOT NULL,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titre               TEXT NOT NULL,
  domaine             TEXT NOT NULL,
  type                TEXT NOT NULL,
  -- INTEGER, pas TEXT : le domaine est 1..5 (`Difficulte`), et
  -- `ligneVersEntite` ne coerce pas — une colonne TEXT faisait remonter
  -- « 1 » au moteur, où `"1" + 0` vaut `"10"`. Voir
  -- `migration-exercices.sql` §1 pour les bases déjà en service.
  difficulte          INTEGER NOT NULL CHECK (difficulte BETWEEN 1 AND 5),
  competences         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  duree_estimee_min   INTEGER NOT NULL DEFAULT 0,
  enonce              TEXT NOT NULL,
  donnees             JSONB,
  indices             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  correction          TEXT NOT NULL DEFAULT '',
  criteres            JSONB NOT NULL DEFAULT '[]'::jsonb,
  diagnostic          BOOLEAN,
  origine             TEXT NOT NULL DEFAULT 'manuel',
  -- Retrait sans perte de preuves (calque ADR-027). Un exercice sans
  -- tentative se supprime ; un exercice qui en porte s'archive.
  archive             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 5. Tentatives (ExerciseAttempt)
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
-- 6. Entités supprimées le 28/07/2026 (ADR-014)
--
-- `errors`, `projects`, `readings`, `knowledge` et `objectives` comptaient
-- **zéro ligne** en production le jour de leur suppression, et pour trois
-- d'entre elles aucun chemin d'écriture n'avait jamais existé. Le DROP est
-- explicite plutôt que silencieux : réexécuter ce fichier sur une base encore
-- ancienne doit les retirer, pas les laisser traîner.
--
-- ⚠️ Si une de ces tables contient des lignes chez vous, le DROP les détruit.
-- Vérifiez avant de réexécuter le schéma.
-- --------------------------------------------------------------------

DROP TABLE IF EXISTS public.errors;
DROP TABLE IF EXISTS public.projects;
DROP TABLE IF EXISTS public.readings;
DROP TABLE IF EXISTS public.knowledge;
DROP TABLE IF EXISTS public.objectives;

-- --------------------------------------------------------------------
-- 7. Séances (LearningSession)
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
-- 7bis. Refus de recommandation (R1)
--
-- Un refus est un fait observé : l'utilisateur a écarté une suggestion.
-- Il est stocké en base (et non en localStorage) pour que le moteur de
-- recommandation puisse le prendre en compte au prochain calcul. Le refus
-- expire après 7 jours — le filtrage se fait à la lecture, jamais à
-- l'écriture.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.refus_recommandations (
  id         TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  date       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- --------------------------------------------------------------------
-- 8. RLS + index, appliqués uniformément aux tables de données
--
-- `domaines` et `competences` entrent dans la même boucle que les autres :
-- le référentiel est une donnée personnelle comme les preuves, pas une
-- table de référence partagée.
-- --------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'domaines', 'competences', 'evidence', 'exercises', 'attempts', 'sessions',
    'refus_recommandations'
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

-- Le référentiel se lit toujours groupé par domaine (affichage, agrégats,
-- sérialisation pour le tuteur).
CREATE INDEX IF NOT EXISTS competences_user_domaine_idx
  ON public.competences (user_id, domaine);

-- --------------------------------------------------------------------
-- 9. TODOs de développement — table *partagée*
--
-- Exception délibérée à l'isolation par compte : c'est le tableau de bord
-- de l'équipe qui construit l'outil, pas une donnée pédagogique. Tout compte
-- connecté lit et écrit la même liste ; `auteur` trace qui a créé la ligne.
-- La barrière reste RLS : `anon` n'a aucun accès. Le linter Supabase signale
-- cette politique en `USING (true)` (lint 0024) — c'est l'intention ici, pas
-- un oubli : le partage *est* la fonctionnalité.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dev_todos (
  id        TEXT PRIMARY KEY,
  texte     TEXT NOT NULL,
  priorite  TEXT NOT NULL DEFAULT 'moyenne'
              CHECK (priorite IN ('haute', 'moyenne', 'basse')),
  fait      BOOLEAN NOT NULL DEFAULT false,
  ordre     INTEGER NOT NULL DEFAULT 0,
  cree_a    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auteur    TEXT,
  images    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);

ALTER TABLE public.dev_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_todos_partagees" ON public.dev_todos;
CREATE POLICY "dev_todos_partagees"
  ON public.dev_todos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS dev_todos_ordre_idx ON public.dev_todos (ordre);

-- Renumérotation d'un glisser-déposer : une transaction, pas N requêtes.
-- Pas de SECURITY DEFINER — la fonction s'exécute avec les droits de l'appelant
-- et reste donc soumise à la politique ci-dessus.
CREATE OR REPLACE FUNCTION public.reordonner_dev_todos(ordres JSONB)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.dev_todos AS d
     SET ordre = (e.value->>'ordre')::int
    FROM jsonb_array_elements(ordres) AS e
   WHERE d.id = e.value->>'id';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reordonner_dev_todos(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reordonner_dev_todos(JSONB) TO authenticated;

-- Images attachées aux TODOs. Bucket public : les vignettes sont affichées par
-- de simples <img>, servies par URL directe.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dev-todos', 'dev-todos', true, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Aucune politique SELECT : un bucket public sert déjà ses objets par URL, et
-- une politique de lecture large autoriserait en plus le *listing* du bucket
-- (linter Supabase 0025). Seuls le dépôt et le retrait sont ouverts, aux
-- comptes connectés.
DROP POLICY IF EXISTS "dev_todos_images_lecture" ON storage.objects;
DROP POLICY IF EXISTS "dev_todos_images_ecriture" ON storage.objects;

DROP POLICY IF EXISTS "dev_todos_images_depot" ON storage.objects;
CREATE POLICY "dev_todos_images_depot"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dev-todos');

DROP POLICY IF EXISTS "dev_todos_images_retrait" ON storage.objects;
CREATE POLICY "dev_todos_images_retrait"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'dev-todos');
