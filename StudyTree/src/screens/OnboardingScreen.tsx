import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';
import TimePicker from '../components/TimePicker';

type Step = 'welcome' | 'school' | 'commute' | 'activities' | 'summary';
type DayOfWeek = 'lun' | 'mar' | 'mer' | 'gio' | 'ven' | 'sab' | 'dom';

interface SchoolSchedule {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

interface CommuteInfo {
  morningDuration: number; // minuti
  afternoonDuration: number; // minuti
  transport: 'piedi' | 'bici' | 'bus' | 'auto' | 'treno';
}

interface RecurringActivity {
  id: string;
  name: string;
  type: 'sport' | 'musica' | 'corso' | 'altro';
  day: DayOfWeek;
  startTime: string;
  duration: number; // minuti
  commuteTime?: number; // tempo di spostamento in minuti
  icon: string;
}

export default function OnboardingScreen({ navigation, route }: any) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [userName, setUserName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [classYear, setClassYear] = useState('1');
  const editMode = route?.params?.editMode || false;
  
  // Orario scolastico
  const [schoolSchedule, setSchoolSchedule] = useState<SchoolSchedule[]>([
    { day: 'lun', startTime: '08:00', endTime: '13:00', enabled: true },
    { day: 'mar', startTime: '08:00', endTime: '13:00', enabled: true },
    { day: 'mer', startTime: '08:00', endTime: '13:00', enabled: true },
    { day: 'gio', startTime: '08:00', endTime: '13:00', enabled: true },
    { day: 'ven', startTime: '08:00', endTime: '13:00', enabled: true },
    { day: 'sab', startTime: '08:00', endTime: '13:00', enabled: false },
    { day: 'dom', startTime: '08:00', endTime: '13:00', enabled: false },
  ]);
  
  // Info trasferimento
  const [commuteInfo, setCommuteInfo] = useState<CommuteInfo>({
    morningDuration: 15,
    afternoonDuration: 15,
    transport: 'bus',
  });
  
  // Attività ricorrenti
  const [activities, setActivities] = useState<RecurringActivity[]>([]);
  const [newActivity, setNewActivity] = useState({
    name: '',
    type: 'sport' as const,
    day: 'lun' as DayOfWeek,
    startTime: '16:00',
    duration: 60,
    commuteTime: 15,
  });

  const nextStep = () => {
    const steps: Step[] = ['welcome', 'school', 'commute', 'activities', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const previousStep = () => {
    const steps: Step[] = ['welcome', 'school', 'commute', 'activities', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const addActivity = () => {
    if (!newActivity.name) {
      Alert.alert('Errore', 'Inserisci il nome dell\'attività');
      return;
    }

    const activityIcons = {
      sport: '⚽',
      musica: '🎵',
      corso: '📚',
      altro: '📌',
    };

    const activity: RecurringActivity = {
      id: Date.now().toString(),
      ...newActivity,
      icon: activityIcons[newActivity.type],
    };

    setActivities([...activities, activity]);
    setNewActivity({
      name: '',
      type: 'sport',
      day: 'lun',
      startTime: '16:00',
      duration: 60,
    });
  };

  const removeActivity = (id: string) => {
    setActivities(activities.filter(a => a.id !== id));
  };

  const saveConfiguration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Salva configurazione nel database
      const configuration = {
        user_id: user.id,
        user_name: userName,
        school_name: schoolName,
        class_year: parseInt(classYear),
        school_schedule: schoolSchedule,
        commute_info: commuteInfo,
        recurring_activities: activities,
        configured_at: new Date().toISOString(),
      };

      // Salva in una tabella user_settings
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings: configuration,
        });

      if (!error) {
        Alert.alert(
          '🎉 Configurazione Completata!',
          'Ora posso creare piani di studio perfetti per te!',
          [{ text: 'Inizia!', onPress: () => navigation.navigate('Main') }]
        );
      }
    } catch (error) {
      console.error('Errore salvataggio configurazione:', error);
      Alert.alert('Errore', 'Impossibile salvare la configurazione');
    }
  };

  const getDayName = (day: DayOfWeek) => {
    const names = {
      lun: 'Lunedì',
      mar: 'Martedì',
      mer: 'Mercoledì',
      gio: 'Giovedì',
      ven: 'Venerdì',
      sab: 'Sabato',
      dom: 'Domenica',
    };
    return names[day];
  };

  const getTransportIcon = (transport: string) => {
    const icons = {
      piedi: '🚶',
      bici: '🚴',
      bus: '🚌',
      auto: '🚗',
      treno: '🚂',
    };
    return icons[transport as keyof typeof icons] || '🚶';
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['welcome', 'school', 'commute', 'activities', 'summary'].map((step, index) => (
        <View key={step} style={styles.stepDot}>
          <View style={[
            styles.dot,
            currentStep === step && styles.dotActive,
            index < ['welcome', 'school', 'commute', 'activities', 'summary'].indexOf(currentStep) && styles.dotCompleted
          ]} />
        </View>
      ))}
    </View>
  );

