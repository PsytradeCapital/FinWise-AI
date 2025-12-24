import axios, { AxiosInstance } from 'axios';
import { BankTransaction } from '@finwise-ai/shared';
import { logger } from '../utils/logger';

/**
 * Banking Service
 * Implements Open Banking compliant connections and bank-specific API adapters
 */

export interface BankConfig {
  provider: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  apiKey?: string;
  environment: 'sandbox' | 'production';
  supportedFeatures: BankFeature[];
}

export interface BankFeature {
  name: 'accounts' | 'transactions' | 'balance' | 'payments' | 'standing_orders';
  version: string;
  endpoint: string;
}

export interface BankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: 'savings' | 'current' | 'credit' | 'loan';
  currency: string;
  balance: number;
  availableBalance: number;
  provider: string;
}

export interface BankingServiceConfig {
  retryAttempts: number;
  timeoutMs: number;
  rateLimitPerMinute: number;
}

export interface OpenBankingToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
}

export class BankingService {
  private clients: Map<string, AxiosInstance> = new Map();
  private tokens: Map<string, OpenBankingToken> = new Map();
  private config: BankingServiceConfig;

  constructor(config: BankingServiceConfig = {
    retryAttempts: 3,
    timeoutMs: 30000,
    rateLimitPerMinute: 60
  }) {
    this.config = config;
  }

