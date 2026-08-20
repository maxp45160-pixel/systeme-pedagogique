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
  debut_suivi               TEXT NOT NULL DEFAULT CURRENT_DATE::text,
  preferences_pedagogiques  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profil_proprietaire" ON public.profiles;
DROP POLICY IF EXISTS "profil_admin_lecture" ON public.profiles;
DROP POLICY IF EXISTS "profil_lecture" ON public.profiles;
DROP POLICY IF EXISTS "profil_insertion" ON public.profiles;
DROP POLICY IF EXISTS "profil_modification" ON public.profiles;
DROP POLICY IF EXISTS "profil_suppression" ON public.profiles;

CREATE POLICY "profil_lecture" ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id OR (select public.est_admin()));

CREATE POLICY "profil_insertion" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profil_modification" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profil_suppression" ON public.profiles
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = id);

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
DECLARE
  v_nom text;
  v_avatar text;
BEGIN
  v_nom := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(CONCAT_WS(' ', NULLIF(NEW.raw_user_meta_data->>'given_name', ''), NULLIF(NEW.raw_user_meta_data->>'family_name', '')), ''),
    NULLIF(NEW.raw_user_meta_data->>'user_name', ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar', '')
  );

  INSERT INTO public.profiles (id, email, prenom, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    v_nom,
    v_avatar
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    prenom = CASE
      WHEN public.profiles.prenom IS NULL OR public.profiles.prenom = '' OR public.profiles.prenom = 'Utilisateur'
      THEN EXCLUDED.prenom
      ELSE public.profiles.prenom
    END,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

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
--   * le `code` est IMMUABLE — c'est la clé étrangère des observations ;
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
  version      INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
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
  -- ni calculée ni affichée ; ses observations restent intactes.
  active              BOOLEAN NOT NULL DEFAULT true,
  -- Archivée = retirée du référentiel de travail SANS perdre ses observations.
  -- C'est le seul retrait possible dès qu'une observation existe (P4, ADR-027).
  archive             BOOLEAN NOT NULL DEFAULT false,
  -- Un changement de sens crée un successeur ; il ne réécrit jamais les observations.
  remplace_par        TEXT,
  hypothese_initiale  JSONB,
  origine             TEXT NOT NULL DEFAULT 'utilisateur',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, code),
  FOREIGN KEY (user_id, domaine)
    REFERENCES public.domaines(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT competences_archive_active_check CHECK (NOT (archive AND active)),
  CONSTRAINT competences_remplace_par_check CHECK (remplace_par IS NULL OR remplace_par <> code),
  CONSTRAINT competences_remplace_par_fkey FOREIGN KEY (user_id, remplace_par)
    REFERENCES public.competences(user_id, code) DEFERRABLE INITIALLY IMMEDIATE
);

-- Domaines supplémentaires servis par une compétence (ADR-081).
--
-- Le porteur reste `competences.domaine` : il donne le code et porte la
-- gouvernance d'ADR-065. Un rattachement est une lecture de plus — la
-- compétence devient visible depuis ce domaine et compte dans sa couverture —
-- jamais une seconde propriété, et jamais un second code.
--
-- Un rattachement vers le porteur est refusé par
-- `public.rattachement_hors_porteur()` : il compterait la compétence deux fois
-- dans sa propre couverture.
CREATE TABLE IF NOT EXISTS public.competence_domaines (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  domaine     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code, domaine),
  FOREIGN KEY (user_id, code) REFERENCES public.competences(user_id, code) ON DELETE CASCADE,
  FOREIGN KEY (user_id, domaine) REFERENCES public.domaines(user_id, id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 3. Observations de compétence (SkillObservation) — journal append-only
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.observations (
  id                     TEXT NOT NULL,
  user_id                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_code             TEXT NOT NULL,
  date                   TEXT NOT NULL,
  type                   TEXT NOT NULL,
  niveau_observation          TEXT NOT NULL,
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

-- Une observation n'est jamais orpheline (ADR-027).
--
-- Avant ADR-026 le lien observation → compétence n'était qu'une chaîne libre, et
-- `lib/engine/historique.ts` faisait `if (!skill) continue` : une observation dont
-- le code avait disparu du référentiel s'effaçait de l'historique EN SILENCE.
-- La contrainte déplace cette garantie dans la base, qui seule peut l'appliquer
-- à des codes produits par l'utilisateur.
--
-- Posée sous condition : sur une base antérieure à la migration du référentiel,
-- les observations existent avant les compétences. On refuse alors de la créer
-- plutôt que de faire échouer tout le fichier — le schéma reste réexécutable.
DO $$
DECLARE
  orphelines INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'observations_competence_fk'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO orphelines
  FROM public.observations e
  LEFT JOIN public.competences c
    ON c.user_id = e.user_id AND c.code = e.skill_code
  WHERE c.code IS NULL;

  IF orphelines = 0 THEN
    ALTER TABLE public.observations
      ADD CONSTRAINT observations_competence_fk
      FOREIGN KEY (user_id, skill_code)
      REFERENCES public.competences(user_id, code);
  ELSE
    RAISE NOTICE
      'observations_competence_fk NON posée : % observation(s) sans compétence correspondante. Appliquer la migration du référentiel, puis réexécuter ce fichier.',
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
  -- Retrait sans perte d'observations (calque ADR-027). Un exercice sans
  -- tentative se supprime ; un exercice qui en porte s'archive.
  archive             BOOLEAN NOT NULL DEFAULT FALSE,
  -- Dernière correction du contenu (ADR-047). NULL si jamais retouché. Sert à
  -- signaler qu'une observation ancienne porte sur un énoncé qui a changé depuis.
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
  -- `abandonnee` (16/08/2026) est le pendant, pour la séance, de ce que
  -- `attempts.statut` porte déjà : une trace conservée, sans mesure. Elle
  -- existe parce qu'une séance en cours n'avait qu'une seule sortie — la
  -- terminer — et restait donc ouverte indéfiniment quand on ne voulait pas
  -- la mener.
  statut                   TEXT
    CHECK (statut IS NULL OR statut IN ('planifiee', 'en-cours', 'terminee', 'abandonnee')),
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
-- ne porte que sur l'activité proposée (exercice, note, ressource) : la
-- compétence reste recommandable avec une autre. `code` NULL = l'activité
-- n'en mobilisait aucune : seule elle sort de la file.
CREATE TABLE IF NOT EXISTS public.refus_recommandations (
  id          TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        TEXT,
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

-- --------------------------------------------------------------------
-- 3ter. Gouvernance du référentiel — registre immuable et journal
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.referentiel_codes_emis (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  domaine_id  TEXT NOT NULL,
  emis_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, code)
);

INSERT INTO public.referentiel_codes_emis (user_id, code, domaine_id, emis_le)
SELECT user_id, code, domaine, created_at FROM public.competences
ON CONFLICT (user_id, code) DO NOTHING;

ALTER TABLE public.competences
  DROP CONSTRAINT IF EXISTS competences_code_emis_fkey;
ALTER TABLE public.competences
  ADD CONSTRAINT competences_code_emis_fkey
  FOREIGN KEY (user_id, code) REFERENCES public.referentiel_codes_emis(user_id, code);

CREATE TABLE IF NOT EXISTS public.referentiel_changes (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  request_id    TEXT NOT NULL,
  domaine_id    TEXT NOT NULL,
  type          TEXT NOT NULL,
  version_avant INTEGER,
  version_apres INTEGER,
  origine       TEXT NOT NULL CHECK (origine IN ('utilisateur', 'tuteur', 'migration', 'manuel')),
  motif         TEXT NOT NULL CHECK (length(btrim(motif)) > 0),
  diff          JSONB NOT NULL,
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id)
);

CREATE OR REPLACE FUNCTION public.refuser_mutation_gouvernance_referentiel()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- L'immutabilité vaut pendant la vie du compte. La suppression explicite du
  -- compte doit néanmoins pouvoir cascader ses données personnelles.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Le registre et le journal du référentiel sont append-only';
END;
$$;

DROP TRIGGER IF EXISTS referentiel_codes_emis_append_only ON public.referentiel_codes_emis;
CREATE TRIGGER referentiel_codes_emis_append_only
  BEFORE UPDATE OR DELETE ON public.referentiel_codes_emis
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_gouvernance_referentiel();

DROP TRIGGER IF EXISTS referentiel_changes_append_only ON public.referentiel_changes;
CREATE TRIGGER referentiel_changes_append_only
  BEFORE UPDATE OR DELETE ON public.referentiel_changes
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_gouvernance_referentiel();

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

-- PDF de support : les octets vivent dans Storage, cette table ne conserve
-- que la metadonnee et le chemin prive rattaches a une fiche.
CREATE TABLE IF NOT EXISTS public.document_attachments (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id           UUID NOT NULL DEFAULT gen_random_uuid(),
  document_id  TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  mime_type    TEXT NOT NULL DEFAULT 'application/pdf'
    CHECK (mime_type = 'application/pdf'),
  size_bytes   BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, storage_path),
  FOREIGN KEY (user_id, document_id)
    REFERENCES public.documents(user_id, id) ON DELETE CASCADE
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
DROP POLICY IF EXISTS "snapshots_suppression_compte" ON public.document_snapshots;
CREATE POLICY "snapshots_suppression_compte"
  ON public.document_snapshots FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pieces_jointes_lecture_compte" ON public.document_attachments;
CREATE POLICY "pieces_jointes_lecture_compte"
  ON public.document_attachments FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "pieces_jointes_creation_note_support" ON public.document_attachments;
CREATE POLICY "pieces_jointes_creation_note_support"
  ON public.document_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.documents
      WHERE documents.user_id = (select auth.uid())
        AND documents.id = document_attachments.document_id
        AND documents.frontmatter ->> 'role' = 'support'
    )
  );
DROP POLICY IF EXISTS "pieces_jointes_suppression_compte" ON public.document_attachments;
CREATE POLICY "pieces_jointes_suppression_compte"
  ON public.document_attachments FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Bucket prive : aucun PDF ne doit etre accessible par une URL publique.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('document-support', 'document-support', false, 10485760, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "document_support_pdfs_insert" ON storage.objects;
CREATE POLICY "document_support_pdfs_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
    AND EXISTS (
      SELECT 1
      FROM public.documents
      WHERE documents.user_id = (select auth.uid())
        AND documents.id = (storage.foldername(name))[2]
        AND documents.frontmatter ->> 'role' = 'support'
    )
  );
DROP POLICY IF EXISTS "document_support_pdfs_select" ON storage.objects;
CREATE POLICY "document_support_pdfs_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
DROP POLICY IF EXISTS "document_support_pdfs_delete" ON storage.objects;
CREATE POLICY "document_support_pdfs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'document-support'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

