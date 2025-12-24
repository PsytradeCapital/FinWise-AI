import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { dataSyncService } from './dataSyncService';

export interface OfflineOperation {
  id: string;
  userId: string;
  deviceId: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'synced' | 'failed';
}

export interface OfflineCache {
  userId: string;
  collection: string;
  data: Record<string, any>;
  lastUpdated: Date;
  version: number;
}

export class OfflineDataService {
  private readonly OFFLINE_COLLECTIONS = {
    operations: 'offline_operations',
    cache: 'offline_cache'
  };

  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 5000;

  /**
   * Store an offline operation to be synced later
   */
  async storeOfflineOperation(operation: Omit<OfflineOperation, 'id' | 'retryCount' | 'status'>): Promise<string> {
    try {
      const operationRef = db.collection(this.OFFLINE_COLLECTIONS.operations).doc();
      
      const offlineOperation: OfflineOperation = {
        id: operationRef.id,
        ...operation,
        retryCount: 0,
        status: 'pending'
      };

      await operationRef.set(offlineOperation);

      logger.info(`Offline operation stored: ${operation.operation} on ${operation.collection}/${operation.documentId}`);
      return operationRef.id;
    } catch (error) {
      logger.error('Failed to store offline operation:', error);
      throw error;
    }
  }

