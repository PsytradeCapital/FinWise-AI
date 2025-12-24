import { Notification, User, Anomaly, Advice, SpendingPattern } from '@finwise-ai/shared';
import { logger } from '../utils/logger';

/**
 * Notification Service
 * Handles notification generation, scheduling, and delivery for poor spending trends
 */

interface NotificationPreference {
  userId: string;
  spendingAlerts: boolean;
  savingsReminders: boolean;
  goalMilestones: boolean;
  weeklyReports: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  quietHours: { start: number; end: number };
}

interface ScheduledNotification {
  id: string;
  notification: Notification;
  scheduledFor: Date;
  isDelivered: boolean;
  retryCount: number;
}

interface SpendingTrend {
  userId: string;
  category: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  severity: 'low' | 'medium' | 'high';
  changePercentage: number;
  timeframe: string;
}

export class NotificationService {
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
  private userPreferences: Map<string, NotificationPreference> = new Map();
  private deliveryQueue: ScheduledNotification[] = [];

  constructor() {
    // Start notification delivery scheduler
    this.startDeliveryScheduler();
  }

  /**
   * Generate notifications for poor spending trends
   */
  async generateSpendingTrendNotifications(
    userId: string,
    spendingPatterns: SpendingPattern[],
    anomalies: Anomaly[]
  ): Promise<Notification[]> {
    try {
      logger.info('Generating spending trend notifications', { userId });

      const notifications: Notification[] = [];
      const userPrefs = this.getUserPreferences(userId);

      if (!userPrefs.spendingAlerts) {
        return notifications;
      }

      // Generate notifications for spending pattern changes
      const trendNotifications = await this.generateTrendNotifications(userId, spendingPatterns);
      notifications.push(...trendNotifications);

      // Generate notifications for anomalies
      const anomalyNotifications = await this.generateAnomalyNotifications(userId, anomalies);
      notifications.push(...anomalyNotifications);

      // Generate weekly spending summary notifications
      if (userPrefs.weeklyReports) {
        const summaryNotification = await this.generateWeeklySummaryNotification(userId, spendingPatterns);
        if (summaryNotification) {
          notifications.push(summaryNotification);
        }
      }

      logger.info('Spending trend notifications generated', { 
        userId, 
        notificationCount: notifications.length 
      });

      return notifications;
    } catch (error) {
      logger.error('Error generating spending trend notifications', { userId, error });
      throw error;
    }
  }

  /**
   * Schedule notification delivery
   */
  async scheduleNotification(notification: Notification, deliveryTime?: Date): Promise<void> {
    try {
      const userPrefs = this.getUserPreferences(notification.userId);
      const scheduledFor = deliveryTime || this.calculateOptimalDeliveryTime(notification, userPrefs);

      const scheduledNotification: ScheduledNotification = {
        id: `scheduled-${notification.id}`,
        notification,
        scheduledFor,
        isDelivered: false,
        retryCount: 0
      };

      this.scheduledNotifications.set(scheduledNotification.id, scheduledNotification);
      this.deliveryQueue.push(scheduledNotification);

      // Sort delivery queue by scheduled time
      this.deliveryQueue.sort((a, b) => 
        a.scheduledFor.getTime() - b.scheduledFor.getTime()
      );

      logger.info('Notification scheduled', { 
        notificationId: notification.id,
        scheduledFor: scheduledFor.toISOString()
      });
    } catch (error) {
      logger.error('Error scheduling notification', { notificationId: notification.id, error });
      throw error;
    }
  }

  /**
   * Manage user preference for notification types
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreference>): Promise<void> {
    try {
      const currentPrefs = this.getUserPreferences(userId);
      const updatedPrefs = { ...currentPrefs, ...preferences };
      
      this.userPreferences.set(userId, updatedPrefs);

      logger.info('User notification preferences updated', { userId, preferences });
    } catch (error) {
      logger.error('Error updating user preferences', { userId, error });
      throw error;
    }
  }

  /**
   * Get user notification preferences
   */
  getUserPreferences(userId: string): NotificationPreference {
    return this.userPreferences.get(userId) || {
      userId,
      spendingAlerts: true,
      savingsReminders: true,
      goalMilestones: true,
      weeklyReports: true,
      frequency: 'immediate',
      quietHours: { start: 22, end: 7 } // 10 PM to 7 AM
    };
  }

