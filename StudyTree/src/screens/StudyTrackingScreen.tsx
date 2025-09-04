import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

export default function StudyTrackingScreen({ navigation }: any) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState({
    quality_score: 5,
    difficulty_perceived: 5,
    focus_level: 5,
    notes: ''
  });
  const [suggestedTime, setSuggestedTime] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const intervalRef = useRef<any>(null);
  const startTimeRef = useRef<any>(null);

  useEffect(() => {
    fetchSubjects();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchLessons();
      fetchSuggestedTime();
    }
  }, [selectedSubject]);

  const fetchSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setSubjects(data || []);
      if (data?.length > 0) {
        setSelectedSubject(data[0]);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('user_id', user.id)
        .eq('subject_id', selectedSubject.id)
        .eq('status', 'pianificata')
        .order('planned_date');

      if (error) throw error;
      setLessons(data || []);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    }
  };

  const fetchSuggestedTime = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .rpc('calculate_optimal_study_time', {
          p_user_id: user.id,
          p_subject_id: selectedSubject.id,
          p_activity_type: 'study'
        });

      if (error) throw error;
      
      if (data && data[0]) {
        setSuggestedTime(data[0]);
      }
    } catch (error) {
      console.error('Error fetching suggested time:', error);
    }
  };

  const startTracking = async (lesson: any = null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data: settings } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .single();

      const sessionData = {
        user_id: user.id,
        subject_id: selectedSubject.id,
        lesson_id: lesson?.id || null,
        start_time: new Date().toISOString(),
        planned_duration: suggestedTime?.suggested_minutes || 60,
        metadata: {
          school_type: settings?.settings?.school_type || 'liceo',
          class_year: settings?.settings?.class_year || 1,
          subject_name: selectedSubject.name
        }
      };

      const { data, error } = await supabase
        .from('study_time_tracking')
        .insert([sessionData])
        .select()
        .single();

      if (error) throw error;

      setCurrentSession(data);
      setIsTracking(true);
      startTimeRef.current = new Date();

      intervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);

      if (lesson) {
        await supabase
          .from('lessons')
          .update({ status: 'in_corso' })
          .eq('id', lesson.id);
      }
    } catch (error) {
      Alert.alert('Errore', 'Impossibile avviare il tracking');
      console.error('Error starting tracking:', error);
    }
  };

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setShowFeedbackModal(true);
  };

  const saveFeedback = async () => {
    try {
      const actualDuration = Math.floor(elapsedTime / 60);

      const { error } = await supabase
        .from('study_time_tracking')
        .update({
          end_time: new Date().toISOString(),
          actual_duration: actualDuration,
          quality_score: feedback.quality_score,
          difficulty_perceived: feedback.difficulty_perceived,
          focus_level: feedback.focus_level
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      if (currentSession.lesson_id) {
        await supabase
          .from('lessons')
          .update({
            status: 'completata',
            actual_duration: actualDuration,
            quality_score: feedback.quality_score,
            difficulty_perceived: feedback.difficulty_perceived,
            notes: feedback.notes
          })
          .eq('id', currentSession.lesson_id);
      }

      Alert.alert(
        'Sessione Completata!',
        `Hai studiato per ${actualDuration} minuti.\n` +
        `Tempo suggerito era: ${suggestedTime?.suggested_minutes || 60} minuti.`
      );

      setIsTracking(false);
      setCurrentSession(null);
      setElapsedTime(0);
      setShowFeedbackModal(false);
      setFeedback({
        quality_score: 5,
        difficulty_perceived: 5,
        focus_level: 5,
        notes: ''
      });

      fetchLessons();
      fetchSuggestedTime();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare il feedback');
      console.error('Error saving feedback:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
          <Text style={styles.title}>Tracking Studio</Text>
          <Text style={styles.subtitle}>Registra i tuoi tempi di studio</Text>
        </View>

        {subjects.length > 0 ? (
          <>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => navigation.navigate('Config', { screen: 'SubjectsConfig' })}
            >
              <Icon name="settings" size={20} color={Colors.primary} />
              <Text style={styles.manageButtonText}>Gestisci Materie</Text>
            </TouchableOpacity>
            
            <View style={styles.subjectSelector}>
              <Text style={styles.label}>Materia selezionata</Text>
              <Picker
                selectedValue={selectedSubject?.id}
                style={styles.picker}
                onValueChange={(value) => {
                  const subject = subjects.find(s => s.id === value);
                  setSelectedSubject(subject);
                }}
              >
                {subjects.map(subject => (
                  <Picker.Item 
                    key={subject.id} 
                    label={subject.name} 
                    value={subject.id} 
                  />
                ))}
              </Picker>
            </View>

            {suggestedTime && (
              <View style={styles.suggestionCard}>
                <Icon name="lightbulb-outline" size={24} color={Colors.warning} />
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionTitle}>Tempo Suggerito</Text>
                  <Text style={styles.suggestionText}>
                    {suggestedTime.suggested_minutes} minuti
                  </Text>
                  <Text style={styles.suggestionConfidence}>
                    Affidabilità: {Math.round(suggestedTime.confidence * 100)}%
                  </Text>
                </View>
              </View>
            )}

            {isTracking ? (
              <View style={styles.trackingContainer}>
                <View style={styles.timerDisplay}>
                  <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
                  <Text style={styles.timerLabel}>Tempo di studio</Text>
                </View>
                
                <TouchableOpacity
                  style={[styles.trackButton, styles.stopButton]}
                  onPress={stopTracking}
                >
                  <Icon name="stop" size={24} color="white" />
                  <Text style={styles.trackButtonText}>Ferma Sessione</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.trackButton}
                  onPress={() => startTracking()}
                >
                  <Icon name="play-arrow" size={24} color="white" />
                  <Text style={styles.trackButtonText}>Inizia Studio Libero</Text>
                </TouchableOpacity>

                {lessons.length > 0 && (
                  <View style={styles.lessonsContainer}>
                    <Text style={styles.sectionTitle}>Lezioni Pianificate</Text>
                    {lessons.map(lesson => (
                      <TouchableOpacity
                        key={lesson.id}
                        style={styles.lessonCard}
                        onPress={() => startTracking(lesson)}
                      >
                        <View style={styles.lessonInfo}>
                          <Text style={styles.lessonTitle}>{lesson.title}</Text>
                          {lesson.description && (
                            <Text style={styles.lessonDescription}>{lesson.description}</Text>
                          )}
                          <Text style={styles.lessonDuration}>
                            Durata prevista: {lesson.planned_duration} min
                          </Text>
                        </View>
                        <Icon name="play-circle-outline" size={32} color={Colors.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="book" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna materia configurata</Text>
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => navigation.navigate('Config', { screen: 'SubjectsConfig' })}
            >
              <Text style={styles.configButtonText}>Configura Materie</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Come è andata?</Text>
            
            <View style={styles.feedbackItem}>
              <Text style={styles.feedbackLabel}>Qualità studio: {feedback.quality_score}/10</Text>
              <View style={styles.scoreButtons}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.scoreButton,
                      feedback.quality_score === score && styles.scoreButtonActive
                    ]}
                    onPress={() => setFeedback({ ...feedback, quality_score: score })}
                  >
                    <Text style={styles.scoreButtonText}>{score}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.feedbackItem}>
              <Text style={styles.feedbackLabel}>Difficoltà: {feedback.difficulty_perceived}/10</Text>
              <View style={styles.scoreButtons}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.scoreButton,
                      feedback.difficulty_perceived === score && styles.scoreButtonActive
                    ]}
                    onPress={() => setFeedback({ ...feedback, difficulty_perceived: score })}
                  >
                    <Text style={styles.scoreButtonText}>{score}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.feedbackItem}>
              <Text style={styles.feedbackLabel}>Focus: {feedback.focus_level}/10</Text>
              <View style={styles.scoreButtons}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.scoreButton,
                      feedback.focus_level === score && styles.scoreButtonActive
                    ]}
                    onPress={() => setFeedback({ ...feedback, focus_level: score })}
                  >
                    <Text style={styles.scoreButtonText}>{score}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={styles.notesInput}
              placeholder="Note (opzionale)"
              placeholderTextColor="#999"
              multiline
              value={feedback.notes}
              onChangeText={(text) => setFeedback({ ...feedback, notes: text })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowFeedbackModal(false)}
              >
                <Text style={styles.modalButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveFeedback}
              >
                <Text style={styles.modalButtonText}>Salva</Text>
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
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  subjectSelector: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  suggestionCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionContent: {
    marginLeft: 12,
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    color: '#666',
  },
  suggestionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  suggestionConfidence: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  trackingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: 'white',
  },
  timerLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginHorizontal: 20,
    marginBottom: 20,
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: '#e74c3c',
  },
  trackButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  lessonsContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  lessonCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lessonDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  lessonDuration: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: 'white',
    marginTop: 16,
    marginBottom: 20,
  },
  configButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  configButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  feedbackItem: {
    marginBottom: 20,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  scoreButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  scoreButton: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreButtonActive: {
    backgroundColor: Colors.primary,
  },
  scoreButtonText: {
    fontSize: 14,
    color: '#333',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
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
    backgroundColor: '#ccc',
  },
  saveButton: {
    backgroundColor: Colors.success,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  manageButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});