import { SavingsGoal, Transaction, AutomationRule, User } from '@finwise-ai/shared';
import { logger } from '../utils/logger';

export interface SavingsCalculation {
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  projectedCompletion: Date;
  confidence: number;
}

export interface SavingsOffer {
  transactionId: string;
  suggestedAmount: number;
  rule: AutomationRule;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

export interface TransferAttempt {
  id: string;
  goalId: string;
  amount: number;
  attemptNumber: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  failureReason?: string;
}

export interface SavingsStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastSavingDate: Date;
  totalSavings: number;
  achievements: string[];
}

export class SavingsRetryManager {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s
  
  /**
   * Execute savings transfer with retry logic
   */
  async executeTransferWithRetry(
    goalId: string,
    amount: number,
    userId: string
  ): Promise<TransferAttempt> {
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      const transferAttempt: TransferAttempt = {
        id: transferId,
        goalId,
        amount,
        attemptNumber: attempt,
        status: 'pending',
        timestamp: new Date()
      };
      
      try {
        // Simulate external API call to Nabo Capital
        const result = await this.callNaboCapitalAPI(amount, userId);
        
        if (result.success) {
          transferAttempt.status = 'completed';
          return transferAttempt;
        } else {
          transferAttempt.status = 'failed';
          transferAttempt.failureReason = result.error;
          
          // If this is the last attempt, return the failed attempt
          if (attempt === this.MAX_RETRY_ATTEMPTS) {
            return transferAttempt;
          }
          
          // Wait before retrying
          await this.delay(this.RETRY_DELAYS[attempt - 1]);
        }
      } catch (error: any) {
        transferAttempt.status = 'failed';
        transferAttempt.failureReason = error?.message || 'Unknown error occurred';
        
        if (attempt === this.MAX_RETRY_ATTEMPTS) {
          return transferAttempt;
        }
        
        await this.delay(this.RETRY_DELAYS[attempt - 1]);
      }
    }
    
