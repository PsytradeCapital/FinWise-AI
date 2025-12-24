import { BankConfig, BankingService } from './bankingService';
import { logger } from '../utils/logger';

/**
 * Bank Adapters for Kenyan Banks
 * Provides specific configurations and adapters for major Kenyan banks
 */

export interface KenyanBankAdapter {
  provider: string;
  name: string;
  config: BankConfig;
  customMethods?: {
    formatAccountNumber?: (accountNumber: string) => string;
    parseTransactionDescription?: (description: string) => { merchant?: string; category?: string };
    validateAccountNumber?: (accountNumber: string) => boolean;
  };
}

/**
 * Equity Bank Adapter
 */
export const equityBankAdapter: KenyanBankAdapter = {
  provider: 'equity_bank',
  name: 'Equity Bank Kenya',
  config: {
    provider: 'equity_bank',
    baseUrl: process.env.EQUITY_BANK_API_URL || 'https://api.equitybank.co.ke/v1',
    clientId: process.env.EQUITY_BANK_CLIENT_ID || '',
    clientSecret: process.env.EQUITY_BANK_CLIENT_SECRET || '',
    apiKey: process.env.EQUITY_BANK_API_KEY,
    environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
    supportedFeatures: [
      { name: 'accounts', version: '1.0', endpoint: '/accounts' },
      { name: 'transactions', version: '1.0', endpoint: '/accounts/{accountId}/transactions' },
      { name: 'balance', version: '1.0', endpoint: '/accounts/{accountId}/balances' },
    ],
  },
  customMethods: {
    formatAccountNumber: (accountNumber: string) => {
      // Equity Bank account numbers are typically 13 digits
      const cleaned = accountNumber.replace(/\D/g, '');
      if (cleaned.length === 13) {
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
      }
      return accountNumber;
    },
    parseTransactionDescription: (description: string) => {
      const result: { merchant?: string; category?: string } = {};
      
      // Common Equity Bank transaction patterns
      if (description.includes('ATM WITHDRAWAL')) {
        result.category = 'Cash Withdrawal';
        const match = description.match(/ATM WITHDRAWAL\s+(.+?)(?:\s+\d|$)/i);
        if (match) result.merchant = match[1].trim();
      } else if (description.includes('POS PURCHASE')) {
        result.category = 'Purchase';
        const match = description.match(/POS PURCHASE\s+(.+?)(?:\s+\d|$)/i);
        if (match) result.merchant = match[1].trim();
      } else if (description.includes('MOBILE BANKING')) {
        result.category = 'Mobile Banking';
      } else if (description.includes('SALARY')) {
        result.category = 'Salary';
      }
      
      return result;
    },
    validateAccountNumber: (accountNumber: string) => {
      const cleaned = accountNumber.replace(/\D/g, '');
      return cleaned.length === 13 && cleaned.startsWith('01');
    },
  },
};

/**
 * KCB Bank Adapter
 */
export const kcbBankAdapter: KenyanBankAdapter = {
  provider: 'kcb_bank',
  name: 'Kenya Commercial Bank',
  config: {
    provider: 'kcb_bank',
    baseUrl: process.env.KCB_BANK_API_URL || 'https://api.kcbbank.co.ke/v1',
    clientId: process.env.KCB_BANK_CLIENT_ID || '',
    clientSecret: process.env.KCB_BANK_CLIENT_SECRET || '',
    apiKey: process.env.KCB_BANK_API_KEY,
    environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
    supportedFeatures: [
      { name: 'accounts', version: '1.0', endpoint: '/accounts' },
      { name: 'transactions', version: '1.0', endpoint: '/accounts/{accountId}/transactions' },
      { name: 'balance', version: '1.0', endpoint: '/accounts/{accountId}/balances' },
      { name: 'payments', version: '1.0', endpoint: '/payments' },
    ],
  },
  customMethods: {
    formatAccountNumber: (accountNumber: string) => {
      // KCB account numbers are typically 12 digits
      const cleaned = accountNumber.replace(/\D/g, '');
      if (cleaned.length === 12) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      return accountNumber;
    },
    parseTransactionDescription: (description: string) => {
      const result: { merchant?: string; category?: string } = {};
      
      // Common KCB transaction patterns
      if (description.includes('CASH WITHDRAWAL')) {
        result.category = 'Cash Withdrawal';
      } else if (description.includes('CARD PAYMENT')) {
        result.category = 'Card Payment';
        const match = description.match(/CARD PAYMENT\s+(.+?)(?:\s+\d|$)/i);
        if (match) result.merchant = match[1].trim();
      } else if (description.includes('INTERNET BANKING')) {
        result.category = 'Online Banking';
      } else if (description.includes('STANDING ORDER')) {
        result.category = 'Standing Order';
      }
      
      return result;
    },
    validateAccountNumber: (accountNumber: string) => {
      const cleaned = accountNumber.replace(/\D/g, '');
      return cleaned.length === 12;
    },
  },
};

