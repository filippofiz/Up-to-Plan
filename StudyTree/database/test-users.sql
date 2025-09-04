-- Script per creare utenti di test
-- NOTA: Questo crea solo i profili, gli utenti devono essere creati prima tramite Supabase Auth

-- Prima crea gli utenti dal Dashboard Supabase o tramite l'app, poi esegui questo per creare i profili

-- Esempio: dopo aver creato un utente con email studente1@test.com
-- Sostituisci 'USER_ID_HERE' con l'ID reale dell'utente creato

/*
INSERT INTO public.profiles (id, username, xp, level, total_study_time, trees_grown, trees_killed)
VALUES 
  ('USER_ID_1', 'StudenTester1', 250, 3, 625, 12, 2),
  ('USER_ID_2', 'StudenTester2', 450, 5, 1200, 24, 5);
*/

-- Per disabilitare la conferma email per test:
-- Vai su Dashboard → Authentication → Settings → Email Auth
-- Disabilita "Enable email confirmations"