  const handleClose = () => {
    Alert.alert(
      'Chiudi configurazione',
      editMode ? 'Vuoi uscire senza salvare le modifiche?' : 'Vuoi uscire dalla configurazione? Potrai completarla più tardi.',
      [
        { text: 'Continua', style: 'cancel' },
        { 
          text: 'Esci', 
          style: 'destructive',
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  return (
    <LinearGradient colors={[Colors.primaryGradient[0] + '15', Colors.secondaryGradient[0] + '15']} style={styles.container}>
      {/* Header con pulsante chiudi */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editMode ? 'Modifica Configurazione' : 'Configurazione Iniziale'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderStepIndicator()}

          {/* Step 1: Welcome */}
          {currentStep === 'welcome' && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>👋</Text>
              <Text style={styles.title}>Benvenuto in Up to Plan!</Text>
              <Text style={styles.subtitle}>
                Configuriamo insieme la tua settimana tipo{'\n'}
                per creare il piano di studio perfetto
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Come ti chiami?</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Il tuo nome"
                  value={userName}
                  onChangeText={setUserName}
                  placeholderTextColor="#B794F4"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={nextStep}
                disabled={!userName}
              >
                <LinearGradient
                  colors={Colors.primaryGradient}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Iniziamo!</Text>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: School */}
          {currentStep === 'school' && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>🏫</Text>
              <Text style={styles.title}>Orario Scolastico</Text>
              <Text style={styles.subtitle}>
                Quando vai a scuola durante la settimana?
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome scuola (opzionale)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="es. Liceo Scientifico Einstein"
                  value={schoolName}
                  onChangeText={setSchoolName}
                  placeholderTextColor="#B794F4"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Anno scolastico</Text>
                <View style={styles.yearButtonsContainer}>
                  {[1, 2, 3, 4, 5].map(year => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.yearButton,
                        classYear === year.toString() && styles.yearButtonActive
                      ]}
                      onPress={() => setClassYear(year.toString())}
                    >
                      <Text style={[
                        styles.yearButtonText,
                        classYear === year.toString() && styles.yearButtonTextActive
                      ]}>
                        {year}°
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.label}>Giorni e orari</Text>
              {schoolSchedule.map((schedule, index) => (
                <View key={schedule.day} style={styles.scheduleRow}>
                  <TouchableOpacity
                    style={[styles.dayToggle, schedule.enabled && styles.dayToggleActive]}
                    onPress={() => {
                      const newSchedule = [...schoolSchedule];
                      newSchedule[index].enabled = !newSchedule[index].enabled;
                      setSchoolSchedule(newSchedule);
                    }}
                  >
                    <Text style={[styles.dayText, schedule.enabled && styles.dayTextActive]}>
                      {getDayName(schedule.day).slice(0, 3)}
                    </Text>
                  </TouchableOpacity>

                  {schedule.enabled && (
                    <>
                      <TimePicker
                        value={schedule.startTime}
                        onChangeTime={(text) => {
                          const newSchedule = [...schoolSchedule];
                          newSchedule[index].startTime = text;
                          setSchoolSchedule(newSchedule);
                        }}
                        label="Ora inizio"
                      />
                      <Text style={styles.timeSeparator}>-</Text>
                      <TimePicker
                        value={schedule.endTime}
                        onChangeTime={(text) => {
                          const newSchedule = [...schoolSchedule];
                          newSchedule[index].endTime = text;
                          setSchoolSchedule(newSchedule);
                        }}
                        label="Ora fine"
                      />
                    </>
                  )}
                </View>
              ))}

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={previousStep}>
                  <Ionicons name="arrow-back" size={20} color={Colors.primary} />
                  <Text style={styles.secondaryButtonText}>Indietro</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.primaryButton} onPress={nextStep}>
                  <LinearGradient
                    colors={Colors.primaryGradient}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>Avanti</Text>
                    <Ionicons name="arrow-forward" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Commute */}
          {currentStep === 'commute' && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>🚌</Text>
              <Text style={styles.title}>Trasferimenti</Text>
              <Text style={styles.subtitle}>
                Quanto tempo impieghi per andare e tornare da scuola?
              </Text>

              <Text style={styles.label}>Come vai a scuola?</Text>
              <View style={styles.transportGrid}>
                {(['piedi', 'bici', 'bus', 'auto', 'treno'] as const).map(transport => (
                  <TouchableOpacity
                    key={transport}
                    style={[
                      styles.transportOption,
                      commuteInfo.transport === transport && styles.transportOptionActive
                    ]}
                    onPress={() => setCommuteInfo({...commuteInfo, transport})}
                  >
                    <Text style={styles.transportIcon}>{getTransportIcon(transport)}</Text>
                    <Text style={[
                      styles.transportText,
                      commuteInfo.transport === transport && styles.transportTextActive
                    ]}>
                      {transport.charAt(0).toUpperCase() + transport.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tempo andata (minuti)</Text>
                <TextInput
                  style={styles.input}
                  value={commuteInfo.morningDuration.toString()}
                  onChangeText={(text) => setCommuteInfo({
                    ...commuteInfo,
                    morningDuration: parseInt(text) || 0
                  })}
                  keyboardType="numeric"
                  placeholder="15"
                  placeholderTextColor="#B794F4"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tempo ritorno (minuti)</Text>
                <TextInput
                  style={styles.input}
                  value={commuteInfo.afternoonDuration.toString()}
                  onChangeText={(text) => setCommuteInfo({
                    ...commuteInfo,
                    afternoonDuration: parseInt(text) || 0
                  })}
                  keyboardType="numeric"
                  placeholder="15"
                  placeholderTextColor="#B794F4"
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={previousStep}>
                  <Ionicons name="arrow-back" size={20} color={Colors.primary} />
                  <Text style={styles.secondaryButtonText}>Indietro</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.primaryButton} onPress={nextStep}>
                  <LinearGradient
                    colors={Colors.primaryGradient}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>Avanti</Text>
                    <Ionicons name="arrow-forward" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 4: Activities */}
          {currentStep === 'activities' && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>⚽</Text>
              <Text style={styles.title}>Attività Ricorrenti</Text>
              <Text style={styles.subtitle}>
                Sport, musica, corsi... cosa fai durante la settimana?
              </Text>

              {/* Lista attività aggiunte */}
              {activities.map(activity => (
                <View key={activity.id} style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityIcon}>{activity.icon}</Text>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityName}>{activity.name}</Text>
                      <Text style={styles.activityTime}>
                        {getDayName(activity.day)} • {activity.startTime} • {activity.duration} min
                        {activity.commuteTime ? ` • ${activity.commuteTime} min trasf.` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeActivity(activity.id)}>
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Form aggiungi attività */}
              <View style={styles.addActivityForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Nome attività (es. Calcio, Piano)"
                  value={newActivity.name}
                  onChangeText={(text) => setNewActivity({...newActivity, name: text})}
                  placeholderTextColor="#B794F4"
                />

                <View style={styles.activityFormRow}>
                  <View style={styles.formField}>
                    <Text style={styles.miniLabel}>Tipo</Text>
                    <View style={styles.miniPicker}>
                      <Picker
                        selectedValue={newActivity.type}
                        onValueChange={(value) => setNewActivity({...newActivity, type: value})}
                        style={{ height: 40 }}
                      >
                        <Picker.Item label="Sport" value="sport" />
                        <Picker.Item label="Musica" value="musica" />
                        <Picker.Item label="Corso" value="corso" />
                        <Picker.Item label="Altro" value="altro" />
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.miniLabel}>Giorno</Text>
                    <View style={styles.miniPicker}>
                      <Picker
                        selectedValue={newActivity.day}
                        onValueChange={(value) => setNewActivity({...newActivity, day: value})}
                        style={{ height: 40 }}
                      >
                        {(['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as DayOfWeek[]).map(day => (
                          <Picker.Item key={day} label={getDayName(day)} value={day} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>

                <View style={styles.activityFormRow}>
                  <View style={styles.formField}>
                    <Text style={styles.miniLabel}>Ora inizio</Text>
                    <TimePicker
                      value={newActivity.startTime}
                      onChangeTime={(text) => setNewActivity({...newActivity, startTime: text})}
                      label="Ora attività"
                    />
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.miniLabel}>Durata (min)</Text>
                    <TextInput
                      style={styles.miniInput}
                      value={newActivity.duration.toString()}
                      onChangeText={(text) => setNewActivity({...newActivity, duration: parseInt(text) || 0})}
                      keyboardType="numeric"
                      placeholder="60"
                      placeholderTextColor={Colors.gray400}
                    />
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.miniLabel}>Trasferimento (min)</Text>
                    <TextInput
                      style={styles.miniInput}
                      value={newActivity.commuteTime?.toString() || ''}
                      onChangeText={(text) => setNewActivity({...newActivity, commuteTime: parseInt(text) || 0})}
                      keyboardType="numeric"
                      placeholder="15"
                      placeholderTextColor={Colors.gray400}
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.addButton} onPress={addActivity}>
                  <Ionicons name="add-circle" size={20} color={Colors.primary} />
                  <Text style={styles.addButtonText}>Aggiungi Attività</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={previousStep}>
                  <Ionicons name="arrow-back" size={20} color={Colors.primary} />
                  <Text style={styles.secondaryButtonText}>Indietro</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.primaryButton} onPress={nextStep}>
                  <LinearGradient
                    colors={Colors.primaryGradient}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>Avanti</Text>
                    <Ionicons name="arrow-forward" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 5: Summary */}
          {currentStep === 'summary' && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>✨</Text>
              <Text style={styles.title}>Perfetto, {userName}!</Text>
              <Text style={styles.subtitle}>
                Ecco il riepilogo della tua settimana tipo
              </Text>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>🏫 Scuola</Text>
                <Text style={styles.summaryText}>
                  {schoolSchedule.filter(s => s.enabled).length} giorni a settimana
                </Text>
                {schoolName && <Text style={styles.summaryText}>{schoolName}</Text>}
                <Text style={styles.summaryText}>{classYear}° anno</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>🚌 Trasferimenti</Text>
                <Text style={styles.summaryText}>
                  {getTransportIcon(commuteInfo.transport)} {commuteInfo.transport}
                </Text>
                <Text style={styles.summaryText}>
                  {commuteInfo.morningDuration + commuteInfo.afternoonDuration} min totali/giorno
                </Text>
              </View>

              {activities.length > 0 && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>⚽ Attività</Text>
                  {activities.map(activity => (
                    <Text key={activity.id} style={styles.summaryText}>
                      {activity.icon} {activity.name} - {getDayName(activity.day)}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={Colors.primary} />
                <Text style={styles.infoText}>
                  Userò queste informazioni per creare piani di studio{'\n'}
                  che si adattano perfettamente ai tuoi impegni!
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={previousStep}>
                  <Ionicons name="arrow-back" size={20} color={Colors.primary} />
                  <Text style={styles.secondaryButtonText}>Modifica</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.primaryButton} onPress={saveConfiguration}>
                  <LinearGradient
                    colors={Colors.primaryGradient}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>Completa!</Text>
                    <Ionicons name="checkmark" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    paddingTop: 40,
  },
  stepDot: {
    marginHorizontal: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E9D5FF',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 30,
  },
  dotCompleted: {
    backgroundColor: '#10B981',
  },
  stepContent: {
    flex: 1,
  },
  emoji: {
    fontSize: 60,
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  yearButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  yearButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  yearButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yearButtonText: {
    fontSize: 16,
    color: Colors.gray600,
    fontWeight: '500',
  },
  yearButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayToggle: {
    width: 50,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginRight: 10,
  },
  dayToggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  dayTextActive: {
    color: 'white',
  },
  timeInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    textAlign: 'center',
  },
  timeSeparator: {
    marginHorizontal: 5,
    color: '#9CA3AF',
  },
  transportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  transportOption: {
    width: '30%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  transportOptionActive: {
    backgroundColor: '#E9D5FF',
    borderColor: Colors.primary,
  },
  transportIcon: {
    fontSize: 30,
    marginBottom: 5,
  },
  transportText: {
    fontSize: 12,
    color: '#6B7280',
  },
  transportTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  activityTime: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  addActivityForm: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  activityFormRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  formField: {
    flex: 1,
    marginHorizontal: 5,
  },
  miniLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 5,
  },
  miniPicker: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    overflow: 'hidden',
    height: 40,
  },
  miniInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    height: 40,
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  primaryButton: {
    flex: 1,
    marginLeft: 5,
    borderRadius: 12,
    overflow: 'hidden',
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
    marginRight: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginRight: 5,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 5,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E9D5FF',
    borderRadius: 12,
    padding: 15,
    marginVertical: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.secondary,
    marginLeft: 10,
    lineHeight: 20,
  },
});