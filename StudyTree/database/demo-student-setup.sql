-- ====================================================================
-- SETUP UTENTE DEMO - STUDENTE LICEO SCIENTIFICO
-- Email: prova@studente.it
-- Password: 123456
-- UUID: 2d3f63f9-a03e-411f-b050-149b8a282e71
-- ====================================================================

-- NOTA: Prima esegui add-subject-id-to-exams.sql per aggiungere subject_id

DO $$
DECLARE
    v_user_id UUID := '2d3f63f9-a03e-411f-b050-149b8a282e71';
BEGIN

-- 0. CREA PROFILO UTENTE (necessario per foreign keys)
INSERT INTO profiles (id, username, xp, level, total_study_time, trees_grown, trees_killed)
VALUES (
    v_user_id, 
    'mario_rossi',
    100,
    1,
    0,
    0,
    0
)
ON CONFLICT (id) DO UPDATE
SET username = EXCLUDED.username;

-- 1. CONFIGURAZIONE TIPO SCUOLA
INSERT INTO school_config (user_id, school_level, school_type, year)
VALUES (v_user_id, 'superiore', 'liceo_scientifico', 4)
ON CONFLICT (user_id) DO UPDATE 
SET school_level = EXCLUDED.school_level,
    school_type = EXCLUDED.school_type,
    year = EXCLUDED.year;

-- 2. MATERIE LICEO SCIENTIFICO 4° ANNO
INSERT INTO subjects (user_id, name, color, difficulty, priority, type, weekly_hours) VALUES
(v_user_id, 'Matematica', '#e74c3c', 8, 9, 'teorica', 5),
(v_user_id, 'Fisica', '#3498db', 8, 8, 'mista', 4),
(v_user_id, 'Italiano', '#2ecc71', 6, 7, 'teorica', 4),
(v_user_id, 'Latino', '#f39c12', 7, 6, 'teorica', 3),
(v_user_id, 'Inglese', '#9b59b6', 5, 7, 'mista', 3),
(v_user_id, 'Storia', '#1abc9c', 5, 6, 'teorica', 2),
(v_user_id, 'Filosofia', '#34495e', 7, 7, 'teorica', 3),
(v_user_id, 'Scienze', '#e67e22', 6, 7, 'mista', 3),
(v_user_id, 'Disegno e Storia Arte', '#95a5a6', 4, 5, 'pratica', 2),
(v_user_id, 'Educazione Fisica', '#16a085', 2, 3, 'pratica', 2),
(v_user_id, 'Religione', '#8e44ad', 3, 3, 'teorica', 1)
ON CONFLICT (user_id, name) DO NOTHING;

-- 3. ORARIO SCOLASTICO COMPLETO (8:00 - 14:00)
-- LUNEDÌ
INSERT INTO school_schedule (user_id, day_of_week, start_time, end_time, subject_name, is_break) VALUES
(v_user_id, 'Lunedì', '08:00', '09:00', 'Matematica', false),
(v_user_id, 'Lunedì', '09:00', '10:00', 'Matematica', false),
(v_user_id, 'Lunedì', '10:00', '10:15', 'Intervallo', true),
(v_user_id, 'Lunedì', '10:15', '11:00', 'Fisica', false),
(v_user_id, 'Lunedì', '11:00', '12:00', 'Italiano', false),
(v_user_id, 'Lunedì', '12:00', '13:00', 'Latino', false),
(v_user_id, 'Lunedì', '13:00', '14:00', 'Inglese', false)
ON CONFLICT DO NOTHING;

