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
  Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

const { width } = Dimensions.get('window');

export default function AdminDashboardScreen({ navigation }: any) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');
  const [statistics, setStatistics] = useState<any>(null);
  const [configurations, setConfigurations] = useState<any[]>([]);
  const [newConfig, setNewConfig] = useState({
    school_type: 'liceo',
    class_year: 1,
    subject_name: '',
    avg_study_time_per_lesson: 60,
    avg_break_between_lessons: 15,
    avg_weekly_revision_time: 30,
    avg_exam_preparation_time: 120
  });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isUserAdmin = role?.role === 'admin';
      setIsAdmin(isUserAdmin);

      if (isUserAdmin) {
        fetchStatistics();
        fetchConfigurations();
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const { data: trackingData } = await supabase
        .from('study_time_tracking')
        .select('*, subjects(name)')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: usersCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' });

      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('name')
        .limit(50);

      const subjectStats: any = {};
      trackingData?.forEach(track => {
        const subjectName = track.subjects?.name || 'Unknown';
        if (!subjectStats[subjectName]) {
          subjectStats[subjectName] = {
            totalTime: 0,
            sessions: 0,
            avgQuality: 0,
            avgDifficulty: 0
          };
        }
        subjectStats[subjectName].totalTime += track.actual_duration || 0;
        subjectStats[subjectName].sessions += 1;
        subjectStats[subjectName].avgQuality += track.quality_score || 0;
        subjectStats[subjectName].avgDifficulty += track.difficulty_perceived || 0;
      });

      Object.keys(subjectStats).forEach(subject => {
        const stats = subjectStats[subject];
        stats.avgQuality = stats.sessions > 0 ? (stats.avgQuality / stats.sessions).toFixed(1) : 0;
        stats.avgDifficulty = stats.sessions > 0 ? (stats.avgDifficulty / stats.sessions).toFixed(1) : 0;
        stats.avgTime = stats.sessions > 0 ? Math.round(stats.totalTime / stats.sessions) : 0;
      });

      setStatistics({
        totalUsers: usersCount?.length || 0,
        totalSessions: trackingData?.length || 0,
        subjectStats,
        uniqueSubjects: Object.keys(subjectStats).length
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const fetchConfigurations = async () => {
    try {
      const { data, error } = await supabase
        .from('study_configurations')
        .select('*')
        .order('school_type, class_year, subject_name');

      if (error) throw error;
      setConfigurations(data || []);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    }
  };

  const saveConfiguration = async () => {
    if (!newConfig.subject_name) {
      Alert.alert('Errore', 'Inserisci il nome della materia');
      return;
    }

    try {
      const { error } = await supabase
        .from('study_configurations')
        .upsert([newConfig], {
          onConflict: 'school_type,class_year,subject_name'
        });

      if (error) throw error;

      Alert.alert('Successo', 'Configurazione salvata');
      fetchConfigurations();
      setNewConfig({
        ...newConfig,
        subject_name: '',
        avg_study_time_per_lesson: 60
      });
    } catch (error) {
      Alert.alert('Errore', (error as any).message);
    }
  };

  const updateGlobalConfigurations = async () => {
    try {
      const { error } = await supabase.rpc('update_global_configurations');
      
      if (error) throw error;
      
      Alert.alert('Successo', 'Configurazioni aggiornate con i dati più recenti');
      fetchConfigurations();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare le configurazioni');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
        <View style={styles.accessDenied}>
          <Icon name="lock" size={64} color="#ccc" />
          <Text style={styles.accessDeniedText}>Accesso riservato agli amministratori</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard Admin</Text>
          <Text style={styles.subtitle}>Gestione configurazioni e statistiche</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
            onPress={() => setActiveTab('stats')}
          >
            <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
              Statistiche
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'config' && styles.activeTab]}
            onPress={() => setActiveTab('config')}
          >
            <Text style={[styles.tabText, activeTab === 'config' && styles.activeTabText]}>
              Configurazioni
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'stats' && statistics && (
          <View style={styles.statsContainer}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Icon name="people" size={32} color={Colors.primary} />
                <Text style={styles.statValue}>{statistics.totalUsers}</Text>
                <Text style={styles.statLabel}>Utenti Totali</Text>
              </View>
              <View style={styles.statCard}>
                <Icon name="timer" size={32} color={Colors.success} />
                <Text style={styles.statValue}>{statistics.totalSessions}</Text>
                <Text style={styles.statLabel}>Sessioni Totali</Text>
              </View>
              <View style={styles.statCard}>
                <Icon name="book" size={32} color={Colors.warning} />
                <Text style={styles.statValue}>{statistics.uniqueSubjects}</Text>
                <Text style={styles.statLabel}>Materie Uniche</Text>
              </View>
            </View>

            <View style={styles.subjectStatsContainer}>
              <Text style={styles.sectionTitle}>Statistiche per Materia</Text>
              {Object.entries(statistics.subjectStats).map(([subject, stats]) => (
                <View key={subject} style={styles.subjectStatCard}>
                  <Text style={styles.subjectName}>{subject}</Text>
                  <View style={styles.subjectStatRow}>
                    <Text style={styles.subjectStatText}>
                      Tempo medio: {stats.avgTime} min
                    </Text>
                    <Text style={styles.subjectStatText}>
                      Sessioni: {stats.sessions}
                    </Text>
                  </View>
                  <View style={styles.subjectStatRow}>
                    <Text style={styles.subjectStatText}>
                      Qualità: {stats.avgQuality}/10
                    </Text>
                    <Text style={styles.subjectStatText}>
                      Difficoltà: {stats.avgDifficulty}/10
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.updateButton}
              onPress={updateGlobalConfigurations}
            >
              <Icon name="refresh" size={20} color="white" />
              <Text style={styles.updateButtonText}>
                Aggiorna Configurazioni Globali
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'config' && (
          <View style={styles.configContainer}>
            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>Nuova Configurazione</Text>
              
              <Text style={styles.label}>Tipologia Scuola</Text>
              <Picker
                selectedValue={newConfig.school_type}
                style={styles.picker}
                onValueChange={(value) => setNewConfig({ ...newConfig, school_type: value })}
              >
                <Picker.Item label="Liceo" value="liceo" />
                <Picker.Item label="Tecnico" value="tecnico" />
                <Picker.Item label="Professionale" value="professionale" />
                <Picker.Item label="Università" value="università" />
              </Picker>

              <Text style={styles.label}>Classe/Anno</Text>
              <Picker
                selectedValue={newConfig.class_year}
                style={styles.picker}
                onValueChange={(value) => setNewConfig({ ...newConfig, class_year: value })}
              >
                {[1, 2, 3, 4, 5].map(year => (
                  <Picker.Item key={year} label={`${year}°`} value={year} />
                ))}
              </Picker>

              <TextInput
                style={styles.input}
                placeholder="Nome Materia"
                placeholderTextColor="#999"
                value={newConfig.subject_name}
                onChangeText={(text) => setNewConfig({ ...newConfig, subject_name: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Tempo medio per lezione (minuti)"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={newConfig.avg_study_time_per_lesson.toString()}
                onChangeText={(text) => setNewConfig({ 
                  ...newConfig, 
                  avg_study_time_per_lesson: parseInt(text) || 60 
                })}
              />

              <TextInput
                style={styles.input}
                placeholder="Pausa tra lezioni (minuti)"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={newConfig.avg_break_between_lessons.toString()}
                onChangeText={(text) => setNewConfig({ 
                  ...newConfig, 
                  avg_break_between_lessons: parseInt(text) || 15 
                })}
              />

              <TouchableOpacity style={styles.saveButton} onPress={saveConfiguration}>
                <Text style={styles.saveButtonText}>Salva Configurazione</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.configListContainer}>
              <Text style={styles.sectionTitle}>Configurazioni Esistenti</Text>
              {configurations.map((config) => (
                <View key={config.id} style={styles.configCard}>
                  <Text style={styles.configTitle}>
                    {config.subject_name} - {config.school_type} {config.class_year}°
                  </Text>
                  <Text style={styles.configDetail}>
                    Studio: {config.avg_study_time_per_lesson} min | 
                    Pausa: {config.avg_break_between_lessons} min
                  </Text>
                  <Text style={styles.configDetail}>
                    Campioni: {config.sample_count} | 
                    Ultimo aggiornamento: {new Date(config.last_updated).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
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
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDeniedText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'white',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.primary,
  },
  statsContainer: {
    paddingHorizontal: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: (width - 60) / 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  subjectStatsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  subjectStatCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  subjectStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  subjectStatText: {
    fontSize: 14,
    color: '#666',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  configContainer: {
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
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
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
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
  configListContainer: {
    marginBottom: 20,
  },
  configCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  configTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  configDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
});