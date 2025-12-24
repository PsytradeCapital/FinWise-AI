import { Transaction, SpendingPattern, Anomaly, Advice, User, Notification } from '@finwise-ai/shared';
import { AnomalyDetectionService } from './anomalyDetectionService';
import { RecommendationEngine } from './recommendationEngine';
import { NotificationService } from './notificationService';
import { logger } from '../utils/logger';

/**
 * AI Advisor Service
 * Main service that orchestrates anomaly detection, recommendations, and notifications
 */

export class AIAdvisorService {
  private anomalyDetectionService: AnomalyDetectionService;
  private recommendationEngine: RecommendationEngine;
  private notificationService: NotificationService;

  constructor() {
    this.anomalyDetectionService = new AnomalyDetectionService();
    this.recommendationEngine = new RecommendationEngine();
    this.notificationService = new NotificationService();
  }

  /**
   * Comprehensive AI analysis for a user
   * Combines anomaly detection, pattern analysis, and personalized recommendations
   */
  async analyzeUserFinances(
    userId: string,
    transactions: Transaction[],
    user: User
  ): Promise<{
    anomalies: Anomaly[];
    spendingPatterns: SpendingPattern[];
    recommendations: Advice[];
    notifications: Notification[];
  }> {
    try {
      logger.info('Starting comprehensive AI financial analysis', { userId });

      // Step 1: Detect spending anomalies
      const anomalies = await this.anomalyDetectionService.detectSpendingAnomalies(userId, transactions);
      
      // Step 2: Analyze spending patterns
      const spendingPatterns = await this.anomalyDetectionService.analyzeSpendingPatterns(userId, transactions);
      
      // Step 3: Check threshold-based alerts
      const thresholdAlerts = await this.anomalyDetectionService.checkSpendingThresholds(userId, transactions);
      const allAnomalies = [...anomalies, ...thresholdAlerts];

      // Step 4: Generate personalized recommendations
      const recommendations = await this.recommendationEngine.generatePersonalizedRecommendations(
        userId,
        transactions,
        user,
        spendingPatterns
      );

      // Step 5: Add local context awareness
      const contextualRecommendations = await this.recommendationEngine.addLocalContextAwareness(
        recommendations,
        user
      );

      // Step 6: Generate notifications
      const spendingNotifications = await this.notificationService.generateSpendingTrendNotifications(
        userId,
        spendingPatterns,
        allAnomalies
      );

      const adviceNotifications = await this.notificationService.generateAdviceNotifications(
        userId,
        contextualRecommendations
      );

      const allNotifications = [...spendingNotifications, ...adviceNotifications];

      // Step 7: Schedule notifications for delivery
      for (const notification of allNotifications) {
        await this.notificationService.scheduleNotification(notification);
      }

      logger.info('AI financial analysis completed', {
        userId,
        anomaliesFound: allAnomalies.length,
        patternsAnalyzed: spendingPatterns.length,
        recommendationsGenerated: contextualRecommendations.length,
        notificationsScheduled: allNotifications.length
      });

      return {
        anomalies: allAnomalies,
        spendingPatterns,
        recommendations: contextualRecommendations,
        notifications: allNotifications
      };
    } catch (error) {
      logger.error('Error in AI financial analysis', { userId, error });
      throw error;
    }
  }

