-- ====================================================================
-- Schéma PostgreSQL Supabase — Système Pédagogique (Multi-Utilisateurs)
-- ====================================================================

-- 1. Table des profils utilisateurs (Liée à auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  prenom TEXT NOT NULL DEFAULT 'Utilisateur',
  avatar_url TEXT,
  formation TEXT DEFAULT 'Formation personnalisée',
  objectif_moyen_terme TEXT DEFAULT 'Développer des compétences solides',
  objectif_long_terme TEXT DEFAULT 'Maîtriser les systèmes complexes',
  debut_suivi TEXT NOT NULL DEFAULT CURRENT_DATE::text,
  preferences_pedagogiques TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs gèrent leur propre profil"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger d'initialisation automatique du profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Table des preuves de compétences (SkillEvidence)
CREATE TABLE IF NOT EXISTS public.evidence (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  skill_code TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  niveau_preuve TEXT NOT NULL,
  autonomie TEXT NOT NULL,
  qualite TEXT NOT NULL,
  resultat TEXT NOT NULL,
  contexte TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  competences_combinees TEXT[] DEFAULT ARRAY[]::TEXT[],
  source JSONB NOT NULL DEFAULT '{}'::jsonb,
  commentaire TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolation utilisateur pour les preuves"
  ON public.evidence FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Table des sessions d'apprentissage (LearningSession)
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  date TEXT NOT NULL,
  duree_min INTEGER,
  domaines TEXT[] DEFAULT ARRAY[]::TEXT[],
  skill_codes TEXT[] DEFAULT ARRAY[]::TEXT[],
  activites JSONB NOT NULL DEFAULT '[]'::jsonb,
  resultat TEXT,
  difficulte TEXT,
  apprentissage_principal TEXT,
  prochaine_action TEXT,
  note_personnelle TEXT,
  genere_automatiquement BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolation utilisateur pour les sessions"
  ON public.sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Table des tentatives d'exercices (ExerciseAttempt)
CREATE TABLE IF NOT EXISTS public.attempts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  exercise_id TEXT NOT NULL,
  debut TEXT NOT NULL,
  fin TEXT,
  duree_min INTEGER,
  indices_utilises INTEGER DEFAULT 0,
  reponse TEXT NOT NULL DEFAULT '',
  auto_evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultat TEXT NOT NULL DEFAULT 'partiel',
  statut TEXT NOT NULL DEFAULT 'en-cours',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolation utilisateur pour les tentatives"
  ON public.attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Table des erreurs récurrentes (ErrorItem)
CREATE TABLE IF NOT EXISTS public.errors (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  concept TEXT NOT NULL,
  skill_codes TEXT[] DEFAULT ARRAY[]::TEXT[],
  description TEXT NOT NULL,
  cause_probable TEXT NOT NULL,
  correction TEXT NOT NULL,
  exemple TEXT,
  occurrences JSONB NOT NULL DEFAULT '[]'::jsonb,
  statut TEXT NOT NULL DEFAULT 'nouvelle',
  archivee BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolation utilisateur pour les erreurs"
  ON public.errors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
