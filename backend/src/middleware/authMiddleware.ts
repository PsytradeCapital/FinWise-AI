import { Request, Response, NextFunction } from 'express';
import { securityService } from '../services/securityService';
import { logger } from '../utils/logger';

/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  deviceId?: string;
  ipAddress?: string;
}

/**
 * JWT Authentication Middleware
 */
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token is required',
      });
      return;
    }

    const decoded = securityService.verifyJWT(token);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
    };

    // Extract additional request metadata
    req.deviceId = req.headers['x-device-id'] as string;
    req.ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    logger.info('User authenticated successfully', {
      userId: req.user.id,
      role: req.user.role,
      deviceId: req.deviceId,
      ipAddress: req.ipAddress,
    });

    next();
  } catch (error) {
    logger.error('JWT authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: req.headers.authorization ? 'present' : 'missing',
    });

    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

/**
 * Optional JWT Authentication (doesn't fail if no token)
 */
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = securityService.verifyJWT(token);
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role || 'user',
          permissions: decoded.permissions || [],
        };

        req.deviceId = req.headers['x-device-id'] as string;
        req.ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

        logger.info('Optional authentication successful', {
          userId: req.user.id,
          role: req.user.role,
        });
      } catch (error) {
        logger.warn('Optional authentication failed, continuing without auth', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(); // Continue without authentication
  }
};

/**
 * Role-based Authorization Middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });

      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    logger.info('Role authorization successful', {
      userId: req.user.id,
      role: req.user.role,
      requiredRoles: allowedRoles,
    });

    next();
  };
};

/**
 * Permission-based Authorization Middleware
 */
export const requirePermission = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const hasPermission = requiredPermissions.every(permission =>
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn('Access denied - insufficient permissions', {
        userId: req.user.id,
        userPermissions: req.user.permissions,
        requiredPermissions,
      });

      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    logger.info('Permission authorization successful', {
      userId: req.user.id,
      requiredPermissions,
    });

    next();
  };
};

/**
 * Rate Limiting Middleware
 */
export const rateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const identifier = req.user?.id || req.ipAddress || 'anonymous';
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }

    const userRequests = requests.get(identifier);
    
    if (!userRequests) {
      requests.set(identifier, { count: 1, resetTime: now + options.windowMs });
      next();
      return;
    }

    if (userRequests.count >= options.maxRequests) {
      logger.warn('Rate limit exceeded', {
        identifier,
        count: userRequests.count,
        maxRequests: options.maxRequests,
        windowMs: options.windowMs,
      });

      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
      });
      return;
    }

    userRequests.count++;
    next();
  };
};

/**
 * Fraud Detection Middleware
 */
export const fraudDetection = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // This middleware would typically run on financial transactions
  // For now, we'll add basic suspicious activity detection

  const suspiciousPatterns = [
    // Check for rapid requests
    req.headers['x-rapid-requests'] === 'true',
    // Check for unusual user agent
    !req.headers['user-agent'] || req.headers['user-agent'].includes('bot'),
    // Check for missing device ID on mobile requests
    req.headers['x-platform'] === 'mobile' && !req.headers['x-device-id'],
  ];

  const suspiciousCount = suspiciousPatterns.filter(Boolean).length;

  if (suspiciousCount >= 2) {
    logger.warn('Suspicious activity detected', {
      userId: req.user?.id,
      ipAddress: req.ipAddress,
      userAgent: req.headers['user-agent'],
      deviceId: req.deviceId,
      suspiciousCount,
    });

    // In a real implementation, you might:
    // 1. Require additional authentication
    // 2. Temporarily block the request
    // 3. Flag for manual review
    
    res.status(429).json({
      success: false,
      error: 'Additional verification required',
      code: 'SUSPICIOUS_ACTIVITY',
    });
    return;
  }

  next();
};

/**
 * Biometric Authentication Middleware
 */
export const requireBiometric = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const biometricToken = req.headers['x-biometric-token'] as string;
  const biometricType = req.headers['x-biometric-type'] as string;

  if (!biometricToken || !biometricType) {
    res.status(401).json({
      success: false,
      error: 'Biometric authentication required',
      requiredHeaders: ['x-biometric-token', 'x-biometric-type'],
    });
    return;
  }

  // In a real implementation, you would verify the biometric token
  // For now, we'll do basic validation
  if (biometricToken.length < 10) {
    res.status(401).json({
      success: false,
      error: 'Invalid biometric token',
    });
    return;
  }

  logger.info('Biometric authentication successful', {
    userId: req.user?.id,
    biometricType,
    deviceId: req.deviceId,
  });

  next();
};

/**
 * Security Headers Middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

/**
 * Request Logging Middleware
 */
export const requestLogger = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ipAddress || req.ip,
    userId: req.user?.id,
    deviceId: req.deviceId,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
    });
  });

  next();
};