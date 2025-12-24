import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export interface SyncConfig {
  apiBaseUrl: string;
  authToken: string;
  userId: string;
  deviceId: string;
}

export interface OfflineOperation {
  id: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data: any;
  timestamp: Date;
  retryCount: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  pendingOperations: number;
  syncInProgress: boolean;
}

export class SyncService {
  private config: SyncConfig | null = null;
  private syncInProgress = false;
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private readonly AUTO_SYNC_INTERVAL = 30000; // 30 seconds
  private readonly STORAGE_KEYS = {
    OFFLINE_OPERATIONS: 'offline_operations',
    CACHED_DATA: 'cached_data',
    LAST_SYNC: 'last_sync_timestamp',
    DEVICE_ID: 'device_id'
  };

  /**
   * Initialize sync service with configuration
   */
  async initialize(config: Omit<SyncConfig, 'deviceId'>): Promise<void> {
    try {
      // Get or generate device ID
      let deviceId = await AsyncStorage.getItem(this.STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        deviceId = await DeviceInfo.getUniqueId();
        await AsyncStorage.setItem(this.STORAGE_KEYS.DEVICE_ID, deviceId);
      }

      this.config = {
        ...config,
        deviceId
      };

      // Register device with backend
      await this.registerDevice();

      // Start auto sync
      this.startAutoSync();

      console.log('Sync service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize sync service:', error);
      throw error;
    }
  }

