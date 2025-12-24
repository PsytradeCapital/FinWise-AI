import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface Milestone {
  id: string;
  userId: string;
  goalId?: string;
  type: 'savings_goal' | 'spending_reduction' | 'budget_streak' | 'category_optimization' | 'savings_streak';
  title: string;
  description: string;
  achievedAt: Date;
  value: number;
  unit: string;
  celebrationLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
  isNotified: boolean;
}

interface MilestoneProgress {
  goalId: string;
  currentProgress: number;
  targetAmount: number;
  progressPercentage: number;
  nextMilestone: number;
  estimatedCompletion: Date;
  milestoneHistory: Milestone[];
}

interface MilestoneStatistics {
  totalMilestones: number;
  milestonesByType: Record<string, number>;
  recentMilestones: Milestone[];
  celebrationLevel: Record<string, number>;
}

export const MilestoneTracker: React.FC = () => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [statistics, setStatistics] = useState<MilestoneStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'recent' | 'all' | 'stats'>('recent');

  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    if (user?.id) {
      fetchMilestones();
      fetchStatistics();
    }
  }, [user?.id]);

  const fetchMilestones = async () => {
    try {
      // In a real implementation, this would call the API
      // For now, we'll use mock data
      const mockMilestones: Milestone[] = [
        {
          id: '1',
          userId: user?.id || '',
          goalId: 'goal1',
          type: 'savings_goal',
          title: '25% Progress',
          description: 'Great progress! You\'ve reached 25% of your "Emergency Fund" savings goal.',
          achievedAt: new Date('2024-01-15'),
          value: 25,
          unit: '%',
          celebrationLevel: 'bronze',
          isNotified: true
        },
        {
          id: '2',
          userId: user?.id || '',
          type: 'spending_reduction',
          title: 'Food Spending Reduced!',
          description: 'Excellent! You\'ve reduced your Food spending by 22.5%, saving 4500.00 this month.',
          achievedAt: new Date('2024-01-10'),
          value: 22.5,
          unit: '%',
          celebrationLevel: 'silver',
          isNotified: true
        },
        {
          id: '3',
          userId: user?.id || '',
          type: 'budget_streak',
          title: '7-Day Budget Streak!',
          description: 'Fantastic! You\'ve stayed within budget for 7 consecutive days. Keep up the great work!',
          achievedAt: new Date('2024-01-08'),
          value: 7,
          unit: 'days',
          celebrationLevel: 'bronze',
          isNotified: true
        }
      ];

      setMilestones(mockMilestones);
    } catch (error) {
      console.error('Error fetching milestones:', error);
      Alert.alert('Error', 'Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      // Mock statistics data
      const mockStats: MilestoneStatistics = {
        totalMilestones: 3,
        milestonesByType: {
          'savings_goal': 1,
          'spending_reduction': 1,
          'budget_streak': 1
        },
        recentMilestones: milestones.slice(0, 3),
        celebrationLevel: {
          'bronze': 2,
          'silver': 1,
          'gold': 0,
          'platinum': 0
        }
      };

      setStatistics(mockStats);
    } catch (error) {
      console.error('Error fetching milestone statistics:', error);
    }
  };

  const getCelebrationIcon = (level: string): string => {
    switch (level) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
      case 'platinum': return '💎';
      default: return '🏆';
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'savings_goal': return '💰';
      case 'spending_reduction': return '📉';
      case 'budget_streak': return '🔥';
      case 'category_optimization': return '✨';
      case 'savings_streak': return '💪';
      default: return '🎯';
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderMilestone = (milestone: Milestone) => (
    <View key={milestone.id} style={[styles.milestoneCard, styles[`${milestone.celebrationLevel}Card`]]}>
      <View style={styles.milestoneHeader}>
        <View style={styles.milestoneIcons}>
          <Text style={styles.typeIcon}>{getTypeIcon(milestone.type)}</Text>
          <Text style={styles.celebrationIcon}>{getCelebrationIcon(milestone.celebrationLevel)}</Text>
        </View>
        <Text style={styles.milestoneDate}>{formatDate(milestone.achievedAt)}</Text>
      </View>
      
      <Text style={styles.milestoneTitle}>{milestone.title}</Text>
      <Text style={styles.milestoneDescription}>{milestone.description}</Text>
      
      <View style={styles.milestoneFooter}>
        <Text style={styles.milestoneValue}>
          {milestone.value} {milestone.unit}
        </Text>
        <Text style={styles.celebrationLevel}>
          {milestone.celebrationLevel.toUpperCase()}
        </Text>
      </View>
    </View>
  );

  const renderStatistics = () => {
    if (!statistics) return null;

    return (
      <ScrollView style={styles.statisticsContainer}>
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Milestone Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{statistics.totalMilestones}</Text>
              <Text style={styles.statLabel}>Total Milestones</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{statistics.celebrationLevel.gold + statistics.celebrationLevel.platinum}</Text>
              <Text style={styles.statLabel}>Gold+ Achievements</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>By Type</Text>
          {Object.entries(statistics.milestonesByType).map(([type, count]) => (
            <View key={type} style={styles.typeRow}>
              <Text style={styles.typeIcon}>{getTypeIcon(type)}</Text>
              <Text style={styles.typeName}>{type.replace('_', ' ').toUpperCase()}</Text>
              <Text style={styles.typeCount}>{count}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>By Level</Text>
          {Object.entries(statistics.celebrationLevel).map(([level, count]) => (
            <View key={level} style={styles.levelRow}>
              <Text style={styles.celebrationIcon}>{getCelebrationIcon(level)}</Text>
              <Text style={styles.levelName}>{level.toUpperCase()}</Text>
              <Text style={styles.levelCount}>{count}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'recent':
        return (
          <ScrollView style={styles.milestonesContainer}>
            {milestones.slice(0, 5).map(renderMilestone)}
          </ScrollView>
        );
      case 'all':
        return (
          <ScrollView style={styles.milestonesContainer}>
            {milestones.map(renderMilestone)}
          </ScrollView>
        );
      case 'stats':
        return renderStatistics();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading milestones...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Milestones</Text>
        <Text style={styles.subtitle}>Celebrate your financial achievements</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'recent' && styles.activeTab]}
          onPress={() => setSelectedTab('recent')}
        >
          <Text style={[styles.tabText, selectedTab === 'recent' && styles.activeTabText]}>
            Recent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
          onPress={() => setSelectedTab('all')}
        >
          <Text style={[styles.tabText, selectedTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'stats' && styles.activeTab]}
          onPress={() => setSelectedTab('stats')}
        >
          <Text style={[styles.tabText, selectedTab === 'stats' && styles.activeTabText]}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>

      {renderTabContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c5aa0',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2c5aa0',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2c5aa0',
    fontWeight: 'bold',
  },
  milestonesContainer: {
    flex: 1,
    padding: 20,
  },
  milestoneCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
  },
  bronzeCard: {
    borderLeftColor: '#cd7f32',
  },
  silverCard: {
    borderLeftColor: '#c0c0c0',
  },
  goldCard: {
    borderLeftColor: '#ffd700',
  },
  platinumCard: {
    borderLeftColor: '#e5e4e2',
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  milestoneIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  celebrationIcon: {
    fontSize: 18,
  },
  milestoneDate: {
    fontSize: 12,
    color: '#666',
  },
  milestoneTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  milestoneDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  milestoneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5aa0',
  },
  celebrationLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statisticsContainer: {
    flex: 1,
    padding: 20,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c5aa0',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  typeName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  typeCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5aa0',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  levelName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  levelCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5aa0',
  },
});

export default MilestoneTracker;