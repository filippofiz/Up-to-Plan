import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

interface StudySlot {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_color?: string;
  planned_start: string;
  planned_end: string;
  planned_minutes: number;
  actual_minutes?: number;
  difficulty_rating?: number;
  productivity_rating?: number;
  notes?: string;
  completed: boolean;
}

export default function DailyTrackingScreen({ navigation, route }: any) {
  const [studySlots, setStudySlots] = useState<StudySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate] = useState(route.params?.date || new Date().toISOString().split('T')[0]);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);

  useEffect(() => {
    fetchDailyPlan();
  }, [selectedDate]);

  const fetchDailyPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tracking, error } = await supabase
        .from('daily_study_tracking')
        .select(`
          *,
          subjects (name, color)
        `)
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .order('planned_start_time');

      if (error) throw error;

      const slots = tracking?.map(item => ({
        id: item.id,
        subject_id: item.subject_id,
        subject_name: item.subjects?.name || 'Materia',
        subject_color: item.subjects?.color || '#3498db',
        planned_start: item.planned_start_time,
        planned_end: item.planned_end_time,
        planned_minutes: item.planned_minutes,
        actual_minutes: item.actual_minutes,
        difficulty_rating: item.difficulty_rating || 5,
        productivity_rating: item.productivity_rating || 5,
        notes: item.notes || '',
        completed: item.completed
      })) || [];

      setStudySlots(slots);
    } catch (error) {
      console.error('Errore caricamento piano:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSlotFeedback = (slotId: string, field: string, value: any) => {
    setStudySlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, [field]: value } : slot
    ));
  };

  const saveAllFeedback = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const slot of studySlots) {
        if (slot.actual_minutes !== undefined) {
          const { error } = await supabase
            .from('daily_study_tracking')
            .update({
              actual_minutes: slot.actual_minutes,
              difficulty_rating: slot.difficulty_rating,
              productivity_rating: slot.productivity_rating,
              notes: slot.notes,
              completed: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', slot.id);

          if (error) throw error;
        }
      }

      Alert.alert('✅ Salvato', 'Feedback salvato con successo! Il sistema migliorerà le prossime previsioni.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare il feedback');
    } finally {
      setSaving(false);
    }
  };

  const getProductivityColor = (rating: number) => {
    if (rating <= 3) return '#e74c3c';
    if (rating <= 6) return '#f39c12';
    return '#27ae60';
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
          <Text style={styles.title}>📝 Tracking Giornaliero</Text>
          <Text style={styles.subtitle}>
            {new Date(selectedDate).toLocaleDateString('it-IT', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </Text>
          <Text style={styles.instructions}>
            Inserisci quanto tempo hai effettivamente studiato per ogni materia
          </Text>
        </View>

        {studySlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="event-busy" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessun piano di studio per oggi</Text>
          </View>
        ) : (
          <>
            {studySlots.map((slot) => (
              <View key={slot.id} style={styles.slotCard}>
                <View style={styles.slotHeader}>
                  <View style={[styles.subjectBadge, { backgroundColor: slot.subject_color || '#3498db' }]}>
                    <Text style={styles.subjectBadgeText}>
                      {slot.subject_name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.slotInfo}>
                    <Text style={styles.subjectName}>{slot.subject_name}</Text>
                    <Text style={styles.timeRange}>
                      ⏰ Pianificato: {slot.planned_start} - {slot.planned_end} ({slot.planned_minutes} min)
                    </Text>
                  </View>
                  {slot.completed && (
                    <Icon name="check-circle" size={24} color={Colors.success} />
                  )}
                </View>

                <View style={styles.feedbackSection}>
                  <View style={styles.inputRow}>
                    <Text style={styles.label}>Tempo effettivo (minuti):</Text>
                    <TextInput
                      style={styles.minutesInput}
                      value={slot.actual_minutes?.toString() || ''}
                      onChangeText={(text) => updateSlotFeedback(slot.id, 'actual_minutes', parseInt(text) || 0)}
                      keyboardType="numeric"
                      placeholder={slot.planned_minutes.toString()}
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={styles.sliderSection}>
                    <Text style={styles.label}>Difficoltà: {slot.difficulty_rating}/10</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={1}
                      maximumValue={10}
                      step={1}
                      value={slot.difficulty_rating}
                      onValueChange={(value) => updateSlotFeedback(slot.id, 'difficulty_rating', value)}
                      minimumTrackTintColor={Colors.primary}
                      maximumTrackTintColor="#ddd"
                      thumbTintColor={Colors.primary}
                    />
                  </View>

                  <View style={styles.sliderSection}>
                    <Text style={styles.label}>
                      Produttività: {slot.productivity_rating}/10
                    </Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={1}
                      maximumValue={10}
                      step={1}
                      value={slot.productivity_rating}
                      onValueChange={(value) => updateSlotFeedback(slot.id, 'productivity_rating', value)}
                      minimumTrackTintColor={getProductivityColor(slot.productivity_rating || 5)}
                      maximumTrackTintColor="#ddd"
                      thumbTintColor={getProductivityColor(slot.productivity_rating || 5)}
                    />
                  </View>

                  <TextInput
                    style={styles.notesInput}
                    placeholder="Note (opzionale)"
                    placeholderTextColor="#999"
                    value={slot.notes}
                    onChangeText={(text) => updateSlotFeedback(slot.id, 'notes', text)}
                    multiline
                  />

                  {slot.actual_minutes && slot.actual_minutes !== slot.planned_minutes && (
                    <View style={[
                      styles.differenceIndicator,
                      { backgroundColor: slot.actual_minutes > slot.planned_minutes ? '#fef3c7' : '#dbeafe' }
                    ]}>
                      <Icon 
                        name={slot.actual_minutes > slot.planned_minutes ? 'trending-up' : 'trending-down'} 
                        size={20} 
                        color={slot.actual_minutes > slot.planned_minutes ? '#f59e0b' : '#3b82f6'} 
                      />
                      <Text style={[
                        styles.differenceText,
                        { color: slot.actual_minutes > slot.planned_minutes ? '#f59e0b' : '#3b82f6' }
                      ]}>
                        {Math.abs(slot.actual_minutes - slot.planned_minutes)} min 
                        {slot.actual_minutes > slot.planned_minutes ? ' in più' : ' in meno'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>📊 Riepilogo</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tempo pianificato totale:</Text>
                <Text style={styles.summaryValue}>
                  {studySlots.reduce((acc, slot) => acc + slot.planned_minutes, 0)} min
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tempo effettivo totale:</Text>
                <Text style={[styles.summaryValue, { fontWeight: 'bold', color: Colors.primary }]}>
                  {studySlots.reduce((acc, slot) => acc + (slot.actual_minutes || 0), 0)} min
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveAllFeedback}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Icon name="save" size={24} color="white" />
                  <Text style={styles.saveButtonText}>Salva Feedback</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
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
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.gray600,
    marginBottom: 10,
  },
  instructions: {
    fontSize: 14,
    color: Colors.gray500,
    lineHeight: 20,
  },
  slotCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  subjectBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subjectBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  slotInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 2,
  },
  timeRange: {
    fontSize: 13,
    color: Colors.gray500,
  },
  feedbackSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: Colors.gray600,
    flex: 1,
  },
  minutesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
    width: 80,
    textAlign: 'center',
    backgroundColor: '#f9f9f9',
  },
  sliderSection: {
    marginBottom: 12,
  },
  slider: {
    height: 40,
    marginTop: -5,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  differenceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  differenceText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  summary: {
    backgroundColor: Colors.gray50,
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 12,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.gray600,
  },
  summaryValue: {
    fontSize: 16,
    color: Colors.secondary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 16,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});