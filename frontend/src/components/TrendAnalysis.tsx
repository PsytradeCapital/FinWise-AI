import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Text, Card, SegmentedButtons, Chip } from 'react-native-paper';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Transaction } from '@shared/types';
import { theme } from '../theme';
import { 
  format, 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  endOfDay, 
  endOfWeek, 
  endOfMonth,
  subDays, 
  subWeeks, 
  subMonths,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths
} from 'date-fns';

interface TrendAnalysisProps {
  transactions: Transaction[];
  selectedCategories?: string[];
  onCategoryToggle?: (category: string) => void;
}

type TimePeriod = 'daily' | 'weekly' | 'monthly';
type ChartType = 'line' | 'bar';

interface TrendPoint {
  period: string;
  amount: number;
  date: Date;
  transactionCount: number;
}

interface CategoryTrend {
  category: string;
  data: TrendPoint[];
  color: string;
  totalAmount: number;
  averageAmount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
}

const screenWidth = Dimensions.get('window').width;

const CATEGORY_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

const TrendAnalysis: React.FC<TrendAnalysisProps> = ({
  transactions,
  selectedCategories = [],
  onCategoryToggle,
}) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('weekly');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Get all unique categories
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach(transaction => {
      if (transaction.amount > 0) { // Only spending transactions
        categories.add(transaction.category || 'Uncategorized');
      }
    });
    return Array.from(categories).sort();
  }, [transactions]);

  // Calculate trend data for each category
  const categoryTrends = useMemo(() => {
    const trends: CategoryTrend[] = [];
    const periodsToShow = 12; // Show last 12 periods
    
    const categoriesToAnalyze = showAllCategories 
      ? allCategories 
      : selectedCategories.length > 0 
        ? selectedCategories 
        : allCategories.slice(0, 5); // Top 5 categories by default

    categoriesToAnalyze.forEach((category, index) => {
      const categoryTransactions = transactions.filter(
        t => (t.category || 'Uncategorized') === category && t.amount > 0
      );

      const trendData: TrendPoint[] = [];
      const now = new Date();

      for (let i = periodsToShow - 1; i >= 0; i--) {
        let periodStart: Date;
        let periodEnd: Date;
        let label: string;

        switch (timePeriod) {
          case 'daily':
            periodStart = startOfDay(subDays(now, i));
            periodEnd = endOfDay(subDays(now, i));
            label = format(periodStart, 'MMM dd');
            break;
          case 'weekly':
            periodStart = startOfWeek(subWeeks(now, i));
            periodEnd = endOfWeek(subWeeks(now, i));
            label = format(periodStart, 'MMM dd');
            break;
          case 'monthly':
            periodStart = startOfMonth(subMonths(now, i));
            periodEnd = endOfMonth(subMonths(now, i));
            label = format(periodStart, 'MMM yyyy');
            break;
        }

        const periodTransactions = categoryTransactions.filter(transaction => {
          const transactionDate = new Date(transaction.timestamp);
          return transactionDate >= periodStart && transactionDate <= periodEnd;
        });

        const totalAmount = periodTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        trendData.push({
          period: label,
          amount: totalAmount,
          date: periodStart,
          transactionCount: periodTransactions.length,
        });
      }

      // Calculate trend direction and percentage
      const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
      const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, point) => sum + point.amount, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, point) => sum + point.amount, 0) / secondHalf.length;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let trendPercentage = 0;
      
      if (firstHalfAvg > 0) {
        trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        if (Math.abs(trendPercentage) > 5) { // 5% threshold for significant change
          trend = trendPercentage > 0 ? 'increasing' : 'decreasing';
        }
      }

      const totalAmount = trendData.reduce((sum, point) => sum + point.amount, 0);
      const averageAmount = totalAmount / trendData.length;

      trends.push({
        category,
        data: trendData,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        totalAmount,
        averageAmount,
        trend,
        trendPercentage,
      });
    });

    return trends.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions, timePeriod, selectedCategories, showAllCategories, allCategories]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (categoryTrends.length === 0) return null;

    const labels = categoryTrends[0].data.map(point => point.period);
    const datasets = categoryTrends.map(trend => ({
      data: trend.data.map(point => point.amount),
      color: (opacity = 1) => trend.color.replace(')', `, ${opacity})`).replace('rgb', 'rgba'),
      strokeWidth: 2,
    }));

    return { labels, datasets };
  }, [categoryTrends]);

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(69, 183, 209, ${opacity})`,
    labelColor: (opacity = 1) => theme.colors.onSurface,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
    },
  };

  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing': return '↗️';
      case 'decreasing': return '↘️';
      case 'stable': return '➡️';
    }
  };

  const getTrendColor = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing': return '#FF6B6B';
      case 'decreasing': return '#4ECDC4';
      case 'stable': return theme.colors.onSurfaceVariant;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Controls */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Spending Trends
          </Text>
          
          {/* Time Period Selector */}
          <SegmentedButtons
            value={timePeriod}
            onValueChange={(value) => setTimePeriod(value as TimePeriod)}
            buttons={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            style={styles.segmentedButtons}
          />

          {/* Chart Type Selector */}
          <SegmentedButtons
            value={chartType}
            onValueChange={(value) => setChartType(value as ChartType)}
            buttons={[
              { value: 'line', label: 'Line Chart' },
              { value: 'bar', label: 'Bar Chart' },
            ]}
            style={styles.segmentedButtons}
          />
        </Card.Content>
      </Card>

      {/* Category Selection */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Categories to Analyze
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoryChips}>
              <Chip
                selected={showAllCategories}
                onPress={() => setShowAllCategories(!showAllCategories)}
                style={styles.categoryChip}
              >
                All Categories
              </Chip>
              {allCategories.map(category => (
                <Chip
                  key={category}
                  selected={selectedCategories.includes(category)}
                  onPress={() => onCategoryToggle?.(category)}
                  style={styles.categoryChip}
                >
                  {category}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Chart */}
      {chartData && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} Spending Trends
            </Text>
            <View style={styles.chartContainer}>
              {chartType === 'line' ? (
                <LineChart
                  data={chartData}
                  width={screenWidth - 60}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                />
              ) : (
                <BarChart
                  data={chartData}
                  width={screenWidth - 60}
                  height={220}
                  chartConfig={chartConfig}
                  style={styles.chart}
                />
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Trend Summary */}
      {categoryTrends.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Trend Analysis
            </Text>
            {categoryTrends.map(trend => (
              <View key={trend.category} style={styles.trendItem}>
                <View style={styles.trendHeader}>
                  <View style={styles.trendInfo}>
                    <View 
                      style={[styles.categoryColor, { backgroundColor: trend.color }]} 
                    />
                    <Text variant="bodyMedium" style={styles.categoryName}>
                      {trend.category}
                    </Text>
                  </View>
                  <View style={styles.trendStats}>
                    <Text 
                      variant="bodySmall" 
                      style={[styles.trendIndicator, { color: getTrendColor(trend.trend) }]}
                    >
                      {getTrendIcon(trend.trend)} {Math.abs(trend.trendPercentage).toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <View style={styles.trendDetails}>
                  <Text variant="bodySmall" style={styles.trendDetail}>
                    Total: KES {trend.totalAmount.toLocaleString()}
                  </Text>
                  <Text variant="bodySmall" style={styles.trendDetail}>
                    Average: KES {trend.averageAmount.toLocaleString()}
                  </Text>
                  <Text variant="bodySmall" style={styles.trendDetail}>
                    Trend: {trend.trend}
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Insights */}
      {categoryTrends.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Key Insights
            </Text>
            {categoryTrends
              .filter(trend => Math.abs(trend.trendPercentage) > 10) // Significant changes only
              .map(trend => (
                <View key={`insight-${trend.category}`} style={styles.insightItem}>
                  <Text variant="bodyMedium" style={styles.insightText}>
                    <Text style={styles.insightCategory}>{trend.category}</Text> spending is{' '}
                    <Text style={[styles.insightTrend, { color: getTrendColor(trend.trend) }]}>
                      {trend.trend}
                    </Text>{' '}
                    by {Math.abs(trend.trendPercentage).toFixed(1)}% compared to earlier periods
                  </Text>
                </View>
              ))}
            {categoryTrends.filter(trend => Math.abs(trend.trendPercentage) > 10).length === 0 && (
              <Text variant="bodyMedium" style={styles.noInsights}>
                Your spending patterns are relatively stable across all categories.
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Empty State */}
      {categoryTrends.length === 0 && (
        <Card style={styles.card}>
          <Card.Content style={styles.emptyState}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No trend data available
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              Add more transactions to see spending trends and analysis
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  categoryChips: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  categoryChip: {
    marginRight: 8,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  trendItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryName: {
    fontWeight: '500',
  },
  trendStats: {
    alignItems: 'flex-end',
  },
  trendIndicator: {
    fontWeight: 'bold',
  },
  trendDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 20,
  },
  trendDetail: {
    color: theme.colors.onSurfaceVariant,
  },
  insightItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    marginBottom: 8,
  },
  insightText: {
    lineHeight: 20,
  },
  insightCategory: {
    fontWeight: 'bold',
  },
  insightTrend: {
    fontWeight: 'bold',
  },
  noInsights: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
  },
});

export default TrendAnalysis;