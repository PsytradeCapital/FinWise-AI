import { SavingsGoal, User, Transaction, SpendingPattern } from '@finwise-ai/shared';
import { NotificationService } from './notificationService';
import { logger } from '../utils/logger';

/**
 * Milestone Service
 * Handles milestone detection and celebratory notifications for savings goals
 */

export interface Milestone {
  id: string;
  userId: string;
  goalId?: string;
  type: 'savings_goal' | 'spending_reduction' | 'budget_streak' | 'category_optimization' | 'savings_streak';
  title: string;
  description: string;
  achievedAt: Date;
  value: number;
  unit: string;
  celebrationLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
  isNotified: boolean;
}

export interface MilestoneProgress {
  goalId: string;
  currentProgress: number;
  targetAmount: number;
  progressPercentage: number;
  nextMilestone: number;
  estimatedCompletion: Date;
  milestoneHistory: Milestone[];
}

export class MilestoneService {
  private notificationService: NotificationService;
  private milestones: Map<string, Milestone> = new Map();

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Check for milestone achievements when savings goal progress is updated
   */
  async checkSavingsGoalMilestones(
    goal: SavingsGoal,
    previousAmount: number,
    user: User
  ): Promise<Milestone[]> {
    try {
      logger.info('Checking savings goal milestones', { goalId: goal.id, userId: user.id });

      const achievedMilestones: Milestone[] = [];
      const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
      const previousPercentage = (previousAmount / goal.targetAmount) * 100;

      // Check percentage-based milestones
      const percentageMilestones = [25, 50, 75, 90, 100];
      
      for (const milestone of percentageMilestones) {
        if (progressPercentage >= milestone && previousPercentage < milestone) {
          const milestoneData = await this.createSavingsGoalMilestone(
            goal,
            user,
            milestone,
            milestone >= 100 ? 'platinum' : 
            milestone >= 90 ? 'gold' :
            milestone >= 75 ? 'silver' : 
            milestone >= 50 ? 'silver' : 'bronze'
          );
          
          achievedMilestones.push(milestoneData);
          this.milestones.set(milestoneData.id, milestoneData);
        }
      }

      // Check amount-based milestones (every 10,000 KES or equivalent)
      const amountMilestones = this.calculateAmountMilestones(goal.targetAmount, user.currency);
      
      for (const milestoneAmount of amountMilestones) {
        if (goal.currentAmount >= milestoneAmount && previousAmount < milestoneAmount) {
          const milestoneData = await this.createAmountMilestone(goal, user, milestoneAmount);
          achievedMilestones.push(milestoneData);
          this.milestones.set(milestoneData.id, milestoneData);
        }
      }

      // Generate celebratory notifications for achieved milestones
      for (const milestone of achievedMilestones) {
        await this.generateCelebratoryNotification(milestone, user);
      }

      logger.info('Savings goal milestones checked', { 
        goalId: goal.id, 
        achievedCount: achievedMilestones.length 
      });

      return achievedMilestones;
    } catch (error) {
      logger.error('Error checking savings goal milestones', { goalId: goal.id, error });
      throw error;
    }
  }

  /**
   * Check for spending reduction milestones
   */
  async checkSpendingReductionMilestones(
    userId: string,
    currentPatterns: SpendingPattern[],
    previousPatterns: SpendingPattern[]
  ): Promise<Milestone[]> {
    try {
      const achievedMilestones: Milestone[] = [];

      for (const currentPattern of currentPatterns) {
        const previousPattern = previousPatterns.find(
          p => p.category === currentPattern.category && p.userId === userId
        );

        if (previousPattern && currentPattern.trend === 'decreasing') {
          const reductionPercentage = 
            ((previousPattern.averageMonthly - currentPattern.averageMonthly) / previousPattern.averageMonthly) * 100;

          // Milestone for significant spending reduction (>20%)
          if (reductionPercentage >= 20) {
            const milestone = await this.createSpendingReductionMilestone(
              userId,
              currentPattern.category,
              reductionPercentage,
              previousPattern.averageMonthly - currentPattern.averageMonthly
            );

            achievedMilestones.push(milestone);
            this.milestones.set(milestone.id, milestone);
          }
        }
      }

      return achievedMilestones;
    } catch (error) {
      logger.error('Error checking spending reduction milestones', { userId, error });
      throw error;
    }
  }

  /**
   * Check for budget streak milestones
   */
  async checkBudgetStreakMilestones(
    userId: string,
    consecutiveBudgetDays: number
  ): Promise<Milestone[]> {
    try {
      const achievedMilestones: Milestone[] = [];
      const streakMilestones = [7, 14, 30, 60, 90, 180, 365]; // Days

      for (const streakDays of streakMilestones) {
        if (consecutiveBudgetDays === streakDays) {
          const milestone = await this.createBudgetStreakMilestone(userId, streakDays);
          achievedMilestones.push(milestone);
          this.milestones.set(milestone.id, milestone);
        }
      }

      return achievedMilestones;
    } catch (error) {
      logger.error('Error checking budget streak milestones', { userId, error });
      throw error;
    }
  }

