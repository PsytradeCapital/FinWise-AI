import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { addCategory, updateCategory, deleteCategory } from '../store/slices/categorySlice';
import { updateTransaction } from '../store/slices/transactionSlice';
import { useCategorization } from '../hooks/useCategorization';
import { Category, Transaction } from '@finwise-ai/shared';

interface CategoryManagerProps {
  visible: boolean;
  onClose: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const { categories } = useSelector((state: RootState) => state.categories);
  const { transactions } = useSelector((state: RootState) => state.transactions);
  const { getBulkSuggestions, categorizeTransaction } = useCategorization();
  
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [bulkSuggestions, setBulkSuggestions] = useState<Transaction[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const uncategorizedTransactions = transactions.filter(t => t.category === 'Uncategorized');
  const categoryUsage = categories.map(category => ({
    ...category,
    transactionCount: transactions.filter(t => t.category === category.name).length,
  }));

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditColor(category.color);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCategory || !editName.trim()) return;
    
    const updates: Partial<Category> = {
      name: editName.trim(),
      icon: editIcon || selectedCategory.icon,
      color: editColor || selectedCategory.color,
    };
    
    dispatch(updateCategory({
      id: selectedCategory.id,
      updates,
    }));
    
    // Update all transactions with the old category name
    if (editName.trim() !== selectedCategory.name) {
      transactions
        .filter(t => t.category === selectedCategory.name)
        .forEach(transaction => {
          dispatch(updateTransaction({
            id: transaction.id,
            updates: { category: editName.trim() },
          }));
        });
    }
    
    setIsEditing(false);
    setSelectedCategory(null);
  };

  const handleDeleteCategory = (category: Category) => {
    if (category.isDefault) {
      Alert.alert('Cannot Delete', 'Default categories cannot be deleted.');
      return;
    }
    
    const transactionCount = transactions.filter(t => t.category === category.name).length;
    
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? ${transactionCount} transactions will be marked as uncategorized.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Move transactions to uncategorized
            transactions
              .filter(t => t.category === category.name)
              .forEach(transaction => {
                dispatch(updateTransaction({
                  id: transaction.id,
                  updates: { category: 'Uncategorized' },
                }));
              });
            
            dispatch(deleteCategory(category.id));
          },
        },
      ]
    );
  };

  const handleBulkCategorization = async (category: Category) => {
    try {
      const suggestions = await getBulkSuggestions(category.name);
      setBulkSuggestions(suggestions);
      setSelectedCategory(category);
      setShowBulkModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to get bulk suggestions');
    }
  };

  const applyBulkCategorization = async (selectedTransactions: Transaction[]) => {
    if (!selectedCategory) return;
    
    try {
      for (const transaction of selectedTransactions) {
        await categorizeTransaction(transaction.id, selectedCategory.name);
      }
      
      Alert.alert(
        'Success',
        `${selectedTransactions.length} transactions categorized as "${selectedCategory.name}"`
      );
      setShowBulkModal(false);
      setBulkSuggestions([]);
    } catch (error) {
      Alert.alert('Error', 'Failed to apply bulk categorization');
    }
  };

  const renderCategoryItem = ({ item }: { item: Category & { transactionCount: number } }) => (
    <View style={styles.categoryItem}>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryIcon}>{item.icon}</Text>
        <View style={styles.categoryDetails}>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryCount}>
            {item.transactionCount} transactions
          </Text>
        </View>
      </View>
      
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleBulkCategorization(item)}
        >
          <Text style={styles.actionButtonText}>Bulk</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditCategory(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        
        {!item.isDefault && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteCategory(item)}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderBulkSuggestionItem = ({ item }: { item: Transaction }) => (
    <View style={styles.suggestionItem}>
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionAmount}>
          {item.currency} {item.amount.toFixed(2)}
        </Text>
        <Text style={styles.suggestionDescription}>{item.description}</Text>
        <Text style={styles.suggestionDate}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Category Manager</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{categories.length}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{uncategorizedTransactions.length}</Text>
            <Text style={styles.statLabel}>Uncategorized</Text>
          </View>
        </View>

        <FlatList
          data={categoryUsage}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          style={styles.categoryList}
          showsVerticalScrollIndicator={false}
        />

        {/* Edit Category Modal */}
        <Modal visible={isEditing} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.editModal}>
              <Text style={styles.editTitle}>Edit Category</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Category name"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Icon</Text>
                <TextInput
                  style={styles.textInput}
                  value={editIcon}
                  onChangeText={setEditIcon}
                  placeholder="📝"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Color</Text>
                <TextInput
                  style={styles.textInput}
                  value={editColor}
                  onChangeText={setEditColor}
                  placeholder="#6B73FF"
                />
              </View>
              
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setIsEditing(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Bulk Categorization Modal */}
        <Modal visible={showBulkModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.bulkModal}>
              <Text style={styles.bulkTitle}>
                Bulk Categorize as "{selectedCategory?.name}"
              </Text>
              
              <Text style={styles.bulkSubtitle}>
                {bulkSuggestions.length} suggested transactions
              </Text>
              
              <FlatList
                data={bulkSuggestions}
                renderItem={renderBulkSuggestionItem}
                keyExtractor={(item) => item.id}
                style={styles.suggestionsList}
                maxHeight={300}
              />
              
              <View style={styles.bulkActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowBulkModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => applyBulkCategorization(bulkSuggestions)}
                >
                  <Text style={styles.applyButtonText}>
                    Apply All ({bulkSuggestions.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#FFF',
    marginBottom: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6B73FF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  categoryList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    marginLeft: 5,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    color: '#D32F2F',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModal: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  cancelButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6B73FF',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 10,
  },
  saveButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  bulkModal: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 20,
    width: '95%',
    maxHeight: '80%',
  },
  bulkTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  bulkSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  suggestionsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  suggestionItem: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  suggestionInfo: {
    flexDirection: 'column',
  },
  suggestionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  suggestionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  suggestionDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  bulkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 10,
  },
  applyButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});

export default CategoryManager;