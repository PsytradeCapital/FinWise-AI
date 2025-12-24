import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, List, Chip, Button, Divider } from 'react-native-paper';
import { Transaction } from '@finwise-ai/shared';
import { theme } from '../theme';
import { format } from 'date-fns';

interface SpendingBreakdownProps {
  transactions: Transaction[];
  selectedCategory?: string;
  onTransactionPress?: (transaction: Transaction) => void;
  onBackPress?: () => void;
}

interface CategoryBreakdown {
  category: string;
  subcategories: SubcategoryBreakdown[];
  totalAmount: number;
  transactionCount: number;
}

interface SubcategoryBreakdown {
  subcategory: string;
  transactions: Transaction[];
  totalAmount: number;
}

const SpendingBreakdown: React.FC<SpendingBreakdownProps> = ({
  transactions,
  selectedCategory,
  onTransactionPress,
  onBackPress,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'amount' | 'count' | 'date'>('amount');

  // Process transactions into category breakdown
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, CategoryBreakdown>();

    const filteredTransactions = selectedCategory
      ? transactions.filter(t => t.category === selectedCategory)
      : transactions.filter(t => t.amount > 0); // Only spending transactions

    filteredTransactions.forEach(transaction => {
      const category = transaction.category || 'Uncategorized';
      const subcategory = transaction.subcategory || 'General';

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          subcategories: [],
          totalAmount: 0,
          transactionCount: 0,
        });
      }

      const categoryData = categoryMap.get(category)!;
      categoryData.totalAmount += transaction.amount;
      categoryData.transactionCount += 1;

      // Find or create subcategory
      let subcategoryData = categoryData.subcategories.find(s => s.subcategory === subcategory);
      if (!subcategoryData) {
        subcategoryData = {
          subcategory,
          transactions: [],
          totalAmount: 0,
        };
        categoryData.subcategories.push(subcategoryData);
      }

      subcategoryData.transactions.push(transaction);
      subcategoryData.totalAmount += transaction.amount;
    });

    // Sort categories and subcategories
    const categories = Array.from(categoryMap.values());
    
    categories.forEach(category => {
      category.subcategories.sort((a, b) => {
        switch (sortBy) {
          case 'amount':
            return b.totalAmount - a.totalAmount;
          case 'count':
            return b.transactions.length - a.transactions.length;
          case 'date':
            const aLatest = Math.max(...a.transactions.map(t => new Date(t.timestamp).getTime()));
            const bLatest = Math.max(...b.transactions.map(t => new Date(t.timestamp).getTime()));
            return bLatest - aLatest;
          default:
            return 0;
        }
      });

      // Sort transactions within subcategories by date (newest first)
      category.subcategories.forEach(subcategory => {
        subcategory.transactions.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
    });

    return categories.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.totalAmount - a.totalAmount;
        case 'count':
          return b.transactionCount - a.transactionCount;
        case 'date':
          const aLatest = Math.max(...a.subcategories.flatMap(s => 
            s.transactions.map(t => new Date(t.timestamp).getTime())
          ));
          const bLatest = Math.max(...b.subcategories.flatMap(s => 
            s.transactions.map(t => new Date(t.timestamp).getTime())
          ));
          return bLatest - aLatest;
        default:
          return 0;
      }
    });
  }, [transactions, selectedCategory, sortBy]);

  const toggleCategoryExpansion = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const renderTransaction = (transaction: Transaction) => (
    <List.Item
      key={transaction.id}
      title={transaction.description}
      description={`${format(new Date(transaction.timestamp), 'MMM dd, yyyy HH:mm')} • ${transaction.source}`}
      right={() => (
        <View style={styles.transactionAmount}>
          <Text variant="bodyMedium" style={styles.amountText}>
            KES {transaction.amount.toLocaleString()}
          </Text>
          {transaction.merchant && (
            <Text variant="bodySmall" style={styles.merchantText}>
              {transaction.merchant}
            </Text>
          )}
        </View>
      )}
      onPress={() => onTransactionPress?.(transaction)}
      style={styles.transactionItem}
    />
  );

  const renderSubcategory = (subcategory: SubcategoryBreakdown, categoryName: string) => (
    <View key={`${categoryName}-${subcategory.subcategory}`} style={styles.subcategoryContainer}>
      <View style={styles.subcategoryHeader}>
        <Text variant="bodyMedium" style={styles.subcategoryName}>
          {subcategory.subcategory}
        </Text>
        <View style={styles.subcategoryStats}>
          <Text variant="bodySmall" style={styles.subcategoryAmount}>
            KES {subcategory.totalAmount.toLocaleString()}
          </Text>
          <Text variant="bodySmall" style={styles.subcategoryCount}>
            {subcategory.transactions.length} transactions
          </Text>
        </View>
      </View>
      {subcategory.transactions.map(renderTransaction)}
    </View>
  );

  const renderCategory = ({ item: category }: { item: CategoryBreakdown }) => {
    const isExpanded = expandedCategories.has(category.category);
    
    return (
      <Card style={styles.categoryCard}>
        <List.Item
          title={category.category}
          description={`${category.transactionCount} transactions`}
          right={() => (
            <View style={styles.categoryAmount}>
              <Text variant="titleMedium" style={styles.amountText}>
                KES {category.totalAmount.toLocaleString()}
              </Text>
            </View>
          )}
          onPress={() => toggleCategoryExpansion(category.category)}
          style={styles.categoryHeader}
        />
        
        {isExpanded && (
          <Card.Content>
            <Divider style={styles.divider} />
            {category.subcategories.map(subcategory => 
              renderSubcategory(subcategory, category.category)
            )}
          </Card.Content>
        )}
      </Card>
    );
  };

  const totalAmount = categoryBreakdown.reduce((sum, category) => sum + category.totalAmount, 0);
  const totalTransactions = categoryBreakdown.reduce((sum, category) => sum + category.transactionCount, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Card.Content>
          {selectedCategory && onBackPress && (
            <Button
              mode="text"
              onPress={onBackPress}
              style={styles.backButton}
            >
              ← Back to All Categories
            </Button>
          )}
          
          <Text variant="headlineSmall" style={styles.title}>
            {selectedCategory ? `${selectedCategory} Breakdown` : 'Spending Breakdown'}
          </Text>
          
          <View style={styles.summaryStats}>
            <Text variant="bodyLarge">
              Total: KES {totalAmount.toLocaleString()}
            </Text>
            <Text variant="bodyMedium" style={styles.transactionCount}>
              {totalTransactions} transactions
            </Text>
          </View>

          {/* Sort Options */}
          <View style={styles.sortContainer}>
            <Text variant="bodyMedium" style={styles.sortLabel}>Sort by:</Text>
            <View style={styles.sortChips}>
              <Chip
                selected={sortBy === 'amount'}
                onPress={() => setSortBy('amount')}
                style={styles.sortChip}
              >
                Amount
              </Chip>
              <Chip
                selected={sortBy === 'count'}
                onPress={() => setSortBy('count')}
                style={styles.sortChip}
              >
                Count
              </Chip>
              <Chip
                selected={sortBy === 'date'}
                onPress={() => setSortBy('date')}
                style={styles.sortChip}
              >
                Recent
              </Chip>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Category List */}
      <FlatList
        data={categoryBreakdown}
        renderItem={renderCategory}
        keyExtractor={(item) => item.category}
        style={styles.categoryList}
        showsVerticalScrollIndicator={false}
      />

      {/* Empty State */}
      {categoryBreakdown.length === 0 && (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyState}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No spending data available
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              {selectedCategory 
                ? `No transactions found in ${selectedCategory} category`
                : 'Start tracking your expenses to see detailed breakdowns'
              }
            </Text>
          </Card.Content>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  summaryStats: {
    marginBottom: 16,
  },
  transactionCount: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  sortContainer: {
    marginTop: 8,
  },
  sortLabel: {
    marginBottom: 8,
    color: theme.colors.onSurfaceVariant,
  },
  sortChips: {
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    marginRight: 8,
  },
  categoryList: {
    flex: 1,
  },
  categoryCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  categoryHeader: {
    paddingVertical: 8,
  },
  categoryAmount: {
    alignItems: 'flex-end',
  },
  divider: {
    marginVertical: 8,
  },
  subcategoryContainer: {
    marginLeft: 16,
    marginBottom: 16,
  },
  subcategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  subcategoryName: {
    fontWeight: '500',
  },
  subcategoryStats: {
    alignItems: 'flex-end',
  },
  subcategoryAmount: {
    fontWeight: 'bold',
  },
  subcategoryCount: {
    color: theme.colors.onSurfaceVariant,
  },
  transactionItem: {
    paddingLeft: 16,
    paddingVertical: 4,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontWeight: 'bold',
  },
  merchantText: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  emptyCard: {
    margin: 16,
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

export default SpendingBreakdown;