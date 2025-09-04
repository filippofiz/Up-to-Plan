-- ====================================================================
-- SCHOOL SCHEDULE TABLES
-- Sistema per gestire l'orario scolastico dettagliato
-- ====================================================================

-- Tabella per configurazione tipo di scuola
CREATE TABLE IF NOT EXISTS school_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    school_level TEXT NOT NULL CHECK (school_level IN ('media', 'superiore')),
    school_type TEXT CHECK (
        (school_level = 'media' AND school_type IS NULL) OR
        (school_level = 'superiore' AND school_type IN (
            'liceo_classico', 'liceo_scientifico', 'liceo_linguistico', 
            'liceo_artistico', 'liceo_musicale', 'liceo_scienze_umane',
            'istituto_tecnico', 'istituto_professionale'
        ))
    ),
    year INTEGER CHECK (year BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabella per stime tempi studio per tipo scuola (gestita da admin)
CREATE TABLE IF NOT EXISTS study_time_estimates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_level TEXT NOT NULL,
    school_type TEXT,
    subject_name TEXT NOT NULL,
    year INTEGER,
    suggested_minutes_per_session INTEGER NOT NULL,
    difficulty_factor DECIMAL(3,2) DEFAULT 1.0,
    priority_factor DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(school_level, school_type, subject_name, year)
);

-- ====================================================================

-- Tabella per l'orario scolastico dettagliato
CREATE TABLE IF NOT EXISTS school_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    subject_name TEXT, -- Nome materia se non è nelle subjects
    is_break BOOLEAN DEFAULT FALSE,
    room TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Tabella per tracking giornaliero dei tempi effettivi
CREATE TABLE IF NOT EXISTS daily_study_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    planned_minutes INTEGER NOT NULL,
    actual_minutes INTEGER,
    planned_start_time TIME,
    planned_end_time TIME,
    actual_start_time TIME,
    actual_end_time TIME,
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 10),
    productivity_rating INTEGER CHECK (productivity_rating BETWEEN 1 AND 10),
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date, subject_id, planned_start_time)
);

-- Tabella per il piano di studio generato
CREATE TABLE IF NOT EXISTS study_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    priority INTEGER DEFAULT 5,
    study_type TEXT CHECK (study_type IN ('ripasso', 'studio', 'esercizi', 'approfondimento')),
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    actual_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date, start_time)
);

-- Indici per ottimizzare le query
CREATE INDEX idx_school_schedule_user ON school_schedule(user_id);
CREATE INDEX idx_school_schedule_day ON school_schedule(day_of_week);
CREATE INDEX idx_daily_tracking_user_date ON daily_study_tracking(user_id, date);
CREATE INDEX idx_study_plans_user_date ON study_plans(user_id, date);

-- RLS Policies
ALTER TABLE school_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_study_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

-- Policy per school_schedule
CREATE POLICY "Users can manage their own schedule" ON school_schedule
    FOR ALL USING (auth.uid() = user_id);

-- Policy per daily_study_tracking
CREATE POLICY "Users can manage their own tracking" ON daily_study_tracking
    FOR ALL USING (auth.uid() = user_id);

-- Policy per study_plans
CREATE POLICY "Users can manage their own plans" ON study_plans
    FOR ALL USING (auth.uid() = user_id);

-- ====================================================================
-- FUNZIONI HELPER
-- ====================================================================

-- Funzione per calcolare ore settimanali per materia dall'orario scolastico
CREATE OR REPLACE FUNCTION calculate_weekly_hours_from_schedule(p_user_id UUID, p_subject_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_minutes INTEGER;
BEGIN
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ), 0)::INTEGER INTO total_minutes
    FROM school_schedule
    WHERE user_id = p_user_id 
    AND subject_id = p_subject_id
    AND is_break = FALSE;
    
    RETURN total_minutes / 60; -- Ritorna ore
END;
$$ LANGUAGE plpgsql;

-- Funzione per generare piano di studio intelligente
CREATE OR REPLACE FUNCTION generate_smart_study_plan(
    p_user_id UUID,
    p_date DATE
)
RETURNS TABLE(
    subject_id UUID,
    subject_name TEXT,
    start_time TIME,
    end_time TIME,
    duration_minutes INTEGER,
    study_type TEXT,
    priority INTEGER
) AS $$
DECLARE
    v_day_of_week TEXT;
    v_available_slots JSONB;
    v_subject RECORD;
    v_start_time TIME;
    v_end_time TIME;
