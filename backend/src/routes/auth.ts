import { Router, Request, Response } from 'express';
import { securityService } from '../services/securityService';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * User registration
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, phoneNumber, country } = req.body;

    if (!email || !password || !fullName || !phoneNumber) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, fullName, phoneNumber',
      });
      return;
    }

    // Hash password
    const hashedPassword = await securityService.hashPassword(password);

    // In a real implementation, you would save the user to the database
    const userId = securityService.generateSecureToken(16);

    // Generate JWT token
    const token = securityService.generateJWT({
      userId,
      email,
      role: 'user',
      permissions: ['read:own', 'write:own'],
    });

    // Encrypt sensitive data for storage
    const encryptedPhone = securityService.encryptData(phoneNumber, userId);

    logger.info('User registered successfully', { userId, email });

    res.status(201).json({
      success: true,
      data: {
        userId,
        email,
        fullName,
        token,
        message: 'Registration successful',
      },
    });
  } catch (error) {
    logger.error('User registration failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

/**
 * User login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, deviceId, biometricToken, biometricType } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
      return;
    }

    // In a real implementation, you would fetch user from database
    // For now, we'll simulate user lookup and password verification
    const mockUserHash = await securityService.hashPassword('correct_password');
    const isValidPassword = await securityService.verifyPassword(password, mockUserHash);

    if (!isValidPassword) {
      logger.warn('Login attempt with invalid credentials', { email });
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }

    const userId = securityService.generateSecureToken(16);

    // If biometric authentication is provided, verify it
    let biometricVerification = null;
    if (biometricToken && biometricType) {
      biometricVerification = await securityService.verifyBiometric(
        biometricToken,
        biometricType as 'fingerprint' | 'face' | 'voice',
        userId,
        deviceId
      );

      if (!biometricVerification.success) {
        res.status(401).json({
          success: false,
          error: 'Biometric authentication failed',
          biometricResult: biometricVerification,
        });
        return;
      }
    }

    // Generate JWT token
    const token = securityService.generateJWT({
      userId,
      email,
      role: 'user',
      permissions: ['read:own', 'write:own'],
      deviceId,
      biometricVerified: !!biometricVerification?.success,
    });

    logger.info('User logged in successfully', {
      userId,
      email,
      deviceId,
      biometricUsed: !!biometricVerification,
    });

    res.json({
      success: true,
      data: {
        userId,
        email,
        token,
        biometricVerification,
        message: 'Login successful',
      },
    });
  } catch (error) {
    logger.error('User login failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

/**
 * Refresh JWT token
 */
router.post('/refresh', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Generate new token
    const newToken = securityService.generateJWT({
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      permissions: req.user.permissions,
    });

    logger.info('Token refreshed successfully', { userId: req.user.id });

    res.json({
      success: true,
      data: {
        token: newToken,
        message: 'Token refreshed successfully',
      },
    });
  } catch (error) {
    logger.error('Token refresh failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
    });
  }
});

/**
 * Biometric authentication setup
 */
router.post('/biometric/setup', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const { biometricType, biometricData, deviceId } = req.body;

    if (!biometricType || !biometricData) {
      res.status(400).json({
        success: false,
        error: 'Biometric type and data are required',
      });
      return;
    }

    // Verify biometric data
    const verification = await securityService.verifyBiometric(
      biometricData,
      biometricType,
      req.user.id,
      deviceId
    );

    if (!verification.success) {
      res.status(400).json({
        success: false,
        error: 'Biometric setup failed - invalid biometric data',
        verification,
      });
      return;
    }

    // In a real implementation, you would store the biometric template securely
    const biometricId = securityService.generateSecureToken(16);

    logger.info('Biometric authentication setup successful', {
      userId: req.user.id,
      biometricType,
      biometricId,
      confidence: verification.confidence,
    });

    res.json({
      success: true,
      data: {
        biometricId,
        biometricType,
        confidence: verification.confidence,
        message: 'Biometric authentication setup successful',
      },
    });
  } catch (error) {
    logger.error('Biometric setup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Biometric setup failed',
    });
  }
});

