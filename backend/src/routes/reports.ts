import { Router, Request, Response } from 'express';
import { PDFExportService, FinancialReportData, PDFExportOptions } from '../services/pdfExportService';
import { MilestoneService } from '../services/milestoneService';
import { NotificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

const router = Router();
const pdfExportService = new PDFExportService();
const notificationService = new NotificationService();
const milestoneService = new MilestoneService(notificationService);

/**
 * Generate PDF financial report
 * POST /api/reports/financial-pdf
 */
router.post('/financial-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportData, options }: { reportData: FinancialReportData; options?: Partial<PDFExportOptions> } = req.body;

    // Validate report data
    const validation = pdfExportService.validateReportData(reportData);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: 'Invalid report data',
        details: validation.errors
      });
      return;
    }

    // Generate PDF
    const pdfBuffer = await pdfExportService.generateFinancialReport(reportData, options);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="financial-report-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating financial PDF report', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF report'
    });
  }
});

/**
 * Generate PDF savings goals report
 * POST /api/reports/savings-goals-pdf
 */
router.post('/savings-goals-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { user, goals, options } = req.body;

    if (!user || !goals) {
      res.status(400).json({
        success: false,
        error: 'User and goals data are required'
      });
      return;
    }

    const pdfBuffer = await pdfExportService.generateSavingsGoalReport(user, goals, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="savings-goals-report-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating savings goals PDF report', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate savings goals PDF report'
    });
  }
});

/**
 * Generate PDF spending analysis report
 * POST /api/reports/spending-analysis-pdf
 */
router.post('/spending-analysis-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { user, transactions, patterns, options } = req.body;

    if (!user || !transactions || !patterns) {
      res.status(400).json({
        success: false,
        error: 'User, transactions, and patterns data are required'
      });
      return;
    }

    const pdfBuffer = await pdfExportService.generateSpendingAnalysisReport(user, transactions, patterns, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="spending-analysis-report-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating spending analysis PDF report', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate spending analysis PDF report'
    });
  }
});

/**
 * Get user milestones
 * GET /api/reports/milestones/:userId
 */
router.get('/milestones/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const milestones = milestoneService.getUserMilestones(userId);

    res.json({
      success: true,
      data: milestones
    });
  } catch (error) {
    logger.error('Error fetching user milestones', { userId: req.params.userId, error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch milestones'
    });
  }
});

/**
 * Get milestone statistics
 * GET /api/reports/milestones/:userId/statistics
 */
router.get('/milestones/:userId/statistics', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const statistics = milestoneService.getMilestoneStatistics(userId);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Error fetching milestone statistics', { userId: req.params.userId, error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch milestone statistics'
    });
  }
});

/**
 * Get milestone progress for a specific goal
 * GET /api/reports/milestones/goal/:goalId/progress
 */
router.get('/milestones/goal/:goalId/progress', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    
    // In a real implementation, you would fetch the goal from the database
    // For now, we'll return a mock response
    const mockGoal = {
      id: goalId,
      userId: 'user123',
      name: 'Emergency Fund',
      targetAmount: 50000,
      currentAmount: 25000,
      deadline: new Date('2024-12-31'),
      automationRules: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const progress = milestoneService.getMilestoneProgress(mockGoal);

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    logger.error('Error fetching milestone progress', { goalId: req.params.goalId, error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch milestone progress'
    });
  }
});

/**
 * Check for new milestones (typically called after goal updates)
 * POST /api/reports/milestones/check
 */
router.post('/milestones/check', async (req: Request, res: Response): Promise<void> => {
  try {
    const { goal, previousAmount, user } = req.body;

    if (!goal || previousAmount === undefined || !user) {
      res.status(400).json({
        success: false,
        error: 'Goal, previous amount, and user data are required'
      });
      return;
    }

    const newMilestones = await milestoneService.checkSavingsGoalMilestones(goal, previousAmount, user);

    res.json({
      success: true,
      data: {
        milestonesAchieved: newMilestones.length,
        milestones: newMilestones
      }
    });
  } catch (error) {
    logger.error('Error checking for new milestones', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to check for new milestones'
    });
  }
});

/**
 * Check spending reduction milestones
 * POST /api/reports/milestones/spending-reduction
 */
router.post('/milestones/spending-reduction', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, currentPatterns, previousPatterns } = req.body;

    if (!userId || !currentPatterns || !previousPatterns) {
      res.status(400).json({
        success: false,
        error: 'User ID, current patterns, and previous patterns are required'
      });
      return;
    }

    const newMilestones = await milestoneService.checkSpendingReductionMilestones(
      userId,
      currentPatterns,
      previousPatterns
    );

    res.json({
      success: true,
      data: {
        milestonesAchieved: newMilestones.length,
        milestones: newMilestones
      }
    });
  } catch (error) {
    logger.error('Error checking spending reduction milestones', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to check spending reduction milestones'
    });
  }
});

/**
 * Check budget streak milestones
 * POST /api/reports/milestones/budget-streak
 */
router.post('/milestones/budget-streak', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, consecutiveBudgetDays } = req.body;

    if (!userId || consecutiveBudgetDays === undefined) {
      res.status(400).json({
        success: false,
        error: 'User ID and consecutive budget days are required'
      });
      return;
    }

    const newMilestones = await milestoneService.checkBudgetStreakMilestones(userId, consecutiveBudgetDays);

    res.json({
      success: true,
      data: {
        milestonesAchieved: newMilestones.length,
        milestones: newMilestones
      }
    });
  } catch (error) {
    logger.error('Error checking budget streak milestones', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to check budget streak milestones'
    });
  }
});

export default router;