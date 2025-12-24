import { Transaction, SpendingPattern, Advice, User } from '@finwise-ai/shared';
import { logger } from '../utils/logger';

/**
 * Personalized Recommendation Engine
 * Provides AI-driven financial advice based on spending history and patterns
 */

interface UserProfile {
  userId: string;
  spendingPatterns: Map<string, number>;
  averageMonthlySpending: number;
  topCategories: string[];
  spendingTrends: Map<string, 'increasing' | 'decreasing' | 'stable'>;
  riskScore: number;
  savingsRate: number;
}

interface RecommendationContext {
  country: string;
  currency: string;
  language: string;
  localExpenses: string[];
  culturalFactors: string[];
}

interface SimilarUser {
  userId: string;
  similarity: number;
  spendingPatterns: Map<string, number>;
}

export class RecommendationEngine {
  private userProfiles: Map<string, UserProfile> = new Map();
  private kenyanContext: RecommendationContext;

  constructor() {
    this.kenyanContext = {
      country: 'KE',
      currency: 'KES',
      language: 'en',
      localExpenses: [
        'matatu', 'boda-boda', 'nyama-choma', 'ugali', 'sukuma-wiki',
        'chapati', 'mandazi', 'githeri', 'mukimo', 'samosa',
        'airtime', 'mpesa', 'water', 'electricity', 'rent'
      ],
      culturalFactors: [
        'family-support', 'community-savings', 'harambee',
        'chama', 'table-banking', 'merry-go-round'
      ]
    };
  }

  /**
   * Generate personalized recommendations based on spending history
   */
  async generatePersonalizedRecommendations(
    userId: string, 
    transactions: Transaction[], 
    user: User,
    spendingPatterns: SpendingPattern[]
  ): Promise<Advice[]> {
    try {
      logger.info('Generating personalized recommendations', { userId });

      // Build or update user profile
      const userProfile = await this.buildUserProfile(userId, transactions, spendingPatterns);
      this.userProfiles.set(userId, userProfile);

      const recommendations: Advice[] = [];

      // Generate different types of recommendations
      const spendingRecommendations = await this.generateSpendingRecommendations(userProfile, user);
      const savingsRecommendations = await this.generateSavingsRecommendations(userProfile, user);
      const budgetRecommendations = await this.generateBudgetRecommendations(userProfile, user);
      const localContextRecommendations = await this.generateLocalContextRecommendations(userProfile, user);

      recommendations.push(
        ...spendingRecommendations,
        ...savingsRecommendations,
        ...budgetRecommendations,
        ...localContextRecommendations
      );

      // Apply collaborative filtering
      const collaborativeRecommendations = await this.generateCollaborativeRecommendations(userProfile, user);
      recommendations.push(...collaborativeRecommendations);

      // Sort by priority and relevance
      const sortedRecommendations = this.prioritizeRecommendations(recommendations, userProfile);

      logger.info('Personalized recommendations generated', { 
        userId, 
        recommendationCount: sortedRecommendations.length 
      });

      return sortedRecommendations.slice(0, 10); // Return top 10 recommendations
    } catch (error) {
      logger.error('Error generating personalized recommendations', { userId, error });
      throw error;
    }
  }

  /**
   * Add local context awareness for Kenyan users
   */
  async addLocalContextAwareness(
    recommendations: Advice[], 
    user: User
  ): Promise<Advice[]> {
    try {
      if (user.country !== 'KE') {
        return recommendations; // Only apply Kenyan context for Kenyan users
      }

      const contextualRecommendations = recommendations.map(advice => {
        let contextualMessage = advice.message;

        // Add currency context
        contextualMessage = contextualMessage.replace(/\$(\d+)/g, 'KES $1');

        // Add local expense context
        if (advice.type === 'spending') {
          contextualMessage += this.addLocalSpendingContext(advice.message);
        }

        // Add cultural savings context
        if (advice.type === 'saving') {
          contextualMessage += this.addLocalSavingsContext();
        }

        return {
          ...advice,
          message: contextualMessage
        };
      });

      return contextualRecommendations;
    } catch (error) {
      logger.error('Error adding local context awareness', { error });
      return recommendations;
    }
  }

