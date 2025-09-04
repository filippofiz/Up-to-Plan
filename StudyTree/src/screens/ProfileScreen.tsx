import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { Colors } from '../constants/colors';

interface ProfileData {
  username: string;
  xp: number;
  level: number;
  total_study_time: number;
  trees_grown: number;
  trees_killed: number;
}

export default function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('Profile error:', error);
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.log('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const getNextLevelXp = () => {
    if (!profile) return 100;
    return profile.level * 100;
  };

  const getCurrentLevelProgress = () => {
    if (!profile) return 0;
    const currentLevelXp = profile.xp - ((profile.level - 1) * 100);
    return (currentLevelXp / 100) * 100;
  };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Caricamento...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <LinearGradient colors={[Colors.primaryGradient[0] + '15', Colors.secondaryGradient[0] + '15']} style={styles.container}>
        <View style={styles.scrollContent}>
          <Text style={styles.errorText}>Profilo non trovato</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={Colors.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[Colors.primaryGradient[0] + '15', Colors.secondaryGradient[0] + '15']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Profilo */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={Colors.primaryGradient as any}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Livello {profile.level}</Text>
          </View>
        </View>

        {/* Progress Bar XP */}
        <View style={styles.xpContainer}>
          <View style={styles.xpHeader}>
            <Text style={styles.xpLabel}>Esperienza</Text>
            <Text style={styles.xpValue}>{profile.xp} XP</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={Colors.primaryGradient as any}
              style={[styles.progressFill, { width: `${getCurrentLevelProgress()}%` }]}
            />
          </View>
          <Text style={styles.xpSubtext}>
            {Math.floor(getCurrentLevelProgress())}% per il livello {profile.level + 1}
          </Text>
        </View>

        {/* Statistiche */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={24} color={Colors.primary} />
            <Text style={styles.statValue}>{formatStudyTime(profile.total_study_time)}</Text>
            <Text style={styles.statLabel}>Tempo Totale</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🌳</Text>
            <Text style={styles.statValue}>{profile.trees_grown}</Text>
            <Text style={styles.statLabel}>Alberi Cresciuti</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>☠️</Text>
            <Text style={styles.statValue}>{profile.trees_killed}</Text>
            <Text style={styles.statLabel}>Alberi Morti</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame-outline" size={24} color={Colors.error} />
            <Text style={styles.statValue}>
              {profile.trees_grown > 0 
                ? Math.round((profile.trees_grown / (profile.trees_grown + profile.trees_killed)) * 100)
                : 0}%
            </Text>
            <Text style={styles.statLabel}>Tasso Successo</Text>
          </View>
        </View>

        {/* Achievements Preview */}
        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>🏆 Prossimi Obiettivi</Text>
          <View style={styles.achievementsList}>
            <View style={styles.achievementItem}>
              <View style={styles.achievementIcon}>
                <Text>🌱</Text>
              </View>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementName}>Prima Settimana</Text>
                <Text style={styles.achievementDesc}>Studia per 7 giorni consecutivi</Text>
              </View>
            </View>
            <View style={styles.achievementItem}>
              <View style={styles.achievementIcon}>
                <Text>🎯</Text>
              </View>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementName}>Concentrato</Text>
                <Text style={styles.achievementDesc}>Completa 10 pomodori in un giorno</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    color: 'white',
    fontWeight: 'bold',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 10,
  },
  levelBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  levelText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  xpContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  xpLabel: {
    fontSize: 16,
    color: Colors.gray400,
  },
  xpValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  progressBar: {
    height: 10,
    backgroundColor: Colors.primaryGradient[0] + '20',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  xpSubtext: {
    fontSize: 12,
    color: Colors.gray400,
    marginTop: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    width: '48%',
    marginBottom: 10,
  },
  statEmoji: {
    fontSize: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray400,
  },
  achievementsSection: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 15,
  },
  achievementsList: {
    gap: 15,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryGradient[0] + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray700,
  },
  achievementDesc: {
    fontSize: 12,
    color: Colors.gray400,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
  },
  logoutText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  errorText: {
    fontSize: 18,
    color: Colors.gray700,
    textAlign: 'center',
    marginBottom: 20,
  },
});