-- Tabella utenti (estende auth.users di Supabase)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    avatar_url TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    total_study_time INTEGER DEFAULT 0, -- in minuti
    trees_grown INTEGER DEFAULT 0,
    trees_killed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella sessioni di studio
CREATE TABLE public.study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration INTEGER, -- in minuti
    type VARCHAR(20) NOT NULL CHECK (type IN ('pomodoro', 'short_break', 'long_break')),
    completed BOOLEAN DEFAULT FALSE,
    xp_earned INTEGER DEFAULT 0,
    tree_grown BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella esami/verifiche
CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    exam_date DATE NOT NULL,
    difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
    estimated_study_hours INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    grade VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella sessioni di studio per esami
CREATE TABLE public.exam_study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella achievements/badges
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    xp_reward INTEGER DEFAULT 0,
    requirement_type VARCHAR(50), -- 'xp', 'level', 'trees', 'streak', etc.
    requirement_value INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella achievements sbloccati dagli utenti
CREATE TABLE public.user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Tabella per le app bloccate
CREATE TABLE public.blocked_apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    app_name VARCHAR(100) NOT NULL,
    package_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella penalità per sblocco emergenza
CREATE TABLE public.emergency_unlocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.study_sessions(id) ON DELETE SET NULL,
    xp_penalty INTEGER DEFAULT 50,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella per la foresta (collezione di alberi)
CREATE TABLE public.forest_trees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.study_sessions(id) ON DELETE SET NULL,
    tree_type VARCHAR(50) DEFAULT 'oak',
    growth_stage INTEGER DEFAULT 0, -- 0-100%
    is_alive BOOLEAN DEFAULT TRUE,
    planted_at TIMESTAMPTZ DEFAULT NOW(),
    grown_at TIMESTAMPTZ
);

-- Tabella classifica settimanale
CREATE TABLE public.weekly_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    xp_earned INTEGER DEFAULT 0,
    study_time INTEGER DEFAULT 0, -- in minuti
    rank INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Indici per performance
CREATE INDEX idx_study_sessions_user_id ON public.study_sessions(user_id);
CREATE INDEX idx_exams_user_id ON public.exams(user_id);
CREATE INDEX idx_exams_date ON public.exams(exam_date);
CREATE INDEX idx_forest_trees_user_id ON public.forest_trees(user_id);
CREATE INDEX idx_weekly_leaderboard_week ON public.weekly_leaderboard(week_start);
CREATE INDEX idx_weekly_leaderboard_xp ON public.weekly_leaderboard(xp_earned DESC);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forest_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_leaderboard ENABLE ROW LEVEL SECURITY;

-- Politiche RLS
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own sessions" ON public.study_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own exams" ON public.exams
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own forest" ON public.forest_trees
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view leaderboard" ON public.weekly_leaderboard
    FOR SELECT USING (true);

CREATE POLICY "Users can view own leaderboard entry" ON public.weekly_leaderboard
    FOR ALL USING (auth.uid() = user_id);