-- MARTEDÌ
INSERT INTO school_schedule (user_id, day_of_week, start_time, end_time, subject_name, is_break) VALUES
(v_user_id, 'Martedì', '08:00', '09:00', 'Filosofia', false),
(v_user_id, 'Martedì', '09:00', '10:00', 'Storia', false),
(v_user_id, 'Martedì', '10:00', '10:15', 'Intervallo', true),
(v_user_id, 'Martedì', '10:15', '11:00', 'Matematica', false),
(v_user_id, 'Martedì', '11:00', '12:00', 'Fisica', false),
(v_user_id, 'Martedì', '12:00', '13:00', 'Scienze', false),
(v_user_id, 'Martedì', '13:00', '14:00', 'Educazione Fisica', false)
ON CONFLICT DO NOTHING;

-- MERCOLEDÌ
INSERT INTO school_schedule (user_id, day_of_week, start_time, end_time, subject_name, is_break) VALUES
(v_user_id, 'Mercoledì', '08:00', '09:00', 'Italiano', false),
(v_user_id, 'Mercoledì', '09:00', '10:00', 'Italiano', false),
(v_user_id, 'Mercoledì', '10:00', '10:15', 'Intervallo', true),
(v_user_id, 'Mercoledì', '10:15', '11:00', 'Latino', false),
(v_user_id, 'Mercoledì', '11:00', '12:00', 'Matematica', false),
(v_user_id, 'Mercoledì', '12:00', '13:00', 'Inglese', false),
(v_user_id, 'Mercoledì', '13:00', '14:00', 'Disegno e Storia Arte', false)
ON CONFLICT DO NOTHING;

-- GIOVEDÌ
INSERT INTO school_schedule (user_id, day_of_week, start_time, end_time, subject_name, is_break) VALUES
(v_user_id, 'Giovedì', '08:00', '09:00', 'Fisica', false),
(v_user_id, 'Giovedì', '09:00', '10:00', 'Fisica', false),
(v_user_id, 'Giovedì', '10:00', '10:15', 'Intervallo', true),
(v_user_id, 'Giovedì', '10:15', '11:00', 'Filosofia', false),
(v_user_id, 'Giovedì', '11:00', '12:00', 'Scienze', false),
(v_user_id, 'Giovedì', '12:00', '13:00', 'Matematica', false),
(v_user_id, 'Giovedì', '13:00', '14:00', 'Religione', false)
ON CONFLICT DO NOTHING;

-- VENERDÌ
INSERT INTO school_schedule (user_id, day_of_week, start_time, end_time, subject_name, is_break) VALUES
(v_user_id, 'Venerdì', '08:00', '09:00', 'Latino', false),
(v_user_id, 'Venerdì', '09:00', '10:00', 'Storia', false),
(v_user_id, 'Venerdì', '10:00', '10:15', 'Intervallo', true),
(v_user_id, 'Venerdì', '10:15', '11:00', 'Inglese', false),
(v_user_id, 'Venerdì', '11:00', '12:00', 'Scienze', false),
(v_user_id, 'Venerdì', '12:00', '13:00', 'Filosofia', false),
(v_user_id, 'Venerdì', '13:00', '14:00', 'Disegno e Storia Arte', false)
ON CONFLICT DO NOTHING;

-- 4. CONFIGURAZIONE UTENTE (sport e trasporti)
INSERT INTO user_settings (user_id, settings)
VALUES (v_user_id, jsonb_build_object(
    'user_name', 'Mario Rossi',
    'configured_at', NOW(),
    'school_schedule', jsonb_build_array(
        jsonb_build_object('day', 'lun', 'enabled', true, 'start', '08:00', 'end', '14:00'),
        jsonb_build_object('day', 'mar', 'enabled', true, 'start', '08:00', 'end', '14:00'),
        jsonb_build_object('day', 'mer', 'enabled', true, 'start', '08:00', 'end', '14:00'),
        jsonb_build_object('day', 'gio', 'enabled', true, 'start', '08:00', 'end', '14:00'),
        jsonb_build_object('day', 'ven', 'enabled', true, 'start', '08:00', 'end', '14:00'),
        jsonb_build_object('day', 'sab', 'enabled', false),
        jsonb_build_object('day', 'dom', 'enabled', false)
    ),
    'commute_info', jsonb_build_object(
        'transport', 'mezzi',
        'duration', 30,
        'notes', 'Bus + Metro - 30 minuti andata e ritorno'
    ),
    'recurring_activities', jsonb_build_array(
        jsonb_build_object(
            'name', 'Pallavolo',
            'type', 'sport',
            'day', 'mar',
            'startTime', '17:00',
            'duration', 90,
            'commuteTime', 30
        ),
        jsonb_build_object(
            'name', 'Pallavolo',
            'type', 'sport',
            'day', 'gio',
            'startTime', '17:00',
            'duration', 90,
            'commuteTime', 30
        )
    )
))
ON CONFLICT (user_id) DO UPDATE 
SET settings = EXCLUDED.settings;

