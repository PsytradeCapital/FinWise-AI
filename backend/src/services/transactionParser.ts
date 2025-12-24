import { Transaction } from '@finwise-ai/shared';
import { logger } from '../utils/logger';
import { smsParser, SMSParseResult } from './smsParser';
import { transactionFetcher, FetchResult } from './transactionFetcher';

export interface ParseResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
  fallbackRequired?: boolean;
  validationErrors?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ManualEntryData {
  amount: number;
  description: string;
  category?: string;
  timestamp?: Date;
  merchant?: string;
}

/**
 * Transaction Parser Service
 * Main service that orchestrates SMS parsing, API fetching, error handling, and fallbacks
 */
export class TransactionParser {
  private readonly MIN_AMOUNT = 0.01;
  private readonly MAX_AMOUNT = 10000000; // 10M KES
  private readonly MAX_DESCRIPTION_LENGTH = 500;

  /**
   * Parse transaction from SMS with comprehensive error handling
   */
  public async parseFromSMS(
    smsContent: string,
    userId: string,
    phoneNumber?: string
  ): Promise<ParseResult> {
    try {
      logger.info('Starting SMS transaction parsing', {
        userId,
        smsLength: smsContent.length,
        phoneNumber: phoneNumber ? this.maskPhoneNumber(phoneNumber) : 'unknown'
      });

      // Parse SMS using SMS parser
      const parseResult: SMSParseResult = smsParser.parseSMS(smsContent, phoneNumber);

      if (!parseResult.success) {
        logger.warn('SMS parsing failed', {
          userId,
          error: parseResult.error,
          fallbackRequired: true
        });

        return {
          success: false,
          error: parseResult.error || 'SMS parsing failed',
          fallbackRequired: true,
        };
      }

      if (!parseResult.transaction) {
        return {
          success: false,
          error: 'No transaction data extracted',
          fallbackRequired: true,
        };
      }

      // Create complete transaction object
      const transaction: Transaction = {
        id: this.generateTransactionId(),
        userId,
        amount: parseResult.transaction.amount || 0,
        currency: parseResult.transaction.currency || 'KES',
        description: parseResult.transaction.description || 'SMS Transaction',
        category: 'Uncategorized',
        subcategory: undefined,
        timestamp: parseResult.transaction.timestamp || new Date(),
        source: 'sms',
        rawData: smsContent,
        isVerified: false,
        location: undefined,
        merchant: parseResult.transaction.merchant,
      };

      // Validate transaction data
      const validation = this.validateTransaction(transaction);
      if (!validation.isValid) {
        logger.error('Transaction validation failed', {
          userId,
          transactionId: transaction.id,
          errors: validation.errors,
          fallbackRequired: true
        });

        return {
          success: false,
          error: 'Transaction validation failed',
          validationErrors: validation.errors,
          fallbackRequired: true,
        };
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        logger.warn('Transaction validation warnings', {
          userId,
          transactionId: transaction.id,
          warnings: validation.warnings
        });
      }

      logger.info('SMS transaction parsed successfully', {
        userId,
        transactionId: transaction.id,
        amount: transaction.amount,
        provider: parseResult.provider
      });

      return {
        success: true,
        transaction,
      };

    } catch (error) {
      logger.error('SMS parsing error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        fallbackRequired: true
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        fallbackRequired: true,
      };
    }
  }

  /**
   * Parse transaction from API data with error handling
   */
  public async parseFromAPI(
    apiData: any,
    userId: string,
    source: 'bank' | 'mpesa'
  ): Promise<ParseResult> {
    try {
      logger.info('Starting API transaction parsing', {
        userId,
        source,
        dataKeys: Object.keys(apiData || {})
      });

      let transaction: Transaction;

      if (source === 'bank') {
        transaction = this.parseBankAPIData(apiData, userId);
      } else if (source === 'mpesa') {
        transaction = this.parseMpesaAPIData(apiData, userId);
      } else {
        throw new Error(`Unsupported API source: ${source}`);
      }

      // Validate transaction data
      const validation = this.validateTransaction(transaction);
      if (!validation.isValid) {
        logger.error('API transaction validation failed', {
          userId,
          source,
          errors: validation.errors,
          fallbackRequired: true
        });

        return {
          success: false,
          error: 'API transaction validation failed',
          validationErrors: validation.errors,
          fallbackRequired: true,
        };
      }

      logger.info('API transaction parsed successfully', {
        userId,
        source,
        transactionId: transaction.id,
        amount: transaction.amount
      });

      return {
        success: true,
        transaction,
      };

    } catch (error) {
      logger.error('API parsing error', {
        userId,
        source,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackRequired: true
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown API parsing error',
        fallbackRequired: true,
      };
    }
  }

  /**
   * Create transaction from manual entry (fallback mechanism)
   */
  public async createFromManualEntry(
    manualData: ManualEntryData,
    userId: string
  ): Promise<ParseResult> {
    try {
      logger.info('Creating transaction from manual entry', {
        userId,
        amount: manualData.amount,
        description: manualData.description?.substring(0, 50)
      });

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        userId,
        amount: manualData.amount,
        currency: 'KES', // Default currency
        description: manualData.description,
        category: manualData.category || 'Uncategorized',
        subcategory: undefined,
        timestamp: manualData.timestamp || new Date(),
        source: 'manual',
        rawData: JSON.stringify(manualData),
        isVerified: false, // Manual entries need verification
        location: undefined,
        merchant: manualData.merchant,
      };

      // Validate transaction data
      const validation = this.validateTransaction(transaction);
      if (!validation.isValid) {
        logger.error('Manual transaction validation failed', {
          userId,
          errors: validation.errors
        });

        return {
          success: false,
          error: 'Manual transaction validation failed',
          validationErrors: validation.errors,
        };
      }

      logger.info('Manual transaction created successfully', {
        userId,
        transactionId: transaction.id,
        amount: transaction.amount
      });

      return {
        success: true,
        transaction,
      };

    } catch (error) {
      logger.error('Manual entry error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown manual entry error',
      };
    }
  }

