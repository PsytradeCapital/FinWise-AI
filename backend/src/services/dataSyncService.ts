import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';
import { 
  User, 
  Transaction, 
  SavingsGoal, 
  SpendingPattern,
  MoneyStory,
  Category,
  Notification
} from '../../../shared/src/types';

export interface SyncableData {
  id: string;
  userId: string;
  lastModified: Date;
  version: number;
  deviceId?: string;
}

export interface ConflictResolution {
  strategy: 'latest_wins' | 'merge' | 'user_choice';
  resolvedData: any;
  conflictedFields: string[];
}

export interface DeviceInfo {
  deviceId: string;
  userId: string;
  platform: 'ios' | 'android' | 'web';
  lastSeen: Date;
  isActive: boolean;
  appVersion: string;
}

export class DataSyncService {
  private readonly COLLECTIONS = {
    users: 'users',
    transactions: 'transactions',
    goals: 'goals',
    patterns: 'patterns',
    stories: 'stories',
    categories: 'categories',
    notifications: 'notifications',
    devices: 'devices',
    syncLog: 'sync_log'
  };

  /**
   * Register a device for a user
   */
  async registerDevice(deviceInfo: DeviceInfo): Promise<void> {
    try {
      const deviceRef = db.collection(this.COLLECTIONS.devices).doc(deviceInfo.deviceId);
      
      await deviceRef.set({
        ...deviceInfo,
        registeredAt: new Date(),
        lastSeen: new Date()
      });

      logger.info(`Device ${deviceInfo.deviceId} registered for user ${deviceInfo.userId}`);
    } catch (error) {
      logger.error('Failed to register device:', error);
      throw error;
    }
  }

  /**
   * Update device last seen timestamp
   */
  async updateDeviceActivity(deviceId: string): Promise<void> {
    try {
      const deviceRef = db.collection(this.COLLECTIONS.devices).doc(deviceId);
      
      await deviceRef.update({
        lastSeen: new Date(),
        isActive: true
      });
    } catch (error) {
      logger.error('Failed to update device activity:', error);
      throw error;
    }
  }

