import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
// Note: @react-native-community/netinfo would need to be installed for full functionality
// For now, we'll use a simple connectivity check
import { syncService, SyncStatus } from '../services/syncService';

export interface UseSyncReturn {
  syncStatus: SyncStatus;
  performSync: () => Promise<void>;
  storeOfflineOperation: (
    operation: 'create' | 'update' | 'delete',
    collection: string,
    documentId: string,
    data: any
  ) => Promise<void>;
  getCachedData: (collection: string) => Promise<Record<string, any>>;
  clearSyncData: () => Promise<void>;
  isInitialized: boolean;
}

export const useSync = (apiBaseUrl: string, authToken: string, userId: string): UseSyncReturn => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    lastSyncTime: null,
    pendingOperations: 0,
    syncInProgress: false
  });
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Initialize sync service
   */
  const initializeSync = useCallback(async () => {
    try {
      if (!authToken || !userId) {
        console.log('Missing auth token or user ID, skipping sync initialization');
        return;
      }

      await syncService.initialize({
        apiBaseUrl,
        authToken,
        userId
      });

      setIsInitialized(true);
      
      // Get initial sync status
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);

      console.log('Sync service initialized');
    } catch (error) {
      console.error('Failed to initialize sync service:', error);
    }
  }, [apiBaseUrl, authToken, userId]);

  /**
   * Update sync status
   */
  const updateSyncStatus = useCallback(async () => {
    try {
      if (!isInitialized) return;
      
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to update sync status:', error);
    }
  }, [isInitialized]);

  /**
   * Perform manual sync
   */
  const performSync = useCallback(async () => {
    try {
      if (!isInitialized) {
        console.log('Sync service not initialized');
        return;
      }

      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));
      
      const status = await syncService.performFullSync();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to perform sync:', error);
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
    }
  }, [isInitialized]);

  /**
   * Store offline operation
   */
  const storeOfflineOperation = useCallback(async (
    operation: 'create' | 'update' | 'delete',
    collection: string,
    documentId: string,
    data: any
  ) => {
    try {
      if (!isInitialized) {
        console.log('Sync service not initialized, cannot store offline operation');
        return;
      }

      await syncService.storeOfflineOperation(operation, collection, documentId, data);
      await updateSyncStatus();
    } catch (error) {
      console.error('Failed to store offline operation:', error);
      throw error;
    }
  }, [isInitialized, updateSyncStatus]);

  /**
   * Get cached data
   */
  const getCachedData = useCallback(async (collection: string): Promise<Record<string, any>> => {
    try {
      if (!isInitialized) {
        console.log('Sync service not initialized, returning empty data');
        return {};
      }

      return await syncService.getCachedData(collection);
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return {};
    }
  }, [isInitialized]);

  /**
   * Clear all sync data
   */
  const clearSyncData = useCallback(async () => {
    try {
      if (!isInitialized) return;

      await syncService.clearAllData();
      await updateSyncStatus();
    } catch (error) {
      console.error('Failed to clear sync data:', error);
      throw error;
    }
  }, [isInitialized, updateSyncStatus]);

  /**
   * Handle app state changes
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && isInitialized) {
      // App became active, perform sync
      performSync();
    }
  }, [isInitialized, performSync]);

  /**
   * Handle network state changes
   */
  const handleNetworkStateChange = useCallback((state: any) => {
    if (state.isConnected && state.isInternetReachable && isInitialized) {
      // Network became available, perform sync
      performSync();
    }
    
    // Update sync status to reflect network changes
    updateSyncStatus();
  }, [isInitialized, performSync, updateSyncStatus]);

  // Initialize sync service on mount
  useEffect(() => {
    initializeSync();
  }, [initializeSync]);

  // Set up app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

  // Set up network state listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleNetworkStateChange);
    return unsubscribe;
  }, [handleNetworkStateChange]);

  // Periodic sync status updates
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(updateSyncStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [isInitialized, updateSyncStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      syncService.stopAutoSync();
    };
  }, []);

  return {
    syncStatus,
    performSync,
    storeOfflineOperation,
    getCachedData,
    clearSyncData,
    isInitialized
  };
};