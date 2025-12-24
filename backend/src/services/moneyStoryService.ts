import { MoneyStory, User, Transaction, SpendingPattern, SavingsGoal } from '@finwise-ai/shared';
import { logger } from '../utils/logger';

/**
 * Money Story Service
 * Creates engaging narratives about spending patterns using NLP and template-based generation
 */

export interface StoryContext {
  user: User;
  transactions: Transaction[];
  spendingPatterns: SpendingPattern[];
  savingsGoals: SavingsGoal[];
  period: 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
}

export interface StoryInsight {
  type: 'positive' | 'negative' | 'neutral' | 'achievement' | 'warning';
  category?: string;
  value: number;
  description: string;
  suggestion?: string;
}

export interface StoryTemplate {
  id: string;
  name: string;
  pattern: string;
  conditions: Array<{
    field: string;
    operator: 'gt' | 'lt' | 'eq' | 'contains';
    value: any;
  }>;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export class MoneyStoryService {
  private storyTemplates: StoryTemplate[] = [];

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate a money story for the given context
   */
  async generateMoneyStory(context: StoryContext): Promise<MoneyStory> {
    try {
      logger.info('Generating money story', { 
        userId: context.user.id, 
        period: context.period,
        transactionCount: context.transactions.length
      });

      // Analyze spending data to extract insights
      const insights = await this.extractInsights(context);
      
      // Generate narrative based on insights and templates
      const narrative = await this.generateNarrative(context, insights);
      
      // Create actionable suggestions
      const suggestions = await this.generateSuggestions(context, insights);
      
      // Determine overall sentiment
      const sentiment = this.calculateOverallSentiment(insights);

      const story: MoneyStory = {
        id: `story-${context.user.id}-${context.period}-${Date.now()}`,
        userId: context.user.id,
        period: context.period,
        title: this.generateTitle(context, sentiment),
        narrative,
        insights: insights.map(i => i.description),
        suggestions,
        sentiment,
        createdAt: new Date()
      };

      logger.info('Money story generated successfully', { 
        storyId: story.id,
        sentiment: story.sentiment,
        insightCount: insights.length
      });

      return story;
    } catch (error) {
      logger.error('Error generating money story', { userId: context.user.id, error });
      throw error;
    }
  }

  /**
   * Extract insights from spending data
   */
  private async extractInsights(context: StoryContext): Promise<StoryInsight[]> {
    const insights: StoryInsight[] = [];
    const { transactions, spendingPatterns, savingsGoals, user } = context;

    // Calculate spending totals by category
    const categorySpending = this.calculateCategorySpending(transactions);
    const totalSpending = Object.values(categorySpending).reduce((sum, amount) => sum + amount, 0);

    // Insight 1: Top spending category
    const topCategory = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topCategory && topCategory[1] > 0) {
      const percentage = (topCategory[1] / totalSpending) * 100;
      insights.push({
        type: percentage > 40 ? 'warning' : 'neutral',
        category: topCategory[0],
        value: topCategory[1],
        description: `Your biggest expense was ${topCategory[0]}, accounting for ${percentage.toFixed(1)}% of your spending`,
        suggestion: percentage > 40 ? `Consider reviewing your ${topCategory[0]} expenses to find potential savings` : undefined
      });
    }

    // Insight 2: Spending trends
    for (const pattern of spendingPatterns) {
      if (pattern.trend === 'decreasing') {
        insights.push({
          type: 'positive',
          category: pattern.category,
          value: pattern.averageMonthly,
          description: `Great job reducing your ${pattern.category} spending! You're trending downward`,
          suggestion: `Keep up the good work with your ${pattern.category} budget management`
        });
      } else if (pattern.trend === 'increasing' && pattern.confidence > 0.7) {
        insights.push({
          type: 'warning',
          category: pattern.category,
          value: pattern.averageMonthly,
          description: `Your ${pattern.category} spending has been increasing recently`,
          suggestion: `Consider setting a budget limit for ${pattern.category} to control spending`
        });
      }
    }

    // Insight 3: Savings goals progress
    for (const goal of savingsGoals.filter(g => g.isActive)) {
      const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
      
      if (progressPercentage >= 75) {
        insights.push({
          type: 'achievement',
          value: progressPercentage,
          description: `You're ${progressPercentage.toFixed(1)}% of the way to your "${goal.name}" goal!`,
          suggestion: `You're so close! Consider increasing your savings rate to reach your goal faster`
        });
      } else if (progressPercentage < 25) {
        const daysRemaining = Math.ceil((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 90) {
          insights.push({
            type: 'warning',
            value: progressPercentage,
            description: `Your "${goal.name}" goal needs attention - only ${progressPercentage.toFixed(1)}% complete with ${daysRemaining} days left`,
            suggestion: `Consider increasing your savings contributions or adjusting your goal timeline`
          });
        }
      }
    }

    // Insight 4: Unusual transactions
    const unusualTransactions = this.findUnusualTransactions(transactions, user);
    if (unusualTransactions.length > 0) {
      const largestUnusual = unusualTransactions.sort((a, b) => b.amount - a.amount)[0];
      insights.push({
        type: 'neutral',
        category: largestUnusual.category,
        value: largestUnusual.amount,
        description: `You had an unusually large ${largestUnusual.category} expense of ${user.currency} ${largestUnusual.amount.toLocaleString()}`,
        suggestion: `If this was a one-time expense, consider adjusting your budget for next period`
      });
    }

    // Insight 5: Spending frequency
    const dailyAverage = totalSpending / this.getDaysBetween(context.startDate, context.endDate);
    const transactionCount = transactions.length;
    
    if (transactionCount > 0) {
      insights.push({
        type: 'neutral',
        value: dailyAverage,
        description: `You averaged ${user.currency} ${dailyAverage.toFixed(2)} per day across ${transactionCount} transactions`,
        suggestion: transactionCount > 50 ? `Consider consolidating smaller purchases to reduce transaction fees` : undefined
      });
    }

    return insights;
  }

  /**
   * Generate narrative text based on insights and templates
   */
  private async generateNarrative(context: StoryContext, insights: StoryInsight[]): Promise<string> {
    const { user, period } = context;
    
    // Start with a personalized greeting
    let narrative = this.getPersonalizedGreeting(user, period);
    
    // Add main story content based on insights
    const positiveInsights = insights.filter(i => i.type === 'positive' || i.type === 'achievement');
    const warningInsights = insights.filter(i => i.type === 'warning');
    const neutralInsights = insights.filter(i => i.type === 'neutral');

    // Start with positive news if available
    if (positiveInsights.length > 0) {
      narrative += "\n\n" + this.generatePositiveSection(positiveInsights, user);
    }

    // Add main spending analysis
    if (neutralInsights.length > 0) {
      narrative += "\n\n" + this.generateAnalysisSection(neutralInsights, user);
    }

    // Address concerns if any
    if (warningInsights.length > 0) {
      narrative += "\n\n" + this.generateWarningSection(warningInsights, user);
    }

    // End with encouragement
    narrative += "\n\n" + this.generateEncouragement(context, insights);

    return narrative;
  }

  /**
   * Generate actionable suggestions
   */
  private async generateSuggestions(context: StoryContext, insights: StoryInsight[]): Promise<string[]> {
    const suggestions: string[] = [];
    const { transactions, user } = context;
    
    // Prioritize Kenyan-specific suggestions for KE users
    if (user.country === 'KE') {
      // Always add these Kenyan-specific suggestions first
      suggestions.push('Take advantage of M-Pesa savings features to automate your financial goals');
      suggestions.push('Consider exploring local investment opportunities like Nabo Capital for long-term growth');
      
      // Add more Kenyan-specific suggestions based on spending
      const categorySpending = this.calculateCategorySpending(transactions);
      if (categorySpending['Transport'] && categorySpending['Transport'] > 2000) {
        suggestions.push('Try using matatu savings apps to reduce your transport costs');
      }
    }

    // Suggest savings automation if no active goals (prioritize this suggestion)
    if (context.savingsGoals.filter(g => g.isActive).length === 0) {
      suggestions.push('Consider setting up a savings goal to build your financial future');
    }
    
    // Extract suggestions from insights (add after priority suggestions)
    insights.forEach(insight => {
      if (insight.suggestion && suggestions.length < 5) {
        suggestions.push(insight.suggestion);
      }
    });

    // Add general suggestions based on context if we still have room
    const categorySpending = this.calculateCategorySpending(transactions);
    
    // Suggest budget categories if spending is concentrated
    const topCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    if (topCategories.length > 0 && suggestions.length < 5) {
      suggestions.push(`Focus on budgeting for your top spending categories: ${topCategories.map(([cat]) => cat).join(', ')}`);
    }

    // Add general Kenyan financial advice if we need more suggestions and user is Kenyan
    if (user.country === 'KE' && suggestions.length < 5) {
      suggestions.push('Consider using mobile banking to track your shillings more effectively');
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Calculate overall sentiment based on insights
   */
  private calculateOverallSentiment(insights: StoryInsight[]): 'positive' | 'neutral' | 'negative' {
    const sentimentScores = {
      positive: insights.filter(i => i.type === 'positive' || i.type === 'achievement').length,
      negative: insights.filter(i => i.type === 'warning').length,
      neutral: insights.filter(i => i.type === 'neutral').length
    };

    if (sentimentScores.positive > sentimentScores.negative) {
      return 'positive';
    } else if (sentimentScores.negative > sentimentScores.positive) {
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  /**
   * Generate story title based on context and sentiment
   */
  private generateTitle(context: StoryContext, sentiment: 'positive' | 'neutral' | 'negative'): string {
    const { period } = context;
    const periodText = period === 'weekly' ? 'Week' : 'Month';
    
    const titles = {
      positive: [
        `Your ${periodText} of Financial Wins! 🎉`,
        `Great Progress This ${periodText}! 💪`,
        `${periodText}ly Financial Success Story 🌟`,
        `Crushing Your Financial Goals This ${periodText}! 🚀`
      ],
      neutral: [
        `Your ${periodText} in Review 📊`,
        `${periodText}ly Financial Snapshot 📈`,
        `This ${periodText}'s Money Story 💰`,
        `Your Financial Journey This ${periodText} 🗺️`
      ],
      negative: [
        `${periodText}ly Financial Check-In 🔍`,
        `Time to Refocus Your Finances 🎯`,
        `Your ${periodText} - Room for Improvement 📈`,
        `Financial Course Correction Needed 🧭`
      ]
    };

    const titleOptions = titles[sentiment];
    return titleOptions[Math.floor(Math.random() * titleOptions.length)];
  }

  /**
   * Helper methods for narrative generation
   */
  private getPersonalizedGreeting(user: User, period: 'weekly' | 'monthly'): string {
    const timeOfDay = new Date().getHours() < 12 ? 'morning' : 
                     new Date().getHours() < 18 ? 'afternoon' : 'evening';
    
    const greetings = [
      `Good ${timeOfDay}! Let's dive into your ${period} financial story.`,
      `Hello there! Here's what your money has been up to this ${period}.`,
      `Ready for your ${period} financial recap? Let's see how you did!`,
      `Time for your ${period} money story - grab a cup of coffee and let's explore!`
    ];

    // Add local context for Kenyan users
    if (user.country === 'KE') {
      greetings.push(`Habari! Let's see how your shillings performed this ${period}.`);
      greetings.push(`Mambo! Your ${period} financial journey in Kenya has been interesting.`);
    }

    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  private generatePositiveSection(insights: StoryInsight[], user: User): string {
    const achievements = insights.filter(i => i.type === 'achievement');
    const positives = insights.filter(i => i.type === 'positive');
    
    let section = "🎉 **Great News!** ";
    
    if (achievements.length > 0) {
      section += `You've made excellent progress on your financial goals! ${achievements[0].description} `;
    }
    
    if (positives.length > 0) {
      section += `Plus, ${positives[0].description.toLowerCase()}. `;
    }
    
    section += "Keep up the fantastic work!";
    
    return section;
  }

  private generateAnalysisSection(insights: StoryInsight[], user: User): string {
    const mainInsight = insights[0];
    let section = `📊 **Your Spending Breakdown:** ${mainInsight.description}. `;
    
    if (insights.length > 1) {
      section += `Additionally, ${insights[1].description.toLowerCase()}. `;
    }
    
    section += "Understanding these patterns helps you make better financial decisions.";
    
    return section;
  }

  private generateWarningSection(insights: StoryInsight[], user: User): string {
    const mainWarning = insights[0];
    let section = `⚠️ **Areas for Attention:** ${mainWarning.description}. `;
    
    if (mainWarning.suggestion) {
      section += `${mainWarning.suggestion}. `;
    }
    
    section += "Small adjustments now can lead to big improvements later!";
    
    return section;
  }

  private generateEncouragement(context: StoryContext, insights: StoryInsight[]): string {
    const { user } = context;
    const hasPositive = insights.some(i => i.type === 'positive' || i.type === 'achievement');
    
    const encouragements = [
      "Remember, every financial journey has ups and downs. You're building great habits!",
      "Your awareness of your spending patterns is the first step to financial success.",
      "Keep tracking, keep learning, and keep growing your financial confidence!",
      "Small, consistent steps lead to big financial wins. You've got this!"
    ];

    if (user.country === 'KE') {
      encouragements.push("Pole pole ndio mwendo - slow and steady wins the financial race!");
      encouragements.push("Your financial discipline today builds a stronger tomorrow for you and your family.");
    }

    if (hasPositive) {
      encouragements.push("You're already showing great financial discipline - keep it up!");
      encouragements.push("These positive trends show you're on the right track!");
    }

    return encouragements[Math.floor(Math.random() * encouragements.length)];
  }

  /**
   * Helper methods for data analysis
   */
  private calculateCategorySpending(transactions: Transaction[]): Record<string, number> {
    return transactions.reduce((acc, transaction) => {
      if (transaction.amount > 0) { // Only count expenses (positive amounts)
        acc[transaction.category] = (acc[transaction.category] || 0) + transaction.amount;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  private findUnusualTransactions(transactions: Transaction[], user: User): Transaction[] {
    // Simple heuristic: transactions that are more than 2x the average for their category
    const categoryAverages = this.calculateCategoryAverages(transactions);
    
    return transactions.filter(transaction => {
      const categoryAvg = categoryAverages[transaction.category];
      return categoryAvg && transaction.amount > categoryAvg * 2;
    });
  }

  private calculateCategoryAverages(transactions: Transaction[]): Record<string, number> {
    const categoryTotals: Record<string, { total: number; count: number }> = {};
    
    transactions.forEach(transaction => {
      if (transaction.amount > 0) {
        if (!categoryTotals[transaction.category]) {
          categoryTotals[transaction.category] = { total: 0, count: 0 };
        }
        categoryTotals[transaction.category].total += transaction.amount;
        categoryTotals[transaction.category].count += 1;
      }
    });

    return Object.entries(categoryTotals).reduce((acc, [category, data]) => {
      acc[category] = data.total / data.count;
      return acc;
    }, {} as Record<string, number>);
  }

  private getDaysBetween(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Initialize story templates for different scenarios
   */
  private initializeTemplates(): void {
    this.storyTemplates = [
      {
        id: 'high-spending-category',
        name: 'High Spending in Category',
        pattern: 'You spent {amount} on {category} this {period}, which is {percentage}% of your total spending.',
        conditions: [
          { field: 'categoryPercentage', operator: 'gt', value: 30 }
        ],
        sentiment: 'neutral'
      },
      {
        id: 'savings-progress',
        name: 'Savings Goal Progress',
        pattern: 'Great progress on your {goalName}! You\'re now {percentage}% of the way there.',
        conditions: [
          { field: 'goalProgress', operator: 'gt', value: 50 }
        ],
        sentiment: 'positive'
      },
      {
        id: 'spending-increase',
        name: 'Spending Increase Warning',
        pattern: 'Your {category} spending has increased by {percentage}% compared to last {period}.',
        conditions: [
          { field: 'spendingChange', operator: 'gt', value: 20 }
        ],
        sentiment: 'negative'
      },
      {
        id: 'budget-success',
        name: 'Budget Success',
        pattern: 'Excellent! You stayed within your {category} budget and even saved {amount}.',
        conditions: [
          { field: 'budgetVariance', operator: 'lt', value: 0 }
        ],
        sentiment: 'positive'
      }
    ];
  }

  /**
   * Get story templates for testing or customization
   */
  getStoryTemplates(): StoryTemplate[] {
    return [...this.storyTemplates];
  }

  /**
   * Add custom story template
   */
  addStoryTemplate(template: StoryTemplate): void {
    this.storyTemplates.push(template);
  }

  /**
   * Generate a story for a user
   */
  async generateStory(userId: string, period: 'weekly' | 'monthly'): Promise<MoneyStory> {
    try {
      logger.info('Generating money story', { userId, period });
      
      // Mock story generation - in real implementation, this would fetch user data
      const story: MoneyStory = {
        id: `story-${userId}-${period}-${Date.now()}`,
        userId,
        period,
        title: `Your ${period} Financial Journey`,
        narrative: `This ${period}, you've made great progress with your finances. Keep up the good work!`,
        insights: ['You saved 15% more than last month', 'Your spending on food decreased by 10%'],
        suggestions: ['Consider setting up automatic savings', 'Review your transport expenses'],
        sentiment: 'positive',
        createdAt: new Date()
      };

      return story;
    } catch (error) {
      logger.error('Error generating money story', { userId, error });
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      return {
        status: 'healthy',
        message: 'Money Story service is operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Money Story service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const moneyStoryService = new MoneyStoryService();