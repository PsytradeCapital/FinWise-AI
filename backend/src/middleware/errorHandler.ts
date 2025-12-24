import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { ...error, message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = { ...error, message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ');
    error = { ...error, message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { ...error, message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { ...error, message, statusCode: 401 };
  }

  // Firebase errors
  if (err.name === 'FirebaseError') {
    const message = 'Firebase service error';
    error = { ...error, message, statusCode: 503 };
  }

  // External API errors
  if (err.name === 'ExternalAPIError') {
    const message = 'External service unavailable';
    error = { ...error, message, statusCode: 503 };
  }

  // SMS parsing errors
  if (err.name === 'SMSParseError') {
    const message = 'Unable to parse SMS transaction';
    error = { ...error, message, statusCode: 400 };
  }

  // Transaction validation errors
  if (err.name === 'TransactionValidationError') {
    const message = 'Invalid transaction data';
    error = { ...error, message, statusCode: 400 };
  }

  // AI service errors
  if (err.name === 'AIServiceError') {
    const message = 'AI service temporarily unavailable';
    error = { ...error, message, statusCode: 503 };
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(isDevelopment && { 
      stack: error.stack,
      details: error,
    }),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  });
};

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not found - ${req.originalUrl}`) as AppError;
  error.statusCode = 404;
  next(error);
};

// Validation error helper
export const validationError = (message: string): AppError => {
  return createError(message, 400);
};

// Authentication error helper
export const authError = (message: string = 'Authentication required'): AppError => {
  return createError(message, 401);
};

// Authorization error helper
export const authorizationError = (message: string = 'Insufficient permissions'): AppError => {
  return createError(message, 403);
};

// Not found error helper
export const notFoundError = (resource: string = 'Resource'): AppError => {
  return createError(`${resource} not found`, 404);
};

// Service unavailable error helper
export const serviceUnavailableError = (service: string = 'Service'): AppError => {
  return createError(`${service} temporarily unavailable`, 503);
};