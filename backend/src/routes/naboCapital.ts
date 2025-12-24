import { Router, Request, Response } from 'express';
import { naboCapitalService } from '../services/naboCapitalService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Link user account with Nabo Capital
 */
router.post('/link-account', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, phoneNumber, idNumber, fullName, email, bankAccount } = req.body;

    if (!userId || !phoneNumber || !idNumber || !fullName || !email) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, phoneNumber, idNumber, fullName, email',
      });
      return;
    }

    const result = await naboCapitalService.getInstance().linkAccount({
      userId,
      phoneNumber,
      idNumber,
      fullName,
      email,
      bankAccount,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to link Nabo Capital account', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link account',
    });
  }
});

/**
 * Verify account linking
 */
router.post('/verify-linking/:linkingId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkingId } = req.params;
    const { verificationCode } = req.body;

    if (!verificationCode) {
      res.status(400).json({
        success: false,
        error: 'Verification code is required',
      });
      return;
    }

    const result = await naboCapitalService.getInstance().verifyAccountLinking(linkingId, verificationCode);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to verify account linking', { 
      linkingId: req.params.linkingId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify account linking',
    });
  }
});

/**
 * Get user's Nabo Capital accounts
 */
router.get('/accounts/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const accounts = await naboCapitalService.getInstance().getAccounts(userId);

    res.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    logger.error('Failed to get Nabo Capital accounts', { 
      userId: req.params.userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get accounts',
    });
  }
});

/**
 * Initiate savings transfer
 */
router.post('/transfer', async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency, sourceAccount, targetAccount, reference, description, scheduledDate } = req.body;

    if (!amount || !targetAccount || !reference) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, targetAccount, reference',
      });
      return;
    }

    const transferRequest = {
      amount: parseFloat(amount),
      currency: currency || 'KES',
      sourceAccount,
      targetAccount,
      reference,
      description: description || 'Automated savings transfer',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
    };

    const result = await naboCapitalService.getInstance().initiateTransfer(transferRequest);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to initiate transfer', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate transfer',
    });
  }
});

/**
 * Get transfer status
 */
router.get('/transfer/:transferId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { transferId } = req.params;

    const result = await naboCapitalService.getInstance().getTransferStatus(transferId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to get transfer status', { 
      transferId: req.params.transferId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get transfer status',
    });
  }
});

/**
 * Cancel transfer
 */
router.post('/transfer/:transferId/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { transferId } = req.params;
    const { reason } = req.body;

    const result = await naboCapitalService.getInstance().cancelTransfer(transferId, reason);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to cancel transfer', { 
      transferId: req.params.transferId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel transfer',
    });
  }
});

/**
 * Get transfer history
 */
router.get('/transfers/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, status, limit, offset } = req.query;

    const options: any = {};
    
    if (startDate) {
      options.startDate = new Date(startDate as string);
    }
    if (endDate) {
      options.endDate = new Date(endDate as string);
    }
    if (status) {
      options.status = status as string;
    }
    if (limit) {
      options.limit = parseInt(limit as string, 10);
    }
    if (offset) {
      options.offset = parseInt(offset as string, 10);
    }

    const result = await naboCapitalService.getInstance().getTransferHistory(userId, options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to get transfer history', { 
      userId: req.params.userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get transfer history',
    });
  }
});

/**
 * Setup automated savings rules
 */
router.post('/automation/savings-rules', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      userId, 
      roundUpSavings, 
      percentageSavings, 
      minimumTransfer, 
      maximumDailyTransfer, 
      targetAccount 
    } = req.body;

    if (!userId || !targetAccount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, targetAccount',
      });
      return;
    }

    const rules = {
      roundUpSavings: roundUpSavings || false,
      percentageSavings: percentageSavings ? parseFloat(percentageSavings) : undefined,
      minimumTransfer: minimumTransfer ? parseFloat(minimumTransfer) : undefined,
      maximumDailyTransfer: maximumDailyTransfer ? parseFloat(maximumDailyTransfer) : undefined,
      targetAccount,
    };

    const result = await naboCapitalService.getInstance().setupAutomatedSavings(userId, rules);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to setup automated savings', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to setup automated savings',
    });
  }
});

/**
 * Get service health status
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await naboCapitalService.getInstance().getHealthStatus();

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error('Failed to get Nabo Capital health status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get health status',
    });
  }
});

export default router;