import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configurazione Supabase
const supabaseUrl = 'https://dpyxwjxuuqlpfrkrdhea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRweXh3anh1dXFscGZya3JkaGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MjY0MDMsImV4cCI6MjA3MjUwMjQwM30.wJo62DibGNZoo3Kedb7lxrtIgtt1aYRljt3usS_m7ng';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});