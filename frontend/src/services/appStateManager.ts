import { store } from '../store';
import { apiService } from './apiService';
import { errorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { 
  loginUser, 
  registerUser, 
  logoutUser 
} from '../store/thunks/authThunks';
import { 
  fetchTransactions, 
  parseSMSTransaction, 
  createManualTransaction 
} from '../store/thunks/transactionThunks';
import { fetchGoals } from '../store/thunks/goalThunks';
import { Transaction, User, SavingsGoal } from '@finwise-ai/shared';

export class AppStateManager {
  private static instance: AppStateManager;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): AppStateManager {
    if (!AppStateManager.instance) {
      AppStateManager.instance = new AppStateManager();
    }
    return AppStateManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing AppStateManager');
      
      // Check if user is already authenticated
      const state = store.getState();
      if (state.auth.token) {
        apiService.setToken(state.auth.token);
        await this.loadUserData(state.auth.user?.id);
      }

      this.isInitialized = true;
      logger.info('AppStateManager initialized successfully');
    } catch (error) {
      errorHandler.handleSilentError(error, 'AppStateManager.initialize');
    }
  }

  // Authentication Flow
  async login(email: string, password: string): Promise<boolean> {
    try {
      logger.info('Starting login process', { email });
      
      const result = await store.dispatch(loginUser({ email, password }));
      
      if (loginUser.fulfilled.match(result)) {
        await this.loadUserData(result.payload.user.id);
        logger.info('Login successful');
        return true;
      } else {
        logger.warn('Login failed', { error: result.payload });
        return false;
      }
    } catch (error) {
      errorHandler.handleAuthError(error);
      return false;
    }
  }

  async register(userData: {
    email: string;
    password: string;
    phoneNumber: string;
    country: string;
  }): Promise<boolean> {
    try {
      logger.info('Starting registration process', { email: userData.email });
      
      const result = await store.dispatch(registerUser(userData));
      
      if (registerUser.fulfilled.match(result)) {
        await this.loadUserData(result.payload.user.id);
        logger.info('Registration successful');
        return true;
      } else {
        logger.warn('Registration failed', { error: result.payload });
        return false;
      }
    } catch (error) {
      errorHandler.handleAuthError(error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      logger.info('Starting logout process');
      await store.dispatch(logoutUser());
      logger.info('Logout successful');
    } catch (error) {
      errorHandler.handleAuthError(error);
    }
  }

  // Data Loading
  private async loadUserData(userId?: string): Promise<void> {
    if (!userId) return;

    try {
      logger.info('Loading user data', { userId });
      
      // Load transactions, goals, and other user data in parallel
      await Promise.allSettled([
        store.dispatch(fetchTransactions(userId)),
        store.dispatch(fetchGoals(userId)),
        // Add other data loading as needed
      ]);

      logger.info('User data loaded successfully');
    } catch (error) {
      errorHandler.handleSilentError(error, 'AppStateManager.loadUserData');
    }
  }

  // Transaction Flow
  async handleSMSTransaction(smsContent: string, phoneNumber?: string): Promise<Transaction | null> {
    try {
      const state = store.getState();
      const userId = state.auth.user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Processing SMS transaction', { userId });
      
      const result = await store.dispatch(parseSMSTransaction({
        smsContent,
        userId,
        phoneNumber,
      }));

      if (parseSMSTransaction.fulfilled.match(result)) {
        logger.info('SMS transaction processed successfully');
        
        // Trigger categorization popup if needed
        this.triggerCategorizationPopup(result.payload);
        
        return result.payload;
      } else {
        logger.warn('SMS transaction processing failed', { error: result.payload });
        return null;
      }
    } catch (error) {
      errorHandler.handleTransactionError(error);
      return null;
    }
  }

  async createManualTransactionFlow(transactionData: {
    amount: number;
    description: string;
    category?: string;
    timestamp?: Date;
    merchant?: string;
  }): Promise<Transaction | null> {
    try {
      const state = store.getState();
      const userId = state.auth.user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Creating manual transaction', { userId });
      
      const result = await store.dispatch(createManualTransaction({
        ...transactionData,
        userId,
      }));

      if (createManualTransaction.fulfilled.match(result)) {
        logger.info('Manual transaction created successfully');
        return result.payload;
      } else {
        logger.warn('Manual transaction creation failed', { error: result.payload });
        return null;
      }
    } catch (error) {
      errorHandler.handleTransactionError(error);
      return null;
    }
  }

  // Categorization Flow
  private triggerCategorizationPopup(transaction: Transaction): void {
    // This would trigger the categorization popup component
    // For now, we'll just log it
    logger.info('Triggering categorization popup', { transactionId: transaction.id });
    
    // In a real implementation, this might dispatch an action to show the popup
    // or use a navigation service to show a modal
  }

  // Savings Flow
  async triggerSavingsOffer(transaction: Transaction): Promise<void> {
    try {
      logger.info('Triggering savings offer', { transactionId: transaction.id });
      
      // This would integrate with the savings automator service
      // For now, we'll just log it
      
      // In a real implementation, this would:
      // 1. Calculate optimal savings amount
      // 2. Show savings offer popup
      // 3. Handle user acceptance/rejection
      // 4. Execute transfer if accepted
      
    } catch (error) {
      errorHandler.handleSilentError(error, 'AppStateManager.triggerSavingsOffer');
    }
  }

  // Data Sync Flow
  async syncData(): Promise<void> {
    try {
      const state = store.getState();
      const userId = state.auth.user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Starting data sync', { userId });
      
      // Sync with server
      await apiService.syncData(userId);
      
      // Reload user data
      await this.loadUserData(userId);
      
      logger.info('Data sync completed successfully');
    } catch (error) {
      errorHandler.handleSyncError(error);
    }
  }

  // Health Check
  async performHealthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/health`);
      const isHealthy = response.ok;
      
      logger.info('Health check completed', { isHealthy });
      return isHealthy;
    } catch (error) {
      logger.warn('Health check failed', { error });
      return false;
    }
  }

  // Get current application state
  getAppState() {
    return store.getState();
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const state = store.getState();
    return state.auth.isAuthenticated;
  }

  // Get current user
  getCurrentUser(): User | null {
    const state = store.getState();
    return state.auth.user;
  }
}

export const appStateManager = AppStateManager.getInstance();