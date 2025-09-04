-- Funzione per incrementare alberi morti
CREATE OR REPLACE FUNCTION increment_trees_killed(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET trees_killed = trees_killed + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per aggiornare statistiche utente
CREATE OR REPLACE FUNCTION update_user_stats(
    user_id UUID,
    xp_to_add INTEGER,
    study_time_to_add INTEGER
)
RETURNS void AS $$
DECLARE
    current_xp INTEGER;
    new_level INTEGER;
BEGIN
    -- Aggiorna XP, tempo studio e alberi cresciuti
    UPDATE public.profiles 
    SET 
        xp = xp + xp_to_add,
        total_study_time = total_study_time + study_time_to_add,
        trees_grown = trees_grown + 1
    WHERE id = user_id
    RETURNING xp INTO current_xp;
    
    -- Calcola e aggiorna il livello
    new_level := (current_xp / 100) + 1;
    
    UPDATE public.profiles 
    SET level = new_level
    WHERE id = user_id;
    
    -- Aggiorna classifica settimanale
    INSERT INTO public.weekly_leaderboard (user_id, week_start, xp_earned, study_time)
    VALUES (
        user_id,
        date_trunc('week', CURRENT_DATE),
        xp_to_add,
        study_time_to_add
    )
    ON CONFLICT (user_id, week_start) 
    DO UPDATE SET 
        xp_earned = weekly_leaderboard.xp_earned + EXCLUDED.xp_earned,
        study_time = weekly_leaderboard.study_time + EXCLUDED.study_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per ottenere la classifica settimanale
CREATE OR REPLACE FUNCTION get_weekly_leaderboard()
RETURNS TABLE (
    rank BIGINT,
    username VARCHAR(50),
    xp_earned INTEGER,
    study_time INTEGER,
    avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY wl.xp_earned DESC) as rank,
        p.username,
        wl.xp_earned,
        wl.study_time,
        p.avatar_url
    FROM public.weekly_leaderboard wl
    JOIN public.profiles p ON wl.user_id = p.id
    WHERE wl.week_start = date_trunc('week', CURRENT_DATE)
    ORDER BY wl.xp_earned DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;