-- IMPORTANTE: Esegui questi comandi nel Dashboard Supabase
-- per disabilitare la conferma email durante i test

-- 1. Vai su Dashboard Supabase → Authentication → Settings → Email Auth
-- 2. Disabilita "Enable email confirmations"

-- Oppure usa questo comando SQL per aggiornare automaticamente gli utenti:
-- Questo marca tutti gli utenti come email confermata
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- Per test rapidi, puoi creare utenti direttamente:
/*
-- Esempio creazione utente test
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'test@test.com',
    crypt('Test123!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
);
*/