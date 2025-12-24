import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Transaction, 
  SavingsGoal, 
  Category, 
  User, 
  Notification,
  MoneyStory 
} from '../../../shared/src/types';

export interface OfflineStorageConfig {
  maxCacheSize: number; // Maximum number of items per collection
  cacheExpiryHours: number; // Hours after which cache expires
}

export interface CachedItem<T> {
  data: T;
  timestamp: Date;
  isLocalChange: boolean;
  version: number;
}

export interface StorageStats {
  totalItems: number;
  collections: Record<string, number>;
  lastCleanup: Date | null;
  cacheSize: number; // in bytes
}

export class OfflineStorageService {
  private readonly STORAGE_PREFIX = 'finwise_offline_';
  private readonly COLLECTIONS = {
    TRANSACTIONS: 'transactions',
    GOALS: 'goals',
    CATEGORIES: 'categories',
    USER: 'user',
    NOTIFICATIONS: 'notifications',
    STORIES: 'stories'
  };

  private config: OfflineStorageConfig = {
    maxCacheSize: 1000,
    cacheExpiryHours: 24
  };

  constructor(config?: Partial<OfflineStorageConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Store item in offline cache
   */
  async storeItem<T>(
    collection: string, 
    id: string, 
    data: T, 
    isLocalChange: boolean = false
  ): Promise<void> {
    try {
      const key = this.getStorageKey(collection, id);
      const cachedItem: CachedItem<T> = {
        data,
        timestamp: new Date(),
        isLocalChange,
        version: 1
      };

      await AsyncStorage.setItem(key, JSON.stringify(cachedItem));
      
      // Update collection index
      await this.updateCollectionIndex(collection, id, 'add');
      
      console.log(`Stored item ${id} in collection ${collection}`);
    } catch (error) {
      console.error('Failed to store item:', error);
      throw error;
    }
  }

  /**
   * Get item from offline cache
   */
  async getItem<T>(collection: string, id: string): Promise<T | null> {
    try {
      const key = this.getStorageKey(collection, id);
      const itemJson = await AsyncStorage.getItem(key);
      
      if (!itemJson) {
        return null;
      }

      const cachedItem: CachedItem<T> = JSON.parse(itemJson);
      
      // Check if item has expired
      if (this.isExpired(cachedItem.timestamp)) {
        await this.removeItem(collection, id);
        return null;
      }

      return cachedItem.data;
    } catch (error) {
      console.error('Failed to get item:', error);
      return null;
    }
  }

  /**
   * Get all items from a collection
   */
  async getCollection<T>(collection: string): Promise<Record<string, T>> {
    try {
      const index = await this.getCollectionIndex(collection);
      const items: Record<string, T> = {};

      for (const id of index) {
        const item = await this.getItem<T>(collection, id);
        if (item) {
          items[id] = item;
        }
      }

      return items;
    } catch (error) {
      console.error('Failed to get collection:', error);
      return {};
    }
  }

  /**
   * Update existing item
   */
  async updateItem<T>(
    collection: string, 
    id: string, 
    data: Partial<T>, 
    isLocalChange: boolean = false
  ): Promise<void> {
    try {
      const existingItem = await this.getItem<T>(collection, id);
      if (!existingItem) {
        throw new Error(`Item ${id} not found in collection ${collection}`);
      }

      const updatedData = { ...existingItem, ...data };
      await this.storeItem(collection, id, updatedData, isLocalChange);
      
      console.log(`Updated item ${id} in collection ${collection}`);
    } catch (error) {
      console.error('Failed to update item:', error);
      throw error;
    }
  }

  /**
   * Remove item from offline cache
   */
  async removeItem(collection: string, id: string): Promise<void> {
    try {
      const key = this.getStorageKey(collection, id);
      await AsyncStorage.removeItem(key);
      
      // Update collection index
      await this.updateCollectionIndex(collection, id, 'remove');
      
      console.log(`Removed item ${id} from collection ${collection}`);
    } catch (error) {
      console.error('Failed to remove item:', error);
      throw error;
    }
  }

  /**
   * Get items that have local changes
   */
  async getLocalChanges<T>(collection: string): Promise<Record<string, T>> {
    try {
      const index = await this.getCollectionIndex(collection);
      const localChanges: Record<string, T> = {};

      for (const id of index) {
        const key = this.getStorageKey(collection, id);
        const itemJson = await AsyncStorage.getItem(key);
        
        if (itemJson) {
          const cachedItem: CachedItem<T> = JSON.parse(itemJson);
          if (cachedItem.isLocalChange) {
            localChanges[id] = cachedItem.data;
          }
        }
      }

      return localChanges;
    } catch (error) {
      console.error('Failed to get local changes:', error);
      return {};
    }
  }

  /**
   * Mark item as synced (remove local change flag)
   */
  async markAsSynced(collection: string, id: string): Promise<void> {
    try {
      const key = this.getStorageKey(collection, id);
      const itemJson = await AsyncStorage.getItem(key);
      
      if (itemJson) {
        const cachedItem: CachedItem<any> = JSON.parse(itemJson);
        cachedItem.isLocalChange = false;
        cachedItem.timestamp = new Date();
        
        await AsyncStorage.setItem(key, JSON.stringify(cachedItem));
      }
    } catch (error) {
      console.error('Failed to mark item as synced:', error);
      throw error;
    }
  }

  /**
   * Search items in a collection
   */
  async searchItems<T>(
    collection: string, 
    searchFn: (item: T) => boolean
  ): Promise<Record<string, T>> {
    try {
      const allItems = await this.getCollection<T>(collection);
      const results: Record<string, T> = {};

      for (const [id, item] of Object.entries(allItems)) {
        if (searchFn(item)) {
          results[id] = item;
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to search items:', error);
      return {};
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const stats: StorageStats = {
        totalItems: 0,
        collections: {},
        lastCleanup: null,
        cacheSize: 0
      };

      for (const collection of Object.values(this.COLLECTIONS)) {
        const index = await this.getCollectionIndex(collection);
        stats.collections[collection] = index.length;
        stats.totalItems += index.length;
      }

      // Get cache size (approximate)
      const allKeys = await AsyncStorage.getAllKeys();
      const finwiseKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      
      for (const key of finwiseKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          stats.cacheSize += value.length;
        }
      }

      // Get last cleanup time
      const lastCleanupStr = await AsyncStorage.getItem(`${this.STORAGE_PREFIX}last_cleanup`);
      if (lastCleanupStr) {
        stats.lastCleanup = new Date(lastCleanupStr);
      }

      return stats;
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalItems: 0,
        collections: {},
        lastCleanup: null,
        cacheSize: 0
      };
    }
  }

  /**
   * Clean up expired items and enforce cache limits
   */
  async cleanupCache(): Promise<{ removed: number; collections: Record<string, number> }> {
    try {
      let totalRemoved = 0;
      const removedByCollection: Record<string, number> = {};

      for (const collection of Object.values(this.COLLECTIONS)) {
        const removed = await this.cleanupCollection(collection);
        removedByCollection[collection] = removed;
        totalRemoved += removed;
      }

      // Update last cleanup time
      await AsyncStorage.setItem(
        `${this.STORAGE_PREFIX}last_cleanup`, 
        new Date().toISOString()
      );

      console.log(`Cache cleanup completed. Removed ${totalRemoved} items.`);
      
      return {
        removed: totalRemoved,
        collections: removedByCollection
      };
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
      throw error;
    }
  }

  /**
   * Clear all offline data
   */
  async clearAllData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const finwiseKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      
      await AsyncStorage.multiRemove(finwiseKeys);
      
      console.log(`Cleared ${finwiseKeys.length} offline storage items`);
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * Export data for backup
   */
  async exportData(): Promise<Record<string, any>> {
    try {
      const exportData: Record<string, any> = {};

      for (const collection of Object.values(this.COLLECTIONS)) {
        exportData[collection] = await this.getCollection(collection);
      }

      return exportData;
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Import data from backup
   */
  async importData(data: Record<string, any>): Promise<void> {
    try {
      for (const [collection, items] of Object.entries(data)) {
        if (typeof items === 'object' && items !== null) {
          for (const [id, item] of Object.entries(items)) {
            await this.storeItem(collection, id, item, false);
          }
        }
      }

      console.log('Data import completed');
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  // Private helper methods

  private getStorageKey(collection: string, id: string): string {
    return `${this.STORAGE_PREFIX}${collection}_${id}`;
  }

  private getCollectionIndexKey(collection: string): string {
    return `${this.STORAGE_PREFIX}index_${collection}`;
  }

  private async getCollectionIndex(collection: string): Promise<string[]> {
    try {
      const key = this.getCollectionIndexKey(collection);
      const indexJson = await AsyncStorage.getItem(key);
      return indexJson ? JSON.parse(indexJson) : [];
    } catch (error) {
      console.error('Failed to get collection index:', error);
      return [];
    }
  }

  private async updateCollectionIndex(
    collection: string, 
    id: string, 
    operation: 'add' | 'remove'
  ): Promise<void> {
    try {
      const index = await this.getCollectionIndex(collection);
      const key = this.getCollectionIndexKey(collection);

      if (operation === 'add' && !index.includes(id)) {
        index.push(id);
      } else if (operation === 'remove') {
        const indexToRemove = index.indexOf(id);
        if (indexToRemove > -1) {
          index.splice(indexToRemove, 1);
        }
      }

      await AsyncStorage.setItem(key, JSON.stringify(index));
    } catch (error) {
      console.error('Failed to update collection index:', error);
    }
  }

  private isExpired(timestamp: Date): boolean {
    const now = new Date();
    const expiryTime = new Date(timestamp.getTime() + (this.config.cacheExpiryHours * 60 * 60 * 1000));
    return now > expiryTime;
  }

  private async cleanupCollection(collection: string): Promise<number> {
    try {
      const index = await this.getCollectionIndex(collection);
      let removedCount = 0;

      // Remove expired items
      for (const id of index) {
        const key = this.getStorageKey(collection, id);
        const itemJson = await AsyncStorage.getItem(key);
        
        if (itemJson) {
          const cachedItem: CachedItem<any> = JSON.parse(itemJson);
          if (this.isExpired(cachedItem.timestamp)) {
            await this.removeItem(collection, id);
            removedCount++;
          }
        }
      }

      // Enforce cache size limits
      const updatedIndex = await this.getCollectionIndex(collection);
      if (updatedIndex.length > this.config.maxCacheSize) {
        // Remove oldest items (those without local changes first)
        const itemsWithTimestamps: Array<{ id: string; timestamp: Date; isLocalChange: boolean }> = [];
        
        for (const id of updatedIndex) {
          const key = this.getStorageKey(collection, id);
          const itemJson = await AsyncStorage.getItem(key);
          
          if (itemJson) {
            const cachedItem: CachedItem<any> = JSON.parse(itemJson);
            itemsWithTimestamps.push({
              id,
              timestamp: cachedItem.timestamp,
              isLocalChange: cachedItem.isLocalChange
            });
          }
        }

        // Sort by local changes (keep local changes) and then by timestamp (oldest first)
        itemsWithTimestamps.sort((a, b) => {
          if (a.isLocalChange !== b.isLocalChange) {
            return a.isLocalChange ? 1 : -1; // Local changes go to end (kept)
          }
          return a.timestamp.getTime() - b.timestamp.getTime(); // Oldest first
        });

        const itemsToRemove = itemsWithTimestamps.slice(0, updatedIndex.length - this.config.maxCacheSize);
        
        for (const item of itemsToRemove) {
          if (!item.isLocalChange) { // Don't remove local changes
            await this.removeItem(collection, item.id);
            removedCount++;
          }
        }
      }

      return removedCount;
    } catch (error) {
      console.error('Failed to cleanup collection:', error);
      return 0;
    }
  }
}

export const offlineStorageService = new OfflineStorageService();