  /**
   * Real-time transaction analysis
   * Analyzes individual transactions as they occur
   */
  async analyzeTransaction(
    transaction: Transaction,
    userTransactions: Transaction[],
    user: User
  ): Promise<{
    isAnomalous: boolean;
    anomalyScore: number;
    immediateAdvice?: Advice;
    shouldNotify: boolean;
  }> {
    try {
      logger.info('Analyzing individual transaction', { 
        transactionId: transaction.id,
        userId: transaction.userId 
      });

      // Train model if needed
      await this.anomalyDetectionService.trainModel(userTransactions);

      // Check if transaction is anomalous
      const anomalies = await this.anomalyDetectionService.detectSpendingAnomalies(
        transaction.userId,
        [transaction, ...userTransactions]
      );

      const transactionAnomaly = anomalies.find(a => a.transactionId === transaction.id);
      const isAnomalous = !!transactionAnomaly;
      const anomalyScore = isAnomalous ? 0.8 : 0.2; // Simplified scoring

      // Generate immediate advice if needed
      let immediateAdvice: Advice | undefined;
      let shouldNotify = false;

      if (isAnomalous && transactionAnomaly?.severity === 'high') {
        immediateAdvice = {
          id: `immediate-${transaction.id}`,
          userId: transaction.userId,
          type: 'spending',
          title: 'Unusual Transaction Detected',
          message: `This ${transaction.category} transaction (${transaction.amount}) is unusual for your spending pattern. Consider reviewing if this aligns with your budget.`,
          actionable: true,
          priority: 'high',
          createdAt: new Date()
        };

        shouldNotify = true;

        // Schedule immediate notification
        const notification: Notification = {
          id: `immediate-${transaction.id}`,
          userId: transaction.userId,
          type: 'alert',
          title: 'Unusual Spending Alert',
          message: immediateAdvice.message,
          isRead: false,
          createdAt: new Date(),
          data: {
            transactionId: transaction.id,
            anomalyScore,
            severity: transactionAnomaly.severity
          }
        };

        await this.notificationService.scheduleNotification(notification);
      }

      logger.info('Transaction analysis completed', {
        transactionId: transaction.id,
        isAnomalous,
        anomalyScore,
        shouldNotify
      });

      return {
        isAnomalous,
        anomalyScore,
        immediateAdvice,
        shouldNotify
      };
    } catch (error) {
      logger.error('Error analyzing transaction', { 
        transactionId: transaction.id, 
        error 
      });
      throw error;
    }
  }

  /**
   * Weekly financial health check
   * Comprehensive weekly analysis and reporting
   */
  async performWeeklyHealthCheck(
    userId: string,
    transactions: Transaction[],
    user: User
  ): Promise<{
    healthScore: number;
    insights: string[];
    recommendations: Advice[];
    weeklyReport: string;
  }> {
    try {
      logger.info('Performing weekly financial health check', { userId });

      // Get recent week's transactions
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weeklyTransactions = transactions.filter(t => 
        t.userId === userId && new Date(t.timestamp) >= oneWeekAgo
      );

      // Analyze spending patterns
      const spendingPatterns = await this.anomalyDetectionService.analyzeSpendingPatterns(
        userId,
        transactions
      );

      // Generate recommendations
      const recommendations = await this.recommendationEngine.generatePersonalizedRecommendations(
        userId,
        transactions,
        user,
        spendingPatterns
      );

      // Calculate health score
      const healthScore = this.calculateFinancialHealthScore(spendingPatterns, weeklyTransactions);

      // Generate insights
      const insights = this.generateWeeklyInsights(spendingPatterns, weeklyTransactions);

      // Create weekly report
      const weeklyReport = this.generateWeeklyReport(
        weeklyTransactions,
        spendingPatterns,
        healthScore,
        insights
      );

      // Generate and schedule weekly summary notification
      const summaryNotification = await this.notificationService.generateMilestoneNotification(
        userId,
        'weekly_summary',
        {
          healthScore,
          totalSpending: weeklyTransactions.reduce((sum, t) => sum + t.amount, 0),
          transactionCount: weeklyTransactions.length,
          topInsight: insights[0] || 'Keep up the good work!'
        }
      );

      await this.notificationService.scheduleNotification(summaryNotification);

      logger.info('Weekly health check completed', {
        userId,
        healthScore,
        insightCount: insights.length,
        recommendationCount: recommendations.length
      });

      return {
        healthScore,
        insights,
        recommendations,
        weeklyReport
      };
    } catch (error) {
      logger.error('Error performing weekly health check', { userId, error });
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      spendingAlerts?: boolean;
      savingsReminders?: boolean;
      goalMilestones?: boolean;
      weeklyReports?: boolean;
      frequency?: 'immediate' | 'daily' | 'weekly';
    }
  ): Promise<void> {
    try {
      await this.notificationService.updateUserPreferences(userId, preferences);
      logger.info('Notification preferences updated', { userId, preferences });
    } catch (error) {
      logger.error('Error updating notification preferences', { userId, error });
      throw error;
    }
  }

