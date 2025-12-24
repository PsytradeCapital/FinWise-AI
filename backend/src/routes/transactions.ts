import { Router, Request, Response } from 'express';
import { transactionParser } from '../services/transactionParser';
import { logger } from '../utils/logger';
import { ApiResponse } from '@finwise-ai/shared';

const router = Router();

/**
 * Parse SMS transaction
 * POST /api/transactions/parse-sms
 */
router.post('/parse-sms', async (req: Request, res: Response) => {
  try {
    const { smsContent, userId, phoneNumber } = req.body;

    if (!smsContent || !userId) {
      return res.status(400).json({
        success: false,
        error: 'SMS content and user ID are required',
      } as ApiResponse<null>);
    }

    const result = await transactionParser.parseFromSMS(smsContent, userId, phoneNumber);

    if (result.success && result.transaction) {
      return res.status(200).json({
        success: true,
        data: result.transaction,
        message: 'SMS transaction parsed successfully',
      } as ApiResponse<typeof result.transaction>);
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        data: {
          fallbackRequired: result.fallbackRequired,
          validationErrors: result.validationErrors,
        },
      });
    }
  } catch (error) {
    logger.error('SMS parsing endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

/**
 * Create manual transaction (fallback)
 * POST /api/transactions/manual
 */
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { amount, description, category, timestamp, merchant, userId } = req.body;

    if (!amount || !description || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Amount, description, and user ID are required',
      } as ApiResponse<null>);
    }

    const manualData = {
      amount: parseFloat(amount),
      description,
      category,
      timestamp: timestamp ? new Date(timestamp) : undefined,
      merchant,
    };

    const result = await transactionParser.createFromManualEntry(manualData, userId);

    if (result.success && result.transaction) {
      return res.status(201).json({
        success: true,
        data: result.transaction,
        message: 'Manual transaction created successfully',
      } as ApiResponse<typeof result.transaction>);
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        data: {
          validationErrors: result.validationErrors,
        },
      });
    }
  } catch (error) {
    logger.error('Manual transaction endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

/**
 * Validate transaction data
 * POST /api/transactions/validate
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const transaction = req.body;

    if (!transaction) {
      return res.status(400).json({
        success: false,
        error: 'Transaction data is required',
      } as ApiResponse<null>);
    }

    const validation = transactionParser.validateTransaction(transaction);

    return res.status(200).json({
      success: true,
      data: validation,
      message: validation.isValid ? 'Transaction is valid' : 'Transaction validation failed',
    } as ApiResponse<typeof validation>);
  } catch (error) {
    logger.error('Transaction validation endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

/**
 * Check if SMS is a transaction
 * POST /api/transactions/check-sms
 */
router.post('/check-sms', async (req: Request, res: Response) => {
  try {
    const { smsContent } = req.body;

    if (!smsContent) {
      return res.status(400).json({
        success: false,
        error: 'SMS content is required',
      } as ApiResponse<null>);
    }

    const isTransaction = transactionParser.isTransactionSMS(smsContent);

    return res.status(200).json({
      success: true,
      data: {
        isTransaction,
        supportedProviders: transactionParser.getSupportedProviders(),
      },
      message: isTransaction ? 'SMS appears to be a transaction' : 'SMS does not appear to be a transaction',
    } as ApiResponse<{ isTransaction: boolean; supportedProviders: string[] }>);
  } catch (error) {
    logger.error('SMS check endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

/**
 * Health check for transaction parser services
 * GET /api/transactions/health
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await transactionParser.healthCheck();

    const isHealthy = health.smsParser && health.transactionFetcher;

    return res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: health,
      message: isHealthy ? 'All services are healthy' : 'Some services are unhealthy',
    } as ApiResponse<typeof health>);
  } catch (error) {
    logger.error('Health check endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
});

export default router;