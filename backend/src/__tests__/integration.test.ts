import request from 'supertest';
import app from '../index';
import { integrationService } from '../services/integrationService';

// Mock the integration service
jest.mock('../services/integrationService');
const mockIntegrationService = integrationService as jest.Mocked<typeof integrationService>;

// Mock authentication middleware
jest.mock('../middleware/authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  },
}));

describe('Integration Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/integration/process-transaction', () => {
    it('should process transaction successfully', async () => {
      const mockResult = {
        success: true,
        transaction: {
          id: 'test-transaction-id',
          amount: 500,
          description: 'Test transaction',
          category: 'Food',
          timestamp: new Date(),
          source: 'sms' as const,
          userId: 'test-user-id',
          currency: 'KES',
          rawData: 'test sms',
          isVerified: true,
        },
        requiresCategorization: false,
        savingsOffer: {
          amount: 25,
          message: 'Save KES 25 towards your emergency fund',
        },
      };

      mockIntegrationService.processTransaction.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/integration/process-transaction')
        .send({
          smsContent: 'Confirmed. You have sent Ksh500.00 to JOHN DOE',
          userId: 'test-user-id',
          phoneNumber: '0722123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction).toBeDefined();
      expect(response.body.data.savingsOffer).toBeDefined();
      expect(mockIntegrationService.processTransaction).toHaveBeenCalledWith(
        'Confirmed. You have sent Ksh500.00 to JOHN DOE',
        'test-user-id',
        '0722123456'
      );
    });

    it('should return error for invalid input', async () => {
      const response = await request(app)
        .post('/api/v1/integration/process-transaction')
        .send({
          userId: 'test-user-id',
          // Missing smsContent
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('SMS content and user ID are required');
    });

    it('should handle processing failure', async () => {
      const mockResult = {
        success: false,
        error: 'Failed to parse SMS',
      };

      mockIntegrationService.processTransaction.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/integration/process-transaction')
        .send({
          smsContent: 'Invalid SMS content',
          userId: 'test-user-id',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to parse SMS');
    });
  });

  describe('POST /api/v1/integration/onboard-user', () => {
    it('should onboard user successfully', async () => {
      const mockResult = { success: true };
      mockIntegrationService.onboardUser.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/integration/onboard-user')
        .send({
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            phoneNumber: '0722123456',
            country: 'KE',
            currency: 'KES',
            preferences: {},
            createdAt: new Date(),
            lastActive: new Date(),
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User onboarded successfully');
    });

    it('should return error for missing user data', async () => {
      const response = await request(app)
        .post('/api/v1/integration/onboard-user')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User data is required');
    });
  });

  describe('POST /api/v1/integration/demo-flow', () => {
    it('should execute complete demo flow', async () => {
      const mockTransactionResult = {
        success: true,
        transaction: {
          id: 'demo-transaction-id',
          amount: 500,
          description: 'Demo transaction',
          category: 'Food',
          timestamp: new Date(),
          source: 'sms' as const,
          userId: 'test-user-id',
          currency: 'KES',
          rawData: 'demo sms',
          isVerified: true,
        },
        savingsOffer: {
          amount: 25,
          message: 'Demo savings offer',
        },
      };

      mockIntegrationService.processTransaction.mockResolvedValue(mockTransactionResult);
      mockIntegrationService.performDailyAnalysis.mockResolvedValue();
      mockIntegrationService.generateWeeklyStory.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/integration/demo-flow')
        .send({
          userId: 'test-user-id',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionProcessed).toBe(true);
      expect(response.body.data.analysisCompleted).toBe(true);
      expect(response.body.data.storyGenerated).toBe(true);
      expect(response.body.data.transaction).toBeDefined();
      expect(response.body.data.savingsOffer).toBeDefined();
    });
  });

  describe('GET /api/v1/integration/health', () => {
    it('should return healthy status', async () => {
      mockIntegrationService.healthCheck.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/v1/integration/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.healthy).toBe(true);
      expect(response.body.message).toBe('Integration service is healthy');
    });

    it('should return unhealthy status', async () => {
      mockIntegrationService.healthCheck.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/v1/integration/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.data.healthy).toBe(false);
      expect(response.body.message).toBe('Integration service is unhealthy');
    });
  });

  describe('GET /api/v1/integration/status', () => {
    it('should return service status', async () => {
      const response = await request(app)
        .get('/api/v1/integration/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.service).toBe('Integration Service');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.features).toBeDefined();
      expect(response.body.data.features.transactionProcessing).toBe(true);
      expect(response.body.data.features.userOnboarding).toBe(true);
      expect(response.body.data.features.dailyAnalysis).toBe(true);
    });
  });
});

describe('Integration Service', () => {
  // Reset mocks for service tests
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Flow Integration', () => {
    it('should demonstrate end-to-end transaction processing', async () => {
      // This test demonstrates the complete integration flow
      const smsContent = 'Confirmed. You have sent Ksh500.00 to JOHN DOE 0722123456 on 15/12/23 at 2:30 PM. New M-PESA balance is Ksh2,500.00.';
      const userId = 'integration-test-user';
      const phoneNumber = '0722123456';

      // Mock the complete flow
      const expectedResult = {
        success: true,
        transaction: {
          id: 'integration-transaction-id',
          userId,
          amount: 500,
          currency: 'KES',
          description: 'Payment to JOHN DOE',
          category: 'Transfer',
          timestamp: new Date(),
          source: 'sms' as const,
          rawData: smsContent,
          isVerified: true,
          merchant: 'JOHN DOE',
        },
        requiresCategorization: false,
        savingsOffer: {
          amount: 25,
          goalId: 'emergency-fund',
          message: 'Save KES 25 towards your emergency fund',
          acceptanceRate: 0.85,
        },
        anomalies: [],
      };

      mockIntegrationService.processTransaction.mockResolvedValue(expectedResult);

      // Test the API endpoint
      const response = await request(app)
        .post('/api/v1/integration/process-transaction')
        .send({
          smsContent,
          userId,
          phoneNumber,
        });

      // Verify the response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.transaction).toBeDefined();
      expect(response.body.data.transaction.amount).toBe(500);
      expect(response.body.data.transaction.currency).toBe('KES');
      expect(response.body.data.transaction.source).toBe('sms');
      expect(response.body.data.savingsOffer).toBeDefined();
      expect(response.body.data.savingsOffer.amount).toBe(25);

      // Verify the service was called correctly
      expect(mockIntegrationService.processTransaction).toHaveBeenCalledWith(
        smsContent,
        userId,
        phoneNumber
      );
    });
  });
});