  /**
   * Get user's notification preferences
   */
  getUserNotificationPreferences(userId: string) {
    return this.notificationService.getUserPreferences(userId);
  }

  /**
   * Train anomaly detection model with new data
   */
  async trainAnomalyModel(transactions: Transaction[]): Promise<void> {
    try {
      await this.anomalyDetectionService.trainModel(transactions);
      logger.info('Anomaly detection model retrained', { 
        transactionCount: transactions.length 
      });
    } catch (error) {
      logger.error('Error training anomaly model', { error });
      throw error;
    }
  }

  private calculateFinancialHealthScore(
    spendingPatterns: SpendingPattern[],
    weeklyTransactions: Transaction[]
  ): number {
    let score = 100; // Start with perfect score

    // Deduct points for increasing trends
    const increasingPatterns = spendingPatterns.filter(p => p.trend === 'increasing');
    score -= increasingPatterns.length * 10;

    // Deduct points for high anomaly scores
    const highAnomalyPatterns = spendingPatterns.filter(p => p.anomalyScore > 0.5);
    score -= highAnomalyPatterns.length * 15;

    // Deduct points for excessive daily spending
    const dailySpending = weeklyTransactions.reduce((sum, t) => sum + t.amount, 0) / 7;
    if (dailySpending > 1000) { // Arbitrary threshold for KES
      score -= 20;
    }

    // Add points for decreasing trends
    const decreasingPatterns = spendingPatterns.filter(p => p.trend === 'decreasing');
    score += decreasingPatterns.length * 5;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  private generateWeeklyInsights(
    spendingPatterns: SpendingPattern[],
    weeklyTransactions: Transaction[]
  ): string[] {
    const insights: string[] = [];

    // Total spending insight
    const totalSpending = weeklyTransactions.reduce((sum, t) => sum + t.amount, 0);
    insights.push(`You spent KES ${totalSpending.toFixed(2)} this week across ${weeklyTransactions.length} transactions.`);

    // Top category insight
    const categoryTotals = new Map<string, number>();
    weeklyTransactions.forEach(t => {
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + t.amount);
    });

    if (categoryTotals.size > 0) {
      const topCategory = Array.from(categoryTotals.entries())
        .sort(([,a], [,b]) => b - a)[0];
      insights.push(`Your highest spending category was ${topCategory[0]} at KES ${topCategory[1].toFixed(2)}.`);
    }

    // Trend insights
    const increasingCategories = spendingPatterns.filter(p => p.trend === 'increasing');
    if (increasingCategories.length > 0) {
      insights.push(`${increasingCategories.length} spending categories are trending upward - consider reviewing your budget.`);
    }

    const decreasingCategories = spendingPatterns.filter(p => p.trend === 'decreasing');
    if (decreasingCategories.length > 0) {
      insights.push(`Great job! You've reduced spending in ${decreasingCategories.length} categories.`);
    }

    return insights;
  }

  private generateWeeklyReport(
    weeklyTransactions: Transaction[],
    spendingPatterns: SpendingPattern[],
    healthScore: number,
    insights: string[]
  ): string {
    let report = `# Weekly Financial Report\n\n`;
    
    report += `## Financial Health Score: ${healthScore}/100\n\n`;
    
    if (healthScore >= 80) {
      report += `🟢 Excellent! Your financial health is strong.\n\n`;
    } else if (healthScore >= 60) {
      report += `🟡 Good, but there's room for improvement.\n\n`;
    } else {
      report += `🔴 Your financial health needs attention.\n\n`;
    }

    report += `## Key Insights\n\n`;
    insights.forEach((insight, index) => {
      report += `${index + 1}. ${insight}\n`;
    });

    report += `\n## Spending Breakdown\n\n`;
    const categoryTotals = new Map<string, number>();
    weeklyTransactions.forEach(t => {
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + t.amount);
    });