  /**
   * Register device with backend
   */
  private async registerDevice(): Promise<void> {
    if (!this.config) throw new Error('Sync service not initialized');

    try {
      const appVersion = DeviceInfo.getVersion();
      const platform = Platform.OS;

      const response = await fetch(`${this.config.apiBaseUrl}/sync/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: JSON.stringify({
          deviceId: this.config.deviceId,
          platform,
          appVersion
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register device');
      }

      console.log('Device registered successfully');
    } catch (error) {
      console.error('Failed to register device:', error);
      // Don't throw error here as the app should still work offline
    }
  }

  /**
   * Store operation for offline sync
   */
  async storeOfflineOperation(
    operation: 'create' | 'update' | 'delete',
    collection: string,
    documentId: string,
    data: any
  ): Promise<void> {
    try {
      const operations = await this.getOfflineOperations();
      
      const newOperation: OfflineOperation = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        operation,
        collection,
        documentId,
        data,
        timestamp: new Date(),
        retryCount: 0
      };

      operations.push(newOperation);
      await AsyncStorage.setItem(this.STORAGE_KEYS.OFFLINE_OPERATIONS, JSON.stringify(operations));

      // Update local cache
      await this.updateLocalCache(collection, documentId, data, operation);

      console.log(`Offline operation stored: ${operation} on ${collection}/${documentId}`);
    } catch (error) {
      console.error('Failed to store offline operation:', error);
      throw error;
    }
  }

  /**
   * Get all offline operations
   */
  private async getOfflineOperations(): Promise<OfflineOperation[]> {
    try {
      const operationsJson = await AsyncStorage.getItem(this.STORAGE_KEYS.OFFLINE_OPERATIONS);
      return operationsJson ? JSON.parse(operationsJson) : [];
    } catch (error) {
      console.error('Failed to get offline operations:', error);
      return [];
    }
  }

  /**
   * Update local cache with data changes
   */
  private async updateLocalCache(
    collection: string,
    documentId: string,
    data: any,
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    try {
      const cacheKey = `${this.STORAGE_KEYS.CACHED_DATA}_${collection}`;
      const cachedDataJson = await AsyncStorage.getItem(cacheKey);
      const cachedData = cachedDataJson ? JSON.parse(cachedDataJson) : {};

      switch (operation) {
        case 'create':
        case 'update':
          cachedData[documentId] = {
            ...data,
            lastModified: new Date().toISOString(),
            isLocalChange: true
          };
          break;
        case 'delete':
          delete cachedData[documentId];
          break;
      }

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData));
    } catch (error) {
      console.error('Failed to update local cache:', error);
    }
  }

  /**
   * Get cached data for a collection
   */
  async getCachedData(collection: string): Promise<Record<string, any>> {
    try {
      const cacheKey = `${this.STORAGE_KEYS.CACHED_DATA}_${collection}`;
      const cachedDataJson = await AsyncStorage.getItem(cacheKey);
      return cachedDataJson ? JSON.parse(cachedDataJson) : {};
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return {};
    }
  }

  /**
   * Check if device is online
   */
  async isOnline(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected === true && netInfo.isInternetReachable === true;
    } catch (error) {
      console.error('Failed to check network status:', error);
      return false;
    }
  }

  /**
   * Sync offline operations to server
   */
  async syncOfflineOperations(): Promise<{ synced: number; failed: number }> {
    if (!this.config) throw new Error('Sync service not initialized');

    try {
      const operations = await this.getOfflineOperations();
      if (operations.length === 0) {
        return { synced: 0, failed: 0 };
      }

      let syncedCount = 0;
      let failedCount = 0;
      const remainingOperations: OfflineOperation[] = [];

      for (const operation of operations) {
        try {
          // Send operation to server
          const response = await fetch(`${this.config.apiBaseUrl}/sync/offline/operations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.authToken}`
            },
            body: JSON.stringify({
              operation: operation.operation,
              collection: operation.collection,
              documentId: operation.documentId,
              data: operation.data,
              deviceId: this.config.deviceId
            })
          });

          if (response.ok) {
            syncedCount++;
            console.log(`Synced operation: ${operation.id}`);
          } else {
            throw new Error(`Server responded with status: ${response.status}`);
          }
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
          operation.retryCount++;
          
          // Keep operation for retry if under max attempts
          if (operation.retryCount < 3) {
            remainingOperations.push(operation);
          }
          failedCount++;
        }
      }

      // Update stored operations with remaining ones
      await AsyncStorage.setItem(this.STORAGE_KEYS.OFFLINE_OPERATIONS, JSON.stringify(remainingOperations));

      return { synced: syncedCount, failed: failedCount };
    } catch (error) {
      console.error('Failed to sync offline operations:', error);
      throw error;
    }
  }

  /**
   * Fetch remote changes and update local cache
   */
  async fetchRemoteChanges(): Promise<void> {
    if (!this.config) throw new Error('Sync service not initialized');

    try {
      const lastSyncTime = await this.getLastSyncTime();
      const sinceParam = lastSyncTime ? lastSyncTime.toISOString() : '';

      const response = await fetch(
        `${this.config.apiBaseUrl}/sync/devices/${this.config.deviceId}/changes?since=${sinceParam}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.authToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch remote changes: ${response.status}`);
      }

      const result = await response.json();
      const changes = result.data;

      // Update local cache with remote changes
      for (const [collection, items] of Object.entries(changes)) {
        if (Array.isArray(items)) {
          const cacheKey = `${this.STORAGE_KEYS.CACHED_DATA}_${collection}`;
          const cachedData = await this.getCachedData(collection);

          for (const item of items) {
            // Don't overwrite local changes
            if (!cachedData[item.id]?.isLocalChange) {
              cachedData[item.id] = {
                ...item,
                isLocalChange: false
              };
            }
          }

          await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData));
        }
      }

      console.log('Remote changes fetched and applied');
    } catch (error) {
      console.error('Failed to fetch remote changes:', error);
      throw error;
    }
  }

  /**
   * Perform full sync (offline operations + remote changes)
   */
  async performFullSync(): Promise<SyncStatus> {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return this.getSyncStatus();
    }

    this.syncInProgress = true;

    try {
      const isOnline = await this.isOnline();
      if (!isOnline) {
        console.log('Device is offline, skipping sync');
        return this.getSyncStatus();
      }

      // Update device activity
      await this.updateDeviceActivity();

      // Sync offline operations
      const syncResult = await this.syncOfflineOperations();

      // Fetch remote changes
      await this.fetchRemoteChanges();

      // Update last sync time
      await this.updateLastSyncTime();

      console.log(`Full sync completed. Synced: ${syncResult.synced}, Failed: ${syncResult.failed}`);
    } catch (error) {
      console.error('Failed to perform full sync:', error);
    } finally {
      this.syncInProgress = false;
    }

    return this.getSyncStatus();
  }

  /**
   * Update device activity on server
   */
  private async updateDeviceActivity(): Promise<void> {
    if (!this.config) return;

    try {
      await fetch(`${this.config.apiBaseUrl}/sync/devices/${this.config.deviceId}/activity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`
        }
      });
    } catch (error) {
      console.error('Failed to update device activity:', error);
    }
  }

  /**
   * Get last sync timestamp
   */
  private async getLastSyncTime(): Promise<Date | null> {
    try {
      const timestamp = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error('Failed to get last sync time:', error);
      return null;
    }
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Failed to update last sync time:', error);
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const isOnline = await this.isOnline();
      const lastSyncTime = await this.getLastSyncTime();
      const operations = await this.getOfflineOperations();

      return {
        isOnline,
        lastSyncTime,
        pendingOperations: operations.length,
        syncInProgress: this.syncInProgress
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        isOnline: false,
        lastSyncTime: null,
        pendingOperations: 0,
        syncInProgress: false
      };
    }
  }

  /**
   * Start automatic sync
   */
  private startAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    this.autoSyncInterval = setInterval(async () => {
      try {
        await this.performFullSync();
      } catch (error) {
        console.error('Auto sync failed:', error);
      }
    }, this.AUTO_SYNC_INTERVAL);

    console.log('Auto sync started');
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      console.log('Auto sync stopped');
    }
  }

  /**
   * Clear all cached data and offline operations
   */
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.STORAGE_KEYS.OFFLINE_OPERATIONS,
        this.STORAGE_KEYS.LAST_SYNC
      ]);

      // Clear all cached data
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.STORAGE_KEYS.CACHED_DATA));
      await AsyncStorage.multiRemove(cacheKeys);

      console.log('All sync data cleared');
    } catch (error) {
      console.error('Failed to clear sync data:', error);
      throw error;
    }
  }
}

export const syncService = new SyncService();