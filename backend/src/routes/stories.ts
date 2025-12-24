import { Router, Request, Response } from 'express';
import { MoneyStoryService, StoryContext } from '../services/moneyStoryService';
import { logger } from '../utils/logger';

const router = Router();
const moneyStoryService = new MoneyStoryService();

/**
 * Generate a new money story
 * POST /api/stories/generate
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { user, transactions, spendingPatterns, savingsGoals, period, startDate, endDate } = req.body;

    // Validate required fields
    if (!user || !transactions || !period) {
      res.status(400).json({
        success: false,
        error: 'User, transactions, and period are required'
      });
      return;
    }

    // Create story context
    const context: StoryContext = {
      user,
      transactions,
      spendingPatterns: spendingPatterns || [],
      savingsGoals: savingsGoals || [],
      period,
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date()
    };

    // Generate the story
    const story = await moneyStoryService.generateMoneyStory(context);

    res.json({
      success: true,
      data: story
    });
  } catch (error) {
    logger.error('Error generating money story', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate money story'
    });
  }
});

/**
 * Get user's money stories
 * GET /api/stories/:userId
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { period, limit = 10, offset = 0 } = req.query;

    // In a real implementation, this would fetch from database
    // For now, return a mock response
    const mockStories = [
      {
        id: `story-${userId}-weekly-${Date.now()}`,
        userId,
        period: 'weekly',
        title: 'Your Week of Financial Wins! 🎉',
        narrative: 'Good morning! Let\'s dive into your weekly financial story. Great job reducing your Food spending! You\'re trending downward. Your biggest expense was Transportation, accounting for 35.2% of your spending. You averaged KES 450.75 per day across 12 transactions. Keep up the fantastic work!',
        insights: [
          'Great job reducing your Food spending! You\'re trending downward',
          'Your biggest expense was Transportation, accounting for 35.2% of your spending',
          'You averaged KES 450.75 per day across 12 transactions'
        ],
        suggestions: [
          'Keep up the good work with your Food budget management',
          'Consider reviewing your Transportation expenses to find potential savings',
          'Focus on budgeting for your top spending categories: Transportation, Food, Entertainment'
        ],
        sentiment: 'positive',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: `story-${userId}-monthly-${Date.now() - 1000}`,
        userId,
        period: 'monthly',
        title: 'Monthly Financial Snapshot 📊',
        narrative: 'Hello there! Here\'s what your money has been up to this month. Your biggest expense was Food, accounting for 28.5% of your spending. You\'re 67.3% of the way to your "Emergency Fund" goal! Consider increasing your savings rate to reach your goal faster. Understanding these patterns helps you make better financial decisions.',
        insights: [
          'Your biggest expense was Food, accounting for 28.5% of your spending',
          'You\'re 67.3% of the way to your "Emergency Fund" goal!',
          'You averaged KES 1,250.30 per day across 45 transactions'
        ],
        suggestions: [
          'You\'re so close! Consider increasing your savings rate to reach your goal faster',
          'Focus on budgeting for your top spending categories: Food, Transportation, Utilities',
          'Take advantage of M-Pesa savings features to automate your financial goals'
        ],
        sentiment: 'positive',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    ];

    // Filter by period if specified
    let filteredStories = mockStories;
    if (period) {
      filteredStories = mockStories.filter(story => story.period === period);
    }

    // Apply pagination
    const paginatedStories = filteredStories.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      success: true,
      data: {
        stories: paginatedStories,
        total: filteredStories.length,
        hasMore: Number(offset) + Number(limit) < filteredStories.length
      }
    });
  } catch (error) {
    logger.error('Error fetching user stories', { userId: req.params.userId, error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stories'
    });
  }
});

/**
 * Get a specific story by ID
 * GET /api/stories/:userId/:storyId
 */
router.get('/:userId/:storyId', async (req: Request, res: Response) => {
  try {
    const { userId, storyId } = req.params;

    // In a real implementation, this would fetch from database
    // For now, return a mock story
    const mockStory = {
      id: storyId,
      userId,
      period: 'weekly',
      title: 'Your Week of Financial Wins! 🎉',
      narrative: 'Good morning! Let\'s dive into your weekly financial story. Great job reducing your Food spending! You\'re trending downward. Your biggest expense was Transportation, accounting for 35.2% of your spending. You averaged KES 450.75 per day across 12 transactions. Keep up the fantastic work!',
      insights: [
        'Great job reducing your Food spending! You\'re trending downward',
        'Your biggest expense was Transportation, accounting for 35.2% of your spending',
        'You averaged KES 450.75 per day across 12 transactions'
      ],
      suggestions: [
        'Keep up the good work with your Food budget management',
        'Consider reviewing your Transportation expenses to find potential savings',
        'Focus on budgeting for your top spending categories: Transportation, Food, Entertainment'
      ],
      sentiment: 'positive',
      createdAt: new Date()
    };

    res.json({
      success: true,
      data: mockStory
    });
  } catch (error) {
    logger.error('Error fetching story', { userId: req.params.userId, storyId: req.params.storyId, error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch story'
    });
  }
});

/**
 * Delete a story
 * DELETE /api/stories/:userId/:storyId
 */
router.delete('/:userId/:storyId', async (req: Request, res: Response) => {
  try {
    const { userId, storyId } = req.params;

    // In a real implementation, this would delete from database
    logger.info('Story deleted', { userId, storyId });

    res.json({
      success: true,
      message: 'Story deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting story', { userId: req.params.userId, storyId: req.params.storyId, error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete story'
    });
  }
});

/**
 * Get story templates (for customization)
 * GET /api/stories/templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = moneyStoryService.getStoryTemplates();

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Error fetching story templates', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch story templates'
    });
  }
});

/**
 * Add custom story template
 * POST /api/stories/templates
 */
router.post('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const template = req.body;

    // Validate template structure
    if (!template.id || !template.name || !template.pattern || !template.sentiment) {
      res.status(400).json({
        success: false,
        error: 'Template must have id, name, pattern, and sentiment'
      });
      return;
    }

    moneyStoryService.addStoryTemplate(template);

    res.json({
      success: true,
      message: 'Template added successfully'
    });
  } catch (error) {
    logger.error('Error adding story template', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to add story template'
    });
  }
});

export default router;