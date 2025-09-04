-- Gestione ruoli admin per il sistema

-- Tabella per gestire i ruoli utente (admin/studente)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('admin', 'student')) DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Abilita RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono vedere i ruoli (per verificare admin)
CREATE POLICY "Everyone can view roles" ON public.user_roles
    FOR SELECT USING (true);

-- Policy: solo admin esistenti possono modificare ruoli
CREATE POLICY "Only admins can manage roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Inserisci primo admin (sostituisci con l'email del tuo account admin)
-- IMPORTANTE: Esegui questo comando DOPO aver creato la tabella
/*
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@example.com'  -- Sostituisci con la tua email
ON CONFLICT (user_id) DO NOTHING;
*/

-- Funzione helper per verificare se un utente è admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = is_admin.user_id
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aggiorna la policy per study_configurations usando la nuova tabella
DROP POLICY IF EXISTS "Admins manage configurations" ON public.study_configurations;

CREATE POLICY "Admins manage configurations" ON public.study_configurations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Vista per ottenere informazioni complete utente con ruolo
CREATE OR REPLACE VIEW public.user_profiles_with_role AS
SELECT 
    p.*,
    r.role,
    us.settings
FROM public.profiles p
LEFT JOIN public.user_roles r ON p.id = r.user_id
LEFT JOIN public.user_settings us ON p.id = us.user_id;