  /**
   * Get milestone progress for a specific goal
   */
  getMilestoneProgress(goal: SavingsGoal): MilestoneProgress {
    const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
    const nextMilestonePercentages = [25, 50, 75, 90, 100];
    const nextMilestone = nextMilestonePercentages.find(m => m > progressPercentage) || 100;
    
    // Calculate estimated completion based on recent progress
    const daysRemaining = Math.ceil((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const estimatedCompletion = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

    // Get milestone history for this goal
    const milestoneHistory = Array.from(this.milestones.values())
      .filter(m => m.goalId === goal.id)
      .sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime());

    return {
      goalId: goal.id,
      currentProgress: goal.currentAmount,
      targetAmount: goal.targetAmount,
      progressPercentage,
      nextMilestone,
      estimatedCompletion,
      milestoneHistory
    };
  }

  /**
   * Get all milestones for a user
   */
  getUserMilestones(userId: string): Milestone[] {
    return Array.from(this.milestones.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime());
  }

  /**
   * Get milestone statistics for dashboard
   */
  getMilestoneStatistics(userId: string): {
    totalMilestones: number;
    milestonesByType: Record<string, number>;
    recentMilestones: Milestone[];
    celebrationLevel: Record<string, number>;
  } {
    const userMilestones = this.getUserMilestones(userId);
    
    const milestonesByType = userMilestones.reduce((acc, milestone) => {
      acc[milestone.type] = (acc[milestone.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const celebrationLevel = userMilestones.reduce((acc, milestone) => {
      acc[milestone.celebrationLevel] = (acc[milestone.celebrationLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentMilestones = userMilestones.slice(0, 5);

    return {
      totalMilestones: userMilestones.length,
      milestonesByType,
      recentMilestones,
      celebrationLevel
    };
  }

  private async createSavingsGoalMilestone(
    goal: SavingsGoal,
    user: User,
    percentage: number,
    level: 'bronze' | 'silver' | 'gold' | 'platinum'
  ): Promise<Milestone> {
    const milestone: Milestone = {
      id: `milestone-${goal.id}-${percentage}-${Date.now()}`,
      userId: user.id,
      goalId: goal.id,
      type: 'savings_goal',
      title: percentage === 100 ? 'Goal Completed!' : `${percentage}% Progress`,
      description: percentage === 100 
        ? `Congratulations! You've completed your "${goal.name}" savings goal of ${goal.targetAmount} ${user.currency}!`
        : `Great progress! You've reached ${percentage}% of your "${goal.name}" savings goal.`,
      achievedAt: new Date(),
      value: percentage,
      unit: '%',
      celebrationLevel: level,
      isNotified: false
    };

    return milestone;
  }

  private async createAmountMilestone(
    goal: SavingsGoal,
    user: User,
    amount: number
  ): Promise<Milestone> {
    const milestone: Milestone = {
      id: `milestone-amount-${goal.id}-${amount}-${Date.now()}`,
      userId: user.id,
      goalId: goal.id,
      type: 'savings_goal',
      title: `${amount} ${user.currency} Saved!`,
      description: `Amazing! You've saved ${amount} ${user.currency} towards your "${goal.name}" goal.`,
      achievedAt: new Date(),
      value: amount,
      unit: user.currency,
      celebrationLevel: this.calculateCelebrationLevel(amount, goal.targetAmount),
      isNotified: false
    };

    return milestone;
  }

  private async createSpendingReductionMilestone(
    userId: string,
    category: string,
    reductionPercentage: number,
    savedAmount: number
  ): Promise<Milestone> {
    const milestone: Milestone = {
      id: `milestone-reduction-${userId}-${category}-${Date.now()}`,
      userId,
      type: 'spending_reduction',
      title: `${category} Spending Reduced!`,
      description: `Excellent! You've reduced your ${category} spending by ${reductionPercentage.toFixed(1)}%, saving ${savedAmount.toFixed(2)} this month.`,
      achievedAt: new Date(),
      value: reductionPercentage,
      unit: '%',
      celebrationLevel: reductionPercentage >= 50 ? 'gold' : reductionPercentage >= 30 ? 'silver' : 'bronze',
      isNotified: false
    };

    return milestone;
  }

  private async createBudgetStreakMilestone(
    userId: string,
    streakDays: number
  ): Promise<Milestone> {
    const milestone: Milestone = {
      id: `milestone-streak-${userId}-${streakDays}-${Date.now()}`,
      userId,
      type: 'budget_streak',
      title: `${streakDays}-Day Budget Streak!`,
      description: `Fantastic! You've stayed within budget for ${streakDays} consecutive days. Keep up the great work!`,
      achievedAt: new Date(),
      value: streakDays,
      unit: 'days',
      celebrationLevel: streakDays >= 365 ? 'platinum' : streakDays >= 90 ? 'gold' : streakDays >= 30 ? 'silver' : 'bronze',
      isNotified: false
    };

    return milestone;
  }

  private calculateAmountMilestones(targetAmount: number, currency: string): number[] {
    const milestoneInterval = currency === 'KES' ? 10000 : currency === 'USD' ? 1000 : 1000;
    const milestones: number[] = [];
    
    for (let amount = milestoneInterval; amount < targetAmount; amount += milestoneInterval) {
      milestones.push(amount);
    }
    
    return milestones;
  }

  private calculateCelebrationLevel(amount: number, targetAmount: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
    const percentage = (amount / targetAmount) * 100;
    
    if (percentage >= 90) return 'platinum';
    if (percentage >= 75) return 'gold';
    if (percentage >= 50) return 'silver';
    return 'bronze';
  }

  private async generateCelebratoryNotification(milestone: Milestone, user: User): Promise<void> {
    try {
      const notification = await this.notificationService.generateMilestoneNotification(
        user.id,
        milestone.type,
        {
          title: milestone.title,
          description: milestone.description,
          value: milestone.value,
          unit: milestone.unit,
          celebrationLevel: milestone.celebrationLevel,
          goalId: milestone.goalId
        }
      );

      // Schedule immediate delivery for milestone notifications
      await this.notificationService.scheduleNotification(notification);
      
      milestone.isNotified = true;

      logger.info('Celebratory notification generated for milestone', { 
        milestoneId: milestone.id,
        userId: user.id,
        type: milestone.type
      });
    } catch (error) {
      logger.error('Error generating celebratory notification', { 
        milestoneId: milestone.id, 
        error 
      });
    }
  }
}