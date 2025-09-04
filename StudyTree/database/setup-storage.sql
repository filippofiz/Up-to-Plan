-- ====================================================================
-- CONFIGURAZIONE SUPABASE STORAGE PER FOTO PAGINE STUDIATE
-- ====================================================================

-- 1. Crea il bucket per le foto di studio (se non esiste)
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-photos', 'study-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy per permettere agli utenti di caricare le proprie foto
CREATE POLICY "Users can upload their own study photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'study-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Policy per permettere agli utenti di vedere le proprie foto
CREATE POLICY "Users can view their own study photos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'study-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Policy per permettere agli utenti di eliminare le proprie foto
CREATE POLICY "Users can delete their own study photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'study-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Crea tabella per salvare le valutazioni AI
CREATE TABLE IF NOT EXISTS public.study_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_name VARCHAR(100) NOT NULL,
    study_date DATE NOT NULL,
    actual_duration INTEGER NOT NULL, -- in minuti
    notes TEXT,
    photo_urls TEXT[], -- Array di URL delle foto
    ai_evaluation JSONB, -- Risposta completa dell'AI in JSON
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 10),
    completeness_score INTEGER CHECK (completeness_score >= 1 AND completeness_score <= 10),
    clarity_score INTEGER CHECK (clarity_score >= 1 AND clarity_score <= 10),
    preparation_score INTEGER CHECK (preparation_score >= 1 AND preparation_score <= 10),
    recommendation VARCHAR(20) CHECK (recommendation IN ('pronto', 'ripassa', 'studia_ancora')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_study_evaluations_user_date ON public.study_evaluations(user_id, study_date);
CREATE INDEX IF NOT EXISTS idx_study_evaluations_subject ON public.study_evaluations(user_id, subject_name);
CREATE INDEX IF NOT EXISTS idx_study_evaluations_preparation ON public.study_evaluations(preparation_score);

-- 7. RLS (Row Level Security) per study_evaluations
ALTER TABLE public.study_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evaluations" ON public.study_evaluations
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evaluations" ON public.study_evaluations
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evaluations" ON public.study_evaluations
FOR UPDATE USING (auth.uid() = user_id);

-- 8. Aggiorna tabella daily_study_tracking per includere valutazioni e sessioni saltate
ALTER TABLE public.daily_study_tracking 
ADD COLUMN IF NOT EXISTS evaluation_id UUID REFERENCES public.study_evaluations(id) ON DELETE SET NULL;

ALTER TABLE public.daily_study_tracking 
ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT FALSE;

-- ====================================================================
-- ISTRUZIONI:
-- 1. Esegui questo SQL su Supabase
-- 2. Verifica che il bucket "study-photos" sia creato
-- 3. Le policy permettono agli utenti di gestire solo le proprie foto
-- ====================================================================