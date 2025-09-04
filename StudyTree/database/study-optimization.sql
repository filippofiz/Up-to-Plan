-- Tabelle per sistema di ottimizzazione studio e predizione tempi

-- Tabella materie per ogni utente
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3498db',
    difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 10) DEFAULT 5,
    priority INTEGER CHECK (priority >= 1 AND priority <= 10) DEFAULT 5,
    type VARCHAR(20) CHECK (type IN ('teorica', 'pratica', 'mista')) DEFAULT 'teorica',
    weekly_hours INTEGER DEFAULT 0, -- ore settimanali a scuola
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Tabella lezioni/argomenti per materia
CREATE TABLE public.lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    planned_date DATE,
    planned_duration INTEGER, -- minuti previsti
    actual_duration INTEGER, -- minuti effettivi
    status VARCHAR(20) CHECK (status IN ('pianificata', 'in_corso', 'completata', 'rimandata')) DEFAULT 'pianificata',
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 10),
    difficulty_perceived INTEGER CHECK (difficulty_perceived >= 1 AND difficulty_perceived <= 10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella tracking tempi di studio dettagliati
CREATE TABLE public.study_time_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.study_sessions(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    planned_duration INTEGER, -- minuti previsti
    actual_duration INTEGER, -- minuti effettivi
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 10),
    difficulty_perceived INTEGER CHECK (difficulty_perceived >= 1 AND difficulty_perceived <= 10),
    focus_level INTEGER CHECK (focus_level >= 1 AND focus_level <= 10),
    metadata JSONB, -- informazioni aggiuntive (classe, scuola, periodo)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurazioni globali per tipologia scuola/classe/materia
CREATE TABLE public.study_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_type VARCHAR(50) NOT NULL, -- liceo, tecnico, professionale, università
    class_year INTEGER,
    subject_name VARCHAR(100) NOT NULL,
    avg_study_time_per_lesson INTEGER DEFAULT 60, -- minuti medi
    avg_break_between_lessons INTEGER DEFAULT 15, -- pausa media
    avg_weekly_revision_time INTEGER DEFAULT 30, -- tempo revisione settimanale
    avg_exam_preparation_time INTEGER DEFAULT 120, -- tempo preparazione verifica
    difficulty_coefficient DECIMAL(3,2) DEFAULT 1.0,
    sample_count INTEGER DEFAULT 0, -- numero di campioni utilizzati
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_type, class_year, subject_name)
);

-- Tabella per suggerimenti e predizioni personalizzate
CREATE TABLE public.study_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,
    suggested_duration INTEGER, -- minuti suggeriti
    confidence_score DECIMAL(3,2), -- 0.00 - 1.00
    based_on VARCHAR(50), -- 'personal_history', 'global_config', 'mixed'
    factors JSONB, -- fattori considerati nella predizione
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vista per statistiche aggregate per admin
CREATE OR REPLACE VIEW public.admin_statistics AS
SELECT 
    sc.school_type,
    sc.class_year,
    sc.subject_name,
    sc.avg_study_time_per_lesson,
    sc.sample_count,
    COUNT(DISTINCT stt.user_id) as unique_users,
    AVG(stt.actual_duration) as real_avg_duration,
    AVG(stt.quality_score) as avg_quality,
    AVG(stt.difficulty_perceived) as avg_difficulty,
    STDDEV(stt.actual_duration) as duration_stddev,
    MAX(stt.created_at) as last_data_point
FROM public.study_configurations sc
LEFT JOIN public.study_time_tracking stt ON 
    stt.metadata->>'school_type' = sc.school_type AND
    (stt.metadata->>'class_year')::INTEGER = sc.class_year
GROUP BY sc.id, sc.school_type, sc.class_year, sc.subject_name, 
         sc.avg_study_time_per_lesson, sc.sample_count;

-- Funzione per calcolare tempo ottimale di studio
CREATE OR REPLACE FUNCTION calculate_optimal_study_time(
    p_user_id UUID,
    p_subject_id UUID,
    p_activity_type VARCHAR DEFAULT 'study'
) RETURNS TABLE(
    suggested_minutes INTEGER,
    confidence DECIMAL,
    source VARCHAR,
    factors JSONB
) AS $$
DECLARE
    v_personal_avg INTEGER;
    v_personal_count INTEGER;
    v_global_avg INTEGER;
    v_school_type VARCHAR;
    v_class_year INTEGER;
    v_subject_name VARCHAR;
    v_difficulty_factor DECIMAL;
    v_quality_factor DECIMAL;
    v_suggested INTEGER;
    v_confidence DECIMAL;
    v_source VARCHAR;
    v_factors JSONB;
