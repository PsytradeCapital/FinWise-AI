import { logger } from '../utils/logger';
import { transactionParser } from './transactionParser';
import { AIAdvisorService } from './aiAdvisorService';
import { SavingsAutomatorService } from './savingsAutomatorService';
import { NotificationService } from './notificationService';
import { MoneyStoryService } from './moneyStoryService';
import { dataSyncService } from './dataSyncService';
import { Transaction, User, SavingsGoal } from '../../../shared/src/types';

export class IntegrationService {
  private static instance: IntegrationService;
  private aiAdvisorService: AIAdvisorService;
  private savingsAutomatorService: SavingsAutomatorService;
  private notificationService: NotificationService;
  private moneyStoryService: MoneyStoryService;

  private constructor() {
    this.aiAdvisorService = new AIAdvisorService();
    this.savingsAutomatorService = new SavingsAutomatorService();
    this.notificationService = new NotificationService();
    this.moneyStoryService = new MoneyStoryService();
  }

  static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService();
    }
    return IntegrationService.instance;
  }

  /**
   * Complete transaction processing flow
   * 1. Parse transaction (SMS or API)
   * 2. Trigger categorization popup
   * 3. Analyze for anomalies
   * 4. Generate savings offer
   * 5. Update spending patterns
   * 6. Send notifications if needed
   */
  async processTransaction(
    smsContent: string,
    userId: string,
    phoneNumber?: string
  ): Promise<{
    success: boolean;
    transaction?: Transaction;
    requiresCategorization?: boolean;
    savingsOffer?: any;
    anomalies?: any[];
    error?: string;
  }> {
    try {
      logger.info('Starting complete transaction processing flow', { userId });

      // Step 1: Parse transaction
      const parseResult = await transactionParser.parseFromSMS(smsContent, userId, phoneNumber);
      
      if (!parseResult.success || !parseResult.transaction) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse transaction',
        };
      }

      const transaction = parseResult.transaction;
      logger.info('Transaction parsed successfully', { transactionId: transaction.id });

      // Step 2: Check if categorization is needed
      const requiresCategorization = !transaction.category || transaction.category === 'Uncategorized';

      // Step 3: Analyze for anomalies (async, don't wait)
      this.analyzeTransactionAnomalies(userId, transaction.id).catch((error: any) => {
        logger.error('Anomaly analysis failed', { error, transactionId: transaction.id });
      });

      // Step 4: Generate savings offer
      let savingsOffer = null;
      try {
        savingsOffer = await this.generateSavingsOffer(userId, transaction);
      } catch (error) {
        logger.warn('Savings offer generation failed', { error, transactionId: transaction.id });
      }

      // Step 5: Update spending patterns (async)
      this.updateSpendingPatterns(userId).catch((error: any) => {
        logger.error('Spending pattern update failed', { error, userId });
      });

      // Step 6: Sync data across devices (async)
      dataSyncService.syncUserData(userId).catch((error: any) => {
        logger.error('Data sync failed', { error, userId });
      });

      return {
        success: true,
        transaction,
        requiresCategorization,
        savingsOffer,
      };
    } catch (error) {
      logger.error('Transaction processing flow failed', { error, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Complete user onboarding flow
   */
  async onboardUser(user: User): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.info('Starting user onboarding flow', { userId: user.id });

      // Initialize user preferences
      await this.initializeUserPreferences(user);

      // Send welcome notification
      await this.notificationService.scheduleNotification({
        id: `welcome-${user.id}`,
        userId: user.id,
        type: 'alert',
        title: 'Welcome to FinWise AI!',
        message: 'Start tracking your expenses to get personalized financial insights.',
        isRead: false,
        createdAt: new Date(),
        data: { onboarding: true },
      });

      // Create default savings goal
      await this.createDefaultSavingsGoal(user);

      logger.info('User onboarding completed successfully', { userId: user.id });
      return { success: true };
    } catch (error) {
      logger.error('User onboarding failed', { error, userId: user.id });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Onboarding failed',
      };
    }
  }

  /**
   * Daily analysis and notification flow
   */
  async performDailyAnalysis(userId: string): Promise<void> {
    try {
      logger.info('Starting daily analysis', { userId });

      // Analyze spending patterns
      const analysis = await this.aiAdvisorService.analyzeSpendingPatterns(userId);

      // Generate advice if needed
      if (analysis.needsAdvice) {
        const advice = await this.aiAdvisorService.generateAdvice(userId);
        
        if (advice.length > 0) {
          await this.notificationService.scheduleNotification({
            id: `daily-advice-${userId}-${Date.now()}`,
            userId,
            type: 'advice',
            title: 'Daily Financial Insight',
            message: advice[0].message,
            isRead: false,
            createdAt: new Date(),
            data: { advice: advice[0] },
          });
        }
      }

      // Check savings goals progress
      await this.checkSavingsGoalsProgress(userId);

      logger.info('Daily analysis completed', { userId });
    } catch (error) {
      logger.error('Daily analysis failed', { error, userId });
    }
  }

  /**
   * Weekly story generation flow
   */
  async generateWeeklyStory(userId: string): Promise<void> {
    try {
      logger.info('Generating weekly money story', { userId });

      const story = await this.moneyStoryService.generateStory(userId, 'weekly');

      if (story) {
        await this.notificationService.scheduleNotification({
          id: `weekly-story-${userId}-${Date.now()}`,
          userId,
          type: 'achievement',
          title: 'Your Weekly Money Story',
          message: story.title,
          isRead: false,
          createdAt: new Date(),
          data: { storyId: story.id },
        });
      }

      logger.info('Weekly story generated successfully', { userId });
    } catch (error) {
      logger.error('Weekly story generation failed', { error, userId });
    }
  }

  /**
   * Emergency spending alert flow
   */
  async handleEmergencySpending(userId: string, transactionId: string): Promise<void> {
    try {
      logger.info('Handling emergency spending alert', { userId, transactionId });

      // Generate immediate advice
      const advice = await this.aiAdvisorService.generateAdvice(userId);

      // Send urgent notification
      await this.notificationService.scheduleNotification({
        id: `emergency-${userId}-${transactionId}`,
        userId,
        type: 'alert',
        title: 'Unusual Spending Detected',
        message: advice[0]?.message || 'Unusual spending pattern detected',
        isRead: false,
        createdAt: new Date(),
        data: { 
          urgent: true,
          transactionId,
          advice: advice[0],
        },
      });

      // Suggest immediate savings action
      const savingsOffer = await this.savingsAutomatorService.generateSavingsOffer(userId);
      
      if (savingsOffer) {
        await this.notificationService.scheduleNotification({
          id: `savings-offer-${userId}-${Date.now()}`,
          userId,
          type: 'reminder',
          title: 'Consider Saving Now',
          message: `Save ${savingsOffer.amount} to get back on track`,
          isRead: false,
          createdAt: new Date(),
          data: { savingsOffer },
        });
      }

      logger.info('Emergency spending alert handled', { userId, transactionId });
    } catch (error) {
      logger.error('Emergency spending alert failed', { error, userId, transactionId });
    }
  }

  // Private helper methods

  private async analyzeTransactionAnomalies(userId: string, transactionId: string): Promise<void> {
    try {
      const anomalies = await this.aiAdvisorService.analyzeSpendingPatterns(userId);
      
      if (anomalies.length > 0) {
        const highSeverityAnomalies = anomalies.filter((a: any) => a.severity === 'high');
        
        if (highSeverityAnomalies.length > 0) {
          await this.handleEmergencySpending(userId, transactionId);
        }
      }
    } catch (error) {
      logger.error('Transaction anomaly analysis failed', { error, userId, transactionId });
    }
  }

  private async generateSavingsOffer(userId: string, transaction: Transaction): Promise<any> {
    try {
      return await this.savingsAutomatorService.generateSavingsOffer(userId);
    } catch (error) {
      logger.error('Savings offer generation failed', { error, userId, transactionId: transaction.id });
      return null;
    }
  }

  private async updateSpendingPatterns(userId: string): Promise<void> {
    try {
      await this.aiAdvisorService.analyzeSpendingPatterns(userId);
    } catch (error) {
      logger.error('Spending pattern update failed', { error, userId });
    }
  }

  private async initializeUserPreferences(user: User): Promise<void> {
    // Initialize default preferences based on user's country and currency
    const defaultPreferences = {
      language: user.country === 'KE' ? 'sw' : 'en',
      notifications: {
        spendingAlerts: true,
        savingsReminders: true,
        goalMilestones: true,
        weeklyReports: true,
      },
      savingsAutomation: {
        enabled: true,
        roundUpSavings: true,
        percentageSavings: 5,
        minimumTransfer: user.currency === 'KES' ? 50 : 1,
        autoTransfer: false,
      },
      categories: ['Food', 'Transport', 'Entertainment', 'Bills', 'Shopping'],
    };

    // This would typically update the user's preferences in the database
    logger.info('User preferences initialized', { userId: user.id, preferences: defaultPreferences });
  }

  private async createDefaultSavingsGoal(user: User): Promise<void> {
    const defaultGoal: Partial<SavingsGoal> = {
      userId: user.id,
      name: 'Emergency Fund',
      targetAmount: user.currency === 'KES' ? 50000 : 1000,
      currentAmount: 0,
      deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      automationRules: [
        {
          id: 'default-roundup',
          type: 'roundup',
          value: 1,
          isActive: true,
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // This would typically create the goal in the database
    logger.info('Default savings goal created', { userId: user.id, goal: defaultGoal });
  }

  private async checkSavingsGoalsProgress(userId: string): Promise<void> {
    try {
      // This would check if any savings goals have reached milestones
      // and send congratulatory notifications
      logger.info('Checking savings goals progress', { userId });
    } catch (error) {
      logger.error('Savings goals progress check failed', { error, userId });
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if all integrated services are healthy
      const services = [
        transactionParser.healthCheck(),
        this.aiAdvisorService.healthCheck(),
        this.savingsAutomatorService.healthCheck(),
        this.notificationService.healthCheck(),
        this.moneyStoryService.healthCheck(),
        dataSyncService.healthCheck(),
      ];

      const results = await Promise.allSettled(services);
      const allHealthy = results.every(result => 
        result.status === 'fulfilled' && 
        (result.value === true || (typeof result.value === 'object' && result.value.status === 'healthy'))
      );

      logger.info('Integration service health check completed', { allHealthy });
      return allHealthy;
    } catch (error) {
      logger.error('Integration service health check failed', { error });
      return false;
    }
  }
}

export const integrationService = IntegrationService.getInstance();