import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { supabase } from '../config/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';

export default function AuthScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Funzione per login
  const handleLogin = async () => {
    console.log('=== TENTATIVO LOGIN ===');
    console.log('Email:', email);
    
    if (!email || !password) {
      console.log('ERRORE: Campi mancanti');
      Alert.alert('Errore', 'Inserisci email e password');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('ERRORE LOGIN:', error.message);
        Alert.alert('Errore', error.message);
      } else {
        console.log('LOGIN SUCCESS! User:', data.user?.id);
        // Navigation gestita da onAuthStateChange in App.tsx
      }
    } catch (e) {
      console.log('ERRORE GENERALE LOGIN:', e);
      Alert.alert('Errore', 'Errore di connessione');
    }
    setLoading(false);
  };

  // Funzione per registrazione
  const handleSignUp = async () => {
    console.log('=== TENTATIVO REGISTRAZIONE ===');
    console.log('Email:', email);
    
    if (!email || !password) {
      console.log('ERRORE: Campi mancanti');
      Alert.alert('Errore', 'Inserisci email e password');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disabilita redirect email
          data: {
            email_confirm: false // Skip email confirmation per testing
          }
        }
      });

      if (error) {
        console.log('ERRORE SIGNUP:', error.message);
        Alert.alert('Errore', error.message);
      } else if (data.user) {
        console.log('USER CREATED:', data.user.id);
        
        // Crea il profilo utente con email come username temporaneo
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: email.split('@')[0], // Usa parte prima di @ come username
            xp: 0,
            level: 1,
          });

        if (profileError) {
          console.log('ERRORE PROFILO:', profileError);
          // Non bloccare se il profilo esiste già
          if (!profileError.message.includes('duplicate')) {
            Alert.alert('Errore', 'Impossibile creare il profilo');
            setLoading(false);
            return;
          }
        } else {
          console.log('PROFILO CREATO!');
        }
        
        // Login automatico dopo registrazione
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (!loginError) {
          console.log('AUTO-LOGIN SUCCESS!');
          // Navigation gestita da onAuthStateChange
        }
      }
    } catch (e) {
      console.log('ERRORE GENERALE SIGNUP:', e);
      Alert.alert('Errore', 'Errore di connessione');
    }
    setLoading(false);
  };

  return (
    <LinearGradient
      colors={[Colors.primaryGradient[0] + '15', Colors.secondaryGradient[0] + '15', '#FFFFFF']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.formContainer}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Up to Plan</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Bentornato!' : 'Inizia a studiare meglio!'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={Colors.gray400}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={Colors.gray400}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={isLogin ? handleLogin : handleSignUp}
            disabled={loading}
          >
            <LinearGradient
              colors={Colors.primaryGradient}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Caricamento...' : (isLogin ? 'Accedi' : 'Registrati')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.switchText}>
              {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 30,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    color: Colors.secondary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.gray400,
    marginBottom: 40,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  button: {
    marginTop: 10,
    borderRadius: 15,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: Colors.primary,
    fontSize: 14,
  },
});