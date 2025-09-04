import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

const { width } = Dimensions.get('window');
const POMODORO_TIME = 25 * 60; // 25 minuti in secondi
const SHORT_BREAK = 5 * 60; // 5 minuti
const LONG_BREAK = 15 * 60; // 15 minuti

export default function TimerScreen() {
  const [seconds, setSeconds] = useState(POMODORO_TIME);
  const [isActive, setIsActive] = useState(false);
  const [sessionType, setSessionType] = useState<'pomodoro' | 'short_break' | 'long_break'>('pomodoro');
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [treeGrowth, setTreeGrowth] = useState(0); // 0-100
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  
  const appState = useRef(AppState.currentState);
  const treeAnimation = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Gestione background/foreground dell'app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App tornata in primo piano
        if (isActive) {
          // L'utente è tornato, continua normalmente
        }
      } else if (nextAppState.match(/inactive|background/) && isActive) {
        // App andata in background mentre il timer era attivo
        handleTreeDeath();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isActive]);

  // Timer effect
  useEffect(() => {
    if (isActive && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          const newSeconds = s - 1;
          
          // Aggiorna la crescita dell'albero
          if (sessionType === 'pomodoro') {
            const progress = ((POMODORO_TIME - newSeconds) / POMODORO_TIME) * 100;
            setTreeGrowth(progress);
            animateTree(progress);
          }
          
          if (newSeconds === 0) {
            handleSessionComplete();
          }
          
          return newSeconds;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, seconds]);

  // Animazione albero
  const animateTree = (progress: number) => {
    Animated.spring(treeAnimation, {
      toValue: progress / 100,
      useNativeDriver: true,
      tension: 10,
      friction: 5,
    }).start();
  };

  // L'albero muore se esci dall'app
  const handleTreeDeath = async () => {
    setIsActive(false);
    setTreeGrowth(0);
    animateTree(0);
    Alert.alert(
      '☠️ Albero Morto!',
      'Sei uscito dall\'app e il tuo albero è morto. Resta concentrato!',
      [{ text: 'OK' }]
    );

    // Registra l'albero morto nel database
    if (sessionStartTime) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('forest_trees').insert({
          user_id: user.id,
          tree_type: 'oak',
          growth_stage: treeGrowth,
          is_alive: false,
          planted_at: sessionStartTime.toISOString(),
        });
        
        // Aggiorna contatore alberi morti
        await supabase.rpc('increment_trees_killed', { user_id: user.id });
      }
    }

    resetTimer();
  };

  // Sessione completata con successo
  const handleSessionComplete = async () => {
    setIsActive(false);
    
    if (sessionType === 'pomodoro') {
      // Aggiorna contatore pomodori
      const newCount = pomodoroCount + 1;
      setPomodoroCount(newCount);
      
      // Assegna XP
      const xpEarned = 10;
      
      // Salva sessione nel database
      const { data: { user } } = await supabase.auth.getUser();
      if (user && sessionStartTime) {
        // Salva sessione
        const { data: session } = await supabase.from('study_sessions').insert({
          user_id: user.id,
          start_time: sessionStartTime.toISOString(),
          end_time: new Date().toISOString(),
          duration: 25,
          type: 'pomodoro',
          completed: true,
          xp_earned: xpEarned,
          tree_grown: true,
        }).select().single();

        // Salva albero cresciuto
        if (session) {
          await supabase.from('forest_trees').insert({
            user_id: user.id,
            session_id: session.id,
            tree_type: 'oak',
            growth_stage: 100,
            is_alive: true,
            planted_at: sessionStartTime.toISOString(),
            grown_at: new Date().toISOString(),
          });
        }

        // Aggiorna XP e statistiche del profilo
        await supabase.rpc('update_user_stats', {
          user_id: user.id,
          xp_to_add: xpEarned,
          study_time_to_add: 25
        });
      }

      Alert.alert(
        '🎉 Sessione Completata!',
        `Hai guadagnato ${xpEarned} XP! Il tuo albero è cresciuto! 🌳`,
        [
          {
            text: 'Pausa Breve',
            onPress: () => startBreak('short'),
          },
          {
            text: 'Pausa Lunga',
            onPress: () => startBreak('long'),
          },
        ]
      );
    } else {
      // Fine della pausa
      Alert.alert(
        '⏰ Pausa Finita!',
        'Pronto per un\'altra sessione di studio?',
        [
          {
            text: 'Inizia Pomodoro',
            onPress: () => startPomodoro(),
          },
        ]
      );
    }
  };

  const startPomodoro = () => {
    setSessionType('pomodoro');
    setSeconds(POMODORO_TIME);
    setTreeGrowth(0);
    animateTree(0);
  };

  const startBreak = (type: 'short' | 'long') => {
    setSessionType(type === 'short' ? 'short_break' : 'long_break');
    setSeconds(type === 'short' ? SHORT_BREAK : LONG_BREAK);
    setTreeGrowth(0);
    animateTree(0);
  };

  const toggleTimer = () => {
    if (!isActive) {
      setSessionStartTime(new Date());
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setSeconds(POMODORO_TIME);
    setTreeGrowth(0);
    animateTree(0);
    setSessionStartTime(null);
  };

  const formatTime = () => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTreeEmoji = () => {
    if (treeGrowth === 0) return '🌱';
    if (treeGrowth < 25) return '🌿';
    if (treeGrowth < 50) return '🌾';
    if (treeGrowth < 75) return '🌲';
    return '🌳';
  };

  return (
    <LinearGradient colors={[Colors.primaryGradient[0] + '15', Colors.secondaryGradient[0] + '15']} style={styles.container}>
      <View style={styles.content}>
        {/* Tipo di sessione */}
        <View style={styles.sessionTypeContainer}>
          <TouchableOpacity
            style={[styles.sessionTypeButton, sessionType === 'pomodoro' && styles.activeSessionType]}
            onPress={() => !isActive && startPomodoro()}
            disabled={isActive}
          >
            <Text style={[styles.sessionTypeText, sessionType === 'pomodoro' && styles.activeSessionTypeText]}>
              Pomodoro
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sessionTypeButton, sessionType === 'short_break' && styles.activeSessionType]}
            onPress={() => !isActive && startBreak('short')}
            disabled={isActive}
          >
            <Text style={[styles.sessionTypeText, sessionType === 'short_break' && styles.activeSessionTypeText]}>
              Pausa Breve
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sessionTypeButton, sessionType === 'long_break' && styles.activeSessionType]}
            onPress={() => !isActive && startBreak('long')}
            disabled={isActive}
          >
            <Text style={[styles.sessionTypeText, sessionType === 'long_break' && styles.activeSessionTypeText]}>
              Pausa Lunga
            </Text>
          </TouchableOpacity>
        </View>

        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timer}>{formatTime()}</Text>
        </View>

        {/* Albero animato */}
        <View style={styles.treeContainer}>
          <Animated.View
            style={[
              styles.tree,
              {
                transform: [
                  { scale: treeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1.5]
                  })},
                  { rotate: treeAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: ['0deg', '5deg', '0deg']
                  })}
                ],
                opacity: treeAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1]
                })
              }
            ]}
          >
            <Text style={styles.treeEmoji}>{getTreeEmoji()}</Text>
          </Animated.View>
          {sessionType === 'pomodoro' && (
            <Text style={styles.growthText}>Crescita: {Math.floor(treeGrowth)}%</Text>
          )}
        </View>

        {/* Controlli */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.mainButton, isActive && styles.pauseButton]}
            onPress={toggleTimer}
          >
            <LinearGradient
              colors={isActive ? [Colors.error, '#DC2626'] : Colors.primaryGradient}
              style={styles.buttonGradient}
            >
              <Ionicons 
                name={isActive ? 'pause' : 'play'} 
                size={32} 
                color="white" 
              />
              <Text style={styles.buttonText}>
                {isActive ? 'Pausa' : 'Inizia'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {isActive && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetTimer}
            >
              <Ionicons name="refresh" size={24} color={Colors.gray400} />
            </TouchableOpacity>
          )}
        </View>

        {/* Statistiche sessione */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pomodori oggi</Text>
            <Text style={styles.statValue}>{pomodoroCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Obiettivo</Text>
            <Text style={styles.statValue}>8</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sessionTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  sessionTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  activeSessionType: {
    backgroundColor: Colors.primary,
  },
  sessionTypeText: {
    fontSize: 14,
    color: Colors.gray400,
    fontWeight: '600',
  },
  activeSessionTypeText: {
    color: 'white',
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  timer: {
    fontSize: 72,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  treeContainer: {
    alignItems: 'center',
    marginVertical: 30,
    height: 150,
    justifyContent: 'center',
  },
  tree: {
    alignItems: 'center',
  },
  treeEmoji: {
    fontSize: 80,
  },
  growthText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.gray400,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  mainButton: {
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pauseButton: {
    marginRight: 20,
  },
  buttonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  resetButton: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 50,
    elevation: 2,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginTop: 'auto',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: Colors.gray400,
    marginBottom: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
});