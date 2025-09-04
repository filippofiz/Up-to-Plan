import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  isBreak: boolean;
}

const DAYS = [
  { key: 'Lunedì', label: 'Lunedì' },
  { key: 'Martedì', label: 'Martedì' },
  { key: 'Mercoledì', label: 'Mercoledì' },
  { key: 'Giovedì', label: 'Giovedì' },
  { key: 'Venerdì', label: 'Venerdì' },
  { key: 'Sabato', label: 'Sabato' }
];

const SUBJECTS_LIST = [
  'Matematica',
  'Italiano',
  'Inglese',
  'Storia',
  'Geografia',
  'Scienze',
  'Fisica',
  'Chimica',
  'Informatica',
  'Arte',
  'Musica',
  'Ed. Fisica',
  'Religione',
  'Filosofia',
  'Latino',
  'Spagnolo',
  'Francese',
  'Tedesco',
  'Economia',
  'Diritto'
];

export default function SchoolScheduleScreen({ navigation }: any) {
  const [schedule, setSchedule] = useState<TimeSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState('Lunedì');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weeklyHours, setWeeklyHours] = useState<{[key: string]: number}>({});
  
  const [newSlot, setNewSlot] = useState<TimeSlot>({
    id: '',
    day: 'Lunedì',
    startTime: '08:00',
    endTime: '09:00',
    subject: 'Matematica',
    isBreak: false
  });

  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    calculateWeeklyHours();
  }, [schedule]);

  const loadSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('school_schedule')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      if (data) {
        setSchedule(data.map(item => ({
          id: item.id,
          day: item.day_of_week,
          startTime: item.start_time,
          endTime: item.end_time,
          subject: item.subject_name || 'Materia',
          isBreak: item.is_break
        })));
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWeeklyHours = () => {
    const hours: {[key: string]: number} = {};
    
    schedule.forEach(slot => {
      if (!slot.isBreak) {
        const start = slot.startTime.split(':').map(Number);
        const end = slot.endTime.split(':').map(Number);
        const duration = (end[0] * 60 + end[1] - start[0] * 60 - start[1]) / 60;
        
        if (!hours[slot.subject]) {
          hours[slot.subject] = 0;
        }
        hours[slot.subject] += duration;
      }
    });
    
    setWeeklyHours(hours);
  };

  const addTimeSlot = async () => {
    if (!newSlot.subject && !newSlot.isBreak) {
      Alert.alert('Errore', 'Seleziona una materia');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const slotData = {
        user_id: user.id,
        day_of_week: newSlot.day,
        start_time: newSlot.startTime,
        end_time: newSlot.endTime,
        subject_name: newSlot.isBreak ? 'Pausa' : newSlot.subject,
        is_break: newSlot.isBreak
      };

      const { data, error } = await supabase
        .from('school_schedule')
        .insert([slotData])
        .select()
        .single();

      if (error) throw error;

      const newScheduleItem = {
        id: data.id,
        day: data.day_of_week,
        startTime: data.start_time,
        endTime: data.end_time,
        subject: data.subject_name,
        isBreak: data.is_break
      };

      setSchedule([...schedule, newScheduleItem].sort((a, b) => {
        const dayOrder = DAYS.findIndex(d => d.key === a.day) - DAYS.findIndex(d => d.key === b.day);
        if (dayOrder !== 0) return dayOrder;
        return a.startTime.localeCompare(b.startTime);
      }));

      setShowAddModal(false);
      setNewSlot({
        id: '',
        day: selectedDay,
        startTime: '08:00',
        endTime: '09:00',
        subject: 'Matematica',
        isBreak: false
      });

      // Sincronizza materie con subjects table
      if (!newSlot.isBreak) {
        await syncSubject(user.id, newSlot.subject);
      }
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiungere la lezione');
      console.error('Error adding time slot:', error);
    }
  };

  const syncSubject = async (userId: string, subjectName: string) => {
    try {
      // Controlla se la materia esiste già
      const { data: existing } = await supabase
        .from('subjects')
        .select('id')
        .eq('user_id', userId)
        .eq('name', subjectName)
        .single();

      if (!existing) {
        // Aggiungi la materia se non esiste
        await supabase
          .from('subjects')
          .insert([{
            user_id: userId,
            name: subjectName,
            type: 'teorica',
            difficulty: 5,
            priority: 5,
            weekly_hours: weeklyHours[subjectName] || 0
          }]);
      } else {
        // Aggiorna ore settimanali
        await supabase
          .from('subjects')
          .update({ weekly_hours: weeklyHours[subjectName] || 0 })
          .eq('id', existing.id);
      }
    } catch (error) {
      console.error('Error syncing subject:', error);
    }
  };

  const deleteTimeSlot = async (slotId: string) => {
    Alert.alert(
      'Conferma',
      'Vuoi eliminare questa lezione?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('school_schedule')
                .delete()
                .eq('id', slotId);

              if (error) throw error;
              
              setSchedule(schedule.filter(s => s.id !== slotId));
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare la lezione');
            }
          }
        }
      ]
    );
  };

  const getDaySchedule = (day: string) => {
    return schedule.filter(slot => slot.day === day);
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Orario Scolastico</Text>
          <Text style={styles.subtitle}>Configura il tuo orario settimanale</Text>
        </View>

        {/* Tabs giorni */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysContainer}>
          {DAYS.map(day => (
            <TouchableOpacity
              key={day.key}
              style={[
                styles.dayTab,
                selectedDay === day.key && styles.dayTabActive
              ]}
              onPress={() => setSelectedDay(day.key)}
            >
              <Text style={[
                styles.dayTabText,
                selectedDay === day.key && styles.dayTabTextActive
              ]}>
                {day.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Orario del giorno selezionato */}
        <View style={styles.scheduleContainer}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleDay}>
              {DAYS.find(d => d.key === selectedDay)?.label}
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setNewSlot({ ...newSlot, day: selectedDay });
                setShowAddModal(true);
              }}
            >
              <Icon name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {getDaySchedule(selectedDay).length > 0 ? (
            getDaySchedule(selectedDay).map(slot => (
              <View
                key={slot.id}
                style={[
                  styles.slotCard,
                  slot.isBreak && styles.breakCard
                ]}
              >
                <View style={styles.slotTime}>
                  <Text style={styles.slotTimeText}>
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </Text>
                </View>
                <View style={styles.slotInfo}>
                  <Text style={[
                    styles.slotSubject,
                    slot.isBreak && styles.breakText
                  ]}>
                    {slot.subject}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteTimeSlot(slot.id)}
                  style={styles.deleteButton}
                >
                  <Icon name="close" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyDay}>
              <Icon name="event-available" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Nessuna lezione</Text>
              <Text style={styles.emptySubtext}>Aggiungi le tue materie per questo giorno</Text>
            </View>
          )}
        </View>

        {/* Riepilogo ore settimanali */}
        {Object.keys(weeklyHours).length > 0 && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Ore Settimanali per Materia</Text>
            <View style={styles.summaryGrid}>
              {Object.entries(weeklyHours)
                .sort((a, b) => b[1] - a[1])
                .map(([subject, hours]) => (
                  <View key={subject} style={styles.summaryItem}>
                    <Text style={styles.summarySubject}>{subject}</Text>
                    <Text style={styles.summaryHours}>{hours.toFixed(1)}h</Text>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal per aggiungere lezione */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Aggiungi Lezione</Text>
            
            <View style={styles.switchContainer}>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.switchButtons}>
                <TouchableOpacity
                  style={[
                    styles.switchButton,
                    !newSlot.isBreak && styles.switchButtonActive
                  ]}
                  onPress={() => setNewSlot({ ...newSlot, isBreak: false })}
                >
                  <Text style={[
                    styles.switchButtonText,
                    !newSlot.isBreak && styles.switchButtonTextActive
                  ]}>
                    Lezione
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.switchButton,
                    newSlot.isBreak && styles.switchButtonActive
                  ]}
                  onPress={() => setNewSlot({ ...newSlot, isBreak: true })}
                >
                  <Text style={[
                    styles.switchButtonText,
                    newSlot.isBreak && styles.switchButtonTextActive
                  ]}>
                    Pausa
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {!newSlot.isBreak && (
              <View>
                <Text style={styles.label}>Materia</Text>
                <Picker
                  selectedValue={newSlot.subject}
                  style={styles.picker}
                  onValueChange={(value) => setNewSlot({ ...newSlot, subject: value })}
                >
                  {SUBJECTS_LIST.map(subject => (
                    <Picker.Item key={subject} label={subject} value={subject} />
                  ))}
                </Picker>
              </View>
            )}

            <View style={styles.timeRow}>
              <View style={styles.timeInput}>
                <Text style={styles.label}>Inizio</Text>
                <TextInput
                  style={styles.input}
                  value={newSlot.startTime}
                  onChangeText={(text) => setNewSlot({ ...newSlot, startTime: text })}
                  placeholder="08:00"
                />
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.label}>Fine</Text>
                <TextInput
                  style={styles.input}
                  value={newSlot.endTime}
                  onChangeText={(text) => setNewSlot({ ...newSlot, endTime: text })}
                  placeholder="09:00"
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addTimeSlot}
              >
                <Text style={styles.modalButtonText}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  daysContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  dayTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dayTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayTabText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dayTabTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  scheduleContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  scheduleDay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  breakCard: {
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderStyle: 'dashed',
  },
  slotTime: {
    marginRight: 15,
  },
  slotTimeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  slotInfo: {
    flex: 1,
  },
  slotSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
  },
  breakText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 5,
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 5,
  },
  summaryContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryItem: {
    width: '50%',
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 10,
  },
  summarySubject: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryHours: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  switchContainer: {
    marginBottom: 20,
  },
  switchButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  switchButtonActive: {
    backgroundColor: Colors.primary,
  },
  switchButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  switchButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 8,
  },
  picker: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 8,
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeInput: {
    flex: 1,
    marginHorizontal: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: Colors.gray200,
  },
  saveButton: {
    backgroundColor: Colors.success,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});