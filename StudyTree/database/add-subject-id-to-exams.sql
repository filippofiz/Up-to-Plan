-- ====================================================================
-- AGGIUNGE COLONNA subject_id ALLA TABELLA exams
-- ====================================================================

-- 1. Aggiungi la colonna subject_id alla tabella exams
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- 2. Aggiorna gli exams esistenti per collegare le materie corrette
-- Questo collega gli esami esistenti alle materie basandosi sul nome nel campo subject
UPDATE public.exams e
SET subject_id = s.id
FROM public.subjects s
WHERE e.user_id = s.user_id
  AND e.subject = s.name
  AND e.subject_id IS NULL;

-- 3. Crea un indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_exams_subject_id ON public.exams(subject_id);

-- 4. (Opzionale) Se vuoi rendere subject_id obbligatorio in futuro
-- ALTER TABLE public.exams ALTER COLUMN subject_id SET NOT NULL;

-- ====================================================================
-- VERIFICA CHE FUNZIONI
-- ====================================================================
-- Per verificare:
-- SELECT e.exam_title, e.subject, s.name as subject_name, e.subject_id 
-- FROM exams e
-- LEFT JOIN subjects s ON e.subject_id = s.id
-- WHERE e.user_id = '2d3f63f9-a03e-411f-b050-149b8a282e71';