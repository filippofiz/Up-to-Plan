import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from './src/config/supabase';
import { Session } from '@supabase/supabase-js';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import MainTabs from './src/navigation/MainTabs';
import SubjectsConfigScreen from './src/screens/SubjectsConfigScreen';
import StudyTrackingScreen from './src/screens/StudyTrackingScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import StudyFocusScreen from './src/screens/StudyFocusScreen';
import StudyEvaluationScreen from './src/screens/StudyEvaluationScreen';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from './src/constants/colors';

const Stack = createStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Controlla la sessione corrente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Ascolta i cambiamenti di autenticazione
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="SubjectsConfig" component={SubjectsConfigScreen} />
            <Stack.Screen name="StudyTracking" component={StudyTrackingScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen 
              name="StudyFocus" 
              component={StudyFocusScreen}
              options={{ 
                headerShown: false,
                gestureEnabled: false // Impedisce di uscire accidentalmente
              }}
            />
            <Stack.Screen 
              name="StudyEvaluation" 
              component={StudyEvaluationScreen as any}
              options={{ 
                headerShown: false,
                presentation: 'modal' // Presenta come modal
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