BEGIN
    -- Ottieni info utente e materia
    SELECT 
        us.settings->>'school_type',
        (us.settings->>'class_year')::INTEGER,
        s.name,
        s.difficulty
    INTO v_school_type, v_class_year, v_subject_name, v_difficulty_factor
    FROM public.user_settings us
    JOIN public.subjects s ON s.id = p_subject_id
    WHERE us.user_id = p_user_id AND s.user_id = p_user_id;
    
    -- Calcola media personale
    SELECT 
        AVG(actual_duration)::INTEGER,
        COUNT(*)::INTEGER,
        AVG(quality_score)
    INTO v_personal_avg, v_personal_count, v_quality_factor
    FROM public.study_time_tracking
    WHERE user_id = p_user_id 
    AND subject_id = p_subject_id
    AND actual_duration IS NOT NULL
    AND created_at > CURRENT_DATE - INTERVAL '30 days';
    
    -- Ottieni configurazione globale
    SELECT avg_study_time_per_lesson
    INTO v_global_avg
    FROM public.study_configurations
    WHERE school_type = v_school_type 
    AND class_year = v_class_year
    AND subject_name = v_subject_name;
    
    -- Calcola tempo suggerito con algoritmo predittivo
    IF v_personal_count >= 5 THEN
        -- Usa principalmente dati personali
        v_suggested := v_personal_avg;
        v_confidence := 0.8 + (v_personal_count::DECIMAL / 50) * 0.2; -- Max 1.0
        v_source := 'personal_history';
    ELSIF v_personal_count > 0 AND v_global_avg IS NOT NULL THEN
        -- Mix di dati personali e globali
        v_suggested := (v_personal_avg * 0.7 + v_global_avg * 0.3)::INTEGER;
        v_confidence := 0.5 + (v_personal_count::DECIMAL / 10) * 0.3;
        v_source := 'mixed';
    ELSIF v_global_avg IS NOT NULL THEN
        -- Usa solo configurazione globale
        v_suggested := v_global_avg;
        v_confidence := 0.4;
        v_source := 'global_config';
    ELSE
        -- Default
        v_suggested := 60;
        v_confidence := 0.2;
        v_source := 'default';
    END IF;
    
    -- Applica fattori di correzione
    IF v_difficulty_factor IS NOT NULL THEN
        v_suggested := (v_suggested * (1 + (v_difficulty_factor - 5) * 0.05))::INTEGER;
    END IF;
    
    IF v_quality_factor IS NOT NULL AND v_quality_factor < 6 THEN
        v_suggested := (v_suggested * 1.1)::INTEGER; -- Aumenta tempo se qualità bassa
    END IF;
    
    -- Costruisci fattori JSON
    v_factors := jsonb_build_object(
        'personal_samples', v_personal_count,
        'personal_avg', v_personal_avg,
        'global_avg', v_global_avg,
        'difficulty_adjustment', v_difficulty_factor,
        'quality_adjustment', v_quality_factor
    );
    
    RETURN QUERY SELECT v_suggested, v_confidence, v_source, v_factors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per aggiornare configurazioni globali basate su dati reali
CREATE OR REPLACE FUNCTION update_global_configurations()
RETURNS void AS $$
DECLARE
    rec RECORD;
    v_new_avg INTEGER;
    v_sample_count INTEGER;
BEGIN
    FOR rec IN 
        SELECT DISTINCT 
            metadata->>'school_type' as school_type,
            (metadata->>'class_year')::INTEGER as class_year,
            s.name as subject_name
        FROM public.study_time_tracking stt
        JOIN public.subjects s ON s.id = stt.subject_id
        WHERE metadata IS NOT NULL
    LOOP
        -- Calcola nuova media
        SELECT 
            AVG(actual_duration)::INTEGER,
            COUNT(*)::INTEGER
        INTO v_new_avg, v_sample_count
        FROM public.study_time_tracking stt
        JOIN public.subjects s ON s.id = stt.subject_id
        WHERE 
            metadata->>'school_type' = rec.school_type AND
            (metadata->>'class_year')::INTEGER = rec.class_year AND
            s.name = rec.subject_name AND
            actual_duration IS NOT NULL;
        
        -- Inserisci o aggiorna configurazione
        INSERT INTO public.study_configurations (
            school_type, class_year, subject_name,
            avg_study_time_per_lesson, sample_count
        ) VALUES (
            rec.school_type, rec.class_year, rec.subject_name,
            v_new_avg, v_sample_count
        )
        ON CONFLICT (school_type, class_year, subject_name)
        DO UPDATE SET
            avg_study_time_per_lesson = v_new_avg,
            sample_count = v_sample_count,
            last_updated = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per generare piano di studio settimanale ottimizzato
