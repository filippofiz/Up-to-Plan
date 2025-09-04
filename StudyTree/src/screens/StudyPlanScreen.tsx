import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

interface StudySlot {
  id: string;
  subject_name: string;
  subject_color: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  study_type: string;
  priority: number;
  completed?: boolean;
  started?: boolean;
  actual_start_time?: string;
  actual_end_time?: string;
  actual_duration?: number;
  daysToExam?: number;
  examTitle?: string;
  isAdapted?: boolean;
  adaptationFactor?: number;
  historicalPerformance?: number;
}

interface DailyPlan {
  date: string;
  dayOfWeek: string;
  slots: StudySlot[];
  totalMinutes: number;
  schoolEndTime?: string;
}

const { width } = Dimensions.get('window');

export default function StudyPlanScreen({ navigation }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekPlan, setWeekPlan] = useState<DailyPlan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasConfig, setHasConfig] = useState(false);
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  useEffect(() => {
    generateWeekDays();
    checkConfiguration();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      checkConfiguration();
    });
    return unsubscribe;
  }, [navigation]);

  const generateWeekDays = () => {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      days.push(day);
    }
    setWeekDays(days);
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDayName = (date: Date) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    return days[date.getDay()];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  };

  const checkConfiguration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Controlla se ci sono materie configurate
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      // Controlla se c'è un orario scolastico
      const { data: schedule } = await supabase
        .from('school_schedule')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const isConfigured = subjects && subjects.length > 0 && schedule && schedule.length > 0;
      setHasConfig(!!isConfigured);

      if (isConfigured) {
        await loadStudyPlan();
      }
    } catch (error) {
      console.error('Errore controllo configurazione:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudyPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const weekPlans: DailyPlan[] = [];

      // Genera piano per i prossimi 7 giorni
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const dayOfWeek = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][currentDate.getDay()];

        // Carica orario scolastico per questo giorno
        const { data: schoolSchedule } = await supabase
          .from('school_schedule')
          .select('end_time')
          .eq('user_id', user.id)
          .eq('day_of_week', dayOfWeek)
          .eq('is_break', false)
          .order('end_time', { ascending: false })
          .limit(1);

        const schoolEndTime = schoolSchedule?.[0]?.end_time;

        // Genera piano di studio per questo giorno
        const dailySlots = await generateDailyPlan(user.id, dateStr, dayOfWeek, schoolEndTime);

        const plan: DailyPlan = {
          date: dateStr,
          dayOfWeek,
          slots: dailySlots,
          totalMinutes: dailySlots.reduce((acc, slot) => acc + slot.duration_minutes, 0),
          schoolEndTime
        };

        weekPlans.push(plan);
      }

      setWeekPlan(weekPlans);
    } catch (error) {
      console.error('Errore caricamento piano:', error);
      Alert.alert('Errore', 'Impossibile caricare il piano di studio');
    }
  };

  const generateDailyPlan = async (userId: string, date: string, dayOfWeek: string, schoolEndTime?: string): Promise<StudySlot[]> => {
    const slots: StudySlot[] = [];
    
    // 1. Carica esami imminenti (prossime 2 settimane)
    const { data: upcomingExams } = await supabase
      .from('exams')
      .select('*, subjects(name, color)')
      .eq('user_id', userId)
      .gte('exam_date', date)
      .lte('exam_date', new Date(new Date(date).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('exam_date');

    // 2. Carica sport e attività ricorrenti per questo giorno
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .single();

    const dayAbbr = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][new Date(date).getDay()];
    const activities = userSettings?.settings?.recurring_activities?.filter(
      (activity: any) => activity.day === dayAbbr
    ) || [];

    // 3. Carica materie
    const { data: subjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false });

    if (!subjects || subjects.length === 0) return slots;

    // 4. Calcola tempo di studio disponibile in modo intelligente
    let startTime: Date, endTime: Date, maxDailyStudyHours: number;
    
    if (dayOfWeek === 'Sabato' || dayOfWeek === 'Domenica') {
      // WEEKEND: Massimo 3-4 ore, non 9! Inizio più tardi
      startTime = new Date(`${date}T10:00:00`);
      endTime = new Date(`${date}T18:00:00`);
      maxDailyStudyHours = dayOfWeek === 'Domenica' ? 3 : 4;
    } else {
      // GIORNI SCUOLA: Dopo scuola + pausa pranzo
      if (schoolEndTime) {
        const [hours, minutes] = schoolEndTime.split(':').map(Number);
        startTime = new Date(`${date}T${hours}:${minutes}:00`);
        startTime.setMinutes(startTime.getMinutes() + 90); // 1.5h pausa pranzo
      } else {
        startTime = new Date(`${date}T15:00:00`);
      }
      endTime = new Date(`${date}T20:30:00`);
      maxDailyStudyHours = 4;
    }

    let currentTime = new Date(startTime);
    let totalStudyMinutes = 0;
    const maxStudyMinutes = maxDailyStudyHours * 60;

    // 5. Prima inserisci le attività fisse (sport)
    for (const activity of activities) {
      const activityStart = new Date(`${date}T${activity.startTime}:00`);
      const activityEnd = new Date(activityStart);
      const totalActivityTime = activity.duration + (activity.commuteTime || 0) * 2; // andata + ritorno
      activityEnd.setMinutes(activityEnd.getMinutes() + totalActivityTime);

      slots.push({
        id: `${date}-activity-${activity.name}-${Date.now()}`,
        subject_name: `🏃 ${activity.name}`,
        subject_color: activity.type === 'sport' ? '#FF6B6B' : '#4ECDC4',
        start_time: activityStart.toTimeString().slice(0, 5),
        end_time: activityEnd.toTimeString().slice(0, 5),
        duration_minutes: totalActivityTime,
        study_type: 'sport',
        priority: 10, // Alta priorità per non essere spostato
        completed: false
      });
    }

    // 6. Carica dati storici per adattamento automatico
    const { data: historicalData } = await supabase
      .from('daily_study_tracking')
      .select('subject_id, planned_minutes, actual_minutes, productivity_rating, difficulty_rating')
      .eq('user_id', userId)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Ultimi 30 giorni
      .eq('completed', true);

    // 7. Calcola fattori di adattamento per ogni materia
    const subjectsWithAdaptation = subjects.map(subject => {
      const subjectHistory = historicalData?.filter(h => h.subject_id === subject.id) || [];
      
      let adaptationFactor = 1.0;
      let efficiencyScore = 1.0;
      
      if (subjectHistory.length > 0) {
        // Calcola efficienza media (tempo effettivo vs pianificato)
        const avgEfficiency = subjectHistory.reduce((acc, h) => {
          return acc + (h.actual_minutes / Math.max(h.planned_minutes, 1));
        }, 0) / subjectHistory.length;
        
        // Calcola produttività media
        const avgProductivity = subjectHistory.reduce((acc, h) => {
          return acc + (h.productivity_rating || 5);
        }, 0) / subjectHistory.length;
        
        // Calcola difficoltà percepita media
        const avgPerceivedDifficulty = subjectHistory.reduce((acc, h) => {
          return acc + (h.difficulty_rating || 5);
        }, 0) / subjectHistory.length;
        
        // Adatta i tempi in base alla storia
        if (avgEfficiency > 1.2) {
          adaptationFactor = 1.15; // Se impiega più tempo del previsto
        } else if (avgEfficiency < 0.8) {
          adaptationFactor = 0.9; // Se è più veloce del previsto
        }
        
        // Adatta in base alla produttività
        if (avgProductivity < 4) {
          adaptationFactor *= 1.1; // Se è poco produttivo, più tempo
        } else if (avgProductivity > 7) {
          adaptationFactor *= 0.95; // Se è molto produttivo, meno tempo
        }
        
        efficiencyScore = Math.min(avgProductivity / 5, 2); // Max 2x efficiency
      }
      
      const upcomingExam = upcomingExams?.find(exam => exam.subject === subject.name);
      const daysToExam = upcomingExam ? 
        Math.ceil((new Date(upcomingExam.exam_date).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)) : 
        999;
      
      return {
        ...subject,
        upcomingExam,
        daysToExam,
        urgency: daysToExam <= 3 ? 20 : daysToExam <= 7 ? 10 : daysToExam <= 14 ? 5 : 1,
        adaptationFactor,
        efficiencyScore,
        historicalPerformance: subjectHistory.length
      };
    });

    // 8. Ordina le materie per priorità adattata
    const subjectsWithExams = subjectsWithAdaptation.sort((a, b) => {
      // Prima le materie con esami imminenti, poi per priorità adattata
      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      
      // Considera l'efficienza storica nella priorità
      const aPriorityAdapted = a.priority * (2 - a.efficiencyScore);
      const bPriorityAdapted = b.priority * (2 - b.efficiencyScore);
      
      return bPriorityAdapted - aPriorityAdapted;
    });

    // 7. Genera sessioni di studio intelligenti
    let studySessionCount = 0;
    for (const subject of subjectsWithExams.slice(0, 4)) { // Max 4 materie al giorno
      if (currentTime >= endTime || totalStudyMinutes >= maxStudyMinutes) break;

      // Verifica conflitti con attività
      while (slots.some(slot => {
        const slotStart = new Date(`${date}T${slot.start_time}:00`);
        const slotEnd = new Date(`${date}T${slot.end_time}:00`);
        return currentTime >= slotStart && currentTime < slotEnd;
      })) {
        currentTime.setMinutes(currentTime.getMinutes() + 15);
        if (currentTime >= endTime) break;
      }

      if (currentTime >= endTime) break;

      // Calcola durata sessione intelligente con adattamento
      let sessionMinutes = 45; // Base: 45 minuti (Pomodoro esteso)
      
      if (subject.daysToExam <= 3) {
        sessionMinutes = 90; // Pre-esame: sessioni più lunghe
      } else if (subject.daysToExam <= 7) {
        sessionMinutes = 75; // Settimana prima: sessioni lunghe
      } else if (subject.difficulty >= 8) {
        sessionMinutes = 60; // Materie difficili: più tempo
      } else if (dayOfWeek === 'Sabato' || dayOfWeek === 'Domenica') {
        sessionMinutes = Math.max(30, sessionMinutes - 15); // Weekend: sessioni più corte
      }

      // ADATTAMENTO AUTOMATICO: Applica il fattore basato sulla cronologia
      sessionMinutes = Math.round(sessionMinutes * subject.adaptationFactor);
      
      // Se ha dati storici, mostra nell'interfaccia che è adattato
      const isAdapted = subject.historicalPerformance > 2 && Math.abs(subject.adaptationFactor - 1) > 0.05;

      // Limita in base al tempo rimasto
      const timeLeft = Math.min(
        Math.floor((endTime.getTime() - currentTime.getTime()) / 60000),
        maxStudyMinutes - totalStudyMinutes
      );
      sessionMinutes = Math.min(sessionMinutes, timeLeft);

      if (sessionMinutes >= 25) { // Minimo 25 minuti (Pomodoro)
        const sessionEnd = new Date(currentTime);
        sessionEnd.setMinutes(sessionEnd.getMinutes() + sessionMinutes);

        // Determina colore e tipo in base a urgenza esame
        let color = subject.color || '#3498db';
        let studyType = 'ripasso';
        
        if (subject.daysToExam <= 3) {
          color = '#FF4757'; // Rosso intenso per urgenza massima
          studyType = '🔥 INTENSIVO';
        } else if (subject.daysToExam <= 7) {
          color = '#FF6B35'; // Arancione per prossimi esami
          studyType = '📚 PREPARAZIONE';
        } else if (subject.difficulty >= 7) {
          studyType = '💪 ESERCIZI';
        } else {
          studyType = '📖 RIPASSO';
        }

        slots.push({
          id: `${date}-${subject.id}-${Date.now()}`,
          subject_name: subject.name,
          subject_color: color,
          start_time: currentTime.toTimeString().slice(0, 5),
          end_time: sessionEnd.toTimeString().slice(0, 5),
          duration_minutes: sessionMinutes,
          study_type: studyType,
          priority: subject.priority + subject.urgency,
          completed: false,
          daysToExam: subject.daysToExam,
          examTitle: subject.upcomingExam?.title,
          isAdapted,
          adaptationFactor: subject.adaptationFactor,
          historicalPerformance: subject.historicalPerformance
        });

        totalStudyMinutes += sessionMinutes;
        studySessionCount++;

        // Pausa intelligente tra sessioni
        currentTime = new Date(sessionEnd);
        let pauseMinutes = 10;
        
        if (sessionMinutes >= 90) {
          pauseMinutes = 20; // Pausa lunga dopo sessioni intensive
        } else if (sessionMinutes >= 60) {
          pauseMinutes = 15; // Pausa media dopo sessioni lunghe
        }

        // Aggiungi pausa visibile ogni 2 sessioni o dopo 2 ore
        if (studySessionCount % 2 === 0 || totalStudyMinutes > 0 && totalStudyMinutes % 120 < sessionMinutes) {
          const pauseEnd = new Date(currentTime);
          pauseEnd.setMinutes(pauseEnd.getMinutes() + pauseMinutes);
          
          if (pauseEnd < endTime) {
            slots.push({
              id: `${date}-break-${Date.now()}`,
              subject_name: pauseMinutes >= 20 ? '☕ Pausa Lunga' : '🍃 Pausa',
              subject_color: '#95E1D3',
              start_time: currentTime.toTimeString().slice(0, 5),
              end_time: pauseEnd.toTimeString().slice(0, 5),
              duration_minutes: pauseMinutes,
              study_type: 'pausa',
              priority: 0,
              completed: false
            });
          }
        }

        currentTime.setMinutes(currentTime.getMinutes() + pauseMinutes);
      }
    }

    // 8. Aggiungi suggerimenti per fine giornata
    if (totalStudyMinutes > 60 && currentTime < endTime) {
      const suggestionEnd = new Date(currentTime);
      suggestionEnd.setMinutes(suggestionEnd.getMinutes() + 15);
      
      if (suggestionEnd <= endTime) {
        slots.push({
          id: `${date}-review-${Date.now()}`,
          subject_name: '📝 Revisione Giornata',
          subject_color: '#A8E6CF',
          start_time: currentTime.toTimeString().slice(0, 5),
          end_time: suggestionEnd.toTimeString().slice(0, 5),
          duration_minutes: 15,
          study_type: 'revisione',
          priority: 1,
          completed: false
        });
      }
    }

    return slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudyPlan();
    setRefreshing(false);
  };

  const handleSessionAction = async (slot: StudySlot) => {
    if (slot.study_type === 'sport' || slot.study_type === 'pausa') {
      // Per sport e pause: segna direttamente come completato
      Alert.alert('✅', `${slot.subject_name} completato!`);
      return;
    }

    if (activeSession === slot.id) {
      // FINE SESSIONE: Mostra opzioni di completamento
      const actualDuration = sessionStartTime ? 
        Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 60000) : 
        slot.duration_minutes;
      
      Alert.alert(
        '⏱️ Sessione Terminata',
        `Hai studiato ${slot.subject_name} per ${actualDuration} minuti.\nCome è andata?`,
        [
          {
            text: '🔄 Continua',
            onPress: () => {
              // Continua la sessione
            }
          },
          {
            text: '📚 Studia Ancora',
            onPress: () => completeSession(slot, actualDuration, 'continue')
          },
          {
            text: '✅ Completato',
            onPress: () => completeSession(slot, actualDuration, 'completed')
          },
          {
            text: '📸 Valuta Studio',
            onPress: () => openStudyEvaluation(slot, actualDuration)
          }
        ]
      );
    } else {
      // INIZIO SESSIONE
      if (activeSession) {
        Alert.alert('⚠️', 'Completa prima la sessione attuale!');
        return;
      }
      
      Alert.alert(
        '🎯 Inizia Studio',
        `Iniziare la sessione di ${slot.subject_name}?\nDurata prevista: ${slot.duration_minutes} min`,
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: '▶️ Inizia',
            onPress: () => startSession(slot)
          }
        ]
      );
    }
  };

  const startSession = (slot: StudySlot) => {
    setActiveSession(slot.id);
    setSessionStartTime(new Date());
    
    // Naviga alla schermata di focus
    navigation.navigate('StudyFocus', {
      slot,
      onComplete: (actualDuration: number, completed: boolean) => {
        if (completed) {
          completeSession(slot, actualDuration, 'completed');
        } else {
          completeSession(slot, actualDuration, 'continue');
        }
      },
      onEvaluate: (actualDuration: number) => {
        openStudyEvaluation(slot, actualDuration);
      }
    });
  };

  const completeSession = async (slot: StudySlot, actualDuration: number, status: 'completed' | 'continue') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Salva il tracking nel database
      await supabase.from('daily_study_tracking').insert({
        user_id: user.id,
        date: formatDate(selectedDate),
        subject_id: slot.id.split('-')[1],
        planned_minutes: slot.duration_minutes,
        actual_minutes: actualDuration,
        completed: status === 'completed',
        planned_start_time: slot.start_time,
        planned_end_time: slot.end_time,
        actual_start_time: sessionStartTime?.toTimeString().slice(0, 5),
        actual_end_time: new Date().toTimeString().slice(0, 5),
        notes: status === 'completed' ? 'Sessione completata' : 'Da continuare'
      });

      setActiveSession(null);
      setSessionStartTime(null);
      
      if (status === 'completed') {
        Alert.alert('🎉 Ottimo Lavoro!', `Hai completato la sessione di ${slot.subject_name}!`);
      } else {
        Alert.alert('📚', 'Sessione salvata. Ricorda di continuare dopo!');
      }
      
      // Ricarica il piano per aggiornare i progressi
      loadStudyPlan();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare il progresso');
    }
  };

  const openStudyEvaluation = (slot: StudySlot, actualDuration: number) => {
    // Naviga alla schermata di valutazione AI
    navigation.navigate('StudyEvaluation', { 
      slot, 
      actualDuration,
      onComplete: (evaluation: any) => {
        completeSession(slot, actualDuration, 'completed');
        // Salva anche la valutazione AI
      }
    });
  };

  const openDailyTracking = (date: string) => {
    navigation.navigate('Config', {
      screen: 'DailyTracking',
      params: { date }
    });
  };

  if (loading) {
    return (
      <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </LinearGradient>
    );
  }

  if (!hasConfig) {
    return (
      <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={80} color={Colors.gray400} />
          <Text style={styles.emptyTitle}>Configurazione Richiesta</Text>
          <Text style={styles.emptyText}>
            Per generare il piano di studio personalizzato, devi prima:
          </Text>
          <View style={styles.requirementsList}>
            <Text style={styles.requirement}>1. Configurare il tipo di scuola</Text>
            <Text style={styles.requirement}>2. Aggiungere le materie di studio</Text>
            <Text style={styles.requirement}>3. Inserire l'orario scolastico</Text>
          </View>
          <TouchableOpacity
            style={styles.configButton}
            onPress={() => navigation.navigate('Config')}
          >
            <Ionicons name="settings-outline" size={20} color="white" />
            <Text style={styles.configButtonText}>Vai alla Configurazione</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const selectedDayPlan = weekPlan.find(plan => 
    isSameDay(new Date(plan.date), selectedDate)
  );

  return (
    <LinearGradient colors={[Colors.background, Colors.backgroundSecondary]} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Calendario con scorrimento giorni */}
        <View style={styles.calendarHeader}>
          <Text style={styles.monthTitle}>
            {selectedDate.toLocaleDateString('it-IT', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </Text>
          
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={weekDays}
            keyExtractor={(item) => item.toISOString()}
            contentContainerStyle={styles.daysScrollContainer}
            renderItem={({ item: day }) => (
              <TouchableOpacity
                style={[
                  styles.dayButton,
                  isSameDay(day, selectedDate) && styles.selectedDayButton,
                  isToday(day) && styles.todayButton
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[
                  styles.dayButtonText,
                  isSameDay(day, selectedDate) && styles.selectedDayText,
                  isToday(day) && styles.todayText
                ]}>
                  {formatDayName(day)}
                </Text>
                <Text style={[
                  styles.dayButtonDate,
                  isSameDay(day, selectedDate) && styles.selectedDayText,
                  isToday(day) && styles.todayText
                ]}>
                  {day.getDate()}
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* Frecce navigazione */}
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                const newDays = weekDays.map(d => {
                  const newDate = new Date(d);
                  newDate.setDate(d.getDate() - 7);
                  return newDate;
                });
                setWeekDays(newDays);
              }}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                const newDays = weekDays.map(d => {
                  const newDate = new Date(d);
                  newDate.setDate(d.getDate() + 7);
                  return newDate;
                });
                setWeekDays(newDays);
              }}
            >
              <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Piano del giorno selezionato */}
        {selectedDayPlan ? (
          <View style={styles.selectedDayContainer}>
            <View style={styles.dayPlanHeader}>
              <Text style={styles.selectedDayTitle}>
                {selectedDate.toLocaleDateString('it-IT', { 
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </Text>
              {selectedDayPlan.schoolEndTime && (
                <View style={styles.schoolInfo}>
                  <Ionicons name="school" size={16} color={Colors.gray600} />
                  <Text style={styles.schoolText}>
                    Scuola fino alle {selectedDayPlan.schoolEndTime}
                  </Text>
                </View>
              )}
            </View>

            {selectedDayPlan.slots.length > 0 ? (
              <>
                <View style={styles.timelineContainer}>
                  {selectedDayPlan.slots.map((slot, index) => (
                    <View key={slot.id} style={styles.timelineItem}>
                      <View style={styles.timelineTime}>
                        <Text style={styles.timeText}>{slot.start_time}</Text>
                      </View>
                      <View style={styles.timelineDot}>
                        <View style={[styles.dot, { backgroundColor: slot.subject_color }]} />
                        {index < selectedDayPlan.slots.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.timelineCard, 
                          { borderLeftColor: slot.subject_color },
                          activeSession === slot.id && styles.activeSessionCard
                        ]}
                        onPress={() => handleSessionAction(slot)}
                      >
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardSubject}>{slot.subject_name}</Text>
                          <View style={[styles.cardBadge, { backgroundColor: slot.subject_color + '20' }]}>
                            <Text style={[styles.cardBadgeText, { color: slot.subject_color }]}>
                              {slot.study_type}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.cardTimeContainer}>
                          <Text style={styles.cardTime}>
                            {slot.start_time} - {slot.end_time} • {slot.duration_minutes} min
                          </Text>
                          {activeSession === slot.id && (
                            <View style={styles.activeIndicator}>
                              <Text style={styles.activeText}>⏱️ IN CORSO</Text>
                            </View>
                          )}
                        </View>
                        
                        {slot.daysToExam && slot.daysToExam <= 7 && (
                          <View style={styles.examWarning}>
                            <Ionicons name="warning" size={14} color="#FF6B35" />
                            <Text style={styles.examWarningText}>
                              {slot.examTitle} tra {slot.daysToExam} giorni
                            </Text>
                          </View>
                        )}
                        
                        {slot.isAdapted && (
                          <View style={styles.adaptedIndicator}>
                            <Ionicons name="analytics" size={12} color="#4CAF50" />
                            <Text style={styles.adaptedText}>
                              Adattato ({slot.historicalPerformance} sessioni)
                              {slot.adaptationFactor! > 1 ? ' +tempo' : ' -tempo'}
                            </Text>
                          </View>
                        )}
                        
                        {slot.completed && (
                          <View style={styles.completedOverlay}>
                            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                            <Text style={styles.completedText}>Completata</Text>
                          </View>
                        )}
                        
                        <View style={styles.sessionActionButton}>
                          <Text style={styles.sessionActionText}>
                            {activeSession === slot.id ? '⏹️ Termina' : '▶️ Inizia'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={styles.dayStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={16} color={Colors.gray500} />
                    <Text style={styles.statText}>
                      {Math.floor(selectedDayPlan.totalMinutes / 60)}h {selectedDayPlan.totalMinutes % 60}min
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="book-outline" size={16} color={Colors.gray500} />
                    <Text style={styles.statText}>
                      {selectedDayPlan.slots.length} sessioni
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.trackingButton}
                    onPress={() => openDailyTracking(selectedDayPlan.date)}
                  >
                    <MaterialIcons name="track-changes" size={16} color="white" />
                    <Text style={styles.trackingButtonText}>Traccia Progressi</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyDayContainer}>
                <Ionicons name="calendar-outline" size={60} color={Colors.gray400} />
                <Text style={styles.emptyDayTitle}>Giornata libera</Text>
                <Text style={styles.emptyDayText}>
                  Nessuna sessione di studio programmata per questo giorno
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* Suggerimento */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={24} color={Colors.warning} />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>💡 Suggerimento</Text>
            <Text style={styles.tipText}>
              Scorri tra i giorni per vedere il piano settimanale. Il piano si adatta automaticamente!
            </Text>
          </View>
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
  // Calendario Header
  calendarHeader: {
    backgroundColor: 'white',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 15,
    textTransform: 'capitalize',
  },
  daysScrollContainer: {
    paddingHorizontal: 5,
  },
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    marginHorizontal: 5,
    borderRadius: 15,
    backgroundColor: Colors.gray50,
  },
  selectedDayButton: {
    backgroundColor: Colors.primary,
  },
  todayButton: {
    backgroundColor: Colors.primaryGradient[0] + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray600,
    marginBottom: 4,
  },
  selectedDayText: {
    color: 'white',
  },
  todayText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  dayButtonDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  navButton: {
    backgroundColor: Colors.primary + '20',
    padding: 10,
    borderRadius: 20,
  },
  // Giorno selezionato
  selectedDayContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  dayPlanHeader: {
    marginBottom: 20,
  },
  selectedDayTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    textTransform: 'capitalize',
    marginBottom: 10,
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    padding: 12,
    borderRadius: 8,
  },
  schoolText: {
    marginLeft: 8,
    color: Colors.gray600,
    fontSize: 14,
  },
  // Timeline
  timelineContainer: {
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  timelineTime: {
    width: 60,
    alignItems: 'center',
    paddingTop: 15,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray500,
  },
  timelineDot: {
    width: 30,
    alignItems: 'center',
    paddingTop: 15,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.borderLight,
    marginTop: 8,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    flex: 1,
  },
  cardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 13,
    color: Colors.gray500,
  },
  activeSessionCard: {
    borderWidth: 2,
    borderColor: '#FF6B35',
    backgroundColor: '#FFF8F5',
  },
  activeIndicator: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  examWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  examWarningText: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '600',
    marginLeft: 4,
  },
  adaptedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  adaptedText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 2,
  },
  sessionActionButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sessionActionText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  completedOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Stats del giorno
  dayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 4,
    fontSize: 14,
    color: Colors.gray700,
    fontWeight: '600',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  trackingButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Giornata vuota
  emptyDayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyDayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginTop: 15,
    marginBottom: 8,
  },
  emptyDayText: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray600,
    textAlign: 'center',
    marginBottom: 20,
  },
  requirementsList: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  requirement: {
    fontSize: 14,
    color: Colors.gray700,
    marginBottom: 8,
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
  },
  configButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Suggerimento
  tipCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    margin: 20,
    alignItems: 'flex-start',
  },
  tipContent: {
    flex: 1,
    marginLeft: 15,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 5,
  },
  tipText: {
    fontSize: 14,
    color: Colors.gray600,
    lineHeight: 20,
  },
  todaySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  trackButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 8,
    color: Colors.gray600,
    fontSize: 13,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sessionColor: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  sessionContent: {
    flex: 1,
    marginLeft: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
  },
  studyTypeBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  studyTypeText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '500',
  },
  sessionTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionTimeText: {
    marginLeft: 4,
    fontSize: 13,
    color: Colors.gray500,
  },
  todaySummary: {
    backgroundColor: Colors.primary + '10',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  summaryText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
    marginVertical: 2,
  },
  weekSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
  },
  dayDate: {
    fontSize: 13,
    color: Colors.gray500,
  },
  daySubjects: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  subjectChipText: {
    fontSize: 11,
    color: Colors.gray700,
  },
  moreText: {
    fontSize: 11,
    color: Colors.gray500,
    alignSelf: 'center',
  },
  dayDuration: {
    fontSize: 12,
    color: Colors.gray600,
    fontWeight: '500',
  },
  noSessionsText: {
    fontSize: 13,
    color: Colors.gray400,
    fontStyle: 'italic',
  },
});