/**
 * Fraud risk analysis
 */
router.post('/fraud-analysis', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const { amount, currency, merchant, location, userHistory } = req.body;

    if (!amount) {
      res.status(400).json({
        success: false,
        error: 'Transaction amount is required',
      });
      return;
    }

    const transactionData = {
      userId: req.user.id,
      amount: parseFloat(amount),
      currency: currency || 'KES',
      merchant,
      location,
      deviceId: req.deviceId,
      timestamp: new Date(),
      userHistory,
    };

    const fraudAnalysis = await securityService.analyzeFraudRisk(transactionData);

    logger.info('Fraud analysis completed', {
      userId: req.user.id,
      riskScore: fraudAnalysis.riskScore,
      riskLevel: fraudAnalysis.riskLevel,
      recommendation: fraudAnalysis.recommendation,
    });

    res.json({
      success: true,
      data: fraudAnalysis,
    });
  } catch (error) {
    logger.error('Fraud analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Fraud analysis failed',
    });
  }
});

/**
 * Request data deletion (GDPR compliance)
 */
router.post('/data-deletion', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const { dataTypes, reason } = req.body;

    if (!dataTypes || !Array.isArray(dataTypes) || dataTypes.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Data types array is required',
      });
      return;
    }

    const deletionResult = await securityService.secureDataDeletion({
      userId: req.user.id,
      dataTypes,
      reason: reason || 'User requested deletion',
      requestedBy: req.user.email,
    });

    logger.info('Data deletion request processed', {
      userId: req.user.id,
      dataTypes,
      success: deletionResult.success,
      deletedCount: deletionResult.deletedItems.length,
    });

    res.json({
      success: true,
      data: deletionResult,
    });
  } catch (error) {
    logger.error('Data deletion failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Data deletion failed',
    });
  }
});

/**
 * Generate OTP for two-factor authentication
 */
router.post('/otp/generate', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const { purpose, phoneNumber } = req.body;

    if (!purpose) {
      res.status(400).json({
        success: false,
        error: 'OTP purpose is required',
      });
      return;
    }

    const otp = securityService.generateOTP(6);
    const otpId = securityService.generateSecureToken(16);

    // In a real implementation, you would:
    // 1. Store the OTP with expiration time
    // 2. Send the OTP via SMS or email
    // 3. Rate limit OTP generation

    logger.info('OTP generated', {
      userId: req.user.id,
      otpId,
      purpose,
      phoneNumber: phoneNumber ? phoneNumber.substring(0, 3) + '***' : undefined,
    });

    res.json({
      success: true,
      data: {
        otpId,
        message: 'OTP sent successfully',
        expiresIn: 300, // 5 minutes
      },
    });
  } catch (error) {
    logger.error('OTP generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'OTP generation failed',
    });
  }
});

/**
 * Verify OTP
 */
router.post('/otp/verify', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const { otpId, otp } = req.body;

    if (!otpId || !otp) {
      res.status(400).json({
        success: false,
        error: 'OTP ID and OTP are required',
      });
      return;
    }

    // In a real implementation, you would verify the OTP against stored value
    // For now, we'll simulate verification
    const isValid = otp.length === 6 && /^\d+$/.test(otp);

    if (!isValid) {
      logger.warn('Invalid OTP verification attempt', {
        userId: req.user.id,
        otpId,
      });

      res.status(400).json({
        success: false,
        error: 'Invalid OTP',
      });
      return;
    }

    logger.info('OTP verified successfully', {
      userId: req.user.id,
      otpId,
    });

    res.json({
      success: true,
      data: {
        message: 'OTP verified successfully',
        verified: true,
      },
    });
  } catch (error) {
    logger.error('OTP verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'OTP verification failed',
    });
  }
});

/**
 * Get security status
 */
router.get('/security-status', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const securityStatus = securityService.getSecurityStatus();

    res.json({
      success: true,
      data: securityStatus,
    });
  } catch (error) {
    logger.error('Failed to get security status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get security status',
    });
  }
});

export default router;