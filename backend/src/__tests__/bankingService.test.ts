import { BankingService, BankConfig } from '../services/bankingService';
import { bankAdapterRegistry } from '../services/bankAdapters';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BankingService', () => {
  let bankingService: BankingService;
  let mockBankConfig: BankConfig;

  beforeEach(() => {
    bankingService = new BankingService();
    mockBankConfig = {
      provider: 'test_bank',
      baseUrl: 'https://api.testbank.com',
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      apiKey: 'test_api_key',
      environment: 'sandbox',
      supportedFeatures: [
        { name: 'accounts', version: '1.0', endpoint: '/accounts' },
        { name: 'transactions', version: '1.0', endpoint: '/accounts/{accountId}/transactions' },
        { name: 'balance', version: '1.0', endpoint: '/accounts/{accountId}/balances' },
      ],
    };

    jest.clearAllMocks();
  });

  describe('initializeBankClient', () => {
    it('should initialize bank client successfully', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test_access_token',
          refresh_token: 'test_refresh_token',
          expires_in: 3600,
          scope: 'accounts transactions',
        },
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockTokenResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {
          baseURL: mockBankConfig.baseUrl,
          headers: {},
        },
      } as any);

      await bankingService.initializeBankClient(mockBankConfig);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockBankConfig.baseUrl,
        timeout: 30000,
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-FAPI-Financial-ID': mockBankConfig.clientId,
        }),
      });
    });

    it('should handle authentication errors', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Authentication failed')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {
          baseURL: mockBankConfig.baseUrl,
          headers: {},
        },
      } as any);

      await expect(bankingService.initializeBankClient(mockBankConfig))
        .rejects.toThrow('Failed to initialize test_bank client');
    });
  });

  describe('getAccounts', () => {
    beforeEach(async () => {
      const mockClient = {
        get: jest.fn(),
        post: jest.fn().mockResolvedValue({
          data: {
            access_token: 'test_token',
            expires_in: 3600,
          },
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {
          baseURL: mockBankConfig.baseUrl,
          headers: {},
        },
      };

      mockedAxios.create.mockReturnValue(mockClient as any);
      await bankingService.initializeBankClient(mockBankConfig);
    });

    it('should fetch bank accounts successfully', async () => {
      const mockAccountsResponse = {
        data: {
          accounts: [
            {
              accountId: 'acc_123',
              accountNumber: '1234567890',
              accountName: 'Test Savings Account',
              accountType: 'savings',
              currency: 'KES',
              balance: { amount: '10000' },
              availableBalance: { amount: '9500' },
            },
          ],
        },
      };

      const mockClient = mockedAxios.create() as any;
      mockClient.get.mockResolvedValue(mockAccountsResponse);

      const accounts = await bankingService.getAccounts('test_bank', 'user123');

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual({
        id: 'acc_123',
        accountNumber: '1234567890',
        accountName: 'Test Savings Account',
        accountType: 'savings',
        currency: 'KES',
        balance: 10000,
        availableBalance: 9500,
        provider: 'test_bank',
      });
    });

    it('should handle API errors', async () => {
      const mockClient = mockedAxios.create() as any;
      mockClient.get.mockRejectedValue(new Error('API Error'));

      await expect(bankingService.getAccounts('test_bank', 'user123'))
        .rejects.toThrow('Failed to fetch accounts from test_bank');
    });

    it('should throw error for uninitialized client', async () => {
      await expect(bankingService.getAccounts('unknown_bank', 'user123'))
        .rejects.toThrow('Bank client not initialized for provider: unknown_bank');
    });
  });

  describe('getTransactions', () => {
    beforeEach(async () => {
      const mockClient = {
        get: jest.fn(),
        post: jest.fn().mockResolvedValue({
          data: {
            access_token: 'test_token',
            expires_in: 3600,
          },
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {
          baseURL: mockBankConfig.baseUrl,
          headers: {},
        },
      };

      mockedAxios.create.mockReturnValue(mockClient as any);
      await bankingService.initializeBankClient(mockBankConfig);
    });

    it('should fetch bank transactions successfully', async () => {
      const mockTransactionsResponse = {
        data: {
          transactions: [
            {
              transactionId: 'tx_123',
              amount: { amount: '500' },
              transactionInformation: 'ATM WITHDRAWAL',
              bookingDateTime: '2023-12-01T10:00:00Z',
              creditDebitIndicator: 'Debit',
              balance: { amount: '9500' },
            },
          ],
        },
      };

      const mockClient = mockedAxios.create() as any;
      mockClient.get.mockResolvedValue(mockTransactionsResponse);

      const transactions = await bankingService.getTransactions('test_bank', 'acc_123');

      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toEqual({
        id: 'tx_123',
        accountId: 'acc_123',
        amount: 500,
        description: 'ATM WITHDRAWAL',
        date: '2023-12-01T10:00:00Z',
        balance: 9500,
        type: 'debit',
      });
    });

    it('should handle date filters', async () => {
      const mockClient = mockedAxios.create() as any;
      mockClient.get.mockResolvedValue({ data: { transactions: [] } });

      const startDate = new Date('2023-12-01');
      const endDate = new Date('2023-12-31');

      await bankingService.getTransactions('test_bank', 'acc_123', {
        startDate,
        endDate,
        limit: 50,
        offset: 10,
      });

      expect(mockClient.get).toHaveBeenCalledWith('/accounts/acc_123/transactions', {
        params: {
          limit: 50,
          offset: 10,
          fromBookingDateTime: startDate.toISOString(),
          toBookingDateTime: endDate.toISOString(),
        },
        headers: expect.objectContaining({
          'X-Customer-User-Agent': 'FinWise-AI/1.0',
        }),
      });
    });
  });

  describe('getBalance', () => {
    beforeEach(async () => {
      const mockClient = {
        get: jest.fn(),
        post: jest.fn().mockResolvedValue({
          data: {
            access_token: 'test_token',
            expires_in: 3600,
          },
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {
          baseURL: mockBankConfig.baseUrl,
          headers: {},
        },
      };

      mockedAxios.create.mockReturnValue(mockClient as any);
      await bankingService.initializeBankClient(mockBankConfig);
    });

    it('should fetch account balance successfully', async () => {
      const mockBalanceResponse = {
        data: {
          balances: [
            {
              amount: { amount: '10000', currency: 'KES' },
              creditDebitIndicator: 'Credit',
            },
          ],
        },
      };

      const mockClient = mockedAxios.create() as any;
      mockClient.get.mockResolvedValue(mockBalanceResponse);

      const balance = await bankingService.getBalance('test_bank', 'acc_123');

      expect(balance).toEqual({
        balance: 10000,
        availableBalance: 10000,
        currency: 'KES',
      });
    });
  });

  describe('validateSecurityCompliance', () => {
    it('should validate HTTPS requirement', async () => {
      const httpConfig = { ...mockBankConfig, baseUrl: 'http://api.testbank.com' };
      
      const mockClient = {
        post: jest.fn().mockResolvedValue({
          data: { access_token: 'test_token', expires_in: 3600 },
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {
          baseURL: httpConfig.baseUrl,
          headers: { 'X-FAPI-Financial-ID': httpConfig.clientId },
        },
      };

      mockedAxios.create.mockReturnValue(mockClient as any);
      await bankingService.initializeBankClient(httpConfig);

      const compliance = await bankingService.validateSecurityCompliance('test_bank');

      expect(compliance.isCompliant).toBe(false);
      expect(compliance.issues).toContain('API endpoint must use HTTPS');
    });

    it('should pass compliance for properly configured client', async () => {
      const mockClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            access_token: 'test_token',
            expires_in: 3600,
            scope: 'accounts transactions',
          },
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {
          baseURL: mockBankConfig.baseUrl,
          headers: { 'X-FAPI-Financial-ID': mockBankConfig.clientId },
        },
      };

      mockedAxios.create.mockReturnValue(mockClient as any);
      await bankingService.initializeBankClient(mockBankConfig);

      const compliance = await bankingService.validateSecurityCompliance('test_bank');

      expect(compliance.isCompliant).toBe(true);
      expect(compliance.issues).toHaveLength(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all providers are working', async () => {
      const mockClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            access_token: 'test_token',
            expires_in: 3600,
          },
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {
          baseURL: mockBankConfig.baseUrl,
          headers: {},
        },
      };

      mockedAxios.create.mockReturnValue(mockClient as any);
      await bankingService.initializeBankClient(mockBankConfig);

      const health = await bankingService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.providers['test_bank']).toBe('healthy');
    });

    it('should return unhealthy status when no providers are working', async () => {
      const health = await bankingService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(Object.keys(health.providers)).toHaveLength(0);
    });
  });
});

describe('BankAdapterRegistry', () => {
  it('should register and retrieve adapters', () => {
    const adapters = bankAdapterRegistry.getAllAdapters();
    expect(adapters.length).toBeGreaterThan(0);

    const equityAdapter = bankAdapterRegistry.getAdapter('equity_bank');
    expect(equityAdapter).toBeDefined();
    expect(equityAdapter?.name).toBe('Equity Bank Kenya');
  });

  it('should validate account numbers using bank-specific rules', () => {
    // Test Equity Bank account validation
    expect(bankAdapterRegistry.validateAccountNumber('equity_bank', '0123456789012')).toBe(true);
    expect(bankAdapterRegistry.validateAccountNumber('equity_bank', '123456789')).toBe(false);

    // Test KCB account validation
    expect(bankAdapterRegistry.validateAccountNumber('kcb_bank', '123456789012')).toBe(true);
    expect(bankAdapterRegistry.validateAccountNumber('kcb_bank', '12345')).toBe(false);
  });

  it('should format account numbers using bank-specific rules', () => {
    const formatted = bankAdapterRegistry.formatAccountNumber('equity_bank', '0123456789012');
    expect(formatted).toBe('0123-4567-89012');

    const kcbFormatted = bankAdapterRegistry.formatAccountNumber('kcb_bank', '123456789012');
    expect(kcbFormatted).toBe('123-456-789012');
  });

  it('should parse transaction descriptions using bank-specific rules', () => {
    const parsed = bankAdapterRegistry.parseTransactionDescription(
      'equity_bank',
      'ATM WITHDRAWAL WESTLANDS BRANCH 123456'
    );
    expect(parsed.category).toBe('Cash Withdrawal');
    expect(parsed.merchant).toBe('WESTLANDS BRANCH');

    const kcbParsed = bankAdapterRegistry.parseTransactionDescription(
      'kcb_bank',
      'CARD PAYMENT SUPERMARKET XYZ 789'
    );
    expect(kcbParsed.category).toBe('Card Payment');
    expect(kcbParsed.merchant).toBe('SUPERMARKET XYZ');
  });

  it('should return supported banks list', () => {
    const supportedBanks = bankAdapterRegistry.getSupportedBanks();
    expect(supportedBanks.length).toBeGreaterThan(0);
    
    const equityBank = supportedBanks.find(bank => bank.provider === 'equity_bank');
    expect(equityBank).toBeDefined();
    expect(equityBank?.name).toBe('Equity Bank Kenya');
    expect(equityBank?.features).toContain('accounts');
    expect(equityBank?.features).toContain('transactions');
  });
});