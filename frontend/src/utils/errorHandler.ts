import { Alert } from 'react-native';
import { logger } from './logger';

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handleError(error: any, context?: string): AppError {
    const appError: AppError = {
      code: this.getErrorCode(error),
      message: this.getErrorMessage(error),
      details: error,
      timestamp: new Date(),
    };

    // Log the error
    logger.error('Application Error', {
      context,
      error: appError,
    });

    // Show user-friendly message
    this.showUserError(appError);

    return appError;
  }

  private getErrorCode(error: any): string {
    if (error?.code) return error.code;
    if (error?.status) return `HTTP_${error.status}`;
    if (error?.name) return error.name;
    return 'UNKNOWN_ERROR';
  }

  private getErrorMessage(error: any): string {
    if (error?.message) return error.message;
    if (typeof error === 'string') return error;
    return 'An unexpected error occurred';
  }

  private showUserError(error: AppError): void {
    const userMessage = this.getUserFriendlyMessage(error);
    
    Alert.alert(
      'Error',
      userMessage,
      [
        {
          text: 'OK',
          style: 'default',
        },
      ]
    );
  }

  private getUserFriendlyMessage(error: AppError): string {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return 'Please check your internet connection and try again.';
      case 'HTTP_401':
        return 'Your session has expired. Please log in again.';
      case 'HTTP_403':
        return 'You do not have permission to perform this action.';
      case 'HTTP_404':
        return 'The requested resource was not found.';
      case 'HTTP_500':
        return 'Server error. Please try again later.';
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again.';
      case 'SMS_PARSE_ERROR':
        return 'Unable to parse transaction from SMS. You can add it manually.';
      case 'TRANSACTION_CREATE_ERROR':
        return 'Failed to create transaction. Please try again.';
      case 'GOAL_CREATE_ERROR':
        return 'Failed to create savings goal. Please try again.';
      case 'SYNC_ERROR':
        return 'Failed to sync data. Your changes will be saved locally.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }

  // Specific error handlers for different contexts
  handleNetworkError(error: any): AppError {
    return this.handleError({ ...error, code: 'NETWORK_ERROR' }, 'Network');
  }

  handleAuthError(error: any): AppError {
    return this.handleError({ ...error, code: 'AUTH_ERROR' }, 'Authentication');
  }

  handleTransactionError(error: any): AppError {
    return this.handleError({ ...error, code: 'TRANSACTION_ERROR' }, 'Transaction');
  }

  handleSyncError(error: any): AppError {
    return this.handleError({ ...error, code: 'SYNC_ERROR' }, 'Data Sync');
  }

  // Silent error handling (no user notification)
  handleSilentError(error: any, context?: string): AppError {
    const appError: AppError = {
      code: this.getErrorCode(error),
      message: this.getErrorMessage(error),
      details: error,
      timestamp: new Date(),
    };

    logger.error('Silent Application Error', {
      context,
      error: appError,
    });

    return appError;
  }
}

export const errorHandler = ErrorHandler.getInstance();