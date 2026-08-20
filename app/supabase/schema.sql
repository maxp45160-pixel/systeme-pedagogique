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
  -- ni calculée ni affichée ; ses preuves restent intactes.
  active              BOOLEAN NOT NULL DEFAULT true,
  -- Archivée = retirée du référentiel de travail SANS perdre ses preuves.
  -- C'est le seul retrait possible dès qu'une preuve existe (P4, ADR-027).
  archive             BOOLEAN NOT NULL DEFAULT false,
  -- Un changement de sens crée un successeur ; il ne réécrit jamais les preuves.
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
    UPDATE public.competences SET archive = false
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
        EXISTS (SELECT 1 FROM public.evidence WHERE user_id = v_uid AND skill_code = v_code)
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
        EXISTS (SELECT 1 FROM public.evidence e WHERE e.user_id = v_uid AND e.skill_code = c.code)
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
    UPDATE public.competences SET archive = false, active = false
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
    'competences', COALESCE((SELECT json_agg(row_to_json(c)) FROM competences c WHERE c.user_id = uid), '[]'::json),
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
DROP POLICY IF EXISTS "profil_admin_lecture" ON public.profiles;
CREATE POLICY "profil_admin_lecture" ON public.profiles
  FOR SELECT TO authenticated USING (public.est_admin());

-- Ce que le panel affiche : identité, accès, et des compteurs. Aucun contenu.
CREATE OR REPLACE FUNCTION public.admin_comptes()
RETURNS TABLE (
  user_id UUID, email TEXT, prenom TEXT, plan TEXT, role TEXT,
  suspendu_le TIMESTAMPTZ, motif TEXT, cree_le TIMESTAMPTZ,
  preuves BIGINT, exercices BIGINT, seances BIGINT, competences BIGINT,
  derniere_activite TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.est_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.user_id, p.email, p.prenom, p.plan, a.role, a.suspendu_le, a.motif, a.created_at,
    (SELECT COUNT(*) FROM public.evidence e WHERE e.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.exercises x WHERE x.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.sessions s WHERE s.user_id = a.user_id),
    (SELECT COUNT(*) FROM public.competences c WHERE c.user_id = a.user_id),
    GREATEST(
      (SELECT MAX(e.created_at) FROM public.evidence e WHERE e.user_id = a.user_id),
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
  -- preuve n'existe). Même précédent que `themes.codes` et
  -- `competences.prerequis`, qui n'en portent pas pour cette raison exacte.
  cible_code        TEXT,
  -- Exercice ou séance visés. NULL = la décision portait sur la compétence
  -- seule, cas normal quand aucun exercice n'existe pour elle.
  cible_ref         TEXT,
  -- `Facteur[]` tel que `recommend.ts` le produit — libellé, contribution,
  -- phrase. C'est le « Pourquoi ? » de P3, figé au moment où il a été montré.
  facteurs          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Empreinte de l'état lu : niveau, confiance, robustesse, nombre de preuves,
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
--   retention → 1re preuve sur `cible_code` après `horizon_le`
--
-- C'est la différence de fond avec le modèle qui a inspiré ce chantier :
-- stocker les résultats aurait dupliqué `attempts` et `evidence`, et créé une
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
-- Une preuve ne bouge JAMAIS : la scission est seche.
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
  -- bouts. Une compétence qui porte une succession porte des preuves, donc
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