  /**
   * Get all active devices for a user
   */
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      const snapshot = await db.collection(this.COLLECTIONS.devices)
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      return snapshot.docs.map(doc => ({
        deviceId: doc.id,
        ...doc.data()
      } as DeviceInfo));
    } catch (error) {
      logger.error('Failed to get user devices:', error);
      throw error;
    }
  }

  /**
   * Sync data changes to all user devices
   */
  async syncDataToDevices(
    userId: string, 
    collection: string, 
    documentId: string, 
    data: any,
    sourceDeviceId?: string
  ): Promise<void> {
    try {
      const userDevices = await this.getUserDevices(userId);
      const targetDevices = userDevices.filter(device => device.deviceId !== sourceDeviceId);

      // Create sync log entry
      const syncLogRef = db.collection(this.COLLECTIONS.syncLog).doc();
      await syncLogRef.set({
        userId,
        collection,
        documentId,
        operation: 'update',
        timestamp: new Date(),
        sourceDevice: sourceDeviceId,
        targetDevices: targetDevices.map(d => d.deviceId),
        status: 'pending'
      });

      // Update the document with sync metadata
      const docRef = db.collection(collection).doc(documentId);
      await docRef.update({
        ...data,
        lastModified: new Date(),
        version: FieldValue.increment(1),
        syncedDevices: targetDevices.map(d => d.deviceId)
      });

      // Mark sync as completed
      await syncLogRef.update({ status: 'completed' });

      logger.info(`Data synced to ${targetDevices.length} devices for user ${userId}`);
    } catch (error) {
      logger.error('Failed to sync data to devices:', error);
      throw error;
    }
  }

  /**
   * Detect and resolve conflicts between concurrent edits
   */
  async resolveConflicts(
    collection: string,
    documentId: string,
    localData: SyncableData,
    remoteData: SyncableData
  ): Promise<ConflictResolution> {
    try {
      // If versions are the same, no conflict
      if (localData.version === remoteData.version) {
        return {
          strategy: 'latest_wins',
          resolvedData: localData.lastModified > remoteData.lastModified ? localData : remoteData,
          conflictedFields: []
        };
      }

      // Find conflicted fields
      const conflictedFields = this.findConflictedFields(localData, remoteData);
      
      // Apply latest wins strategy for now
      const resolvedData = localData.lastModified > remoteData.lastModified ? localData : remoteData;

      // Log conflict resolution
      await db.collection('conflict_log').add({
        collection,
        documentId,
        localVersion: localData.version,
        remoteVersion: remoteData.version,
        conflictedFields,
        resolution: 'latest_wins',
        resolvedAt: new Date()
      });

      return {
        strategy: 'latest_wins',
        resolvedData,
        conflictedFields
      };
    } catch (error) {
      logger.error('Failed to resolve conflicts:', error);
      throw error;
    }
  }

  /**
   * Find fields that have conflicts between local and remote data
   */
  private findConflictedFields(localData: any, remoteData: any): string[] {
    const conflictedFields: string[] = [];
    const excludeFields = ['id', 'lastModified', 'version', 'syncedDevices'];

    for (const key in localData) {
      if (excludeFields.includes(key)) continue;
      
      if (localData[key] !== remoteData[key]) {
        conflictedFields.push(key);
      }
    }

    return conflictedFields;
  }

  /**
   * Get pending sync operations for a device
   */
  async getPendingSyncOperations(deviceId: string, userId: string): Promise<any[]> {
    try {
      const snapshot = await db.collection(this.COLLECTIONS.syncLog)
        .where('userId', '==', userId)
        .where('targetDevices', 'array-contains', deviceId)
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'asc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to get pending sync operations:', error);
      throw error;
    }
  }

  /**
   * Mark sync operation as completed for a device
   */
  async markSyncCompleted(syncLogId: string, deviceId: string): Promise<void> {
    try {
      const syncLogRef = db.collection(this.COLLECTIONS.syncLog).doc(syncLogId);
      const syncDoc = await syncLogRef.get();
      
      if (!syncDoc.exists) {
        throw new Error('Sync log not found');
      }

      const syncData = syncDoc.data();
      const completedDevices = syncData?.completedDevices || [];
      
      if (!completedDevices.includes(deviceId)) {
        completedDevices.push(deviceId);
      }

      // If all target devices have completed sync, mark as completed
      const allCompleted = syncData?.targetDevices?.every((device: string) => 
        completedDevices.includes(device)
      );

      await syncLogRef.update({
        completedDevices,
        status: allCompleted ? 'completed' : 'partial',
        lastUpdated: new Date()
      });
    } catch (error) {
      logger.error('Failed to mark sync completed:', error);
      throw error;
    }
  }

  /**
   * Get data changes since last sync for a device
   */
  async getDataChangesSinceLastSync(
    userId: string, 
    deviceId: string, 
    lastSyncTimestamp: Date
  ): Promise<Record<string, any[]>> {
    try {
      const changes: Record<string, any[]> = {};

      // Get changes for each collection
      for (const [key, collection] of Object.entries(this.COLLECTIONS)) {
        if (key === 'devices' || key === 'syncLog') continue;

        const snapshot = await db.collection(collection)
          .where('userId', '==', userId)
          .where('lastModified', '>', lastSyncTimestamp)
          .get();

        changes[collection] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      return changes;
    } catch (error) {
      logger.error('Failed to get data changes since last sync:', error);
      throw error;
    }
  }

  /**
   * Perform full data sync for a device
   */
  async performFullSync(userId: string, deviceId: string): Promise<Record<string, any[]>> {
    try {
      await this.updateDeviceActivity(deviceId);

      const allData: Record<string, any[]> = {};

      // Get all data for each collection
      for (const [key, collection] of Object.entries(this.COLLECTIONS)) {
        if (key === 'devices' || key === 'syncLog') continue;

        const snapshot = await db.collection(collection)
          .where('userId', '==', userId)
          .get();

        allData[collection] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      // Log full sync
      await db.collection(this.COLLECTIONS.syncLog).add({
        userId,
        deviceId,
        operation: 'full_sync',
        timestamp: new Date(),
        status: 'completed'
      });

      logger.info(`Full sync completed for device ${deviceId}, user ${userId}`);
      return allData;
    } catch (error) {
      logger.error('Failed to perform full sync:', error);
      throw error;
    }
  }

  /**
   * Sync user data across devices
   */
  async syncUserData(userId: string): Promise<void> {
    try {
      logger.info('Syncing user data across devices', { userId });
      
      // Get all user devices
      const devices = await this.getUserDevices(userId);
      
      // Sync data to all devices
      for (const device of devices) {
        await this.updateDeviceActivity(device.deviceId);
      }
      
      logger.info('User data synced successfully', { userId, deviceCount: devices.length });
    } catch (error) {
      logger.error('Failed to sync user data', { userId, error });
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic Firestore connectivity
      await db.collection('health_check').limit(1).get();
      return true;
    } catch (error) {
      logger.error('Data sync service health check failed', { error });
      return false;
    }
  }

  /**
   * Clean up old sync logs and inactive devices
   */
  async cleanupSyncData(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Clean up old sync logs
      const oldSyncLogs = await db.collection(this.COLLECTIONS.syncLog)
        .where('timestamp', '<', thirtyDaysAgo)
        .get();

      const batch = db.batch();
      oldSyncLogs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Mark devices as inactive if not seen for 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const inactiveDevices = await db.collection(this.COLLECTIONS.devices)
        .where('lastSeen', '<', sevenDaysAgo)
        .where('isActive', '==', true)
        .get();

      inactiveDevices.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false });
      });

      await batch.commit();

      logger.info(`Cleaned up ${oldSyncLogs.size} old sync logs and marked ${inactiveDevices.size} devices as inactive`);
    } catch (error) {
      logger.error('Failed to cleanup sync data:', error);
      throw error;
    }
  }
}

export const dataSyncService = new DataSyncService();