-- 5. AGGIUNGI ALCUNI ESAMI DI ESEMPIO (dopo aver aggiunto subject_id)
INSERT INTO exams (user_id, subject_id, subject, title, description, exam_date, difficulty, estimated_study_hours) 
SELECT 
    v_user_id,
    s.id,
    s.name,
    'Verifica ' || s.name,
    'Verifica programmata di ' || s.name,
    CURRENT_DATE + (RANDOM() * 30 + 7)::INT,
    CASE 
        WHEN s.difficulty >= 8 THEN 5
        WHEN s.difficulty >= 6 THEN 4
        WHEN s.difficulty >= 4 THEN 3
        ELSE 2
    END,
    CASE 
        WHEN s.difficulty >= 7 THEN 8 + (RANDOM() * 4)::INT
        WHEN s.difficulty >= 5 THEN 5 + (RANDOM() * 3)::INT
        ELSE 3 + (RANDOM() * 2)::INT
    END
FROM subjects s
WHERE s.user_id = v_user_id
  AND s.name IN ('Matematica', 'Fisica', 'Latino', 'Filosofia')
ON CONFLICT DO NOTHING;

-- 6. CREA ALCUNE SESSIONI DI STUDIO PASSATE
INSERT INTO study_sessions (user_id, start_time, end_time, duration, type, completed, xp_earned, tree_grown, created_at)
SELECT 
    v_user_id,
    CURRENT_TIMESTAMP - (RANDOM() * 30 || ' days')::INTERVAL,
    CURRENT_TIMESTAMP - (RANDOM() * 30 || ' days')::INTERVAL + (60 + (RANDOM() * 60)::INT || ' minutes')::INTERVAL,
    60 + (RANDOM() * 60)::INT,
    'pomodoro',
    true,
    10 + (RANDOM() * 20)::INT,
    RANDOM() > 0.7,
    CURRENT_TIMESTAMP - (RANDOM() * 30 || ' days')::INTERVAL
FROM generate_series(1, 10)
ON CONFLICT DO NOTHING;

-- 7. TRACKING TEMPI DI STUDIO PER MIGLIORARE LE PREDIZIONI
INSERT INTO daily_study_tracking (
    user_id,
    date,
    subject_id,
    planned_minutes,
    actual_minutes,
    difficulty_rating,
    productivity_rating,
    notes,
    completed,
    planned_start_time,
    planned_end_time
)
SELECT 
    v_user_id,
    CURRENT_DATE - (ROW_NUMBER() OVER())::INT,
    s.id,
    45 + (RANDOM() * 45)::INT,
    40 + (RANDOM() * 50)::INT,
    4 + (RANDOM() * 6)::INT,
    4 + (RANDOM() * 6)::INT,
    'Sessione di studio completata',
    true,
    '15:00'::TIME,
    '16:00'::TIME
FROM subjects s
WHERE s.user_id = v_user_id
ON CONFLICT DO NOTHING;

END $$;

-- ====================================================================
-- ISTRUZIONI:
-- 1. Prima esegui: add-subject-id-to-exams.sql
-- 2. Poi esegui questo file
-- 3. Login con: prova@studente.it / 123456
-- ====================================================================