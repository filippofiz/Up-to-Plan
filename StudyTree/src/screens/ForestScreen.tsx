import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';

interface TreeData {
  id: string;
  tree_type: string;
  growth_stage: number;
  is_alive: boolean;
  planted_at: string;
  grown_at: string | null;
}

export default function ForestScreen() {
  const [trees, setTrees] = useState<TreeData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalTrees: 0,
    aliveTrees: 0,
    deadTrees: 0,
  });

  useEffect(() => {
    loadForest();
  }, []);

  const loadForest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('forest_trees')
      .select('*')
      .eq('user_id', user.id)
      .order('planted_at', { ascending: false });

    if (data) {
      setTrees(data);
      setStats({
        totalTrees: data.length,
        aliveTrees: data.filter(t => t.is_alive).length,
        deadTrees: data.filter(t => !t.is_alive).length,
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadForest();
    setRefreshing(false);
  };

  const getTreeEmoji = (tree: TreeData) => {
    if (!tree.is_alive) return '☠️';
    if (tree.growth_stage === 100) return '🌳';
    if (tree.growth_stage >= 75) return '🌲';
    if (tree.growth_stage >= 50) return '🌾';
    if (tree.growth_stage >= 25) return '🌿';
    return '🌱';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <LinearGradient colors={['#FFF5F7', '#F3E7FF']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Statistiche */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalTrees}</Text>
            <Text style={styles.statLabel}>Totali</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>
              {stats.aliveTrees}
            </Text>
            <Text style={styles.statLabel}>Cresciuti</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>
              {stats.deadTrees}
            </Text>
            <Text style={styles.statLabel}>Morti</Text>
          </View>
        </View>

        {/* Foresta */}
        <Text style={styles.sectionTitle}>La Tua Foresta</Text>
        <View style={styles.forest}>
          {trees.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyText}>
                La tua foresta è vuota!{'\n'}
                Inizia una sessione di studio per piantare il primo albero
              </Text>
            </View>
          ) : (
            <View style={styles.treesGrid}>
              {trees.slice(0, 50).map((tree) => (
                <View key={tree.id} style={styles.treeItem}>
                  <Text style={styles.treeEmoji}>{getTreeEmoji(tree)}</Text>
                  <Text style={styles.treeDate}>{formatDate(tree.planted_at)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Messaggio motivazionale */}
        {stats.aliveTrees > 0 && (
          <View style={styles.motivationCard}>
            <Text style={styles.motivationText}>
              {stats.aliveTrees < 10 && "🌱 Ottimo inizio! Continua così!"}
              {stats.aliveTrees >= 10 && stats.aliveTrees < 50 && "🌿 La tua foresta sta crescendo bene!"}
              {stats.aliveTrees >= 50 && stats.aliveTrees < 100 && "🌲 Wow! Sei un vero studente dedicato!"}
              {stats.aliveTrees >= 100 && "🌳 Incredibile! Hai una foresta magnifica!"}
            </Text>
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
  scrollContent: {
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  statLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 20,
  },
  forest: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  treesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  treeItem: {
    alignItems: 'center',
    margin: 10,
  },
  treeEmoji: {
    fontSize: 40,
  },
  treeDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  motivationCard: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
  },
  motivationText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});