CREATE OR REPLACE FUNCTION public.appliquer_commande_referentiel(
  p_request_id TEXT,
  p_expected_version INTEGER,
  p_origine TEXT,
  p_motif TEXT,
  p_commande JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_type TEXT := p_commande ->> 'type';
  v_domaine_id TEXT;
  v_version_avant INTEGER;
  v_version_apres INTEGER;
  v_prefixe TEXT;
  v_numero INTEGER;
  v_code TEXT;
  v_item JSONB;
  v_ajouts JSONB := '[]'::JSONB;
  v_codes_ajoutes JSONB := '[]'::JSONB;
  v_modifiees JSONB := '[]'::JSONB;
  v_supprimees JSONB := '[]'::JSONB;
  v_archivees JSONB := '[]'::JSONB;
  v_before JSONB;
  v_after JSONB;
  v_resultat JSONB;
  v_preserver BOOLEAN;
  v_domaine_supprime BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire.'; END IF;
  IF p_origine NOT IN ('utilisateur', 'tuteur', 'migration', 'manuel') THEN RAISE EXCEPTION 'Origine inconnue : %', p_origine; END IF;
  IF length(btrim(coalesce(p_motif, ''))) = 0 THEN RAISE EXCEPTION 'Le motif est obligatoire.'; END IF;
  IF v_type NOT IN ('creer_domaine', 'ajouter_competences', 'reviser_domaine', 'activer_competences', 'desarchiver_competence', 'retirer_competences', 'archiver_domaine', 'restaurer_domaine', 'remplacer_competence') THEN
    RAISE EXCEPTION 'Commande inconnue : %', coalesce(v_type, 'NULL');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':request:' || p_request_id, 0));

  SELECT diff -> 'resultat' INTO v_resultat
  FROM public.referentiel_changes
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_resultat; END IF;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);
  v_domaine_id := CASE WHEN v_type = 'creer_domaine' THEN p_commande #>> '{domaine,id}' ELSE p_commande ->> 'domaineId' END;
  IF length(btrim(coalesce(v_domaine_id, ''))) = 0 THEN RAISE EXCEPTION 'Identifiant de domaine obligatoire.'; END IF;

  IF v_type = 'creer_domaine' THEN
    IF p_expected_version IS NOT NULL THEN RAISE EXCEPTION 'Une création ne porte pas de version attendue.'; END IF;
    IF jsonb_array_length(coalesce(p_commande -> 'competences', '[]'::JSONB)) = 0 THEN RAISE EXCEPTION 'Un domaine doit naître avec au moins une compétence.'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':' || v_domaine_id, 0));
    INSERT INTO public.domaines (user_id, id, nom, prefixe, description, ordre, version, archive, origine)
    VALUES (
      v_uid, v_domaine_id, btrim(p_commande #>> '{domaine,nom}'), upper(btrim(p_commande #>> '{domaine,prefixe}')),
      coalesce(p_commande #>> '{domaine,description}', ''), coalesce((p_commande #>> '{domaine,ordre}')::INTEGER, 0),
      1, false, coalesce(p_commande #>> '{domaine,origine}', p_origine)
    );
    v_version_avant := NULL;
    v_version_apres := 1;
    v_ajouts := p_commande -> 'competences';
  ELSE
    SELECT version, prefixe INTO v_version_avant, v_prefixe
    FROM public.domaines
    WHERE user_id = v_uid AND id = v_domaine_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Domaine inconnu : %', v_domaine_id; END IF;
    IF p_expected_version IS NULL OR p_expected_version <> v_version_avant THEN
      RAISE EXCEPTION 'Le domaine a changé depuis son affichage (version attendue %, version actuelle %). Recharge la page.', p_expected_version, v_version_avant USING ERRCODE = '40001';
    END IF;
    SELECT jsonb_build_object(
      'domaine', to_jsonb(d) - 'user_id',
      'competences', coalesce((SELECT jsonb_agg(to_jsonb(c) - 'user_id' ORDER BY c.code) FROM public.competences c WHERE c.user_id = v_uid AND c.domaine = v_domaine_id), '[]'::JSONB)
    ) INTO v_before FROM public.domaines d WHERE d.user_id = v_uid AND d.id = v_domaine_id;
  END IF;

  SELECT prefixe INTO v_prefixe FROM public.domaines WHERE user_id = v_uid AND id = v_domaine_id;

  IF v_type = 'ajouter_competences' THEN v_ajouts := coalesce(p_commande -> 'competences', '[]'::JSONB); END IF;

  IF v_type = 'reviser_domaine' THEN
    UPDATE public.domaines SET
      nom = coalesce(nullif(btrim(p_commande #>> '{domaine,nom}'), ''), nom),
      description = CASE WHEN p_commande #> '{domaine,description}' IS NULL THEN description ELSE coalesce(p_commande #>> '{domaine,description}', '') END,
      ordre = coalesce((p_commande #>> '{domaine,ordre}')::INTEGER, ordre)
    WHERE user_id = v_uid AND id = v_domaine_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_commande -> 'modifications', '[]'::JSONB)) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id AND code = v_item ->> 'code') THEN
        RAISE EXCEPTION '% n''appartient pas au domaine %.', v_item ->> 'code', v_domaine_id;
      END IF;
      UPDATE public.competences SET
        intitule = coalesce(nullif(btrim(v_item ->> 'intitule'), ''), intitule),
        palier = coalesce(v_item ->> 'palier', palier),
        importance = coalesce((v_item ->> 'importance')::REAL, importance),
        prerequis = CASE WHEN v_item ? 'prerequis' THEN ARRAY(SELECT jsonb_array_elements_text(v_item -> 'prerequis')) ELSE prerequis END,
        ordre = coalesce((v_item ->> 'ordre')::INTEGER, ordre)
      WHERE user_id = v_uid AND code = v_item ->> 'code';
      v_modifiees := v_modifiees || jsonb_build_array(v_item ->> 'code');
    END LOOP;
    v_ajouts := coalesce(p_commande -> 'ajouts', '[]'::JSONB);
  END IF;

  IF v_type = 'remplacer_competence' THEN
    IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id AND code = p_commande ->> 'code') THEN
      RAISE EXCEPTION 'Compétence inconnue dans ce domaine : %', p_commande ->> 'code';
    END IF;
    v_ajouts := jsonb_build_array(p_commande -> 'successeur');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_ajouts) LOOP
    IF length(btrim(coalesce(v_item ->> 'intitule', ''))) < 10 THEN RAISE EXCEPTION 'Intitulé de compétence trop court.'; END IF;
    IF (v_item ->> 'palier') NOT IN ('fondamentaux', 'intermediaire', 'avance') THEN RAISE EXCEPTION 'Palier inconnu.'; END IF;
    IF (v_item ->> 'importance')::REAL NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Importance hors bornes.'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(coalesce(v_item -> 'prerequis', '[]'::JSONB)) p(code)
      WHERE NOT EXISTS (SELECT 1 FROM public.competences c WHERE c.user_id = v_uid AND c.code = p.code)
    ) THEN RAISE EXCEPTION 'Un prérequis de « % » est inconnu.', v_item ->> 'intitule'; END IF;

    SELECT coalesce(max(substring(code FROM length(v_prefixe) + 2)::INTEGER), 0) + 1 INTO v_numero
    FROM public.referentiel_codes_emis
    WHERE user_id = v_uid AND code ~ ('^' || v_prefixe || '-[0-9]+$');
    v_code := v_prefixe || '-' || lpad(v_numero::TEXT, 2, '0');
    INSERT INTO public.referentiel_codes_emis (user_id, code, domaine_id) VALUES (v_uid, v_code, v_domaine_id);
    INSERT INTO public.competences (user_id, code, domaine, intitule, palier, prerequis, importance, ordre, active, archive, origine)
    VALUES (
      v_uid, v_code, v_domaine_id, btrim(v_item ->> 'intitule'), v_item ->> 'palier',
      ARRAY(SELECT jsonb_array_elements_text(coalesce(v_item -> 'prerequis', '[]'::JSONB))),
      (v_item ->> 'importance')::REAL, coalesce((v_item ->> 'ordre')::INTEGER, 0), true, false,
      coalesce(v_item ->> 'origine', p_origine)
    );
    v_codes_ajoutes := v_codes_ajoutes || jsonb_build_array(v_code);
  END LOOP;

  IF v_type = 'remplacer_competence' THEN
    UPDATE public.competences SET remplace_par = v_code, archive = true, active = false
    WHERE user_id = v_uid AND domaine = v_domaine_id AND code = p_commande ->> 'code';
    v_archivees := jsonb_build_array(p_commande ->> 'code');
  END IF;

  IF v_type = 'activer_competences' THEN
    FOR v_item IN SELECT to_jsonb(value) FROM jsonb_array_elements_text(coalesce(p_commande -> 'codes', '[]'::JSONB)) LOOP
      v_code := v_item #>> '{}';
      IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id AND code = v_code) THEN RAISE EXCEPTION '% n''appartient pas au domaine %.', v_code, v_domaine_id; END IF;
      IF coalesce((p_commande ->> 'active')::BOOLEAN, false) AND EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND code = v_code AND archive) THEN RAISE EXCEPTION '% est archivée : désarchive-la d''abord.', v_code; END IF;
      UPDATE public.competences SET active = (p_commande ->> 'active')::BOOLEAN WHERE user_id = v_uid AND code = v_code;
    END LOOP;
  END IF;

  IF v_type = 'desarchiver_competence' THEN
    UPDATE public.competences SET archive = false, active = true
    WHERE user_id = v_uid AND domaine = v_domaine_id AND code = p_commande ->> 'code';
    IF NOT FOUND THEN RAISE EXCEPTION 'Compétence inconnue dans ce domaine.'; END IF;
  END IF;

  IF v_type IN ('retirer_competences', 'reviser_domaine') THEN
    FOR v_item IN SELECT to_jsonb(value) FROM jsonb_array_elements_text(
      CASE WHEN v_type = 'retirer_competences' THEN coalesce(p_commande -> 'codes', '[]'::JSONB) ELSE coalesce(p_commande -> 'retraits', '[]'::JSONB) END
    ) LOOP
      v_code := v_item #>> '{}';
      IF NOT EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND domaine = v_domaine_id AND code = v_code) THEN RAISE EXCEPTION '% n''appartient pas au domaine %.', v_code, v_domaine_id; END IF;
      v_preserver :=
        EXISTS (SELECT 1 FROM public.observations WHERE user_id = v_uid AND skill_code = v_code)
        OR EXISTS (SELECT 1 FROM public.competences WHERE user_id = v_uid AND (v_code = ANY(prerequis) OR remplace_par = v_code))
        OR EXISTS (SELECT 1 FROM public.exercises WHERE user_id = v_uid AND v_code = ANY(competences))
        OR EXISTS (SELECT 1 FROM public.themes WHERE user_id = v_uid AND v_code = ANY(codes))
        OR EXISTS (SELECT 1 FROM public.sessions WHERE user_id = v_uid AND v_code = ANY(skill_codes));
      v_preserver := v_preserver OR EXISTS (SELECT 1 FROM public.document_links WHERE user_id = v_uid AND cible = v_code);
      IF v_preserver THEN
        UPDATE public.competences SET archive = true, active = false WHERE user_id = v_uid AND code = v_code;
        v_archivees := v_archivees || jsonb_build_array(v_code);
      ELSE
        DELETE FROM public.competences WHERE user_id = v_uid AND code = v_code;
        v_supprimees := v_supprimees || jsonb_build_array(v_code);
      END IF;
    END LOOP;
  END IF;

  IF v_type = 'archiver_domaine' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.competences c WHERE c.user_id = v_uid AND c.domaine = v_domaine_id AND (
        EXISTS (SELECT 1 FROM public.observations e WHERE e.user_id = v_uid AND e.skill_code = c.code)
        OR EXISTS (SELECT 1 FROM public.competences d WHERE d.user_id = v_uid AND (c.code = ANY(d.prerequis) OR d.remplace_par = c.code))
        OR EXISTS (SELECT 1 FROM public.exercises x WHERE x.user_id = v_uid AND c.code = ANY(x.competences))
        OR EXISTS (SELECT 1 FROM public.themes t WHERE t.user_id = v_uid AND c.code = ANY(t.codes))
        OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.user_id = v_uid AND c.code = ANY(s.skill_codes))
        OR EXISTS (SELECT 1 FROM public.document_links l WHERE l.user_id = v_uid AND l.cible = c.code)
      )
    ) INTO v_preserver;
    IF v_preserver THEN
      UPDATE public.competences SET archive = true, active = false WHERE user_id = v_uid AND domaine = v_domaine_id;
      UPDATE public.domaines SET archive = true WHERE user_id = v_uid AND id = v_domaine_id;
    ELSE
      -- Ne jamais supprimer le domaine : il doit rester archivable.
      -- On marque seulement les competences comme archivées s'ils ne sont plus actifs.
      UPDATE public.competences SET archive = true, active = false WHERE user_id = v_uid AND domaine = v_domaine_id;
      -- Le domaine reste en base avec archive=true, il pourra toujours être restauré.
      -- On ne supprime pas le domaine (pas de v_domaine_supprime).
    END IF;
  END IF;

  IF v_type = 'restaurer_domaine' THEN
    UPDATE public.domaines SET archive = false WHERE user_id = v_uid AND id = v_domaine_id;
    UPDATE public.competences SET archive = false, active = true
    WHERE user_id = v_uid AND domaine = v_domaine_id;
  END IF;

  IF NOT v_domaine_supprime AND v_type <> 'creer_domaine' THEN
    UPDATE public.domaines SET version = version + 1 WHERE user_id = v_uid AND id = v_domaine_id RETURNING version INTO v_version_apres;
  ELSIF v_domaine_supprime THEN
    v_version_apres := NULL;
  END IF;

  IF NOT v_domaine_supprime THEN
    SELECT jsonb_build_object(
      'domaine', to_jsonb(d) - 'user_id',
      'competences', coalesce((SELECT jsonb_agg(to_jsonb(c) - 'user_id' ORDER BY c.code) FROM public.competences c WHERE c.user_id = v_uid AND c.domaine = v_domaine_id), '[]'::JSONB)
    ) INTO v_after FROM public.domaines d WHERE d.user_id = v_uid AND d.id = v_domaine_id;
  END IF;

  v_resultat := jsonb_build_object(
    'domaineId', v_domaine_id, 'version', v_version_apres, 'codes', v_codes_ajoutes,
    'ajoutees', v_codes_ajoutes, 'modifiees', v_modifiees, 'supprimees', v_supprimees,
    'archivees', v_archivees, 'domaineSupprime', v_domaine_supprime
  );
  IF v_type = 'remplacer_competence' THEN v_resultat := v_resultat || jsonb_build_object('successeur', v_code); END IF;

  INSERT INTO public.referentiel_changes (user_id, request_id, domaine_id, type, version_avant, version_apres, origine, motif, diff)
  VALUES (v_uid, p_request_id, v_domaine_id, v_type, v_version_avant, v_version_apres, p_origine, btrim(p_motif), jsonb_build_object('avant', v_before, 'apres', v_after, 'resultat', v_resultat));
  RETURN v_resultat;
END;
$$;

-- --------------------------------------------------------------------
-- 8. RLS + index, appliqués uniformément aux tables de données
--
-- `domaines` et `competences` entrent dans la même boucle que les autres :
-- le référentiel est une donnée personnelle comme les observations, pas une
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
    'domaines', 'competences', 'observations', 'exercises', 'attempts', 'sessions',
    'refus_recommandations', 'themes', 'documents', 'document_links'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "isolation_par_compte" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "isolation_par_compte" ON public.%I FOR ALL TO authenticated '
      || 'USING ((select auth.uid()) = user_id AND (select public.compte_actif())) '
      || 'WITH CHECK ((select auth.uid()) = user_id AND (select public.compte_actif()))', t);

    -- Toutes les lectures filtrent sur user_id ; la clé primaire composite
    -- (user_id, id) sert déjà d'index préfixé, cet index couvre les tris.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, created_at DESC)',
      t || '_user_created_idx', t);
  END LOOP;
END;
$$;

-- Les Observations sont lisibles par leur compte, mais ne peuvent être
-- insérées que pendant `clore_exercice()` et ne peuvent jamais être modifiées
-- ou supprimées individuellement via la Data API.
DROP POLICY IF EXISTS "isolation_par_compte" ON public.observations;
DROP POLICY IF EXISTS "observations_lecture_compte" ON public.observations;
DROP POLICY IF EXISTS "observations_cloture_insertion" ON public.observations;
CREATE POLICY "observations_lecture_compte" ON public.observations
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND (select public.compte_actif()));
CREATE POLICY "observations_cloture_insertion" ON public.observations
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (select public.compte_actif())
    AND (select current_setting('app.cloture_exercice', true)) = 'on'
  );
REVOKE ALL ON TABLE public.observations FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.observations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.observations TO service_role;

CREATE OR REPLACE FUNCTION public.verifier_observations_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(current_setting('app.purge_compte', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Les Observations sont append-only : aucune modification ni suppression individuelle.'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.verifier_observations_append_only() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS observations_append_only ON public.observations;
CREATE TRIGGER observations_append_only
BEFORE UPDATE OR DELETE ON public.observations
FOR EACH ROW EXECUTE FUNCTION public.verifier_observations_append_only();

CREATE OR REPLACE FUNCTION public.purger_observations_compte()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.compte_actif(v_uid) THEN
    RAISE EXCEPTION 'Compte authentifie actif requis.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.set_config('app.purge_compte', 'on', true);
  DELETE FROM public.observations WHERE user_id = v_uid;
END;
$$;
REVOKE ALL ON FUNCTION public.purger_observations_compte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purger_observations_compte() TO authenticated;

ALTER TABLE public.referentiel_codes_emis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referentiel_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "codes_emis_lecture_compte" ON public.referentiel_codes_emis;
CREATE POLICY "codes_emis_lecture_compte" ON public.referentiel_codes_emis FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "codes_emis_commande_compte" ON public.referentiel_codes_emis;
CREATE POLICY "codes_emis_commande_compte" ON public.referentiel_codes_emis FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
DROP POLICY IF EXISTS "referentiel_changes_lecture_compte" ON public.referentiel_changes;
CREATE POLICY "referentiel_changes_lecture_compte" ON public.referentiel_changes FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "referentiel_changes_commande_compte" ON public.referentiel_changes;
CREATE POLICY "referentiel_changes_commande_compte" ON public.referentiel_changes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');

-- Remplace la politique uniforme posée par la boucle pour les deux agrégats.
DROP POLICY IF EXISTS "isolation_par_compte" ON public.domaines;
DROP POLICY IF EXISTS "isolation_par_compte" ON public.competences;
DROP POLICY IF EXISTS "referentiel_lecture_compte" ON public.domaines;
DROP POLICY IF EXISTS "referentiel_lecture_compte" ON public.competences;
DROP POLICY IF EXISTS "referentiel_commande_compte" ON public.domaines;
DROP POLICY IF EXISTS "referentiel_commande_compte" ON public.competences;
DROP POLICY IF EXISTS "referentiel_commande_insertion" ON public.domaines;
DROP POLICY IF EXISTS "referentiel_commande_modification" ON public.domaines;
DROP POLICY IF EXISTS "referentiel_commande_suppression" ON public.domaines;
DROP POLICY IF EXISTS "referentiel_commande_insertion" ON public.competences;
DROP POLICY IF EXISTS "referentiel_commande_modification" ON public.competences;
DROP POLICY IF EXISTS "referentiel_commande_suppression" ON public.competences;
CREATE POLICY "referentiel_lecture_compte" ON public.domaines FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "referentiel_lecture_compte" ON public.competences FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "referentiel_commande_insertion" ON public.domaines FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_modification" ON public.domaines FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on')
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_suppression" ON public.domaines FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_insertion" ON public.competences FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_modification" ON public.competences FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on')
  WITH CHECK ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');
CREATE POLICY "referentiel_commande_suppression" ON public.competences FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id AND (select current_setting('app.referentiel_command', true)) = 'on');

-- Domaines secondaires du référentiel (ADR-081) : même frontière de commande
-- transactionnelle et même isolation RLS que le porteur.
comment on table public.competence_domaines is
  'Domaines supplémentaires servis par une compétence. Le domaine porteur reste competences.domaine : il donne le code et porte la gouvernance.';

create index if not exists competence_domaines_domaine_idx
  on public.competence_domaines (user_id, domaine);

-- Un rattachement vers le domaine porteur compterait la compétence deux fois
-- dans sa propre couverture. La clause vit ici plutôt que dans la seule
-- fonction : la base reste vraie même si un autre chemin écrit un jour.
create or replace function public.rattachement_hors_porteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.competences c
    where c.user_id = new.user_id and c.code = new.code and c.domaine = new.domaine
  ) then
    raise exception '% est déjà portée par le domaine « % » : un rattachement ne se superpose pas au porteur.', new.code, new.domaine;
  end if;
  return new;
end;
$$;

drop trigger if exists competence_domaines_hors_porteur on public.competence_domaines;
create trigger competence_domaines_hors_porteur
  before insert or update on public.competence_domaines
  for each row execute function public.rattachement_hors_porteur();

alter table public.competence_domaines enable row level security;

-- Mêmes barrières que `competences` : isolation par compte, `compte_actif()`
-- pour qu'un compte suspendu cesse de lire (ADR-074), et écriture réservée au
-- chemin transactionnel du référentiel (ADR-065).
drop policy if exists referentiel_lecture_compte on public.competence_domaines;
create policy referentiel_lecture_compte on public.competence_domaines
  for select using ((select auth.uid()) = user_id and public.compte_actif());

drop policy if exists referentiel_commande_insertion on public.competence_domaines;
create policy referentiel_commande_insertion on public.competence_domaines
  for insert with check (
    (select auth.uid()) = user_id
    and (select current_setting('app.referentiel_command', true)) = 'on'
    and public.compte_actif()
  );

drop policy if exists referentiel_commande_suppression on public.competence_domaines;
create policy referentiel_commande_suppression on public.competence_domaines
  for delete using (
    (select auth.uid()) = user_id
    and (select current_setting('app.referentiel_command', true)) = 'on'
    and public.compte_actif()
  );

grant select, insert, delete on public.competence_domaines to authenticated;

