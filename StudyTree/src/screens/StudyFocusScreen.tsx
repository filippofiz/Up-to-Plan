import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Colors } from '../constants/colors';
import { supabase } from '../config/supabase';

interface StudyFocusProps {
  route?: {
    params?: {
      slot: any;
      onComplete: (actualDuration: number, completed: boolean) => void;
      onEvaluate: (actualDuration: number) => void;
    };
  };
  navigation?: any;
}

const { width, height } = Dimensions.get('window');

export default function StudyFocusScreen({ route, navigation }: StudyFocusProps) {
  const { slot, onComplete, onEvaluate } = route?.params || {};
  
  const [timeLeft, setTimeLeft] = useState((slot?.duration_minutes || 25) * 60); // in secondi
  const [initialTime] = useState((slot?.duration_minutes || 25) * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sessionPhase, setSessionPhase] = useState<'focus' | 'break'>('focus');
  const [cycleCount, setCycleCount] = useState(0);
  const [actualStartTime] = useState(Date.now());
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressAnimation = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    StatusBar.setHidden(true);
    
    startTimer();
    startPulseAnimation();
    
    return () => {
      StatusBar.setHidden(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const progress = timeLeft / initialTime;
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [timeLeft, initialTime]);

  const startTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          handleTimerComplete();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleTimerComplete = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Suona notifica
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/notification.mp3') // Aggiungi un suono di notifica
      );
      await sound.playAsync();
    } catch (error) {
      // Fallback se non c'è il suono
      console.log('Sound not available');
    }
    
    if (sessionPhase === 'focus') {
      const nextBreakMinutes = Math.floor(getOptimalBreakTime() / 60);
      const breakType = nextBreakMinutes >= 20 ? 'Lunga' : nextBreakMinutes >= 10 ? 'Media' : 'Breve';
      
      Alert.alert(
        '🎉 Sessione Completata!',
        `Hai studiato ${slot?.subject_name || 'la materia'} per ${formatTime(initialTime - timeLeft)}!`,
        [
          {
            text: '📚 Continua',
            onPress: () => extendSession()
          },
          {
            text: `🍃 Pausa ${breakType} ${nextBreakMinutes}min`,
            onPress: () => startBreak()
          },
          {
            text: '✅ Termina',
            onPress: () => completeSession(true)
          },
          {
            text: '📸 Valuta',
            onPress: () => {
              const actualDuration = Math.floor((Date.now() - actualStartTime) / (1000 * 60));
              startAIEvaluation(actualDuration);
            }
          }
        ]
      );
    } else {
      // Fine pausa
      Alert.alert('⏰ Pausa Terminata', 'Pronto per continuare?', [
        { text: 'Continua Studio', onPress: () => continueStudy() },
        { text: 'Termina', onPress: () => completeSession(true) }
      ]);
    }
  };

  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPaused(true);
    setIsActive(false);
  };

  const resumeTimer = () => {
    startTimer();
    setIsPaused(false);
    setIsActive(true);
  };

  const extendSession = () => {
    const extensionTime = 15 * 60; // 15 minuti
    setTimeLeft(extensionTime);
    setIsActive(true);
    startTimer();
  };

  const getOptimalBreakTime = () => {
    // Basato su studi scientifici sulla concentrazione
    const currentCycle = cycleCount + 1;
    
    if (currentCycle % 4 === 0) {
      // Ogni 4 cicli: pausa lunga (15-30 minuti)
      return 20 * 60; // 20 minuti
    } else if (currentCycle % 2 === 0) {
      // Ogni 2 cicli: pausa media (10 minuti)  
      return 10 * 60; // 10 minuti
    } else {
      // Pausa breve (5 minuti)
      return 5 * 60; // 5 minuti
    }
  };

  const getOptimalStudyTime = () => {
    // Tempo di studio ottimale basato su ricerche cognitive
    const currentCycle = cycleCount + 1;
    
    if (currentCycle <= 2) {
      // Prime 2 sessioni: concentrazione massima
      return 25 * 60; // 25 minuti
    } else if (currentCycle <= 4) {
      // Sessioni 3-4: leggera riduzione
      return 20 * 60; // 20 minuti  
    } else {
      // Sessioni successive: tempo ridotto per mantenere qualità
      return 15 * 60; // 15 minuti
    }
  };

  const startBreak = () => {
    setSessionPhase('break');
    const breakTime = getOptimalBreakTime();
    setTimeLeft(breakTime);
    setCycleCount(prev => prev + 1);
    setIsActive(true);
    startTimer();
    
    // Mostra il tipo di pausa
    const breakType = breakTime >= 20 * 60 ? 'lunga' : breakTime >= 10 * 60 ? 'media' : 'breve';
    Alert.alert(
      `🍃 Pausa ${breakType.charAt(0).toUpperCase() + breakType.slice(1)}`,
      `Rilassati per ${Math.floor(breakTime / 60)} minuti. Il tuo cervello si sta ricaricando!`,
      [{ text: 'OK' }]
    );
  };

  const continueStudy = () => {
    setSessionPhase('focus');
    const studyTime = getOptimalStudyTime();
    setTimeLeft(studyTime);
    setIsActive(true);
    startTimer();
    
    Alert.alert(
      '🚀 Nuova Sessione',
      `Sessione ottimizzata: ${Math.floor(studyTime / 60)} minuti. La qualità è più importante della quantità!`,
      [{ text: 'Iniziamo!' }]
    );
  };

  const completeSession = (completed: boolean) => {
    const actualDuration = Math.floor((Date.now() - actualStartTime) / (1000 * 60));
    onComplete?.(actualDuration, completed);
    
    if (completed) {
      // Se completato, avvia automaticamente la valutazione AI
      startAIEvaluation(actualDuration);
    } else {
      navigation?.goBack();
    }
  };

  const startAIEvaluation = (actualDuration: number) => {
    // Naviga alla schermata di valutazione AI
    navigation?.navigate('StudyEvaluation', {
      slot: slot,
      actualDuration: actualDuration,
      onComplete: () => navigation?.goBack()
    });
  };

  const skipSession = async () => {
    // Salta = non studio oggi questa materia
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Aggiorna il piano: marca come saltato
    await markSessionAsSkipped();
    navigation?.goBack();
  };

  const markSessionAsSkipped = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !slot) return;

      // Marca la sessione come saltata nel tracking giornaliero
      await supabase
        .from('daily_study_tracking')
        .insert({
          user_id: user.id,
          subject_id: slot.subject_id,
          subject_name: slot.subject_name,
          date: new Date().toISOString().split('T')[0],
          planned_minutes: slot.duration_minutes || 25,
          actual_minutes: 0,
          completed: false,
          skipped: true,
          notes: 'Sessione saltata'
        });
    } catch (error) {
      console.error('Errore nel marcare sessione come saltata:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressColor = () => {
    if (sessionPhase === 'break') return '#4ECDC4';
    const progress = timeLeft / initialTime;
    if (progress > 0.5) return Colors.success;
    if (progress > 0.2) return Colors.warning;
    return Colors.error;
  };

  const getBackgroundGradient = () => {
    if (sessionPhase === 'break') {
      return ['#E8F8F5', '#D5F7F0']; // Verde relaxante per pausa
    }
    return [Colors.primary + '10', Colors.secondary + '05']; // Focus
  };

  const getMotivationMessage = () => {
    const progress = 1 - (timeLeft / initialTime);
    if (sessionPhase === 'break') return 'Rilassati e ricaricati 🍃';
    if (progress < 0.25) return 'Iniziamo con energia! 🚀';
    if (progress < 0.5) return 'Ottimo ritmo, continua così! 💪';
    if (progress < 0.75) return 'Più di metà fatto! 🔥';
    return 'Quasi finito, non mollare! ⭐';
  };

  return (
    <LinearGradient colors={getBackgroundGradient() as any} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={Colors.gray600} />
        </TouchableOpacity>
        <Text style={styles.subjectName}>{slot?.subject_name || 'Studio'}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.cycleCounter}>Ciclo {cycleCount + 1}</Text>
        </View>
      </View>

      <View style={styles.timerContainer}>
        {/* Cerchio del progresso */}
        <View style={styles.progressCircleContainer}>
          <Animated.View
            style={[
              styles.progressCircle,
              {
                transform: [{ scale: pulseAnimation }],
              }
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: getProgressColor(),
                  transform: [
                    {
                      rotate: progressAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={styles.timerCenter}>
              <Text style={styles.timeDisplay}>{formatTime(timeLeft)}</Text>
              <Text style={styles.phaseLabel}>
                {sessionPhase === 'focus' ? '📚 STUDIO' : '☕ PAUSA'}
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Messaggio motivazionale */}
        <Text style={styles.motivationText}>{getMotivationMessage()}</Text>
        
        {/* Info sessione */}
        <View style={styles.sessionInfo}>
          <View style={styles.infoItem}>
            <Ionicons name="book-outline" size={16} color={Colors.gray600} />
            <Text style={styles.infoText}>{slot?.study_type || 'studio'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color={Colors.gray600} />
            <Text style={styles.infoText}>Target: {slot?.duration_minutes || 25}min</Text>
          </View>
          {sessionPhase === 'focus' && (
            <View style={styles.infoItem}>
              <Ionicons name="cafe-outline" size={16} color={Colors.success} />
              <Text style={[styles.infoText, { color: Colors.success }]}>
                Prossima pausa: {formatTime(timeLeft)} ☕
              </Text>
            </View>
          )}
          {slot?.daysToExam && slot.daysToExam <= 7 && (
            <View style={styles.infoItem}>
              <Ionicons name="warning-outline" size={16} color={Colors.warning} />
              <Text style={[styles.infoText, { color: Colors.warning }]}>
                Esame tra {slot.daysToExam} giorni
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Controlli */}
      <View style={styles.controls}>
        {isActive ? (
          <TouchableOpacity style={styles.pauseButton} onPress={pauseTimer}>
            <Ionicons name="pause" size={30} color="white" />
            <Text style={styles.controlText}>Pausa</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.playButton} onPress={resumeTimer}>
            <Ionicons name="play" size={30} color="white" />
            <Text style={styles.controlText}>Riprendi</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.skipButton} onPress={skipSession}>
          <Ionicons name="play-skip-forward" size={24} color={Colors.warning} />
          <Text style={[styles.skipText, { color: Colors.warning }]}>Salta</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.stopButton, { backgroundColor: Colors.success }]} 
          onPress={() => Alert.alert(
            'Hai Finito di Studiare?',
            'Questo avvierà la valutazione AI della tua sessione',
            [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Sì, Valuta!', onPress: () => completeSession(true) }
            ]
          )}
        >
          <Ionicons name="checkmark-circle" size={24} color="white" />
          <Text style={[styles.controlText, { color: 'white' }]}>Finito</Text>
        </TouchableOpacity>
      </View>

      {/* Tips di concentrazione */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>💡 Controlli e Tips:</Text>
        <Text style={styles.tipText}>• <Text style={{fontWeight: 'bold'}}>Pausa:</Text> Ferma/riprendi il timer</Text>
        <Text style={styles.tipText}>• <Text style={{fontWeight: 'bold'}}>Salta:</Text> Non studio oggi questa materia</Text>
        <Text style={styles.tipText}>• <Text style={{fontWeight: 'bold'}}>Finito:</Text> Avvia valutazione AI</Text>
        <Text style={[styles.tipText, {fontStyle: 'italic', color: Colors.primary}]}>
          🧠 Pause ottimizzate: 5min → 10min → 5min → 20min
        </Text>
        {sessionPhase === 'focus' && (
          <Text style={[styles.tipText, {color: Colors.success, fontWeight: '600'}]}>
            🎯 Concentrati! La pausa si avvicina...
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  backButton: {
    padding: 5,
  },
  subjectName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  cycleCounter: {
    fontSize: 12,
    color: Colors.gray600,
    fontWeight: '600',
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  progressCircleContainer: {
    marginBottom: 40,
  },
  progressCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
  },
  progressFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 140,
    opacity: 0.1,
  },
  timerCenter: {
    alignItems: 'center',
  },
  timeDisplay: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.secondary,
    fontFamily: 'monospace',
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray600,
    marginTop: 5,
  },
  motivationText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 30,
  },
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  infoText: {
    fontSize: 12,
    color: Colors.gray700,
    marginLeft: 4,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 30,
  },
  pauseButton: {
    backgroundColor: Colors.warning,
    borderRadius: 35,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  playButton: {
    backgroundColor: Colors.success,
    borderRadius: 35,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  skipButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  stopButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  controlText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    marginTop: 2,
  },
  skipText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.gray600,
    marginTop: 2,
  },
  tipsContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    color: Colors.gray600,
    marginBottom: 4,
  },
});