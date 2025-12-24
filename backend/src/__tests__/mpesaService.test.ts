import { MpesaService, MpesaConfig, StkPushRequest } from '../services/mpesaService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MpesaService', () => {
  let mpesaService: MpesaService;
  let mockConfig: MpesaConfig;

  beforeEach(() => {
    mockConfig = {
      consumerKey: 'test_consumer_key',
      consumerSecret: 'test_consumer_secret',
      environment: 'sandbox',
      shortcode: '174379',
      passkey: 'test_passkey',
      callbackUrl: 'https://test.com/callback'
    };

    mpesaService = new MpesaService(mockConfig);
    jest.clearAllMocks();
  });

  describe('getAccessToken', () => {
    it('should get access token successfully', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: '3599'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);

      // Access private method for testing
      const getAccessToken = (mpesaService as any).getAccessToken.bind(mpesaService);
      const token = await getAccessToken();

      expect(token).toBe('test_access_token');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should reuse valid access token', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: '3599'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);

      const getAccessToken = (mpesaService as any).getAccessToken.bind(mpesaService);
      
      // First call
      await getAccessToken();
      // Second call should reuse token
      await getAccessToken();

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Authentication failed'));

      const getAccessToken = (mpesaService as any).getAccessToken.bind(mpesaService);
      
      await expect(getAccessToken()).rejects.toThrow('Failed to authenticate with M-Pesa API');
    });
  });

  describe('initiatePayment', () => {
    it('should initiate STK push successfully', async () => {
      const mockTokenResponse = {
        data: { access_token: 'test_token' }
      };
      const mockStkResponse = {
        data: {
          MerchantRequestID: 'merchant_123',
          CheckoutRequestID: 'checkout_123',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Success. Request accepted for processing'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.post.mockResolvedValueOnce(mockStkResponse);

      const request: StkPushRequest = {
        phoneNumber: '254712345678',
        amount: 100,
        accountReference: 'TEST123',
        transactionDesc: 'Test payment'
      };

      const result = await mpesaService.initiatePayment(request);

      expect(result).toEqual({
        merchantRequestId: 'merchant_123',
        checkoutRequestId: 'checkout_123',
        responseCode: '0',
        responseDescription: 'Success',
        customerMessage: 'Success. Request accepted for processing'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        expect.objectContaining({
          BusinessShortCode: '174379',
          Amount: 100,
          PartyA: '254712345678',
          PhoneNumber: '254712345678',
          AccountReference: 'TEST123',
          TransactionDesc: 'Test payment'
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_token'
          })
        })
      );
    });

    it('should format phone numbers correctly', async () => {
      const mockTokenResponse = { data: { access_token: 'test_token' } };
      const mockStkResponse = {
        data: {
          MerchantRequestID: 'merchant_123',
          CheckoutRequestID: 'checkout_123',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Success'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.post.mockResolvedValueOnce(mockStkResponse);

      const request: StkPushRequest = {
        phoneNumber: '0712345678', // Local format
        amount: 100,
        accountReference: 'TEST123',
        transactionDesc: 'Test payment'
      };

      await mpesaService.initiatePayment(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          PartyA: '254712345678', // Should be converted to international format
          PhoneNumber: '254712345678'
        }),
        expect.any(Object)
      );
    });

    it('should handle payment initiation errors', async () => {
      const mockTokenResponse = { data: { access_token: 'test_token' } };
      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.post.mockRejectedValueOnce(new Error('Payment failed'));

      const request: StkPushRequest = {
        phoneNumber: '254712345678',
        amount: 100,
        accountReference: 'TEST123',
        transactionDesc: 'Test payment'
      };

      await expect(mpesaService.initiatePayment(request)).rejects.toThrow('Failed to initiate M-Pesa payment');
    });
  });

  describe('queryTransactionStatus', () => {
    it('should query transaction status successfully', async () => {
      const mockTokenResponse = { data: { access_token: 'test_token' } };
      const mockStatusResponse = {
        data: {
          ResponseCode: '0',
          ResponseDescription: 'Success',
          MerchantRequestID: 'merchant_123',
          CheckoutRequestID: 'checkout_123',
          ResultCode: '0',
          ResultDesc: 'The service request is processed successfully.'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.post.mockResolvedValueOnce(mockStatusResponse);

      const result = await mpesaService.queryTransactionStatus('checkout_123');

      expect(result).toEqual({
        responseCode: '0',
        responseDescription: 'Success',
        merchantRequestId: 'merchant_123',
        checkoutRequestId: 'checkout_123',
        resultCode: '0',
        resultDesc: 'The service request is processed successfully.'
      });
    });

    it('should extract callback metadata when available', async () => {
      const mockTokenResponse = { data: { access_token: 'test_token' } };
      const mockStatusResponse = {
        data: {
          ResponseCode: '0',
          ResponseDescription: 'Success',
          MerchantRequestID: 'merchant_123',
          CheckoutRequestID: 'checkout_123',
          ResultCode: '0',
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 100 },
              { Name: 'MpesaReceiptNumber', Value: 'QH12ABC123' },
              { Name: 'TransactionDate', Value: 20231215143000 },
              { Name: 'PhoneNumber', Value: 254712345678 }
            ]
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.post.mockResolvedValueOnce(mockStatusResponse);

      const result = await mpesaService.queryTransactionStatus('checkout_123');

      expect(result.amount).toBe(100);
      expect(result.mpesaReceiptNumber).toBe('QH12ABC123');
      expect(result.transactionDate).toBe(20231215143000);
      expect(result.phoneNumber).toBe(254712345678);
    });

    it('should handle query errors', async () => {
      const mockTokenResponse = { data: { access_token: 'test_token' } };
      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.post.mockRejectedValueOnce(new Error('Query failed'));

      await expect(mpesaService.queryTransactionStatus('checkout_123')).rejects.toThrow('Failed to query transaction status');
    });
  });

  describe('handleCallback', () => {
    it('should handle successful payment callback', async () => {
      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: 'checkout_123',
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 100 },
                { Name: 'MpesaReceiptNumber', Value: 'QH12ABC123' },
                { Name: 'TransactionDate', Value: 20231215143000 },
                { Name: 'PhoneNumber', Value: 254712345678 }
              ]
            }
          }
        }
      };

      const result = await mpesaService.handleCallback(callbackData);

      expect(result.id).toBe('checkout_123');
      expect(result.status).toBe('completed');
      expect(result.amount).toBe(100);
      expect(result.mpesaReceiptNumber).toBe('QH12ABC123');
      expect(result.phoneNumber).toBe('254712345678');
    });

    it('should handle failed payment callback', async () => {
      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: 'checkout_123',
            ResultCode: 1,
            ResultDesc: 'The balance is insufficient for the transaction.'
          }
        }
      };

      const result = await mpesaService.handleCallback(callbackData);

      expect(result.id).toBe('checkout_123');
      expect(result.status).toBe('failed');
    });

    it('should handle cancelled payment callback', async () => {
      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: 'checkout_123',
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user'
          }
        }
      };

      const result = await mpesaService.handleCallback(callbackData);

      expect(result.id).toBe('checkout_123');
      expect(result.status).toBe('cancelled');
    });

    it('should handle malformed callback data', async () => {
      const callbackData = { invalid: 'data' };

      await expect(mpesaService.handleCallback(callbackData)).rejects.toThrow('Failed to process M-Pesa callback');
    });
  });

  describe('pollTransactionStatus', () => {
    it('should poll until transaction completes', async () => {
      const mockTokenResponse = { data: { access_token: 'test_token' } };
      const mockPendingResponse = {
        data: {
          ResponseCode: '0',
          MerchantRequestID: 'merchant_123',
          CheckoutRequestID: 'checkout_123',
          ResultCode: '0000', // Pending
          ResultDesc: 'Request pending'
        }
      };
      const mockCompletedResponse = {
        data: {
          ResponseCode: '0',
          MerchantRequestID: 'merchant_123',
          CheckoutRequestID: 'checkout_123',
          ResultCode: '0', // Completed
          ResultDesc: 'Success'
        }
      };

      mockedAxios.get.mockResolvedValue(mockTokenResponse);
      mockedAxios.post
        .mockResolvedValueOnce(mockPendingResponse)
        .mockResolvedValueOnce(mockCompletedResponse);

      const result = await mpesaService.pollTransactionStatus('checkout_123', 3, 100);

      expect(result.resultCode).toBe('0');
      expect(result.resultDesc).toBe('Success');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should timeout after max attempts', async () => {
      const mockTokenResponse = { data: { access_token: 'test_token' } };
      const mockPendingResponse = {
        data: {
          ResponseCode: '0',
          MerchantRequestID: 'merchant_123',
          CheckoutRequestID: 'checkout_123',
          ResultCode: '0000', // Always pending
          ResultDesc: 'Request pending'
        }
      };

      mockedAxios.get.mockResolvedValue(mockTokenResponse);
      mockedAxios.post.mockResolvedValue(mockPendingResponse);

      await expect(
        mpesaService.pollTransactionStatus('checkout_123', 2, 100)
      ).rejects.toThrow('Transaction status polling timeout after 2 attempts');
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct Kenyan phone numbers', () => {
      expect(mpesaService.validatePhoneNumber('254712345678')).toBe(true);
      expect(mpesaService.validatePhoneNumber('254722345678')).toBe(true);
      expect(mpesaService.validatePhoneNumber('0712345678')).toBe(true);
      expect(mpesaService.validatePhoneNumber('0722345678')).toBe(true);
      expect(mpesaService.validatePhoneNumber('712345678')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(mpesaService.validatePhoneNumber('25471234567')).toBe(false); // Too short
      expect(mpesaService.validatePhoneNumber('2547123456789')).toBe(false); // Too long
      expect(mpesaService.validatePhoneNumber('254812345678')).toBe(false); // Invalid prefix
      expect(mpesaService.validatePhoneNumber('123456789')).toBe(false); // Invalid format
      expect(mpesaService.validatePhoneNumber('')).toBe(false); // Empty
      expect(mpesaService.validatePhoneNumber('abc123')).toBe(false); // Non-numeric
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when service is operational', async () => {
      const mockTokenResponse = { data: { access_token: 'test_token' } };
      mockedAxios.get.mockResolvedValueOnce(mockTokenResponse);

      const health = await mpesaService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.message).toBe('M-Pesa service is operational');
    });

    it('should return unhealthy status when service fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const health = await mpesaService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('M-Pesa service error');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format various phone number formats correctly', () => {
      const formatPhoneNumber = (mpesaService as any).formatPhoneNumber.bind(mpesaService);

      expect(formatPhoneNumber('0712345678')).toBe('254712345678');
      expect(formatPhoneNumber('254712345678')).toBe('254712345678');
      expect(formatPhoneNumber('712345678')).toBe('254712345678');
      expect(formatPhoneNumber('+254712345678')).toBe('254712345678');
      expect(formatPhoneNumber('254-712-345-678')).toBe('254712345678');
      expect(formatPhoneNumber('(254) 712 345 678')).toBe('254712345678');
    });
  });

  describe('environment configuration', () => {
    it('should use production URLs for production environment', () => {
      const prodConfig = { ...mockConfig, environment: 'production' as const };
      const prodService = new MpesaService(prodConfig);
      
      // Access private baseUrl property
      const baseUrl = (prodService as any).baseUrl;
      expect(baseUrl).toBe('https://api.safaricom.co.ke');
    });

    it('should use sandbox URLs for sandbox environment', () => {
      const baseUrl = (mpesaService as any).baseUrl;
      expect(baseUrl).toBe('https://sandbox.safaricom.co.ke');
    });
  });
});