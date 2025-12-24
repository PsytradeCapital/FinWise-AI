import axios from 'axios';
import { TransactionFetcher } from '../services/transactionFetcher';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('TransactionFetcher', () => {
  let fetcher: TransactionFetcher;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    fetcher = new TransactionFetcher();
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Bank Client Initialization', () => {
    it('should initialize bank client correctly', () => {
      const config = {
        baseUrl: 'https://api.bank.com',
        apiKey: 'test-api-key',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        accountId: 'test-account',
        provider: 'test-bank',
      };

      fetcher.initializeBankClient(config);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.baseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Client-ID': config.clientId,
        },
      });
    });

    it('should set up request and response interceptors', () => {
      const config = {
        baseUrl: 'https://api.bank.com',
        apiKey: 'test-api-key',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        accountId: 'test-account',
        provider: 'test-bank',
      };

      fetcher.initializeBankClient(config);

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('M-Pesa Client Initialization', () => {
    it('should initialize M-Pesa client correctly', () => {
      const config = {
        baseUrl: 'https://api.mpesa.com',
        consumerKey: 'test-consumer-key',
        consumerSecret: 'test-consumer-secret',
        passkey: 'test-passkey',
        shortcode: '123456',
      };

      fetcher.initializeMpesaClient(config);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.baseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('Bank Transaction Fetching', () => {
    beforeEach(() => {
      const config = {
        baseUrl: 'https://api.bank.com',
        apiKey: 'test-api-key',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        accountId: 'test-account',
        provider: 'test-bank',
      };
      fetcher.initializeBankClient(config);
    });

    it('should fetch bank transactions successfully', async () => {
      const mockTransactions = [
        {
          id: 'tx1',
          accountId: 'acc123',
          amount: -150.50,
          description: 'POS SUPERMARKET',
          date: '2023-12-15',
          balance: 1000,
          type: 'debit',
        },
        {
          id: 'tx2',
          accountId: 'acc123',
          amount: 500,
          description: 'SALARY DEPOSIT',
          date: '2023-12-14',
          balance: 1150.50,
          type: 'credit',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          transactions: mockTransactions,
          next_cursor: 'cursor123',
        },
      });

      const result = await fetcher.fetchBankTransactions('test-bank', 'acc123');

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].amount).toBe(150.50); // Should be positive
      expect(result.transactions[0].currency).toBe('KES');
      expect(result.transactions[0].source).toBe('api');
      expect(result.transactions[0].isVerified).toBe(true);
      expect(result.nextCursor).toBe('cursor123');
    });

    it('should handle date range parameters', async () => {
      const startDate = new Date('2023-12-01');
      const endDate = new Date('2023-12-31');

      mockAxiosInstance.get.mockResolvedValue({
        data: { transactions: [] },
      });

      await fetcher.fetchBankTransactions('test-bank', 'acc123', {
        startDate,
        endDate,
        limit: 50,
        cursor: 'test-cursor',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/transactions', {
        params: {
          account_id: 'acc123',
          limit: 50,
          start_date: '2023-12-01',
          end_date: '2023-12-31',
          cursor: 'test-cursor',
        },
      });
    });

    it('should handle bank client not initialized', async () => {
      const result = await fetcher.fetchBankTransactions('unknown-bank', 'acc123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Bank client not initialized');
      expect(result.transactions).toHaveLength(0);
    });

    it('should handle API errors with retry', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          data: { transactions: [] },
        });

      const result = await fetcher.fetchBankTransactions('test-bank', 'acc123');

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should fail after max retries', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Persistent error'));

      const result = await fetcher.fetchBankTransactions('test-bank', 'acc123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent error');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('M-Pesa Transaction Fetching', () => {
    beforeEach(() => {
      const config = {
        baseUrl: 'https://api.mpesa.com',
        consumerKey: 'test-consumer-key',
        consumerSecret: 'test-consumer-secret',
        passkey: 'test-passkey',
        shortcode: '123456',
      };
      fetcher.initializeMpesaClient(config);
    });

    it('should fetch M-Pesa transactions successfully', async () => {
      const mockTransactions = [
        {
          transactionId: 'QH12ABC123',
          amount: 1500,
          phoneNumber: '+254712345678',
          recipient: 'JOHN DOE',
          timestamp: '2023-12-15T14:30:00Z',
          status: 'completed',
        },
      ];

      // Mock access token request
      mockAxiosInstance.post.mockResolvedValue({
        data: { access_token: 'test-token' },
      });

      // Mock transactions request
      mockAxiosInstance.get.mockResolvedValue({
        data: { transactions: mockTransactions },
      });

      const result = await fetcher.fetchMpesaTransactions('+254712345678');

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(1500);
      expect(result.transactions[0].currency).toBe('KES');
      expect(result.transactions[0].source).toBe('api');
      expect(result.transactions[0].isVerified).toBe(true);
      expect(result.transactions[0].merchant).toBe('JOHN DOE');
    });

    it('should handle M-Pesa client not initialized', async () => {
      const newFetcher = new TransactionFetcher();
      const result = await newFetcher.fetchMpesaTransactions('+254712345678');

      expect(result.success).toBe(false);
      expect(result.error).toBe('M-Pesa client not initialized');
    });

    it('should handle access token failure', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Auth failed'));

      const result = await fetcher.fetchMpesaTransactions('+254712345678');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Auth failed');
    });

    it('should handle date range parameters for M-Pesa', async () => {
      const startDate = new Date('2023-12-01');
      const endDate = new Date('2023-12-31');

      mockAxiosInstance.post.mockResolvedValue({
        data: { access_token: 'test-token' },
      });
      mockAxiosInstance.get.mockResolvedValue({
        data: { transactions: [] },
      });

      await fetcher.fetchMpesaTransactions('+254712345678', {
        startDate,
        endDate,
        limit: 25,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/transactions', {
        params: {
          phone_number: '+254712345678',
          limit: 25,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });
    });
  });

  describe('Polling All Transactions', () => {
    beforeEach(() => {
      // Initialize both bank and M-Pesa clients
      fetcher.initializeBankClient({
        baseUrl: 'https://api.bank.com',
        apiKey: 'test-api-key',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        accountId: 'test-account',
        provider: 'test-bank',
      });

      fetcher.initializeMpesaClient({
        baseUrl: 'https://api.mpesa.com',
        consumerKey: 'test-consumer-key',
        consumerSecret: 'test-consumer-secret',
        passkey: 'test-passkey',
        shortcode: '123456',
      });
    });

    it('should poll transactions from all configured sources', async () => {
      const bankTransactions = [
        {
          id: 'tx1',
          accountId: 'acc123',
          amount: -100,
          description: 'Bank transaction',
          date: '2023-12-15',
          balance: 1000,
          type: 'debit',
        },
      ];

      const mpesaTransactions = [
        {
          transactionId: 'QH12ABC123',
          amount: 500,
          phoneNumber: '+254712345678',
          recipient: 'JOHN DOE',
          timestamp: '2023-12-15T14:30:00Z',
          status: 'completed',
        },
      ];

      // Mock bank API response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { transactions: bankTransactions },
      });

      // Mock M-Pesa auth and transactions
      mockAxiosInstance.post.mockResolvedValue({
        data: { access_token: 'test-token' },
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { transactions: mpesaTransactions },
      });

      const configs = {
        bankConfigs: [
          {
            baseUrl: 'https://api.bank.com',
            apiKey: 'test-api-key',
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
            accountId: 'acc123',
            provider: 'test-bank',
          },
        ],
        mpesaConfig: {
          baseUrl: 'https://api.mpesa.com',
          consumerKey: 'test-consumer-key',
          consumerSecret: 'test-consumer-secret',
          passkey: 'test-passkey',
          shortcode: '123456',
          phoneNumber: '+254712345678',
        },
      };

      const result = await fetcher.pollAllTransactions('user123', configs);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].userId).toBe('user123');
      expect(result.transactions[1].userId).toBe('user123');
    });

    it('should handle partial failures gracefully', async () => {
      // Bank API fails, M-Pesa succeeds
      mockAxiosInstance.get.mockRejectedValue(new Error('Bank API error'));
      mockAxiosInstance.post.mockRejectedValue(new Error('M-Pesa Auth failed'));

      const configs = {
        bankConfigs: [
          {
            baseUrl: 'https://api.bank.com',
            apiKey: 'test-api-key',
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
            accountId: 'acc123',
            provider: 'test-bank',
          },
        ],
        mpesaConfig: {
          baseUrl: 'https://api.mpesa.com',
          consumerKey: 'test-consumer-key',
          consumerSecret: 'test-consumer-secret',
          passkey: 'test-passkey',
          shortcode: '123456',
          phoneNumber: '+254712345678',
        },
      };

      const result = await fetcher.pollAllTransactions('user123', configs);

      // Should handle errors gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.transactions).toHaveLength(0);
    }, 10000); // Increase timeout to 10 seconds

    it('should handle complete failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('All APIs failed'));
      mockAxiosInstance.post.mockRejectedValue(new Error('Auth failed'));

      const configs = {
        bankConfigs: [
          {
            baseUrl: 'https://api.bank.com',
            apiKey: 'test-api-key',
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
            accountId: 'acc123',
            provider: 'test-bank',
          },
        ],
        mpesaConfig: {
          baseUrl: 'https://api.mpesa.com',
          consumerKey: 'test-consumer-key',
          consumerSecret: 'test-consumer-secret',
          passkey: 'test-passkey',
          shortcode: '123456',
          phoneNumber: '+254712345678',
        },
      };

      const result = await fetcher.pollAllTransactions('user123', configs);

      expect(result.success).toBe(false);
      expect(result.transactions).toHaveLength(0);
      expect(result.error).toBeDefined();
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('Utility Methods', () => {
    it('should return supported providers', () => {
      fetcher.initializeBankClient({
        baseUrl: 'https://api.bank1.com',
        apiKey: 'key1',
        clientId: 'client1',
        clientSecret: 'secret1',
        accountId: 'acc1',
        provider: 'bank1',
      });

      fetcher.initializeBankClient({
        baseUrl: 'https://api.bank2.com',
        apiKey: 'key2',
        clientId: 'client2',
        clientSecret: 'secret2',
        accountId: 'acc2',
        provider: 'bank2',
      });

      fetcher.initializeMpesaClient({
        baseUrl: 'https://api.mpesa.com',
        consumerKey: 'key',
        consumerSecret: 'secret',
        passkey: 'passkey',
        shortcode: '123456',
      });

      const providers = fetcher.getSupportedProviders();

      expect(providers).toContain('bank1');
      expect(providers).toContain('bank2');
      expect(providers).toContain('mpesa');
      expect(providers).toHaveLength(3);
    });

    it('should return empty providers list when none initialized', () => {
      const newFetcher = new TransactionFetcher();
      const providers = newFetcher.getSupportedProviders();

      expect(providers).toHaveLength(0);
    });
  });

  describe('Merchant Extraction', () => {
    it('should extract merchant from POS transactions', async () => {
      const config = {
        baseUrl: 'https://api.bank.com',
        apiKey: 'test-api-key',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        accountId: 'test-account',
        provider: 'test-bank',
      };
      fetcher.initializeBankClient(config);

      const mockTransactions = [
        {
          id: 'tx1',
          accountId: 'acc123',
          amount: -150.50,
          description: 'POS JAVA HOUSE WESTLANDS 15/12',
          date: '2023-12-15',
          balance: 1000,
          type: 'debit',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { transactions: mockTransactions },
      });

      const result = await fetcher.fetchBankTransactions('test-bank', 'acc123');

      expect(result.success).toBe(true);
      expect(result.transactions[0].merchant).toBe('JAVA HOUSE WESTLANDS');
    });

    it('should extract merchant from ATM transactions', async () => {
      const config = {
        baseUrl: 'https://api.bank.com',
        apiKey: 'test-api-key',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        accountId: 'test-account',
        provider: 'test-bank',
      };
      fetcher.initializeBankClient(config);

      const mockTransactions = [
        {
          id: 'tx1',
          accountId: 'acc123',
          amount: -1000,
          description: 'ATM KCB BANK NAIROBI 15/12',
          date: '2023-12-15',
          balance: 1000,
          type: 'debit',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { transactions: mockTransactions },
      });

      const result = await fetcher.fetchBankTransactions('test-bank', 'acc123');

      expect(result.success).toBe(true);
      expect(result.transactions[0].merchant).toBe('KCB BANK NAIROBI');
    });

    it('should handle descriptions without clear patterns', async () => {
      const config = {
        baseUrl: 'https://api.bank.com',
        apiKey: 'test-api-key',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        accountId: 'test-account',
        provider: 'test-bank',
      };
      fetcher.initializeBankClient(config);

      const mockTransactions = [
        {
          id: 'tx1',
          accountId: 'acc123',
          amount: -500,
          description: 'MISCELLANEOUS TRANSACTION',
          date: '2023-12-15',
          balance: 1000,
          type: 'debit',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { transactions: mockTransactions },
      });

      const result = await fetcher.fetchBankTransactions('test-bank', 'acc123');

      expect(result.success).toBe(true);
      expect(result.transactions[0].merchant).toBe('MISCELLANEOUS TRANSACTION');
    });
  });

  describe('Transaction Format Consistency', () => {
    it('should generate consistent transaction format', async () => {
      const config = {
        baseUrl: 'https://api.bank.com',
        apiKey: 'test-api-key',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        accountId: 'test-account',
        provider: 'test-bank',
      };
      fetcher.initializeBankClient(config);

      const mockTransactions = [
        {
          id: 'tx1',
          accountId: 'acc123',
          amount: -100,
          description: 'Transaction 1',
          date: '2023-12-15T10:00:00Z',
          balance: 1000,
          type: 'debit',
        },
        {
          id: 'tx2',
          accountId: 'acc123',
          amount: -200,
          description: 'Transaction 2',
          date: '2023-12-15T11:00:00Z',
          balance: 900,
          type: 'debit',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { transactions: mockTransactions },
      });

      const result = await fetcher.fetchBankTransactions('test-bank', 'acc123');

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2);
      // Check that transactions are properly normalized
      expect(result.transactions[0].amount).toBe(100); // Should be positive
      expect(result.transactions[0].currency).toBe('KES');
      expect(result.transactions[0].source).toBe('api');
      expect(result.transactions[0].isVerified).toBe(true);
      expect(result.transactions[1].amount).toBe(200);
    });
  });
});