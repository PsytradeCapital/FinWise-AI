import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import CategorizationPopup from './CategorizationPopup';
import TransactionEditor from './TransactionEditor';
import CategoryManager from './CategoryManager';
import { Transaction } from '@shared/types';

/**
 * Demo component showing how the categorization components work together
 * This demonstrates the complete categorization workflow
 */
const TransactionCategorizationDemo: React.FC = () => {
  const { transactions } = useSelector((state: RootState) => state.transactions);
  const [showCategorizationPopup, setShowCategorizationPopup] = useState(false);
  const [showTransactionEditor, setShowTransactionEditor] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Get an uncategorized transaction for demo
  const uncategorizedTransaction = transactions.find(t => t.category === 'Uncategorized');

  const handleShowCategorizationPopup = () => {
    if (uncategorizedTransaction) {
      setSelectedTransaction(uncategorizedTransaction);
      setShowCategorizationPopup(true);
    } else {
      Alert.alert('No Uncategorized Transactions', 'All transactions are already categorized!');
    }
  };

  const handleShowTransactionEditor = () => {
    if (transactions.length > 0) {
      setSelectedTransaction(transactions[0]);
      setShowTransactionEditor(true);
    } else {
      Alert.alert('No Transactions', 'No transactions available to edit.');
    }
  };

  const handleCategorize = (transactionId: string, category: string, description?: string) => {
    Alert.alert(
      'Transaction Categorized',
      `Transaction categorized as "${category}"${description ? ` with description: "${description}"` : ''}`
    );
  };

  const handleTransactionSave = (transaction: Transaction) => {
    Alert.alert('Transaction Updated', `Transaction "${transaction.description}" has been updated.`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Categorization Demo</Text>
      
      <View style={styles.stats}>
        <Text style={styles.statText}>
          Total Transactions: {transactions.length}
        </Text>
        <Text style={styles.statText}>
          Uncategorized: {transactions.filter(t => t.category === 'Uncategorized').length}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleShowCategorizationPopup}
        >
          <Text style={styles.buttonText}>Show Categorization Popup</Text>
          <Text style={styles.buttonSubtext}>
            Demonstrates real-time categorization with AI suggestions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleShowTransactionEditor}
        >
          <Text style={styles.buttonText}>Edit Transaction</Text>
          <Text style={styles.buttonSubtext}>
            Edit transaction details and category
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.demoButton}
          onPress={() => setShowCategoryManager(true)}
        >
          <Text style={styles.buttonText}>Manage Categories</Text>
          <Text style={styles.buttonSubtext}>
            Bulk categorization and category management
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.features}>
        <Text style={styles.featuresTitle}>Features Implemented:</Text>
        <Text style={styles.featureItem}>✅ Non-intrusive popup interface</Text>
        <Text style={styles.featureItem}>✅ AI-powered category suggestions</Text>
        <Text style={styles.featureItem}>✅ Voice input support</Text>
        <Text style={styles.featureItem}>✅ Category learning and persistence</Text>
        <Text style={styles.featureItem}>✅ Default "Uncategorized" behavior</Text>
        <Text style={styles.featureItem}>✅ Transaction editing functionality</Text>
        <Text style={styles.featureItem}>✅ Bulk categorization options</Text>
      </View>

      {/* Categorization Popup */}
      <CategorizationPopup
        visible={showCategorizationPopup}
        transaction={selectedTransaction}
        onClose={() => {
          setShowCategorizationPopup(false);
          setSelectedTransaction(null);
        }}
        onCategorize={handleCategorize}
      />

      {/* Transaction Editor */}
      <TransactionEditor
        visible={showTransactionEditor}
        transaction={selectedTransaction}
        onClose={() => {
          setShowTransactionEditor(false);
          setSelectedTransaction(null);
        }}
        onSave={handleTransactionSave}
      />

      {/* Category Manager */}
      <CategoryManager
        visible={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  stats: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  demoButton: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#6B73FF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#666',
  },
  features: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  featureItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
    paddingLeft: 10,
  },
});

export default TransactionCategorizationDemo;