  /**
   * Get all pending offline operations for a user
   */
  async getPendingOfflineOperations(userId: string, deviceId?: string): Promise<OfflineOperation[]> {
    try {
      let query = db.collection(this.OFFLINE_COLLECTIONS.operations)
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'asc');

      if (deviceId) {
        query = query.where('deviceId', '==', deviceId);
      }

      const snapshot = await query.get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as OfflineOperation));
    } catch (error) {
      logger.error('Failed to get pending offline operations:', error);
      throw error;
    }
  }

  /**
   * Sync pending offline operations to Firebase
   */
  async syncOfflineOperations(userId: string, deviceId: string): Promise<{ synced: number; failed: number }> {
    try {
      const pendingOperations = await this.getPendingOfflineOperations(userId, deviceId);
      let syncedCount = 0;
      let failedCount = 0;

      for (const operation of pendingOperations) {
        try {
          await this.executeOfflineOperation(operation);
          await this.markOperationSynced(operation.id);
          syncedCount++;
        } catch (error) {
          logger.error(`Failed to sync operation ${operation.id}:`, error);
          await this.incrementRetryCount(operation.id);
          failedCount++;
        }
      }

      logger.info(`Offline sync completed: ${syncedCount} synced, ${failedCount} failed`);
      return { synced: syncedCount, failed: failedCount };
    } catch (error) {
      logger.error('Failed to sync offline operations:', error);
      throw error;
    }
  }

  /**
   * Execute a single offline operation
   */
  private async executeOfflineOperation(operation: OfflineOperation): Promise<void> {
    const docRef = db.collection(operation.collection).doc(operation.documentId);

    switch (operation.operation) {
      case 'create':
        await docRef.set({
          ...operation.data,
          createdAt: operation.timestamp,
          lastModified: new Date(),
          version: 1
        });
        break;

      case 'update':
        // Check for conflicts before updating
        const existingDoc = await docRef.get();
        if (existingDoc.exists) {
          const existingData = existingDoc.data();
          const localData = { ...operation.data, lastModified: operation.timestamp };
          const remoteData = existingData;

          // Resolve conflicts if versions differ
          if (existingData?.version && operation.data.version && existingData.version !== operation.data.version) {
            const resolution = await dataSyncService.resolveConflicts(
              operation.collection,
              operation.documentId,
              localData,
              remoteData
            );
            
            await docRef.update({
              ...resolution.resolvedData,
              lastModified: new Date(),
              version: db.FieldValue.increment(1)
            });
          } else {
            await docRef.update({
              ...operation.data,
              lastModified: new Date(),
              version: db.FieldValue.increment(1)
            });
          }
        } else {
          // Document doesn't exist, create it
          await docRef.set({
            ...operation.data,
            createdAt: operation.timestamp,
            lastModified: new Date(),
            version: 1
          });
        }
        break;

      case 'delete':
        await docRef.delete();
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.operation}`);
    }

    // Sync to other devices
    await dataSyncService.syncDataToDevices(
      operation.userId,
      operation.collection,
      operation.documentId,
      operation.data,
      operation.deviceId
    );
  }

  /**
   * Mark an offline operation as synced
   */
  private async markOperationSynced(operationId: string): Promise<void> {
    try {
      await db.collection(this.OFFLINE_COLLECTIONS.operations)
        .doc(operationId)
        .update({
          status: 'synced',
          syncedAt: new Date()
        });
    } catch (error) {
      logger.error('Failed to mark operation as synced:', error);
      throw error;
    }
  }

  /**
   * Increment retry count for failed operation
   */
  private async incrementRetryCount(operationId: string): Promise<void> {
    try {
      const operationRef = db.collection(this.OFFLINE_COLLECTIONS.operations).doc(operationId);
      const operationDoc = await operationRef.get();
      
      if (!operationDoc.exists) {
        throw new Error('Operation not found');
      }

      const operation = operationDoc.data() as OfflineOperation;
      const newRetryCount = operation.retryCount + 1;

      if (newRetryCount >= this.MAX_RETRY_ATTEMPTS) {
        await operationRef.update({
          status: 'failed',
          retryCount: newRetryCount,
          failedAt: new Date()
        });
      } else {
        await operationRef.update({
          retryCount: newRetryCount,
          nextRetryAt: new Date(Date.now() + this.RETRY_DELAY_MS * newRetryCount)
        });
      }
    } catch (error) {
      logger.error('Failed to increment retry count:', error);
      throw error;
    }
  }

  /**
   * Cache data locally for offline access
   */
  async cacheDataLocally(userId: string, collection: string, data: Record<string, any>): Promise<void> {
    try {
      const cacheRef = db.collection(this.OFFLINE_COLLECTIONS.cache)
        .doc(`${userId}_${collection}`);

      const cacheData: OfflineCache = {
        userId,
        collection,
        data,
        lastUpdated: new Date(),
        version: 1
      };

      await cacheRef.set(cacheData);

      logger.info(`Data cached locally for user ${userId}, collection ${collection}`);
    } catch (error) {
      logger.error('Failed to cache data locally:', error);
      throw error;
    }
  }

  /**
   * Get cached data for offline access
   */
  async getCachedData(userId: string, collection: string): Promise<Record<string, any> | null> {
    try {
      const cacheDoc = await db.collection(this.OFFLINE_COLLECTIONS.cache)
        .doc(`${userId}_${collection}`)
        .get();

      if (!cacheDoc.exists) {
        return null;
      }

      const cacheData = cacheDoc.data() as OfflineCache;
      return cacheData.data;
    } catch (error) {
      logger.error('Failed to get cached data:', error);
      throw error;
    }
  }

  /**
   * Update cached data with new changes
   */
  async updateCachedData(
    userId: string, 
    collection: string, 
    documentId: string, 
    data: any, 
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    try {
      const cachedData = await this.getCachedData(userId, collection) || {};

      switch (operation) {
        case 'create':
        case 'update':
          cachedData[documentId] = data;
          break;
        case 'delete':
          delete cachedData[documentId];
          break;
      }

      await this.cacheDataLocally(userId, collection, cachedData);
    } catch (error) {
      logger.error('Failed to update cached data:', error);
      throw error;
    }
  }

  /**
   * Check if device is online and can sync
   */
  async isOnlineAndCanSync(): Promise<boolean> {
    try {
      // Try to read a small document from Firebase to test connectivity
      const testRef = db.collection('_connection_test').doc('test');
      await testRef.get();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Perform automatic sync when device comes online
   */
  async performAutoSync(userId: string, deviceId: string): Promise<void> {
    try {
      const isOnline = await this.isOnlineAndCanSync();
      if (!isOnline) {
        logger.warn('Device is offline, skipping auto sync');
        return;
      }

      // Update device activity
      await dataSyncService.updateDeviceActivity(deviceId);

      // Sync pending offline operations
      const syncResult = await this.syncOfflineOperations(userId, deviceId);

      // Get and apply remote changes
      const lastSyncTimestamp = await this.getLastSyncTimestamp(userId, deviceId);
      if (lastSyncTimestamp) {
        const remoteChanges = await dataSyncService.getDataChangesSinceLastSync(
          userId, 
          deviceId, 
          lastSyncTimestamp
        );

        // Update local cache with remote changes
        for (const [collection, changes] of Object.entries(remoteChanges)) {
          for (const change of changes) {
            await this.updateCachedData(userId, collection, change.id, change, 'update');
          }
        }
      }

      // Update last sync timestamp
      await this.updateLastSyncTimestamp(userId, deviceId);

      logger.info(`Auto sync completed for user ${userId}, device ${deviceId}. Synced: ${syncResult.synced}, Failed: ${syncResult.failed}`);
    } catch (error) {
      logger.error('Failed to perform auto sync:', error);
      throw error;
    }
  }

  /**
   * Get last sync timestamp for a device
   */
  private async getLastSyncTimestamp(userId: string, deviceId: string): Promise<Date | null> {
    try {
      const syncDoc = await db.collection('sync_timestamps')
        .doc(`${userId}_${deviceId}`)
        .get();

      if (!syncDoc.exists) {
        return null;
      }

      return syncDoc.data()?.lastSync?.toDate() || null;
    } catch (error) {
      logger.error('Failed to get last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Update last sync timestamp for a device
   */
  private async updateLastSyncTimestamp(userId: string, deviceId: string): Promise<void> {
    try {
      await db.collection('sync_timestamps')
        .doc(`${userId}_${deviceId}`)
        .set({
          userId,
          deviceId,
          lastSync: new Date()
        });
    } catch (error) {
      logger.error('Failed to update last sync timestamp:', error);
      throw error;
    }
  }

  /**
   * Clean up old offline operations and cache
   */
  async cleanupOfflineData(): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Clean up synced operations older than 7 days
      const oldOperations = await db.collection(this.OFFLINE_COLLECTIONS.operations)
        .where('status', '==', 'synced')
        .where('syncedAt', '<', sevenDaysAgo)
        .get();

      // Clean up failed operations older than 7 days
      const failedOperations = await db.collection(this.OFFLINE_COLLECTIONS.operations)
        .where('status', '==', 'failed')
        .where('failedAt', '<', sevenDaysAgo)
        .get();

      const batch = db.batch();
      
      oldOperations.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      failedOperations.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info(`Cleaned up ${oldOperations.size + failedOperations.size} old offline operations`);
    } catch (error) {
      logger.error('Failed to cleanup offline data:', error);
      throw error;
    }
  }
}

export const offlineDataService = new OfflineDataService();