-- Le geste de rattachement, transactionnel comme les autres.
--
-- Il ne rejoint pas `appliquer_commande_referentiel` : cette fonction liste ses
-- types autorisés dans un bloc unique de plus de 13 Ko, et l'étendre ferait
-- porter à un ajout périphérique le risque de réécrire tout le chemin
-- d'écriture du référentiel. Les garanties d'ADR-065 sont reprises ici telles
-- quelles : idempotence par `request_id`, version optimiste, journal
-- append-only, drapeau de commande.
create or replace function public.rattacher_competences_domaine(
  p_request_id text,
  p_expected_version integer,
  p_origine text,
  p_motif text,
  p_domaine_id text,
  p_codes text[],
  p_rattache boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
DECLARE
  v_uid UUID := auth.uid();
  v_version_avant INTEGER;
  v_version_apres INTEGER;
  v_resultat JSONB;
  v_code TEXT;
  v_porteur TEXT;
  v_touches JSONB := '[]'::JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_request_id, ''))) = 0 THEN RAISE EXCEPTION 'request_id obligatoire.'; END IF;
  IF p_origine NOT IN ('utilisateur', 'tuteur', 'migration', 'manuel') THEN RAISE EXCEPTION 'Origine inconnue : %', p_origine; END IF;
  IF length(btrim(coalesce(p_motif, ''))) = 0 THEN RAISE EXCEPTION 'Le motif est obligatoire.'; END IF;
  IF coalesce(array_length(p_codes, 1), 0) = 0 THEN RAISE EXCEPTION 'Aucune compétence à rattacher.'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':request:' || p_request_id, 0));

  SELECT diff -> 'resultat' INTO v_resultat
  FROM public.referentiel_changes
  WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN RETURN v_resultat; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::TEXT || ':' || p_domaine_id, 0));

  SELECT version INTO v_version_avant FROM public.domaines
  WHERE user_id = v_uid AND id = p_domaine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Domaine inconnu : %', p_domaine_id; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_version_avant THEN
    RAISE EXCEPTION 'Le domaine a changé depuis ta lecture (version % attendue, % en base).', p_expected_version, v_version_avant;
  END IF;

  PERFORM pg_catalog.set_config('app.referentiel_command', 'on', true);

  FOREACH v_code IN ARRAY p_codes LOOP
    SELECT domaine INTO v_porteur FROM public.competences
    WHERE user_id = v_uid AND code = v_code;
    IF NOT FOUND THEN RAISE EXCEPTION 'Compétence inconnue : %', v_code; END IF;
    IF v_porteur = p_domaine_id THEN
      RAISE EXCEPTION '% est déjà portée par ce domaine.', v_code;
    END IF;

    IF p_rattache THEN
      INSERT INTO public.competence_domaines (user_id, code, domaine)
      VALUES (v_uid, v_code, p_domaine_id)
      ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.competence_domaines
      WHERE user_id = v_uid AND code = v_code AND domaine = p_domaine_id;
    END IF;
    v_touches := v_touches || to_jsonb(v_code);
  END LOOP;

  UPDATE public.domaines SET version = version + 1
  WHERE user_id = v_uid AND id = p_domaine_id
  RETURNING version INTO v_version_apres;

  v_resultat := jsonb_build_object(
    'domaineId', p_domaine_id,
    'version', v_version_apres,
    'rattachees', CASE WHEN p_rattache THEN v_touches ELSE '[]'::JSONB END,
    'detachees', CASE WHEN p_rattache THEN '[]'::JSONB ELSE v_touches END
  );

  INSERT INTO public.referentiel_changes (user_id, request_id, domaine_id, type, version_avant, version_apres, origine, motif, diff)
  VALUES (
    v_uid, p_request_id, p_domaine_id,
    CASE WHEN p_rattache THEN 'rattacher_competences' ELSE 'detacher_competences' END,
    v_version_avant, v_version_apres, p_origine, btrim(p_motif),
    jsonb_build_object('resultat', v_resultat)
  );

  RETURN v_resultat;
END;
$$;

revoke all on function public.rattacher_competences_domaine(text, integer, text, text, text, text[], boolean) from public, anon;
grant execute on function public.rattacher_competences_domaine(text, integer, text, text, text, text[], boolean) to authenticated;

-- Une fonction de trigger n'a pas à être appelable depuis l'API REST.
-- Le trigger s'exécute sans passer par le GRANT ; seul l'accès direct se ferme.
revoke execute on function public.rattachement_hors_porteur() from public;
revoke execute on function public.rattachement_hors_porteur() from anon;
revoke execute on function public.rattachement_hors_porteur() from authenticated;

-- Accès le plus fréquent : l'état d'une compétence se recalcule à partir de
-- toutes ses observations.
CREATE INDEX IF NOT EXISTS observations_user_skill_idx
  ON public.observations (user_id, skill_code);

CREATE INDEX IF NOT EXISTS attempts_user_exercise_idx
  ON public.attempts (user_id, exercise_id);

-- Le référentiel se lit toujours groupé par domaine (affichage, agrégats,
-- sérialisation pour le tuteur).
CREATE INDEX IF NOT EXISTS competences_user_domaine_idx
  ON public.competences (user_id, domaine);

CREATE UNIQUE INDEX IF NOT EXISTS domaines_user_nom_normalise_uidx
  ON public.domaines (user_id, lower(btrim(nom)));

CREATE UNIQUE INDEX IF NOT EXISTS competences_user_domaine_intitule_normalise_uidx
  ON public.competences (user_id, domaine, lower(btrim(intitule)));

CREATE INDEX IF NOT EXISTS referentiel_changes_user_domaine_date_idx
  ON public.referentiel_changes (user_id, domaine_id, cree_le DESC);

CREATE INDEX IF NOT EXISTS competences_user_remplace_par_idx
  ON public.competences (user_id, remplace_par);

-- Le corpus est consulté par date de modification et les backlinks par cible.
-- Ces index évitent un scan de tous les documents lorsque le corpus grandit.
CREATE INDEX IF NOT EXISTS documents_user_updated_idx
  ON public.documents (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS documents_user_type_idx
  ON public.documents (user_id, type, updated_at DESC);

CREATE INDEX IF NOT EXISTS document_links_user_target_idx
  ON public.document_links (user_id, cible);

CREATE INDEX IF NOT EXISTS document_attachments_user_document_idx
  ON public.document_attachments (user_id, document_id, created_at DESC);

-- Les tables documentaires sont privées par défaut. RLS limite les lignes ;
-- les grants limitent en plus les rôles capables d'atteindre la table via la
-- Data API. `service_role` reste disponible uniquement côté serveur.
REVOKE ALL ON TABLE public.documents, public.document_links, public.document_snapshots, public.document_attachments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents, public.document_links TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.document_snapshots TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.document_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents, public.document_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_attachments TO service_role;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.documents, public.document_links, public.document_snapshots, public.document_attachments FROM authenticated;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.documents, public.document_links, public.document_snapshots, public.document_attachments FROM service_role;
REVOKE MAINTAIN ON TABLE public.documents, public.document_links, public.document_snapshots, public.document_attachments FROM authenticated;
REVOKE MAINTAIN ON TABLE public.documents, public.document_links, public.document_snapshots, public.document_attachments FROM service_role;

REVOKE ALL ON TABLE public.referentiel_codes_emis, public.referentiel_changes FROM anon;
GRANT SELECT, INSERT ON TABLE public.referentiel_codes_emis, public.referentiel_changes TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.referentiel_codes_emis, public.referentiel_changes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.domaines, public.competences TO authenticated;
REVOKE ALL ON FUNCTION public.appliquer_commande_referentiel(TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appliquer_commande_referentiel(TEXT, INTEGER, TEXT, TEXT, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.refuser_mutation_gouvernance_referentiel() FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- 8bis. Clôture atomique d'exercice et provenance exacte (lot 2)
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verifier_cloture_tentative_atomique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.statut = 'en-cours'
     AND NEW.statut IN ('terminee', 'abandonnee')
     AND COALESCE(current_setting('app.cloture_exercice', true), '') <> 'on'
  THEN
    RAISE EXCEPTION
      'La clôture de la tentative % doit passer par clore_exercice().', NEW.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.verifier_cloture_tentative_atomique()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS attempts_cloture_atomique ON public.attempts;
CREATE TRIGGER attempts_cloture_atomique
BEFORE UPDATE ON public.attempts
FOR EACH ROW
EXECUTE FUNCTION public.verifier_cloture_tentative_atomique();

CREATE OR REPLACE FUNCTION public.verifier_source_observation_exacte()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_tentative public.attempts%ROWTYPE;
BEGIN
  IF COALESCE(current_setting('app.cloture_exercice', true), '') <> 'on' THEN
    RAISE EXCEPTION
      'Toute nouvelle observation doit être écrite par clore_exercice().'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(NEW.source) IS DISTINCT FROM 'object'
     OR NEW.source->>'kind' IS DISTINCT FROM 'exercice'
     OR COALESCE(NEW.source->>'ref', '') = ''
     OR jsonb_typeof(NEW.source->'trace') IS DISTINCT FROM 'object'
     OR NEW.source->'trace'->>'kind' IS DISTINCT FROM 'tentative'
     OR COALESCE(NEW.source->'trace'->>'ref', '') = ''
  THEN
    RAISE EXCEPTION
      'La provenance de l''observation % ne désigne pas une tentative exacte.', NEW.id
      USING ERRCODE = '22023';
  END IF;

  SELECT a.*
  INTO v_tentative
  FROM public.attempts AS a
  WHERE a.user_id = NEW.user_id
    AND a.id = NEW.source->'trace'->>'ref';

  IF NOT FOUND
     OR v_tentative.statut IS DISTINCT FROM 'terminee'
     OR v_tentative.exercise_id IS DISTINCT FROM NEW.source->>'ref'
  THEN
    RAISE EXCEPTION
      'La provenance de l''observation % ne correspond pas à une tentative terminée du même exercice.', NEW.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.verifier_source_observation_exacte()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS observations_source_exacte ON public.observations;
CREATE TRIGGER observations_source_exacte
BEFORE INSERT ON public.observations
FOR EACH ROW
EXECUTE FUNCTION public.verifier_source_observation_exacte();

CREATE OR REPLACE FUNCTION public.verifier_session_exercice_atomique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.genere_automatiquement
     AND EXISTS (
       SELECT 1
       FROM jsonb_array_elements(NEW.activites) AS activites(activite)
       WHERE activite->>'type' = 'exercice'
     )
     AND COALESCE(current_setting('app.cloture_exercice', true), '') <> 'on'
  THEN
    RAISE EXCEPTION
      'Une séance automatique d''exercice doit être écrite par clore_exercice().'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.verifier_session_exercice_atomique()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sessions_exercice_atomique ON public.sessions;
CREATE TRIGGER sessions_exercice_atomique
BEFORE INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.verifier_session_exercice_atomique();

CREATE OR REPLACE FUNCTION public.clore_exercice(
  p_tentative JSONB,
  p_observations JSONB,
  p_seance JSONB,
  p_seance_id_contexte TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tentative public.attempts%ROWTYPE;
  v_id TEXT;
  v_exercice_id TEXT;
  v_statut TEXT;
  v_fin TEXT;
  v_duree INTEGER;
  v_resultat TEXT;
  v_seance_id TEXT;
  v_seance_hote_requise BOOLEAN := false;
  v_seance_creee BOOLEAN := false;
  v_nombre_observations INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_tentative) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_tentative doit être un objet JSON.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_observations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_observations doit être un tableau JSON.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_seance) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_seance doit être un objet JSON.' USING ERRCODE = '22023';
  END IF;

  v_id := p_tentative->>'id';
  v_exercice_id := p_tentative->>'exerciseId';
  v_statut := p_tentative->>'statut';
  v_fin := p_tentative->>'fin';

  IF COALESCE(v_id, '') = ''
     OR COALESCE(v_exercice_id, '') = ''
     OR v_statut NOT IN ('terminee', 'abandonnee')
     OR COALESCE(v_fin, '') = ''
     OR jsonb_typeof(p_tentative->'dureeMin') IS DISTINCT FROM 'number'
     OR (p_tentative->>'dureeMin') !~ '^[0-9]+$'
  THEN
    RAISE EXCEPTION 'Clôture de tentative invalide.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    PERFORM v_fin::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Date de fin de tentative invalide.' USING ERRCODE = '22007';
  END;

  v_duree := (p_tentative->>'dureeMin')::integer;
  IF v_duree < 0 THEN
    RAISE EXCEPTION 'Durée de tentative invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT a.*
  INTO v_tentative
  FROM public.attempts AS a
  WHERE a.user_id = v_uid AND a.id = v_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentative introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_tentative.exercise_id IS DISTINCT FROM v_exercice_id THEN
    RAISE EXCEPTION 'La tentative ne correspond pas à l''exercice.' USING ERRCODE = '23514';
  END IF;

  IF v_tentative.statut <> 'en-cours' THEN
    IF v_tentative.statut = 'abandonnee' AND v_statut = 'abandonnee' THEN
      RETURN jsonb_build_object(
        'appliquee', false,
        'tentativeId', v_id,
        'observations', 0,
        'seanceId', NULL,
        'seanceCreee', false
      );
    END IF;
    RAISE EXCEPTION 'Cette tentative est déjà close.' USING ERRCODE = '23514';
  END IF;

  IF p_tentative ? 'notes'
     AND p_tentative->'notes' <> 'null'::jsonb
     AND jsonb_typeof(p_tentative->'notes') IS DISTINCT FROM 'string'
  THEN
    RAISE EXCEPTION 'Les notes de tentative sont invalides.' USING ERRCODE = '22023';
  END IF;
  IF p_tentative ? 'verdictTuteur'
     AND p_tentative->'verdictTuteur' <> 'null'::jsonb
     AND jsonb_typeof(p_tentative->'verdictTuteur') IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Le verdict du tuteur est invalide.' USING ERRCODE = '22023';
  END IF;

  IF p_tentative ? 'seanceHoteRequise' THEN
    IF jsonb_typeof(p_tentative->'seanceHoteRequise') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Le marqueur de séance hôte est invalide.' USING ERRCODE = '22023';
    END IF;
    v_seance_hote_requise := (p_tentative->>'seanceHoteRequise')::boolean;
  END IF;

  IF v_statut = 'terminee' THEN
    v_resultat := p_tentative->>'resultat';
    IF v_resultat NOT IN ('reussi', 'partiel', 'echec')
       OR jsonb_typeof(p_tentative->'evaluation') IS DISTINCT FROM 'object'
       OR jsonb_array_length(p_observations) = 0
    THEN
      RAISE EXCEPTION 'Une tentative terminée exige un résultat, une évaluation et des observations.'
        USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_each(p_tentative->'evaluation') AS dimension(cle, valeur)
      WHERE cle NOT IN ('comprehension', 'application', 'transfert', 'integration', 'justification')
         OR jsonb_typeof(valeur) <> 'number'
         OR (valeur #>> '{}')::numeric < 0
         OR (valeur #>> '{}')::numeric > 1
    ) THEN
      RAISE EXCEPTION 'Une dimension de l''évaluation est invalide.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_observations) AS observations(observation)
      WHERE jsonb_typeof(observation) <> 'object'
         OR COALESCE(observation->>'id', '') = ''
         OR COALESCE(observation->>'skillCode', '') = ''
         OR observation->>'date' IS DISTINCT FROM v_fin
         OR observation->>'type' NOT IN (
              'exercice', 'explication', 'code', 'calcul', 'projet',
              'correction-erreur', 'transfert', 'etude-de-cas'
            )
         OR observation->>'niveauObservation' NOT IN ('A', 'B')
         OR observation->>'autonomie' NOT IN ('A0', 'A1', 'A2', 'A3', 'A4')
         OR observation->>'qualite' NOT IN ('faible', 'moyenne', 'forte')
         OR observation->>'resultat' IS DISTINCT FROM v_resultat
         OR COALESCE(observation->>'contexte', '') = ''
         OR jsonb_typeof(observation->'dimensions') IS DISTINCT FROM 'object'
         OR observation->'dimensions' IS DISTINCT FROM p_tentative->'evaluation'
         OR jsonb_typeof(observation->'source') IS DISTINCT FROM 'object'
         OR observation->'source'->>'kind' IS DISTINCT FROM 'exercice'
         OR observation->'source'->>'ref' IS DISTINCT FROM v_exercice_id
         OR (
              observation ? 'competencesCombinees'
              AND jsonb_typeof(observation->'competencesCombinees') IS DISTINCT FROM 'array'
            )
         OR (
              observation ? 'commentaire'
              AND observation->'commentaire' <> 'null'::jsonb
              AND jsonb_typeof(observation->'commentaire') IS DISTINCT FROM 'string'
            )
    ) THEN
      RAISE EXCEPTION 'Une observation obligatoire est invalide.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_observations) AS observations(observation),
           LATERAL jsonb_each(observation->'dimensions') AS dimension(cle, valeur)
      WHERE cle NOT IN ('comprehension', 'application', 'transfert', 'integration', 'justification')
         OR jsonb_typeof(valeur) <> 'number'
         OR (valeur #>> '{}')::numeric < 0
         OR (valeur #>> '{}')::numeric > 1
    ) THEN
      RAISE EXCEPTION 'Une dimension d''observation est invalide.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_observations) AS observations(observation)
      WHERE observation ? 'competencesCombinees'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(observation->'competencesCombinees') AS codes(code)
          WHERE jsonb_typeof(code) <> 'string' OR COALESCE(code #>> '{}', '') = ''
        )
    ) THEN
      RAISE EXCEPTION 'Une compétence combinée est invalide.' USING ERRCODE = '22023';
    END IF;

    IF (
      SELECT count(*)
      FROM jsonb_array_elements(p_observations) AS observations(observation)
    ) <> (
      SELECT count(DISTINCT observation->>'skillCode')
      FROM jsonb_array_elements(p_observations) AS observations(observation)
    ) THEN
      RAISE EXCEPTION 'Une compétence ne peut recevoir deux observations dans la même clôture.'
        USING ERRCODE = '23505';
    END IF;
  ELSE
    IF jsonb_array_length(p_observations) <> 0 THEN
      RAISE EXCEPTION 'Une tentative abandonnée ne produit aucune observation.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF COALESCE(p_seance->>'id', '') = ''
     OR p_seance->>'date' IS DISTINCT FROM v_fin
     OR jsonb_typeof(p_seance->'dureeMin') IS DISTINCT FROM 'number'
     OR (p_seance->>'dureeMin') !~ '^[0-9]+$'
     OR (p_seance->>'dureeMin')::integer IS DISTINCT FROM v_duree
     OR jsonb_typeof(p_seance->'domaines') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_seance->'skillCodes') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_seance->'activites') IS DISTINCT FROM 'array'
     OR p_seance->'genereAutomatiquement' IS DISTINCT FROM 'true'::jsonb
  THEN
    RAISE EXCEPTION 'La séance de journal est invalide.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_seance->'activites') AS activites(activite)
    WHERE activite->>'type' = 'exercice'
      AND activite->>'ref' = v_exercice_id
      AND COALESCE(activite->>'libelle', '') <> ''
  ) THEN
    RAISE EXCEPTION 'La séance ne journalise pas l''exercice clos.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_seance->'domaines') AS domaines(domaine)
    WHERE jsonb_typeof(domaine) <> 'string' OR COALESCE(domaine #>> '{}', '') = ''
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_seance->'skillCodes') AS codes(code)
    WHERE jsonb_typeof(code) <> 'string' OR COALESCE(code #>> '{}', '') = ''
  ) THEN
    RAISE EXCEPTION 'Les rattachements de la séance sont invalides.' USING ERRCODE = '22023';
  END IF;

  IF v_statut = 'terminee' AND (
    jsonb_array_length(p_observations) <> jsonb_array_length(p_seance->'skillCodes')
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_seance->'skillCodes') AS codes(code)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_observations) AS observations(observation)
        WHERE observation->>'skillCode' = code
      )
    )
  ) THEN
    RAISE EXCEPTION 'Les observations obligatoires ne couvrent pas toutes les compétences de la séance.'
      USING ERRCODE = '23514';
  END IF;

  IF v_seance_hote_requise THEN
    IF COALESCE(p_seance_id_contexte, '') = '' THEN
      RAISE EXCEPTION 'La séance hôte explicite est requise.' USING ERRCODE = '22023';
    END IF;

    SELECT s.id
    INTO v_seance_id
    FROM public.sessions AS s
    WHERE s.user_id = v_uid
      AND s.id = p_seance_id_contexte
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.activites) AS activites(activite)
        WHERE activite->>'type' = 'exercice'
          AND activite->>'ref' = v_exercice_id
      )
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La séance hôte explicite est introuvable ou incohérente.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT s.id
    INTO v_seance_id
    FROM public.sessions AS s
    WHERE s.user_id = v_uid
      AND s.statut = 'en-cours'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.activites) AS activites(activite)
        WHERE activite->>'type' = 'exercice'
          AND activite->>'ref' = v_exercice_id
      )
    ORDER BY (s.id = p_seance_id_contexte) DESC, s.date DESC, s.id DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  PERFORM set_config('app.cloture_exercice', 'on', true);

  UPDATE public.attempts
  SET fin = v_fin,
      duree_min = v_duree,
      evaluation = CASE
        WHEN v_statut = 'terminee' THEN p_tentative->'evaluation'
        ELSE evaluation
      END,
      resultat = CASE
        WHEN v_statut = 'terminee' THEN v_resultat
        ELSE resultat
      END,
      statut = v_statut,
      notes = CASE
        WHEN p_tentative ? 'notes' THEN p_tentative->>'notes'
        ELSE notes
      END,
      verdict_tuteur = CASE
        WHEN p_tentative ? 'verdictTuteur' THEN p_tentative->'verdictTuteur'
        ELSE verdict_tuteur
      END
  WHERE user_id = v_uid AND id = v_id;

  IF v_statut = 'terminee' THEN
    INSERT INTO public.observations (
      id, user_id, skill_code, date, type, niveau_observation, autonomie,
      qualite, resultat, contexte, dimensions, competences_combinees, source,
      commentaire
    )
    SELECT
      observation->>'id',
      v_uid,
      observation->>'skillCode',
      observation->>'date',
      observation->>'type',
      observation->>'niveauObservation',
      observation->>'autonomie',
      observation->>'qualite',
      observation->>'resultat',
      observation->>'contexte',
      observation->'dimensions',
      CASE
        WHEN observation ? 'competencesCombinees'
        THEN ARRAY(
          SELECT jsonb_array_elements_text(observation->'competencesCombinees')
        )
        ELSE NULL
      END,
      jsonb_set(
        observation->'source',
        '{trace}',
        jsonb_build_object('kind', 'tentative', 'ref', v_id),
        true
      ),
      observation->>'commentaire'
    FROM jsonb_array_elements(p_observations) AS observations(observation);

    GET DIAGNOSTICS v_nombre_observations = ROW_COUNT;
  END IF;

  IF v_seance_id IS NULL THEN
    v_seance_id := p_seance->>'id';
    INSERT INTO public.sessions (
      id, user_id, date, duree_min, domaines, skill_codes, activites,
      resultat, difficulte, apprentissage_principal, prochaine_action,
      note_personnelle, genere_automatiquement, statut, planifiee_pour,
      besoin_declare, blueprint
    ) VALUES (
      v_seance_id,
      v_uid,
      p_seance->>'date',
      (p_seance->>'dureeMin')::integer,
      ARRAY(SELECT jsonb_array_elements_text(p_seance->'domaines')),
      ARRAY(SELECT jsonb_array_elements_text(p_seance->'skillCodes')),
      p_seance->'activites',
      p_seance->>'resultat',
      p_seance->>'difficulte',
      p_seance->>'apprentissagePrincipal',
      p_seance->>'prochaineAction',
      p_seance->>'notePersonnelle',
      true,
      p_seance->>'statut',
      p_seance->>'planifieePour',
      p_seance->'besoinDeclare',
      p_seance->'blueprint'
    );
    v_seance_creee := true;
  END IF;

  RETURN jsonb_build_object(
    'appliquee', true,
    'tentativeId', v_id,
    'observations', v_nombre_observations,
    'seanceId', v_seance_id,
    'seanceCreee', v_seance_creee
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clore_exercice(JSONB, JSONB, JSONB, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clore_exercice(JSONB, JSONB, JSONB, TEXT)
  TO authenticated;

-- --------------------------------------------------------------------
-- 8ter. Chargement groupé — toutes les données du compte en un aller-retour
--
-- Les requêtes parallèles coûtaient ~750 ms de latence cumulée ; cette
-- RPC les ramène à un seul aller-retour. `chargerToutRPC` (lib/store/db.ts)
-- l'appelle et se replie sur les lectures séparées seulement si elle est
-- absente. Une charge présente mais invalide est refusée explicitement.
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
    'observations',    COALESCE((SELECT json_agg(row_to_json(e)) FROM observations e WHERE e.user_id = uid), '[]'::json),
    'exercises',   COALESCE((SELECT json_agg(row_to_json(x)) FROM exercises x WHERE x.user_id = uid), '[]'::json),
    'attempts',    COALESCE((SELECT json_agg(row_to_json(a)) FROM attempts a WHERE a.user_id = uid), '[]'::json),
    'sessions',    COALESCE((SELECT json_agg(row_to_json(s)) FROM sessions s WHERE s.user_id = uid), '[]'::json),
    'refus_recommandations',
                   COALESCE((SELECT json_agg(row_to_json(r)) FROM refus_recommandations r WHERE r.user_id = uid), '[]'::json),
    'domaines',    COALESCE((SELECT json_agg(row_to_json(d)) FROM domaines d WHERE d.user_id = uid), '[]'::json),
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json),
    'competence_domaines',
                   COALESCE((SELECT json_agg(row_to_json(cd)) FROM competence_domaines cd WHERE cd.user_id = uid), '[]'::json),
    'themes',      COALESCE((SELECT json_agg(row_to_json(t)) FROM themes t WHERE t.user_id = uid), '[]'::json),
    'moteur_reglages',
                   COALESCE((SELECT json_agg(row_to_json(m)) FROM (SELECT * FROM public.moteur_reglages WHERE user_id = uid ORDER BY applique_le ASC) m), '[]'::json)
  ) INTO resultat;

  RETURN resultat;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charger_tout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charger_tout() TO authenticated;

