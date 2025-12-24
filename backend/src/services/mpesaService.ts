import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * M-Pesa API Service
 * Handles M-Pesa Daraja API integration for payments and transaction polling
 */

export interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  environment: 'sandbox' | 'production';
  shortcode: string;
  passkey: string;
  callbackUrl: string;
}

export interface MpesaTransaction {
  id: string;
  phoneNumber: string;
  amount: number;
  reference: string;
  description: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
}

export interface StkPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface StkPushResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface TransactionStatusResponse {
  responseCode: string;
  responseDescription: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  resultDesc: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
}

export class MpesaService {
  private config: MpesaConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl: string;

  constructor(config: MpesaConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Get OAuth access token for M-Pesa API
   */
  private async getAccessToken(): Promise<string> {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.accessToken;
      }

      logger.info('Requesting M-Pesa access token');

      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      this.accessToken = response.data.access_token;
      // Token expires in 1 hour, set expiry to 55 minutes to be safe
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);

      logger.info('M-Pesa access token obtained successfully');
      
      if (!this.accessToken) {
        throw new Error('No access token received from M-Pesa API');
      }
      
      return this.accessToken;

    } catch (error) {
      logger.error('Error getting M-Pesa access token', { error });
      throw new Error('Failed to authenticate with M-Pesa API');
    }
  }

  /**
   * Initiate STK Push payment request
   */
  async initiatePayment(request: StkPushRequest): Promise<StkPushResponse> {
    try {
      logger.info('Initiating M-Pesa STK Push', { 
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        reference: request.accountReference
      });

      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${this.config.shortcode}${this.config.passkey}${timestamp}`).toString('base64');

      // Format phone number to international format
      const formattedPhone = this.formatPhoneNumber(request.phoneNumber);

      const payload = {
        BusinessShortCode: this.config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: request.amount,
        PartyA: formattedPhone,
        PartyB: this.config.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: this.config.callbackUrl,
        AccountReference: request.accountReference,
        TransactionDesc: request.transactionDesc
      };

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result: StkPushResponse = {
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage
      };

      logger.info('M-Pesa STK Push initiated successfully', { 
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId
      });

      return result;

    } catch (error) {
      logger.error('Error initiating M-Pesa payment', { error, request });
      throw new Error('Failed to initiate M-Pesa payment');
    }
  }

  /**
   * Query transaction status
   */
  async queryTransactionStatus(checkoutRequestId: string): Promise<TransactionStatusResponse> {
    try {
      logger.info('Querying M-Pesa transaction status', { checkoutRequestId });

      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${this.config.shortcode}${this.config.passkey}${timestamp}`).toString('base64');

      const payload = {
        BusinessShortCode: this.config.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result: TransactionStatusResponse = {
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc
      };

      // Extract additional data if payment was successful
      if (response.data.CallbackMetadata?.Item) {
        const metadata = response.data.CallbackMetadata.Item;
        result.amount = metadata.find((item: any) => item.Name === 'Amount')?.Value;
        result.mpesaReceiptNumber = metadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
        result.transactionDate = metadata.find((item: any) => item.Name === 'TransactionDate')?.Value;
        result.phoneNumber = metadata.find((item: any) => item.Name === 'PhoneNumber')?.Value;
      }

      logger.info('M-Pesa transaction status retrieved', { 
        checkoutRequestId,
        resultCode: result.resultCode,
        resultDesc: result.resultDesc
      });

      return result;

    } catch (error) {
      logger.error('Error querying M-Pesa transaction status', { error, checkoutRequestId });
      throw new Error('Failed to query transaction status');
    }
  }

  /**
   * Handle M-Pesa callback/webhook
   */
  async handleCallback(callbackData: any): Promise<MpesaTransaction> {
    try {
      logger.info('Processing M-Pesa callback', { callbackData });

      const { Body } = callbackData;
      const { stkCallback } = Body;

      const transaction: MpesaTransaction = {
        id: stkCallback.CheckoutRequestID,
        phoneNumber: '',
        amount: 0,
        reference: '',
        description: '',
        timestamp: new Date(),
        status: 'pending'
      };

      // Check if payment was successful
      if (stkCallback.ResultCode === 0) {
        // Payment successful
        transaction.status = 'completed';
        
        if (stkCallback.CallbackMetadata?.Item) {
          const metadata = stkCallback.CallbackMetadata.Item;
          transaction.amount = metadata.find((item: any) => item.Name === 'Amount')?.Value || 0;
          transaction.mpesaReceiptNumber = metadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
          
          const transactionDate = metadata.find((item: any) => item.Name === 'TransactionDate')?.Value;
          if (transactionDate) {
            transaction.transactionDate = new Date(transactionDate);
          }
          
          const phoneNumber = metadata.find((item: any) => item.Name === 'PhoneNumber')?.Value;
          if (phoneNumber) {
            transaction.phoneNumber = phoneNumber.toString();
          }
        }
      } else {
        // Payment failed or cancelled
        transaction.status = stkCallback.ResultCode === 1032 ? 'cancelled' : 'failed';
      }

      logger.info('M-Pesa callback processed successfully', { 
        transactionId: transaction.id,
        status: transaction.status,
        amount: transaction.amount
      });

      return transaction;

    } catch (error) {
      logger.error('Error processing M-Pesa callback', { error, callbackData });
      throw new Error('Failed to process M-Pesa callback');
    }
  }

  /**
   * Poll transaction status with retry mechanism
   */
  async pollTransactionStatus(
    checkoutRequestId: string, 
    maxAttempts: number = 10, 
    intervalMs: number = 5000
  ): Promise<TransactionStatusResponse> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.queryTransactionStatus(checkoutRequestId);
        
        // If we have a definitive result (success or failure), return it
        if (status.resultCode !== undefined && status.resultCode !== '0000') {
          return status;
        }
        
        // If still pending, wait and try again
        attempts++;
        if (attempts < maxAttempts) {
          logger.info(`Transaction still pending, retrying in ${intervalMs}ms`, { 
            checkoutRequestId, 
            attempt: attempts 
          });
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        logger.warn(`Error polling transaction status, retrying`, { 
          checkoutRequestId, 
          attempt: attempts,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    throw new Error(`Transaction status polling timeout after ${maxAttempts} attempts`);
  }

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle Kenyan phone numbers
    if (cleaned.startsWith('0')) {
      return '254' + cleaned.slice(1);
    } else if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.length === 9 && (cleaned.startsWith('7') || cleaned.startsWith('11'))) {
      // Only format 9-digit numbers that start with valid Kenyan mobile prefixes (7xx or 11x)
      return '254' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const formatted = this.formatPhoneNumber(phoneNumber);
    // Kenyan phone numbers should be 12 digits starting with 254 and mobile prefix (7 or 1)
    return /^254[17]\d{8}$/.test(formatted);
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      await this.getAccessToken();
      return { status: 'healthy', message: 'M-Pesa service is operational' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `M-Pesa service error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}