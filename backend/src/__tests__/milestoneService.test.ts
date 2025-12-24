import { MilestoneService } from '../services/milestoneService';
import { NotificationService } from '../services/notificationService';
import { SavingsGoal, User, SpendingPattern } from '@finwise-ai/shared';

// Mock the notification service
jest.mock('../services/notificationService');

describe('MilestoneService', () => {
  let milestoneService: MilestoneService;
  let mockNotificationService: jest.Mocked<NotificationService>;

  const mockUser: User = {
    id: 'user123',
    email: 'test@example.com',
    phoneNumber: '+254700000000',
    country: 'KE',
    currency: 'KES',
    preferences: {
      language: 'en',
      notifications: {
        spendingAlerts: true,
        savingsReminders: true,
        goalMilestones: true,
        weeklyReports: false
      },
      savingsAutomation: {
        enabled: true,
        roundUpSavings: true,
        percentageSavings: 10,
        minimumTransfer: 50,
        autoTransfer: true
      },
      categories: []
    },
    createdAt: new Date('2024-01-01'),
    lastActive: new Date()
  };

  const mockGoal: SavingsGoal = {
    id: 'goal123',
    userId: 'user123',
    name: 'Emergency Fund',
    targetAmount: 100000,
    currentAmount: 25000,
    deadline: new Date('2024-12-31'),
    automationRules: [],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  };

  beforeEach(() => {
    mockNotificationService = new NotificationService() as jest.Mocked<NotificationService>;
    mockNotificationService.generateMilestoneNotification = jest.fn().mockResolvedValue({
      id: 'notification123',
      userId: 'user123',
      type: 'milestone',
      title: 'Milestone Achieved!',
      message: 'Test milestone',
      data: {},
      isRead: false,
      createdAt: new Date(),
      scheduledFor: new Date()
    });
    mockNotificationService.scheduleNotification = jest.fn().mockResolvedValue(undefined);

    milestoneService = new MilestoneService(mockNotificationService);
  });

  describe('checkSavingsGoalMilestones', () => {
    it('should detect 25% milestone achievement', async () => {
      const previousAmount = 20000; // 20%
      const currentGoal = { ...mockGoal, currentAmount: 25000 }; // 25%

      const milestones = await milestoneService.checkSavingsGoalMilestones(
        currentGoal,
        previousAmount,
        mockUser
      );

      expect(milestones).toHaveLength(1);
      expect(milestones[0].title).toBe('25% Progress');
      expect(milestones[0].value).toBe(25);
      expect(milestones[0].celebrationLevel).toBe('bronze');
      expect(milestones[0].type).toBe('savings_goal');
    });

    it('should detect 50% milestone achievement', async () => {
      const previousAmount = 40000; // 40%
      const currentGoal = { ...mockGoal, currentAmount: 50000 }; // 50%

      const milestones = await milestoneService.checkSavingsGoalMilestones(
        currentGoal,
        previousAmount,
        mockUser
      );

      expect(milestones.length).toBeGreaterThanOrEqual(1);
      const percentageMilestone = milestones.find(m => m.unit === '%');
      expect(percentageMilestone?.title).toBe('50% Progress');
      expect(percentageMilestone?.celebrationLevel).toBe('silver');
    });

    it('should detect goal completion (100%)', async () => {
      const previousAmount = 95000; // 95%
      const currentGoal = { ...mockGoal, currentAmount: 100000 }; // 100%

      const milestones = await milestoneService.checkSavingsGoalMilestones(
        currentGoal,
        previousAmount,
        mockUser
      );

      expect(milestones).toHaveLength(1);
      expect(milestones[0].title).toBe('Goal Completed!');
      expect(milestones[0].celebrationLevel).toBe('platinum');
      expect(milestones[0].description).toContain('Congratulations!');
    });

    it('should detect amount-based milestones', async () => {
      const previousAmount = 5000;
      const currentGoal = { ...mockGoal, currentAmount: 15000 }; // Crosses 10,000 KES milestone

      const milestones = await milestoneService.checkSavingsGoalMilestones(
        currentGoal,
        previousAmount,
        mockUser
      );

      expect(milestones.length).toBeGreaterThan(0);
      const amountMilestone = milestones.find(m => m.unit === 'KES');
      expect(amountMilestone).toBeDefined();
      expect(amountMilestone?.value).toBe(10000);
    });

    it('should not detect milestones when progress decreases', async () => {
      const previousAmount = 30000; // 30%
      const currentGoal = { ...mockGoal, currentAmount: 20000 }; // 20% (decreased)

      const milestones = await milestoneService.checkSavingsGoalMilestones(
        currentGoal,
        previousAmount,
        mockUser
      );

      expect(milestones).toHaveLength(0);
    });

    it('should generate celebratory notifications for milestones', async () => {
      const previousAmount = 20000;
      const currentGoal = { ...mockGoal, currentAmount: 25000 };

      await milestoneService.checkSavingsGoalMilestones(
        currentGoal,
        previousAmount,
        mockUser
      );

      expect(mockNotificationService.generateMilestoneNotification).toHaveBeenCalled();
      expect(mockNotificationService.scheduleNotification).toHaveBeenCalled();
    });
  });

  describe('checkSpendingReductionMilestones', () => {
    it('should detect significant spending reduction', async () => {
      const previousPatterns: SpendingPattern[] = [
        {
          userId: 'user123',
          category: 'Food',
          averageMonthly: 10000,
          trend: 'stable',
          anomalyScore: 0.1,
          lastAnalyzed: new Date(),
          confidence: 0.9
        }
      ];

      const currentPatterns: SpendingPattern[] = [
        {
          userId: 'user123',
          category: 'Food',
          averageMonthly: 7000, // 30% reduction
          trend: 'decreasing',
          anomalyScore: 0.1,
          lastAnalyzed: new Date(),
          confidence: 0.9
        }
      ];

      const milestones = await milestoneService.checkSpendingReductionMilestones(
        'user123',
        currentPatterns,
        previousPatterns
      );

      expect(milestones).toHaveLength(1);
      expect(milestones[0].type).toBe('spending_reduction');
      expect(milestones[0].title).toBe('Food Spending Reduced!');
      expect(milestones[0].value).toBe(30);
      expect(milestones[0].celebrationLevel).toBe('silver');
    });

    it('should not detect milestones for small reductions', async () => {
      const previousPatterns: SpendingPattern[] = [
        {
          userId: 'user123',
          category: 'Food',
          averageMonthly: 10000,
          trend: 'stable',
          anomalyScore: 0.1,
          lastAnalyzed: new Date(),
          confidence: 0.9
        }
      ];

      const currentPatterns: SpendingPattern[] = [
        {
          userId: 'user123',
          category: 'Food',
          averageMonthly: 9000, // Only 10% reduction
          trend: 'decreasing',
          anomalyScore: 0.1,
          lastAnalyzed: new Date(),
          confidence: 0.9
        }
      ];

      const milestones = await milestoneService.checkSpendingReductionMilestones(
        'user123',
        currentPatterns,
        previousPatterns
      );

      expect(milestones).toHaveLength(0);
    });
  });

  describe('checkBudgetStreakMilestones', () => {
    it('should detect 7-day budget streak', async () => {
      const milestones = await milestoneService.checkBudgetStreakMilestones('user123', 7);

      expect(milestones).toHaveLength(1);
      expect(milestones[0].type).toBe('budget_streak');
      expect(milestones[0].title).toBe('7-Day Budget Streak!');
      expect(milestones[0].value).toBe(7);
      expect(milestones[0].celebrationLevel).toBe('bronze');
    });

    it('should detect 30-day budget streak with silver level', async () => {
      const milestones = await milestoneService.checkBudgetStreakMilestones('user123', 30);

      expect(milestones).toHaveLength(1);
      expect(milestones[0].celebrationLevel).toBe('silver');
    });

    it('should detect 365-day budget streak with platinum level', async () => {
      const milestones = await milestoneService.checkBudgetStreakMilestones('user123', 365);

      expect(milestones).toHaveLength(1);
      expect(milestones[0].celebrationLevel).toBe('platinum');
    });

    it('should not detect milestones for non-milestone days', async () => {
      const milestones = await milestoneService.checkBudgetStreakMilestones('user123', 15);

      expect(milestones).toHaveLength(0);
    });
  });

  describe('getMilestoneProgress', () => {
    it('should calculate milestone progress correctly', () => {
      const progress = milestoneService.getMilestoneProgress(mockGoal);

      expect(progress.goalId).toBe('goal123');
      expect(progress.currentProgress).toBe(25000);
      expect(progress.targetAmount).toBe(100000);
      expect(progress.progressPercentage).toBe(25);
      expect(progress.nextMilestone).toBe(50); // Next milestone is 50%
    });

    it('should handle completed goals', () => {
      const completedGoal = { ...mockGoal, currentAmount: 100000 };
      const progress = milestoneService.getMilestoneProgress(completedGoal);

      expect(progress.progressPercentage).toBe(100);
      expect(progress.nextMilestone).toBe(100);
    });
  });

  describe('getUserMilestones', () => {
    it('should return empty array for user with no milestones', () => {
      const milestones = milestoneService.getUserMilestones('user123');
      expect(milestones).toHaveLength(0);
    });
  });

  describe('getMilestoneStatistics', () => {
    it('should return correct statistics structure', () => {
      const stats = milestoneService.getMilestoneStatistics('user123');

      expect(stats).toHaveProperty('totalMilestones');
      expect(stats).toHaveProperty('milestonesByType');
      expect(stats).toHaveProperty('recentMilestones');
      expect(stats).toHaveProperty('celebrationLevel');
      expect(typeof stats.totalMilestones).toBe('number');
      expect(Array.isArray(stats.recentMilestones)).toBe(true);
    });
  });
});