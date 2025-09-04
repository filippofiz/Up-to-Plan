import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';

interface LeaderboardEntry {
  rank: number;
  username: string;
  xp_earned: number;
  study_time: number;
  avatar_url?: string;
}

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [userRank, setUserRank] = useState<number>(0);
  const [userStats, setUserStats] = useState({ xp: 0, time: 0 });

  useEffect(() => {
    loadLeaderboard();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setCurrentUsername(profile.username);
      }
    }
  };

  const loadLeaderboard = async () => {
    // Dati mock per test
    const mockData: LeaderboardEntry[] = [
      { rank: 1, username: 'GiuliaStudia', xp_earned: 450, study_time: 1200 },
      { rank: 2, username: 'MarcoFocus', xp_earned: 380, study_time: 950 },
      { rank: 3, username: 'SofiaPomodoro', xp_earned: 320, study_time: 800 },
      { rank: 4, username: 'LucaConcentrato', xp_earned: 280, study_time: 700 },
      { rank: 5, username: 'ChiaraStudente', xp_earned: 250, study_time: 625 },
      { rank: 6, username: 'DavideLibri', xp_earned: 220, study_time: 550 },
      { rank: 7, username: 'ElenaFocus', xp_earned: 190, study_time: 475 },
      { rank: 8, username: 'AndreaStudio', xp_earned: 150, study_time: 375 },
    ];
    
    setLeaderboard(mockData);
    
    // Simula stats utente corrente
    setUserRank(5);
    setUserStats({ xp: 250, time: 625 });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getRankEmoji = (rank: number) => {
    switch(rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `${rank}°`;
    }
  };

  const getRankColor = (rank: number) => {
    switch(rank) {
      case 1: return '#FFD700';
      case 2: return '#C0C0C0';
      case 3: return '#CD7F32';
      default: return '#8B5CF6';
    }
  };

  return (
    <LinearGradient colors={['#FFF5F7', '#F3E7FF']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header settimanale */}
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>Classifica Settimanale</Text>
          <Text style={styles.weekSubtitle}>
            Settimana {new Date().toLocaleDateString('it-IT', { 
              day: 'numeric',
              month: 'short' 
            })} - {new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT', {
              day: 'numeric',
              month: 'short'
            })}
          </Text>
        </View>

        {/* La tua posizione */}
        {userRank > 0 && (
          <View style={styles.yourPosition}>
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.yourPositionGradient}
            >
              <View style={styles.yourPositionContent}>
                <View style={styles.yourRankBadge}>
                  <Text style={styles.yourRankNumber}>{userRank}°</Text>
                  <Text style={styles.yourRankLabel}>Posizione</Text>
                </View>
                <View style={styles.yourStats}>
                  <Text style={styles.yourName}>La tua settimana</Text>
                  <View style={styles.yourStatsRow}>
                    <View style={styles.yourStatItem}>
                      <Text style={styles.yourStatValue}>{userStats.xp}</Text>
                      <Text style={styles.yourStatLabel}>XP</Text>
                    </View>
                    <View style={styles.yourStatDivider} />
                    <View style={styles.yourStatItem}>
                      <Text style={styles.yourStatValue}>{formatStudyTime(userStats.time)}</Text>
                      <Text style={styles.yourStatLabel}>Studio</Text>
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Top 3 */}
        <View style={styles.podium}>
          {leaderboard.slice(0, 3).map((entry, index) => (
            <View key={entry.username} style={[
              styles.podiumItem,
              index === 0 && styles.podiumFirst,
              index === 1 && styles.podiumSecond,
              index === 2 && styles.podiumThird,
            ]}>
              <View style={[styles.podiumRank, { backgroundColor: getRankColor(entry.rank) }]}>
                <Text style={styles.podiumRankText}>{getRankEmoji(entry.rank)}</Text>
              </View>
              <Text style={styles.podiumName}>{entry.username}</Text>
              <Text style={styles.podiumXp}>{entry.xp_earned} XP</Text>
              <Text style={styles.podiumTime}>{formatStudyTime(entry.study_time)}</Text>
            </View>
          ))}
        </View>

        {/* Resto classifica */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Classifica Completa</Text>
          {leaderboard.slice(3).map((entry) => (
            <View key={entry.username} style={styles.listItem}>
              <View style={styles.listLeft}>
                <Text style={[styles.listRank, { color: getRankColor(entry.rank) }]}>
                  {getRankEmoji(entry.rank)}
                </Text>
                <Text style={styles.listName}>{entry.username}</Text>
              </View>
              <View style={styles.listRight}>
                <View style={styles.listStat}>
                  <Ionicons name="star" size={16} color="#8B5CF6" />
                  <Text style={styles.listStatText}>{entry.xp_earned} XP</Text>
                </View>
                <View style={styles.listStat}>
                  <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                  <Text style={styles.listStatText}>{formatStudyTime(entry.study_time)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Messaggio motivazionale */}
        <View style={styles.motivationCard}>
          <Text style={styles.motivationEmoji}>💪</Text>
          <Text style={styles.motivationText}>
            {userRank <= 3 && "Ottimo lavoro! Sei nel podio!"}
            {userRank > 3 && userRank <= 10 && "Continua così! Sei nella top 10!"}
            {userRank > 10 && "Studia di più per scalare la classifica!"}
          </Text>
        </View>
      </ScrollView>
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
  weekHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  weekTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  weekSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 5,
  },
  yourPosition: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  yourPositionGradient: {
    padding: 20,
  },
  yourPositionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yourRankBadge: {
    alignItems: 'center',
    marginRight: 20,
  },
  yourRankNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  yourRankLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  yourStats: {
    flex: 1,
  },
  yourName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  yourStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yourStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  yourStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  yourStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  yourStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 10,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginBottom: 30,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 5,
  },
  podiumFirst: {
    transform: [{ scale: 1.1 }],
  },
  podiumSecond: {
    transform: [{ scale: 1.05 }],
  },
  podiumThird: {
    transform: [{ scale: 1 }],
  },
  podiumRank: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  podiumRankText: {
    fontSize: 28,
  },
  podiumName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 5,
  },
  podiumXp: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  podiumTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  listSection: {
    marginHorizontal: 20,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 15,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listRank: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 15,
    width: 30,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  listRight: {
    alignItems: 'flex-end',
  },
  listStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  listStatText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 5,
  },
  motivationCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  motivationEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  motivationText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
    textAlign: 'center',
  },
});