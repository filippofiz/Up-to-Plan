-- Tabella per le impostazioni utente e configurazione settimana tipo
CREATE TABLE public.user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL, -- Configurazione completa in JSON
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Esempio struttura JSON per settings:
/*
{
  "user_name": "Mario",
  "school_name": "Liceo Scientifico Einstein",
  "class_year": 3,
  "school_schedule": [
    {
      "day": "lun",
      "startTime": "08:00",
      "endTime": "13:00",
      "enabled": true
    }
  ],
  "commute_info": {
    "morningDuration": 15,
    "afternoonDuration": 15,
    "transport": "bus"
  },
  "recurring_activities": [
    {
      "id": "123",
      "name": "Calcio",
      "type": "sport",
      "day": "mar",
      "startTime": "16:00",
      "duration": 90,
      "icon": "⚽"
    }
  ]
}
*/

-- Abilita RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: utenti possono gestire solo le proprie impostazioni
CREATE POLICY "Users manage own settings" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id);

-- Funzione per ottenere disponibilità giornaliera
CREATE OR REPLACE FUNCTION get_daily_availability(user_id UUID, target_date DATE)
RETURNS JSONB AS $$
DECLARE
    settings_json JSONB;
    day_name TEXT;
    school_schedule JSONB;
    activities JSONB;
    result JSONB;
BEGIN
    -- Ottieni giorno della settimana (lun, mar, etc)
    day_name := LOWER(SUBSTRING(to_char(target_date, 'Day'), 1, 3));
    
    -- Ottieni settings utente
    SELECT settings INTO settings_json
    FROM public.user_settings
    WHERE user_settings.user_id = get_daily_availability.user_id;
    
    IF settings_json IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Estrai orario scolastico per quel giorno
    SELECT jsonb_agg(item)
    INTO school_schedule
    FROM jsonb_array_elements(settings_json->'school_schedule') item
    WHERE item->>'day' = day_name AND (item->>'enabled')::boolean = true;
    
    -- Estrai attività ricorrenti per quel giorno
    SELECT jsonb_agg(item)
    INTO activities
    FROM jsonb_array_elements(settings_json->'recurring_activities') item
    WHERE item->>'day' = day_name;
    
    -- Costruisci risultato
    result := jsonb_build_object(
        'date', target_date,
        'day', day_name,
        'school', school_schedule,
        'activities', activities,
        'commute', settings_json->'commute_info'
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;