/**
 * Cooperative Bank Adapter
 */
export const coopBankAdapter: KenyanBankAdapter = {
  provider: 'coop_bank',
  name: 'Cooperative Bank of Kenya',
  config: {
    provider: 'coop_bank',
    baseUrl: process.env.COOP_BANK_API_URL || 'https://api.co-opbank.co.ke/v1',
    clientId: process.env.COOP_BANK_CLIENT_ID || '',
    clientSecret: process.env.COOP_BANK_CLIENT_SECRET || '',
    apiKey: process.env.COOP_BANK_API_KEY,
    environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
    supportedFeatures: [
      { name: 'accounts', version: '1.0', endpoint: '/accounts' },
      { name: 'transactions', version: '1.0', endpoint: '/accounts/{accountId}/transactions' },
      { name: 'balance', version: '1.0', endpoint: '/accounts/{accountId}/balances' },
    ],
  },
  customMethods: {
    formatAccountNumber: (accountNumber: string) => {
      // Coop Bank account numbers are typically 13 digits starting with 01
      const cleaned = accountNumber.replace(/\D/g, '');
      if (cleaned.length === 13) {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
      }
      return accountNumber;
    },
    parseTransactionDescription: (description: string) => {
      const result: { merchant?: string; category?: string } = {};
      
      // Common Coop Bank transaction patterns
      if (description.includes('MCO-OP CASH')) {
        result.category = 'ATM Withdrawal';
      } else if (description.includes('VISA PURCHASE')) {
        result.category = 'Card Purchase';
        const match = description.match(/VISA PURCHASE\s+(.+?)(?:\s+\d|$)/i);
        if (match) result.merchant = match[1].trim();
      } else if (description.includes('COOP MOBILE')) {
        result.category = 'Mobile Banking';
      }
      
      return result;
    },
    validateAccountNumber: (accountNumber: string) => {
      const cleaned = accountNumber.replace(/\D/g, '');
      return cleaned.length === 13 && cleaned.startsWith('01');
    },
  },
};

/**
 * Standard Chartered Bank Adapter
 */
export const standardCharteredAdapter: KenyanBankAdapter = {
  provider: 'standard_chartered',
  name: 'Standard Chartered Bank Kenya',
  config: {
    provider: 'standard_chartered',
    baseUrl: process.env.SCB_API_URL || 'https://api.sc.com/ke/v1',
    clientId: process.env.SCB_CLIENT_ID || '',
    clientSecret: process.env.SCB_CLIENT_SECRET || '',
    apiKey: process.env.SCB_API_KEY,
    environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
    supportedFeatures: [
      { name: 'accounts', version: '2.0', endpoint: '/accounts' },
      { name: 'transactions', version: '2.0', endpoint: '/accounts/{accountId}/transactions' },
      { name: 'balance', version: '2.0', endpoint: '/accounts/{accountId}/balances' },
      { name: 'payments', version: '2.0', endpoint: '/payments' },
    ],
  },
  customMethods: {
    formatAccountNumber: (accountNumber: string) => {
      // Standard Chartered account numbers vary but are typically 10-12 digits
      const cleaned = accountNumber.replace(/\D/g, '');
      if (cleaned.length >= 10) {
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
      }
      return accountNumber;
    },
    parseTransactionDescription: (description: string) => {
      const result: { merchant?: string; category?: string } = {};
      
      // Common Standard Chartered transaction patterns
      if (description.includes('ATM CASH')) {
        result.category = 'ATM Withdrawal';
      } else if (description.includes('DEBIT CARD')) {
        result.category = 'Debit Card';
        const match = description.match(/DEBIT CARD\s+(.+?)(?:\s+\d|$)/i);
        if (match) result.merchant = match[1].trim();
      } else if (description.includes('ONLINE BANKING')) {
        result.category = 'Online Transfer';
      }
      
      return result;
    },
    validateAccountNumber: (accountNumber: string) => {
      const cleaned = accountNumber.replace(/\D/g, '');
      return cleaned.length >= 10 && cleaned.length <= 12;
    },
  },
};