-- --------------------------------------------------------------------
-- 9. Rôle applicatif et accès (ADR-074)
--
-- `comptes_acces` porte deux notions liées : ce qu'un compte administre, et
-- s'il peut encore entrer. La suspension n'est pas un état d'interface — elle
-- est lue par `public.compte_actif()`, que **toutes** les politiques des
-- tables métier ci-dessus appellent en plus de leur clause d'isolation. Un
-- compte suspendu ne lit donc aucune ligne, quel que soit son chemin d'accès,
-- et son jeton fût-il encore valide.
--
-- La migration 20260816112000 pose cette clause en relisant chaque politique
-- depuis `pg_policies` et en la recréant avec `AND public.compte_actif()`.
-- Toute politique ajoutée après coup à une table métier doit la porter aussi :
-- une politique qui l'oublie rouvre la lecture aux comptes suspendus.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.comptes_acces (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('membre', 'admin')),
  suspendu_le TIMESTAMPTZ,
  suspendu_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motif TEXT CHECK (motif IS NULL OR btrim(motif) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une ligne d'accès naît avec le compte. Trigger distinct de `handle_new_user` :
-- l'échec de l'un ne doit pas emporter l'autre.
CREATE OR REPLACE FUNCTION public.handle_new_user_acces()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.comptes_acces (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_acces() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_acces ON auth.users;
CREATE TRIGGER on_auth_user_created_acces
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_acces();

DROP TRIGGER IF EXISTS comptes_acces_touch ON public.comptes_acces;
CREATE TRIGGER comptes_acces_touch
  BEFORE UPDATE ON public.comptes_acces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SECURITY DEFINER : appelées depuis les politiques de `comptes_acces`
-- elle-même, des fonctions soumises à RLS produiraient une récursion.
CREATE OR REPLACE FUNCTION public.est_admin(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.comptes_acces a
                 WHERE a.user_id = p_uid AND a.role = 'admin' AND a.suspendu_le IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.compte_actif(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.comptes_acces a
                 WHERE a.user_id = p_uid AND a.suspendu_le IS NULL);
$$;

REVOKE ALL ON FUNCTION public.est_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.compte_actif(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compte_actif(UUID) TO authenticated;

-- Deux interdits tenus en base, et non par l'écran : se couper soi-même
-- l'accès, et rétrograder ou suspendre un administrateur.
CREATE OR REPLACE FUNCTION public.garde_comptes_acces()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.user_id = auth.uid()
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR (NEW.suspendu_le IS NOT NULL AND OLD.suspendu_le IS NULL)) THEN
    RAISE EXCEPTION 'Un administrateur ne peut pas modifier son propre accès.' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NOT NULL AND OLD.role = 'admin'
     AND (NEW.role <> 'admin' OR (NEW.suspendu_le IS NOT NULL AND OLD.suspendu_le IS NULL)) THEN
    RAISE EXCEPTION 'Un administrateur ne peut pas être rétrogradé ou suspendu depuis l''application.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comptes_acces_garde ON public.comptes_acces;
CREATE TRIGGER comptes_acces_garde
  BEFORE UPDATE ON public.comptes_acces
  FOR EACH ROW EXECUTE FUNCTION public.garde_comptes_acces();

ALTER TABLE public.comptes_acces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acces_lecture_soi_ou_admin" ON public.comptes_acces;
CREATE POLICY "acces_lecture_soi_ou_admin" ON public.comptes_acces
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.est_admin());

DROP POLICY IF EXISTS "acces_commande_admin" ON public.comptes_acces;
CREATE POLICY "acces_commande_admin" ON public.comptes_acces
  FOR UPDATE TO authenticated
  USING (public.est_admin()) WITH CHECK (public.est_admin());

REVOKE ALL ON TABLE public.comptes_acces FROM anon;
GRANT SELECT, UPDATE ON TABLE public.comptes_acces TO authenticated;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.comptes_acces FROM authenticated;

-- Un administrateur lit l'identité des comptes, jamais leur travail (P8).
-- La politique de lecture unifiée (soi ou admin) est portée par "profil_lecture" sur public.profiles.
DROP POLICY IF EXISTS "profil_admin_lecture" ON public.profiles;

-- Ce que le panel affiche : identité, accès, et des compteurs. Aucun contenu.
CREATE OR REPLACE FUNCTION public.admin_comptes()
RETURNS TABLE (
  user_id UUID, email TEXT, prenom TEXT, role TEXT,
  suspendu_le TIMESTAMPTZ, motif TEXT, cree_le TIMESTAMPTZ,
  observations BIGINT, exercices BIGINT, seances BIGINT, competences BIGINT,
  derniere_activite TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.est_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.user_id, p.email, p.prenom, a.role, a.suspendu_le, a.motif, a.created_at,
    (SELECT COUNT(*) FROM public.observations e WHERE e.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.exercises x WHERE x.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.sessions s WHERE s.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.competences c WHERE c.user_id = a.user_id),
    GREATEST(
      (SELECT MAX(e.created_at) FROM public.observations e WHERE e.user_id = a.user_id),
      (SELECT MAX(t.created_at) FROM public.attempts t WHERE t.user_id = a.user_id),
      (SELECT MAX(s.created_at) FROM public.sessions s WHERE s.user_id = a.user_id))
  FROM public.comptes_acces a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_comptes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_comptes() TO authenticated;


-- --------------------------------------------------------------------
-- 10. Journal du moteur — décisions et prédictions (ADR-084)
--
-- Deux tables append-only, HORS de `Collections` et hors de `charger_tout` :
-- le chemin chaud des pages n'a aucune raison de les lire. Seule
-- l'auto-évaluation le fait, dans `/admin`.
--
-- Posées le 18/08/2026 par `migrations/20260818120000_journal_moteur.sql`,
-- reprise ici à l'identique — ce fichier reste le schéma de référence.
-- --------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 10.1. Le refus de mutation — deux verrous plutôt qu'un
--
-- Aucune politique UPDATE/DELETE n'est posée plus bas, ce qui suffirait pour
-- un client `authenticated`. Le trigger existe pour ce que RLS ne couvre
-- pas : une connexion `service_role`, un script de maintenance, une console.
-- Un journal qui se réécrit ne vaut rien — c'est le même raisonnement que
-- pour `referentiel_changes` (ADR-065), dont ce déclencheur est le calque.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refuser_mutation_journal_moteur()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  -- L'immutabilité vaut pendant la vie du compte. La suppression explicite du
  -- compte doit néanmoins pouvoir cascader ses données personnelles.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Le journal du moteur est append-only';
END;
$fn$;

-- ---------------------------------------------------------------------
-- 10.2. Les décisions
--
-- Une ligne par action RÉELLEMENT présentée. `request_id` porte
-- l'idempotence : la clé applicative est (compte, cible, politique, jour),
-- si bien qu'un rafraîchissement de page ne crée pas de ligne et qu'un
-- compte actif produit quelques lignes par jour, pas quelques milliers.
--
-- Pas de colonne `status`. L'analyse qui a lancé ce chantier confondait sous
-- ce mot trois choses distinctes — la livraison, la réponse de la personne,
-- l'exécution. Ce qu'il advient d'une décision se LIT dans les faits qui la
-- suivent : une tentative sur l'exercice ciblé, un refus dans
-- `refus_recommandations`, ou rien. Une colonne mutable aurait de toute façon
-- contredit l'append-only.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moteur_decisions (
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id                UUID NOT NULL DEFAULT gen_random_uuid(),
  request_id        TEXT NOT NULL,
  prise_le          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type              TEXT NOT NULL CHECK (type IN (
                      'recommandation', 'composition-seance', 'revision-due', 'calibration')),
  politique_version TEXT NOT NULL CHECK (length(btrim(politique_version)) > 0),
  -- Volontairement SANS clé étrangère vers `competences`.
  --
  -- Une décision est un fait historique : elle doit rester lisible quand la
  -- compétence visée a été supprimée depuis (ADR-027 l'autorise tant qu'aucune
  -- observation n'existe). Même précédent que `themes.codes` et
  -- `competences.prerequis`, qui n'en portent pas pour cette raison exacte.
  cible_code        TEXT,
  -- Exercice ou séance visés. NULL = la décision portait sur la compétence
  -- seule, cas normal quand aucun exercice n'existe pour elle.
  cible_ref         TEXT,
  -- `Facteur[]` tel que `recommend.ts` le produit — libellé, contribution,
  -- phrase. C'est le « Pourquoi ? » de P3, figé au moment où il a été montré.
  facteurs          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Empreinte de l'état lu : niveau, confiance, robustesse, nombre d'observations,
  -- jours depuis la dernière. Pas l'état entier — ce qu'il faut pour rejouer
  -- la décision et comprendre ce qu'elle voyait.
  etat_entree       JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id)
);

-- ---------------------------------------------------------------------
-- 10.3. Les prédictions
--
-- Aucune colonne de résolution, aucune table de résultats : la résolution est
-- DÉRIVÉE en joignant la prédiction au fait qui la tranche.
--
--   reussite  → 1re tentative terminée sur `cible_ref` après `emise_le`
--   duree     → la même tentative, colonne `duree_min` (42 lignes existent déjà)
--   retention → 1re observation sur `cible_code` après `horizon_le`
--
-- C'est la différence de fond avec le modèle qui a inspiré ce chantier :
-- stocker les résultats aurait dupliqué `attempts` et `observations`, et créé une
-- seconde vérité à synchroniser. Une prédiction sans fait résolvant reste EN
-- ATTENTE, jamais comptée comme un échec (P2).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moteur_predictions (
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id             UUID NOT NULL DEFAULT gen_random_uuid(),
  request_id     TEXT NOT NULL,
  emise_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type           TEXT NOT NULL CHECK (type IN ('reussite', 'duree', 'retention')),
  -- Sans clé étrangère, même raison que `moteur_decisions.cible_code`.
  cible_code     TEXT NOT NULL,
  -- L'exercice sur lequel porte la prédiction. NULL pour 'retention', qui
  -- porte sur la compétence et non sur un support.
  cible_ref      TEXT,
  -- p(réussite) et p(niveau tenu) dans [0,1] ; minutes attendues pour 'duree'.
  -- La borne haute n'est pas contrainte ici : une durée n'a pas de maximum, et
  -- un CHECK conditionnel au type serait un garde-fou déplacé — c'est
  -- `prediction.ts` qui construit ces valeurs, et lui seul.
  valeur         DOUBLE PRECISION NOT NULL CHECK (valeur >= 0),
  -- La date à laquelle la prédiction devient vérifiable. Renseignée pour
  -- 'retention' (la date due), absente pour les deux autres, qui se résolvent
  -- à la première tentative.
  horizon_le     TIMESTAMPTZ,
  modele_version TEXT NOT NULL CHECK (length(btrim(modele_version)) > 0),
  -- Les valeurs lues qui ont produit la prédiction (P3 — aucune valeur sans sa
  -- source). Sans elles, une prédiction fausse ne s'explique pas.
  entrees        JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_id    UUID,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, request_id),
  -- Une décision n'est jamais supprimée : la clé étrangère est sûre. NULL est
  -- admis (MATCH SIMPLE) pour une prédiction émise hors décision.
  FOREIGN KEY (user_id, decision_id)
    REFERENCES public.moteur_decisions(user_id, id)
);

-- ---------------------------------------------------------------------
-- 10.4. Append-only
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS moteur_decisions_append_only ON public.moteur_decisions;
CREATE TRIGGER moteur_decisions_append_only
  BEFORE UPDATE OR DELETE ON public.moteur_decisions
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_journal_moteur();

DROP TRIGGER IF EXISTS moteur_predictions_append_only ON public.moteur_predictions;
CREATE TRIGGER moteur_predictions_append_only
  BEFORE UPDATE OR DELETE ON public.moteur_predictions
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_journal_moteur();

-- ---------------------------------------------------------------------
-- 10.5. RLS — isolation par compte ET compte actif (ADR-074)
--
-- `compte_actif()` en plus de l'isolation : sans elle, un compte suspendu lit
-- à nouveau. C'est la règle que CLAUDE.md impose à toute table métier, et
-- l'état réel des politiques en service la respecte partout.
--
-- Aucune politique UPDATE ni DELETE : leur absence les interdit.
-- ---------------------------------------------------------------------
ALTER TABLE public.moteur_decisions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moteur_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moteur_decisions_lecture_compte" ON public.moteur_decisions;
CREATE POLICY "moteur_decisions_lecture_compte" ON public.moteur_decisions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND public.compte_actif());