  /**
   * Generate notifications for advice and recommendations
   */
  async generateAdviceNotifications(userId: string, advice: Advice[]): Promise<Notification[]> {
    try {
      const notifications: Notification[] = [];
      const userPrefs = this.getUserPreferences(userId);

      if (!userPrefs.spendingAlerts) {
        return notifications;
      }

      for (const adviceItem of advice) {
        if (adviceItem.priority === 'high') {
          const notification: Notification = {
            id: `advice-${adviceItem.id}`,
            userId,
            type: 'advice',
            title: adviceItem.title,
            message: adviceItem.message,
            isRead: false,
            createdAt: new Date(),
            data: {
              adviceId: adviceItem.id,
              priority: adviceItem.priority,
              actionable: adviceItem.actionable
            }
          };

          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      logger.error('Error generating advice notifications', { userId, error });
      throw error;
    }
  }

  /**
   * Generate milestone achievement notifications
   */
  async generateMilestoneNotification(
    userId: string,
    milestoneType: string,
    milestoneData: any
  ): Promise<Notification> {
    try {
      const notification: Notification = {
        id: `milestone-${userId}-${Date.now()}`,
        userId,
        type: 'achievement',
        title: this.getMilestoneTitle(milestoneType),
        message: this.getMilestoneMessage(milestoneType, milestoneData),
        isRead: false,
        createdAt: new Date(),
        data: {
          milestoneType,
          ...milestoneData
        }
      };

      logger.info('Milestone notification generated', { userId, milestoneType });

      return notification;
    } catch (error) {
      logger.error('Error generating milestone notification', { userId, milestoneType, error });
      throw error;
    }
  }

  /**
   * Deliver notifications to users
   */
  private async deliverNotification(scheduledNotification: ScheduledNotification): Promise<boolean> {
    try {
      const { notification } = scheduledNotification;

      // In a real implementation, this would integrate with push notification services
      // For now, we'll simulate delivery
      logger.info('Delivering notification', { 
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title
      });

      // Mark as delivered
      scheduledNotification.isDelivered = true;

      // Here you would integrate with:
      // - Firebase Cloud Messaging (FCM) for mobile push notifications
      // - Email service for email notifications
      // - SMS service for text notifications
      // - In-app notification system

      return true;
    } catch (error) {
      logger.error('Error delivering notification', { 
        notificationId: scheduledNotification.notification.id, 
        error 
      });

      // Increment retry count
      scheduledNotification.retryCount++;

      // Retry up to 3 times
      if (scheduledNotification.retryCount < 3) {
        // Reschedule for retry (exponential backoff)
        const retryDelay = Math.pow(2, scheduledNotification.retryCount) * 60 * 1000; // Minutes
        scheduledNotification.scheduledFor = new Date(Date.now() + retryDelay);
        return false;
      }

      return false;
    }
  }

  /**
   * Start the notification delivery scheduler
   */
  private startDeliveryScheduler(): void {
    setInterval(async () => {
      const now = new Date();
      const readyNotifications = this.deliveryQueue.filter(
        n => !n.isDelivered && n.scheduledFor <= now
      );

      for (const notification of readyNotifications) {
        await this.deliverNotification(notification);
      }

      // Clean up delivered notifications
      this.deliveryQueue = this.deliveryQueue.filter(n => !n.isDelivered);
    }, 60000); // Check every minute
  }

  private async generateTrendNotifications(
    userId: string,
    spendingPatterns: SpendingPattern[]
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const pattern of spendingPatterns) {
      if (pattern.userId !== userId) continue;

      const trend = this.analyzeSpendingTrend(pattern);
      
      if (trend.severity === 'high' && trend.trend === 'increasing') {
        const notification: Notification = {
          id: `trend-${pattern.category}-${Date.now()}`,
          userId,
          type: 'alert',
          title: `${pattern.category} Spending Alert`,
          message: `Your ${pattern.category} spending has increased by ${trend.changePercentage.toFixed(1)}% ${trend.timeframe}. Consider reviewing your budget for this category.`,
          isRead: false,
          createdAt: new Date(),
          data: {
            category: pattern.category,
            trend: trend.trend,
            changePercentage: trend.changePercentage,
            severity: trend.severity
          }
        };

        notifications.push(notification);
      }
    }

    return notifications;
  }

  private async generateAnomalyNotifications(
    userId: string,
    anomalies: Anomaly[]
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const anomaly of anomalies) {
      if (anomaly.userId !== userId || anomaly.severity === 'low') continue;

      const notification: Notification = {
        id: `anomaly-${anomaly.id}`,
        userId,
        type: 'alert',
        title: 'Unusual Spending Detected',
        message: anomaly.description,
        isRead: false,
        createdAt: new Date(),
        data: {
          anomalyId: anomaly.id,
          transactionId: anomaly.transactionId,
          severity: anomaly.severity,
          type: anomaly.type
        }
      };

      notifications.push(notification);
    }

    return notifications;
  }