/**
 * Bank Adapter Registry
 */
export class BankAdapterRegistry {
  private adapters: Map<string, KenyanBankAdapter> = new Map();
  private bankingService: BankingService;

  constructor(bankingService: BankingService) {
    this.bankingService = bankingService;
    this.registerDefaultAdapters();
  }

  /**
   * Register default Kenyan bank adapters
   */
  private registerDefaultAdapters(): void {
    this.registerAdapter(equityBankAdapter);
    this.registerAdapter(kcbBankAdapter);
    this.registerAdapter(coopBankAdapter);
    this.registerAdapter(standardCharteredAdapter);
  }

  /**
   * Register a bank adapter
   */
  registerAdapter(adapter: KenyanBankAdapter): void {
    this.adapters.set(adapter.provider, adapter);
    logger.info('Bank adapter registered', { 
      provider: adapter.provider, 
      name: adapter.name 
    });
  }

  /**
   * Get adapter by provider
   */
  getAdapter(provider: string): KenyanBankAdapter | undefined {
    return this.adapters.get(provider);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): KenyanBankAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Initialize all configured bank clients
   */
  async initializeAllBanks(): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const adapter of this.adapters.values()) {
      try {
        // Only initialize if credentials are provided
        if (adapter.config.clientId && adapter.config.clientSecret) {
          await this.bankingService.initializeBankClient(adapter.config);
          success.push(adapter.provider);
          logger.info('Bank client initialized', { provider: adapter.provider });
        } else {
          logger.warn('Bank credentials not provided, skipping initialization', { 
            provider: adapter.provider 
          });
        }
      } catch (error) {
        failed.push(adapter.provider);
        logger.error('Failed to initialize bank client', {
          provider: adapter.provider,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { success, failed };
  }

  /**
   * Validate account number using bank-specific rules
   */
  validateAccountNumber(provider: string, accountNumber: string): boolean {
    const adapter = this.adapters.get(provider);
    if (!adapter?.customMethods?.validateAccountNumber) {
      // Generic validation - just check if it's numeric and reasonable length
      const cleaned = accountNumber.replace(/\D/g, '');
      return cleaned.length >= 8 && cleaned.length <= 15;
    }

    return adapter.customMethods.validateAccountNumber(accountNumber);
  }

  /**
   * Format account number using bank-specific rules
   */
  formatAccountNumber(provider: string, accountNumber: string): string {
    const adapter = this.adapters.get(provider);
    if (!adapter?.customMethods?.formatAccountNumber) {
      return accountNumber;
    }

    return adapter.customMethods.formatAccountNumber(accountNumber);
  }

  /**
   * Parse transaction description using bank-specific rules
   */
  parseTransactionDescription(provider: string, description: string): { merchant?: string; category?: string } {
    const adapter = this.adapters.get(provider);
    if (!adapter?.customMethods?.parseTransactionDescription) {
      return {};
    }

    return adapter.customMethods.parseTransactionDescription(description);
  }

  /**
   * Get supported banks list
   */
  getSupportedBanks(): Array<{ provider: string; name: string; features: string[] }> {
    return Array.from(this.adapters.values()).map(adapter => ({
      provider: adapter.provider,
      name: adapter.name,
      features: adapter.config.supportedFeatures.map(f => f.name),
    }));
  }
}

// Export singleton instance
export const bankAdapterRegistry = new BankAdapterRegistry(
  new BankingService()
);