DROP POLICY IF EXISTS "moteur_decisions_ecriture_compte" ON public.moteur_decisions;
CREATE POLICY "moteur_decisions_ecriture_compte" ON public.moteur_decisions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.compte_actif());

DROP POLICY IF EXISTS "moteur_predictions_lecture_compte" ON public.moteur_predictions;
CREATE POLICY "moteur_predictions_lecture_compte" ON public.moteur_predictions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND public.compte_actif());

DROP POLICY IF EXISTS "moteur_predictions_ecriture_compte" ON public.moteur_predictions;
CREATE POLICY "moteur_predictions_ecriture_compte" ON public.moteur_predictions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.compte_actif());

REVOKE ALL ON TABLE public.moteur_decisions, public.moteur_predictions FROM anon;
GRANT SELECT, INSERT ON TABLE public.moteur_decisions, public.moteur_predictions TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.moteur_decisions, public.moteur_predictions FROM authenticated;

-- ---------------------------------------------------------------------
-- 10.6. Index — les lectures réelles
--
-- L'auto-évaluation balaie les prédictions d'un compte par type et par date ;
-- la résolution cherche celles qui portent sur un exercice donné.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS moteur_decisions_user_prise_idx
  ON public.moteur_decisions (user_id, prise_le DESC);
CREATE INDEX IF NOT EXISTS moteur_predictions_user_type_emise_idx
  ON public.moteur_predictions (user_id, type, emise_le DESC);
CREATE INDEX IF NOT EXISTS moteur_predictions_user_cible_idx
  ON public.moteur_predictions (user_id, cible_ref, emise_le);


-- --------------------------------------------------------------------
-- 11. Journal des reglages du moteur (ADR-085)
--
-- La contrepartie de l'auto-correction : chaque ligne porte LA MESURE qui a
-- justifie le changement, et son effectif. Le rejeu depuis les valeurs par
-- defaut du code reconstitue n'importe quel etat passe.
--
-- Posee le 18/08/2026 par `migrations/20260818140000_journal_reglages.sql`,
-- reprise ici a l'identique.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.moteur_reglages (
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  applique_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Le nom du paramètre, pas sa valeur par défaut : celle-ci vit dans le code
  -- (`lib/engine/reglages.ts` la relit), et un journal qui la recopierait
  -- divergerait au premier changement de version.
  parametre       TEXT NOT NULL CHECK (length(btrim(parametre)) > 0),
  valeur_avant    DOUBLE PRECISION NOT NULL,
  valeur_apres    DOUBLE PRECISION NOT NULL,
  -- La mesure qui justifie. Sans elle, la ligne serait un changement arbitraire
  -- consigné — c'est-à-dire exactement ce que l'invariant interdit.
  metrique        TEXT NOT NULL CHECK (length(btrim(metrique)) > 0),
  n               INTEGER NOT NULL CHECK (n >= 0),
  valeur_metrique DOUBLE PRECISION NOT NULL,
  motif           TEXT NOT NULL CHECK (length(btrim(motif)) > 0),
  PRIMARY KEY (user_id, id),
  -- Un pas doit changer quelque chose ; une ligne sans effet encombrerait le
  -- rejeu sans rien reconstituer.
  CONSTRAINT moteur_reglages_pas_effectif CHECK (valeur_avant <> valeur_apres)
);

DROP TRIGGER IF EXISTS moteur_reglages_append_only ON public.moteur_reglages;
CREATE TRIGGER moteur_reglages_append_only
  BEFORE UPDATE OR DELETE ON public.moteur_reglages
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_journal_moteur();

ALTER TABLE public.moteur_reglages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moteur_reglages_lecture_compte" ON public.moteur_reglages;
CREATE POLICY "moteur_reglages_lecture_compte" ON public.moteur_reglages
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND public.compte_actif());

DROP POLICY IF EXISTS "moteur_reglages_ecriture_compte" ON public.moteur_reglages;
CREATE POLICY "moteur_reglages_ecriture_compte" ON public.moteur_reglages
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.compte_actif());

REVOKE ALL ON TABLE public.moteur_reglages FROM anon;
GRANT SELECT, INSERT ON TABLE public.moteur_reglages TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.moteur_reglages FROM authenticated;

-- Le rejeu lit tout le journal d'un compte, dans l'ordre.
CREATE INDEX IF NOT EXISTS moteur_reglages_user_applique_idx
  ON public.moteur_reglages (user_id, applique_le);


-- --------------------------------------------------------------------
-- 12. Succession d'une competence, un vers plusieurs (ADR-087)
--
-- `remplace_par` est mono-value et compte zero ligne : il ne peut pas dire
-- qu'une competence en devient quatre, ce que produit une atomisation.
-- Une observation ne bouge JAMAIS : la scission est seche.
--
-- Posee le 18/08/2026 par `migrations/20260818160000_competence_succession.sql`.
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.competence_succession (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ancien_code  TEXT NOT NULL,
  nouveau_code TEXT NOT NULL,
  -- Pourquoi la scission. Sans motif, relire une succession ancienne
  -- demanderait de deviner ce qui l'avait décidée (P3).
  motif        TEXT NOT NULL CHECK (length(btrim(motif)) > 0),
  cree_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, ancien_code, nouveau_code),
  -- Les deux clés étrangères sont réelles : contrairement à une décision du
  -- moteur, une succession ne doit pas survivre à la disparition de ses deux
  -- bouts. Une compétence qui porte une succession porte des observations, donc
  -- s'archive et ne se supprime pas (ADR-027) — la contrainte est tenable.
  FOREIGN KEY (user_id, ancien_code)  REFERENCES public.competences(user_id, code),
  FOREIGN KEY (user_id, nouveau_code) REFERENCES public.competences(user_id, code),
  CONSTRAINT competence_succession_distincts CHECK (ancien_code <> nouveau_code)
);

-- Append-only : une succession est un fait daté, elle ne se réécrit pas.
-- Réutilise le déclencheur du journal du moteur (ADR-084) — même règle, même
-- implémentation, y compris la cascade à la suppression du compte.
DROP TRIGGER IF EXISTS competence_succession_append_only ON public.competence_succession;
CREATE TRIGGER competence_succession_append_only
  BEFORE UPDATE OR DELETE ON public.competence_succession
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_journal_moteur();

ALTER TABLE public.competence_succession ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "succession_lecture_compte" ON public.competence_succession;
CREATE POLICY "succession_lecture_compte" ON public.competence_succession
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id AND public.compte_actif());

-- L'écriture passe par une commande du référentiel, comme tout le reste :
-- `app.referentiel_command` est le drapeau posé par `executerCommande`
-- (ADR-065). Sans lui, une scission pourrait s'écrire hors transaction, sans
-- entrée au journal `referentiel_changes`.
DROP POLICY IF EXISTS "succession_commande_compte" ON public.competence_succession;
CREATE POLICY "succession_commande_compte" ON public.competence_succession
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND public.compte_actif()
    AND (select current_setting('app.referentiel_command', true)) = 'on'
  );

REVOKE ALL ON TABLE public.competence_succession FROM anon;
GRANT SELECT, INSERT ON TABLE public.competence_succession TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.competence_succession FROM authenticated;

-- « Qu'est devenue LOG-01 ? » et « d'où vient LOG-20 ? » : les deux sens.
CREATE INDEX IF NOT EXISTS competence_succession_ancien_idx
  ON public.competence_succession (user_id, ancien_code);
CREATE INDEX IF NOT EXISTS competence_succession_nouveau_idx
  ON public.competence_succession (user_id, nouveau_code);

-- --------------------------------------------------------------------
-- 13. Twiny lot 3 — carte globale minimale et selections privees
--
-- Repris a l'identique depuis la migration additive du lot 3.
-- --------------------------------------------------------------------

-- Twiny lot 3 : noyau minimal de carte globale et overlay prive.
--
-- La migration est strictement additive : aucun domaine, competence, theme,
-- document ou fait prive existant n'est copie ou rapproche automatiquement.
-- La carte globale nait vide. L'overlay ne stocke qu'une selection personnelle
-- vers un element global ; le referentiel prive et le moteur restent inchanges.

-- ---------------------------------------------------------------------------
-- 1. Provenance partagee par toutes les frontieres de publication
-- ---------------------------------------------------------------------------

create or replace function public.provenance_carte_globale_valide(p_provenance jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    jsonb_typeof(p_provenance) = 'object'
    and jsonb_typeof(p_provenance -> 'type') = 'string'
    and btrim(p_provenance ->> 'type') <> ''
    and length(p_provenance ->> 'type') <= 100
    and jsonb_typeof(p_provenance -> 'reference') = 'string'
    and btrim(p_provenance ->> 'reference') <> ''
    and length(p_provenance ->> 'reference') <= 1000
    and (
      not (p_provenance ? 'note')
      or (
        jsonb_typeof(p_provenance -> 'note') = 'string'
        and btrim(p_provenance ->> 'note') <> ''
        and length(p_provenance ->> 'note') <= 2000
      )
    )
    and (p_provenance - array['type', 'reference', 'note']) = '{}'::jsonb;
$$;

revoke all on function public.provenance_carte_globale_valide(jsonb)
  from public, anon;
grant execute on function public.provenance_carte_globale_valide(jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Role de gouvernance distinct des administrateurs de comptes
-- ---------------------------------------------------------------------------

create table if not exists public.carte_globale_curateurs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  nomme_le timestamptz not null default now()
);

comment on table public.carte_globale_curateurs is
  'Habilitation de publication de la carte globale. Aucun compte n est promu automatiquement.';

-- ---------------------------------------------------------------------------
-- 3. Faits globaux publies : elements et relations explicites
-- ---------------------------------------------------------------------------

create table if not exists public.carte_globale_elements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('domaine', 'connaissance', 'competence')),
  nom text not null check (btrim(nom) <> '' and length(nom) <= 200),
  description text not null default '' check (length(description) <= 4000),
  statut text not null default 'publie' check (statut in ('publie', 'retire')),
  provenance jsonb not null check (public.provenance_carte_globale_valide(provenance)),
  version integer not null default 1 check (version > 0),
  valide_par uuid not null references public.profiles(id) on delete restrict,
  valide_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carte_globale_elements_valide_par_idx
  on public.carte_globale_elements (valide_par);
create index if not exists carte_globale_elements_type_nom_idx
  on public.carte_globale_elements (type, nom)
  where statut = 'publie';

create table if not exists public.carte_globale_relations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.carte_globale_elements(id) on delete restrict,
  cible_id uuid not null references public.carte_globale_elements(id) on delete restrict,
  type text not null check (type in ('PART_OF', 'PREREQUISITE_OF', 'RELATED_TO', 'APPLIED_IN', 'ENABLES')),
  statut text not null default 'publie' check (statut in ('publie', 'retire')),
  provenance jsonb not null check (public.provenance_carte_globale_valide(provenance)),
  version integer not null default 1 check (version > 0),
  valide_par uuid not null references public.profiles(id) on delete restrict,
  valide_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carte_globale_relations_cibles_distinctes check (source_id <> cible_id),
  constraint carte_globale_related_to_canonique check (
    type <> 'RELATED_TO' or source_id::text < cible_id::text
  )
);

create index if not exists carte_globale_relations_source_idx
  on public.carte_globale_relations (source_id)
  where statut = 'publie';
create index if not exists carte_globale_relations_cible_idx
  on public.carte_globale_relations (cible_id)
  where statut = 'publie';
create index if not exists carte_globale_relations_valide_par_idx
  on public.carte_globale_relations (valide_par);
create unique index if not exists carte_globale_relations_actives_uidx
  on public.carte_globale_relations (type, source_id, cible_id)
  where statut = 'publie';

-- ---------------------------------------------------------------------------
-- 4. Versionnement auditable : etat courant + snapshots append-only
-- ---------------------------------------------------------------------------

create table if not exists public.carte_globale_changes (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique check (btrim(request_id) <> '' and length(request_id) <= 200),
  action text not null check (
    action in (
      'publier_element', 'corriger_element', 'retirer_element',
      'publier_relation', 'retirer_relation'
    )
  ),
  objet_type text not null check (objet_type in ('element', 'relation')),
  objet_id uuid not null,
  version_avant integer check (version_avant is null or version_avant > 0),
  version_apres integer not null check (version_apres > 0),
  provenance jsonb not null check (public.provenance_carte_globale_valide(provenance)),
  snapshot_avant jsonb,
  snapshot_apres jsonb not null,
  valide_par uuid not null references public.profiles(id) on delete restrict,
  valide_le timestamptz not null default now()
);

create index if not exists carte_globale_changes_objet_idx
  on public.carte_globale_changes (objet_type, objet_id, version_apres);
create index if not exists carte_globale_changes_valide_par_idx
  on public.carte_globale_changes (valide_par);

create or replace function public.refuser_mutation_carte_globale_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Le journal de la carte globale est append-only.' using errcode = '55000';
end;
$$;

drop trigger if exists carte_globale_changes_append_only on public.carte_globale_changes;
create trigger carte_globale_changes_append_only
  before update or delete on public.carte_globale_changes
  for each row execute function public.refuser_mutation_carte_globale_changes();

revoke all on function public.refuser_mutation_carte_globale_changes()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Overlay prive minimal : une selection, jamais une copie
-- ---------------------------------------------------------------------------

create table if not exists public.carte_globale_selections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  element_id uuid not null references public.carte_globale_elements(id) on delete restrict,
  selectionne_le timestamptz not null default now(),
  primary key (user_id, element_id)
);

create index if not exists carte_globale_selections_element_idx
  on public.carte_globale_selections (element_id);

-- Correspondance privée explicitement déclarée entre une compétence locale et
-- un élément global. Elle n'est ni une sélection ni une mesure.
create table if not exists public.carte_globale_correspondances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  competence_code text not null,
  element_global_id uuid not null references public.carte_globale_elements(id) on delete restrict,
  acteur text not null check (acteur in ('personne', 'systeme')),
  provenance jsonb not null check (public.provenance_carte_globale_valide(provenance)),
  rattache_le timestamptz not null default now(),
  primary key (user_id, competence_code, element_global_id),
  foreign key (user_id, competence_code)
    references public.competences(user_id, code) on delete cascade
);

create index if not exists carte_globale_correspondances_element_idx
  on public.carte_globale_correspondances (element_global_id);

-- ---------------------------------------------------------------------------
-- 6. RLS et privileges : global lisible, overlay strictement personnel
-- ---------------------------------------------------------------------------

