import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  FlatList,
  Alert,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Voice from '@react-native-voice/voice';
import { Transaction, Category } from '@finwise-ai/shared';
import { RootState } from '../store';
import { updateTransaction } from '../store/slices/transactionSlice';
import { addCategory } from '../store/slices/categorySlice';

interface CategorizationPopupProps {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onCategorize: (transactionId: string, category: string, description?: string) => void;
}

const { width, height } = Dimensions.get('window');

const CategorizationPopup: React.FC<CategorizationPopupProps> = ({
  visible,
  transaction,
  onClose,
  onCategorize,
}) => {
  const dispatch = useDispatch();
  const { categories } = useSelector((state: RootState) => state.categories);
  const { transactions } = useSelector((state: RootState) => state.transactions);
  
  const [categoryInput, setCategoryInput] = useState('');
  const [description, setDescription] = useState('');
  const [suggestedCategories, setSuggestedCategories] = useState<Category[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceResult, setVoiceResult] = useState('');
  
  const slideAnim = useRef(new Animated.Value(height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset state when popup opens
      setCategoryInput('');
      setDescription(transaction?.description || '');
      setVoiceResult('');
      
      // Generate suggestions based on transaction
      if (transaction) {
        generateCategorySuggestions(transaction);
      }
      
      // Animate popup in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate popup out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, transaction]);

  useEffect(() => {
    // Setup voice recognition
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const generateCategorySuggestions = (transaction: Transaction) => {
    const suggestions: Category[] = [];
    
    // Get categories based on transaction description keywords
    const keywords = transaction.description.toLowerCase().split(' ');
    const matchingCategories = categories.filter(category => 
      keywords.some(keyword => 
        category.name.toLowerCase().includes(keyword) ||
        keyword.includes(category.name.toLowerCase())
      )
    );
    
    suggestions.push(...matchingCategories);
    
    // Get categories based on similar transactions
    const similarTransactions = transactions.filter(t => 
      t.id !== transaction.id &&
      t.category !== 'Uncategorized' &&
      (
        Math.abs(t.amount - transaction.amount) < transaction.amount * 0.1 ||
        t.description.toLowerCase().includes(transaction.description.toLowerCase().substring(0, 5)) ||
        transaction.description.toLowerCase().includes(t.description.toLowerCase().substring(0, 5))
      )
    );
    
    const historicalCategories = categories.filter(category =>
      similarTransactions.some(t => t.category === category.name)
    );
    
    suggestions.push(...historicalCategories);
    
    // Remove duplicates and limit to top 5
    const uniqueSuggestions = suggestions.filter((category, index, self) =>
      index === self.findIndex(c => c.id === category.id)
    ).slice(0, 5);
    
    setSuggestedCategories(uniqueSuggestions);
  };

  const onSpeechStart = () => {
    setIsListening(true);
  };

  const onSpeechEnd = () => {
    setIsListening(false);
  };

  const onSpeechResults = (event: any) => {
    const result = event.value[0];
    setVoiceResult(result);
    setCategoryInput(result);
  };

  const onSpeechError = (event: any) => {
    setIsListening(false);
    Alert.alert('Voice Recognition Error', 'Could not recognize speech. Please try again.');
  };

  const startListening = async () => {
    try {
      await Voice.start('en-US');
    } catch (error) {
      Alert.alert('Error', 'Could not start voice recognition');
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  const handleCategorySelect = (category: Category) => {
    setCategoryInput(category.name);
  };

  const handleSave = () => {
    if (!transaction) return;
    
    const finalCategory = categoryInput.trim() || 'Uncategorized';
    const finalDescription = description.trim() || transaction.description;
    
    // Save custom category if it doesn't exist
    if (finalCategory !== 'Uncategorized' && 
        !categories.some(c => c.name.toLowerCase() === finalCategory.toLowerCase())) {
      const newCategory: Category = {
        id: `custom_${Date.now()}`,
        name: finalCategory,
        icon: '📝',
        color: '#6B73FF',
        isDefault: false,
        userId: transaction.userId,
      };
      dispatch(addCategory(newCategory));
    }
    
    // Update transaction
    dispatch(updateTransaction({
      id: transaction.id,
      updates: {
        category: finalCategory,
        description: finalDescription,
      }
    }));
    
    onCategorize(transaction.id, finalCategory, finalDescription);
    onClose();
  };

  const handleDismiss = () => {
    if (!transaction) return;
    
    // Set as uncategorized (default behavior for dismissed popups)
    dispatch(updateTransaction({
      id: transaction.id,
      updates: {
        category: 'Uncategorized',
      }
    }));
    
    onCategorize(transaction.id, 'Uncategorized');
    onClose();
  };

  const handleEditLater = () => {
    // Allow user to edit the transaction later
    // Transaction remains in its current state
    onClose();
  };

  const renderSuggestionItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleCategorySelect(item)}
    >
      <Text style={styles.suggestionIcon}>{item.icon}</Text>
      <Text style={styles.suggestionText}>{item.name}</Text>
    </TouchableOpacity>
  );

  if (!transaction) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={handleDismiss}
        />
        
        <Animated.View 
          style={[
            styles.popup,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Categorize Transaction</Text>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.transactionInfo}>
            <Text style={styles.amount}>
              {transaction.currency} {transaction.amount.toFixed(2)}
            </Text>
            <Text style={styles.transactionDescription}>
              {transaction.description}
            </Text>
            <Text style={styles.timestamp}>
              {new Date(transaction.timestamp).toLocaleString()}
            </Text>
          </View>
          
          {suggestedCategories.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Suggested Categories</Text>
              <FlatList
                data={suggestedCategories}
                renderItem={renderSuggestionItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.suggestionsList}
              />
            </View>
          )}
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryInputRow}>
              <TextInput
                style={styles.textInput}
                value={categoryInput}
                onChangeText={setCategoryInput}
                placeholder="Enter category name"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  isListening && styles.voiceButtonActive
                ]}
                onPress={isListening ? stopListening : startListening}
              >
                <Text style={styles.voiceButtonText}>
                  {isListening ? '🔴' : '🎤'}
                </Text>
              </TouchableOpacity>
            </View>
            {voiceResult && (
              <Text style={styles.voiceResult}>
                Voice: "{voiceResult}"
              </Text>
            )}
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Add custom description"
              placeholderTextColor="#999"
              multiline
            />
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.editLaterButton}
              onPress={handleEditLater}
            >
              <Text style={styles.editLaterButtonText}>Edit Later</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissButtonText}>Skip</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  popup: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: height * 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  transactionInfo: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  transactionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
  },
  suggestionsContainer: {
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  suggestionsList: {
    flexGrow: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  suggestionText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFF',
  },
  voiceButton: {
    marginLeft: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  voiceButtonActive: {
    backgroundColor: '#FFE0E0',
  },
  voiceButtonText: {
    fontSize: 20,
  },
  voiceResult: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  editLaterButton: {
    flex: 1,
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 5,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  editLaterButtonText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '500',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  dismissButtonText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6B73FF',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 5,
  },
  saveButtonText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
});

export default CategorizationPopup;