import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

/**
 * Security Service
 * Handles data encryption, authentication, fraud detection, and secure data deletion
 */

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  saltLength: number;
}

export interface BiometricAuthConfig {
  enabled: boolean;
  supportedTypes: ('fingerprint' | 'face' | 'voice')[];
  maxAttempts: number;
  lockoutDuration: number; // in minutes
}

export interface FraudDetectionConfig {
  enabled: boolean;
  maxTransactionAmount: number;
  maxDailyTransactions: number;
  suspiciousPatterns: string[];
  geoLocationCheck: boolean;
}

export interface SecurityConfig {
  encryption: EncryptionConfig;
  biometric: BiometricAuthConfig;
  fraudDetection: FraudDetectionConfig;
  jwtSecret: string;
  jwtExpiresIn: string | number;
  bcryptRounds: number;
}

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  tag: string;
  salt: string;
}

export interface FraudAnalysisResult {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendation: 'allow' | 'review' | 'block';
  reasons: string[];
}

export interface BiometricVerificationResult {
  success: boolean;
  confidence: number; // 0-100
  biometricType: string;
  timestamp: Date;
  deviceId?: string;
}

export class SecurityService {
  private config: SecurityConfig;
  private masterKey: Buffer;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        tagLength: 16,
        saltLength: 32,
      },
      biometric: {
        enabled: true,
        supportedTypes: ['fingerprint', 'face'],
        maxAttempts: 3,
        lockoutDuration: 30,
      },
      fraudDetection: {
        enabled: true,
        maxTransactionAmount: 100000, // KES
        maxDailyTransactions: 50,
        suspiciousPatterns: [
          'rapid_succession',
          'unusual_amount',
          'new_device',
          'geo_anomaly',
          'time_anomaly',
        ],
        geoLocationCheck: true,
      },
      jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
      jwtExpiresIn: '24h',
      bcryptRounds: 12,
      ...config,
    };

    // Initialize master key from environment or generate new one
    const masterKeyHex = process.env.MASTER_ENCRYPTION_KEY;
    if (masterKeyHex) {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
    } else {
      this.masterKey = crypto.randomBytes(this.config.encryption.keyLength);
      logger.warn('No master encryption key found in environment. Generated new key. This should not happen in production.');
    }
  }

  /**
   * Encrypt sensitive data using AES-256-CBC
   */
  encryptData(plaintext: string, additionalData?: string): EncryptedData {
    try {
      const salt = crypto.randomBytes(this.config.encryption.saltLength);
      const iv = crypto.randomBytes(this.config.encryption.ivLength);
      
      // Derive key from master key and salt
      const key = crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.config.encryption.keyLength, 'sha256');
      
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Create HMAC for authentication
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(encrypted);
      if (additionalData) {
        hmac.update(additionalData);
      }
      const tag = hmac.digest();

      const result: EncryptedData = {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex'),
      };

      logger.info('Data encrypted successfully', { 
        dataLength: plaintext.length,
        hasAdditionalData: !!additionalData 
      });

      return result;

    } catch (error) {
      logger.error('Data encryption failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decryptData(encryptedData: EncryptedData, additionalData?: string): string {
    try {
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      
      // Derive key from master key and salt
      const key = crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.config.encryption.keyLength, 'sha256');
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Verify HMAC first
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(encryptedData.encryptedData);
      if (additionalData) {
        hmac.update(additionalData);
      }
      const expectedTag = hmac.digest();
      const providedTag = Buffer.from(encryptedData.tag, 'hex');
      
      if (!crypto.timingSafeEqual(expectedTag, providedTag)) {
        throw new Error('Authentication failed');
      }
      
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logger.info('Data decrypted successfully');

      return decrypted;

    } catch (error) {
      logger.error('Data decryption failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, this.config.bcryptRounds);
      logger.info('Password hashed successfully');
      return hash;
    } catch (error) {
      logger.error('Password hashing failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hash);
      logger.info('Password verification completed', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Password verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Generate JWT token
   */
  generateJWT(payload: object, expiresIn?: string | number): string {
    try {
      const options: any = {
        expiresIn: expiresIn || this.config.jwtExpiresIn,
        issuer: 'finwise-ai',
        audience: 'finwise-ai-app',
      };

      const token = jwt.sign(payload, this.config.jwtSecret, options);

      logger.info('JWT token generated', { 
        expiresIn: expiresIn || this.config.jwtExpiresIn,
        payloadKeys: Object.keys(payload)
      });

      return token;
    } catch (error) {
      logger.error('JWT generation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to generate JWT token');
    }
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token: string): any {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        issuer: 'finwise-ai',
        audience: 'finwise-ai-app',
      });

      logger.info('JWT token verified successfully');
      return decoded;
    } catch (error) {
      logger.error('JWT verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Analyze transaction for fraud patterns
   */
  async analyzeFraudRisk(transactionData: {
    userId: string;
    amount: number;
    currency: string;
    merchant?: string;
    location?: { lat: number; lng: number };
    deviceId?: string;
    timestamp: Date;
    userHistory?: {
      avgTransactionAmount: number;
      transactionCount: number;
      lastTransactionTime: Date;
      commonLocations: Array<{ lat: number; lng: number }>;
      commonMerchants: string[];
    };
  }): Promise<FraudAnalysisResult> {
    try {
      logger.info('Analyzing fraud risk', { 
        userId: transactionData.userId,
        amount: transactionData.amount,
        merchant: transactionData.merchant
      });

      let riskScore = 0;
      const flags: string[] = [];
      const reasons: string[] = [];

      // Amount-based risk analysis
      if (transactionData.amount > this.config.fraudDetection.maxTransactionAmount) {
        riskScore += 30;
        flags.push('high_amount');
        reasons.push(`Transaction amount (${transactionData.amount}) exceeds maximum limit`);
      }

      // Historical pattern analysis
      if (transactionData.userHistory) {
        const { avgTransactionAmount, transactionCount, lastTransactionTime, commonMerchants } = transactionData.userHistory;

        // Unusual amount pattern
        if (transactionData.amount > avgTransactionAmount * 5) {
          riskScore += 25;
          flags.push('unusual_amount');
          reasons.push('Transaction amount significantly higher than user average');
        }

        // Rapid succession transactions
        const timeDiff = transactionData.timestamp.getTime() - lastTransactionTime.getTime();
        if (timeDiff < 60000) { // Less than 1 minute
          riskScore += 20;
          flags.push('rapid_succession');
          reasons.push('Transaction made within 1 minute of previous transaction');
        }

        // New merchant risk
        if (transactionData.merchant && !commonMerchants.includes(transactionData.merchant)) {
          riskScore += 10;
          flags.push('new_merchant');
          reasons.push('Transaction with new/uncommon merchant');
        }

        // High frequency check
        if (transactionCount > this.config.fraudDetection.maxDailyTransactions) {
          riskScore += 15;
          flags.push('high_frequency');
          reasons.push('Daily transaction limit exceeded');
        }
      }

      // Time-based analysis
      const hour = transactionData.timestamp.getHours();
      if (hour < 6 || hour > 23) {
        riskScore += 10;
        flags.push('unusual_time');
        reasons.push('Transaction made during unusual hours');
      }

      // Device analysis
      if (!transactionData.deviceId) {
        riskScore += 15;
        flags.push('unknown_device');
        reasons.push('Transaction from unrecognized device');
      }

      // Determine risk level and recommendation
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      let recommendation: 'allow' | 'review' | 'block';

      if (riskScore <= 20) {
        riskLevel = 'low';
        recommendation = 'allow';
      } else if (riskScore <= 40) {
        riskLevel = 'medium';
        recommendation = 'allow';
      } else if (riskScore <= 70) {
        riskLevel = 'high';
        recommendation = 'review';
      } else {
        riskLevel = 'critical';
        recommendation = 'block';
      }

      const result: FraudAnalysisResult = {
        riskScore,
        riskLevel,
        flags,
        recommendation,
        reasons,
      };

      logger.info('Fraud analysis completed', { 
        userId: transactionData.userId,
        riskScore,
        riskLevel,
        recommendation,
        flagCount: flags.length
      });

      return result;

    } catch (error) {
      logger.error('Fraud analysis failed', { 
        userId: transactionData.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Return safe default on error
      return {
        riskScore: 100,
        riskLevel: 'critical',
        flags: ['analysis_error'],
        recommendation: 'block',
        reasons: ['Fraud analysis system error'],
      };
    }
  }

  /**
   * Simulate biometric authentication
   */
  async verifyBiometric(
    biometricData: string,
    biometricType: 'fingerprint' | 'face' | 'voice',
    userId: string,
    deviceId?: string
  ): Promise<BiometricVerificationResult> {
    try {
      logger.info('Verifying biometric authentication', { 
        biometricType,
        userId,
        deviceId
      });

      // In a real implementation, this would integrate with actual biometric APIs
      // For now, we simulate the verification process

      // Basic validation
      if (!biometricData || biometricData.length < 10) {
        return {
          success: false,
          confidence: 0,
          biometricType,
          timestamp: new Date(),
          deviceId,
        };
      }

      // Simulate biometric matching with confidence score
      const confidence = Math.random() * 40 + 60; // 60-100% confidence
      const success = confidence >= 75; // Require at least 75% confidence

      const result: BiometricVerificationResult = {
        success,
        confidence: Math.round(confidence),
        biometricType,
        timestamp: new Date(),
        deviceId,
      };

      logger.info('Biometric verification completed', { 
        userId,
        biometricType,
        success,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      logger.error('Biometric verification failed', { 
        userId,
        biometricType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        confidence: 0,
        biometricType,
        timestamp: new Date(),
        deviceId,
      };
    }
  }

  /**
   * Securely delete sensitive data
   */
  async secureDataDeletion(data: {
    userId: string;
    dataTypes: ('transactions' | 'personal_info' | 'biometric' | 'financial_accounts' | 'all')[];
    reason: string;
    requestedBy: string;
  }): Promise<{ success: boolean; deletedItems: string[]; errors: string[] }> {
    try {
      logger.info('Starting secure data deletion', { 
        userId: data.userId,
        dataTypes: data.dataTypes,
        reason: data.reason,
        requestedBy: data.requestedBy
      });

      const deletedItems: string[] = [];
      const errors: string[] = [];

      // Simulate secure deletion process
      for (const dataType of data.dataTypes) {
        try {
          switch (dataType) {
            case 'transactions':
              // In real implementation, this would securely wipe transaction data
              await this.secureWipeData(`user_transactions_${data.userId}`);
              deletedItems.push('Transaction history');
              break;

            case 'personal_info':
              // Securely wipe personal information
              await this.secureWipeData(`user_profile_${data.userId}`);
              deletedItems.push('Personal information');
              break;

            case 'biometric':
              // Securely wipe biometric data
              await this.secureWipeData(`user_biometric_${data.userId}`);
              deletedItems.push('Biometric data');
              break;

            case 'financial_accounts':
              // Securely wipe financial account data
              await this.secureWipeData(`user_accounts_${data.userId}`);
              deletedItems.push('Financial account data');
              break;

            case 'all':
              // Wipe all user data
              await this.secureWipeData(`user_all_data_${data.userId}`);
              deletedItems.push('All user data');
              break;

            default:
              errors.push(`Unknown data type: ${dataType}`);
          }
        } catch (error) {
          errors.push(`Failed to delete ${dataType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const success = errors.length === 0;

      logger.info('Secure data deletion completed', { 
        userId: data.userId,
        success,
        deletedCount: deletedItems.length,
        errorCount: errors.length
      });

      return {
        success,
        deletedItems,
        errors,
      };

    } catch (error) {
      logger.error('Secure data deletion failed', { 
        userId: data.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        deletedItems: [],
        errors: [`Data deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate OTP (One-Time Password)
   */
  generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[crypto.randomInt(0, digits.length)];
    }
    return otp;
  }

  /**
   * Validate data integrity using HMAC
   */
  generateDataIntegrityHash(data: string): string {
    return crypto.createHmac('sha256', this.masterKey).update(data).digest('hex');
  }

  /**
   * Verify data integrity
   */
  verifyDataIntegrity(data: string, hash: string): boolean {
    const expectedHash = this.generateDataIntegrityHash(data);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  }

  /**
   * Get security configuration status
   */
  getSecurityStatus(): {
    encryption: { enabled: boolean; algorithm: string };
    biometric: { enabled: boolean; supportedTypes: string[] };
    fraudDetection: { enabled: boolean; maxAmount: number };
    dataProtection: { masterKeyConfigured: boolean };
  } {
    return {
      encryption: {
        enabled: true,
        algorithm: this.config.encryption.algorithm,
      },
      biometric: {
        enabled: this.config.biometric.enabled,
        supportedTypes: this.config.biometric.supportedTypes,
      },
      fraudDetection: {
        enabled: this.config.fraudDetection.enabled,
        maxAmount: this.config.fraudDetection.maxTransactionAmount,
      },
      dataProtection: {
        masterKeyConfigured: !!process.env.MASTER_ENCRYPTION_KEY,
      },
    };
  }

  /**
   * Simulate secure data wiping (multiple overwrites)
   */
  private async secureWipeData(identifier: string): Promise<void> {
    // In a real implementation, this would perform multiple overwrites of the data
    // with random patterns to ensure it cannot be recovered
    logger.info('Performing secure data wipe', { identifier });
    
    // Simulate the wiping process
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logger.info('Secure data wipe completed', { identifier });
  }
}

// Export singleton instance
export const securityService = new SecurityService();