alter table public.carte_globale_curateurs enable row level security;
alter table public.carte_globale_elements enable row level security;
alter table public.carte_globale_relations enable row level security;
alter table public.carte_globale_changes enable row level security;
alter table public.carte_globale_selections enable row level security;
alter table public.carte_globale_correspondances enable row level security;

drop policy if exists carte_globale_curateur_lecture_soi on public.carte_globale_curateurs;
create policy carte_globale_curateur_lecture_soi
  on public.carte_globale_curateurs
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

drop policy if exists carte_globale_elements_lecture on public.carte_globale_elements;
create policy carte_globale_elements_lecture
  on public.carte_globale_elements
  for select to authenticated
  using (
    (select public.compte_actif())
    and (
      statut = 'publie'
      or exists (
        select 1 from public.carte_globale_curateurs c
        where c.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists carte_globale_elements_commande_insertion on public.carte_globale_elements;
create policy carte_globale_elements_commande_insertion
  on public.carte_globale_elements
  for insert to authenticated
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

drop policy if exists carte_globale_elements_commande_modification on public.carte_globale_elements;
create policy carte_globale_elements_commande_modification
  on public.carte_globale_elements
  for update to authenticated
  using (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  )
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

drop policy if exists carte_globale_relations_lecture on public.carte_globale_relations;
create policy carte_globale_relations_lecture
  on public.carte_globale_relations
  for select to authenticated
  using (
    (select public.compte_actif())
    and (
      statut = 'publie'
      or exists (
        select 1 from public.carte_globale_curateurs c
        where c.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists carte_globale_relations_commande_insertion on public.carte_globale_relations;
create policy carte_globale_relations_commande_insertion
  on public.carte_globale_relations
  for insert to authenticated
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

drop policy if exists carte_globale_relations_commande_modification on public.carte_globale_relations;
create policy carte_globale_relations_commande_modification
  on public.carte_globale_relations
  for update to authenticated
  using (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  )
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

drop policy if exists carte_globale_changes_lecture_curateur on public.carte_globale_changes;
create policy carte_globale_changes_lecture_curateur
  on public.carte_globale_changes
  for select to authenticated
  using (
    (select public.compte_actif())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

drop policy if exists carte_globale_changes_commande_insertion on public.carte_globale_changes;
create policy carte_globale_changes_commande_insertion
  on public.carte_globale_changes
  for insert to authenticated
  with check (
    (select public.compte_actif())
    and (select current_setting('app.carte_globale_command', true)) = 'on'
    and valide_par = (select auth.uid())
    and exists (
      select 1 from public.carte_globale_curateurs c
      where c.user_id = (select auth.uid())
    )
  );

drop policy if exists carte_globale_selections_lecture_compte on public.carte_globale_selections;
create policy carte_globale_selections_lecture_compte
  on public.carte_globale_selections
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

drop policy if exists carte_globale_selections_creation_compte on public.carte_globale_selections;
create policy carte_globale_selections_creation_compte
  on public.carte_globale_selections
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and exists (
      select 1 from public.carte_globale_elements e
      where e.id = element_id and e.statut = 'publie'
    )
  );

drop policy if exists carte_globale_selections_suppression_compte on public.carte_globale_selections;
create policy carte_globale_selections_suppression_compte
  on public.carte_globale_selections
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

drop policy if exists carte_globale_correspondances_lecture_compte on public.carte_globale_correspondances;
create policy carte_globale_correspondances_lecture_compte
  on public.carte_globale_correspondances for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));
drop policy if exists carte_globale_correspondances_creation_compte on public.carte_globale_correspondances;
create policy carte_globale_correspondances_creation_compte
  on public.carte_globale_correspondances for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.compte_actif()));
drop policy if exists carte_globale_correspondances_suppression_compte on public.carte_globale_correspondances;
create policy carte_globale_correspondances_suppression_compte
  on public.carte_globale_correspondances for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));

revoke all on table
  public.carte_globale_curateurs,
  public.carte_globale_elements,
  public.carte_globale_relations,
  public.carte_globale_changes,
  public.carte_globale_selections,
  public.carte_globale_correspondances
from public, anon, authenticated;

grant select on public.carte_globale_curateurs to authenticated;
grant select, insert, update on public.carte_globale_elements to authenticated;
grant select, insert, update on public.carte_globale_relations to authenticated;
grant select, insert on public.carte_globale_changes to authenticated;
grant select, insert, delete on public.carte_globale_selections to authenticated;
grant select, insert, delete on public.carte_globale_correspondances to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Commande unique : validation humaine, provenance et journal atomiques
-- ---------------------------------------------------------------------------

create or replace function public.appliquer_commande_carte_globale(
  p_request_id text,
  p_expected_version integer,
  p_commande jsonb,
  p_provenance jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := p_commande ->> 'type';
  v_objet_type text;
  v_objet_id uuid;
  v_source_id uuid;
  v_cible_id uuid;
  v_relation_type text;
  v_type_element text;
  v_nom text;
  v_description text;
  v_statut text;
  v_version_avant integer;
  v_version_apres integer;
  v_snapshot_avant jsonb;
  v_snapshot_apres jsonb;
  v_action_existante text;
  v_objet_type_existant text;
begin
  if v_uid is null or not public.compte_actif(v_uid) then
    raise exception 'Compte authentifie actif requis.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.carte_globale_curateurs c where c.user_id = v_uid
  ) then
    raise exception 'La publication de la carte globale est reservee aux curateurs.'
      using errcode = '42501';
  end if;

  if p_request_id is null or btrim(p_request_id) = '' or length(p_request_id) > 200 then
    raise exception 'request_id invalide.' using errcode = '22023';
  end if;

  if not public.provenance_carte_globale_valide(p_provenance) then
    raise exception 'Provenance globale invalide.' using errcode = '22023';
  end if;

  select c.action, c.objet_type, c.objet_id, c.version_avant, c.version_apres,
         c.snapshot_avant, c.snapshot_apres
    into v_action_existante, v_objet_type_existant, v_objet_id,
         v_version_avant, v_version_apres, v_snapshot_avant, v_snapshot_apres
  from public.carte_globale_changes c
  where c.request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'action', v_action_existante,
      'objetType', v_objet_type_existant,
      'objet', v_snapshot_apres,
      'rejeu', true
    );
  end if;

  perform set_config('app.carte_globale_command', 'on', true);

  case v_action
    when 'publier_element' then
      if coalesce(p_expected_version, 0) <> 0 then
        raise exception 'Une publication nouvelle attend la version 0.' using errcode = '22023';
      end if;

      v_type_element := p_commande #>> '{element,type}';
      v_nom := btrim(coalesce(p_commande #>> '{element,nom}', ''));
      v_description := btrim(coalesce(p_commande #>> '{element,description}', ''));

      if v_type_element not in ('domaine', 'connaissance', 'competence') then
        raise exception 'Type d element global invalide.' using errcode = '22023';
      end if;
      if v_nom = '' then
        raise exception 'Le nom global est obligatoire.' using errcode = '22023';
      end if;

      insert into public.carte_globale_elements (
        type, nom, description, provenance, valide_par, valide_le
      ) values (
        v_type_element, v_nom, v_description, p_provenance, v_uid, now()
      )
      returning id, version into v_objet_id, v_version_apres;

      select to_jsonb(e) into v_snapshot_apres
      from public.carte_globale_elements e where e.id = v_objet_id;
      v_objet_type := 'element';
      v_version_avant := null;

    when 'corriger_element' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(e), e.version, e.statut
        into v_snapshot_avant, v_version_avant, v_statut
      from public.carte_globale_elements e
      where e.id = v_objet_id
      for update;

      if not found then
        raise exception 'Element global introuvable.' using errcode = 'P0002';
      end if;
      if v_statut <> 'publie' then
        raise exception 'Un element retire ne se corrige pas.' using errcode = '55000';
      end if;
      if p_expected_version is distinct from v_version_avant then
        raise exception 'Version globale obsolete : attendu %, recu %.', v_version_avant, p_expected_version
          using errcode = '40001';
      end if;

      v_nom := btrim(coalesce(p_commande ->> 'nom', ''));
      v_description := btrim(coalesce(p_commande ->> 'description', ''));
      if v_nom = '' then
        raise exception 'Le nom global est obligatoire.' using errcode = '22023';
      end if;

      update public.carte_globale_elements
      set nom = v_nom,
          description = v_description,
          provenance = p_provenance,
          version = version + 1,
          valide_par = v_uid,
          valide_le = now(),
          updated_at = now()
      where id = v_objet_id
      returning version into v_version_apres;

      select to_jsonb(e) into v_snapshot_apres
      from public.carte_globale_elements e where e.id = v_objet_id;
      v_objet_type := 'element';

    when 'retirer_element' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(e), e.version, e.statut
        into v_snapshot_avant, v_version_avant, v_statut
      from public.carte_globale_elements e
      where e.id = v_objet_id
      for update;

      if not found then
        raise exception 'Element global introuvable.' using errcode = 'P0002';
      end if;
      if v_statut <> 'publie' then
        raise exception 'Element global deja retire.' using errcode = '55000';
      end if;
      if p_expected_version is distinct from v_version_avant then
        raise exception 'Version globale obsolete : attendu %, recu %.', v_version_avant, p_expected_version
          using errcode = '40001';
      end if;
      if exists (
        select 1 from public.carte_globale_relations r
        where r.statut = 'publie'
          and (r.source_id = v_objet_id or r.cible_id = v_objet_id)
      ) then
        raise exception 'Retirer d abord les relations globales actives de cet element.'
          using errcode = '23503';
      end if;

      update public.carte_globale_elements
      set statut = 'retire',
          provenance = p_provenance,
          version = version + 1,
          valide_par = v_uid,
          valide_le = now(),
          updated_at = now()
      where id = v_objet_id
      returning version into v_version_apres;

      select to_jsonb(e) into v_snapshot_apres
      from public.carte_globale_elements e where e.id = v_objet_id;
      v_objet_type := 'element';

    when 'publier_relation' then
      if coalesce(p_expected_version, 0) <> 0 then
        raise exception 'Une publication nouvelle attend la version 0.' using errcode = '22023';
      end if;

      v_source_id := nullif(p_commande #>> '{relation,sourceId}', '')::uuid;
      v_cible_id := nullif(p_commande #>> '{relation,cibleId}', '')::uuid;
      v_relation_type := p_commande #>> '{relation,type}';

      if v_relation_type not in ('PART_OF', 'PREREQUISITE_OF', 'RELATED_TO', 'APPLIED_IN', 'ENABLES') then
        raise exception 'Type de relation globale invalide.' using errcode = '22023';
      end if;
      if v_source_id = v_cible_id then
        raise exception 'Une relation globale ne se relie pas a elle-meme.' using errcode = '22023';
      end if;
      if not exists (
        select 1 from public.carte_globale_elements e
        where e.id = v_source_id and e.statut = 'publie'
      ) or not exists (
        select 1 from public.carte_globale_elements e
        where e.id = v_cible_id and e.statut = 'publie'
      ) then
        raise exception 'Les deux cibles globales doivent etre publiees.' using errcode = '23503';
      end if;

      if v_relation_type = 'PART_OF' then
        if not exists (
          select 1 from public.carte_globale_elements e
          where e.id = v_cible_id and e.type = 'domaine' and e.statut = 'publie'
        ) then
          raise exception 'PART_OF vise un domaine global publie.' using errcode = '22023';
        end if;

        if exists (
          with recursive parents(id) as (
            select v_cible_id
            union
            select r.cible_id
            from public.carte_globale_relations r
            join parents p on p.id = r.source_id
            where r.type = 'PART_OF' and r.statut = 'publie'
          )
          select 1 from parents where id = v_source_id
        ) then
          raise exception 'PART_OF creerait un cycle.' using errcode = '23514';
        end if;
      elsif v_relation_type = 'RELATED_TO' then
        v_objet_id := v_source_id;
        v_source_id := v_cible_id;
        v_cible_id := v_objet_id;
      elsif v_relation_type = 'PREREQUISITE_OF' then
        if not exists (
          select 1 from public.carte_globale_elements e
          where e.id = v_source_id and e.type in ('connaissance', 'competence')
        ) or not exists (
          select 1 from public.carte_globale_elements e
          where e.id = v_cible_id and e.type in ('connaissance', 'competence')
        ) then
          raise exception 'PREREQUISITE_OF relie deux connaissances ou competences.' using errcode = '22023';
        end if;
        if exists (
          with recursive reach(id) as (
            select v_cible_id
            union
            select r.cible_id from public.carte_globale_relations r
            join reach x on x.id = r.source_id
            where r.type = 'PREREQUISITE_OF' and r.statut = 'publie'
          ) select 1 from reach where id = v_source_id
        ) then
          raise exception 'PREREQUISITE_OF creerait un cycle.' using errcode = '23514';
        end if;
      elsif v_relation_type = 'APPLIED_IN' then
        if not exists (
          select 1 from public.carte_globale_elements e
          where e.id = v_source_id and e.type in ('connaissance', 'competence')
        ) or not exists (
          select 1 from public.carte_globale_elements e
          where e.id = v_cible_id and e.type in ('domaine', 'connaissance', 'competence')
        ) then
          raise exception 'APPLIED_IN vise un element apprenant vers un contexte.' using errcode = '22023';
        end if;
      elsif v_relation_type = 'ENABLES' then
        if not exists (
          select 1 from public.carte_globale_elements e
          where e.id = v_source_id and e.type in ('connaissance', 'competence')
        ) or not exists (
          select 1 from public.carte_globale_elements e where e.id = v_cible_id
        ) then
          raise exception 'ENABLES vise deux elements globaux.' using errcode = '22023';
        end if;
      end if;

      insert into public.carte_globale_relations (
        source_id, cible_id, type, provenance, valide_par, valide_le
      ) values (
        v_source_id, v_cible_id, v_relation_type, p_provenance, v_uid, now()
      )
      returning id, version into v_objet_id, v_version_apres;

      select to_jsonb(r) into v_snapshot_apres
      from public.carte_globale_relations r where r.id = v_objet_id;
      v_objet_type := 'relation';
      v_version_avant := null;

    when 'retirer_relation' then
      v_objet_id := nullif(p_commande ->> 'id', '')::uuid;
      select to_jsonb(r), r.version, r.statut
        into v_snapshot_avant, v_version_avant, v_statut
      from public.carte_globale_relations r
      where r.id = v_objet_id
      for update;

      if not found then
        raise exception 'Relation globale introuvable.' using errcode = 'P0002';
      end if;
      if v_statut <> 'publie' then
        raise exception 'Relation globale deja retiree.' using errcode = '55000';
      end if;
      if p_expected_version is distinct from v_version_avant then
        raise exception 'Version globale obsolete : attendu %, recu %.', v_version_avant, p_expected_version
          using errcode = '40001';
      end if;

      update public.carte_globale_relations
      set statut = 'retire',
          provenance = p_provenance,
          version = version + 1,
          valide_par = v_uid,
          valide_le = now(),
          updated_at = now()
      where id = v_objet_id
      returning version into v_version_apres;

      select to_jsonb(r) into v_snapshot_apres
      from public.carte_globale_relations r where r.id = v_objet_id;
      v_objet_type := 'relation';

    else
      raise exception 'Commande de carte globale inconnue.' using errcode = '22023';
  end case;

  insert into public.carte_globale_changes (
    request_id, action, objet_type, objet_id,
    version_avant, version_apres, provenance,
    snapshot_avant, snapshot_apres, valide_par, valide_le
  ) values (
    p_request_id, v_action, v_objet_type, v_objet_id,
    v_version_avant, v_version_apres, p_provenance,
    v_snapshot_avant, v_snapshot_apres, v_uid, now()
  );

  return jsonb_build_object(
    'action', v_action,
    'objetType', v_objet_type,
    'objet', v_snapshot_apres,
    'rejeu', false
  );
end;
$$;

revoke all on function public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb)
  from public, anon;
grant execute on function public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb)
  to authenticated;

comment on function public.appliquer_commande_carte_globale(text, integer, jsonb, jsonb) is
  'Publication atomique de la carte globale par un curateur humain : provenance, version et journal obligatoires.';
+

-- --------------------------------------------------------------------
-- 14. Twiny lot 4 — objectifs structurés, événements et parcours privés
--
-- Repris depuis les migrations additives `twiny_lot_4_objectifs_evenements_parcours`
-- et `twiny_lot_4_fk_indexes`. Aucun texte historique n'est migré.
-- --------------------------------------------------------------------

-- Twiny — Lot 4 : objectifs structurés, événements et parcours privés
-- Additif, privé au compte, sans migration des textes historiques.

create or replace function public.provenance_lot4_valide(p_provenance jsonb)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_provenance) = 'object'
    and pg_catalog.jsonb_typeof(p_provenance->'type') = 'string'
    and pg_catalog.length(pg_catalog.btrim(p_provenance->>'type')) between 1 and 100
    and pg_catalog.jsonb_typeof(p_provenance->'reference') = 'string'
    and pg_catalog.length(pg_catalog.btrim(p_provenance->>'reference')) between 1 and 500
    and (
      not (p_provenance ? 'note')
      or p_provenance->'note' is null
      or (
        pg_catalog.jsonb_typeof(p_provenance->'note') = 'string'
        and pg_catalog.length(p_provenance->>'note') <= 1000
      )
    );
$$;

revoke all on function public.provenance_lot4_valide(jsonb) from public, anon;
grant execute on function public.provenance_lot4_valide(jsonb) to authenticated;

create table public.objectifs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  formulation text not null check (btrim(formulation) <> '' and length(formulation) <= 4000),
  cible_type text not null check (cible_type in ('element-global', 'domaine-local', 'competence-locale', 'relation-globale')),
  cible_element_global_id uuid references public.carte_globale_elements(id) on delete restrict,
  cible_domaine_local_id text,
  cible_competence_local_code text,
  cible_relation_globale_id uuid references public.carte_globale_relations(id) on delete restrict,
  priorite integer not null check (priorite between 1 and 5),
  horizon text not null check (horizon in ('court-terme', 'moyen-terme', 'long-terme')),
  echeance_le date,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'actif', 'en-pause', 'atteint', 'abandonne')),
  version integer not null default 1 check (version > 0),
  archive_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint objectifs_cible_domaine_local_fk
    foreign key (user_id, cible_domaine_local_id)
    references public.domaines(user_id, id) on delete restrict,
  constraint objectifs_cible_competence_locale_fk
    foreign key (user_id, cible_competence_local_code)
    references public.competences(user_id, code) on delete restrict,
  constraint objectifs_cible_coherente check (
    (cible_type = 'element-global'
      and cible_element_global_id is not null
      and cible_domaine_local_id is null
      and cible_competence_local_code is null
      and cible_relation_globale_id is null)
    or (cible_type = 'domaine-local'
      and cible_element_global_id is null
      and cible_domaine_local_id is not null
      and cible_competence_local_code is null
      and cible_relation_globale_id is null)
    or (cible_type = 'competence-locale'
      and cible_element_global_id is null
      and cible_domaine_local_id is null
      and cible_competence_local_code is not null
      and cible_relation_globale_id is null)
    or (cible_type = 'relation-globale'
      and cible_element_global_id is null
      and cible_domaine_local_id is null
      and cible_competence_local_code is null
      and cible_relation_globale_id is not null)
  )
);

