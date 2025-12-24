import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateTransaction, deleteTransaction } from '../store/slices/transactionSlice';
import { useCategorization } from '../hooks/useCategorization';
import { Transaction, Category } from '@finwise-ai/shared';

interface TransactionEditorProps {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSave?: (transaction: Transaction) => void;
}

const TransactionEditor: React.FC<TransactionEditorProps> = ({
  visible,
  transaction,
  onClose,
  onSave,
}) => {
  const dispatch = useDispatch();
  const { categories } = useSelector((state: RootState) => state.categories);
  const { categorizeTransaction, createCustomCategory } = useCategorization();
  
  const [editedTransaction, setEditedTransaction] = useState<Partial<Transaction>>({});
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  useEffect(() => {
    if (transaction) {
      setEditedTransaction({
        description: transaction.description,
        category: transaction.category,
        amount: transaction.amount,
      });
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction) return;
    
    try {
      const updates: Partial<Transaction> = {};
      
      if (editedTransaction.description !== transaction.description) {
        updates.description = editedTransaction.description;
      }
      
      if (editedTransaction.category !== transaction.category) {
        updates.category = editedTransaction.category;
      }
      
      if (editedTransaction.amount !== transaction.amount) {
        updates.amount = editedTransaction.amount;
      }
      
      if (Object.keys(updates).length > 0) {
        dispatch(updateTransaction({
          id: transaction.id,
          updates,
        }));
        
        // Learn from the categorization if category changed
        if (updates.category && updates.category !== transaction.category) {
          await categorizeTransaction(
            transaction.id,
            updates.category,
            updates.description
          );
        }
        
        const updatedTransaction = { ...transaction, ...updates };
        onSave?.(updatedTransaction);
      }
      
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save transaction changes');
    }
  };

  const handleDelete = () => {
    if (!transaction) return;
    
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dispatch(deleteTransaction(transaction.id));
            onClose();
          },
        },
      ]
    );
  };

  const handleCategorySelect = (category: Category) => {
    setEditedTransaction(prev => ({
      ...prev,
      category: category.name,
    }));
    setShowCategoryPicker(false);
  };

  const handleCreateNewCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory = createCustomCategory(newCategoryName.trim());
    setEditedTransaction(prev => ({
      ...prev,
      category: newCategory.name,
    }));
    setNewCategoryName('');
    setShowNewCategoryInput(false);
    setShowCategoryPicker(false);
  };

  const handleSetUncategorized = () => {
    setEditedTransaction(prev => ({
      ...prev,
      category: 'Uncategorized',
    }));
    setShowCategoryPicker(false);
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => handleCategorySelect(item)}
    >
      <Text style={styles.categoryIcon}>{item.icon}</Text>
      <Text style={styles.categoryName}>{item.name}</Text>
      {editedTransaction.category === item.name && (
        <Text style={styles.selectedIndicator}>✓</Text>
      )}
    </TouchableOpacity>
  );

  if (!transaction) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Transaction</Text>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Details</Text>
            
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currency}>{transaction.currency}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={editedTransaction.amount?.toString() || ''}
                  onChangeText={(text) => {
                    const amount = parseFloat(text) || 0;
                    setEditedTransaction(prev => ({ ...prev, amount }));
                  }}
                  keyboardType="numeric"
                  placeholder="0.00"
                />
              </View>
            </View>
            
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.textInput}
                value={editedTransaction.description || ''}
                onChangeText={(text) => 
                  setEditedTransaction(prev => ({ ...prev, description: text }))
                }
                placeholder="Transaction description"
                multiline
              />
            </View>
            
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Category</Text>
              <TouchableOpacity
                style={styles.categorySelector}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={styles.categorySelectorText}>
                  {editedTransaction.category || 'Select category'}
                </Text>
                <Text style={styles.categorySelectorArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Info</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>
                {new Date(transaction.timestamp).toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Source:</Text>
              <Text style={styles.infoValue}>{transaction.source.toUpperCase()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Verified:</Text>
              <Text style={styles.infoValue}>
                {transaction.isVerified ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>

        {/* Category Picker Modal */}
        <Modal
          visible={showCategoryPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCategoryPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.categoryModal}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>Select Category</Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryPicker(false)}
                  style={styles.categoryCloseButton}
                >
                  <Text style={styles.categoryCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Uncategorized Option */}
              <TouchableOpacity
                style={[
                  styles.categoryItem,
                  editedTransaction.category === 'Uncategorized' && styles.selectedCategory
                ]}
                onPress={handleSetUncategorized}
              >
                <Text style={styles.categoryIcon}>❓</Text>
                <Text style={styles.categoryName}>Uncategorized</Text>
                {editedTransaction.category === 'Uncategorized' && (
                  <Text style={styles.selectedIndicator}>✓</Text>
                )}
              </TouchableOpacity>

              <FlatList
                data={categories}
                renderItem={renderCategoryItem}
                keyExtractor={(item) => item.id}
                style={styles.categoryList}
              />

              <View style={styles.categoryFooter}>
                {showNewCategoryInput ? (
                  <View style={styles.newCategoryContainer}>
                    <TextInput
                      style={styles.newCategoryInput}
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      placeholder="New category name"
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.createButton}
                      onPress={handleCreateNewCategory}
                    >
                      <Text style={styles.createButtonText}>Create</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelNewButton}
                      onPress={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryName('');
                      }}
                    >
                      <Text style={styles.cancelNewButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.newCategoryButton}
                    onPress={() => setShowNewCategoryInput(true)}
                  >
                    <Text style={styles.newCategoryButtonText}>+ Create New Category</Text>
                  </TouchableOpacity>
                )}
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
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B73FF',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteButton: {
    padding: 5,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  field: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currency: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    minHeight: 40,
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categorySelectorText: {
    fontSize: 16,
    color: '#333',
  },
  categorySelectorArrow: {
    fontSize: 12,
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  categoryModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryCloseButton: {
    padding: 5,
  },
  categoryCloseText: {
    fontSize: 18,
    color: '#666',
  },
  categoryList: {
    maxHeight: 300,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedCategory: {
    backgroundColor: '#E3F2FD',
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 15,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  selectedIndicator: {
    fontSize: 16,
    color: '#6B73FF',
    fontWeight: 'bold',
  },
  categoryFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  newCategoryButton: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    borderRadius: 8,
  },
  newCategoryButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '500',
  },
  newCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newCategoryInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 10,
  },
  createButton: {
    backgroundColor: '#6B73FF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 5,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: '500',
  },
  cancelNewButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelNewButtonText: {
    color: '#666',
    fontWeight: '500',
  },
});

export default TransactionEditor;