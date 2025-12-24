import axios, { AxiosInstance } from 'axios';
import { NaboCapitalTransfer } from '@finwise-ai/shared';
import { logger } from '../utils/logger';

/**
 * Nabo Capital API Service
 * Handles automated savings transfers and account management
 */

export interface NaboCapitalConfig {
  baseUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
}

export interface NaboAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  currency: string;
  accountType: 'savings' | 'investment';
  isActive: boolean;
  createdAt: Date;
}

export interface TransferRequest {
  amount: number;
  currency: string;
  sourceAccount?: string;
  targetAccount: string;
  reference: string;
  description: string;
  scheduledDate?: Date;
}

export interface TransferResponse {
  transferId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  currency: string;
  reference: string;
  createdAt: Date;
  estimatedCompletionTime?: Date;
  failureReason?: string;
}

export interface AccountLinkingRequest {
  userId: string;
  phoneNumber: string;
  idNumber: string;
  fullName: string;
  email: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export interface AccountLinkingResponse {
  linkingId: string;
  status: 'pending' | 'verified' | 'failed';
  accountId?: string;
  verificationMethod: 'sms' | 'email' | 'bank_verification';
  expiresAt: Date;
}

export class NaboCapitalService {
  private client: AxiosInstance;
  private config: NaboCapitalConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: NaboCapitalConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Version': '1.0',
        'X-Client-ID': config.clientId,
      },
    });

    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      async (request) => {
        const token = await this.getValidAccessToken();
        if (token) {
          request.headers['Authorization'] = `Bearer ${token}`;
        }

        logger.info('Nabo Capital API request', {
          method: request.method?.toUpperCase(),
          url: request.url,
          hasAuth: !!token,
        });

        return request;
      },
      (error) => {
        logger.error('Nabo Capital API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Nabo Capital API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      async (error) => {
        logger.error('Nabo Capital API response error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url,
        });

        // Handle token refresh for 401 errors
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          try {
            await this.refreshAccessToken();
            const token = await this.getValidAccessToken();
            if (token) {
              error.config.headers['Authorization'] = `Bearer ${token}`;
              return this.client.request(error.config);
            }
          } catch (refreshError) {
            logger.error('Token refresh failed', { error: refreshError });
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Link user account with Nabo Capital
   */
  async linkAccount(request: AccountLinkingRequest): Promise<AccountLinkingResponse> {
    try {
      logger.info('Linking account with Nabo Capital', { 
        userId: request.userId,
        phoneNumber: this.maskPhoneNumber(request.phoneNumber)
      });

      const response = await this.client.post('/accounts/link', {
        user_id: request.userId,
        phone_number: request.phoneNumber,
        id_number: request.idNumber,
        full_name: request.fullName,
        email: request.email,
        bank_account: request.bankAccount ? {
          bank_name: request.bankAccount.bankName,
          account_number: request.bankAccount.accountNumber,
          account_name: request.bankAccount.accountName,
        } : undefined,
      });

      const result: AccountLinkingResponse = {
        linkingId: response.data.linking_id,
        status: response.data.status,
        accountId: response.data.account_id,
        verificationMethod: response.data.verification_method,
        expiresAt: new Date(response.data.expires_at),
      };

      logger.info('Account linking initiated', { 
        linkingId: result.linkingId,
        status: result.status,
        verificationMethod: result.verificationMethod
      });

      return result;

    } catch (error) {
      logger.error('Failed to link account', { 
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to link account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify account linking with OTP or other verification method
   */
  async verifyAccountLinking(linkingId: string, verificationCode: string): Promise<{ accountId: string; status: string }> {
    try {
      logger.info('Verifying account linking', { linkingId });

      const response = await this.client.post(`/accounts/link/${linkingId}/verify`, {
        verification_code: verificationCode,
      });

      const result = {
        accountId: response.data.account_id,
        status: response.data.status,
      };

      logger.info('Account linking verified', { 
        linkingId,
        accountId: result.accountId,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('Failed to verify account linking', { 
        linkingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to verify account linking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's Nabo Capital accounts
   */
  async getAccounts(userId: string): Promise<NaboAccount[]> {
    try {
      logger.info('Fetching Nabo Capital accounts', { userId });

      const response = await this.client.get('/accounts', {
        params: { user_id: userId },
      });

      const accounts = response.data.accounts.map((account: any) => ({
        id: account.id,
        accountNumber: account.account_number,
        accountName: account.account_name,
        balance: parseFloat(account.balance),
        currency: account.currency,
        accountType: account.account_type,
        isActive: account.is_active,
        createdAt: new Date(account.created_at),
      }));

      logger.info('Nabo Capital accounts fetched', { 
        userId,
        accountCount: accounts.length
      });

      return accounts;

    } catch (error) {
      logger.error('Failed to fetch Nabo Capital accounts', { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to fetch accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initiate savings transfer
   */
  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    try {
      logger.info('Initiating Nabo Capital transfer', { 
        amount: request.amount,
        currency: request.currency,
        reference: request.reference
      });

      const payload: any = {
        amount: request.amount,
        currency: request.currency,
        target_account: request.targetAccount,
        reference: request.reference,
        description: request.description,
      };

      if (request.sourceAccount) {
        payload.source_account = request.sourceAccount;
      }

      if (request.scheduledDate) {
        payload.scheduled_date = request.scheduledDate.toISOString();
      }

      const response = await this.client.post('/transfers', payload);

      const result: TransferResponse = {
        transferId: response.data.transfer_id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        reference: response.data.reference,
        createdAt: new Date(response.data.created_at),
        estimatedCompletionTime: response.data.estimated_completion_time 
          ? new Date(response.data.estimated_completion_time) 
          : undefined,
        failureReason: response.data.failure_reason,
      };

      logger.info('Transfer initiated successfully', { 
        transferId: result.transferId,
        status: result.status,
        amount: result.amount
      });

      return result;

    } catch (error) {
      logger.error('Failed to initiate transfer', { 
        amount: request.amount,
        reference: request.reference,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to initiate transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(transferId: string): Promise<TransferResponse> {
    try {
      logger.info('Getting transfer status', { transferId });

      const response = await this.client.get(`/transfers/${transferId}`);

      const result: TransferResponse = {
        transferId: response.data.transfer_id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        reference: response.data.reference,
        createdAt: new Date(response.data.created_at),
        estimatedCompletionTime: response.data.estimated_completion_time 
          ? new Date(response.data.estimated_completion_time) 
          : undefined,
        failureReason: response.data.failure_reason,
      };

      logger.info('Transfer status retrieved', { 
        transferId,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('Failed to get transfer status', { 
        transferId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to get transfer status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel pending transfer
   */
  async cancelTransfer(transferId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Cancelling transfer', { transferId, reason });

      const response = await this.client.post(`/transfers/${transferId}/cancel`, {
        reason: reason || 'User requested cancellation',
      });

      const result = {
        success: response.data.success,
        message: response.data.message,
      };

      logger.info('Transfer cancelled', { transferId, success: result.success });

      return result;

    } catch (error) {
      logger.error('Failed to cancel transfer', { 
        transferId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to cancel transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transfer history
   */
  async getTransferHistory(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ transfers: TransferResponse[]; total: number; hasMore: boolean }> {
    try {
      logger.info('Fetching transfer history', { userId, options });

      const params: any = {
        user_id: userId,
        limit: options.limit || 50,
        offset: options.offset || 0,
      };

      if (options.startDate) {
        params.start_date = options.startDate.toISOString().split('T')[0];
      }
      if (options.endDate) {
        params.end_date = options.endDate.toISOString().split('T')[0];
      }
      if (options.status) {
        params.status = options.status;
      }

      const response = await this.client.get('/transfers', { params });

      const transfers = response.data.transfers.map((transfer: any) => ({
        transferId: transfer.transfer_id,
        status: transfer.status,
        amount: transfer.amount,
        currency: transfer.currency,
        reference: transfer.reference,
        createdAt: new Date(transfer.created_at),
        estimatedCompletionTime: transfer.estimated_completion_time 
          ? new Date(transfer.estimated_completion_time) 
          : undefined,
        failureReason: transfer.failure_reason,
      }));

      const result = {
        transfers,
        total: response.data.total,
        hasMore: response.data.has_more,
      };

      logger.info('Transfer history fetched', { 
        userId,
        transferCount: transfers.length,
        total: result.total
      });

      return result;

    } catch (error) {
      logger.error('Failed to fetch transfer history', { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to fetch transfer history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set up automated savings rules
   */
  async setupAutomatedSavings(
    userId: string,
    rules: {
      roundUpSavings?: boolean;
      percentageSavings?: number;
      minimumTransfer?: number;
      maximumDailyTransfer?: number;
      targetAccount: string;
    }
  ): Promise<{ ruleId: string; status: string }> {
    try {
      logger.info('Setting up automated savings', { userId, rules });

      const response = await this.client.post('/automation/savings-rules', {
        user_id: userId,
        round_up_savings: rules.roundUpSavings,
        percentage_savings: rules.percentageSavings,
        minimum_transfer: rules.minimumTransfer,
        maximum_daily_transfer: rules.maximumDailyTransfer,
        target_account: rules.targetAccount,
      });

      const result = {
        ruleId: response.data.rule_id,
        status: response.data.status,
      };

      logger.info('Automated savings rule created', { 
        userId,
        ruleId: result.ruleId,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('Failed to setup automated savings', { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to setup automated savings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      await this.client.get('/health');
      const responseTime = Date.now() - startTime;
      
      return { 
        status: 'healthy', 
        message: 'Nabo Capital service is operational',
        responseTime
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `Nabo Capital service error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get or refresh access token
   */
  private async getValidAccessToken(): Promise<string | null> {
    // Check if current token is still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiry && new Date(Date.now() + 5 * 60 * 1000) < this.tokenExpiry) {
      return this.accessToken;
    }

    // Get new token
    try {
      await this.refreshAccessToken();
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get access token', { error });
      return null;
    }
  }

  /**
   * Refresh access token using client credentials
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      logger.info('Refreshing Nabo Capital access token');

      const response = await axios.post(`${this.config.baseUrl}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'accounts transfers automation',
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));

      logger.info('Access token refreshed successfully', { 
        expiresAt: this.tokenExpiry 
      });

    } catch (error) {
      logger.error('Failed to refresh access token', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return phoneNumber;
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
  }
}

// Export singleton instance - only create if environment variables are available
let naboCapitalServiceInstance: NaboCapitalService | null = null;

export const naboCapitalService = {
  getInstance(): NaboCapitalService {
    if (!naboCapitalServiceInstance) {
      // Only create instance if we have the required environment variables
      const baseUrl = process.env.NABO_CAPITAL_API_URL || 'https://api.nabocapital.com/v1';
      const apiKey = process.env.NABO_CAPITAL_API_KEY || '';
      const clientId = process.env.NABO_CAPITAL_CLIENT_ID || '';
      const clientSecret = process.env.NABO_CAPITAL_CLIENT_SECRET || '';
      const environment = (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production';

      naboCapitalServiceInstance = new NaboCapitalService({
        baseUrl,
        apiKey,
        clientId,
        clientSecret,
        environment,
      });
    }
    return naboCapitalServiceInstance;
  }
};