  /**
   * Validate transaction data integrity
   */
  public validateTransaction(transaction: Transaction): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!transaction.id || transaction.id.trim().length === 0) {
      errors.push('Transaction ID is required');
    }

    if (!transaction.userId || transaction.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    // Validate amount
    if (typeof transaction.amount !== 'number' || isNaN(transaction.amount)) {
      errors.push('Amount must be a valid number');
    } else if (transaction.amount < this.MIN_AMOUNT) {
      errors.push(`Amount must be at least ${this.MIN_AMOUNT}`);
    } else if (transaction.amount > this.MAX_AMOUNT) {
      errors.push(`Amount cannot exceed ${this.MAX_AMOUNT}`);
    }

    // Validate currency
    if (!transaction.currency || transaction.currency.trim().length === 0) {
      errors.push('Currency is required');
    } else if (!/^[A-Z]{3}$/.test(transaction.currency)) {
      warnings.push('Currency should be a 3-letter ISO code');
    }

    // Validate description
    if (!transaction.description || transaction.description.trim().length === 0) {
      errors.push('Description is required');
    } else if (transaction.description.length > this.MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description cannot exceed ${this.MAX_DESCRIPTION_LENGTH} characters`);
    }

    // Validate timestamp
    if (!transaction.timestamp) {
      errors.push('Timestamp is required');
    } else if (isNaN(transaction.timestamp.getTime())) {
      errors.push('Timestamp must be a valid date');
    } else {
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      if (transaction.timestamp < oneYearAgo) {
        warnings.push('Transaction timestamp is more than a year old');
      } else if (transaction.timestamp > oneHourFromNow) {
        warnings.push('Transaction timestamp is in the future');
      }
    }

    // Validate source
    const validSources = ['sms', 'api', 'manual'];
    if (!validSources.includes(transaction.source)) {
      errors.push(`Source must be one of: ${validSources.join(', ')}`);
    }

    // Validate category
    if (!transaction.category || transaction.category.trim().length === 0) {
      warnings.push('Category is not set, defaulting to Uncategorized');
      transaction.category = 'Uncategorized';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Parse bank API data to transaction format
   */
  private parseBankAPIData(apiData: any, userId: string): Transaction {
    return {
      id: this.generateTransactionId(),
      userId,
      amount: Math.abs(parseFloat(apiData.amount) || 0),
      currency: apiData.currency || 'KES',
      description: apiData.description || apiData.narrative || 'Bank Transaction',
      category: 'Uncategorized',
      subcategory: undefined,
      timestamp: new Date(apiData.date || apiData.timestamp || Date.now()),
      source: 'api',
      rawData: JSON.stringify(apiData),
      isVerified: true,
      location: apiData.location,
      merchant: this.extractMerchantFromDescription(apiData.description || ''),
    };
  }

  /**
   * Parse M-Pesa API data to transaction format
   */
  private parseMpesaAPIData(apiData: any, userId: string): Transaction {
    return {
      id: this.generateTransactionId(),
      userId,
      amount: parseFloat(apiData.amount) || 0,
      currency: 'KES',
      description: `M-Pesa ${apiData.transactionId} - ${apiData.recipient || 'Unknown'}`,
      category: 'Uncategorized',
      subcategory: undefined,
      timestamp: new Date(apiData.timestamp || Date.now()),
      source: 'api',
      rawData: JSON.stringify(apiData),
      isVerified: apiData.status === 'completed',
      location: undefined,
      merchant: apiData.recipient,
    };
  }

  /**
   * Extract merchant name from description
   */
  private extractMerchantFromDescription(description: string): string {
    if (!description) return '';

    // Common patterns for merchant extraction
    const patterns = [
      /POS\s+(.+?)(?:\s+\d|$)/i,
      /ATM\s+(.+?)(?:\s+\d|$)/i,
      /ONLINE\s+(.+?)(?:\s+\d|$)/i,
      /^(.+?)\s+\d{2}\/\d{2}/,
      /^(.+?)\s+-\s+/,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: take first few words
    return description.split(' ').slice(0, 3).join(' ').trim();
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `tx_${timestamp}_${random}`;
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return phoneNumber;
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
  }

  /**
   * Check if SMS content is likely a transaction
   */
  public isTransactionSMS(smsContent: string): boolean {
    return smsParser.isTransactionSMS(smsContent);
  }

  /**
   * Get supported SMS providers
   */
  public getSupportedProviders(): string[] {
    return smsParser.getSupportedProviders();
  }

  /**
   * Health check for external services
   */
  public async healthCheck(): Promise<{
    smsParser: boolean;
    transactionFetcher: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let smsParserHealthy = true;
    let fetcherHealthy = true;

    try {
      // Test SMS parser with a sample SMS
      const testSMS = 'Test SMS for health check';
      smsParser.isTransactionSMS(testSMS);
    } catch (error) {
      smsParserHealthy = false;
      errors.push(`SMS Parser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test transaction fetcher (basic initialization check)
      transactionFetcher.getSupportedProviders?.() || [];
    } catch (error) {
      fetcherHealthy = false;
      errors.push(`Transaction Fetcher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      smsParser: smsParserHealthy,
      transactionFetcher: fetcherHealthy,
      errors,
    };
  }
}

// Export singleton instance
export const transactionParser = new TransactionParser();