    // This should never be reached, but included for completeness
    return {
      id: transferId,
      goalId,
      amount,
      attemptNumber: this.MAX_RETRY_ATTEMPTS,
      status: 'failed',
      timestamp: new Date(),
      failureReason: 'Maximum retry attempts exceeded'
    };
  }
  
  /**
   * Batch process multiple transfers with retry logic
   */
  async processBatchTransfers(
    transfers: Array<{ goalId: string; amount: number; userId: string }>
  ): Promise<TransferAttempt[]> {
    const results: TransferAttempt[] = [];
    
    // Process transfers sequentially to avoid overwhelming the external API
    for (const transfer of transfers) {
      const result = await this.executeTransferWithRetry(
        transfer.goalId,
        transfer.amount,
        transfer.userId
      );
      results.push(result);
      
      // Small delay between transfers
      await this.delay(500);
    }
    
    return results;
  }
  
  /**
   * Get retry statistics for monitoring
   */
  getRetryStatistics(attempts: TransferAttempt[]): {
    totalAttempts: number;
    successfulTransfers: number;
    failedTransfers: number;
    averageAttempts: number;
    successRate: number;
  } {
    const totalAttempts = attempts.length;
    const successfulTransfers = attempts.filter(a => a.status === 'completed').length;
    const failedTransfers = attempts.filter(a => a.status === 'failed').length;
    const averageAttempts = attempts.reduce((sum, a) => sum + a.attemptNumber, 0) / totalAttempts;
    const successRate = successfulTransfers / totalAttempts;
    
    return {
      totalAttempts,
      successfulTransfers,
      failedTransfers,
      averageAttempts,
      successRate
    };
  }
  
  private async callNaboCapitalAPI(amount: number, userId: string): Promise<{ success: boolean; error?: string }> {
    // Simulate API call with random success/failure for testing
    // In real implementation, this would call the actual Nabo Capital API
    const random = Math.random();
    
    if (random < 0.8) { // 80% success rate
      return { success: true };
    } else {
      const errors = [
        'Insufficient funds',
        'Network timeout',
        'Service temporarily unavailable',
        'Invalid account details'
      ];
      return { 
        success: false, 
        error: errors[Math.floor(Math.random() * errors.length)]
      };
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class SavingsStreakTracker {
  /**
   * Update savings streak for a user based on successful transfer
   */
  updateStreak(
    currentStreak: SavingsStreak,
    transferAttempt: TransferAttempt
  ): SavingsStreak {
    const today = new Date();
    const lastSavingDate = new Date(currentStreak.lastSavingDate);
    const daysDifference = Math.floor((today.getTime() - lastSavingDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let newStreak = { ...currentStreak };
    
    if (transferAttempt.status === 'completed') {
      // Update total savings
      newStreak.totalSavings += transferAttempt.amount;
      newStreak.lastSavingDate = today;
      
      // Update streak logic
      if (daysDifference === 0) {
        // Same day - no streak change
        return newStreak;
      } else if (daysDifference === 1) {
        // Consecutive day - increment streak
        newStreak.currentStreak += 1;
        newStreak.longestStreak = Math.max(newStreak.longestStreak, newStreak.currentStreak);
      } else if (daysDifference <= 3) {
        // Within grace period - maintain streak
        newStreak.currentStreak += 1;
        newStreak.longestStreak = Math.max(newStreak.longestStreak, newStreak.currentStreak);
      } else {
        // Streak broken - reset to 1
        newStreak.currentStreak = 1;
      }
      
      // Check for new achievements
      newStreak.achievements = this.checkForNewAchievements(newStreak);
    }
    
    return newStreak;
  }
  
  /**
   * Calculate streak statistics for multiple users
   */
  calculateStreakStatistics(streaks: SavingsStreak[]): {
    averageCurrentStreak: number;
    averageLongestStreak: number;
    totalSavingsAmount: number;
    activeStreakers: number;
    topPerformers: SavingsStreak[];
  } {
    const activeStreakers = streaks.filter(s => s.currentStreak > 0).length;
    const averageCurrentStreak = streaks.reduce((sum, s) => sum + s.currentStreak, 0) / streaks.length;
    const averageLongestStreak = streaks.reduce((sum, s) => sum + s.longestStreak, 0) / streaks.length;
    const totalSavingsAmount = streaks.reduce((sum, s) => sum + s.totalSavings, 0);
    
    // Top 5 performers by longest streak
    const topPerformers = streaks
      .sort((a, b) => b.longestStreak - a.longestStreak)
      .slice(0, 5);
    
    return {
      averageCurrentStreak,
      averageLongestStreak,
      totalSavingsAmount,
      activeStreakers,
      topPerformers
    };
  }
  
  /**
   * Generate gamified feedback based on streak performance
   */
  generateStreakFeedback(streak: SavingsStreak): {
    message: string;
    encouragement: string;
    nextMilestone: string;
    badgeEarned?: string;
  } {
    const { currentStreak, longestStreak, totalSavings } = streak;
    
    let message = '';
    let encouragement = '';
    let nextMilestone = '';
    let badgeEarned: string | undefined;
    
    // Generate message based on current streak
    if (currentStreak === 0) {
      message = "Ready to start your savings journey?";
      encouragement = "Every expert was once a beginner. Start small, dream big!";
      nextMilestone = "Save for 1 day to start your streak";
    } else if (currentStreak < 7) {
      message = `${currentStreak} day${currentStreak > 1 ? 's' : ''} strong! 💪`;
      encouragement = "You're building a great habit. Keep it up!";
      nextMilestone = `${7 - currentStreak} more days to reach your first week`;
    } else if (currentStreak < 30) {
      message = `Amazing ${currentStreak}-day streak! 🔥`;
      encouragement = "You're on fire! Your future self will thank you.";
      nextMilestone = `${30 - currentStreak} more days to reach a full month`;
    } else if (currentStreak < 100) {
      message = `Incredible ${currentStreak}-day streak! 🌟`;
      encouragement = "You're a savings superstar! This is life-changing.";
      nextMilestone = `${100 - currentStreak} more days to join the 100-day club`;
    } else {
      message = `Legendary ${currentStreak}-day streak! 👑`;
      encouragement = "You've mastered the art of saving. You're an inspiration!";
      nextMilestone = "Keep going to maintain your legendary status";
    }
    
    // Check for badge achievements
    if (currentStreak === 7) {
      badgeEarned = "Week Warrior";
    } else if (currentStreak === 30) {
      badgeEarned = "Monthly Master";
    } else if (currentStreak === 100) {
      badgeEarned = "Century Saver";
    } else if (totalSavings >= 10000) {
      badgeEarned = "10K Club";
    }
    
    return {
      message,
      encouragement,
      nextMilestone,
      badgeEarned
    };
  }
  
  /**
   * Check for new achievements based on streak data
   */
  private checkForNewAchievements(streak: SavingsStreak): string[] {
    const achievements = [...streak.achievements];
    
    // Streak-based achievements
    if (streak.currentStreak >= 7 && !achievements.includes('Week Warrior')) {
      achievements.push('Week Warrior');
    }
    if (streak.currentStreak >= 30 && !achievements.includes('Monthly Master')) {
      achievements.push('Monthly Master');
    }
    if (streak.currentStreak >= 100 && !achievements.includes('Century Saver')) {
      achievements.push('Century Saver');
    }
    if (streak.longestStreak >= 365 && !achievements.includes('Year Long Saver')) {
      achievements.push('Year Long Saver');
    }
    
    // Amount-based achievements
    if (streak.totalSavings >= 1000 && !achievements.includes('First 1K')) {
      achievements.push('First 1K');
    }
    if (streak.totalSavings >= 10000 && !achievements.includes('10K Club')) {
      achievements.push('10K Club');
    }
    if (streak.totalSavings >= 100000 && !achievements.includes('100K Champion')) {
      achievements.push('100K Champion');
    }
    
    return achievements;
  }
  
  /**
   * Get streak leaderboard for gamification
   */
  getStreakLeaderboard(streaks: SavingsStreak[], limit: number = 10): Array<{
    userId: string;
    currentStreak: number;
    longestStreak: number;
    totalSavings: number;
    rank: number;
  }> {
    return streaks
      .sort((a, b) => {
        // Sort by current streak first, then by total savings
        if (b.currentStreak !== a.currentStreak) {
          return b.currentStreak - a.currentStreak;
        }
        return b.totalSavings - a.totalSavings;
      })
      .slice(0, limit)
      .map((streak, index) => ({
        userId: streak.userId,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        totalSavings: streak.totalSavings,
        rank: index + 1
      }));
  }
}

export class SavingsOfferGenerator {
  private readonly MINIMUM_TRANSFER_KES = 50;
  private readonly MINIMUM_TRANSFER_USD = 1;
  
  /**
   * Generate savings offer for a transaction based on user preferences and goals
   */
  generateSavingsOffer(
    transaction: Transaction,
    user: User,
    activeGoals: SavingsGoal[]
  ): SavingsOffer | null {
    const { savingsAutomation } = user.preferences;
    
    // Skip if automation is disabled
    if (!savingsAutomation.enabled) {
      return null;
    }
    
    // Skip for very small transactions (less than 100 KES or equivalent)
    const minTransactionAmount = transaction.currency === 'KES' ? 100 : 5;
    if (transaction.amount < minTransactionAmount) {
      return null;
    }
    
    // Find the most relevant goal for this transaction
    const targetGoal = this.selectTargetGoal(transaction, activeGoals);
    if (!targetGoal) {
      return null;
    }
    
    // Calculate suggested amount based on automation rules
    const suggestedAmount = this.calculateOfferAmount(transaction, savingsAutomation, targetGoal);
    
    // Apply minimum transfer validation
    if (!this.meetsMinimumTransfer(suggestedAmount, transaction.currency)) {
      return null;
    }
    
    // Determine offer priority based on goal urgency and user behavior
    const priority = this.calculateOfferPriority(targetGoal, transaction, user);
    
    // Create automation rule for this offer
    const rule: AutomationRule = {
      id: `offer_${transaction.id}`,
      type: this.determineRuleType(savingsAutomation),
      value: this.getRuleValue(savingsAutomation),
      isActive: true
    };
    
    return {
      transactionId: transaction.id,
      suggestedAmount,
      rule,
      reason: this.generateOfferReason(targetGoal, suggestedAmount, transaction),
      priority
    };
  }
  
  /**
   * Generate multiple savings offers for bulk transactions
   */
  generateBulkSavingsOffers(
    transactions: Transaction[],
    user: User,
    activeGoals: SavingsGoal[]
  ): SavingsOffer[] {
    const offers: SavingsOffer[] = [];
    
    for (const transaction of transactions) {
      const offer = this.generateSavingsOffer(transaction, user, activeGoals);
      if (offer) {
        offers.push(offer);
      }
    }
    
    // Sort offers by priority and potential impact
    return offers.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return (priorityWeight[b.priority] * b.suggestedAmount) - (priorityWeight[a.priority] * a.suggestedAmount);
    });
  }
  
  /**
   * Customize offer based on user preferences and historical behavior
   */
  customizeOfferForUser(
    baseOffer: SavingsOffer,
    user: User,
    savingsHistory: TransferAttempt[]
  ): SavingsOffer | null {
    const { savingsAutomation } = user.preferences;
    let customizedAmount = baseOffer.suggestedAmount;
    
    // Adjust based on user's historical acceptance rate
    const acceptanceRate = this.calculateOfferAcceptanceRate(savingsHistory);
    if (acceptanceRate < 0.3) {
      // Lower amounts for users who rarely accept offers
      customizedAmount = Math.round(customizedAmount * 0.7);
    } else if (acceptanceRate > 0.8) {
      // Slightly higher amounts for users who frequently accept
      customizedAmount = Math.round(customizedAmount * 1.2);
    }
    
    // Apply user's preferred percentage if set
    if (savingsAutomation.percentageSavings > 0) {
      const percentageAmount = Math.round(baseOffer.suggestedAmount * (savingsAutomation.percentageSavings / 100));
      customizedAmount = Math.max(customizedAmount, percentageAmount);
    }
    
    // Ensure minimum transfer requirements
    if (!this.meetsMinimumTransfer(customizedAmount, user.currency)) {
      return null;
    }
    
    return {
      ...baseOffer,
      suggestedAmount: customizedAmount,
      reason: this.generateCustomizedReason(baseOffer.reason, acceptanceRate, user)
    };
  }
  
  /**
   * Handle minimum transfer amount requirements (50 KES minimum)
   */
  meetsMinimumTransfer(amount: number, currency: string): boolean {
    switch (currency) {
      case 'KES':
        return amount >= this.MINIMUM_TRANSFER_KES;
      case 'USD':
      case 'EUR':
      case 'GBP':
        return amount >= this.MINIMUM_TRANSFER_USD;
      default:
        return amount >= this.MINIMUM_TRANSFER_KES; // Default to KES minimum
    }
  }
  
  /**
   * Accumulate small amounts until minimum transfer is reached
   */
  accumulateForMinimumTransfer(
    pendingAmounts: number[],
    currency: string
  ): { canTransfer: boolean; totalAmount: number; remainingAmounts: number[] } {
    const totalAmount = pendingAmounts.reduce((sum, amount) => sum + amount, 0);
    const meetsMinimum = this.meetsMinimumTransfer(totalAmount, currency);
    
    if (meetsMinimum) {
      return {
        canTransfer: true,
        totalAmount,
        remainingAmounts: []
      };
    }
    
    return {
      canTransfer: false,
      totalAmount,
      remainingAmounts: pendingAmounts
    };
  }
  
  private selectTargetGoal(transaction: Transaction, goals: SavingsGoal[]): SavingsGoal | null {
    if (goals.length === 0) return null;
    
    // Prioritize goals by urgency and progress
    return goals
      .filter(g => g.isActive)
      .sort((a, b) => {
        const aUrgency = (a.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        const bUrgency = (b.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        const aProgress = a.currentAmount / a.targetAmount;
        const bProgress = b.currentAmount / b.targetAmount;
        
        return (aUrgency - bUrgency) + (bProgress - aProgress) * 30;
      })[0];
  }
  
  private calculateOfferAmount(
    transaction: Transaction,
    preferences: any,
    goal: SavingsGoal
  ): number {
    let amount = 0;
    
    // Apply round-up if enabled
    if (preferences.roundUpSavings) {
      const roundUpAmount = this.calculateRoundUpAmount(transaction.amount, transaction.currency);
      amount += roundUpAmount;
    }
    
    // Apply percentage savings if set
    if (preferences.percentageSavings > 0) {
      const percentageAmount = Math.round(transaction.amount * (preferences.percentageSavings / 100));
      amount += percentageAmount;
    }
    
    // Ensure we don't exceed what's needed for the goal
    const remainingForGoal = goal.targetAmount - goal.currentAmount;
    amount = Math.min(amount, remainingForGoal);
    
    return Math.round(amount);
  }
  
  private calculateRoundUpAmount(transactionAmount: number, currency: string): number {
    const roundingUnit = currency === 'KES' ? 10 : 1;
    const roundedAmount = Math.ceil(transactionAmount / roundingUnit) * roundingUnit;
    return roundedAmount - transactionAmount;
  }
  
  private calculateOfferPriority(
    goal: SavingsGoal,
    transaction: Transaction,
    user: User
  ): 'low' | 'medium' | 'high' {
    const daysUntilDeadline = (goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
    
    // High priority: urgent goals or large transactions
    if (daysUntilDeadline < 30 || transaction.amount > 1000) {
      return 'high';
    }
    
    // Medium priority: moderate progress or medium transactions
    if (progressPercentage > 50 || transaction.amount > 500) {
      return 'medium';
    }
    
    return 'low';
  }
  
  private determineRuleType(preferences: any): 'roundup' | 'percentage' | 'fixed' {
    if (preferences.roundUpSavings && preferences.percentageSavings > 0) {
      return 'roundup'; // Prefer round-up when both are enabled
    } else if (preferences.percentageSavings > 0) {
      return 'percentage';
    } else if (preferences.roundUpSavings) {
      return 'roundup';
    }
    return 'fixed';
  }
  
  private getRuleValue(preferences: any): number {
    if (preferences.percentageSavings > 0) {
      return preferences.percentageSavings;
    }
    return preferences.minimumTransfer || 50;
  }
  
  private generateOfferReason(goal: SavingsGoal, amount: number, transaction: Transaction): string {
    const daysUntilDeadline = Math.ceil((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const progressPercentage = Math.round((goal.currentAmount / goal.targetAmount) * 100);
    
    return `Save ${amount} ${transaction.currency} towards "${goal.name}" (${progressPercentage}% complete, ${daysUntilDeadline} days remaining)`;
  }
  
  private calculateOfferAcceptanceRate(history: TransferAttempt[]): number {
    if (history.length === 0) return 0.5; // Default assumption
    
    const completedTransfers = history.filter(t => t.status === 'completed').length;
    return completedTransfers / history.length;
  }
  
  private generateCustomizedReason(baseReason: string, acceptanceRate: number, user: User): string {
    if (acceptanceRate < 0.3) {
      return `${baseReason} (Small amount to help you get started)`;
    } else if (acceptanceRate > 0.8) {
      return `${baseReason} (You're doing great with consistent saving!)`;
    }
    return baseReason;
  }
}

export class SavingsCalculationEngine {
  /**
   * Calculate optimal micro-saving amount for a given goal
   * Based on goal timeline, current progress, and user's spending patterns
   */
  calculateOptimalSavingAmount(
    goal: SavingsGoal,
    userSpendingAverage: number,
    timeHorizonDays: number
  ): SavingsCalculation {
    const remainingAmount = goal.targetAmount - goal.currentAmount;
    const daysUntilDeadline = Math.max(1, Math.floor((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    
    // Calculate base daily amount needed
    const baseDailyAmount = remainingAmount / daysUntilDeadline;
    
    // Adjust based on user's spending capacity (max 10% of daily average spending)
    const maxAffordableDaily = userSpendingAverage * 0.1;
    const recommendedDaily = Math.min(baseDailyAmount, maxAffordableDaily);
    
    // Ensure minimum viable amount (at least 10 KES per day)
    const finalDailyAmount = Math.max(recommendedDaily, 10);
    
    // Calculate confidence based on feasibility
    const feasibilityRatio = recommendedDaily / baseDailyAmount;
    const confidence = Math.min(1, feasibilityRatio) * 100;
    
    // Determine optimal frequency based on amount
    let frequency: 'daily' | 'weekly' | 'monthly';
    let amount: number;
    
    if (finalDailyAmount <= 50) {
      frequency = 'daily';
      amount = finalDailyAmount;
    } else if (finalDailyAmount <= 200) {
      frequency = 'weekly';
      amount = finalDailyAmount * 7;
    } else {
      frequency = 'monthly';
      amount = finalDailyAmount * 30;
    }
    
    // Project completion date
    const dailyRate = amount / (frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30);
    const daysToComplete = Math.ceil(remainingAmount / dailyRate);
    const projectedCompletion = new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000);
    
    return {
      amount,
      frequency,
      projectedCompletion,
      confidence
    };
  }

  /**
   * Calculate round-up savings amount for a transaction
   */
  calculateRoundUpAmount(transactionAmount: number, currency: string = 'KES'): number {
    // Round up to nearest 10 for KES, nearest 1 for other currencies
    const roundingUnit = currency === 'KES' ? 10 : 1;
    const roundedAmount = Math.ceil(transactionAmount / roundingUnit) * roundingUnit;
    return roundedAmount - transactionAmount;
  }

  /**
   * Calculate percentage-based savings amount
   */
  calculatePercentageSavings(transactionAmount: number, percentage: number): number {
    return Math.round(transactionAmount * (percentage / 100));
  }

  /**
   * Apply automation rules to calculate savings for a transaction
   */
  applySavingsRules(transaction: Transaction, rules: AutomationRule[]): number {
    let totalSavings = 0;
    
    for (const rule of rules.filter(r => r.isActive)) {
      let ruleAmount = 0;
      
      switch (rule.type) {
        case 'roundup':
          ruleAmount = this.calculateRoundUpAmount(transaction.amount, transaction.currency);
          break;
        case 'percentage':
          ruleAmount = this.calculatePercentageSavings(transaction.amount, rule.value);
          break;
        case 'fixed':
          ruleAmount = rule.value;
          break;
      }
      
      // Apply rule conditions if they exist
      if (rule.conditions && rule.conditions.length > 0) {
        const conditionsMet = this.evaluateRuleConditions(transaction, rule.conditions);
        if (conditionsMet) {
          totalSavings += ruleAmount;
        }
      } else {
        totalSavings += ruleAmount;
      }
    }
    
    return Math.round(totalSavings);
  }

  /**
   * Evaluate rule conditions against a transaction
   */
  private evaluateRuleConditions(transaction: Transaction, conditions: any[]): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getTransactionFieldValue(transaction, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        default:
          return false;
      }
    });
  }

  /**
   * Get field value from transaction for rule evaluation
   */
  private getTransactionFieldValue(transaction: Transaction, field: string): any {
    switch (field) {
      case 'amount':
        return transaction.amount;
      case 'category':
        return transaction.category;
      case 'description':
        return transaction.description;
      case 'merchant':
        return transaction.merchant;
      default:
        return null;
    }
  }

  /**
   * Calculate goal-based savings planning with multiple goals
   */
  planGoalBasedSavings(
    goals: SavingsGoal[],
    userSpendingAverage: number,
    availableSavingsCapacity: number
  ): Map<string, SavingsCalculation> {
    const activeGoals = goals.filter(g => g.isActive);
    const savingsPlans = new Map<string, SavingsCalculation>();
    
    // Sort goals by priority (deadline proximity and completion percentage)
    const prioritizedGoals = activeGoals.sort((a, b) => {
      const aUrgency = (a.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      const bUrgency = (b.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      const aProgress = a.currentAmount / a.targetAmount;
      const bProgress = b.currentAmount / b.targetAmount;
      
      // Prioritize by urgency first, then by progress
      return (aUrgency - bUrgency) + (bProgress - aProgress) * 30;
    });
    
    let remainingCapacity = availableSavingsCapacity;
    
    for (const goal of prioritizedGoals) {
      if (remainingCapacity <= 0) break;
      
      const timeHorizon = Math.max(1, Math.floor((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      const calculation = this.calculateOptimalSavingAmount(goal, userSpendingAverage, timeHorizon);
      
      // Adjust amount based on remaining capacity
      const adjustedAmount = Math.min(calculation.amount, remainingCapacity);
      const adjustedCalculation = {
        ...calculation,
        amount: adjustedAmount,
        confidence: calculation.confidence * (adjustedAmount / calculation.amount)
      };
      
      savingsPlans.set(goal.id, adjustedCalculation);
      remainingCapacity -= adjustedAmount;
    }
    
    return savingsPlans;
  }
}

/**
 * Main Savings Automator Service that orchestrates all savings functionality
 */
export class SavingsAutomatorService {
  private calculationEngine: SavingsCalculationEngine;
  private offerGenerator: SavingsOfferGenerator;
  private retryManager: SavingsRetryManager;
  private streakTracker: SavingsStreakTracker;
  
  constructor() {
    this.calculationEngine = new SavingsCalculationEngine();
    this.offerGenerator = new SavingsOfferGenerator();
    this.retryManager = new SavingsRetryManager();
    this.streakTracker = new SavingsStreakTracker();
  }
  
  /**
   * Process a transaction and generate savings offer if applicable
   */
  async processTransactionForSavings(
    transaction: Transaction,
    user: User,
    activeGoals: SavingsGoal[]
  ): Promise<SavingsOffer | null> {
    const offer = this.offerGenerator.generateSavingsOffer(transaction, user, activeGoals);
    
    if (offer && user.preferences.savingsAutomation.autoTransfer) {
      // Auto-execute the transfer if user has auto-transfer enabled
      const transferResult = await this.retryManager.executeTransferWithRetry(
        activeGoals[0]?.id || 'default',
        offer.suggestedAmount,
        user.id
      );
      
      // Update streak if transfer was successful
      if (transferResult.status === 'completed') {
        // This would typically fetch the current streak from database
        const currentStreak: SavingsStreak = {
          userId: user.id,
          currentStreak: 0,
          longestStreak: 0,
          lastSavingDate: new Date(Date.now() - 86400000), // Yesterday
          totalSavings: 0,
          achievements: []
        };
        
        const updatedStreak = this.streakTracker.updateStreak(currentStreak, transferResult);
        // Save updated streak to database here
      }
    }
    
    return offer;
  }
  
  /**
   * Calculate optimal savings plan for user's goals
   */
  calculateSavingsPlan(
    goals: SavingsGoal[],
    userSpendingAverage: number,
    availableSavingsCapacity: number
  ): Map<string, SavingsCalculation> {
    return this.calculationEngine.planGoalBasedSavings(
      goals,
      userSpendingAverage,
      availableSavingsCapacity
    );
  }
  
  /**
   * Get gamified feedback for user's savings performance
   */
  getSavingsFeedback(streak: SavingsStreak): {
    message: string;
    encouragement: string;
    nextMilestone: string;
    badgeEarned?: string;
  } {
    return this.streakTracker.generateStreakFeedback(streak);
  }
  
  /**
   * Execute manual savings transfer with retry logic
   */
  async executeSavingsTransfer(
    goalId: string,
    amount: number,
    userId: string
  ): Promise<TransferAttempt> {
    return this.retryManager.executeTransferWithRetry(goalId, amount, userId);
  }
  
  /**
   * Get savings statistics for dashboard
   */
  getSavingsStatistics(
    streaks: SavingsStreak[],
    transferAttempts: TransferAttempt[]
  ): {
    streakStats: any;
    transferStats: any;
    leaderboard: any[];
  } {
    const streakStats = this.streakTracker.calculateStreakStatistics(streaks);
    const transferStats = this.retryManager.getRetryStatistics(transferAttempts);
    const leaderboard = this.streakTracker.getStreakLeaderboard(streaks);
    
    return {
      streakStats,
      transferStats,
      leaderboard
    };
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
      return {
        status: 'healthy',
        message: 'Savings Automator service is operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Savings Automator service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const savingsAutomatorService = new SavingsAutomatorService();