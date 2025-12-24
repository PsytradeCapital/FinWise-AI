import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { addCategory, updateCategory } from '../store/slices/categorySlice';
import { updateTransaction } from '../store/slices/transactionSlice';
import CategorizationService, { CategorySuggestion } from '../services/categorizationService';
import { Transaction, Category } from '@finwise-ai/shared';

export interface UseCategorization {
  suggestions: CategorySuggestion[];
  isLoading: boolean;
  generateSuggestions: (transaction: Transaction) => Promise<void>;
  categorizeTransaction: (
    transactionId: string, 
    category: string, 
    description?: string
  ) => Promise<void>;
  learnFromCategorization: (
    transaction: Transaction, 
    category: string, 
    description?: string
  ) => Promise<void>;
  getBulkSuggestions: (targetCategory: string) => Promise<Transaction[]>;
  createCustomCategory: (name: string, icon?: string, color?: string) => Category;
  clearLearningData: () => Promise<void>;
}

export const useCategorization = (): UseCategorization => {
  const dispatch = useDispatch();
  const { categories } = useSelector((state: RootState) => state.categories);
  const { transactions } = useSelector((state: RootState) => state.transactions);
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const categorizationService = CategorizationService.getInstance();

  // Initialize learning data when user changes
  useEffect(() => {
    if (user?.id) {
      categorizationService.loadLearningData(user.id);
    }
  }, [user?.id]);

  const generateSuggestions = useCallback(async (transaction: Transaction) => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const generatedSuggestions = categorizationService.generateSuggestions(
        transaction,
        categories,
        transactions
      );
      setSuggestions(generatedSuggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [categories, transactions, user?.id]);

  const categorizeTransaction = useCallback(async (
    transactionId: string,
    category: string,
    description?: string
  ) => {
    try {
      // Update transaction in store
      dispatch(updateTransaction({
        id: transactionId,
        updates: {
          category,
          description: description || undefined,
        }
      }));

      // Find the transaction for learning
      const transaction = transactions.find(t => t.id === transactionId);
      if (transaction) {
        await learnFromCategorization(transaction, category, description);
      }
    } catch (error) {
      console.error('Error categorizing transaction:', error);
    }
  }, [dispatch, transactions]);

  const learnFromCategorization = useCallback(async (
    transaction: Transaction,
    category: string,
    description?: string
  ) => {
    try {
      await categorizationService.learnFromCategorization(
        transaction,
        category,
        description
      );
    } catch (error) {
      console.error('Error learning from categorization:', error);
    }
  }, []);

  const getBulkSuggestions = useCallback(async (targetCategory: string): Promise<Transaction[]> => {
    try {
      return await categorizationService.getBulkCategorizationSuggestions(
        transactions,
        targetCategory
      );
    } catch (error) {
      console.error('Error getting bulk suggestions:', error);
      return [];
    }
  }, [transactions]);

  const createCustomCategory = useCallback((
    name: string,
    icon: string = '📝',
    color: string = '#6B73FF'
  ): Category => {
    const newCategory: Category = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      icon,
      color,
      isDefault: false,
      userId: user?.id,
    };

    dispatch(addCategory(newCategory));
    return newCategory;
  }, [dispatch, user?.id]);

  const clearLearningData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      await categorizationService.clearLearningData(user.id);
    } catch (error) {
      console.error('Error clearing learning data:', error);
    }
  }, [user?.id]);

  return {
    suggestions,
    isLoading,
    generateSuggestions,
    categorizeTransaction,
    learnFromCategorization,
    getBulkSuggestions,
    createCustomCategory,
    clearLearningData,
  };
};

export default useCategorization;