CREATE OR REPLACE FUNCTION generate_weekly_study_plan(
    p_user_id UUID,
    p_available_hours INTEGER DEFAULT 20
) RETURNS TABLE(
    day_of_week INTEGER,
    subject_name VARCHAR,
    suggested_minutes INTEGER,
    priority_score DECIMAL,
    time_slot VARCHAR
) AS $$
DECLARE
    v_total_priority_minutes INTEGER;
    v_scale_factor DECIMAL;
BEGIN
    -- Calcola tempo totale necessario basato su priorità
    SELECT SUM(
        (SELECT suggested_minutes FROM calculate_optimal_study_time(p_user_id, s.id, 'study')) 
        * s.priority / 5.0
    )::INTEGER
    INTO v_total_priority_minutes
    FROM public.subjects s
    WHERE s.user_id = p_user_id;
    
    -- Calcola fattore di scala
    v_scale_factor := (p_available_hours * 60.0) / GREATEST(v_total_priority_minutes, 1);
    
    -- Genera piano distribuito
    RETURN QUERY
    WITH subject_times AS (
        SELECT 
            s.id,
            s.name,
            s.priority,
            (SELECT suggested_minutes FROM calculate_optimal_study_time(p_user_id, s.id, 'study')) as base_minutes
        FROM public.subjects s
        WHERE s.user_id = p_user_id
    ),
    distributed AS (
        SELECT 
            name as subject_name,
            (base_minutes * v_scale_factor * priority / 5.0)::INTEGER as adjusted_minutes,
            priority::DECIMAL as priority_score,
            ROW_NUMBER() OVER (ORDER BY priority DESC, base_minutes DESC) as rank
        FROM subject_times
    )
    SELECT 
        ((rank - 1) % 5 + 1)::INTEGER as day_of_week, -- Distribuisci su 5 giorni
        subject_name,
        adjusted_minutes as suggested_minutes,
        priority_score,
        CASE 
            WHEN adjusted_minutes <= 30 THEN 'short'
            WHEN adjusted_minutes <= 60 THEN 'medium'
            ELSE 'long'
        END as time_slot
    FROM distributed
    ORDER BY day_of_week, priority_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indici per performance
CREATE INDEX idx_subjects_user_id ON public.subjects(user_id);
CREATE INDEX idx_lessons_user_subject ON public.lessons(user_id, subject_id);
CREATE INDEX idx_lessons_status ON public.lessons(status);
CREATE INDEX idx_tracking_user_subject ON public.study_time_tracking(user_id, subject_id);
CREATE INDEX idx_tracking_created ON public.study_time_tracking(created_at);
CREATE INDEX idx_tracking_metadata ON public.study_time_tracking USING GIN (metadata);
CREATE INDEX idx_predictions_user_date ON public.study_predictions(user_id, prediction_date);

-- RLS Policies
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_time_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_configurations ENABLE ROW LEVEL SECURITY;

-- Utenti possono gestire le proprie materie
CREATE POLICY "Users manage own subjects" ON public.subjects
    FOR ALL USING (auth.uid() = user_id);

-- Utenti possono gestire le proprie lezioni
CREATE POLICY "Users manage own lessons" ON public.lessons
    FOR ALL USING (auth.uid() = user_id);

-- Utenti possono vedere e inserire propri tracking
CREATE POLICY "Users manage own tracking" ON public.study_time_tracking
    FOR ALL USING (auth.uid() = user_id);

-- Utenti possono vedere le proprie predizioni
CREATE POLICY "Users view own predictions" ON public.study_predictions
    FOR SELECT USING (auth.uid() = user_id);

-- Solo admin possono gestire configurazioni globali
CREATE POLICY "Admins manage configurations" ON public.study_configurations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_settings 
            WHERE user_id = auth.uid() 
            AND (settings->>'role' = 'admin')
        )
    );

-- Tutti possono leggere configurazioni globali
CREATE POLICY "Everyone can read configurations" ON public.study_configurations
    FOR SELECT USING (true);