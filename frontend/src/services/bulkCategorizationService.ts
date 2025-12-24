import { Transaction, Category } from '@shared/types';
import CategorizationService from './categorizationService';

export interface BulkCategorizationSuggestion {
  transactions: Transaction[];
  suggestedCategory: string;
  confidence: number;
  reason: string;
}

export interface BulkCategorizationOptions {
  minSimilarity: number;
  maxSuggestions: number;
  includeAmountSimilarity: boolean;
  includeDescriptionSimilarity: boolean;
  includeTimingSimilarity: boolean;
}

class BulkCategorizationService {
  private static instance: BulkCategorizationService;
  private categorizationService: CategorizationService;

  constructor() {
    this.categorizationService = CategorizationService.getInstance();
  }

  static getInstance(): BulkCategorizationService {
    if (!BulkCategorizationService.instance) {
      BulkCategorizationService.instance = new BulkCategorizationService();
    }
    return BulkCategorizationService.instance;
  }

  /**
   * Find transactions similar to a given transaction for bulk categorization
   */
  findSimilarTransactions(
    targetTransaction: Transaction,
    allTransactions: Transaction[],
    options: Partial<BulkCategorizationOptions> = {}
  ): Transaction[] {
    const {
      minSimilarity = 0.6,
      includeAmountSimilarity = true,
      includeDescriptionSimilarity = true,
      includeTimingSimilarity = false,
    } = options;

    const similarTransactions: Array<{ transaction: Transaction; similarity: number }> = [];

    allTransactions.forEach(transaction => {
      if (transaction.id === targetTransaction.id) return;
      if (transaction.category !== 'Uncategorized') return; // Only suggest uncategorized transactions

      let similarity = 0;
      let factors = 0;

      // Amount similarity
      if (includeAmountSimilarity) {
        const amountDiff = Math.abs(transaction.amount - targetTransaction.amount);
        const maxAmount = Math.max(transaction.amount, targetTransaction.amount);
        const amountSimilarity = 1 - (amountDiff / maxAmount);
        similarity += amountSimilarity * 0.4; // 40% weight
        factors++;
      }

      // Description similarity
      if (includeDescriptionSimilarity) {
        const descSimilarity = this.calculateDescriptionSimilarity(
          transaction.description,
          targetTransaction.description
        );
        similarity += descSimilarity * 0.5; // 50% weight
        factors++;
      }

      // Timing similarity (same day of month, day of week, etc.)
      if (includeTimingSimilarity) {
        const timingSimilarity = this.calculateTimingSimilarity(
          transaction.timestamp,
          targetTransaction.timestamp
        );
        similarity += timingSimilarity * 0.1; // 10% weight
        factors++;
      }

      if (factors > 0) {
        similarity = similarity / factors;
        if (similarity >= minSimilarity) {
          similarTransactions.push({ transaction, similarity });
        }
      }
    });

    // Sort by similarity and return transactions
    return similarTransactions
      .sort((a, b) => b.similarity - a.similarity)
      .map(item => item.transaction);
  }

