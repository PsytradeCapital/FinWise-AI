import { Router, Request, Response } from 'express';
import { integrationService } from '../services/integrationService';
import { authMiddleware } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { ApiResponse } from '@finwise-ai/shared';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Complete transaction processing flow
 * POST /api/v1/integration/process-transaction
 */
router.post('/process-transaction', asyncHandler(async (req: Request, res: Response) => {
  const { smsContent, userId, phoneNumber } = req.body;

  if (!smsContent || !userId) {
    return res.status(400).json({
      success: false,
      error: 'SMS content and user ID are required',
    } as ApiResponse<null>);
  }

  const result = await integrationService.processTransaction(smsContent, userId, phoneNumber);

  if (result.success) {
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Transaction processed successfully',
    } as ApiResponse<typeof result>);
  } else {
    return res.status(400).json({
      success: false,
      error: result.error,
    } as ApiResponse<null>);
  }
}));

/**
 * User onboarding flow
 * POST /api/v1/integration/onboard-user
 */
router.post('/onboard-user', asyncHandler(async (req: Request, res: Response) => {
  const { user } = req.body;

  if (!user || !user.id) {
    return res.status(400).json({
      success: false,
      error: 'User data is required',
    } as ApiResponse<null>);
  }

  const result = await integrationService.onboardUser(user);

  if (result.success) {
    return res.status(200).json({
      success: true,
      message: 'User onboarded successfully',
    } as ApiResponse<null>);
  } else {
    return res.status(500).json({
      success: false,
      error: result.error,
    } as ApiResponse<null>);
  }
}));

/**
 * Trigger daily analysis
 * POST /api/v1/integration/daily-analysis
 */
router.post('/daily-analysis', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required',
    } as ApiResponse<null>);
  }

  // Run daily analysis asynchronously
  integrationService.performDailyAnalysis(userId).catch(error => {
    logger.error('Daily analysis failed', { error, userId });
  });

  return res.status(202).json({
    success: true,
    message: 'Daily analysis started',
  } as ApiResponse<null>);
}));

/**
 * Generate weekly story
 * POST /api/v1/integration/weekly-story
 */
router.post('/weekly-story', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required',
    } as ApiResponse<null>);
  }

  // Generate weekly story asynchronously
  integrationService.generateWeeklyStory(userId).catch(error => {
    logger.error('Weekly story generation failed', { error, userId });
  });

  return res.status(202).json({
    success: true,
    message: 'Weekly story generation started',
  } as ApiResponse<null>);
}));

/**
 * Complete user flow demo
 * POST /api/v1/integration/demo-flow
 */
router.post('/demo-flow', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required',
    } as ApiResponse<null>);
  }

  try {
    logger.info('Starting complete user flow demo', { userId });

    // Step 1: Process a sample SMS transaction
    const sampleSMS = 'Confirmed. You have sent Ksh500.00 to JOHN DOE 0722123456 on 15/12/23 at 2:30 PM. New M-PESA balance is Ksh2,500.00.';
    const transactionResult = await integrationService.processTransaction(sampleSMS, userId, '0722123456');

    // Step 2: Perform analysis
    await integrationService.performDailyAnalysis(userId);

    // Step 3: Generate story
    await integrationService.generateWeeklyStory(userId);

    const demoResult = {
      transactionProcessed: transactionResult.success,
      transaction: transactionResult.transaction,
      savingsOffer: transactionResult.savingsOffer,
      analysisCompleted: true,
      storyGenerated: true,
      message: 'Complete user flow demo executed successfully',
    };

    return res.status(200).json({
      success: true,
      data: demoResult,
      message: 'Demo flow completed successfully',
    } as ApiResponse<typeof demoResult>);
  } catch (error) {
    logger.error('Demo flow failed', { error, userId });
    return res.status(500).json({
      success: false,
      error: 'Demo flow failed',
    } as ApiResponse<null>);
  }
}));

/**
 * Health check for integration service
 * GET /api/v1/integration/health
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  const isHealthy = await integrationService.healthCheck();

  return res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: { healthy: isHealthy },
    message: isHealthy ? 'Integration service is healthy' : 'Integration service is unhealthy',
  } as ApiResponse<{ healthy: boolean }>);
}));

/**
 * Get integration service status
 * GET /api/v1/integration/status
 */
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const status = {
    service: 'Integration Service',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      transactionProcessing: true,
      userOnboarding: true,
      dailyAnalysis: true,
      weeklyStories: true,
      emergencyAlerts: true,
      dataSync: true,
    },
  };

  return res.status(200).json({
    success: true,
    data: status,
    message: 'Integration service status retrieved successfully',
  } as ApiResponse<typeof status>);
}));

export default router;