BEGIN
    -- Ottieni giorno della settimana
    v_day_of_week := CASE EXTRACT(DOW FROM p_date)
        WHEN 0 THEN 'Domenica'
        WHEN 1 THEN 'Lunedì'
        WHEN 2 THEN 'Martedì'
        WHEN 3 THEN 'Mercoledì'
        WHEN 4 THEN 'Giovedì'
        WHEN 5 THEN 'Venerdì'
        WHEN 6 THEN 'Sabato'
    END;
    
    -- Se è domenica, usa slot predefiniti
    IF v_day_of_week = 'Domenica' THEN
        v_start_time := '09:00'::TIME;
        v_end_time := '12:00'::TIME;
    ELSE
        -- Trova slot disponibili (dopo scuola)
        SELECT MAX(end_time) INTO v_start_time
        FROM school_schedule
        WHERE user_id = p_user_id 
        AND day_of_week = v_day_of_week
        AND NOT is_break;
        
        -- Se non c'è scuola, usa orario di default
        IF v_start_time IS NULL THEN
            v_start_time := '15:00'::TIME;
        ELSE
            -- Aggiungi tempo per pranzo/riposo
            v_start_time := v_start_time + INTERVAL '90 minutes';
        END IF;
        
        v_end_time := '19:00'::TIME; -- Fine studio serale
    END IF;
    
    -- Per ogni materia, calcola tempo di studio necessario
    FOR v_subject IN 
        SELECT 
            s.id,
            s.name,
            s.priority,
            s.difficulty,
            COALESCE(
                -- Tempo medio dalle sessioni precedenti
                (SELECT AVG(actual_minutes) 
                 FROM daily_study_tracking 
                 WHERE subject_id = s.id 
                 AND user_id = p_user_id 
                 AND completed = TRUE
                 AND date > CURRENT_DATE - INTERVAL '30 days'),
                -- O usa calcolo basato su difficoltà e priorità
                30 + (s.difficulty * 5) + (s.priority * 3)
            )::INTEGER as suggested_minutes,
            -- Controlla se ci sono verifiche imminenti
            EXISTS(
                SELECT 1 FROM exams e 
                WHERE e.subject_id = s.id 
                AND e.user_id = p_user_id
                AND e.date BETWEEN p_date AND p_date + INTERVAL '7 days'
            ) as has_upcoming_exam
        FROM subjects s
        WHERE s.user_id = p_user_id
        ORDER BY 
            has_upcoming_exam DESC,
            s.priority DESC,
            s.difficulty DESC
    LOOP
        -- Se c'è ancora tempo disponibile
        IF v_start_time < v_end_time THEN
            -- Calcola durata sessione
            DECLARE
                v_session_duration INTEGER;
            BEGIN
                -- Se c'è esame imminente, studia di più
                IF v_subject.has_upcoming_exam THEN
                    v_session_duration := LEAST(v_subject.suggested_minutes * 1.5, 90);
                ELSE
                    v_session_duration := LEAST(v_subject.suggested_minutes, 60);
                END IF;
                
                -- Non superare il tempo disponibile
                IF v_start_time + (v_session_duration || ' minutes')::INTERVAL > v_end_time THEN
                    v_session_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 60;
                END IF;
                
                -- Solo se c'è almeno 15 minuti
                IF v_session_duration >= 15 THEN
                    RETURN QUERY
                    SELECT 
                        v_subject.id,
                        v_subject.name,
                        v_start_time,
                        v_start_time + (v_session_duration || ' minutes')::INTERVAL,
                        v_session_duration,
                        CASE 
                            WHEN v_subject.has_upcoming_exam THEN 'studio'::TEXT
                            WHEN v_subject.difficulty > 7 THEN 'esercizi'::TEXT
                            ELSE 'ripasso'::TEXT
                        END,
                        v_subject.priority;
                    
                    -- Aggiorna start time per prossima materia (con pausa)
                    v_start_time := v_start_time + (v_session_duration || ' minutes')::INTERVAL + INTERVAL '10 minutes';
                END IF;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Funzione per salvare feedback giornaliero
CREATE OR REPLACE FUNCTION save_daily_feedback(
    p_user_id UUID,
    p_date DATE,
    p_feedback JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Per ogni materia nel feedback
    FOR feedback_item IN SELECT * FROM jsonb_array_elements(p_feedback)
    LOOP
        UPDATE daily_study_tracking
        SET 
            actual_minutes = (feedback_item->>'actual_minutes')::INTEGER,
            actual_start_time = (feedback_item->>'actual_start_time')::TIME,
            actual_end_time = (feedback_item->>'actual_end_time')::TIME,
            difficulty_rating = (feedback_item->>'difficulty_rating')::INTEGER,
            productivity_rating = (feedback_item->>'productivity_rating')::INTEGER,
            notes = feedback_item->>'notes',
            completed = TRUE,
            updated_at = NOW()
        WHERE 
            user_id = p_user_id
            AND date = p_date
            AND subject_id = (feedback_item->>'subject_id')::UUID;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;