  /**
   * Generate bulk categorization suggestions based on recently categorized transactions
   */
  generateBulkSuggestions(
    recentlyCategorizeds: Transaction[],
    allTransactions: Transaction[],
    options: Partial<BulkCategorizationOptions> = {}
  ): BulkCategorizationSuggestion[] {
    const { maxSuggestions = 5 } = options;
    const suggestions: BulkCategorizationSuggestion[] = [];

    // Group recently categorized transactions by category
    const categoryGroups = new Map<string, Transaction[]>();
    recentlyCategorizeds.forEach(transaction => {
      if (transaction.category === 'Uncategorized') return;
      
      if (!categoryGroups.has(transaction.category)) {
        categoryGroups.set(transaction.category, []);
      }
      categoryGroups.get(transaction.category)!.push(transaction);
    });

    // For each category, find similar uncategorized transactions
    categoryGroups.forEach((transactions, category) => {
      const allSimilar = new Set<Transaction>();
      
      transactions.forEach(categorizedTransaction => {
        const similar = this.findSimilarTransactions(
          categorizedTransaction,
          allTransactions,
          options
        );
        similar.forEach(t => allSimilar.add(t));
      });

      if (allSimilar.size > 0) {
        const confidence = Math.min(0.9, transactions.length * 0.2 + allSimilar.size * 0.1);
        suggestions.push({
          transactions: Array.from(allSimilar),
          suggestedCategory: category,
          confidence,
          reason: `Similar to ${transactions.length} recently categorized transactions`,
        });
      }
    });

    // Sort by confidence and limit results
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);
  }

  /**
   * Apply bulk categorization to multiple transactions
   */
  async applyBulkCategorization(
    transactions: Transaction[],
    category: string,
    userId: string
  ): Promise<{ success: Transaction[]; failed: Transaction[] }> {
    const success: Transaction[] = [];
    const failed: Transaction[] = [];

    for (const transaction of transactions) {
      try {
        // Learn from each categorization
        await this.categorizationService.learnFromCategorization(
          transaction,
          category
        );
        success.push(transaction);
      } catch (error) {
        console.error(`Failed to categorize transaction ${transaction.id}:`, error);
        failed.push(transaction);
      }
    }

    return { success, failed };
  }

  /**
   * Find transactions that could benefit from bulk categorization
   */
  findBulkCategorizationOpportunities(
    transactions: Transaction[],
    categories: Category[]
  ): BulkCategorizationSuggestion[] {
    const opportunities: BulkCategorizationSuggestion[] = [];
    const uncategorized = transactions.filter(t => t.category === 'Uncategorized');
    
    if (uncategorized.length < 2) return opportunities;

    // Group uncategorized transactions by similarity
    const similarityGroups = this.groupTransactionsBySimilarity(uncategorized);
    
    similarityGroups.forEach(group => {
      if (group.length >= 2) {
        // Try to suggest a category based on the group
        const suggestedCategory = this.suggestCategoryForGroup(group, transactions, categories);
        
        if (suggestedCategory) {
          opportunities.push({
            transactions: group,
            suggestedCategory: suggestedCategory.name,
            confidence: 0.7,
            reason: `${group.length} similar transactions found`,
          });
        }
      }
    });

    return opportunities.sort((a, b) => b.transactions.length - a.transactions.length);
  }

  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    const words1 = desc1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = desc2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  private calculateTimingSimilarity(date1: Date, date2: Date): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    let similarity = 0;
    let factors = 0;
    
    // Same day of month
    if (d1.getDate() === d2.getDate()) {
      similarity += 0.4;
    }
    factors++;
    
    // Same day of week
    if (d1.getDay() === d2.getDay()) {
      similarity += 0.3;
    }
    factors++;
    
    // Similar time of day (within 2 hours)
    const hourDiff = Math.abs(d1.getHours() - d2.getHours());
    if (hourDiff <= 2) {
      similarity += 0.3;
    }
    factors++;
    
    return similarity / factors;
  }

  private groupTransactionsBySimilarity(transactions: Transaction[]): Transaction[][] {
    const groups: Transaction[][] = [];
    const processed = new Set<string>();
    
    transactions.forEach(transaction => {
      if (processed.has(transaction.id)) return;
      
      const group = [transaction];
      processed.add(transaction.id);
      
      // Find similar transactions
      transactions.forEach(other => {
        if (processed.has(other.id)) return;
        
        const similarity = this.calculateDescriptionSimilarity(
          transaction.description,
          other.description
        );
        
        if (similarity > 0.6) {
          group.push(other);
          processed.add(other.id);
        }
      });
      
      if (group.length > 1) {
        groups.push(group);
      }
    });
    
    return groups;
  }

  private suggestCategoryForGroup(
    group: Transaction[],
    allTransactions: Transaction[],
    categories: Category[]
  ): Category | null {
    // Look for patterns in the group
    const descriptions = group.map(t => t.description.toLowerCase());
    const commonWords = this.findCommonWords(descriptions);
    
    // Try to match against existing categories
    for (const category of categories) {
      const categoryWords = category.name.toLowerCase().split(/\s+/);
      const hasMatch = categoryWords.some(word => 
        commonWords.some(common => common.includes(word) || word.includes(common))
      );
      
      if (hasMatch) {
        return category;
      }
    }
    
    // Look at historical transactions with similar descriptions
    const historicalMatches = allTransactions.filter(t => 
      t.category !== 'Uncategorized' &&
      commonWords.some(word => t.description.toLowerCase().includes(word))
    );
    
    if (historicalMatches.length > 0) {
      // Find most common category
      const categoryCount = new Map<string, number>();
      historicalMatches.forEach(t => {
        categoryCount.set(t.category, (categoryCount.get(t.category) || 0) + 1);
      });
      
      const mostCommon = Array.from(categoryCount.entries())
        .sort((a, b) => b[1] - a[1])[0];
      
      const category = categories.find(c => c.name === mostCommon[0]);
      if (category) return category;
    }
    
    return null;
  }

  private findCommonWords(descriptions: string[]): string[] {
    const wordCounts = new Map<string, number>();
    
    descriptions.forEach(desc => {
      const words = desc.split(/\s+/).filter(w => w.length > 2);
      words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      });
    });
    
    const threshold = Math.ceil(descriptions.length * 0.5); // At least 50% of descriptions
    return Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([word, _]) => word);
  }
}

export default BulkCategorizationService;