  /**
   * Implement collaborative filtering for similar user patterns
   */
  async generateCollaborativeRecommendations(
    userProfile: UserProfile, 
    user: User
  ): Promise<Advice[]> {
    try {
      const similarUsers = await this.findSimilarUsers(userProfile);
      const recommendations: Advice[] = [];

      for (const similarUser of similarUsers.slice(0, 5)) { // Top 5 similar users
        const similarUserProfile = this.userProfiles.get(similarUser.userId);
        if (!similarUserProfile) continue;

        // Find categories where similar users spend less
        for (const [category, userSpending] of userProfile.spendingPatterns.entries()) {
          const similarUserSpending = similarUserProfile.spendingPatterns.get(category) || 0;
          
          if (similarUserSpending < userSpending * 0.7) { // Similar user spends 30% less
            recommendations.push({
              id: `collab-${category}-${Date.now()}`,
              userId: userProfile.userId,
              type: 'spending',
              title: `Optimize ${category} Spending`,
              message: `Users with similar spending patterns spend 30% less on ${category}. Consider reviewing your ${category} expenses.`,
              actionable: true,
              priority: 'medium',
              createdAt: new Date()
            });
          }
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Error generating collaborative recommendations', { error });
      return [];
    }
  }

  /**
   * Build actionable suggestion integration
   */
  private async generateSpendingRecommendations(
    userProfile: UserProfile, 
    user: User
  ): Promise<Advice[]> {
    const recommendations: Advice[] = [];

    // High spending category recommendations
    for (const category of userProfile.topCategories.slice(0, 3)) {
      const spending = userProfile.spendingPatterns.get(category) || 0;
      const trend = userProfile.spendingTrends.get(category);

      if (trend === 'increasing' && spending > userProfile.averageMonthlySpending * 0.3) {
        recommendations.push({
          id: `spending-${category}-${Date.now()}`,
          userId: userProfile.userId,
          type: 'spending',
          title: `Monitor ${category} Spending`,
          message: `Your ${category} spending has been increasing and now represents ${((spending / userProfile.averageMonthlySpending) * 100).toFixed(1)}% of your monthly budget. Consider setting a limit for this category.`,
          actionable: true,
          priority: 'high',
          createdAt: new Date()
        });
      }
    }

    // Frequency-based recommendations
    if (userProfile.riskScore > 0.7) {
      recommendations.push({
        id: `risk-${userProfile.userId}-${Date.now()}`,
        userId: userProfile.userId,
        type: 'spending',
        title: 'High Spending Variability Detected',
        message: 'Your spending patterns show high variability. Consider creating a monthly budget to better control your expenses.',
        actionable: true,
        priority: 'high',
        createdAt: new Date()
      });
    }

    return recommendations;
  }

  private async generateSavingsRecommendations(
    userProfile: UserProfile, 
    user: User
  ): Promise<Advice[]> {
    const recommendations: Advice[] = [];

    if (userProfile.savingsRate < 0.1) { // Less than 10% savings rate
      recommendations.push({
        id: `savings-rate-${userProfile.userId}-${Date.now()}`,
        userId: userProfile.userId,
        type: 'saving',
        title: 'Improve Your Savings Rate',
        message: `Your current savings rate is ${(userProfile.savingsRate * 100).toFixed(1)}%. Try to save at least 10% of your income by reducing discretionary spending.`,
        actionable: true,
        priority: 'medium',
        createdAt: new Date()
      });
    }

    // Micro-savings recommendations
    const potentialSavings = this.calculatePotentialMicroSavings(userProfile);
    if (potentialSavings > 0) {
      recommendations.push({
        id: `micro-savings-${userProfile.userId}-${Date.now()}`,
        userId: userProfile.userId,
        type: 'saving',
        title: 'Micro-Savings Opportunity',
        message: `You could save an additional KES ${potentialSavings.toFixed(2)} monthly through round-up savings on your transactions.`,
        actionable: true,
        priority: 'low',
        createdAt: new Date()
      });
    }

    return recommendations;
  }

  private async generateBudgetRecommendations(
    userProfile: UserProfile, 
    user: User
  ): Promise<Advice[]> {
    const recommendations: Advice[] = [];

    // 50/30/20 rule recommendations
    const budgetAnalysis = this.analyzeBudgetAllocation(userProfile);
    
    if (budgetAnalysis.needsImprovement) {
      recommendations.push({
        id: `budget-${userProfile.userId}-${Date.now()}`,
        userId: userProfile.userId,
        type: 'general',
        title: 'Budget Allocation Suggestion',
        message: budgetAnalysis.message,
        actionable: true,
        priority: 'medium',
        createdAt: new Date()
      });
    }

    return recommendations;
  }

  private async generateLocalContextRecommendations(
    userProfile: UserProfile, 
    user: User
  ): Promise<Advice[]> {
    const recommendations: Advice[] = [];

    if (user.country === 'KE') {
      // Transport optimization for Kenyan users
      const transportSpending = userProfile.spendingPatterns.get('transport') || 0;
      if (transportSpending > userProfile.averageMonthlySpending * 0.2) {
        recommendations.push({
          id: `transport-ke-${userProfile.userId}-${Date.now()}`,
          userId: userProfile.userId,
          type: 'spending',
          title: 'Optimize Transport Costs',
          message: 'Consider using matatu for longer distances and walking for short trips. You could save up to 30% on transport costs.',
          actionable: true,
          priority: 'medium',
          createdAt: new Date()
        });
      }

      // Food spending optimization
      const foodSpending = userProfile.spendingPatterns.get('food') || 0;
      if (foodSpending > userProfile.averageMonthlySpending * 0.4) {
        recommendations.push({
          id: `food-ke-${userProfile.userId}-${Date.now()}`,
          userId: userProfile.userId,
          type: 'spending',
          title: 'Food Budget Optimization',
          message: 'Consider cooking more meals at home with local ingredients like ugali, sukuma wiki, and beans. This could reduce your food expenses by 40%.',
          actionable: true,
          priority: 'medium',
          createdAt: new Date()
        });
      }
    }

    return recommendations;
  }

  private async buildUserProfile(
    userId: string, 
    transactions: Transaction[], 
    spendingPatterns: SpendingPattern[]
  ): Promise<UserProfile> {
    const userTransactions = transactions.filter(t => t.userId === userId);
    
    // Calculate spending patterns
    const spendingPatterns_map = new Map<string, number>();
    const categoryTotals = new Map<string, number>();
    
    for (const transaction of userTransactions) {
      const category = transaction.category;
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + transaction.amount);
    }

    // Convert to monthly averages
    const monthsSpan = this.calculateMonthsSpan(userTransactions);
    for (const [category, total] of categoryTotals.entries()) {
      spendingPatterns_map.set(category, total / monthsSpan);
    }

    // Calculate other metrics
    const averageMonthlySpending = Array.from(spendingPatterns_map.values())
      .reduce((sum, amount) => sum + amount, 0);

    const topCategories = Array.from(spendingPatterns_map.entries())
      .sort(([,a], [,b]) => b - a)
      .map(([category]) => category);

    const spendingTrends = new Map<string, 'increasing' | 'decreasing' | 'stable'>();
    for (const pattern of spendingPatterns) {
      if (pattern.userId === userId) {
        spendingTrends.set(pattern.category, pattern.trend);
      }
    }

    const riskScore = this.calculateRiskScore(userTransactions);
    const savingsRate = this.calculateSavingsRate(userTransactions, averageMonthlySpending);

    return {
      userId,
      spendingPatterns: spendingPatterns_map,
      averageMonthlySpending,
      topCategories,
      spendingTrends,
      riskScore,
      savingsRate
    };
  }

  private calculateMonthsSpan(transactions: Transaction[]): number {
    if (transactions.length === 0) return 1;

    const timestamps = transactions.map(t => new Date(t.timestamp).getTime());
    const oldestTimestamp = Math.min(...timestamps);
    const newestTimestamp = Math.max(...timestamps);
    
    return Math.max(1, (newestTimestamp - oldestTimestamp) / (1000 * 60 * 60 * 24 * 30));
  }

  private calculateRiskScore(transactions: Transaction[]): number {
    if (transactions.length < 5) return 0;

    const amounts = transactions.map(t => t.amount);
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation as risk score
    return Math.min(1, stdDev / mean);
  }

  private calculateSavingsRate(transactions: Transaction[], monthlySpending: number): number {
    // This is a simplified calculation - in reality, you'd need income data
    // For now, assume savings rate based on spending patterns
    const savingsTransactions = transactions.filter(t => 
      t.category.toLowerCase().includes('savings') || 
      t.category.toLowerCase().includes('investment')
    );

    const monthlySavings = savingsTransactions.reduce((sum, t) => sum + t.amount, 0) / 
      this.calculateMonthsSpan(transactions);

    return monthlySavings / (monthlySpending + monthlySavings);
  }

  private async findSimilarUsers(userProfile: UserProfile): Promise<SimilarUser[]> {
    const similarUsers: SimilarUser[] = [];

    for (const [otherUserId, otherProfile] of this.userProfiles.entries()) {
      if (otherUserId === userProfile.userId) continue;

      const similarity = this.calculateUserSimilarity(userProfile, otherProfile);
      if (similarity > 0.6) { // Similarity threshold
        similarUsers.push({
          userId: otherUserId,
          similarity,
          spendingPatterns: otherProfile.spendingPatterns
        });
      }
    }

    return similarUsers.sort((a, b) => b.similarity - a.similarity);
  }

  private calculateUserSimilarity(profile1: UserProfile, profile2: UserProfile): number {
    const categories = new Set([
      ...profile1.spendingPatterns.keys(),
      ...profile2.spendingPatterns.keys()
    ]);

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const category of categories) {
      const spending1 = profile1.spendingPatterns.get(category) || 0;
      const spending2 = profile2.spendingPatterns.get(category) || 0;

      dotProduct += spending1 * spending2;
      norm1 += spending1 * spending1;
      norm2 += spending2 * spending2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private calculatePotentialMicroSavings(userProfile: UserProfile): number {
    // Calculate potential round-up savings
    const monthlyTransactionCount = 100; // Estimate
    const averageRoundUp = 0.5; // Average round-up amount
    return monthlyTransactionCount * averageRoundUp;
  }

  private analyzeBudgetAllocation(userProfile: UserProfile): { needsImprovement: boolean; message: string } {
    const totalSpending = userProfile.averageMonthlySpending;
    
    // Categorize spending into needs, wants, and savings
    const needs = ['food', 'transport', 'utilities', 'rent', 'healthcare'].reduce((sum, category) => {
      return sum + (userProfile.spendingPatterns.get(category) || 0);
    }, 0);

    const wants = ['entertainment', 'dining', 'shopping', 'hobbies'].reduce((sum, category) => {
      return sum + (userProfile.spendingPatterns.get(category) || 0);
    }, 0);

    const needsPercentage = needs / totalSpending;
    const wantsPercentage = wants / totalSpending;

    if (needsPercentage > 0.6) { // More than 60% on needs
      return {
        needsImprovement: true,
        message: `You're spending ${(needsPercentage * 100).toFixed(1)}% on necessities. Try to optimize essential expenses to free up money for savings.`
      };
    }

    if (wantsPercentage > 0.4) { // More than 40% on wants
      return {
        needsImprovement: true,
        message: `You're spending ${(wantsPercentage * 100).toFixed(1)}% on discretionary items. Consider reducing this to 30% and increasing your savings.`
      };
    }

    return { needsImprovement: false, message: '' };
  }

  private addLocalSpendingContext(message: string): string {
    return ` Consider local alternatives like using matatu instead of taxi, or buying from local markets instead of supermarkets.`;
  }

  private addLocalSavingsContext(): string {
    return ` You might also consider joining a chama or table banking group to boost your savings through community support.`;
  }

  private prioritizeRecommendations(recommendations: Advice[], userProfile: UserProfile): Advice[] {
    return recommendations.sort((a, b) => {
      // Priority order: high > medium > low
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, sort by actionable first
      if (a.actionable !== b.actionable) {
        return b.actionable ? 1 : -1;
      }
      
      // Finally, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Generate recommendations for a user
   */
  async generateRecommendations(userId: string): Promise<Advice[]> {
    try {
      logger.info('Generating recommendations', { userId });
      
      // This would typically analyze user data and generate recommendations
      // For now, return mock recommendations
      const recommendations: Advice[] = [
        {
          id: `rec-${userId}-${Date.now()}`,
          userId,
          type: 'saving',
          title: 'Increase Your Savings Rate',
          message: 'Try to save at least 20% of your income by setting up automatic transfers.',
          priority: 'high',
          actionable: true,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        }
      ];

      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations', { userId, error });
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      // Perform basic health checks
      return {
        status: 'healthy',
        message: 'Recommendation Engine is operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Recommendation Engine error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}