    Array.from(categoryTotals.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, amount]) => {
        report += `- ${category}: KES ${amount.toFixed(2)}\n`;
      });

    report += `\n## Trends\n\n`;
    spendingPatterns.forEach(pattern => {
      const trendEmoji = pattern.trend === 'increasing' ? '📈' : 
                        pattern.trend === 'decreasing' ? '📉' : '➡️';
      report += `${trendEmoji} ${pattern.category}: ${pattern.trend}\n`;
    });

    return report;
  }

  /**
   * Generate AI advice for a user
   */
  async generateAdvice(userId: string): Promise<Advice[]> {
    try {
      logger.info('Generating AI advice', { userId });
      
      // This would typically fetch user data and generate advice
      // For now, return mock advice
      const advice: Advice[] = [
        {
          id: `advice-${userId}-${Date.now()}`,
          userId,
          type: 'spending',
          title: 'Optimize Your Spending',
          message: 'Consider reducing discretionary spending by 10% to improve your savings rate.',
          priority: 'medium',
          actionable: true,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        }
      ];

      return advice;
    } catch (error) {
      logger.error('Error generating AI advice', { userId, error });
      throw error;
    }
  }

  /**
   * Analyze spending patterns for a user
   */
  async analyzeSpendingPatterns(userId: string): Promise<SpendingPattern[]> {
    try {
      logger.info('Analyzing spending patterns', { userId });
      
      // This would typically analyze user transactions
      // For now, return mock patterns
      const patterns: SpendingPattern[] = [
        {
          userId,
          category: 'Food & Dining',
          averageMonthly: 15000,
          trend: 'increasing',
          anomalyScore: 0.15,
          lastAnalyzed: new Date(),
          confidence: 0.85,
        }
      ];

      return patterns;
    } catch (error) {
      logger.error('Error analyzing spending patterns', { userId, error });
      throw error;
    }
  }

  /**
   * Generate savings offer for a user
   */
  async generateSavingsOffer(userId: string, transactionId?: string): Promise<any> {
    try {
      logger.info('Generating savings offer', { userId, transactionId });
      
      return {
        id: `offer-${userId}-${Date.now()}`,
        userId,
        type: 'round_up_savings',
        title: 'Round Up Your Purchase',
        description: 'Save the spare change from this transaction automatically',
        amount: 50, // KES
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        transactionId
      };
    } catch (error) {
      logger.error('Error generating savings offer', { userId, error });
      throw error;
    }
  }

  /**
   * Generate emergency savings offer
   */
  async generateEmergencySavingsOffer(userId: string): Promise<any> {
    try {
      logger.info('Generating emergency savings offer', { userId });
      
      return {
        id: `emergency-offer-${userId}-${Date.now()}`,
        userId,
        type: 'emergency_savings',
        title: 'Emergency Savings Boost',
        description: 'Save extra to recover from unusual spending',
        amount: 100, // KES
        validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
        priority: 'high'
      };
    } catch (error) {
      logger.error('Error generating emergency savings offer', { userId, error });
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      // Check if all dependent services are healthy
      const anomalyHealth = await this.anomalyDetectionService.healthCheck();
      const recommendationHealth = await this.recommendationEngine.healthCheck();

      const allHealthy = [anomalyHealth, recommendationHealth]
        .every(health => health.status === 'healthy');

      return {
        status: allHealthy ? 'healthy' : 'degraded',
        message: allHealthy ? 'AI Advisor service is operational' : 'Some dependent services are unhealthy'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `AI Advisor service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const aiAdvisorService = new AIAdvisorService();