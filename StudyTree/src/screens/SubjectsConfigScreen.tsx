import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

export default function SubjectsConfigScreen({ navigation }: any) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newSubject, setNewSubject] = useState({
    name: '',
    type: 'teorica',
    difficulty: 5,
    priority: 5,
    weekly_hours: 0,
    color: '#3498db'
  });

  const subjectColors = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
  ];

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Carica le materie
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false });

      if (subjectsError) throw subjectsError;
      
      // Per ogni materia, calcola le ore settimanali dall'orario scolastico
      const subjectsWithHours = await Promise.all((subjectsData || []).map(async (subject) => {
        const { data: scheduleData } = await supabase
          .from('school_schedule')
          .select('start_time, end_time')
          .eq('user_id', user.id)
          .eq('subject_name', subject.name)
          .eq('is_break', false);
        
        let totalMinutes = 0;
        if (scheduleData) {
          scheduleData.forEach(slot => {
            const start = new Date(`2000-01-01T${slot.start_time}`);
            const end = new Date(`2000-01-01T${slot.end_time}`);
            totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
          });
        }
        
        const weeklyHours = Math.round(totalMinutes / 60 * 10) / 10; // Arrotonda a 1 decimale
        
        // Aggiorna le ore nel database se sono diverse
        if (weeklyHours !== subject.weekly_hours) {
          await supabase
            .from('subjects')
            .update({ weekly_hours: weeklyHours })
            .eq('id', subject.id);
        }
        
        return {
          ...subject,
          weekly_hours: weeklyHours
        };
      }));
      
      setSubjects(subjectsWithHours);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare le materie');
    } finally {
      setLoading(false);
    }
  };

  const addSubject = async () => {
    if (!newSubject.name) {
      Alert.alert('Errore', 'Inserisci il nome della materia');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('subjects')
        .insert([{ ...newSubject, user_id: user.id }]);

      if (error) throw error;
      
      Alert.alert('Successo', 'Materia aggiunta con successo');
      setShowAddForm(false);
      setNewSubject({
        name: '',
        type: 'teorica',
        difficulty: 5,
        priority: 5,
        weekly_hours: 0,
        color: '#3498db'
      });
      fetchSubjects();
    } catch (error) {
      Alert.alert('Errore', (error as any).message);
    }
  };

  const updateSubject = async () => {
    if (!editingSubject || !editingSubject.name) {
      Alert.alert('Errore', 'Nome materia richiesto');
      return;
    }

    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          name: editingSubject.name,
          type: editingSubject.type,
          difficulty: editingSubject.difficulty,
          priority: editingSubject.priority,
          color: editingSubject.color
        })
        .eq('id', editingSubject.id);

      if (error) throw error;
      
      Alert.alert('Successo', 'Materia aggiornata con successo');
      setShowEditModal(false);
      setEditingSubject(null);
      fetchSubjects();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare la materia');
    }
  };

  const deleteSubject = async (id: string) => {
    Alert.alert(
      'Conferma',
      'Vuoi eliminare questa materia?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', id);

              if (error) throw error;
              fetchSubjects();
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare la materia');
            }
          }
        }
      ]
    );
  };

  const openEditModal = (subject: any) => {
    setEditingSubject({ ...subject });
    setShowEditModal(true);
  };

  const getOptimalStudyTime = async (subjectId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .rpc('calculate_optimal_study_time', {
          p_user_id: user.id,
          p_subject_id: subjectId
        });

      if (error) throw error;
      
      if (data && data[0]) {
        Alert.alert(
          'Tempo di Studio Ottimale',
          `Tempo suggerito: ${data[0].suggested_minutes} minuti\n` +
          `Affidabilità: ${Math.round(data[0].confidence * 100)}%\n` +
          `Basato su: ${data[0].source === 'personal_history' ? 'Storia personale' : 
                      data[0].source === 'global_config' ? 'Configurazione globale' : 
                      data[0].source === 'mixed' ? 'Dati misti' : 'Default'}`
        );
      }
    } catch (error) {
      Alert.alert('Errore', 'Impossibile calcolare il tempo ottimale');
    }
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Icon name={showAddForm ? 'close' : 'add'} size={24} color="white" />
          <Text style={styles.addButtonText}>
            {showAddForm ? 'Chiudi' : 'Aggiungi Materia'}
          </Text>
        </TouchableOpacity>

        {showAddForm && (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Nome materia"
              placeholderTextColor="#999"
              value={newSubject.name}
              onChangeText={(text) => setNewSubject({ ...newSubject, name: text })}
            />

            <Text style={styles.label}>Tipologia</Text>
            <Picker
              selectedValue={newSubject.type}
              style={styles.picker}
              onValueChange={(value) => setNewSubject({ ...newSubject, type: value })}
            >
              <Picker.Item label="Teorica" value="teorica" />
              <Picker.Item label="Pratica" value="pratica" />
              <Picker.Item label="Mista" value="mista" />
            </Picker>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Difficoltà: {newSubject.difficulty}/10</Text>
              <View style={styles.sliderButtons}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.sliderButton,
                      newSubject.difficulty === num && styles.sliderButtonActive
                    ]}
                    onPress={() => setNewSubject({ ...newSubject, difficulty: num })}
                  >
                    <Text style={styles.sliderButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Priorità: {newSubject.priority}/10</Text>
              <View style={styles.sliderButtons}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.sliderButton,
                      newSubject.priority === num && styles.sliderButtonActive
                    ]}
                    onPress={() => setNewSubject({ ...newSubject, priority: num })}
                  >
                    <Text style={styles.sliderButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.label}>Colore</Text>
            <View style={styles.colorPicker}>
              {subjectColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    newSubject.color === color && styles.colorOptionSelected
                  ]}
                  onPress={() => setNewSubject({ ...newSubject, color })}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={addSubject}>
              <Text style={styles.saveButtonText}>Salva Materia</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.subjectsContainer}>
          {subjects.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              style={styles.subjectCard}
              onPress={() => openEditModal(subject)}
            >
              <View style={[styles.subjectColor, { backgroundColor: subject.color }]} />
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectDetails}>
                  {subject.type} • Difficoltà: {subject.difficulty}/10 • Priorità: {subject.priority}/10
                </Text>
                <Text style={styles.subjectHours}>
                  {subject.weekly_hours > 0 
                    ? `${subject.weekly_hours} ore/settimana a scuola`
                    : 'Non nell\'orario scolastico'}
                </Text>
              </View>
              <View style={styles.subjectActions}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    getOptimalStudyTime(subject.id);
                  }}
                  style={styles.actionButton}
                >
                  <Icon name="access-time" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteSubject(subject.id);
                  }}
                  style={styles.actionButton}
                >
                  <Icon name="delete" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {subjects.length === 0 && !showAddForm && (
          <View style={styles.emptyState}>
            <Icon name="book" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna materia configurata</Text>
            <Text style={styles.emptySubtext}>Aggiungi le tue materie per iniziare</Text>
          </View>
        )}
      </ScrollView>

      {/* Modal per modificare materia */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifica Materia</Text>
            
            {editingSubject && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Nome materia"
                  value={editingSubject.name}
                  onChangeText={(text) => setEditingSubject({ ...editingSubject, name: text })}
                />

                <Text style={styles.label}>Tipologia</Text>
                <Picker
                  selectedValue={editingSubject.type}
                  style={styles.picker}
                  onValueChange={(value) => setEditingSubject({ ...editingSubject, type: value })}
                >
                  <Picker.Item label="Teorica" value="teorica" />
                  <Picker.Item label="Pratica" value="pratica" />
                  <Picker.Item label="Mista" value="mista" />
                </Picker>

                <View style={styles.sliderContainer}>
                  <Text style={styles.label}>Difficoltà: {editingSubject.difficulty}/10</Text>
                  <View style={styles.sliderButtons}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={[
                          styles.sliderButton,
                          editingSubject.difficulty === num && styles.sliderButtonActive
                        ]}
                        onPress={() => setEditingSubject({ ...editingSubject, difficulty: num })}
                      >
                        <Text style={styles.sliderButtonText}>{num}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.sliderContainer}>
                  <Text style={styles.label}>Priorità: {editingSubject.priority}/10</Text>
                  <View style={styles.sliderButtons}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={[
                          styles.sliderButton,
                          editingSubject.priority === num && styles.sliderButtonActive
                        ]}
                        onPress={() => setEditingSubject({ ...editingSubject, priority: num })}
                      >
                        <Text style={styles.sliderButtonText}>{num}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Text style={styles.label}>Colore</Text>
                <View style={styles.colorPicker}>
                  {subjectColors.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        editingSubject.color === color && styles.colorOptionSelected
                      ]}
                      onPress={() => setEditingSubject({ ...editingSubject, color })}
                    />
                  ))}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setShowEditModal(false);
                      setEditingSubject(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={updateSubject}
                  >
                    <Text style={styles.saveButtonText}>Salva</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  scrollContent: {
    paddingVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  formContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
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
    marginBottom: 16,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButtonActive: {
    backgroundColor: Colors.primary,
  },
  sliderButtonText: {
    fontSize: 12,
    color: '#333',
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#333',
  },
  saveButton: {
    backgroundColor: Colors.success,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  subjectsContainer: {
    paddingHorizontal: 20,
  },
  subjectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectColor: {
    width: 4,
    height: 50,
    borderRadius: 2,
    marginRight: 12,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  subjectDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  subjectHours: {
    fontSize: 12,
    color: '#999',
  },
  subjectActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
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
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
});