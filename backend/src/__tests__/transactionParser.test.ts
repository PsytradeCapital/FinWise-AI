import { TransactionParser } from '../services/transactionParser';
import { Transaction } from '@finwise-ai/shared';

// Mock the logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('TransactionParser', () => {
  let parser: TransactionParser;

  beforeEach(() => {
    parser = new TransactionParser();
  });

  describe('SMS Transaction Parsing', () => {
    it('should successfully parse valid M-Pesa SMS', async () => {
      const smsContent = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const userId = 'user123';

      const result = await parser.parseFromSMS(smsContent, userId);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.userId).toBe(userId);
      expect(result.transaction!.amount).toBe(1500);
      expect(result.transaction!.currency).toBe('KES');
      expect(result.transaction!.source).toBe('sms');
      expect(result.transaction!.rawData).toBe(smsContent);
      expect(result.transaction!.isVerified).toBe(false);
      expect(result.transaction!.category).toBe('Uncategorized');
    });

    it('should handle SMS parsing failure with fallback', async () => {
      const smsContent = 'This is not a transaction SMS';
      const userId = 'user123';

      const result = await parser.parseFromSMS(smsContent, userId);

      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
      expect(result.error).toBe('SMS format not recognized');
    });

    it('should handle validation errors', async () => {
      // Create a mock SMS that will parse but fail validation
      // We need to mock the SMS parser to return invalid data
      const smsContent = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const userId = ''; // Empty userId will cause validation error

      const result = await parser.parseFromSMS(smsContent, userId);

      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });

    it('should generate unique transaction IDs', async () => {
      const smsContent = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const userId = 'user123';

      const result1 = await parser.parseFromSMS(smsContent, userId);
      const result2 = await parser.parseFromSMS(smsContent, userId);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.transaction!.id).not.toBe(result2.transaction!.id);
    });
  });

  describe('API Transaction Parsing', () => {
    it('should parse bank API data correctly', async () => {
      const apiData = {
        amount: -150.50,
        currency: 'KES',
        description: 'POS SUPERMARKET NAIROBI 15/12',
        date: '2023-12-15T14:30:00Z',
        location: 'Nairobi',
      };
      const userId = 'user123';

      const result = await parser.parseFromAPI(apiData, userId, 'bank');

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(150.50); // Should be positive
      expect(result.transaction!.currency).toBe('KES');
      expect(result.transaction!.source).toBe('api');
      expect(result.transaction!.isVerified).toBe(true);
      expect(result.transaction!.location).toBe('Nairobi');
      expect(result.transaction!.merchant).toContain('SUPERMARKET');
    });

    it('should parse M-Pesa API data correctly', async () => {
      const apiData = {
        amount: 1000,
        transactionId: 'QH12ABC123',
        recipient: 'JOHN DOE',
        timestamp: '2023-12-15T14:30:00Z',
        status: 'completed',
      };
      const userId = 'user123';

      const result = await parser.parseFromAPI(apiData, userId, 'mpesa');

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(1000);
      expect(result.transaction!.currency).toBe('KES');
      expect(result.transaction!.source).toBe('api');
      expect(result.transaction!.isVerified).toBe(true);
      expect(result.transaction!.merchant).toBe('JOHN DOE');
      expect(result.transaction!.description).toContain('QH12ABC123');
    });

    it('should handle unsupported API source', async () => {
      const apiData = { amount: 100 };
      const userId = 'user123';

      const result = await parser.parseFromAPI(apiData, userId, 'unknown' as any);

      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
      expect(result.error).toContain('Unsupported API source');
    });

    it('should handle API parsing errors', async () => {
      const apiData = null;
      const userId = 'user123';

      const result = await parser.parseFromAPI(apiData, userId, 'bank');

      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
      expect(result.error).toBeDefined();
    });
  });

  describe('Manual Entry', () => {
    it('should create transaction from manual entry', async () => {
      const manualData = {
        amount: 500,
        description: 'Coffee at local cafe',
        category: 'Food & Dining',
        merchant: 'Local Cafe',
      };
      const userId = 'user123';

      const result = await parser.createFromManualEntry(manualData, userId);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.amount).toBe(500);
      expect(result.transaction!.description).toBe('Coffee at local cafe');
      expect(result.transaction!.category).toBe('Food & Dining');
      expect(result.transaction!.merchant).toBe('Local Cafe');
      expect(result.transaction!.source).toBe('manual');
      expect(result.transaction!.isVerified).toBe(false);
    });

    it('should use defaults for missing manual entry data', async () => {
      const manualData = {
        amount: 500,
        description: 'Test transaction',
      };
      const userId = 'user123';

      const result = await parser.createFromManualEntry(manualData, userId);

      expect(result.success).toBe(true);
      expect(result.transaction!.category).toBe('Uncategorized');
      expect(result.transaction!.currency).toBe('KES');
      expect(result.transaction!.timestamp).toBeInstanceOf(Date);
    });

    it('should validate manual entry data', async () => {
      const manualData = {
        amount: -100, // Invalid negative amount
        description: '',
      };
      const userId = 'user123';

      const result = await parser.createFromManualEntry(manualData, userId);

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Validation', () => {
    it('should validate valid transaction', () => {
      const transaction: Transaction = {
        id: 'tx_123',
        userId: 'user123',
        amount: 100.50,
        currency: 'KES',
        description: 'Test transaction',
        category: 'Food',
        timestamp: new Date(),
        source: 'manual',
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const transaction: Transaction = {
        id: '',
        userId: '',
        amount: 100.50,
        currency: 'KES',
        description: 'Test transaction',
        category: 'Food',
        timestamp: new Date(),
        source: 'manual',
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction ID is required');
      expect(result.errors).toContain('User ID is required');
    });

    it('should validate amount constraints', () => {
      const transaction: Transaction = {
        id: 'tx_123',
        userId: 'user123',
        amount: -100, // Invalid negative amount
        currency: 'KES',
        description: 'Test transaction',
        category: 'Food',
        timestamp: new Date(),
        source: 'manual',
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Amount must be at least'))).toBe(true);
    });

    it('should validate currency format', () => {
      const transaction: Transaction = {
        id: 'tx_123',
        userId: 'user123',
        amount: 100.50,
        currency: 'INVALID',
        description: 'Test transaction',
        category: 'Food',
        timestamp: new Date(),
        source: 'manual',
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(true); // Should still be valid
      expect(result.warnings.some(warning => warning.includes('Currency should be a 3-letter ISO code'))).toBe(true);
    });

    it('should validate description length', () => {
      const longDescription = 'A'.repeat(600); // Exceeds max length
      const transaction: Transaction = {
        id: 'tx_123',
        userId: 'user123',
        amount: 100.50,
        currency: 'KES',
        description: longDescription,
        category: 'Food',
        timestamp: new Date(),
        source: 'manual',
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Description cannot exceed'))).toBe(true);
    });

    it('should validate timestamp', () => {
      const transaction: Transaction = {
        id: 'tx_123',
        userId: 'user123',
        amount: 100.50,
        currency: 'KES',
        description: 'Test transaction',
        category: 'Food',
        timestamp: new Date('invalid'),
        source: 'manual',
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Timestamp must be a valid date'))).toBe(true);
    });

    it('should warn about future timestamps', () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      const transaction: Transaction = {
        id: 'tx_123',
        userId: 'user123',
        amount: 100.50,
        currency: 'KES',
        description: 'Test transaction',
        category: 'Food',
        timestamp: futureDate,
        source: 'manual',
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('timestamp is in the future'))).toBe(true);
    });

    it('should validate source field', () => {
      const transaction: Transaction = {
        id: 'tx_123',
        userId: 'user123',
        amount: 100.50,
        currency: 'KES',
        description: 'Test transaction',
        category: 'Food',
        timestamp: new Date(),
        source: 'invalid' as any,
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Source must be one of'))).toBe(true);
    });

    it('should handle missing category with warning', () => {
      const transaction: Transaction = {
        id: 'tx_123',
        userId: 'user123',
        amount: 100.50,
        currency: 'KES',
        description: 'Test transaction',
        category: '',
        timestamp: new Date(),
        source: 'manual',
        rawData: '{}',
        isVerified: false,
      };

      const result = parser.validateTransaction(transaction);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('Category is not set'))).toBe(true);
      expect(transaction.category).toBe('Uncategorized');
    });
  });

  describe('Utility Methods', () => {
    it('should identify transaction SMS', () => {
      const transactionSMS = 'QH12ABC123 Confirmed. You have sent Ksh1,500.00 to JOHN DOE on 15/12/23 at 2:30 PM';
      const nonTransactionSMS = 'Hello, this is a regular message';

      expect(parser.isTransactionSMS(transactionSMS)).toBe(true);
      expect(parser.isTransactionSMS(nonTransactionSMS)).toBe(false);
    });

    it('should return supported providers', () => {
      const providers = parser.getSupportedProviders();

      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers).toContain('M-Pesa');
    });

    it('should perform health check', async () => {
      const healthCheck = await parser.healthCheck();

      expect(healthCheck).toHaveProperty('smsParser');
      expect(healthCheck).toHaveProperty('transactionFetcher');
      expect(healthCheck).toHaveProperty('errors');
      expect(Array.isArray(healthCheck.errors)).toBe(true);
    });
  });

  describe('Merchant Extraction', () => {
    it('should extract merchant from bank transaction descriptions', async () => {
      const apiData = {
        amount: 150.50,
        description: 'POS JAVA HOUSE WESTLANDS 15/12',
        date: '2023-12-15T14:30:00Z',
      };
      const userId = 'user123';

      const result = await parser.parseFromAPI(apiData, userId, 'bank');

      expect(result.success).toBe(true);
      expect(result.transaction!.merchant).toBe('JAVA HOUSE WESTLANDS');
    });

    it('should extract merchant from ATM descriptions', async () => {
      const apiData = {
        amount: 1000,
        description: 'ATM KCB BANK NAIROBI 15/12',
        date: '2023-12-15T14:30:00Z',
      };
      const userId = 'user123';

      const result = await parser.parseFromAPI(apiData, userId, 'bank');

      expect(result.success).toBe(true);
      expect(result.transaction!.merchant).toBe('KCB BANK NAIROBI');
    });

    it('should handle descriptions without clear merchant patterns', async () => {
      const apiData = {
        amount: 500,
        description: 'MISCELLANEOUS TRANSACTION',
        date: '2023-12-15T14:30:00Z',
      };
      const userId = 'user123';

      const result = await parser.parseFromAPI(apiData, userId, 'bank');

      expect(result.success).toBe(true);
      expect(result.transaction!.merchant).toBe('MISCELLANEOUS TRANSACTION');
    });
  });

  describe('Error Handling', () => {
    it('should handle exceptions during SMS parsing', async () => {
      // Test with malformed input that might cause exceptions
      const smsContent = null as any;
      const userId = 'user123';

      const result = await parser.parseFromSMS(smsContent, userId);

      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should handle exceptions during API parsing', async () => {
      const apiData = { amount: 'invalid' };
      const userId = 'user123';

      const result = await parser.parseFromAPI(apiData, userId, 'bank');

      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should handle exceptions during manual entry', async () => {
      const manualData = null as any;
      const userId = 'user123';

      const result = await parser.createFromManualEntry(manualData, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});