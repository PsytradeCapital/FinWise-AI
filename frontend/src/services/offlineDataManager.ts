import { offlineStorageService } from './offlineStorageService';
import { syncService } from './syncService';
import { 
  Transaction, 
  SavingsGoal, 
  Category, 
  User, 
  Notification,
  MoneyStory 
} from '../../../shared/src/types';

export interface DataManagerConfig {
  apiBaseUrl: string;
  authToken: string;
  userId: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: (item: any) => boolean;
}

export class OfflineDataManager {
  private config: DataManagerConfig | null = null;
  private isInitialized = false;

  /**
   * Initialize the data manager
   */
  async initialize(config: DataManagerConfig): Promise<void> {
    try {
      this.config = config;
      
      // Initialize sync service
      await syncService.initialize({
        apiBaseUrl: config.apiBaseUrl,
        authToken: config.authToken,
        userId: config.userId
      });

      this.isInitialized = true;
      console.log('Offline data manager initialized');
    } catch (error) {
      console.error('Failed to initialize offline data manager:', error);
      throw error;
    }
  }

  /**
   * Create a new item (offline-first)
   */
  async create<T extends { id: string }>(
    collection: string, 
    data: Omit<T, 'id'> & { id?: string }
  ): Promise<T> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data manager not initialized');
      }

      // Generate ID if not provided
      const id = data.id || this.generateId();
      const item = { ...data, id } as T;

      // Store locally first
      await offlineStorageService.storeItem(collection, id, item, true);

      // Queue for sync
      await syncService.storeOfflineOperation('create', collection, id, item);

      console.log(`Created item ${id} in collection ${collection}`);
      return item;
    } catch (error) {
      console.error('Failed to create item:', error);
      throw error;
    }
  }

  /**
   * Get item by ID (offline-first)
   */
  async getById<T>(collection: string, id: string): Promise<T | null> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data manager not initialized');
      }

      // Try to get from local storage first
      const localItem = await offlineStorageService.getItem<T>(collection, id);
      if (localItem) {
        return localItem;
      }

      // If not found locally and online, try to fetch from server
      const syncStatus = await syncService.getSyncStatus();
      if (syncStatus.isOnline) {
        try {
          const response = await fetch(`${this.config!.apiBaseUrl}/${collection}/${id}`, {
            headers: {
              'Authorization': `Bearer ${this.config!.authToken}`
            }
          });

          if (response.ok) {
            const result = await response.json();
            const item = result.data;
            
            // Cache the item locally
            await offlineStorageService.storeItem(collection, id, item, false);
            return item;
          }
        } catch (error) {
          console.warn('Failed to fetch item from server:', error);
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get item:', error);
      return null;
    }
  }

  /**
   * Get all items from collection (offline-first)
   */
  async getAll<T>(collection: string, options?: QueryOptions): Promise<T[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data manager not initialized');
      }

      // Get from local storage
      const localItems = await offlineStorageService.getCollection<T>(collection);
      let items = Object.values(localItems);

      // Apply filtering
      if (options?.filter) {
        items = items.filter(options.filter);
      }

      // Apply sorting
      if (options?.sortBy) {
        items.sort((a, b) => {
          const aValue = (a as any)[options.sortBy!];
          const bValue = (b as any)[options.sortBy!];
          
          if (aValue < bValue) return options.sortOrder === 'desc' ? 1 : -1;
          if (aValue > bValue) return options.sortOrder === 'desc' ? -1 : 1;
          return 0;
        });
      }

      // Apply pagination
      if (options?.offset || options?.limit) {
        const start = options.offset || 0;
        const end = options.limit ? start + options.limit : undefined;
        items = items.slice(start, end);
      }

      return items;
    } catch (error) {
      console.error('Failed to get all items:', error);
      return [];
    }
  }

  /**
   * Update an item (offline-first)
   */
  async update<T extends { id: string }>(
    collection: string, 
    id: string, 
    updates: Partial<T>
  ): Promise<T | null> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data manager not initialized');
      }

      // Get existing item
      const existingItem = await this.getById<T>(collection, id);
      if (!existingItem) {
        throw new Error(`Item ${id} not found in collection ${collection}`);
      }

      // Merge updates
      const updatedItem = { ...existingItem, ...updates };

      // Store locally
      await offlineStorageService.storeItem(collection, id, updatedItem, true);

      // Queue for sync
      await syncService.storeOfflineOperation('update', collection, id, updatedItem);

      console.log(`Updated item ${id} in collection ${collection}`);
      return updatedItem;
    } catch (error) {
      console.error('Failed to update item:', error);
      throw error;
    }
  }

  /**
   * Delete an item (offline-first)
   */
  async delete(collection: string, id: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data manager not initialized');
      }

      // Remove from local storage
      await offlineStorageService.removeItem(collection, id);

      // Queue for sync
      await syncService.storeOfflineOperation('delete', collection, id, null);

      console.log(`Deleted item ${id} from collection ${collection}`);
      return true;
    } catch (error) {
      console.error('Failed to delete item:', error);
      return false;
    }
  }

  /**
   * Search items in collection
   */
  async search<T>(
    collection: string, 
    searchFn: (item: T) => boolean,
    options?: QueryOptions
  ): Promise<T[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data manager not initialized');
      }

      const searchResults = await offlineStorageService.searchItems(collection, searchFn);
      let items = Object.values(searchResults);

      // Apply additional filtering
      if (options?.filter) {
        items = items.filter(options.filter);
      }

      // Apply sorting
      if (options?.sortBy) {
        items.sort((a, b) => {
          const aValue = (a as any)[options.sortBy!];
          const bValue = (b as any)[options.sortBy!];
          
          if (aValue < bValue) return options.sortOrder === 'desc' ? 1 : -1;
          if (aValue > bValue) return options.sortOrder === 'desc' ? -1 : 1;
          return 0;
        });
      }

      // Apply pagination
      if (options?.offset || options?.limit) {
        const start = options.offset || 0;
        const end = options.limit ? start + options.limit : undefined;
        items = items.slice(start, end);
      }

      return items;
    } catch (error) {
      console.error('Failed to search items:', error);
      return [];
    }
  }

  /**
   * Get items with local changes (pending sync)
   */
  async getLocalChanges<T>(collection: string): Promise<Record<string, T>> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data manager not initialized');
      }

      return await offlineStorageService.getLocalChanges<T>(collection);
    } catch (error) {
      console.error('Failed to get local changes:', error);
      return {};
    }
  }

  /**
   * Refresh data from server (when online)
   */
  async refreshFromServer(collection?: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Data manager not initialized');
      }

      const syncStatus = await syncService.getSyncStatus();
      if (!syncStatus.isOnline) {
        console.log('Device is offline, cannot refresh from server');
        return;
      }

      if (collection) {
        await this.refreshCollection(collection);
      } else {
        // Refresh all collections
        const collections = ['transactions', 'goals', 'categories', 'notifications', 'stories'];
        for (const coll of collections) {
          await this.refreshCollection(coll);
        }
      }

      console.log('Data refreshed from server');
    } catch (error) {
      console.error('Failed to refresh data from server:', error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    if (!this.isInitialized) {
      throw new Error('Data manager not initialized');
    }

    return await syncService.getSyncStatus();
  }

  /**
   * Perform manual sync
   */
  async performSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Data manager not initialized');
    }

    await syncService.performFullSync();
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    return await offlineStorageService.getStorageStats();
  }

  /**
   * Clean up old cached data
   */
  async cleanupCache() {
    return await offlineStorageService.cleanupCache();
  }

  /**
   * Clear all offline data
   */
  async clearAllData(): Promise<void> {
    await offlineStorageService.clearAllData();
    await syncService.clearAllData();
  }

  // Collection-specific convenience methods

  /**
   * Transaction-specific methods
   */
  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    return this.create<Transaction>('transactions', transaction);
  }

  async getTransactions(options?: QueryOptions): Promise<Transaction[]> {
    return this.getAll<Transaction>('transactions', options);
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
    return this.update<Transaction>('transactions', id, updates);
  }

  async deleteTransaction(id: string): Promise<boolean> {
    return this.delete('transactions', id);
  }

  async searchTransactions(
    searchFn: (transaction: Transaction) => boolean,
    options?: QueryOptions
  ): Promise<Transaction[]> {
    return this.search<Transaction>('transactions', searchFn, options);
  }

  /**
   * Savings goal-specific methods
   */
  async createGoal(goal: Omit<SavingsGoal, 'id'>): Promise<SavingsGoal> {
    return this.create<SavingsGoal>('goals', goal);
  }

  async getGoals(options?: QueryOptions): Promise<SavingsGoal[]> {
    return this.getAll<SavingsGoal>('goals', options);
  }

  async updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal | null> {
    return this.update<SavingsGoal>('goals', id, updates);
  }

  async deleteGoal(id: string): Promise<boolean> {
    return this.delete('goals', id);
  }

  /**
   * Category-specific methods
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    return this.create<Category>('categories', category);
  }

  async getCategories(options?: QueryOptions): Promise<Category[]> {
    return this.getAll<Category>('categories', options);
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
    return this.update<Category>('categories', id, updates);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.delete('categories', id);
  }

  // Private helper methods

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async refreshCollection(collection: string): Promise<void> {
    try {
      const response = await fetch(`${this.config!.apiBaseUrl}/${collection}`, {
        headers: {
          'Authorization': `Bearer ${this.config!.authToken}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        const items = result.data || [];

        // Update local cache with server data
        for (const item of items) {
          // Don't overwrite local changes
          const localItem = await offlineStorageService.getItem(collection, item.id);
          const hasLocalChanges = await this.hasLocalChanges(collection, item.id);
          
          if (!hasLocalChanges) {
            await offlineStorageService.storeItem(collection, item.id, item, false);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to refresh collection ${collection}:`, error);
    }
  }

  private async hasLocalChanges(collection: string, id: string): Promise<boolean> {
    const localChanges = await offlineStorageService.getLocalChanges(collection);
    return id in localChanges;
  }
}

export const offlineDataManager = new OfflineDataManager();