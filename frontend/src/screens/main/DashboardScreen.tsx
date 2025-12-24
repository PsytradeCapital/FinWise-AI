import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, SegmentedButtons } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { theme } from '../../theme';
import SpendingSummary from '../../components/SpendingSummary';
import SpendingBreakdown from '../../components/SpendingBreakdown';
import TrendAnalysis from '../../components/TrendAnalysis';

type DashboardView = 'summary' | 'breakdown' | 'trends';

const DashboardScreen: React.FC = () => {
  const [currentView, setCurrentView] = useState<DashboardView>('summary');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedTrendCategories, setSelectedTrendCategories] = useState<string[]>([]);
  
  const { transactions } = useSelector((state: RootState) => state.transactions);

  const handleCategoryPress = (category: string) => {
    setSelectedCategory(category);
    setCurrentView('breakdown');
  };

  const handleBackToSummary = () => {
    setSelectedCategory(undefined);
    setCurrentView('summary');
  };

  const handleTrendCategoryToggle = (category: string) => {
    setSelectedTrendCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'summary':
        return (
          <SpendingSummary
            transactions={transactions}
            onCategoryPress={handleCategoryPress}
          />
        );
      case 'breakdown':
        return (
          <SpendingBreakdown
            transactions={transactions}
            selectedCategory={selectedCategory}
            onBackPress={handleBackToSummary}
          />
        );
      case 'trends':
        return (
          <TrendAnalysis
            transactions={transactions}
            selectedCategories={selectedTrendCategories}
            onCategoryToggle={handleTrendCategoryToggle}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Navigation */}
      <View style={styles.navigation}>
        <SegmentedButtons
          value={currentView}
          onValueChange={(value) => {
            setCurrentView(value as DashboardView);
            if (value !== 'breakdown') {
              setSelectedCategory(undefined);
            }
          }}
          buttons={[
            { value: 'summary', label: 'Summary' },
            { value: 'breakdown', label: 'Details' },
            { value: 'trends', label: 'Trends' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderCurrentView()}
      </View>

      {/* Empty State */}
      {transactions.length === 0 && (
        <View style={styles.emptyState}>
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            Welcome to FinWise AI
          </Text>
          <Text variant="bodyLarge" style={styles.emptyText}>
            Start tracking your expenses to see detailed spending analysis and insights
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  navigation: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: theme.colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
  },
});

export default DashboardScreen;