import { SecurityService } from '../services/securityService';

describe('SecurityService', () => {
  let securityService: SecurityService;

  beforeEach(() => {
    securityService = new SecurityService({
      jwtSecret: 'test-secret-key',
      bcryptRounds: 4, // Lower rounds for faster tests
    });
  });

  describe('Data Encryption', () => {
    it('should encrypt and decrypt data successfully', () => {
      const plaintext = 'sensitive user data';
      const additionalData = 'user123';

      const encrypted = securityService.encryptData(plaintext, additionalData);
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.salt).toBeDefined();

      const decrypted = securityService.decryptData(encrypted, additionalData);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong additional data', () => {
      const plaintext = 'sensitive user data';
      const encrypted = securityService.encryptData(plaintext, 'user123');

      expect(() => {
        securityService.decryptData(encrypted, 'wrong-data');
      }).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with tampered data', () => {
      const plaintext = 'sensitive user data';
      const encrypted = securityService.encryptData(plaintext);
      
      // Tamper with encrypted data
      encrypted.encryptedData = encrypted.encryptedData.slice(0, -2) + '00';

      expect(() => {
        securityService.decryptData(encrypted);
      }).toThrow('Failed to decrypt data');
    });
  });

  describe('Password Hashing', () => {
    it('should hash and verify passwords correctly', async () => {
      const password = 'mySecurePassword123';
      
      const hash = await securityService.hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const isValid = await securityService.verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await securityService.verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'samePassword';
      
      const hash1 = await securityService.hashPassword(password);
      const hash2 = await securityService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      
      // Both should verify correctly
      expect(await securityService.verifyPassword(password, hash1)).toBe(true);
      expect(await securityService.verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('JWT Token Management', () => {
    it('should generate and verify JWT tokens', () => {
      const payload = { userId: 'user123', email: 'test@example.com' };
      
      const token = securityService.generateJWT(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = securityService.verifyJWT(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.iss).toBe('finwise-ai');
      expect(decoded.aud).toBe('finwise-ai-app');
    });

    it('should handle expired tokens', () => {
      const payload = { userId: 'user123' };
      const token = securityService.generateJWT(payload, '1ms'); // Very short expiry

      // Wait for token to expire
      setTimeout(() => {
        expect(() => {
          securityService.verifyJWT(token);
        }).toThrow('Invalid or expired token');
      }, 10);
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        securityService.verifyJWT('invalid.token.here');
      }).toThrow('Invalid or expired token');
    });
  });

  describe('Fraud Detection', () => {
    it('should detect high-risk transactions', async () => {
      const transactionData = {
        userId: 'user123',
        amount: 150000, // Above max limit
        currency: 'KES',
        merchant: 'Unknown Merchant',
        timestamp: new Date(),
        userHistory: {
          avgTransactionAmount: 1000,
          transactionCount: 5,
          lastTransactionTime: new Date(Date.now() - 30000), // 30 seconds ago
          commonLocations: [],
          commonMerchants: ['Supermarket A', 'Gas Station B'],
        },
      };

      const analysis = await securityService.analyzeFraudRisk(transactionData);

      expect(analysis.riskScore).toBeGreaterThan(50);
      expect(analysis.riskLevel).toMatch(/high|critical/);
      expect(analysis.recommendation).toMatch(/review|block/);
      expect(analysis.flags).toContain('high_amount');
      expect(analysis.flags).toContain('unusual_amount');
      expect(analysis.flags).toContain('rapid_succession');
    });

    it('should allow low-risk transactions', async () => {
      const transactionData = {
        userId: 'user123',
        amount: 500, // Normal amount
        currency: 'KES',
        merchant: 'Supermarket A',
        deviceId: 'known-device-123',
        timestamp: new Date(),
        userHistory: {
          avgTransactionAmount: 600,
          transactionCount: 3,
          lastTransactionTime: new Date(Date.now() - 3600000), // 1 hour ago
          commonLocations: [{ lat: -1.286389, lng: 36.817223 }],
          commonMerchants: ['Supermarket A', 'Gas Station B'],
        },
      };

      const analysis = await securityService.analyzeFraudRisk(transactionData);

      expect(analysis.riskScore).toBeLessThan(30);
      expect(analysis.riskLevel).toBe('low');
      expect(analysis.recommendation).toBe('allow');
    });

    it('should handle missing user history gracefully', async () => {
      const transactionData = {
        userId: 'new-user',
        amount: 1000,
        currency: 'KES',
        timestamp: new Date(),
      };

      const analysis = await securityService.analyzeFraudRisk(transactionData);

      expect(analysis).toBeDefined();
      expect(analysis.riskScore).toBeGreaterThan(0);
      expect(analysis.flags).toContain('unknown_device');
    });
  });

  describe('Biometric Authentication', () => {
    it('should verify valid biometric data', async () => {
      const biometricData = 'valid-biometric-template-data-12345';
      const result = await securityService.verifyBiometric(
        biometricData,
        'fingerprint',
        'user123',
        'device123'
      );

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(60);
      expect(result.biometricType).toBe('fingerprint');
      expect(result.deviceId).toBe('device123');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should reject invalid biometric data', async () => {
      const invalidData = 'short';
      const result = await securityService.verifyBiometric(
        invalidData,
        'fingerprint',
        'user123'
      );

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle different biometric types', async () => {
      const biometricData = 'valid-face-template-data-12345';
      
      const faceResult = await securityService.verifyBiometric(
        biometricData,
        'face',
        'user123'
      );

      expect(faceResult.biometricType).toBe('face');

      const voiceResult = await securityService.verifyBiometric(
        biometricData,
        'voice',
        'user123'
      );

      expect(voiceResult.biometricType).toBe('voice');
    });
  });

  describe('Secure Data Deletion', () => {
    it('should delete specified data types', async () => {
      const deletionRequest = {
        userId: 'user123',
        dataTypes: ['transactions', 'personal_info'] as ('transactions' | 'personal_info' | 'biometric' | 'financial_accounts' | 'all')[],
        reason: 'User requested deletion',
        requestedBy: 'user@example.com',
      };

      const result = await securityService.secureDataDeletion(deletionRequest);

      expect(result.success).toBe(true);
      expect(result.deletedItems).toContain('Transaction history');
      expect(result.deletedItems).toContain('Personal information');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle deletion errors gracefully', async () => {
      const deletionRequest = {
        userId: 'user123',
        dataTypes: ['invalid_type'] as any,
        reason: 'Test deletion',
        requestedBy: 'user@example.com',
      };

      const result = await securityService.secureDataDeletion(deletionRequest);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unknown data type');
    });

    it('should delete all data when requested', async () => {
      const deletionRequest = {
        userId: 'user123',
        dataTypes: ['all'] as ('transactions' | 'personal_info' | 'biometric' | 'financial_accounts' | 'all')[],
        reason: 'Complete account deletion',
        requestedBy: 'user@example.com',
      };

      const result = await securityService.secureDataDeletion(deletionRequest);

      expect(result.success).toBe(true);
      expect(result.deletedItems).toContain('All user data');
    });
  });

  describe('Utility Functions', () => {
    it('should generate secure random tokens', () => {
      const token1 = securityService.generateSecureToken();
      const token2 = securityService.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate OTPs of specified length', () => {
      const otp4 = securityService.generateOTP(4);
      const otp6 = securityService.generateOTP(6);
      const otp8 = securityService.generateOTP(8);

      expect(otp4.length).toBe(4);
      expect(otp6.length).toBe(6);
      expect(otp8.length).toBe(8);

      expect(/^\d+$/.test(otp4)).toBe(true);
      expect(/^\d+$/.test(otp6)).toBe(true);
      expect(/^\d+$/.test(otp8)).toBe(true);
    });

    it('should generate and verify data integrity hashes', () => {
      const data = 'important data to protect';
      const hash = securityService.generateDataIntegrityHash(data);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');

      const isValid = securityService.verifyDataIntegrity(data, hash);
      expect(isValid).toBe(true);

      const isInvalid = securityService.verifyDataIntegrity('tampered data', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Security Status', () => {
    it('should return security configuration status', () => {
      const status = securityService.getSecurityStatus();

      expect(status.encryption.enabled).toBe(true);
      expect(status.encryption.algorithm).toBe('aes-256-gcm');
      expect(status.biometric.enabled).toBe(true);
      expect(status.fraudDetection.enabled).toBe(true);
      expect(status.dataProtection.masterKeyConfigured).toBeDefined();
    });
  });
});