create index objectifs_compte_statut_idx on public.objectifs (user_id, statut, priorite desc);
create index objectifs_cible_element_idx on public.objectifs (cible_element_global_id) where cible_element_global_id is not null;
create index objectifs_cible_relation_idx on public.objectifs (cible_relation_globale_id) where cible_relation_globale_id is not null;

create trigger objectifs_updated_at
  before update on public.objectifs
  for each row execute function public.touch_updated_at();

create table public.parcours (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  objectif_id uuid,
  contexte text not null check (btrim(contexte) <> '' and length(contexte) <= 4000),
  cible_type text not null check (cible_type in ('element-global', 'domaine-local', 'competence-locale', 'relation-globale')),
  cible_element_global_id uuid references public.carte_globale_elements(id) on delete restrict,
  cible_domaine_local_id text,
  cible_competence_local_code text,
  cible_relation_globale_id uuid references public.carte_globale_relations(id) on delete restrict,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'actif', 'en-pause', 'termine', 'abandonne')),
  version integer not null default 1 check (version > 0),
  archive_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint parcours_objectif_fk
    foreign key (user_id, objectif_id)
    references public.objectifs(user_id, id) on delete restrict,
  constraint parcours_cible_domaine_local_fk
    foreign key (user_id, cible_domaine_local_id)
    references public.domaines(user_id, id) on delete restrict,
  constraint parcours_cible_competence_locale_fk
    foreign key (user_id, cible_competence_local_code)
    references public.competences(user_id, code) on delete restrict,
  constraint parcours_cible_coherente check (
    (cible_type = 'element-global'
      and cible_element_global_id is not null
      and cible_domaine_local_id is null
      and cible_competence_local_code is null
      and cible_relation_globale_id is null)
    or (cible_type = 'domaine-local'
      and cible_element_global_id is null
      and cible_domaine_local_id is not null
      and cible_competence_local_code is null
      and cible_relation_globale_id is null)
    or (cible_type = 'competence-locale'
      and cible_element_global_id is null
      and cible_domaine_local_id is null
      and cible_competence_local_code is not null
      and cible_relation_globale_id is null)
    or (cible_type = 'relation-globale'
      and cible_element_global_id is null
      and cible_domaine_local_id is null
      and cible_competence_local_code is null
      and cible_relation_globale_id is not null)
  )
);

create index parcours_compte_statut_idx on public.parcours (user_id, statut, created_at);
create index parcours_objectif_idx on public.parcours (user_id, objectif_id) where objectif_id is not null;

create trigger parcours_updated_at
  before update on public.parcours
  for each row execute function public.touch_updated_at();

create table public.evenements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  request_id text not null check (btrim(request_id) <> '' and length(request_id) <= 200),
  type text not null check (type in (
    'objectif-cree', 'objectif-modifie', 'objectif-statut-change', 'objectif-archive',
    'parcours-cree', 'parcours-modifie', 'parcours-statut-change', 'parcours-archive',
    'session-rattachee'
  )),
  acteur text not null check (acteur in ('personne', 'systeme')),
  consentement boolean not null,
  survenu_le timestamptz not null default now(),
  objectif_id uuid,
  parcours_id uuid,
  session_id text,
  provenance jsonb not null check (public.provenance_lot4_valide(provenance)),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, request_id),
  constraint evenements_objectif_fk
    foreign key (user_id, objectif_id)
    references public.objectifs(user_id, id) on delete restrict,
  constraint evenements_parcours_fk
    foreign key (user_id, parcours_id)
    references public.parcours(user_id, id) on delete restrict,
  constraint evenements_session_fk
    foreign key (user_id, session_id)
    references public.sessions(user_id, id) on delete restrict,
  constraint evenements_reference_coherente check (
    (type like 'objectif-%' and objectif_id is not null)
    or (type like 'parcours-%' and parcours_id is not null)
    or (type = 'session-rattachee' and parcours_id is not null and session_id is not null)
  )
);

create index evenements_compte_date_idx on public.evenements (user_id, survenu_le, created_at);
create index evenements_objectif_idx on public.evenements (user_id, objectif_id, survenu_le) where objectif_id is not null;
create index evenements_parcours_idx on public.evenements (user_id, parcours_id, survenu_le) where parcours_id is not null;
create unique index evenements_session_rattachee_uidx
  on public.evenements (user_id, parcours_id, session_id)
  where type = 'session-rattachee';

create or replace function public.refuser_mutation_evenements_lot4()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Le journal des événements du lot 4 est append-only.' using errcode = '55000';
end;
$$;

drop trigger if exists evenements_lot4_append_only on public.evenements;
create trigger evenements_lot4_append_only
  before update or delete on public.evenements
  for each row execute function public.refuser_mutation_evenements_lot4();

revoke all on function public.refuser_mutation_evenements_lot4() from public, anon, authenticated;

alter table public.objectifs enable row level security;
alter table public.parcours enable row level security;
alter table public.evenements enable row level security;

revoke all on table public.objectifs, public.parcours, public.evenements from anon, authenticated;
grant select, insert, update on table public.objectifs, public.parcours to authenticated;
grant select, insert on table public.evenements to authenticated;

create policy objectifs_lecture_compte on public.objectifs
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));
create policy objectifs_creation_commande on public.objectifs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );
create policy objectifs_modification_commande on public.objectifs
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  )
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );

create policy parcours_lecture_compte on public.parcours
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));
create policy parcours_creation_commande on public.parcours
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );
create policy parcours_modification_commande on public.parcours
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  )
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );

create policy evenements_lecture_compte on public.evenements
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.compte_actif()));
create policy evenements_creation_commande on public.evenements
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.compte_actif())
    and (select current_setting('app.lot4_command', true)) = 'on'
  );

create or replace function public.inscrire_evenement_lot4(
  p_user_id uuid,
  p_request_id text,
  p_type text,
  p_acteur text,
  p_consentement boolean,
  p_objectif_id uuid,
  p_parcours_id uuid,
  p_session_id text,
  p_provenance jsonb,
  p_payload jsonb
)
returns public.evenements
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_evenement public.evenements%rowtype;
begin
  if not p_consentement then
    raise exception 'Le consentement explicite est obligatoire pour un événement du lot 4.' using errcode = '22023';
  end if;
  insert into public.evenements (
    user_id, request_id, type, acteur, consentement, objectif_id,
    parcours_id, session_id, provenance, payload
  ) values (
    p_user_id, p_request_id, p_type, p_acteur, p_consentement, p_objectif_id,
    p_parcours_id, p_session_id, p_provenance, coalesce(p_payload, '{}'::jsonb)
  ) returning * into v_evenement;
  return v_evenement;
end;
$$;

revoke all on function public.inscrire_evenement_lot4(uuid, text, text, text, boolean, uuid, uuid, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.inscrire_evenement_lot4(uuid, text, text, text, boolean, uuid, uuid, text, jsonb, jsonb)
  to authenticated;

create or replace function public.executer_commande_lot4(
  p_request_id text,
  p_commande jsonb,
  p_provenance jsonb,
  p_acteur text,
  p_consentement boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_type text;
  v_existing public.evenements%rowtype;
  v_evenement public.evenements%rowtype;
  v_objectif public.objectifs%rowtype;
  v_objectif_avant public.objectifs%rowtype;
  v_parcours public.parcours%rowtype;
  v_parcours_avant public.parcours%rowtype;
  v_target jsonb;
  v_cible_type text;
  v_element_global_id uuid;
  v_domaine_local_id text;
  v_competence_local_code text;
  v_relation_globale_id uuid;
  v_objectif_id uuid;
  v_parcours_id uuid;
  v_session_id text;
  v_expected_version integer;
  v_new_statut text;
  v_echeance date;
begin
  if v_uid is null then
    raise exception 'Compte authentifié obligatoire.' using errcode = '28000';
  end if;
  if p_request_id is null or btrim(p_request_id) = '' or length(p_request_id) > 200 then
    raise exception 'request_id invalide.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_commande) is distinct from 'object' then
    raise exception 'La commande du lot 4 doit être un objet JSON.' using errcode = '22023';
  end if;
  if not public.provenance_lot4_valide(p_provenance) then
    raise exception 'Provenance du lot 4 invalide.' using errcode = '22023';
  end if;
  if p_acteur not in ('personne', 'systeme') then
    raise exception 'Acteur du lot 4 invalide.' using errcode = '22023';
  end if;
  if not p_consentement then
    raise exception 'Le consentement explicite est obligatoire.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.evenements
  where user_id = v_uid and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'requestId', p_request_id,
      'rejoue', true,
      'eventId', v_existing.id,
      'eventType', v_existing.type,
      'objectifId', v_existing.objectif_id,
      'parcoursId', v_existing.parcours_id,
      'sessionId', v_existing.session_id
    );
  end if;

  perform set_config('app.lot4_command', 'on', true);
  v_type := p_commande->>'type';

  if v_type = 'creer_objectif' then
    v_target := p_commande->'cible';
    if jsonb_typeof(v_target) is distinct from 'object' then
      raise exception 'Une cible structurée est obligatoire.' using errcode = '22023';
    end if;
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_echeance := nullif(p_commande->>'echeanceLe', '')::date;
    insert into public.objectifs (
      user_id, formulation, cible_type, cible_element_global_id,
      cible_domaine_local_id, cible_competence_local_code, cible_relation_globale_id,
      priorite, horizon, echeance_le
    ) values (
      v_uid, btrim(p_commande->>'formulation'), v_cible_type, v_element_global_id,
      v_domaine_local_id, v_competence_local_code, v_relation_globale_id,
      (p_commande->>'priorite')::integer, p_commande->>'horizon', v_echeance
    ) returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-cree', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance, jsonb_build_object('objectif', to_jsonb(v_objectif))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'modifier_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then
      raise exception 'Version d’objectif périmée.' using errcode = '40001';
    end if;
    if v_objectif_avant.archive_le is not null or v_objectif_avant.statut in ('atteint', 'abandonne') then
      raise exception 'Un objectif clos ou archivé ne se modifie pas.' using errcode = '22023';
    end if;
    v_target := p_commande->'cible';
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_echeance := nullif(p_commande->>'echeanceLe', '')::date;
    update public.objectifs set
      formulation = btrim(p_commande->>'formulation'),
      cible_type = v_cible_type,
      cible_element_global_id = v_element_global_id,
      cible_domaine_local_id = v_domaine_local_id,
      cible_competence_local_code = v_competence_local_code,
      cible_relation_globale_id = v_relation_globale_id,
      priorite = (p_commande->>'priorite')::integer,
      horizon = p_commande->>'horizon',
      echeance_le = v_echeance,
      version = version + 1
    where user_id = v_uid and id = v_objectif_id
    returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-modifie', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance,
      jsonb_build_object('avant', to_jsonb(v_objectif_avant), 'apres', to_jsonb(v_objectif))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'changer_statut_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    v_new_statut := p_commande->>'statut';
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then raise exception 'Version d’objectif périmée.' using errcode = '40001'; end if;
    if v_objectif_avant.archive_le is not null then raise exception 'Un objectif archivé ne change plus de statut.' using errcode = '22023'; end if;
    if not (
      (v_objectif_avant.statut = 'brouillon' and v_new_statut in ('actif', 'abandonne'))
      or (v_objectif_avant.statut = 'actif' and v_new_statut in ('en-pause', 'atteint', 'abandonne'))
      or (v_objectif_avant.statut = 'en-pause' and v_new_statut in ('actif', 'abandonne'))
    ) then
      raise exception 'Transition d’objectif interdite.' using errcode = '22023';
    end if;
    update public.objectifs set statut = v_new_statut, version = version + 1
      where user_id = v_uid and id = v_objectif_id returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-statut-change', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance,
      jsonb_build_object('avant', v_objectif_avant.statut, 'apres', v_objectif.statut)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'archiver_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then raise exception 'Version d’objectif périmée.' using errcode = '40001'; end if;
    if v_objectif_avant.archive_le is not null then raise exception 'Objectif déjà archivé.' using errcode = '22023'; end if;
    if v_objectif_avant.statut = 'actif' then raise exception 'Un objectif actif doit être mis en pause, atteint ou abandonné avant archivage.' using errcode = '22023'; end if;
    update public.objectifs set archive_le = now(), version = version + 1
      where user_id = v_uid and id = v_objectif_id returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-archive', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance, jsonb_build_object('archiveLe', v_objectif.archive_le)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'creer_parcours' then
    v_target := p_commande->'cible';
    if jsonb_typeof(v_target) is distinct from 'object' then raise exception 'Une cible structurée est obligatoire.' using errcode = '22023'; end if;
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_objectif_id := nullif(p_commande->>'objectifId', '')::uuid;
    if v_objectif_id is not null and not exists (
      select 1 from public.objectifs where user_id = v_uid and id = v_objectif_id and archive_le is null
    ) then raise exception 'Objectif lié introuvable ou archivé.' using errcode = '23503'; end if;
    insert into public.parcours (
      user_id, objectif_id, contexte, cible_type, cible_element_global_id,
      cible_domaine_local_id, cible_competence_local_code, cible_relation_globale_id
    ) values (
      v_uid, v_objectif_id, btrim(p_commande->>'contexte'), v_cible_type, v_element_global_id,
      v_domaine_local_id, v_competence_local_code, v_relation_globale_id
    ) returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-cree', p_acteur, p_consentement,
      v_objectif_id, v_parcours.id, null, p_provenance, jsonb_build_object('parcours', to_jsonb(v_parcours))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'modifier_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null or v_parcours_avant.statut in ('termine', 'abandonne') then raise exception 'Un parcours clos ou archivé ne se modifie pas.' using errcode = '22023'; end if;
    v_target := p_commande->'cible';
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_objectif_id := nullif(p_commande->>'objectifId', '')::uuid;
    if v_objectif_id is not null and not exists (
      select 1 from public.objectifs where user_id = v_uid and id = v_objectif_id and archive_le is null
    ) then raise exception 'Objectif lié introuvable ou archivé.' using errcode = '23503'; end if;
    update public.parcours set
      objectif_id = v_objectif_id,
      contexte = btrim(p_commande->>'contexte'),
      cible_type = v_cible_type,
      cible_element_global_id = v_element_global_id,
      cible_domaine_local_id = v_domaine_local_id,
      cible_competence_local_code = v_competence_local_code,
      cible_relation_globale_id = v_relation_globale_id,
      version = version + 1
    where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-modifie', p_acteur, p_consentement,
      v_objectif_id, v_parcours.id, null, p_provenance,
      jsonb_build_object('avant', to_jsonb(v_parcours_avant), 'apres', to_jsonb(v_parcours))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'changer_statut_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    v_new_statut := p_commande->>'statut';
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null then raise exception 'Un parcours archivé ne change plus de statut.' using errcode = '22023'; end if;
    if not (
      (v_parcours_avant.statut = 'brouillon' and v_new_statut in ('actif', 'abandonne'))
      or (v_parcours_avant.statut = 'actif' and v_new_statut in ('en-pause', 'termine', 'abandonne'))
      or (v_parcours_avant.statut = 'en-pause' and v_new_statut in ('actif', 'abandonne'))
    ) then raise exception 'Transition de parcours interdite.' using errcode = '22023'; end if;
    update public.parcours set statut = v_new_statut, version = version + 1
      where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-statut-change', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, null, p_provenance,
      jsonb_build_object('avant', v_parcours_avant.statut, 'apres', v_parcours.statut)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'archiver_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null then raise exception 'Parcours déjà archivé.' using errcode = '22023'; end if;
    if v_parcours_avant.statut = 'actif' then raise exception 'Un parcours actif doit être mis en pause, terminé ou abandonné avant archivage.' using errcode = '22023'; end if;
    update public.parcours set archive_le = now(), version = version + 1
      where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-archive', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, null, p_provenance, jsonb_build_object('archiveLe', v_parcours.archive_le)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'rattacher_session' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_session_id := p_commande->>'sessionId';
    select * into v_parcours from public.parcours
      where user_id = v_uid and id = v_parcours_id;
    if not found or v_parcours.archive_le is not null then raise exception 'Parcours introuvable ou archivé.' using errcode = 'P0002'; end if;
    if not exists (select 1 from public.sessions where user_id = v_uid and id = v_session_id) then
      raise exception 'Séance introuvable dans le compte courant.' using errcode = '23503';
    end if;
    select * into v_existing from public.evenements
      where user_id = v_uid and type = 'session-rattachee'
        and parcours_id = v_parcours_id and session_id = v_session_id;
    if found then
      return jsonb_build_object(
        'requestId', p_request_id, 'rejoue', true, 'eventId', v_existing.id,
        'eventType', v_existing.type, 'objectifId', v_existing.objectif_id,
        'parcoursId', v_existing.parcours_id, 'sessionId', v_existing.session_id
      );
    end if;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'session-rattachee', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, v_session_id, p_provenance,
      jsonb_build_object('sessionId', v_session_id)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id,
      'parcoursId', v_parcours.id, 'sessionId', v_session_id
    );
  end if;

  raise exception 'Type de commande lot 4 inconnu.' using errcode = '22023';
