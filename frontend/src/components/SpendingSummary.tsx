import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Text, Card, SegmentedButtons, Button } from 'react-native-paper';
import { PieChart, LineChart } from 'react-native-chart-kit';
import { Transaction } from '@finwise-ai/shared';
import { theme } from '../theme';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';

interface SpendingSummaryProps {
  transactions: Transaction[];
  onCategoryPress?: (category: string) => void;
}

type TimePeriod = 'daily' | 'weekly' | 'monthly';

interface SpendingData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface TrendData {
  period: string;
  amount: number;
}

const screenWidth = Dimensions.get('window').width;

const CATEGORY_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

const SpendingSummary: React.FC<SpendingSummaryProps> = ({ 
  transactions, 
  onCategoryPress 
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly');
  const [showTrends, setShowTrends] = useState(false);

  // Filter transactions for the selected period
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (selectedPeriod) {
      case 'daily':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'weekly':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
    }

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.timestamp);
      return transactionDate >= startDate && transactionDate <= endDate && transaction.amount > 0;
    });
  }, [transactions, selectedPeriod]);

  // Calculate spending by category
  const spendingByCategory = useMemo(() => {
    const categoryTotals = new Map<string, number>();
    
    filteredTransactions.forEach(transaction => {
      const category = transaction.category || 'Uncategorized';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + transaction.amount);
    });

    const totalSpending = Array.from(categoryTotals.values()).reduce((sum, amount) => sum + amount, 0);
    
    return Array.from(categoryTotals.entries())
      .map(([category, amount], index) => ({
        category,
        amount,
        percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  // Calculate trend data
  const trendData = useMemo(() => {
    const now = new Date();
    const periods: TrendData[] = [];
    
    for (let i = 6; i >= 0; i--) {
      let periodStart: Date;
      let periodEnd: Date;
      let label: string;

      switch (selectedPeriod) {
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

      const periodTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.timestamp);
        return transactionDate >= periodStart && transactionDate <= periodEnd && transaction.amount > 0;
      });

      const totalAmount = periodTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      
      periods.push({
        period: label,
        amount: totalAmount
      });
    }

    return periods;
  }, [transactions, selectedPeriod]);

  const totalSpending = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  // Prepare pie chart data
  const pieChartData = spendingByCategory.map(item => ({
    name: item.category,
    population: item.amount,
    color: item.color,
    legendFontColor: theme.colors.onSurface,
    legendFontSize: 12,
  }));

  // Prepare line chart data
  const lineChartData = {
    labels: trendData.map(item => item.period),
    datasets: [
      {
        data: trendData.map(item => item.amount),
        color: (opacity = 1) => `rgba(69, 183, 209, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

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
      r: '6',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
  };

  return (
    <ScrollView style={styles.container}>
      {/* Period Selector */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Spending Summary
          </Text>
          <SegmentedButtons
            value={selectedPeriod}
            onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}
            buttons={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            style={styles.segmentedButtons}
          />
        </Card.Content>
      </Card>

      {/* Total Spending */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.totalAmount}>
            KES {totalSpending.toLocaleString()}
          </Text>
          <Text variant="bodyMedium" style={styles.totalLabel}>
            Total {selectedPeriod} spending
          </Text>
        </Card.Content>
      </Card>

      {/* Pie Chart */}
      {pieChartData.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Spending by Category
            </Text>
            <View style={styles.chartContainer}>
              <PieChart
                data={pieChartData}
                width={screenWidth - 60}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                center={[10, 10]}
                absolute
              />
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Category Breakdown */}
      {spendingByCategory.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Category Breakdown
            </Text>
            {spendingByCategory.map((item, index) => (
              <View key={item.category} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <View 
                    style={[styles.categoryColor, { backgroundColor: item.color }]} 
                  />
                  <Text variant="bodyMedium" style={styles.categoryName}>
                    {item.category}
                  </Text>
                </View>
                <View style={styles.categoryAmounts}>
                  <Text variant="bodyMedium" style={styles.categoryAmount}>
                    KES {item.amount.toLocaleString()}
                  </Text>
                  <Text variant="bodySmall" style={styles.categoryPercentage}>
                    {item.percentage.toFixed(1)}%
                  </Text>
                </View>
                {onCategoryPress && (
                  <Button
                    mode="text"
                    compact
                    onPress={() => onCategoryPress(item.category)}
                  >
                    View
                  </Button>
                )}
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Trend Analysis Toggle */}
      <Card style={styles.card}>
        <Card.Content>
          <Button
            mode={showTrends ? "contained" : "outlined"}
            onPress={() => setShowTrends(!showTrends)}
            style={styles.trendButton}
          >
            {showTrends ? 'Hide' : 'Show'} Spending Trends
          </Button>
        </Card.Content>
      </Card>

      {/* Trend Chart */}
      {showTrends && trendData.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Spending Trends
            </Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={lineChartData}
                width={screenWidth - 60}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            </View>
            <Text variant="bodySmall" style={styles.trendDescription}>
              {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} spending over the last 7 periods
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Empty State */}
      {filteredTransactions.length === 0 && (
        <Card style={styles.card}>
          <Card.Content style={styles.emptyState}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No spending data available for this period
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              Start tracking your expenses to see spending summaries
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
    marginTop: 8,
  },
  totalAmount: {
    textAlign: 'center',
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  totalLabel: {
    textAlign: 'center',
    marginTop: 4,
    color: theme.colors.onSurfaceVariant,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
  },
  categoryAmounts: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  categoryAmount: {
    fontWeight: 'bold',
  },
  categoryPercentage: {
    color: theme.colors.onSurfaceVariant,
  },
  trendButton: {
    marginTop: 8,
  },
  trendDescription: {
    textAlign: 'center',
    marginTop: 8,
    color: theme.colors.onSurfaceVariant,
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

export default SpendingSummary;