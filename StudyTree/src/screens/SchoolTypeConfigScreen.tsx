import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

const SCHOOL_TYPES = {
  superiore: [
    { value: 'liceo_classico', label: 'Liceo Classico' },
    { value: 'liceo_scientifico', label: 'Liceo Scientifico' },
    { value: 'liceo_linguistico', label: 'Liceo Linguistico' },
    { value: 'liceo_artistico', label: 'Liceo Artistico' },
    { value: 'liceo_musicale', label: 'Liceo Musicale e Coreutico' },
    { value: 'liceo_scienze_umane', label: 'Liceo Scienze Umane' },
    { value: 'istituto_tecnico', label: 'Istituto Tecnico' },
    { value: 'istituto_professionale', label: 'Istituto Professionale' }
  ]
};

export default function SchoolTypeConfigScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolLevel, setSchoolLevel] = useState<'media' | 'superiore'>('media');
  const [schoolType, setSchoolType] = useState<string>('');
  const [year, setYear] = useState<number>(1);
  const [existingConfig, setExistingConfig] = useState<any>(null);

  useEffect(() => {
    fetchExistingConfig();
  }, []);

  const fetchExistingConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('school_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setExistingConfig(data);
        setSchoolLevel(data.school_level);
        setSchoolType(data.school_type || '');
        setYear(data.year);
      }
    } catch (error) {
      console.log('Nessuna configurazione esistente');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (schoolLevel === 'superiore' && !schoolType) {
      Alert.alert('Errore', 'Seleziona il tipo di scuola superiore');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const configData = {
        user_id: user.id,
        school_level: schoolLevel,
        school_type: schoolLevel === 'superiore' ? schoolType : null,
        year: year,
        updated_at: new Date().toISOString()
      };

      if (existingConfig) {
        const { error } = await supabase
          .from('school_config')
          .update(configData)
          .eq('id', existingConfig.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('school_config')
          .insert([configData]);
        
        if (error) throw error;
      }

      Alert.alert(
        '✅ Salvato', 
        'Configurazione scuola salvata. I tempi di studio saranno ottimizzati in base al tuo tipo di scuola.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare la configurazione');
    } finally {
      setSaving(false);
    }
  };

  const getSchoolDescription = () => {
    if (schoolLevel === 'media') {
      return 'Scuola secondaria di primo grado (11-14 anni)';
    }
    if (!schoolType) return 'Seleziona il tipo di scuola superiore';
    
    const selected = SCHOOL_TYPES.superiore.find(s => s.value === schoolType);
    return selected?.label || '';
  };

  const getEstimatedStudyTime = () => {
    if (schoolLevel === 'media') {
      return '1-2 ore al giorno';
    }
    
    switch(schoolType) {
      case 'liceo_classico':
        return '3-4 ore al giorno (greco, latino, filosofia)';
      case 'liceo_scientifico':
        return '2.5-3.5 ore al giorno (matematica, fisica, scienze)';
      case 'liceo_linguistico':
        return '2.5-3 ore al giorno (lingue straniere)';
      case 'liceo_artistico':
        return '2-3 ore al giorno + progetti artistici';
      case 'istituto_tecnico':
        return '2-3 ore al giorno (materie tecniche)';
      default:
        return '2-3 ore al giorno';
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Ionicons name="school" size={48} color={Colors.primary} />
          <Text style={styles.title}>Configurazione Tipo Scuola</Text>
          <Text style={styles.subtitle}>
            Questo ci aiuta a stimare meglio i tempi di studio
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📚 Livello Scolastico</Text>
          
          <View style={styles.levelButtons}>
            <TouchableOpacity
              style={[
                styles.levelButton,
                schoolLevel === 'media' && styles.levelButtonActive
              ]}
              onPress={() => {
                setSchoolLevel('media');
                setSchoolType('');
              }}
            >
              <Text style={[
                styles.levelButtonText,
                schoolLevel === 'media' && styles.levelButtonTextActive
              ]}>
                Scuola Media
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.levelButton,
                schoolLevel === 'superiore' && styles.levelButtonActive
              ]}
              onPress={() => setSchoolLevel('superiore')}
            >
              <Text style={[
                styles.levelButtonText,
                schoolLevel === 'superiore' && styles.levelButtonTextActive
              ]}>
                Scuola Superiore
              </Text>
            </TouchableOpacity>
          </View>

          {schoolLevel === 'superiore' && (
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Tipo di scuola superiore:</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={schoolType}
                  onValueChange={setSchoolType}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleziona..." value="" />
                  {SCHOOL_TYPES.superiore.map(type => (
                    <Picker.Item 
                      key={type.value} 
                      label={type.label} 
                      value={type.value} 
                    />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          <View style={styles.yearContainer}>
            <Text style={styles.label}>Anno di corso:</Text>
            <View style={styles.yearButtons}>
              {[1, 2, 3, 4, 5].map(y => (
                <TouchableOpacity
                  key={y}
                  style={[
                    styles.yearButton,
                    year === y && styles.yearButtonActive,
                    (schoolLevel === 'media' && y > 3) && styles.yearButtonDisabled
                  ]}
                  onPress={() => setYear(y)}
                  disabled={schoolLevel === 'media' && y > 3}
                >
                  <Text style={[
                    styles.yearButtonText,
                    year === y && styles.yearButtonTextActive
                  ]}>
                    {y}°
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <Text style={styles.infoTitle}>Info Configurazione</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Scuola:</Text>
            <Text style={styles.infoValue}>{getSchoolDescription()}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tempo studio stimato:</Text>
            <Text style={styles.infoValue}>{getEstimatedStudyTime()}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Anno:</Text>
            <Text style={styles.infoValue}>{year}° anno</Text>
          </View>
        </View>

        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>🎯 Vantaggi della configurazione</Text>
          <View style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.benefitText}>
              Stime personalizzate per il tuo tipo di scuola
            </Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.benefitText}>
              Priorità automatica per materie caratterizzanti
            </Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.benefitText}>
              Suggerimenti basati su dati di studenti simili
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveConfig}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="white" />
              <Text style={styles.saveButtonText}>
                {existingConfig ? 'Aggiorna Configurazione' : 'Salva Configurazione'}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
    alignItems: 'center',
    padding: 20,
    paddingTop: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray600,
    marginTop: 5,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 15,
  },
  levelButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  levelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: 'center',
  },
  levelButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  levelButtonText: {
    fontSize: 16,
    color: Colors.gray600,
    fontWeight: '500',
  },
  levelButtonTextActive: {
    color: 'white',
  },
  pickerContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: Colors.gray600,
    marginBottom: 8,
    fontWeight: '500',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: 10,
    backgroundColor: Colors.gray50,
  },
  picker: {
    height: 50,
  },
  yearContainer: {
    marginTop: 10,
  },
  yearButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  yearButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gray300,
    alignItems: 'center',
  },
  yearButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yearButtonDisabled: {
    opacity: 0.3,
  },
  yearButtonText: {
    fontSize: 14,
    color: Colors.gray600,
    fontWeight: '500',
  },
  yearButtonTextActive: {
    color: 'white',
  },
  infoCard: {
    backgroundColor: Colors.gray50,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.gray600,
    width: 120,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: Colors.secondary,
    fontWeight: '500',
  },
  benefitsCard: {
    backgroundColor: '#f0fdf4',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 12,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.gray700,
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
    fontWeight: '600',
    marginLeft: 8,
  },
});