import { Transaction, Category } from '@shared/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CategorySuggestion {
  category: string;
  confidence: number;
  reason: string;
}

export interface CategoryLearningData {
  userId: string;
  categoryMappings: Record<string, string[]>; // category -> keywords
  transactionPatterns: Record<string, string>; // description pattern -> category
  lastUpdated: Date;
}

class CategorizationService {
  private static instance: CategorizationService;
  private learningData: CategoryLearningData | null = null;
  private readonly STORAGE_KEY = 'category_learning_data';

  static getInstance(): CategorizationService {
    if (!CategorizationService.instance) {
      CategorizationService.instance = new CategorizationService();
    }
    return CategorizationService.instance;
  }

  async loadLearningData(userId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEY}_${userId}`);
      if (stored) {
        this.learningData = JSON.parse(stored);
      } else {
        this.learningData = {
          userId,
          categoryMappings: {},
          transactionPatterns: {},
          lastUpdated: new Date(),
        };
      }
    } catch (error) {
      console.error('Error loading learning data:', error);
      this.learningData = {
        userId,
        categoryMappings: {},
        transactionPatterns: {},
        lastUpdated: new Date(),
      };
    }
  }

  async saveLearningData(): Promise<void> {
    if (!this.learningData) return;
    
    try {
      this.learningData.lastUpdated = new Date();
      await AsyncStorage.setItem(
        `${this.STORAGE_KEY}_${this.learningData.userId}`,
        JSON.stringify(this.learningData)
      );
    } catch (error) {
      console.error('Error saving learning data:', error);
    }
  }

  generateSuggestions(
    transaction: Transaction,
    availableCategories: Category[],
    historicalTransactions: Transaction[]
  ): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];
    
    // 1. Keyword-based suggestions
    const keywordSuggestions = this.getKeywordBasedSuggestions(
      transaction,
      availableCategories
    );
    suggestions.push(...keywordSuggestions);
    
    // 2. Amount-based suggestions
    const amountSuggestions = this.getAmountBasedSuggestions(
      transaction,
      historicalTransactions,
      availableCategories
    );
    suggestions.push(...amountSuggestions);
    
    // 3. Pattern-based suggestions from learning data
    const patternSuggestions = this.getPatternBasedSuggestions(
      transaction,
      availableCategories
    );
    suggestions.push(...patternSuggestions);
    
    // 4. Time-based suggestions (recurring transactions)
    const timeSuggestions = this.getTimeBasedSuggestions(
      transaction,
      historicalTransactions,
      availableCategories
    );
    suggestions.push(...timeSuggestions);
    
    // Remove duplicates and sort by confidence
    const uniqueSuggestions = this.deduplicateAndSort(suggestions);
    
    return uniqueSuggestions.slice(0, 5); // Return top 5 suggestions
  }

  private getKeywordBasedSuggestions(
    transaction: Transaction,
    categories: Category[]
  ): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];
    const description = transaction.description.toLowerCase();
    const words = description.split(/\s+/);
    
    // Common keyword mappings
    const keywordMappings: Record<string, string[]> = {
      'Food & Dining': ['restaurant', 'food', 'cafe', 'pizza', 'burger', 'lunch', 'dinner', 'breakfast', 'eat', 'meal'],
      'Transportation': ['uber', 'taxi', 'bus', 'train', 'fuel', 'gas', 'parking', 'transport', 'matatu'],
      'Shopping': ['shop', 'store', 'mall', 'buy', 'purchase', 'retail', 'market'],
      'Utilities': ['electricity', 'water', 'internet', 'phone', 'bill', 'kplc', 'safaricom'],
      'Entertainment': ['movie', 'cinema', 'game', 'music', 'netflix', 'entertainment'],
      'Healthcare': ['hospital', 'doctor', 'pharmacy', 'medical', 'health', 'clinic'],
      'Education': ['school', 'university', 'course', 'book', 'education', 'tuition'],
      'Savings': ['save', 'investment', 'deposit', 'nabo', 'capital'],
    };
    
    // Check against keyword mappings
    for (const [category, keywords] of Object.entries(keywordMappings)) {
      const matchCount = keywords.filter(keyword => 
        words.some(word => word.includes(keyword) || keyword.includes(word))
      ).length;
      
      if (matchCount > 0) {
        const confidence = Math.min(0.9, matchCount * 0.3);
        suggestions.push({
          category,
          confidence,
          reason: `Matched keywords: ${keywords.filter(k => 
            words.some(w => w.includes(k) || k.includes(w))
          ).join(', ')}`
        });
      }
    }
    
    // Check against existing categories
    categories.forEach(cat => {
      const categoryWords = cat.name.toLowerCase().split(/\s+/);
      const matchCount = categoryWords.filter(catWord =>
        words.some(word => word.includes(catWord) || catWord.includes(word))
      ).length;
      
      if (matchCount > 0) {
        const confidence = Math.min(0.8, matchCount * 0.4);
        suggestions.push({
          category: cat.name,
          confidence,
          reason: `Category name match`
        });
      }
    });
    
    return suggestions;
  }

  private getAmountBasedSuggestions(
    transaction: Transaction,
    historicalTransactions: Transaction[],
    categories: Category[]
  ): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];
    const amount = transaction.amount;
    const tolerance = amount * 0.15; // 15% tolerance
    
    // Find transactions with similar amounts
    const similarAmountTransactions = historicalTransactions.filter(t =>
      Math.abs(t.amount - amount) <= tolerance &&
      t.category !== 'Uncategorized'
    );
    
    // Count category occurrences
    const categoryCount: Record<string, number> = {};
    similarAmountTransactions.forEach(t => {
      categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
    });
    
    // Generate suggestions based on frequency
    Object.entries(categoryCount).forEach(([category, count]) => {
      const confidence = Math.min(0.7, count / similarAmountTransactions.length);
      if (confidence > 0.2) {
        suggestions.push({
          category,
          confidence,
          reason: `Similar amount (${count} transactions)`
        });
      }
    });
    
    return suggestions;
  }

  private getPatternBasedSuggestions(
    transaction: Transaction,
    categories: Category[]
  ): CategorySuggestion[] {
    if (!this.learningData) return [];
    
    const suggestions: CategorySuggestion[] = [];
    const description = transaction.description.toLowerCase();
    
    // Check learned patterns
    Object.entries(this.learningData.transactionPatterns).forEach(([pattern, category]) => {
      if (description.includes(pattern.toLowerCase())) {
        suggestions.push({
          category,
          confidence: 0.8,
          reason: 'Learned from previous categorizations'
        });
      }
    });
    
    // Check learned keyword mappings
    Object.entries(this.learningData.categoryMappings).forEach(([category, keywords]) => {
      const matchCount = keywords.filter(keyword =>
        description.includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        const confidence = Math.min(0.75, matchCount * 0.25);
        suggestions.push({
          category,
          confidence,
          reason: `Learned keywords: ${keywords.slice(0, 3).join(', ')}`
        });
      }
    });
    
    return suggestions;
  }

  private getTimeBasedSuggestions(
    transaction: Transaction,
    historicalTransactions: Transaction[],
    categories: Category[]
  ): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];
    const transactionDate = new Date(transaction.timestamp);
    const dayOfMonth = transactionDate.getDate();
    const dayOfWeek = transactionDate.getDay();
    
    // Find transactions on similar dates (recurring monthly)
    const monthlyRecurring = historicalTransactions.filter(t => {
      const tDate = new Date(t.timestamp);
      return Math.abs(tDate.getDate() - dayOfMonth) <= 2 &&
             t.category !== 'Uncategorized';
    });
    
    // Find transactions on similar day of week
    const weeklyRecurring = historicalTransactions.filter(t => {
      const tDate = new Date(t.timestamp);
      return tDate.getDay() === dayOfWeek &&
             t.category !== 'Uncategorized';
    });
    
    // Process monthly recurring
    const monthlyCategoryCount: Record<string, number> = {};
    monthlyRecurring.forEach(t => {
      monthlyCategoryCount[t.category] = (monthlyCategoryCount[t.category] || 0) + 1;
    });
    
    Object.entries(monthlyCategoryCount).forEach(([category, count]) => {
      if (count >= 2) {
        suggestions.push({
          category,
          confidence: Math.min(0.6, count * 0.2),
          reason: `Recurring monthly transaction`
        });
      }
    });
    
    // Process weekly recurring
    const weeklyCategoryCount: Record<string, number> = {};
    weeklyRecurring.forEach(t => {
      weeklyCategoryCount[t.category] = (weeklyCategoryCount[t.category] || 0) + 1;
    });
    
    Object.entries(weeklyCategoryCount).forEach(([category, count]) => {
      if (count >= 3) {
        suggestions.push({
          category,
          confidence: Math.min(0.5, count * 0.15),
          reason: `Recurring weekly transaction`
        });
      }
    });
    
    return suggestions;
  }

  private deduplicateAndSort(suggestions: CategorySuggestion[]): CategorySuggestion[] {
    const categoryMap = new Map<string, CategorySuggestion>();
    
    suggestions.forEach(suggestion => {
      const existing = categoryMap.get(suggestion.category);
      if (!existing || suggestion.confidence > existing.confidence) {
        categoryMap.set(suggestion.category, suggestion);
      }
    });
    
    return Array.from(categoryMap.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  async learnFromCategorization(
    transaction: Transaction,
    category: string,
    customDescription?: string
  ): Promise<void> {
    if (!this.learningData) return;
    
    const description = (customDescription || transaction.description).toLowerCase();
    const words = description.split(/\s+/).filter(word => word.length > 2);
    
    // Update category mappings with keywords
    if (!this.learningData.categoryMappings[category]) {
      this.learningData.categoryMappings[category] = [];
    }
    
    words.forEach(word => {
      if (!this.learningData!.categoryMappings[category].includes(word)) {
        this.learningData!.categoryMappings[category].push(word);
      }
    });
    
    // Limit keywords per category to prevent bloat
    if (this.learningData.categoryMappings[category].length > 20) {
      this.learningData.categoryMappings[category] = 
        this.learningData.categoryMappings[category].slice(-20);
    }
    
    // Store transaction pattern
    const pattern = this.extractPattern(description);
    if (pattern) {
      this.learningData.transactionPatterns[pattern] = category;
    }
    
    await this.saveLearningData();
  }

  private extractPattern(description: string): string | null {
    // Extract meaningful patterns from transaction descriptions
    const words = description.split(/\s+/);
    
    // Look for merchant names (usually first few words)
    if (words.length >= 2) {
      const potentialMerchant = words.slice(0, 2).join(' ');
      if (potentialMerchant.length >= 5) {
        return potentialMerchant;
      }
    }
    
    // Look for specific patterns like "Payment to X"
    const paymentMatch = description.match(/payment to (.+)/i);
    if (paymentMatch) {
      return paymentMatch[1].trim();
    }
    
    // Look for "From X" patterns
    const fromMatch = description.match(/from (.+)/i);
    if (fromMatch) {
      return fromMatch[1].trim();
    }
    
    return null;
  }

  async getBulkCategorizationSuggestions(
    transactions: Transaction[],
    targetCategory: string
  ): Promise<Transaction[]> {
    if (!this.learningData) return [];
    
    const suggestions: Transaction[] = [];
    const categoryKeywords = this.learningData.categoryMappings[targetCategory] || [];
    const categoryPatterns = Object.entries(this.learningData.transactionPatterns)
      .filter(([_, cat]) => cat === targetCategory)
      .map(([pattern, _]) => pattern);
    
    transactions.forEach(transaction => {
      if (transaction.category === 'Uncategorized') {
        const description = transaction.description.toLowerCase();
        
        // Check against keywords
        const keywordMatch = categoryKeywords.some(keyword =>
          description.includes(keyword)
        );
        
        // Check against patterns
        const patternMatch = categoryPatterns.some(pattern =>
          description.includes(pattern.toLowerCase())
        );
        
        if (keywordMatch || patternMatch) {
          suggestions.push(transaction);
        }
      }
    });
    
    return suggestions;
  }

  async clearLearningData(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.STORAGE_KEY}_${userId}`);
      this.learningData = null;
    } catch (error) {
      console.error('Error clearing learning data:', error);
    }
  }
}

export default CategorizationService;