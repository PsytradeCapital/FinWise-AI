import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Transaction, BankTransaction, MpesaTransaction } from '@finwise-ai/shared';
import { logger } from '../utils/logger';

export interface BankAPIConfig {
  baseUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  accountId: string;
  provider: string;
}

export interface MpesaAPIConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
}

export interface FetchResult {
  success: boolean;
  transactions: Transaction[];
  error?: string;
  nextCursor?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

/**
 * Transaction Fetcher Service
 * Handles API-based transaction fetching from banks and M-Pesa
 */
export class TransactionFetcher {
  private bankClients: Map<string, AxiosInstance> = new Map();
  private mpesaClient?: AxiosInstance;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  };

  /**
   * Initialize bank API client
   */
  public initializeBankClient(config: BankAPIConfig): void {
    const client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Client-ID': config.clientId,
      },
    });

    // Add request interceptor for logging
    client.interceptors.request.use(
      (request) => {
        logger.info('Bank API request', {
          provider: config.provider,
          method: request.method?.toUpperCase(),
          url: request.url,
          accountId: config.accountId,
        });
        return request;
      },
      (error) => {
        logger.error('Bank API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    client.interceptors.response.use(
      (response) => {
        logger.info('Bank API response', {
          provider: config.provider,
          status: response.status,
          dataLength: response.data ? JSON.stringify(response.data).length : 0,
        });
        return response;
      },
      (error) => {
        logger.error('Bank API response error', {
          provider: config.provider,
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
        });
        return Promise.reject(error);
      }
    );

    this.bankClients.set(config.provider, client);
  }

  /**
   * Initialize M-Pesa API client
   */
  public initializeMpesaClient(config: MpesaAPIConfig): void {
    this.mpesaClient = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add interceptors similar to bank client
    this.mpesaClient.interceptors.request.use(
      (request) => {
        logger.info('M-Pesa API request', {
          method: request.method?.toUpperCase(),
          url: request.url,
        });
        return request;
      }
    );

    this.mpesaClient.interceptors.response.use(
      (response) => {
        logger.info('M-Pesa API response', {
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.error('M-Pesa API response error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch transactions from bank API
   */
  public async fetchBankTransactions(
    provider: string,
    accountId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<FetchResult> {
    const client = this.bankClients.get(provider);
    if (!client) {
      return {
        success: false,
        transactions: [],
        error: `Bank client not initialized for provider: ${provider}`,
      };
    }

    try {
      const result = await this.executeWithRetry(async () => {
        const params: any = {
          account_id: accountId,
          limit: options.limit || 100,
        };

        if (options.startDate) {
          params.start_date = options.startDate.toISOString().split('T')[0];
        }
        if (options.endDate) {
          params.end_date = options.endDate.toISOString().split('T')[0];
        }
        if (options.cursor) {
          params.cursor = options.cursor;
        }

        const response = await client.get('/transactions', { params });
        return response.data;
      });

      const transactions = this.normalizeBankTransactions(result.transactions || [], provider);

      return {
        success: true,
        transactions,
        nextCursor: result.next_cursor,
      };

    } catch (error) {
      logger.error('Failed to fetch bank transactions', {
        provider,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        transactions: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch transactions from M-Pesa API
   */
  public async fetchMpesaTransactions(
    phoneNumber: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<FetchResult> {
    if (!this.mpesaClient) {
      return {
        success: false,
        transactions: [],
        error: 'M-Pesa client not initialized',
      };
    }

    try {
      // First, get access token
      const accessToken = await this.getMpesaAccessToken();
      
      const result = await this.executeWithRetry(async () => {
        const params: any = {
          phone_number: phoneNumber,
          limit: options.limit || 100,
        };

        if (options.startDate) {
          params.start_date = options.startDate.toISOString();
        }
        if (options.endDate) {
          params.end_date = options.endDate.toISOString();
        }

        const response = await this.mpesaClient!.get('/transactions', {
          params,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        return response.data;
      });

      const transactions = this.normalizeMpesaTransactions(result.transactions || []);

      return {
        success: true,
        transactions,
      };

    } catch (error) {
      logger.error('Failed to fetch M-Pesa transactions', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        transactions: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get list of supported providers
   */
  public getSupportedProviders(): string[] {
    const bankProviders = Array.from(this.bankClients.keys());
    const providers = [...bankProviders];
    
    if (this.mpesaClient) {
      providers.push('mpesa');
    }
    
    return providers;
  }

  /**
   * Poll for new transactions from all configured sources
   */
  public async pollAllTransactions(
    userId: string,
    configs: {
      bankConfigs: Array<BankAPIConfig & { accountId: string }>;
      mpesaConfig?: MpesaAPIConfig & { phoneNumber: string };
    }
  ): Promise<FetchResult> {
    const allTransactions: Transaction[] = [];
    const errors: string[] = [];

    // Fetch from all bank APIs
    for (const config of configs.bankConfigs) {
      try {
        const result = await this.fetchBankTransactions(
          config.provider,
          config.accountId,
          {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            limit: 50,
          }
        );

        if (result.success) {
          // Add userId to transactions
          const userTransactions = result.transactions.map(tx => ({
            ...tx,
            userId,
            id: this.generateTransactionId(tx),
          }));
          allTransactions.push(...userTransactions);
        } else {
          errors.push(`${config.provider}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`${config.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Fetch from M-Pesa if configured
    if (configs.mpesaConfig) {
      try {
        const result = await this.fetchMpesaTransactions(
          configs.mpesaConfig.phoneNumber,
          {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            limit: 50,
          }
        );

        if (result.success) {
          // Add userId to transactions
          const userTransactions = result.transactions.map(tx => ({
            ...tx,
            userId,
            id: this.generateTransactionId(tx),
          }));
          allTransactions.push(...userTransactions);
        } else {
          errors.push(`M-Pesa: ${result.error}`);
        }
      } catch (error) {
        errors.push(`M-Pesa: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0 || allTransactions.length > 0,
      transactions: allTransactions,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === this.retryConfig.maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt),
          this.retryConfig.maxDelay
        );

        logger.warn(`API call failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Get M-Pesa access token
   */
  private async getMpesaAccessToken(): Promise<string> {
    if (!this.mpesaClient) {
      throw new Error('M-Pesa client not initialized');
    }

    // This would typically use OAuth2 flow
    // For now, return a placeholder
    const response = await this.mpesaClient.post('/oauth/token', {
      grant_type: 'client_credentials',
    }, {
      auth: {
        username: process.env.MPESA_CONSUMER_KEY || '',
        password: process.env.MPESA_CONSUMER_SECRET || '',
      },
    });

    return response.data.access_token;
  }

  /**
   * Normalize bank transactions to common format
   */
  private normalizeBankTransactions(bankTransactions: BankTransaction[], provider: string): Transaction[] {
    return bankTransactions.map(tx => ({
      id: '', // Will be set by caller
      userId: '', // Will be set by caller
      amount: Math.abs(tx.amount),
      currency: 'KES', // Assume KES for Kenyan banks
      description: tx.description,
      category: 'Uncategorized',
      timestamp: new Date(tx.date),
      source: 'api' as const,
      rawData: JSON.stringify(tx),
      isVerified: true,
      merchant: this.extractMerchantFromDescription(tx.description),
    }));
  }

  /**
   * Normalize M-Pesa transactions to common format
   */
  private normalizeMpesaTransactions(mpesaTransactions: MpesaTransaction[]): Transaction[] {
    return mpesaTransactions.map(tx => ({
      id: '', // Will be set by caller
      userId: '', // Will be set by caller
      amount: tx.amount,
      currency: 'KES',
      description: `M-Pesa ${tx.transactionId} - ${tx.recipient}`,
      category: 'Uncategorized',
      timestamp: new Date(tx.timestamp),
      source: 'api' as const,
      rawData: JSON.stringify(tx),
      isVerified: tx.status === 'completed',
      merchant: tx.recipient,
    }));
  }

  /**
   * Extract merchant name from transaction description
   */
  private extractMerchantFromDescription(description: string): string {
    // Simple extraction logic - can be enhanced
    const patterns = [
      /POS\s+(.+?)(?:\s+\d|$)/i,
      /ATM\s+(.+?)(?:\s+\d|$)/i,
      /ONLINE\s+(.+?)(?:\s+\d|$)/i,
      /^(.+?)\s+\d{2}\/\d{2}/,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return description.split(' ').slice(0, 3).join(' ');
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(transaction: Partial<Transaction>): string {
    const data = `${transaction.amount}-${transaction.timestamp?.getTime()}-${transaction.description}`;
    return Buffer.from(data).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return phoneNumber;
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const transactionFetcher = new TransactionFetcher();