  private async generateWeeklySummaryNotification(
    userId: string,
    spendingPatterns: SpendingPattern[]
  ): Promise<Notification | null> {
    try {
      const userPatterns = spendingPatterns.filter(p => p.userId === userId);
      
      if (userPatterns.length === 0) return null;

      const totalSpending = userPatterns.reduce((sum, p) => sum + p.averageMonthly, 0);
      const topCategory = userPatterns.reduce((max, p) => 
        p.averageMonthly > max.averageMonthly ? p : max
      );

      const increasingCategories = userPatterns.filter(p => p.trend === 'increasing').length;
      const decreasingCategories = userPatterns.filter(p => p.trend === 'decreasing').length;

      let summaryMessage = `This week's spending summary: Total monthly average is KES ${totalSpending.toFixed(2)}. `;
      summaryMessage += `Your top spending category is ${topCategory.category}. `;
      
      if (increasingCategories > 0) {
        summaryMessage += `${increasingCategories} categories are trending up. `;
      }
      
      if (decreasingCategories > 0) {
        summaryMessage += `Great job reducing spending in ${decreasingCategories} categories!`;
      }

      return {
        id: `weekly-summary-${userId}-${Date.now()}`,
        userId,
        type: 'reminder',
        title: 'Weekly Spending Summary',
        message: summaryMessage,
        isRead: false,
        createdAt: new Date(),
        data: {
          totalSpending,
          topCategory: topCategory.category,
          increasingCategories,
          decreasingCategories
        }
      };
    } catch (error) {
      logger.error('Error generating weekly summary notification', { userId, error });
      return null;
    }
  }

  private analyzeSpendingTrend(pattern: SpendingPattern): SpendingTrend {
    // Calculate change percentage based on anomaly score and trend
    let changePercentage = 0;
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (pattern.anomalyScore > 0.7) {
      changePercentage = 50 + (pattern.anomalyScore * 50); // 50-100% change
      severity = 'high';
    } else if (pattern.anomalyScore > 0.4) {
      changePercentage = 20 + (pattern.anomalyScore * 30); // 20-50% change
      severity = 'medium';
    } else {
      changePercentage = pattern.anomalyScore * 20; // 0-20% change
      severity = 'low';
    }

    return {
      userId: pattern.userId,
      category: pattern.category,
      trend: pattern.trend,
      severity,
      changePercentage,
      timeframe: 'this month'
    };
  }

  private calculateOptimalDeliveryTime(
    notification: Notification,
    preferences: NotificationPreference
  ): Date {
    const now = new Date();
    
    // Check if we're in quiet hours
    const currentHour = now.getHours();
    const { start: quietStart, end: quietEnd } = preferences.quietHours;
    
    const isQuietTime = (quietStart > quietEnd) 
      ? (currentHour >= quietStart || currentHour < quietEnd)
      : (currentHour >= quietStart && currentHour < quietEnd);

    if (isQuietTime) {
      // Schedule for end of quiet hours
      const deliveryTime = new Date(now);
      deliveryTime.setHours(quietEnd, 0, 0, 0);
      
      // If quiet end is tomorrow
      if (quietEnd <= currentHour) {
        deliveryTime.setDate(deliveryTime.getDate() + 1);
      }
      
      return deliveryTime;
    }

    // Immediate delivery based on frequency preference
    switch (preferences.frequency) {
      case 'immediate':
        return now;
      case 'daily':
        const dailyTime = new Date(now);
        dailyTime.setHours(9, 0, 0, 0); // 9 AM next day
        if (dailyTime <= now) {
          dailyTime.setDate(dailyTime.getDate() + 1);
        }
        return dailyTime;
      case 'weekly':
        const weeklyTime = new Date(now);
        weeklyTime.setDate(weeklyTime.getDate() + (7 - weeklyTime.getDay())); // Next Sunday
        weeklyTime.setHours(10, 0, 0, 0); // 10 AM
        return weeklyTime;
      default:
        return now;
    }
  }

  private getMilestoneTitle(milestoneType: string): string {
    switch (milestoneType) {
      case 'savings_goal':
        return '🎉 Savings Goal Achieved!';
      case 'spending_reduction':
        return '💪 Spending Reduction Success!';
      case 'budget_streak':
        return '🔥 Budget Streak Milestone!';
      case 'category_optimization':
        return '✨ Category Optimization Win!';
      default:
        return '🏆 Milestone Achieved!';
    }
  }

  private getMilestoneMessage(milestoneType: string, data: any): string {
    switch (milestoneType) {
      case 'savings_goal':
        return `Congratulations! You've reached your savings goal of KES ${data.targetAmount}. Keep up the great work!`;
      case 'spending_reduction':
        return `Amazing! You've reduced your ${data.category} spending by ${data.reductionPercentage}% this month.`;
      case 'budget_streak':
        return `Fantastic! You've stayed within budget for ${data.streakDays} consecutive days.`;
      case 'category_optimization':
        return `Well done! Your optimized spending in ${data.category} has saved you KES ${data.savedAmount} this month.`;
      default:
        return 'Congratulations on reaching this milestone!';
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      return {
        status: 'healthy',
        message: 'Notification service is operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Notification service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();