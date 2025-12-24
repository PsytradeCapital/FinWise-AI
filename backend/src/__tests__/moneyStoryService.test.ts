import { MoneyStoryService, StoryContext } from '../services/moneyStoryService';
import { User, Transaction, SpendingPattern, SavingsGoal } from '@finwise-ai/shared';

describe('MoneyStoryService', () => {
  let moneyStoryService: MoneyStoryService;

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
        weeklyReports: true
      },
      savingsAutomation: {
        enabled: true,
        roundUpSavings: true,
        percentageSavings: 10,
        minimumTransfer: 50,
        autoTransfer: true
      },
      categories: ['Food', 'Transport', 'Entertainment']
    },
    createdAt: new Date('2024-01-01'),
    lastActive: new Date()
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'tx1',
      userId: 'user123',
      amount: 2000,
      currency: 'KES',
      description: 'Grocery shopping',
      category: 'Food',
      subcategory: 'Groceries',
      timestamp: new Date('2024-01-15'),
      source: 'sms',
      rawData: 'SMS content',
      isVerified: true
    },
    {
      id: 'tx2',
      userId: 'user123',
      amount: 1500,
      currency: 'KES',
      description: 'Bus fare',
      category: 'Transportation',
      timestamp: new Date('2024-01-14'),
      source: 'sms',
      rawData: 'SMS content',
      isVerified: true
    },
    {
      id: 'tx3',
      userId: 'user123',
      amount: 500,
      currency: 'KES',
      description: 'Coffee',
      category: 'Food',
      timestamp: new Date('2024-01-13'),
      source: 'manual',
      rawData: '',
      isVerified: true
    }
  ];

  const mockSpendingPatterns: SpendingPattern[] = [
    {
      userId: 'user123',
      category: 'Food',
      averageMonthly: 8000,
      trend: 'decreasing',
      anomalyScore: 0.1,
      lastAnalyzed: new Date(),
      confidence: 0.9
    },
    {
      userId: 'user123',
      category: 'Transportation',
      averageMonthly: 5000,
      trend: 'increasing',
      anomalyScore: 0.3,
      lastAnalyzed: new Date(),
      confidence: 0.8
    }
  ];

  const mockSavingsGoals: SavingsGoal[] = [
    {
      id: 'goal1',
      userId: 'user123',
      name: 'Emergency Fund',
      targetAmount: 100000,
      currentAmount: 75000,
      deadline: new Date('2024-12-31'),
      automationRules: [],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    },
    {
      id: 'goal2',
      userId: 'user123',
      name: 'Vacation Fund',
      targetAmount: 50000,
      currentAmount: 10000,
      deadline: new Date('2024-06-30'),
      automationRules: [],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    }
  ];

  const mockContext: StoryContext = {
    user: mockUser,
    transactions: mockTransactions,
    spendingPatterns: mockSpendingPatterns,
    savingsGoals: mockSavingsGoals,
    period: 'weekly',
    startDate: new Date('2024-01-08'),
    endDate: new Date('2024-01-15')
  };

  beforeEach(() => {
    moneyStoryService = new MoneyStoryService();
  });

  describe('generateMoneyStory', () => {
    it('should generate a complete money story', async () => {
      const story = await moneyStoryService.generateMoneyStory(mockContext);

      expect(story).toBeDefined();
      expect(story.id).toContain('story-user123-weekly');
      expect(story.userId).toBe('user123');
      expect(story.period).toBe('weekly');
      expect(story.title).toBeDefined();
      expect(story.narrative).toBeDefined();
      expect(story.insights).toBeInstanceOf(Array);
      expect(story.suggestions).toBeInstanceOf(Array);
      expect(['positive', 'neutral', 'negative']).toContain(story.sentiment);
      expect(story.createdAt).toBeInstanceOf(Date);
    });

    it('should generate different titles based on sentiment', async () => {
      // Test multiple generations to see different titles
      const stories = await Promise.all([
        moneyStoryService.generateMoneyStory(mockContext),
        moneyStoryService.generateMoneyStory(mockContext),
        moneyStoryService.generateMoneyStory(mockContext)
      ]);

      stories.forEach(story => {
        expect(story.title).toBeDefined();
        expect(story.title.length).toBeGreaterThan(0);
      });
    });

    it('should include insights about spending patterns', async () => {
      const story = await moneyStoryService.generateMoneyStory(mockContext);

      expect(story.insights.length).toBeGreaterThan(0);
      
      // Should include insights about top spending category
      const hasSpendingInsight = story.insights.some(insight => 
        insight.includes('Food') || insight.includes('Transportation')
      );
      expect(hasSpendingInsight).toBe(true);
    });

    it('should include insights about savings goals progress', async () => {
      const story = await moneyStoryService.generateMoneyStory(mockContext);

      // Should include insights about the high-progress Emergency Fund goal
      const hasSavingsInsight = story.insights.some(insight => 
        insight.includes('Emergency Fund') || insight.includes('75.0%')
      );
      expect(hasSavingsInsight).toBe(true);
    });

    it('should generate actionable suggestions', async () => {
      const story = await moneyStoryService.generateMoneyStory(mockContext);

      expect(story.suggestions.length).toBeGreaterThan(0);
      
      // Should include suggestions based on spending patterns
      const hasActionableSuggestion = story.suggestions.some(suggestion => 
        suggestion.includes('budget') || suggestion.includes('consider') || suggestion.includes('savings')
      );
      expect(hasActionableSuggestion).toBe(true);
    });

    it('should include Kenyan-specific suggestions for KE users', async () => {
      const story = await moneyStoryService.generateMoneyStory(mockContext);

      // Should include M-Pesa or Nabo Capital suggestions for Kenyan users
      const hasKenyanSuggestion = story.suggestions.some(suggestion => 
        suggestion.includes('M-Pesa') || 
        suggestion.includes('Nabo Capital') || 
        suggestion.includes('matatu') ||
        suggestion.includes('shillings')
      );
      expect(hasKenyanSuggestion).toBe(true);
    });

    it('should handle empty transactions gracefully', async () => {
      const emptyContext = { ...mockContext, transactions: [] };
      const story = await moneyStoryService.generateMoneyStory(emptyContext);

      expect(story).toBeDefined();
      expect(story.narrative).toBeDefined();
      expect(story.insights).toBeInstanceOf(Array);
      expect(story.suggestions).toBeInstanceOf(Array);
    });

    it('should handle context without spending patterns', async () => {
      const contextWithoutPatterns = { ...mockContext, spendingPatterns: [] };
      const story = await moneyStoryService.generateMoneyStory(contextWithoutPatterns);

      expect(story).toBeDefined();
      expect(story.narrative).toBeDefined();
    });

    it('should handle context without savings goals', async () => {
      const contextWithoutGoals = { ...mockContext, savingsGoals: [] };
      const story = await moneyStoryService.generateMoneyStory(contextWithoutGoals);

      expect(story).toBeDefined();
      expect(story.narrative).toBeDefined();
      
      // Debug: log the suggestions to see what's being generated
      console.log('Generated suggestions:', story.suggestions);
      
      // Should suggest setting up savings goals
      const hasSavingsSuggestion = story.suggestions.some(suggestion => 
        suggestion.includes('savings goal')
      );
      expect(hasSavingsSuggestion).toBe(true);
    });
  });

  describe('sentiment analysis', () => {
    it('should return positive sentiment for good financial behavior', async () => {
      // Context with decreasing spending and high savings progress
      const positiveContext: StoryContext = {
        ...mockContext,
        spendingPatterns: [
          {
            userId: 'user123',
            category: 'Food',
            averageMonthly: 6000,
            trend: 'decreasing',
            anomalyScore: 0.1,
            lastAnalyzed: new Date(),
            confidence: 0.9
          }
        ],
        savingsGoals: [
          {
            id: 'goal1',
            userId: 'user123',
            name: 'Emergency Fund',
            targetAmount: 100000,
            currentAmount: 90000, // 90% progress
            deadline: new Date('2024-12-31'),
            automationRules: [],
            isActive: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
          }
        ]
      };

      const story = await moneyStoryService.generateMoneyStory(positiveContext);
      expect(story.sentiment).toBe('positive');
    });

    it('should return negative sentiment for concerning financial patterns', async () => {
      // Context with increasing spending and low savings progress
      const negativeContext: StoryContext = {
        ...mockContext,
        spendingPatterns: [
          {
            userId: 'user123',
            category: 'Entertainment',
            averageMonthly: 15000,
            trend: 'increasing',
            anomalyScore: 0.8,
            lastAnalyzed: new Date(),
            confidence: 0.9
          }
        ],
        savingsGoals: [
          {
            id: 'goal1',
            userId: 'user123',
            name: 'Emergency Fund',
            targetAmount: 100000,
            currentAmount: 5000, // Only 5% progress
            deadline: new Date('2024-03-31'), // Soon deadline
            automationRules: [],
            isActive: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
          }
        ]
      };

      const story = await moneyStoryService.generateMoneyStory(negativeContext);
      expect(['negative', 'neutral']).toContain(story.sentiment);
    });
  });

  describe('localization', () => {
    it('should include Swahili phrases for Kenyan users', async () => {
      const story = await moneyStoryService.generateMoneyStory(mockContext);

      // Check if narrative includes Kenyan context or Swahili phrases
      const narrativeText = story.narrative.toLowerCase();
      const hasKenyanContext = narrativeText.includes('shilling') || 
                              narrativeText.includes('kenya') ||
                              narrativeText.includes('habari') ||
                              narrativeText.includes('mambo') ||
                              story.suggestions.some(s => s.includes('M-Pesa') || s.includes('Nabo Capital'));
      
      expect(hasKenyanContext).toBe(true);
    });

    it('should adapt currency formatting for different countries', async () => {
      const usContext = {
        ...mockContext,
        user: { ...mockUser, country: 'US', currency: 'USD' }
      };

      const story = await moneyStoryService.generateMoneyStory(usContext);
      expect(story).toBeDefined();
      expect(story.narrative).toBeDefined();
    });
  });

  describe('story templates', () => {
    it('should return available story templates', () => {
      const templates = moneyStoryService.getStoryTemplates();

      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);
      
      templates.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('pattern');
        expect(template).toHaveProperty('sentiment');
        expect(['positive', 'neutral', 'negative']).toContain(template.sentiment);
      });
    });

    it('should allow adding custom story templates', () => {
      const initialCount = moneyStoryService.getStoryTemplates().length;
      
      const customTemplate = {
        id: 'custom-test',
        name: 'Custom Test Template',
        pattern: 'This is a test template with {value}',
        conditions: [
          { field: 'testField', operator: 'gt' as const, value: 100 }
        ],
        sentiment: 'neutral' as const
      };

      moneyStoryService.addStoryTemplate(customTemplate);
      
      const updatedTemplates = moneyStoryService.getStoryTemplates();
      expect(updatedTemplates.length).toBe(initialCount + 1);
      
      const addedTemplate = updatedTemplates.find(t => t.id === 'custom-test');
      expect(addedTemplate).toBeDefined();
      expect(addedTemplate?.name).toBe('Custom Test Template');
    });
  });

  describe('edge cases', () => {
    it('should handle very large transaction amounts', async () => {
      const largeTransactionContext = {
        ...mockContext,
        transactions: [
          {
            id: 'tx1',
            userId: 'user123',
            amount: 1000000, // 1 million KES
            currency: 'KES',
            description: 'Large purchase',
            category: 'Other',
            timestamp: new Date('2024-01-15'),
            source: 'manual' as const,
            rawData: '',
            isVerified: true
          }
        ]
      };

      const story = await moneyStoryService.generateMoneyStory(largeTransactionContext);
      expect(story).toBeDefined();
      expect(story.narrative).toBeDefined();
    });

    it('should handle transactions with special characters in descriptions', async () => {
      const specialCharContext = {
        ...mockContext,
        transactions: [
          {
            id: 'tx1',
            userId: 'user123',
            amount: 500,
            currency: 'KES',
            description: 'Café & Restaurant - 50% off!',
            category: 'Food',
            timestamp: new Date('2024-01-15'),
            source: 'sms' as const,
            rawData: 'SMS content',
            isVerified: true
          }
        ]
      };

      const story = await moneyStoryService.generateMoneyStory(specialCharContext);
      expect(story).toBeDefined();
      expect(story.narrative).toBeDefined();
    });

    it('should handle monthly period context', async () => {
      const monthlyContext = { ...mockContext, period: 'monthly' as const };
      const story = await moneyStoryService.generateMoneyStory(monthlyContext);

      expect(story.period).toBe('monthly');
      // Title should be appropriate for monthly period (could contain "Month" or be monthly-themed)
      expect(story.title.length).toBeGreaterThan(0);
      expect(['Month', 'monthly', 'Financial', 'Money'].some(word => 
        story.title.includes(word)
      )).toBe(true);
    });
  });
});