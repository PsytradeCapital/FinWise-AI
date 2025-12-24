import { Router } from 'express';
import { MpesaService, StkPushRequest } from '../services/mpesaService';
import { logger } from '../utils/logger';

const router = Router();

// Initialize M-Pesa service with environment variables
const mpesaConfig = {
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  shortcode: process.env.MPESA_SHORTCODE || '',
  passkey: process.env.MPESA_PASSKEY || '',
  callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://your-app.com/api/mpesa/callback'
};

const mpesaService = new MpesaService(mpesaConfig);

/**
 * Initiate M-Pesa STK Push payment
 */
router.post('/stk-push', async (req: any, res: any) => {
  try {
    const { phoneNumber, amount, accountReference, transactionDesc } = req.body;

    // Validate required fields
    if (!phoneNumber || !amount || !accountReference) {
      return res.status(400).json({
        success: false,
        message: 'Phone number, amount, and account reference are required'
      });
    }

    // Validate phone number format
    if (!mpesaService.validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use format: 0712345678 or 254712345678'
      });
    }

    // Validate amount
    if (amount < 1 || amount > 70000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between KES 1 and KES 70,000'
      });
    }

    const stkRequest: StkPushRequest = {
      phoneNumber,
      amount: parseFloat(amount),
      accountReference,
      transactionDesc: transactionDesc || 'FinWise Payment'
    };

    const result = await mpesaService.initiatePayment(stkRequest);

    logger.info('STK Push initiated successfully', { 
      phoneNumber,
      amount,
      merchantRequestId: result.merchantRequestId
    });

    res.json({
      success: true,
      message: 'Payment request sent successfully',
      data: {
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId,
        customerMessage: result.customerMessage
      }
    });

  } catch (error) {
    logger.error('Error initiating STK Push', { error, body: req.body });
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Query transaction status
 */
router.get('/status/:checkoutRequestId', async (req: any, res: any) => {
  try {
    const { checkoutRequestId } = req.params;

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Checkout request ID is required'
      });
    }

    const status = await mpesaService.queryTransactionStatus(checkoutRequestId);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error querying transaction status', { error, checkoutRequestId: req.params.checkoutRequestId });
    res.status(500).json({
      success: false,
      message: 'Failed to query transaction status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Poll transaction status with retries
 */
router.get('/poll/:checkoutRequestId', async (req: any, res: any) => {
  try {
    const { checkoutRequestId } = req.params;
    const maxAttempts = parseInt(req.query.maxAttempts as string) || 10;
    const intervalMs = parseInt(req.query.intervalMs as string) || 5000;

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Checkout request ID is required'
      });
    }

    const status = await mpesaService.pollTransactionStatus(checkoutRequestId, maxAttempts, intervalMs);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error polling transaction status', { error, checkoutRequestId: req.params.checkoutRequestId });
    res.status(500).json({
      success: false,
      message: 'Failed to poll transaction status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * M-Pesa callback/webhook endpoint
 */
router.post('/callback', async (req: any, res: any) => {
  try {
    logger.info('Received M-Pesa callback', { body: req.body });

    const transaction = await mpesaService.handleCallback(req.body);

    // Here you would typically save the transaction to your database
    // and trigger any necessary business logic (e.g., update user balance, send notifications)

    logger.info('M-Pesa callback processed successfully', { 
      transactionId: transaction.id,
      status: transaction.status
    });

    // Always respond with success to M-Pesa
    res.json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });

  } catch (error) {
    logger.error('Error processing M-Pesa callback', { error, body: req.body });
    
    // Still respond with success to avoid M-Pesa retries
    res.json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });
  }
});

/**
 * Validate phone number
 */
router.post('/validate-phone', async (req: any, res: any) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const isValid = mpesaService.validatePhoneNumber(phoneNumber);

    res.json({
      success: true,
      data: {
        phoneNumber,
        isValid,
        message: isValid ? 'Valid phone number' : 'Invalid phone number format'
      }
    });

  } catch (error) {
    logger.error('Error validating phone number', { error, phoneNumber: req.body.phoneNumber });
    res.status(500).json({
      success: false,
      message: 'Failed to validate phone number',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req: any, res: any) => {
  try {
    const health = await mpesaService.getHealthStatus();
    
    res.status(health.status === 'healthy' ? 200 : 503).json({
      success: health.status === 'healthy',
      status: health.status,
      message: health.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error checking M-Pesa service health', { error });
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;