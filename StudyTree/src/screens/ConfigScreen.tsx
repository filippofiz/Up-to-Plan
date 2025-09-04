import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConfigStatus {
  isConfigured: boolean;
  hasSchoolSchedule: boolean;
  hasCommuteInfo: boolean;
  hasActivities: boolean;
  lastUpdated?: string;
  userName?: string;
}

export default function ConfigScreen({ navigation }: any) {
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    isConfigured: false,
    hasSchoolSchedule: false,
    hasCommuteInfo: false,
    hasActivities: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConfiguration();
  }, []);

  // Quando torna dal wizard, ricarica
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      checkConfiguration();
    });
    return unsubscribe;
  }, [navigation]);

  const checkConfiguration = async () => {
    console.log('Controllo configurazione...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Controlla se esiste configurazione nel database
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .single();

      if (data && data.settings) {
        const settings = data.settings;
        console.log('Configurazione trovata:', settings);
        
        // Verifica completezza configurazione
        const hasSchool = settings.school_schedule?.some((s: any) => s.enabled) || false;
        const hasCommute = settings.commute_info?.transport ? true : false;
        const hasActivities = settings.recurring_activities?.length > 0 || false;
        
        setConfigStatus({
          isConfigured: hasSchool && hasCommute,
          hasSchoolSchedule: hasSchool,
          hasCommuteInfo: hasCommute,
          hasActivities: hasActivities,
          lastUpdated: settings.configured_at,
          userName: settings.user_name,
        });

        // Salva stato in AsyncStorage per accesso rapido
        await AsyncStorage.setItem('config_status', JSON.stringify({
          isConfigured: hasSchool && hasCommute,
          timestamp: Date.now()
        }));
      } else {
        console.log('Nessuna configurazione trovata');
        setConfigStatus({
          isConfigured: false,
          hasSchoolSchedule: false,
          hasCommuteInfo: false,
          hasActivities: false,
        });

        // Salva stato non configurato
        await AsyncStorage.setItem('config_status', JSON.stringify({
          isConfigured: false,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Errore controllo configurazione:', error);
    }
    
    setLoading(false);
  };

  const startConfiguration = () => {
    navigation.navigate('Onboarding');
  };

  const editConfiguration = () => {
    navigation.navigate('Onboarding', { editMode: true });
  };

  const resetConfiguration = () => {
    Alert.alert(
      '⚠️ Reset Configurazione',
      'Vuoi davvero resettare tutta la configurazione?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from('user_settings')
                .delete()
                .eq('user_id', user.id);
              
              await AsyncStorage.removeItem('config_status');
              checkConfiguration();
              Alert.alert('✅', 'Configurazione resettata');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient colors={Colors.backgroundGradient as any} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Status */}
        <View style={styles.statusCard}>
          {!configStatus.isConfigured ? (
            <>
              <View style={styles.warningBadge}>
                <Ionicons name="warning" size={24} color={Colors.warning} />
                <Text style={styles.warningText}>Configurazione Richiesta</Text>
              </View>
              <Text style={styles.warningDescription}>
                Per generare piani di studio personalizzati, devi prima configurare
                la tua settimana tipo con orari scolastici e impegni.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                <Text style={styles.successText}>Configurazione Completa</Text>
              </View>
              {configStatus.userName && (
                <Text style={styles.welcomeText}>
                  Ciao {configStatus.userName}! La tua settimana è configurata.
                </Text>
              )}
            </>
          )}
        </View>

        {/* Checklist Status */}
        <View style={styles.checklistCard}>
          <Text style={styles.sectionTitle}>📋 Stato Configurazione</Text>
          
          <View style={styles.checkItem}>
            <Ionicons 
              name={configStatus.hasSchoolSchedule ? "checkbox" : "square-outline"} 
              size={24} 
              color={configStatus.hasSchoolSchedule ? Colors.primary : Colors.gray400} 
            />
            <Text style={[
              styles.checkText,
              configStatus.hasSchoolSchedule && styles.checkTextComplete
            ]}>
              Orario Scolastico
            </Text>
            {configStatus.hasSchoolSchedule && (
              <Ionicons name="checkmark" size={20} color={Colors.primary} />
            )}
          </View>

          <View style={styles.checkItem}>
            <Ionicons 
              name={configStatus.hasCommuteInfo ? "checkbox" : "square-outline"} 
              size={24} 
              color={configStatus.hasCommuteInfo ? Colors.primary : Colors.gray400} 
            />
            <Text style={[
              styles.checkText,
              configStatus.hasCommuteInfo && styles.checkTextComplete
            ]}>
              Trasferimenti Casa-Scuola
            </Text>
            {configStatus.hasCommuteInfo && (
              <Ionicons name="checkmark" size={20} color={Colors.primary} />
            )}
          </View>

          <View style={styles.checkItem}>
            <Ionicons 
              name={configStatus.hasActivities ? "checkbox" : "square-outline"} 
              size={24} 
              color={configStatus.hasActivities ? Colors.primary : Colors.gray400} 
            />
            <Text style={[
              styles.checkText,
              configStatus.hasActivities && styles.checkTextComplete
            ]}>
              Attività Ricorrenti (Opzionale)
            </Text>
            {configStatus.hasActivities && (
              <Ionicons name="checkmark" size={20} color={Colors.primary} />
            )}
          </View>
        </View>

        {/* Quick Actions - Nuove funzionalità */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>⚡ Azioni Rapide</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('SchoolTypeConfig')}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="school" size={24} color={Colors.primary} />
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Tipo di Scuola</Text>
                <Text style={styles.actionDescription}>Media o superiore (classico, scientifico...)</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('SchoolSchedule')}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="calendar" size={24} color={Colors.primary} />
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Orario Scolastico</Text>
                <Text style={styles.actionDescription}>Configura l'orario dettagliato delle lezioni</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('SubjectsConfig')}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="book" size={24} color={Colors.primary} />
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Gestisci Materie</Text>
                <Text style={styles.actionDescription}>Configura le tue materie di studio</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              const today = new Date().toISOString().split('T')[0];
              navigation.navigate('DailyTracking', { date: today });
            }}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="create" size={24} color={Colors.success} />
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Tracking Giornaliero</Text>
                <Text style={styles.actionDescription}>Inserisci tempi effettivi di oggi</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <Text style={styles.infoTitle}>Perché è importante?</Text>
          </View>
          <Text style={styles.infoText}>
            La configurazione permette all'app di:
          </Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Calcolare quando hai tempo per studiare
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Non sovrapporsi con sport o altri impegni
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Distribuire lo studio in modo ottimale
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.bulletText}>
              Considerare i tempi di spostamento
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {!configStatus.isConfigured ? (
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={startConfiguration}
          >
            <LinearGradient
              colors={Colors.primaryGradient as any}
              style={styles.buttonGradient}
            >
              <Ionicons name="settings" size={20} color="white" />
              <Text style={styles.buttonText}>Inizia Configurazione</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={editConfiguration}
            >
              <Ionicons name="pencil" size={20} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>Modifica Configurazione</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.dangerButton}
              onPress={resetConfiguration}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
              <Text style={styles.dangerButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Last Updated */}
        {configStatus.lastUpdated && (
          <Text style={styles.lastUpdated}>
            Ultima modifica: {new Date(configStatus.lastUpdated).toLocaleDateString('it-IT')}
          </Text>
        )}

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Suggerimenti</Text>
          <Text style={styles.tipText}>
            • Aggiorna la configurazione se cambi orario scolastico
          </Text>
          <Text style={styles.tipText}>
            • Aggiungi tutti gli sport e corsi che frequenti
          </Text>
          <Text style={styles.tipText}>
            • Indica i tempi reali di spostamento per una pianificazione accurata
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  warningText: {
    color: Colors.warning,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  warningDescription: {
    color: Colors.gray600,
    fontSize: 14,
    lineHeight: 20,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  successText: {
    color: Colors.primary,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  welcomeText: {
    color: Colors.gray600,
    fontSize: 14,
  },
  checklistCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 15,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: Colors.gray600,
  },
  checkTextComplete: {
    color: Colors.secondary,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginLeft: 8,
  },
  infoText: {
    color: Colors.gray600,
    fontSize: 14,
    marginBottom: 10,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  bullet: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  bulletText: {
    flex: 1,
    color: Colors.gray600,
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  buttonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  dangerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  dangerButtonText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  lastUpdated: {
    textAlign: 'center',
    color: Colors.gray400,
    fontSize: 12,
    marginBottom: 20,
  },
  tipsCard: {
    backgroundColor: Colors.gray50,
    borderRadius: 15,
    padding: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 10,
  },
  tipText: {
    color: Colors.gray600,
    fontSize: 14,
    marginBottom: 5,
    lineHeight: 20,
  },
  quickActionsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    padding: 16,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: Colors.gray600,
  },
});