import { NaboCapitalService, NaboCapitalConfig } from '../services/naboCapitalService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NaboCapitalService', () => {
  let naboCapitalService: NaboCapitalService;
  let mockConfig: NaboCapitalConfig;

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'https://api.nabocapital.com/v1',
      apiKey: 'test_api_key',
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      environment: 'sandbox',
    };

    naboCapitalService = new NaboCapitalService(mockConfig);
    jest.clearAllMocks();
  });

  describe('linkAccount', () => {
    it('should link account successfully', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: 3600,
        },
      };

      const mockLinkResponse = {
        data: {
          linking_id: 'link_123',
          status: 'pending',
          verification_method: 'sms',
          expires_at: '2023-12-31T23:59:59Z',
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce(mockTokenResponse) // Token request
        .mockResolvedValueOnce(mockLinkResponse); // Link account request

      mockedAxios.create.mockReturnValue({
        post: jest.fn()
          .mockResolvedValueOnce(mockLinkResponse),
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const request = {
        userId: 'user123',
        phoneNumber: '254712345678',
        idNumber: '12345678',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      const result = await naboCapitalService.linkAccount(request);

      expect(result).toEqual({
        linkingId: 'link_123',
        status: 'pending',
        accountId: undefined,
        verificationMethod: 'sms',
        expiresAt: new Date('2023-12-31T23:59:59Z'),
      });
    });

    it('should handle account linking errors', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('API Error')),
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const request = {
        userId: 'user123',
        phoneNumber: '254712345678',
        idNumber: '12345678',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      await expect(naboCapitalService.linkAccount(request))
        .rejects.toThrow('Failed to link account');
    });
  });

  describe('verifyAccountLinking', () => {
    it('should verify account linking successfully', async () => {
      const mockVerifyResponse = {
        data: {
          account_id: 'acc_123',
          status: 'verified',
        },
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockVerifyResponse),
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const result = await naboCapitalService.verifyAccountLinking('link_123', '123456');

      expect(result).toEqual({
        accountId: 'acc_123',
        status: 'verified',
      });
    });
  });

  describe('getAccounts', () => {
    it('should fetch user accounts successfully', async () => {
      const mockAccountsResponse = {
        data: {
          accounts: [
            {
              id: 'acc_123',
              account_number: '1234567890',
              account_name: 'Savings Account',
              balance: '10000.00',
              currency: 'KES',
              account_type: 'savings',
              is_active: true,
              created_at: '2023-01-01T00:00:00Z',
            },
          ],
        },
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockAccountsResponse),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const accounts = await naboCapitalService.getAccounts('user123');

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual({
        id: 'acc_123',
        accountNumber: '1234567890',
        accountName: 'Savings Account',
        balance: 10000,
        currency: 'KES',
        accountType: 'savings',
        isActive: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
      });
    });
  });

  describe('initiateTransfer', () => {
    it('should initiate transfer successfully', async () => {
      const mockTransferResponse = {
        data: {
          transfer_id: 'tx_123',
          status: 'pending',
          amount: 500,
          currency: 'KES',
          reference: 'AUTO_SAVE_001',
          created_at: '2023-12-01T10:00:00Z',
          estimated_completion_time: '2023-12-01T10:05:00Z',
        },
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockTransferResponse),
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const request = {
        amount: 500,
        currency: 'KES',
        targetAccount: 'acc_123',
        reference: 'AUTO_SAVE_001',
        description: 'Automated savings transfer',
      };

      const result = await naboCapitalService.initiateTransfer(request);

      expect(result).toEqual({
        transferId: 'tx_123',
        status: 'pending',
        amount: 500,
        currency: 'KES',
        reference: 'AUTO_SAVE_001',
        createdAt: new Date('2023-12-01T10:00:00Z'),
        estimatedCompletionTime: new Date('2023-12-01T10:05:00Z'),
        failureReason: undefined,
      });
    });

    it('should handle transfer initiation errors', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Insufficient funds')),
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const request = {
        amount: 500,
        currency: 'KES',
        targetAccount: 'acc_123',
        reference: 'AUTO_SAVE_001',
        description: 'Automated savings transfer',
      };

      await expect(naboCapitalService.initiateTransfer(request))
        .rejects.toThrow('Failed to initiate transfer');
    });
  });

  describe('getTransferStatus', () => {
    it('should get transfer status successfully', async () => {
      const mockStatusResponse = {
        data: {
          transfer_id: 'tx_123',
          status: 'completed',
          amount: 500,
          currency: 'KES',
          reference: 'AUTO_SAVE_001',
          created_at: '2023-12-01T10:00:00Z',
        },
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockStatusResponse),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const result = await naboCapitalService.getTransferStatus('tx_123');

      expect(result.transferId).toBe('tx_123');
      expect(result.status).toBe('completed');
      expect(result.amount).toBe(500);
    });
  });

  describe('cancelTransfer', () => {
    it('should cancel transfer successfully', async () => {
      const mockCancelResponse = {
        data: {
          success: true,
          message: 'Transfer cancelled successfully',
        },
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockCancelResponse),
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const result = await naboCapitalService.cancelTransfer('tx_123', 'User requested');

      expect(result).toEqual({
        success: true,
        message: 'Transfer cancelled successfully',
      });
    });
  });

  describe('getTransferHistory', () => {
    it('should fetch transfer history successfully', async () => {
      const mockHistoryResponse = {
        data: {
          transfers: [
            {
              transfer_id: 'tx_123',
              status: 'completed',
              amount: 500,
              currency: 'KES',
              reference: 'AUTO_SAVE_001',
              created_at: '2023-12-01T10:00:00Z',
            },
            {
              transfer_id: 'tx_124',
              status: 'pending',
              amount: 300,
              currency: 'KES',
              reference: 'AUTO_SAVE_002',
              created_at: '2023-12-02T10:00:00Z',
            },
          ],
          total: 2,
          has_more: false,
        },
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockHistoryResponse),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const result = await naboCapitalService.getTransferHistory('user123');

      expect(result.transfers).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(result.transfers[0].transferId).toBe('tx_123');
      expect(result.transfers[1].transferId).toBe('tx_124');
    });

    it('should handle date filters', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({ data: { transfers: [], total: 0, has_more: false } }),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };

      mockedAxios.create.mockReturnValue(mockClient as any);

      const startDate = new Date('2023-12-01');
      const endDate = new Date('2023-12-31');

      await naboCapitalService.getTransferHistory('user123', {
        startDate,
        endDate,
        status: 'completed',
        limit: 25,
        offset: 10,
      });

      expect(mockClient.get).toHaveBeenCalledWith('/transfers', {
        params: {
          user_id: 'user123',
          start_date: '2023-12-01',
          end_date: '2023-12-31',
          status: 'completed',
          limit: 25,
          offset: 10,
        },
      });
    });
  });

  describe('setupAutomatedSavings', () => {
    it('should setup automated savings rules successfully', async () => {
      const mockRuleResponse = {
        data: {
          rule_id: 'rule_123',
          status: 'active',
        },
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockRuleResponse),
        get: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const rules = {
        roundUpSavings: true,
        percentageSavings: 10,
        minimumTransfer: 50,
        maximumDailyTransfer: 1000,
        targetAccount: 'acc_123',
      };

      const result = await naboCapitalService.setupAutomatedSavings('user123', rules);

      expect(result).toEqual({
        ruleId: 'rule_123',
        status: 'active',
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when service is operational', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: { status: 'ok' } }),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const health = await naboCapitalService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.message).toBe('Nabo Capital service is operational');
      expect(health.responseTime).toBeGreaterThan(0);
    });

    it('should return unhealthy status when service fails', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Service unavailable')),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as any);

      const health = await naboCapitalService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('Nabo Capital service error');
    });
  });
});