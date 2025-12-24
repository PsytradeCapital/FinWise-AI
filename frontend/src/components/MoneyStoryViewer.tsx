import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface MoneyStory {
  id: string;
  userId: string;
  period: 'weekly' | 'monthly';
  title: string;
  narrative: string;
  insights: string[];
  suggestions: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  createdAt: Date;
}

interface StoryListResponse {
  stories: MoneyStory[];
  total: number;
  hasMore: boolean;
}

export const MoneyStoryViewer: React.FC = () => {
  const [stories, setStories] = useState<MoneyStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    if (user?.id) {
      fetchStories();
    }
  }, [user?.id, selectedPeriod]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, this would call the API
      // For now, we'll use mock data
      const mockStories: MoneyStory[] = [
        {
          id: '1',
          userId: user?.id || '',
          period: 'weekly',
          title: 'Your Week of Financial Wins! 🎉',
          narrative: 'Good morning! Let\'s dive into your weekly financial story.\n\n🎉 **Great News!** Great job reducing your Food spending! You\'re trending downward. Keep up the fantastic work!\n\n📊 **Your Spending Breakdown:** Your biggest expense was Transportation, accounting for 35.2% of your spending. Additionally, you averaged KES 450.75 per day across 12 transactions. Understanding these patterns helps you make better financial decisions.\n\nKeep tracking, keep learning, and keep growing your financial confidence!',
          insights: [
            'Great job reducing your Food spending! You\'re trending downward',
            'Your biggest expense was Transportation, accounting for 35.2% of your spending',
            'You averaged KES 450.75 per day across 12 transactions'
          ],
          suggestions: [
            'Keep up the good work with your Food budget management',
            'Consider reviewing your Transportation expenses to find potential savings',
            'Focus on budgeting for your top spending categories: Transportation, Food, Entertainment'
          ],
          sentiment: 'positive',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          id: '2',
          userId: user?.id || '',
          period: 'monthly',
          title: 'Monthly Financial Snapshot 📊',
          narrative: 'Hello there! Here\'s what your money has been up to this month.\n\n🎉 **Great News!** You\'re 67.3% of the way to your "Emergency Fund" goal! Keep up the fantastic work!\n\n📊 **Your Spending Breakdown:** Your biggest expense was Food, accounting for 28.5% of your spending. Additionally, you averaged KES 1,250.30 per day across 45 transactions. Understanding these patterns helps you make better financial decisions.\n\nYour awareness of your spending patterns is the first step to financial success.',
          insights: [
            'Your biggest expense was Food, accounting for 28.5% of your spending',
            'You\'re 67.3% of the way to your "Emergency Fund" goal!',
            'You averaged KES 1,250.30 per day across 45 transactions'
          ],
          suggestions: [
            'You\'re so close! Consider increasing your savings rate to reach your goal faster',
            'Focus on budgeting for your top spending categories: Food, Transportation, Utilities',
            'Take advantage of M-Pesa savings features to automate your financial goals'
          ],
          sentiment: 'positive',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
          id: '3',
          userId: user?.id || '',
          period: 'weekly',
          title: 'Weekly Financial Check-In 🔍',
          narrative: 'Ready for your weekly financial recap? Let\'s see how you did!\n\n⚠️ **Areas for Attention:** Your Entertainment spending has been increasing recently. Consider setting a budget limit for Entertainment to control spending. Small adjustments now can lead to big improvements later!\n\n📊 **Your Spending Breakdown:** Your biggest expense was Food, accounting for 42.1% of your spending. Understanding these patterns helps you make better financial decisions.\n\nSmall, consistent steps lead to big financial wins. You\'ve got this!',
          insights: [
            'Your Entertainment spending has been increasing recently',
            'Your biggest expense was Food, accounting for 42.1% of your spending',
            'You averaged KES 380.50 per day across 8 transactions'
          ],
          suggestions: [
            'Consider setting a budget limit for Entertainment to control spending',
            'Consider reviewing your Food expenses to find potential savings',
            'Focus on budgeting for your top spending categories: Food, Entertainment, Transportation'
          ],
          sentiment: 'negative',
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        }
      ];

      // Filter by period if not 'all'
      let filteredStories = mockStories;
      if (selectedPeriod !== 'all') {
        filteredStories = mockStories.filter(story => story.period === selectedPeriod);
      }

      setStories(filteredStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
      Alert.alert('Error', 'Failed to load money stories');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStories();
    setRefreshing(false);
  };

  const generateNewStory = async () => {
    try {
      Alert.alert(
        'Generate New Story',
        'This will create a new money story based on your recent transactions.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Generate', 
            onPress: () => {
              // In a real implementation, this would call the API to generate a new story
              Alert.alert('Success', 'New money story generated! Pull down to refresh.');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error generating story:', error);
      Alert.alert('Error', 'Failed to generate new story');
    }
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive': return '#4caf50';
      case 'negative': return '#f44336';
      default: return '#2c5aa0';
    }
  };

  const getSentimentIcon = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😐';
      default: return '📊';
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderStory = (story: MoneyStory) => {
    const isExpanded = expandedStory === story.id;
    const sentimentColor = getSentimentColor(story.sentiment);
    const sentimentIcon = getSentimentIcon(story.sentiment);

    return (
      <View key={story.id} style={[styles.storyCard, { borderLeftColor: sentimentColor }]}>
        <TouchableOpacity
          onPress={() => setExpandedStory(isExpanded ? null : story.id)}
          style={styles.storyHeader}
        >
          <View style={styles.storyTitleRow}>
            <Text style={styles.storyIcon}>{sentimentIcon}</Text>
            <Text style={styles.storyTitle}>{story.title}</Text>
          </View>
          <View style={styles.storyMeta}>
            <Text style={styles.storyPeriod}>{story.period.toUpperCase()}</Text>
            <Text style={styles.storyDate}>{formatDate(story.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.storyContent}>
            <Text style={styles.storyNarrative}>{story.narrative}</Text>
            
            {story.insights.length > 0 && (
              <View style={styles.insightsSection}>
                <Text style={styles.sectionTitle}>💡 Key Insights</Text>
                {story.insights.map((insight, index) => (
                  <Text key={index} style={styles.insightItem}>• {insight}</Text>
                ))}
              </View>
            )}

            {story.suggestions.length > 0 && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.sectionTitle}>💪 Suggestions</Text>
                {story.suggestions.map((suggestion, index) => (
                  <Text key={index} style={styles.suggestionItem}>• {suggestion}</Text>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your money stories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📖 Money Stories</Text>
        <Text style={styles.subtitle}>AI-generated insights about your spending</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.filterContainer}>
          {(['all', 'weekly', 'monthly'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.filterButton,
                selectedPeriod === period && styles.activeFilterButton
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedPeriod === period && styles.activeFilterButtonText
              ]}>
                {period === 'all' ? 'All' : period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.generateButton} onPress={generateNewStory}>
          <Text style={styles.generateButtonText}>+ New Story</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.storiesContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📚</Text>
            <Text style={styles.emptyStateTitle}>No Stories Yet</Text>
            <Text style={styles.emptyStateText}>
              Generate your first money story to see AI-powered insights about your spending patterns.
            </Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={generateNewStory}>
              <Text style={styles.emptyStateButtonText}>Generate First Story</Text>
            </TouchableOpacity>
          </View>
        ) : (
          stories.map(renderStory)
        )}
      </ScrollView>
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
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 2,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeFilterButton: {
    backgroundColor: '#2c5aa0',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  generateButton: {
    backgroundColor: '#2c5aa0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  storiesContainer: {
    flex: 1,
    padding: 20,
  },
  storyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
  },
  storyHeader: {
    padding: 16,
  },
  storyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  storyIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  storyTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  storyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storyPeriod: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c5aa0',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  storyDate: {
    fontSize: 12,
    color: '#666',
  },
  storyContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  storyNarrative: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 16,
  },
  insightsSection: {
    marginBottom: 16,
  },
  suggestionsSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c5aa0',
    marginBottom: 8,
  },
  insightItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  suggestionItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  emptyStateButton: {
    backgroundColor: '#2c5aa0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MoneyStoryViewer;