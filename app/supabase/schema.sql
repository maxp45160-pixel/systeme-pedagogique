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
-- 3bis. Thèmes — regroupements de compétences traversant les domaines
--    (chantier « thèmes », 10/08/2026, ADR-053)
--
-- Pas de FK vers `competences.code` : un code retiré du référentiel après
-- coup doit rester lisible dans un thème passé, et le domaine pur
-- (`themeVersThemeSeance`) filtre les codes disparus à la lecture — même
-- précédent que `competences.prerequis`.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.themes (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id           TEXT NOT NULL,
  libelle      TEXT NOT NULL,
  intention    TEXT,
  codes        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  origine      TEXT NOT NULL DEFAULT 'utilisateur' CHECK (origine IN ('utilisateur', 'tuteur')),
  cree_le      TEXT NOT NULL,
  modifie_le   TEXT,
  archive      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

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
  -- Dernière correction du contenu (ADR-047). NULL si jamais retouché. Sert à
  -- signaler qu'une preuve ancienne porte sur un énoncé qui a changé depuis.
  -- Voir `supabase/migration-exercice-edition.sql` pour une base en service.
  modifie_le          TEXT,
  -- Pourquoi il a été écrit, pas pourquoi il est servi (voir types.ts). NULL
  -- pour tout exercice antérieur à ce champ — jamais déduit après coup. Voir
  -- `supabase/migration-intention-exercice.sql` pour une base en service.
  intention           TEXT CHECK (intention IS NULL OR intention IN ('decouverte', 'consolidation', 'transfert', 'revision')),
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
  -- Nommée `auto_evaluation` jusqu'au 10/08/2026. C'est LA mesure de la
  -- tentative — ce que la personne a validé —, à distinguer de `verdict_tuteur`
  -- ci-dessous, qui n'est que ce qui lui a été proposé.
  -- Voir `supabase/migration-seances.sql` § 2 pour une base déjà installée.
  evaluation        JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultat          TEXT NOT NULL DEFAULT 'partiel',
  statut            TEXT NOT NULL DEFAULT 'en-cours',
  notes             TEXT,
  -- Verdict proposé par le tuteur, conservé tel quel (ADR-046). NULL quand le
  -- bilan a été rempli sans assistance. Ce n'est PAS une mesure : la mesure est
  -- ce que la personne a validé, dans `resultat` et `auto_evaluation`.
  -- Voir `supabase/migration-verdict.sql` pour une base déjà installée.
  verdict_tuteur    JSONB,
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

  -- Séance composée (ADR-048). Une séance a toujours existé : elle était
  -- écrite automatiquement à chaque exercice terminé, avec une seule activité.
  -- Ces quatre colonnes lui donnent N activités et un cycle de vie.
  --
  -- `statut` à NULL = séance historique auto-générée, donc terminée. Le domaine
  -- lit cette absence une seule fois (`statutSeance`, lib/domain/seance.ts) ;
  -- on ne fabrique pas rétroactivement un statut que personne n'a posé.
  --
  -- `besoin_declare` est un fait observé et daté, stocké verbatim, PAS une
  -- mesure : l'écart avec le réalisé est dérivé à la lecture et jamais agrégé
  -- en score (ADR-050).
  statut                   TEXT
    CHECK (statut IS NULL OR statut IN ('planifiee', 'en-cours', 'terminee')),
  planifiee_pour           TEXT,
  besoin_declare           JSONB,
  blueprint                JSONB,

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

-- `exercice_id` NULL = refus de la compétence entière. Renseigné, le refus
-- ne porte que sur l'exercice proposé : la compétence reste recommandable
-- avec un autre exercice.
CREATE TABLE IF NOT EXISTS public.refus_recommandations (
  id          TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  exercice_id TEXT,
  date        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE public.refus_recommandations
  ADD COLUMN IF NOT EXISTS exercice_id TEXT;

-- --------------------------------------------------------------------
-- 7bis. Corpus documentaire Markdown (source canonique)
--
-- Le contenu complet vit dans `contenu_md`. Les métadonnées documentaires et
-- les relations sont relues depuis son front-matter et ses wikilinks ; les
-- tables `document_links` et `document_snapshots` sont respectivement un index
-- reconstructible et un historique immuable.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.documents (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id           TEXT NOT NULL,
  contenu_md   TEXT NOT NULL,
  titre        TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'document',
  tags         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  schema_version TEXT,
  frontmatter  JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

DROP TRIGGER IF EXISTS on_document_updated ON public.documents;
CREATE TRIGGER on_document_updated
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.document_links (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id    TEXT NOT NULL,
  cible        TEXT NOT NULL,
  libelle      TEXT,
  ancre        TEXT NOT NULL DEFAULT '',
  resolu       BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, source_id, cible, ancre),
  FOREIGN KEY (user_id, source_id)
    REFERENCES public.documents(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.document_snapshots (
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  document_id    TEXT NOT NULL,
  version        INTEGER NOT NULL CHECK (version > 0),
  contenu_md     TEXT NOT NULL,
  capture_reason TEXT NOT NULL,
  captured_at    TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, document_id, version),
  FOREIGN KEY (user_id, document_id)
    REFERENCES public.documents(user_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.document_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "snapshots_lecture_compte" ON public.document_snapshots;
CREATE POLICY "snapshots_lecture_compte"
  ON public.document_snapshots FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "snapshots_creation_compte" ON public.document_snapshots;
CREATE POLICY "snapshots_creation_compte"
  ON public.document_snapshots FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

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
  -- Les noms spécifiques utilisés par la migration distante sont retirés
  -- avant que la boucle uniforme ne pose le nom canonique historique.
  DROP POLICY IF EXISTS "documents_isolation_par_compte" ON public.documents;
  DROP POLICY IF EXISTS "document_links_isolation_par_compte" ON public.document_links;

  FOREACH t IN ARRAY ARRAY[
    'domaines', 'competences', 'evidence', 'exercises', 'attempts', 'sessions',
    'refus_recommandations', 'themes', 'documents', 'document_links'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "isolation_par_compte" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "isolation_par_compte" ON public.%I FOR ALL TO authenticated '
      || 'USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)', t);

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

-- Le corpus est consulté par date de modification et les backlinks par cible.
-- Ces index évitent un scan de tous les documents lorsque le corpus grandit.
CREATE INDEX IF NOT EXISTS documents_user_updated_idx
  ON public.documents (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS documents_user_type_idx
  ON public.documents (user_id, type, updated_at DESC);

CREATE INDEX IF NOT EXISTS document_links_user_target_idx
  ON public.document_links (user_id, cible);

-- Les tables documentaires sont privées par défaut. RLS limite les lignes ;
-- les grants limitent en plus les rôles capables d'atteindre la table via la
-- Data API. `service_role` reste disponible uniquement côté serveur.
REVOKE ALL ON TABLE public.documents, public.document_links, public.document_snapshots FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents, public.document_links TO authenticated;
GRANT SELECT, INSERT ON TABLE public.document_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents, public.document_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_snapshots TO service_role;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.documents, public.document_links, public.document_snapshots FROM authenticated;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.documents, public.document_links, public.document_snapshots FROM service_role;
REVOKE MAINTAIN ON TABLE public.documents, public.document_links, public.document_snapshots FROM authenticated;
REVOKE MAINTAIN ON TABLE public.documents, public.document_links, public.document_snapshots FROM service_role;

-- --------------------------------------------------------------------
-- 8bis. Chargement groupé — les huit tables du compte en un aller-retour
--
-- Sept requêtes parallèles coûtaient ~750 ms de latence cumulée ; cette
-- RPC les ramène à un seul aller-retour. `chargerToutRPC` (lib/store/db.ts)
-- l'appelle et se replie sur les lectures séparées si elle est absente
-- **ou si sa charge utile ne porte pas toutes les clés attendues**.
--
-- Cette fonction a longtemps vécu uniquement dans Supabase Studio : elle a
-- dérivé du schéma en oubliant `refus_recommandations`, et « Passer une
-- suggestion » est resté sans effet sans qu'aucun test puisse le voir.
-- Toute table ajoutée aux `Collections` doit apparaître ici.
--
-- SECURITY INVOKER (défaut) : soumise à RLS comme n'importe quelle lecture.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.charger_tout()
RETURNS JSON
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  resultat json;
BEGIN
  SELECT json_build_object(
    'profile',     (SELECT row_to_json(p) FROM profiles p WHERE p.id = uid),
    'evidence',    COALESCE((SELECT json_agg(row_to_json(e)) FROM evidence e WHERE e.user_id = uid), '[]'::json),
    'exercises',   COALESCE((SELECT json_agg(row_to_json(x)) FROM exercises x WHERE x.user_id = uid), '[]'::json),
    'attempts',    COALESCE((SELECT json_agg(row_to_json(a)) FROM attempts a WHERE a.user_id = uid), '[]'::json),
    'sessions',    COALESCE((SELECT json_agg(row_to_json(s)) FROM sessions s WHERE s.user_id = uid), '[]'::json),
    'refus_recommandations',
                   COALESCE((SELECT json_agg(row_to_json(r)) FROM refus_recommandations r WHERE r.user_id = uid), '[]'::json),
    'domaines',    COALESCE((SELECT json_agg(row_to_json(d)) FROM domaines d WHERE d.user_id = uid), '[]'::json),
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json)
  ) INTO resultat;

  RETURN resultat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated;
