import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import StudyPlanScreen from '../screens/StudyPlanScreen';
import TimerScreen from '../screens/TimerScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ConfigScreen from '../screens/ConfigScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SubjectsConfigScreen from '../screens/SubjectsConfigScreen';
import StudyTrackingScreen from '../screens/StudyTrackingScreen';
import SchoolScheduleScreen from '../screens/SchoolScheduleScreen';
import SchoolTypeConfigScreen from '../screens/SchoolTypeConfigScreen';
import DailyTrackingScreen from '../screens/DailyTrackingScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack per la sezione Config che include più schermi
function ConfigStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ConfigMain" 
        component={ConfigScreen} 
        options={{ 
          title: '⚙️ Configurazione',
          headerStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.borderLight,
          },
          headerTintColor: Colors.secondary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen 
        name="SubjectsConfig" 
        component={SubjectsConfigScreen} 
        options={{ 
          title: '📚 Gestione Materie',
          headerStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.borderLight,
          },
          headerTintColor: Colors.secondary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerBackTitle: 'Config'
        }}
      />
      <Stack.Screen 
        name="SchoolSchedule" 
        component={SchoolScheduleScreen} 
        options={{ 
          title: '🗓️ Orario Scolastico',
          headerStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.borderLight,
          },
          headerTintColor: Colors.secondary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerBackTitle: 'Config'
        }}
      />
      <Stack.Screen 
        name="SchoolTypeConfig" 
        component={SchoolTypeConfigScreen} 
        options={{ 
          title: '🎓 Tipo di Scuola',
          headerStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.borderLight,
          },
          headerTintColor: Colors.secondary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerBackTitle: 'Config'
        }}
      />
      <Stack.Screen 
        name="DailyTracking" 
        component={DailyTrackingScreen} 
        options={{ 
          title: '📝 Tracking Giornaliero',
          headerStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.borderLight,
          },
          headerTintColor: Colors.secondary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerBackTitle: 'Config'
        }}
      />
    </Stack.Navigator>
  );
}

export default function MainTabs() {
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    checkConfigStatus();
    const interval = setInterval(checkConfigStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkConfigStatus = async () => {
    try {
      const status = await AsyncStorage.getItem('config_status');
      if (status) {
        const { isConfigured } = JSON.parse(status);
        setIsConfigured(isConfigured);
      } else {
        setIsConfigured(false);
      }
    } catch (error) {
      console.log('Errore check config:', error);
    }
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'StudyPlan') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Tracking') {
            return <MaterialIcons name={focused ? 'track-changes' : 'query-stats'} size={size} color={color} />;
          } else if (route.name === 'Timer') {
            iconName = focused ? 'timer' : 'timer-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Config') {
            iconName = focused ? 'settings' : 'settings-outline';
            if (!isConfigured) {
              return (
                <View>
                  <Ionicons name={iconName} size={size} color={color} />
                  <View style={{
                    position: 'absolute',
                    right: -6,
                    top: -3,
                    backgroundColor: '#EF4444',
                    borderRadius: 6,
                    width: 12,
                    height: 12,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>!</Text>
                  </View>
                </View>
              );
            }
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: Colors.borderLight,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: Colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.borderLight,
        },
        headerTintColor: Colors.secondary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="StudyPlan" 
        component={StudyPlanScreen} 
        options={{ 
          title: 'Piano',
          headerTitle: '📚 Piano di Studio'
        }} 
      />
      <Tab.Screen 
        name="Timer" 
        component={TimerScreen} 
        options={{ 
          title: 'Timer',
          headerTitle: '⏱️ Focus Timer'
        }} 
      />
      <Tab.Screen 
        name="Tracking" 
        component={StudyTrackingScreen} 
        options={{ 
          title: 'Tracking',
          headerTitle: '📊 Tracking Studio'
        }} 
      />
      <Tab.Screen 
        name="Calendar" 
        component={CalendarScreen} 
        options={{ 
          title: 'Calendario',
          headerTitle: '📅 Calendario'
        }} 
      />
      <Tab.Screen 
        name="Config" 
        component={ConfigStack} 
        options={{ 
          title: 'Config',
          headerShown: false,
        }} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ 
          title: 'Profilo',
          headerTitle: '👤 Profilo'
        }} 
      />
    </Tab.Navigator>
  );
}