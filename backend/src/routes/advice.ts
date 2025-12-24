import { Router, Request, Response } from 'express';
import { AIAdvisorService } from '../services/aiAdvisorService';
import { AnomalyDetectionService } from '../services/anomalyDetectionService';
import { RecommendationEngine } from '../services/recommendationEngine';
import { logger } from '../utils/logger';
import { ApiResponse } from '@finwise-ai/shared';

const router = Router();

// Create service instances
const aiAdvisorService = new AIAdvisorService();
const anomalyDetectionService = new AnomalyDetectionService();
const recommendationEngine = new RecommendationEngine();

/**
 * Get AI advice for user
 * GET /api/v1/advice?userId=:userId
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      } as ApiResponse<null>);
    }

    const advice = await aiAdvisorService.generateAdvice(userId as string);

    return res.status(200).json({
      success: true,
      data: advice,
      message: 'AI advice generated successfully',
    } as ApiResponse<typeof advice>);
  } catch (error) {
    logger.error('AI advice generation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI advice',
    } as ApiResponse<null>);
  }
});

/**
 * Get spending analysis for user
 * GET /api/v1/advice/analysis?userId=:userId
 */
router.get('/analysis', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      } as ApiResponse<null>);
    }

    const analysis = await aiAdvisorService.analyzeSpendingPatterns(userId as string);

    return res.status(200).json({
      success: true,
      data: analysis,
      message: 'Spending analysis completed successfully',
    } as ApiResponse<typeof analysis>);
  } catch (error) {
    logger.error('Spending analysis error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to analyze spending patterns',
    } as ApiResponse<null>);
  }
});

/**
 * Detect spending anomalies
 * GET /api/v1/advice/anomalies?userId=:userId
 */
router.get('/anomalies', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      } as ApiResponse<null>);
    }

    const anomalies = await anomalyDetectionService.detectAnomalies(userId as string);

    return res.status(200).json({
      success: true,
      data: anomalies,
      message: 'Anomaly detection completed successfully',
    } as ApiResponse<typeof anomalies>);
  } catch (error) {
    logger.error('Anomaly detection error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to detect spending anomalies',
    } as ApiResponse<null>);
  }
});

/**
 * Get personalized recommendations
 * GET /api/v1/advice/recommendations?userId=:userId
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      } as ApiResponse<null>);
    }

    const recommendations = await recommendationEngine.generateRecommendations(userId as string);

    return res.status(200).json({
      success: true,
      data: recommendations,
      message: 'Recommendations generated successfully',
    } as ApiResponse<typeof recommendations>);
  } catch (error) {
    logger.error('Recommendation generation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
    } as ApiResponse<null>);
  }
});

/**
 * Trigger savings offer for transaction
 * POST /api/v1/advice/savings-offer
 */
router.post('/savings-offer', async (req: Request, res: Response) => {
  try {
    const { userId, transactionId } = req.body;

    if (!userId || !transactionId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and transaction ID are required',
      } as ApiResponse<null>);
    }

    const savingsOffer = await aiAdvisorService.generateSavingsOffer(userId, transactionId);

    return res.status(200).json({
      success: true,
      data: savingsOffer,
      message: 'Savings offer generated successfully',
    } as ApiResponse<typeof savingsOffer>);
  } catch (error) {
    logger.error('Savings offer generation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to generate savings offer',
    } as ApiResponse<null>);
  }
});

/**
 * Health check for AI services
 * GET /api/v1/advice/health
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = {
      aiAdvisor: await aiAdvisorService.healthCheck(),
      anomalyDetection: await anomalyDetectionService.healthCheck(),
      recommendationEngine: await recommendationEngine.healthCheck(),
    };

    const isHealthy = health.aiAdvisor.status === 'healthy' && 
                     health.anomalyDetection.status === 'healthy' && 
                     health.recommendationEngine.status === 'healthy';

    return res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: health,
      message: isHealthy ? 'All AI services are healthy' : 'Some AI services are unhealthy',
    } as ApiResponse<typeof health>);
  } catch (error) {
    logger.error('AI services health check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Health check failed',
    } as ApiResponse<null>);
  }
});

export default router;