  /**
   * Initialize bank client with Open Banking compliance
   */
  async initializeBankClient(bankConfig: BankConfig): Promise<void> {
    try {
      logger.info('Initializing bank client', { provider: bankConfig.provider });

      const client = axios.create({
        baseURL: bankConfig.baseUrl,
        timeout: this.config.timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-FAPI-Financial-ID': bankConfig.clientId,
          'X-FAPI-Customer-IP-Address': '127.0.0.1', // Should be actual client IP
          'X-FAPI-Interaction-ID': this.generateInteractionId(),
        },
      });

      // Add request interceptor for authentication and logging
      client.interceptors.request.use(
        async (request) => {
          const token = await this.getValidToken(bankConfig.provider);
          if (token) {
            request.headers['Authorization'] = `Bearer ${token.accessToken}`;
          }

          logger.info('Bank API request', {
            provider: bankConfig.provider,
            method: request.method?.toUpperCase(),
            url: request.url,
            interactionId: request.headers['X-FAPI-Interaction-ID'],
          });

          return request;
        },
        (error) => {
          logger.error('Bank API request error', { 
            provider: bankConfig.provider,
            error: error.message 
          });
          return Promise.reject(error);
        }
      );

      // Add response interceptor for error handling and compliance
      client.interceptors.response.use(
        (response) => {
          logger.info('Bank API response', {
            provider: bankConfig.provider,
            status: response.status,
            interactionId: response.headers['x-fapi-interaction-id'],
          });
          return response;
        },
        async (error) => {
          logger.error('Bank API response error', {
            provider: bankConfig.provider,
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            interactionId: error.response?.headers['x-fapi-interaction-id'],
          });

          // Handle token refresh for 401 errors
          if (error.response?.status === 401) {
            try {
              await this.refreshToken(bankConfig);
              // Retry the original request
              const originalRequest = error.config;
              const token = await this.getValidToken(bankConfig.provider);
              if (token) {
                originalRequest.headers['Authorization'] = `Bearer ${token.accessToken}`;
                return client.request(originalRequest);
              }
            } catch (refreshError) {
              logger.error('Token refresh failed', { 
                provider: bankConfig.provider,
                error: refreshError instanceof Error ? refreshError.message : 'Unknown error'
              });
            }
          }

          return Promise.reject(error);
        }
      );

      this.clients.set(bankConfig.provider, client);

      // Initialize OAuth2 token
      await this.authenticateWithBank(bankConfig);

      logger.info('Bank client initialized successfully', { provider: bankConfig.provider });

    } catch (error) {
      logger.error('Failed to initialize bank client', {
        provider: bankConfig.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to initialize ${bankConfig.provider} client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's bank accounts
   */
  async getAccounts(provider: string, userId: string): Promise<BankAccount[]> {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`Bank client not initialized for provider: ${provider}`);
    }

    try {
      logger.info('Fetching bank accounts', { provider, userId });

      const response = await client.get('/accounts', {
        headers: {
          'X-Customer-User-Agent': 'FinWise-AI/1.0',
          'X-FAPI-Interaction-ID': this.generateInteractionId(),
        },
      });

      const accounts = this.normalizeAccounts(response.data.accounts || [], provider);

      logger.info('Bank accounts fetched successfully', { 
        provider, 
        userId,
        accountCount: accounts.length 
      });

      return accounts;

    } catch (error) {
      logger.error('Failed to fetch bank accounts', {
        provider,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to fetch accounts from ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transactions for a specific account
   */
  async getTransactions(
    provider: string,
    accountId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<BankTransaction[]> {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`Bank client not initialized for provider: ${provider}`);
    }

    try {
      logger.info('Fetching bank transactions', { provider, accountId, options });

      const params: any = {
        limit: options.limit || 100,
        offset: options.offset || 0,
      };

      if (options.startDate) {
        params.fromBookingDateTime = options.startDate.toISOString();
      }
      if (options.endDate) {
        params.toBookingDateTime = options.endDate.toISOString();
      }

      const response = await client.get(`/accounts/${accountId}/transactions`, {
        params,
        headers: {
          'X-Customer-User-Agent': 'FinWise-AI/1.0',
          'X-FAPI-Interaction-ID': this.generateInteractionId(),
        },
      });

      const transactions = this.normalizeTransactions(
        response.data.transactions || [], 
        provider, 
        accountId
      );

      logger.info('Bank transactions fetched successfully', { 
        provider, 
        accountId,
        transactionCount: transactions.length 
      });

      return transactions;

    } catch (error) {
      logger.error('Failed to fetch bank transactions', {
        provider,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to fetch transactions from ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(provider: string, accountId: string): Promise<{ balance: number; availableBalance: number; currency: string }> {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`Bank client not initialized for provider: ${provider}`);
    }

    try {
      logger.info('Fetching account balance', { provider, accountId });

      const response = await client.get(`/accounts/${accountId}/balances`, {
        headers: {
          'X-Customer-User-Agent': 'FinWise-AI/1.0',
          'X-FAPI-Interaction-ID': this.generateInteractionId(),
        },
      });

      const balanceData = response.data.balances?.[0] || {};
      const result = {
        balance: parseFloat(balanceData.amount?.amount || '0'),
        availableBalance: parseFloat(balanceData.creditDebitIndicator === 'Credit' 
          ? balanceData.amount?.amount || '0' 
          : '0'),
        currency: balanceData.amount?.currency || 'KES',
      };

      logger.info('Account balance fetched successfully', { provider, accountId, balance: result.balance });

      return result;

    } catch (error) {
      logger.error('Failed to fetch account balance', {
        provider,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to fetch balance from ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate security compliance
   */
  async validateSecurityCompliance(provider: string): Promise<{ isCompliant: boolean; issues: string[] }> {
    const client = this.clients.get(provider);
    if (!client) {
      return { isCompliant: false, issues: ['Client not initialized'] };
    }

    const issues: string[] = [];

    try {
      // Check if HTTPS is used
      const baseURL = client.defaults.baseURL || '';
      if (!baseURL.startsWith('https://')) {
        issues.push('API endpoint must use HTTPS');
      }

      // Check if proper headers are set
      const headers = client.defaults.headers;
      if (!headers['X-FAPI-Financial-ID']) {
        issues.push('Missing X-FAPI-Financial-ID header');
      }

      // Check token validity
      const token = this.tokens.get(provider);
      if (!token || new Date() >= token.expiresAt) {
        issues.push('Invalid or expired access token');
      }

      // Check if required scopes are present
      if (token && !token.scope.includes('accounts')) {
        issues.push('Missing required accounts scope');
      }

      logger.info('Security compliance check completed', { 
        provider, 
        isCompliant: issues.length === 0,
        issueCount: issues.length 
      });

      return {
        isCompliant: issues.length === 0,
        issues,
      };

    } catch (error) {
      logger.error('Security compliance check failed', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      issues.push(`Compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isCompliant: false, issues };
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; providers: Record<string, string> }> {
    const providers: Record<string, string> = {};
    let healthyCount = 0;

    for (const [provider, client] of this.clients.entries()) {
      try {
        // Simple health check - try to get a token
        const token = await this.getValidToken(provider);
        if (token) {
          providers[provider] = 'healthy';
          healthyCount++;
        } else {
          providers[provider] = 'unhealthy - no valid token';
        }
      } catch (error) {
        providers[provider] = `unhealthy - ${error instanceof Error ? error.message : 'unknown error'}`;
      }
    }

    const totalProviders = this.clients.size;
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (totalProviders === 0) {
      status = 'unhealthy';
    } else if (healthyCount === totalProviders) {
      status = 'healthy';
    } else if (healthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, providers };
  }

  /**
   * Authenticate with bank using OAuth2
   */
  private async authenticateWithBank(bankConfig: BankConfig): Promise<void> {
    try {
      logger.info('Authenticating with bank', { provider: bankConfig.provider });

      const client = this.clients.get(bankConfig.provider);
      if (!client) {
        throw new Error('Client not initialized');
      }

      // OAuth2 Client Credentials flow for server-to-server authentication
      const authResponse = await client.post('/oauth2/token', {
        grant_type: 'client_credentials',
        scope: 'accounts transactions balances',
        client_id: bankConfig.clientId,
        client_secret: bankConfig.clientSecret,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const tokenData = authResponse.data;
      const token: OpenBankingToken = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        scope: tokenData.scope?.split(' ') || ['accounts', 'transactions'],
      };

      this.tokens.set(bankConfig.provider, token);

      logger.info('Bank authentication successful', { 
        provider: bankConfig.provider,
        expiresAt: token.expiresAt,
        scopes: token.scope 
      });

    } catch (error) {
      logger.error('Bank authentication failed', {
        provider: bankConfig.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Authentication failed for ${bankConfig.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh expired token
   */
  private async refreshToken(bankConfig: BankConfig): Promise<void> {
    const currentToken = this.tokens.get(bankConfig.provider);
    if (!currentToken?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      logger.info('Refreshing bank token', { provider: bankConfig.provider });

      const client = this.clients.get(bankConfig.provider);
      if (!client) {
        throw new Error('Client not initialized');
      }

      const response = await client.post('/oauth2/token', {
        grant_type: 'refresh_token',
        refresh_token: currentToken.refreshToken,
        client_id: bankConfig.clientId,
        client_secret: bankConfig.clientSecret,
      });

      const tokenData = response.data;
      const newToken: OpenBankingToken = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || currentToken.refreshToken,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        scope: tokenData.scope?.split(' ') || currentToken.scope,
      };

      this.tokens.set(bankConfig.provider, newToken);

      logger.info('Bank token refreshed successfully', { provider: bankConfig.provider });

    } catch (error) {
      logger.error('Token refresh failed', {
        provider: bankConfig.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get valid token (refresh if needed)
   */
  private async getValidToken(provider: string): Promise<OpenBankingToken | null> {
    const token = this.tokens.get(provider);
    if (!token) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    if (new Date(Date.now() + bufferTime) >= token.expiresAt) {
      logger.info('Token expired, attempting refresh', { provider });
      // Token refresh would need bank config - for now return null
      return null;
    }

    return token;
  }

  /**
   * Normalize account data from different bank formats
   */
  private normalizeAccounts(accounts: any[], provider: string): BankAccount[] {
    return accounts.map(account => ({
      id: account.accountId || account.id,
      accountNumber: account.accountNumber || account.account || '',
      accountName: account.accountName || account.name || account.nickname || '',
      accountType: this.normalizeAccountType(account.accountType || account.type),
      currency: account.currency || 'KES',
      balance: parseFloat(account.balance?.amount || account.balance || '0'),
      availableBalance: parseFloat(account.availableBalance?.amount || account.available || account.balance || '0'),
      provider,
    }));
  }

  /**
   * Normalize transaction data from different bank formats
   */
  private normalizeTransactions(transactions: any[], provider: string, accountId: string): BankTransaction[] {
    return transactions.map(tx => ({
      id: tx.transactionId || tx.id || this.generateTransactionId(tx),
      accountId,
      amount: Math.abs(parseFloat(tx.amount?.amount || tx.amount || '0')),
      description: tx.transactionInformation || tx.description || tx.narrative || 'Bank Transaction',
      date: tx.bookingDateTime || tx.valueDateTime || tx.date || new Date().toISOString(),
      balance: parseFloat(tx.balance?.amount || tx.runningBalance || '0'),
      type: this.normalizeTransactionType(tx.creditDebitIndicator || tx.type, tx.amount),
    }));
  }

  /**
   * Normalize account type from different bank formats
   */
  private normalizeAccountType(type: string): 'savings' | 'current' | 'credit' | 'loan' {
    const normalizedType = type?.toLowerCase() || '';
    
    if (normalizedType.includes('saving')) return 'savings';
    if (normalizedType.includes('current') || normalizedType.includes('checking')) return 'current';
    if (normalizedType.includes('credit') || normalizedType.includes('card')) return 'credit';
    if (normalizedType.includes('loan') || normalizedType.includes('mortgage')) return 'loan';
    
    return 'current'; // Default
  }

  /**
   * Normalize transaction type
   */
  private normalizeTransactionType(indicator: string, amount: any): 'debit' | 'credit' {
    if (indicator) {
      return indicator.toLowerCase() === 'credit' ? 'credit' : 'debit';
    }
    
    // Fallback to amount sign
    const numAmount = parseFloat(amount?.amount || amount || '0');
    return numAmount >= 0 ? 'credit' : 'debit';
  }

  /**
   * Generate unique interaction ID for FAPI compliance
   */
  private generateInteractionId(): string {
    return `finwise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate transaction ID from transaction data
   */
  private generateTransactionId(tx: any): string {
    const data = `${tx.amount}-${tx.date}-${tx.description}`;
    return Buffer.from(data).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }
}

// Export singleton instance
export const bankingService = new BankingService();