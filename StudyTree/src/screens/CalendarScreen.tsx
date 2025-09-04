import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

// Configurazione italiano
LocaleConfig.locales['it'] = {
  monthNames: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  monthNamesShort: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
  dayNames: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
};
LocaleConfig.defaultLocale = 'it';

type EventType = 'verifica' | 'interrogazione' | 'sport' | 'spostamento' | 'altro';

interface Exam {
  id: string;
  subject: string;
  title: string;
  description?: string;
  exam_date: string;
  difficulty: number;
  estimated_study_hours: number;
  completed: boolean;
  event_type?: EventType;
}

export default function CalendarScreen() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newExam, setNewExam] = useState({
    subject: '',
    title: '',
    description: '',
    difficulty: 3,
    estimated_study_hours: 10,
    event_type: 'verifica' as EventType,
  });
  const [markedDates, setMarkedDates] = useState<any>({});

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    console.log('Caricamento esami...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('Nessun utente per caricare esami');
      return;
    }

    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('user_id', user.id)
      .order('exam_date', { ascending: true });

    if (error) {
      console.log('Errore caricamento esami:', error);
    } else if (data) {
      console.log('Esami caricati:', data.length);
      setExams(data);
      updateMarkedDates(data);
    }
  };

  const updateMarkedDates = (examsData: Exam[]) => {
    const marked: any = {};
    examsData.forEach(exam => {
      marked[exam.exam_date] = {
        marked: true,
        dotColor: exam.completed ? Colors.success : Colors.primary,
        selected: selectedDate === exam.exam_date,
      };
    });
    setMarkedDates(marked);
  };

  const addExam = async () => {
    try {
      console.log('=== INIZIO SALVATAGGIO ===');
      console.log('Tipo evento:', newExam.event_type);
      console.log('Materia:', newExam.subject);
      console.log('Titolo:', newExam.title);
      console.log('Data selezionata:', selectedDate);
    
    // Chiudi tastiera
    Keyboard.dismiss();
    
    // Trim dei campi per rimuovere spazi
    const trimmedSubject = newExam.subject?.trim() || '';
    const trimmedTitle = newExam.title?.trim() || '';
    
    // Controllo campi in base al tipo di evento
    if (newExam.event_type === 'verifica' || newExam.event_type === 'interrogazione') {
      if (!trimmedSubject || !trimmedTitle || !selectedDate) {
        Alert.alert(
          'Errore', 
          `Compila tutti i campi:\n` +
          `- Materia: ${trimmedSubject ? '✓' : '✗ mancante'}\n` +
          `- Titolo: ${trimmedTitle ? '✓' : '✗ mancante'}\n` +
          `- Data: ${selectedDate ? '✓' : '✗ mancante'}`
        );
        return;
      }
    } else {
      if (!trimmedTitle || !selectedDate) {
        Alert.alert('Errore', 'Inserisci almeno il titolo dell\'evento');
        return;
      }
    }
    
    // Aggiorna con valori trimmati
    newExam.subject = trimmedSubject || '';
    newExam.title = trimmedTitle || '';

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('ERRORE: Nessun utente autenticato');
      Alert.alert('Errore', 'Devi essere autenticato');
      return;
    }
    console.log('Utente trovato:', user.id);

    console.log('Inserimento nel database...');
    const { data, error } = await supabase.from('exams').insert({
      user_id: user.id,
      subject: trimmedSubject || newExam.event_type,
      title: trimmedTitle,
      description: newExam.description?.trim() || '',
      exam_date: selectedDate,
      difficulty: newExam.difficulty,
      estimated_study_hours: newExam.event_type === 'sport' || newExam.event_type === 'altro' ? 0 : newExam.estimated_study_hours,
      completed: false,
      event_type: newExam.event_type,
    });

    if (error) {
      console.log('ERRORE DATABASE:', error);
      Alert.alert('Errore', 'Impossibile salvare: ' + error.message);
    } else {
      console.log('SUCCESSO! Evento salvato:', data);
      const messages = {
        'verifica': 'Verifica aggiunta! Calcolerò quando studiare.',
        'interrogazione': 'Interrogazione aggiunta! Calcolerò quando studiare.',
        'sport': 'Attività sportiva aggiunta!',
        'spostamento': 'Spostamento aggiunto!',
        'altro': 'Evento aggiunto!'
      };
      Alert.alert('Successo', messages[newExam.event_type]);
      setModalVisible(false);
      loadExams();
      resetForm();
    }
    } catch (error) {
      console.log('ERRORE GENERALE:', error);
      Alert.alert('Errore', 'Errore inaspettato: ' + error);
    }
  };

  const resetForm = () => {
    setNewExam({
      subject: '',
      title: '',
      description: '',
      difficulty: 3,
      estimated_study_hours: 10,
      event_type: 'verifica',
    });
  };

  const getExamsForDate = (date: string) => {
    return exams.filter(exam => exam.exam_date === date);
  };

  const getDifficultyEmoji = (difficulty: number) => {
    const emojis = ['', '😊', '🙂', '😐', '😰', '😱'];
    return emojis[difficulty] || '😐';
  };

  const getEventIcon = (type: EventType) => {
    switch(type) {
      case 'verifica': return '📝';
      case 'interrogazione': return '🗣️';
      case 'sport': return '⚽';
      case 'spostamento': return '🚗';
      case 'altro': return '📌';
      default: return '📝';
    }
  };

  const calculateStudyPlan = (exam: Exam) => {
    const examDate = new Date(exam.exam_date);
    const today = new Date();
    const daysUntilExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    
    if (daysUntilExam <= 0) return 'Esame passato';
    
    const sessionsNeeded = Math.ceil(exam.estimated_study_hours * 2.4); // 25 min per sessione
    const sessionsPerDay = Math.ceil(sessionsNeeded / daysUntilExam);
    
    return `${sessionsPerDay} pomodori/giorno per ${daysUntilExam} giorni`;
  };

  return (
    <LinearGradient colors={[Colors.primaryGradient[0] + '15', Colors.secondaryGradient[0] + '15']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Calendario */}
        <Calendar
          markedDates={markedDates}
          onDayPress={(day: any) => {
            setSelectedDate(day.dateString);
            const examsForDay = getExamsForDate(day.dateString);
            if (examsForDay.length === 0) {
              // Reset form prima di aprire modal
              resetForm();
              setModalVisible(true);
            }
          }}
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'white',
            selectedDayBackgroundColor: Colors.primary,
            selectedDayTextColor: 'white',
            todayTextColor: Colors.primary,
            dayTextColor: Colors.gray700,
            textDisabledColor: Colors.gray300,
            dotColor: Colors.primary,
            arrowColor: Colors.primary,
            monthTextColor: Colors.secondary,
            textMonthFontWeight: 'bold',
            textDayFontSize: 16,
            textMonthFontSize: 18,
          }}
          style={styles.calendar}
        />

        {/* Lista esami del giorno selezionato */}
        {selectedDate && getExamsForDate(selectedDate).length > 0 && (
          <View style={styles.examsSection}>
            <Text style={styles.sectionTitle}>Esami del {selectedDate}</Text>
            {getExamsForDate(selectedDate).map(exam => (
              <View key={exam.id} style={styles.examCard}>
                <View style={styles.examHeader}>
                  <Text style={styles.examSubject}>{exam.subject}</Text>
                  <Text style={styles.examDifficulty}>
                    {getDifficultyEmoji(exam.difficulty)}
                  </Text>
                </View>
                <Text style={styles.examTitle}>{exam.title}</Text>
                {exam.description && (
                  <Text style={styles.examDescription}>{exam.description}</Text>
                )}
                <View style={styles.studyPlanRow}>
                  <Ionicons name="time-outline" size={16} color={Colors.gray400} />
                  <Text style={styles.studyPlanText}>
                    {calculateStudyPlan(exam)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Prossimi esami */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>📚 Prossimi Esami</Text>
          {exams.filter(e => !e.completed).slice(0, 3).map(exam => (
            <TouchableOpacity key={exam.id} style={styles.upcomingCard}>
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingDate}>
                  {new Date(exam.exam_date).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </Text>
                <Text style={styles.upcomingSubject}>{exam.subject}</Text>
              </View>
              <View style={styles.upcomingRight}>
                <Text style={styles.upcomingTitle}>{exam.title}</Text>
                <Text style={styles.upcomingPlan}>{calculateStudyPlan(exam)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottone aggiungi esame */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            // Se non c'è data selezionata, usa oggi
            if (!selectedDate) {
              const today = new Date().toISOString().split('T')[0];
              setSelectedDate(today);
            }
            resetForm();
            setModalVisible(true);
          }}
        >
          <LinearGradient
            colors={Colors.primaryGradient}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addButtonText}>Aggiungi Esame</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal aggiungi evento */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardView}
            >
              <View style={styles.modalContent}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitle}>
                    {getEventIcon(newExam.event_type)} Nuovo Evento
                  </Text>
                  
                  {/* Selezione tipo evento */}
                  <Text style={styles.inputLabel}>Tipo di evento:</Text>
                  <View style={styles.eventTypeRow}>
                    {(['verifica', 'interrogazione', 'sport', 'spostamento', 'altro'] as EventType[]).map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.eventTypeButton,
                          newExam.event_type === type && styles.eventTypeSelected
                        ]}
                        onPress={() => setNewExam({...newExam, event_type: type})}
                      >
                        <Text style={styles.eventTypeIcon}>{getEventIcon(type)}</Text>
                        <Text style={[
                          styles.eventTypeText,
                          newExam.event_type === type && styles.eventTypeTextSelected
                        ]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={styles.inputLabel}>Data: {selectedDate}</Text>
                  
                  {(newExam.event_type === 'verifica' || newExam.event_type === 'interrogazione') && (
                    <TextInput
                      style={styles.input}
                      placeholder="Materia (es. Matematica)"
                      value={newExam.subject}
                      onChangeText={(text) => setNewExam({...newExam, subject: text})}
                      placeholderTextColor={Colors.gray400}
                      returnKeyType="next"
                    />
                  )}

                  <TextInput
                    style={styles.input}
                    placeholder={
                      newExam.event_type === 'verifica' ? "Titolo (es. Verifica equazioni)" :
                      newExam.event_type === 'sport' ? "Attività (es. Allenamento calcio)" :
                      newExam.event_type === 'spostamento' ? "Destinazione (es. Gita a Roma)" :
                      "Titolo evento"
                    }
                    value={newExam.title}
                    onChangeText={(text) => setNewExam({...newExam, title: text})}
                    placeholderTextColor="#B794F4"
                    returnKeyType="next"
                  />

                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Descrizione (opzionale)"
                    value={newExam.description}
                    onChangeText={(text) => setNewExam({...newExam, description: text})}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#B794F4"
                    returnKeyType="done"
                  />

                  {(newExam.event_type === 'verifica' || newExam.event_type === 'interrogazione') && (
                    <>
                      <Text style={styles.inputLabel}>
                        Difficoltà: {getDifficultyEmoji(newExam.difficulty)} ({newExam.difficulty}/5)
                      </Text>
                      <View style={styles.difficultyRow}>
                        {[1, 2, 3, 4, 5].map(level => (
                          <TouchableOpacity
                            key={level}
                            style={[styles.difficultyButton, 
                              newExam.difficulty === level && styles.difficultySelected
                            ]}
                            onPress={() => setNewExam({...newExam, difficulty: level})}
                          >
                            <Text>{getDifficultyEmoji(level)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.inputLabel}>
                        Ore di studio stimate: {newExam.estimated_study_hours}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ore di studio necessarie"
                        value={newExam.estimated_study_hours.toString()}
                        onChangeText={(text) => setNewExam({...newExam, estimated_study_hours: parseInt(text) || 0})}
                        keyboardType="numeric"
                        placeholderTextColor={Colors.gray400}
                        returnKeyType="done"
                      />
                    </>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        Keyboard.dismiss();
                        setModalVisible(false);
                        resetForm();
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Annulla</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => {
                        console.log('PULSANTE SALVA CLICCATO!');
                        addExam();
                      }}
                    >
                      <LinearGradient
                        colors={Colors.primaryGradient}
                        style={styles.saveButtonGradient}
                      >
                        <Text style={styles.saveButtonText}>Salva</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  calendar: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  examsSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 15,
  },
  examCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  examSubject: {
    fontSize: 14,
    color: Colors.gray400,
    fontWeight: '600',
  },
  examDifficulty: {
    fontSize: 20,
  },
  examTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.gray700,
    marginBottom: 5,
  },
  examDescription: {
    fontSize: 14,
    color: Colors.gray500,
    marginBottom: 10,
  },
  studyPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  studyPlanText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 5,
    fontWeight: '600',
  },
  upcomingSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  upcomingCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
  },
  upcomingLeft: {
    marginRight: 15,
    alignItems: 'center',
  },
  upcomingDate: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  upcomingSubject: {
    fontSize: 12,
    color: Colors.gray400,
  },
  upcomingRight: {
    flex: 1,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray700,
  },
  upcomingPlan: {
    fontSize: 12,
    color: Colors.gray400,
    marginTop: 2,
  },
  addButton: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  eventTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  eventTypeButton: {
    width: '30%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  eventTypeSelected: {
    backgroundColor: Colors.primaryGradient[0] + '20',
    borderColor: Colors.primary,
  },
  eventTypeIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  eventTypeText: {
    fontSize: 10,
    color: Colors.gray500,
    textAlign: 'center',
  },
  eventTypeTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.gray500,
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.gray50,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 10,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  difficultyButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.gray50,
  },
  difficultySelected: {
    backgroundColor: Colors.primaryGradient[0] + '20',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    marginRight: 10,
    padding: 15,
    borderRadius: 10,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.gray500,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    padding: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});