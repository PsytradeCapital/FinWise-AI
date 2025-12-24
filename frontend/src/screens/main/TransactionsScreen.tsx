import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, FAB, Card, Chip, Button } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { fetchTransactions } from '../../store/thunks/transactionThunks';
import { appStateManager } from '../../services/appStateManager';
import { theme } from '../../theme';
import { Transaction } from '@finwise-ai/shared';
import { logger } from '../../utils/logger';

const TransactionsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { transactions, isLoading, error } = useSelector((state: RootState) => state.transactions);
  const { user } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadTransactions();
    }
  }, [user?.id]);

  const loadTransactions = async () => {
    if (!user?.id) return;
    
    try {
      await dispatch(fetchTransactions(user.id) as any);
    } catch (error) {
      logger.error('Failed to load transactions', { error });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const handleAddManualTransaction = () => {
    Alert.prompt(
      'Add Transaction',
      'Enter transaction details (amount,description,category)',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: async (input) => {
            if (input) {
              const parts = input.split(',');
              if (parts.length >= 2) {
                const amount = parseFloat(parts[0].trim());
                const description = parts[1].trim();
                const category = parts[2]?.trim() || 'Uncategorized';
                
                if (!isNaN(amount) && description) {
                  await appStateManager.createManualTransactionFlow({
                    amount,
                    description,
                    category,
                    timestamp: new Date(),
                  });
                } else {
                  Alert.alert('Error', 'Invalid input format');
                }
              } else {
                Alert.alert('Error', 'Please enter: amount,description,category');
              }
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  const handleSMSTest = () => {
    Alert.prompt(
      'Test SMS Parsing',
      'Enter SMS content to test transaction parsing:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Parse',
          onPress: async (smsContent) => {
            if (smsContent) {
              await appStateManager.handleSMSTransaction(smsContent, user?.phoneNumber);
            }
          },
        },
      ],
      'plain-text',
      'Confirmed. You have sent Ksh500.00 to JOHN DOE 0722123456 on 15/12/23 at 2:30 PM. New M-PESA balance is Ksh2,500.00.',
      'default'
    );
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <Card style={styles.transactionCard}>
      <Card.Content>
        <View style={styles.transactionHeader}>
          <Text variant="titleMedium">{item.description}</Text>
          <Text variant="titleMedium" style={[
            styles.amount,
            { color: item.amount < 0 ? theme.colors.error : theme.colors.primary }
          ]}>
            {item.currency} {Math.abs(item.amount).toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.transactionDetails}>
          <Chip mode="outlined" compact style={styles.categoryChip}>
            {item.category}
          </Chip>
          <Text variant="bodySmall" style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        
        <View style={styles.transactionMeta}>
          <Chip 
            mode="flat" 
            compact 
            style={[styles.sourceChip, { backgroundColor: getSourceColor(item.source) }]}
          >
            {item.source.toUpperCase()}
          </Chip>
          {item.merchant && (
            <Text variant="bodySmall" style={styles.merchant}>
              {item.merchant}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'sms': return theme.colors.primaryContainer;
      case 'api': return theme.colors.secondaryContainer;
      case 'manual': return theme.colors.tertiaryContainer;
      default: return theme.colors.surfaceVariant;
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="headlineSmall" style={styles.errorTitle}>
          Error Loading Transactions
        </Text>
        <Text variant="bodyLarge" style={styles.errorMessage}>
          {error}
        </Text>
        <Button mode="contained" onPress={handleRefresh} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Transactions
        </Text>
        <View style={styles.headerActions}>
          <Button mode="outlined" onPress={handleSMSTest} compact>
            Test SMS
          </Button>
          <Button mode="contained" onPress={handleRefresh} compact loading={refreshing}>
            Sync
          </Button>
        </View>
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              No Transactions Yet
            </Text>
            <Text variant="bodyLarge" style={styles.emptyText}>
              Add your first transaction manually or connect your M-Pesa account
            </Text>
            <Button mode="contained" onPress={handleAddManualTransaction} style={styles.addButton}>
              Add Transaction
            </Button>
          </View>
        }
      />

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddManualTransaction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  title: {
    color: theme.colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // Space for FAB
  },
  transactionCard: {
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amount: {
    fontWeight: 'bold',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryChip: {
    alignSelf: 'flex-start',
  },
  timestamp: {
    color: theme.colors.onSurfaceVariant,
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceChip: {
    alignSelf: 'flex-start',
  },
  merchant: {
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: theme.colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 32,
    color: theme.colors.onSurfaceVariant,
  },
  addButton: {
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: theme.colors.error,
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: 32,
    color: theme.colors.onSurfaceVariant,
  },
  retryButton: {
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});

export default TransactionsScreen;