end;
$$;

revoke all on function public.executer_commande_lot4(text, jsonb, jsonb, text, boolean) from public, anon;
grant execute on function public.executer_commande_lot4(text, jsonb, jsonb, text, boolean) to authenticated;

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
+

-- --------------------------------------------------------------------
-- 15. Twiny lot 4 — cibles structurées strictes
--
-- Repris depuis `twiny_lot_4_cibles_strictes`.
-- --------------------------------------------------------------------

-- Twiny — Lot 4 : rejet des cibles ambiguës

create or replace function public.cible_lot4_valide(p_cible jsonb)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_cible) = 'object'
    and pg_catalog.jsonb_typeof(p_cible->'type') = 'string'
    and p_cible->>'type' in ('element-global', 'domaine-local', 'competence-locale', 'relation-globale')
    and (
      (p_cible->>'type' = 'element-global'
        and (select count(*) from pg_catalog.jsonb_object_keys(p_cible)) = 2
        and pg_catalog.jsonb_typeof(p_cible->'elementId') = 'string'
        and pg_catalog.length(pg_catalog.btrim(p_cible->>'elementId')) > 0)
      or (p_cible->>'type' = 'domaine-local'
        and (select count(*) from pg_catalog.jsonb_object_keys(p_cible)) = 2
        and pg_catalog.jsonb_typeof(p_cible->'domaineId') = 'string'
        and pg_catalog.length(pg_catalog.btrim(p_cible->>'domaineId')) > 0)
      or (p_cible->>'type' = 'competence-locale'
        and (select count(*) from pg_catalog.jsonb_object_keys(p_cible)) = 2
        and pg_catalog.jsonb_typeof(p_cible->'code') = 'string'
        and pg_catalog.length(pg_catalog.btrim(p_cible->>'code')) > 0)
      or (p_cible->>'type' = 'relation-globale'
        and (select count(*) from pg_catalog.jsonb_object_keys(p_cible)) = 2
        and pg_catalog.jsonb_typeof(p_cible->'relationId') = 'string'
        and pg_catalog.length(pg_catalog.btrim(p_cible->>'relationId')) > 0)
    );
$$;

revoke all on function public.cible_lot4_valide(jsonb) from public, anon;
grant execute on function public.cible_lot4_valide(jsonb) to authenticated;

create or replace function public.executer_commande_lot4(
  p_request_id text,
  p_commande jsonb,
  p_provenance jsonb,
  p_acteur text,
  p_consentement boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_type text;
  v_existing public.evenements%rowtype;
  v_evenement public.evenements%rowtype;
  v_objectif public.objectifs%rowtype;
  v_objectif_avant public.objectifs%rowtype;
  v_parcours public.parcours%rowtype;
  v_parcours_avant public.parcours%rowtype;
  v_target jsonb;
  v_cible_type text;
  v_element_global_id uuid;
  v_domaine_local_id text;
  v_competence_local_code text;
  v_relation_globale_id uuid;
  v_objectif_id uuid;
  v_parcours_id uuid;
  v_session_id text;
  v_expected_version integer;
  v_new_statut text;
  v_echeance date;
begin
  if v_uid is null then
    raise exception 'Compte authentifié obligatoire.' using errcode = '28000';
  end if;
  if p_request_id is null or btrim(p_request_id) = '' or length(p_request_id) > 200 then
    raise exception 'request_id invalide.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_commande) is distinct from 'object' then
    raise exception 'La commande du lot 4 doit être un objet JSON.' using errcode = '22023';
  end if;
  if not public.provenance_lot4_valide(p_provenance) then
    raise exception 'Provenance du lot 4 invalide.' using errcode = '22023';
  end if;
  if p_acteur not in ('personne', 'systeme') then
    raise exception 'Acteur du lot 4 invalide.' using errcode = '22023';
  end if;
  if not p_consentement then
    raise exception 'Le consentement explicite est obligatoire.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.evenements
  where user_id = v_uid and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'requestId', p_request_id,
      'rejoue', true,
      'eventId', v_existing.id,
      'eventType', v_existing.type,
      'objectifId', v_existing.objectif_id,
      'parcoursId', v_existing.parcours_id,
      'sessionId', v_existing.session_id
    );
  end if;

  perform set_config('app.lot4_command', 'on', true);
  v_type := p_commande->>'type';

  if v_type = 'creer_objectif' then
    v_target := p_commande->'cible';
    if jsonb_typeof(v_target) is distinct from 'object' then
      raise exception 'Une cible structurée est obligatoire.' using errcode = '22023';
    end if;
    if not coalesce(public.cible_lot4_valide(v_target), false) then
      raise exception 'La cible doit contenir exactement son type et une seule référence.' using errcode = '22023';
    end if;
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_echeance := nullif(p_commande->>'echeanceLe', '')::date;
    insert into public.objectifs (
      user_id, formulation, cible_type, cible_element_global_id,
      cible_domaine_local_id, cible_competence_local_code, cible_relation_globale_id,
      priorite, horizon, echeance_le
    ) values (
      v_uid, btrim(p_commande->>'formulation'), v_cible_type, v_element_global_id,
      v_domaine_local_id, v_competence_local_code, v_relation_globale_id,
      (p_commande->>'priorite')::integer, p_commande->>'horizon', v_echeance
    ) returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-cree', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance, jsonb_build_object('objectif', to_jsonb(v_objectif))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'modifier_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then
      raise exception 'Version d’objectif périmée.' using errcode = '40001';
    end if;
    if v_objectif_avant.archive_le is not null or v_objectif_avant.statut in ('atteint', 'abandonne') then
      raise exception 'Un objectif clos ou archivé ne se modifie pas.' using errcode = '22023';
    end if;
    v_target := p_commande->'cible';
    if not coalesce(public.cible_lot4_valide(v_target), false) then
      raise exception 'La cible doit contenir exactement son type et une seule référence.' using errcode = '22023';
    end if;
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_echeance := nullif(p_commande->>'echeanceLe', '')::date;
    update public.objectifs set
      formulation = btrim(p_commande->>'formulation'),
      cible_type = v_cible_type,
      cible_element_global_id = v_element_global_id,
      cible_domaine_local_id = v_domaine_local_id,
      cible_competence_local_code = v_competence_local_code,
      cible_relation_globale_id = v_relation_globale_id,
      priorite = (p_commande->>'priorite')::integer,
      horizon = p_commande->>'horizon',
      echeance_le = v_echeance,
      version = version + 1
    where user_id = v_uid and id = v_objectif_id
    returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-modifie', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance,
      jsonb_build_object('avant', to_jsonb(v_objectif_avant), 'apres', to_jsonb(v_objectif))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'changer_statut_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    v_new_statut := p_commande->>'statut';
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then raise exception 'Version d’objectif périmée.' using errcode = '40001'; end if;
    if v_objectif_avant.archive_le is not null then raise exception 'Un objectif archivé ne change plus de statut.' using errcode = '22023'; end if;
    if not (
      (v_objectif_avant.statut = 'brouillon' and v_new_statut in ('actif', 'abandonne'))
      or (v_objectif_avant.statut = 'actif' and v_new_statut in ('en-pause', 'atteint', 'abandonne'))
      or (v_objectif_avant.statut = 'en-pause' and v_new_statut in ('actif', 'abandonne'))
    ) then
      raise exception 'Transition d’objectif interdite.' using errcode = '22023';
    end if;
    update public.objectifs set statut = v_new_statut, version = version + 1
      where user_id = v_uid and id = v_objectif_id returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-statut-change', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance,
      jsonb_build_object('avant', v_objectif_avant.statut, 'apres', v_objectif.statut)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'archiver_objectif' then
    v_objectif_id := (p_commande->>'objectifId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_objectif_avant from public.objectifs
      where user_id = v_uid and id = v_objectif_id for update;
    if not found then raise exception 'Objectif introuvable.' using errcode = 'P0002'; end if;
    if v_objectif_avant.version <> v_expected_version then raise exception 'Version d’objectif périmée.' using errcode = '40001'; end if;
    if v_objectif_avant.archive_le is not null then raise exception 'Objectif déjà archivé.' using errcode = '22023'; end if;
    if v_objectif_avant.statut = 'actif' then raise exception 'Un objectif actif doit être mis en pause, atteint ou abandonné avant archivage.' using errcode = '22023'; end if;
    update public.objectifs set archive_le = now(), version = version + 1
      where user_id = v_uid and id = v_objectif_id returning * into v_objectif;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'objectif-archive', p_acteur, p_consentement,
      v_objectif.id, null, null, p_provenance, jsonb_build_object('archiveLe', v_objectif.archive_le)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif.id
    );
  end if;

  if v_type = 'creer_parcours' then
    v_target := p_commande->'cible';
    if jsonb_typeof(v_target) is distinct from 'object' then raise exception 'Une cible structurée est obligatoire.' using errcode = '22023'; end if;
    if not coalesce(public.cible_lot4_valide(v_target), false) then
      raise exception 'La cible doit contenir exactement son type et une seule référence.' using errcode = '22023';
    end if;
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_objectif_id := nullif(p_commande->>'objectifId', '')::uuid;
    if v_objectif_id is not null and not exists (
      select 1 from public.objectifs where user_id = v_uid and id = v_objectif_id and archive_le is null
    ) then raise exception 'Objectif lié introuvable ou archivé.' using errcode = '23503'; end if;
    insert into public.parcours (
      user_id, objectif_id, contexte, cible_type, cible_element_global_id,
      cible_domaine_local_id, cible_competence_local_code, cible_relation_globale_id
    ) values (
      v_uid, v_objectif_id, btrim(p_commande->>'contexte'), v_cible_type, v_element_global_id,
      v_domaine_local_id, v_competence_local_code, v_relation_globale_id
    ) returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-cree', p_acteur, p_consentement,
      v_objectif_id, v_parcours.id, null, p_provenance, jsonb_build_object('parcours', to_jsonb(v_parcours))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'modifier_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null or v_parcours_avant.statut in ('termine', 'abandonne') then raise exception 'Un parcours clos ou archivé ne se modifie pas.' using errcode = '22023'; end if;
    v_target := p_commande->'cible';
    if not coalesce(public.cible_lot4_valide(v_target), false) then
      raise exception 'La cible doit contenir exactement son type et une seule référence.' using errcode = '22023';
    end if;
    v_cible_type := v_target->>'type';
    if v_cible_type = 'element-global' then
      v_element_global_id := (v_target->>'elementId')::uuid;
    elsif v_cible_type = 'domaine-local' then
      v_domaine_local_id := v_target->>'domaineId';
    elsif v_cible_type = 'competence-locale' then
      v_competence_local_code := v_target->>'code';
    elsif v_cible_type = 'relation-globale' then
      v_relation_globale_id := (v_target->>'relationId')::uuid;
    else
      raise exception 'Type de cible invalide.' using errcode = '22023';
    end if;
    v_objectif_id := nullif(p_commande->>'objectifId', '')::uuid;
    if v_objectif_id is not null and not exists (
      select 1 from public.objectifs where user_id = v_uid and id = v_objectif_id and archive_le is null
    ) then raise exception 'Objectif lié introuvable ou archivé.' using errcode = '23503'; end if;
    update public.parcours set
      objectif_id = v_objectif_id,
      contexte = btrim(p_commande->>'contexte'),
      cible_type = v_cible_type,
      cible_element_global_id = v_element_global_id,
      cible_domaine_local_id = v_domaine_local_id,
      cible_competence_local_code = v_competence_local_code,
      cible_relation_globale_id = v_relation_globale_id,
      version = version + 1
    where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-modifie', p_acteur, p_consentement,
      v_objectif_id, v_parcours.id, null, p_provenance,
      jsonb_build_object('avant', to_jsonb(v_parcours_avant), 'apres', to_jsonb(v_parcours))
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'changer_statut_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    v_new_statut := p_commande->>'statut';
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null then raise exception 'Un parcours archivé ne change plus de statut.' using errcode = '22023'; end if;
    if not (
      (v_parcours_avant.statut = 'brouillon' and v_new_statut in ('actif', 'abandonne'))
      or (v_parcours_avant.statut = 'actif' and v_new_statut in ('en-pause', 'termine', 'abandonne'))
      or (v_parcours_avant.statut = 'en-pause' and v_new_statut in ('actif', 'abandonne'))
    ) then raise exception 'Transition de parcours interdite.' using errcode = '22023'; end if;
    update public.parcours set statut = v_new_statut, version = version + 1
      where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-statut-change', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, null, p_provenance,
      jsonb_build_object('avant', v_parcours_avant.statut, 'apres', v_parcours.statut)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'archiver_parcours' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_expected_version := (p_commande->>'version')::integer;
    select * into v_parcours_avant from public.parcours
      where user_id = v_uid and id = v_parcours_id for update;
    if not found then raise exception 'Parcours introuvable.' using errcode = 'P0002'; end if;
    if v_parcours_avant.version <> v_expected_version then raise exception 'Version de parcours périmée.' using errcode = '40001'; end if;
    if v_parcours_avant.archive_le is not null then raise exception 'Parcours déjà archivé.' using errcode = '22023'; end if;
    if v_parcours_avant.statut = 'actif' then raise exception 'Un parcours actif doit être mis en pause, terminé ou abandonné avant archivage.' using errcode = '22023'; end if;
    update public.parcours set archive_le = now(), version = version + 1
      where user_id = v_uid and id = v_parcours_id returning * into v_parcours;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'parcours-archive', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, null, p_provenance, jsonb_build_object('archiveLe', v_parcours.archive_le)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id, 'parcoursId', v_parcours.id
    );
  end if;

  if v_type = 'rattacher_session' then
    v_parcours_id := (p_commande->>'parcoursId')::uuid;
    v_session_id := p_commande->>'sessionId';
    select * into v_parcours from public.parcours
      where user_id = v_uid and id = v_parcours_id;
    if not found or v_parcours.archive_le is not null then raise exception 'Parcours introuvable ou archivé.' using errcode = 'P0002'; end if;
    if not exists (select 1 from public.sessions where user_id = v_uid and id = v_session_id) then
      raise exception 'Séance introuvable dans le compte courant.' using errcode = '23503';
    end if;
    select * into v_existing from public.evenements
      where user_id = v_uid and type = 'session-rattachee'
        and parcours_id = v_parcours_id and session_id = v_session_id;
    if found then
      return jsonb_build_object(
        'requestId', p_request_id, 'rejoue', true, 'eventId', v_existing.id,
        'eventType', v_existing.type, 'objectifId', v_existing.objectif_id,
        'parcoursId', v_existing.parcours_id, 'sessionId', v_existing.session_id
      );
    end if;
    v_evenement := public.inscrire_evenement_lot4(
      v_uid, p_request_id, 'session-rattachee', p_acteur, p_consentement,
      v_parcours.objectif_id, v_parcours.id, v_session_id, p_provenance,
      jsonb_build_object('sessionId', v_session_id)
    );
    return jsonb_build_object(
      'requestId', p_request_id, 'rejoue', false, 'eventId', v_evenement.id,
      'eventType', v_evenement.type, 'objectifId', v_parcours.objectif_id,
      'parcoursId', v_parcours.id, 'sessionId', v_session_id
    );
  end if;

  raise exception 'Type de commande lot 4 inconnu.' using errcode = '22023';
end;
$$;


revoke all on function public.executer_commande_lot4(text, jsonb, jsonb, text, boolean) from public, anon;
grant execute on function public.executer_commande_lot4(text, jsonb, jsonb, text, boolean) to authenticated;
