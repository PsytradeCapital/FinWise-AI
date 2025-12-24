import { useState, useEffect, useCallback } from 'react';
import { offlineDataManager, QueryOptions } from '../services/offlineDataManager';
import { useSync } from './useSync';

export interface UseOfflineDataReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (item: Omit<T, 'id'>) => Promise<T>;
  update: (id: string, updates: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  search: (searchFn: (item: T) => boolean) => Promise<T[]>;
  getById: (id: string) => Promise<T | null>;
  localChanges: Record<string, T>;
  hasUnsyncedChanges: boolean;
}

export const useOfflineData = <T extends { id: string }>(
  collection: string,
  options?: QueryOptions,
  autoRefresh: boolean = true
): UseOfflineDataReturn<T> => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localChanges, setLocalChanges] = useState<Record<string, T>>({});

  const { syncStatus } = useSync('', '', ''); // These will be set by the parent component

  /**
   * Load data from offline storage
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const items = await offlineDataManager.getAll<T>(collection, options);
      setData(items);

      // Load local changes
      const changes = await offlineDataManager.getLocalChanges<T>(collection);
      setLocalChanges(changes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [collection, options]);

  /**
   * Refresh data from server and local storage
   */
  const refresh = useCallback(async () => {
    try {
      setError(null);
      
      // Try to refresh from server if online
      if (syncStatus.isOnline) {
        await offlineDataManager.refreshFromServer(collection);
      }
      
      // Reload local data
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
      console.error('Failed to refresh data:', err);
    }
  }, [collection, syncStatus.isOnline, loadData]);

  /**
   * Create a new item
   */
  const create = useCallback(async (item: Omit<T, 'id'>): Promise<T> => {
    try {
      setError(null);
      
      const newItem = await offlineDataManager.create<T>(collection, item);
      
      // Update local state
      setData(prevData => [...prevData, newItem]);
      
      // Update local changes
      const changes = await offlineDataManager.getLocalChanges<T>(collection);
      setLocalChanges(changes);
      
      return newItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create item';
      setError(errorMessage);
      console.error('Failed to create item:', err);
      throw err;
    }
  }, [collection]);

  /**
   * Update an existing item
   */
  const update = useCallback(async (id: string, updates: Partial<T>): Promise<T | null> => {
    try {
      setError(null);
      
      const updatedItem = await offlineDataManager.update<T>(collection, id, updates);
      
      if (updatedItem) {
        // Update local state
        setData(prevData => 
          prevData.map(item => item.id === id ? updatedItem : item)
        );
        
        // Update local changes
        const changes = await offlineDataManager.getLocalChanges<T>(collection);
        setLocalChanges(changes);
      }
      
      return updatedItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMessage);
      console.error('Failed to update item:', err);
      throw err;
    }
  }, [collection]);

  /**
   * Remove an item
   */
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      
      const success = await offlineDataManager.delete(collection, id);
      
      if (success) {
        // Update local state
        setData(prevData => prevData.filter(item => item.id !== id));
        
        // Update local changes
        const changes = await offlineDataManager.getLocalChanges<T>(collection);
        setLocalChanges(changes);
      }
      
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove item';
      setError(errorMessage);
      console.error('Failed to remove item:', err);
      return false;
    }
  }, [collection]);

  /**
   * Search items
   */
  const search = useCallback(async (searchFn: (item: T) => boolean): Promise<T[]> => {
    try {
      setError(null);
      return await offlineDataManager.search<T>(collection, searchFn, options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search items';
      setError(errorMessage);
      console.error('Failed to search items:', err);
      return [];
    }
  }, [collection, options]);

  /**
   * Get item by ID
   */
  const getById = useCallback(async (id: string): Promise<T | null> => {
    try {
      setError(null);
      return await offlineDataManager.getById<T>(collection, id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get item';
      setError(errorMessage);
      console.error('Failed to get item:', err);
      return null;
    }
  }, [collection]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh when coming online
  useEffect(() => {
    if (autoRefresh && syncStatus.isOnline && !syncStatus.syncInProgress) {
      refresh();
    }
  }, [autoRefresh, syncStatus.isOnline, syncStatus.syncInProgress, refresh]);

  // Reload local changes when sync status changes
  useEffect(() => {
    const updateLocalChanges = async () => {
      try {
        const changes = await offlineDataManager.getLocalChanges<T>(collection);
        setLocalChanges(changes);
      } catch (err) {
        console.error('Failed to update local changes:', err);
      }
    };

    updateLocalChanges();
  }, [collection, syncStatus.pendingOperations]);

  const hasUnsyncedChanges = Object.keys(localChanges).length > 0 || syncStatus.pendingOperations > 0;

  return {
    data,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    search,
    getById,
    localChanges,
    hasUnsyncedChanges
  };
};

/**
 * Hook for managing a single item
 */
export const useOfflineItem = <T extends { id: string }>(
  collection: string,
  id: string | null
) => {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItem = useCallback(async () => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const loadedItem = await offlineDataManager.getById<T>(collection, id);
      setItem(loadedItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item');
      console.error('Failed to load item:', err);
    } finally {
      setLoading(false);
    }
  }, [collection, id]);

  const updateItem = useCallback(async (updates: Partial<T>): Promise<T | null> => {
    if (!id) return null;

    try {
      setError(null);
      
      const updatedItem = await offlineDataManager.update<T>(collection, id, updates);
      setItem(updatedItem);
      
      return updatedItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMessage);
      console.error('Failed to update item:', err);
      throw err;
    }
  }, [collection, id]);

  const deleteItem = useCallback(async (): Promise<boolean> => {
    if (!id) return false;

    try {
      setError(null);
      
      const success = await offlineDataManager.delete(collection, id);
      if (success) {
        setItem(null);
      }
      
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item';
      setError(errorMessage);
      console.error('Failed to delete item:', err);
      return false;
    }
  }, [collection, id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  return {
    item,
    loading,
    error,
    refresh: loadItem,
    update: updateItem,
    delete: deleteItem
  };
};