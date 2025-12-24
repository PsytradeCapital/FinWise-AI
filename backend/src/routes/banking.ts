import { Router, Request, Response } from 'express';
import { bankingService } from '../services/bankingService';
import { bankAdapterRegistry } from '../services/bankAdapters';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get supported banks
 */
router.get('/banks', async (req: Request, res: Response) => {
  try {
    const supportedBanks = bankAdapterRegistry.getSupportedBanks();
    
    res.json({
      success: true,
      data: supportedBanks,
    });
  } catch (error) {
    logger.error('Failed to get supported banks', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get supported banks',
    });
  }
});

/**
 * Get user's bank accounts
 */
router.get('/accounts/:provider', async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    const accounts = await bankingService.getAccounts(provider, userId);
    
    res.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    logger.error('Failed to get bank accounts', { 
      provider: req.params.provider,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bank accounts',
    });
  }
});

/**
 * Get account transactions
 */
router.get('/accounts/:provider/:accountId/transactions', async (req: Request, res: Response) => {
  try {
    const { provider, accountId } = req.params;
    const { startDate, endDate, limit, offset } = req.query;

    const options: any = {};
    
    if (startDate) {
      options.startDate = new Date(startDate as string);
    }
    if (endDate) {
      options.endDate = new Date(endDate as string);
    }
    if (limit) {
      options.limit = parseInt(limit as string, 10);
    }
    if (offset) {
      options.offset = parseInt(offset as string, 10);
    }

    const transactions = await bankingService.getTransactions(provider, accountId, options);
    
    // Enhance transactions with bank-specific parsing
    const enhancedTransactions = transactions.map(tx => {
      const parsed = bankAdapterRegistry.parseTransactionDescription(provider, tx.description);
      return {
        ...tx,
        merchant: parsed.merchant || tx.description.split(' ').slice(0, 3).join(' '),
        suggestedCategory: parsed.category,
      };
    });
    
    res.json({
      success: true,
      data: enhancedTransactions,
    });
  } catch (error) {
    logger.error('Failed to get bank transactions', { 
      provider: req.params.provider,
      accountId: req.params.accountId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bank transactions',
    });
  }
});

/**
 * Get account balance
 */
router.get('/accounts/:provider/:accountId/balance', async (req: Request, res: Response) => {
  try {
    const { provider, accountId } = req.params;

    const balance = await bankingService.getBalance(provider, accountId);
    
    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    logger.error('Failed to get account balance', { 
      provider: req.params.provider,
      accountId: req.params.accountId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account balance',
    });
  }
});

/**
 * Validate account number
 */
router.post('/validate-account', async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider, accountNumber } = req.body;

    if (!provider || !accountNumber) {
      res.status(400).json({
        success: false,
        error: 'Provider and account number are required',
      });
      return;
    }

    const isValid = bankAdapterRegistry.validateAccountNumber(provider, accountNumber);
    const formatted = bankAdapterRegistry.formatAccountNumber(provider, accountNumber);
    
    res.json({
      success: true,
      data: {
        isValid,
        formatted,
        original: accountNumber,
      },
    });
  } catch (error) {
    logger.error('Failed to validate account number', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to validate account number',
    });
  }
});

/**
 * Check security compliance
 */
router.get('/compliance/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    const compliance = await bankingService.validateSecurityCompliance(provider);
    
    res.json({
      success: true,
      data: compliance,
    });
  } catch (error) {
    logger.error('Failed to check security compliance', { 
      provider: req.params.provider,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check security compliance',
    });
  }
});

/**
 * Get banking service health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await bankingService.getHealthStatus();
    
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error('Failed to get banking service health', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get banking service health',
    });
  }
});

/**
 * Initialize bank connection
 */
router.post('/initialize/:provider', async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;
    const { clientId, clientSecret, apiKey } = req.body;

    const adapter = bankAdapterRegistry.getAdapter(provider);
    if (!adapter) {
      res.status(404).json({
        success: false,
        error: `Bank adapter not found for provider: ${provider}`,
      });
      return;
    }

    // Update config with provided credentials
    const config = {
      ...adapter.config,
      clientId: clientId || adapter.config.clientId,
      clientSecret: clientSecret || adapter.config.clientSecret,
      apiKey: apiKey || adapter.config.apiKey,
    };

    await bankingService.initializeBankClient(config);
    
    res.json({
      success: true,
      message: `Bank client initialized successfully for ${provider}`,
    });
  } catch (error) {
    logger.error('Failed to initialize bank client', { 
      provider: req.params.provider,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize bank client',
    });
  }
});

export default router;