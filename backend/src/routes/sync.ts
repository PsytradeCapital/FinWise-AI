import express from 'express';
import { dataSyncService, DeviceInfo } from '../services/dataSyncService';
import { offlineDataService } from '../services/offlineDataService';
import { authMiddleware } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Register a device for sync
 */
router.post('/devices/register', async (req, res) => {
  try {
    const { deviceId, platform, appVersion } = req.body;
    const userId = req.user?.uid;

    if (!deviceId || !platform || !appVersion) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: deviceId, platform, appVersion'
      });
    }

    const deviceInfo: DeviceInfo = {
      deviceId,
      userId: userId!,
      platform,
      lastSeen: new Date(),
      isActive: true,
      appVersion
    };

    await dataSyncService.registerDevice(deviceInfo);

    res.json({
      success: true,
      message: 'Device registered successfully'
    });
  } catch (error) {
    logger.error('Failed to register device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register device'
    });
  }
});

/**
 * Update device activity
 */
router.post('/devices/:deviceId/activity', async (req, res) => {
  try {
    const { deviceId } = req.params;

    await dataSyncService.updateDeviceActivity(deviceId);

    res.json({
      success: true,
      message: 'Device activity updated'
    });
  } catch (error) {
    logger.error('Failed to update device activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update device activity'
    });
  }
});

/**
 * Get all devices for a user
 */
router.get('/devices', async (req, res) => {
  try {
    const userId = req.user?.uid;
    const devices = await dataSyncService.getUserDevices(userId!);

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    logger.error('Failed to get user devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user devices'
    });
  }
});

/**
 * Perform full sync for a device
 */
router.post('/devices/:deviceId/full-sync', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.uid;

    const syncData = await dataSyncService.performFullSync(userId!, deviceId);

    res.json({
      success: true,
      data: syncData,
      message: 'Full sync completed'
    });
  } catch (error) {
    logger.error('Failed to perform full sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform full sync'
    });
  }
});

/**
 * Get data changes since last sync
 */
router.get('/devices/:deviceId/changes', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { since } = req.query;
    const userId = req.user?.uid;

    if (!since) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: since (timestamp)'
      });
    }

    const sinceDate = new Date(since as string);
    const changes = await dataSyncService.getDataChangesSinceLastSync(userId!, deviceId, sinceDate);

    res.json({
      success: true,
      data: changes
    });
  } catch (error) {
    logger.error('Failed to get data changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get data changes'
    });
  }
});

/**
 * Get pending sync operations for a device
 */
router.get('/devices/:deviceId/pending', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.uid;

    const pendingOperations = await dataSyncService.getPendingSyncOperations(deviceId, userId!);

    res.json({
      success: true,
      data: pendingOperations
    });
  } catch (error) {
    logger.error('Failed to get pending sync operations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending sync operations'
    });
  }
});

/**
 * Mark sync operation as completed
 */
router.post('/operations/:operationId/complete', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: deviceId'
      });
    }

    await dataSyncService.markSyncCompleted(operationId, deviceId);

    res.json({
      success: true,
      message: 'Sync operation marked as completed'
    });
  } catch (error) {
    logger.error('Failed to mark sync completed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark sync completed'
    });
  }
});

/**
 * Store offline operation
 */
router.post('/offline/operations', async (req, res) => {
  try {
    const { operation, collection, documentId, data, deviceId } = req.body;
    const userId = req.user?.uid;

    if (!operation || !collection || !documentId || !data || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: operation, collection, documentId, data, deviceId'
      });
    }

    const operationId = await offlineDataService.storeOfflineOperation({
      userId: userId!,
      deviceId,
      operation,
      collection,
      documentId,
      data,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: { operationId },
      message: 'Offline operation stored'
    });
  } catch (error) {
    logger.error('Failed to store offline operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store offline operation'
    });
  }
});

/**
 * Sync offline operations
 */
router.post('/offline/sync', async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user?.uid;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: deviceId'
      });
    }

    const syncResult = await offlineDataService.syncOfflineOperations(userId!, deviceId);

    res.json({
      success: true,
      data: syncResult,
      message: 'Offline operations synced'
    });
  } catch (error) {
    logger.error('Failed to sync offline operations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync offline operations'
    });
  }
});

/**
 * Get cached data for offline access
 */
router.get('/offline/cache/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const userId = req.user?.uid;

    const cachedData = await offlineDataService.getCachedData(userId!, collection);

    res.json({
      success: true,
      data: cachedData
    });
  } catch (error) {
    logger.error('Failed to get cached data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cached data'
    });
  }
});

/**
 * Perform auto sync
 */
router.post('/auto-sync', async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user?.uid;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: deviceId'
      });
    }

    await offlineDataService.performAutoSync(userId!, deviceId);

    res.json({
      success: true,
      message: 'Auto sync completed'
    });
  } catch (error) {
    logger.error('Failed to perform auto sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform auto sync'
    });
  }
});

/**
 * Check connectivity status
 */
router.get('/status', async (req, res) => {
  try {
    const isOnline = await offlineDataService.isOnlineAndCanSync();

    res.json({
      success: true,
      data: {
        isOnline,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to check connectivity status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check connectivity status'
    });
  }
});

export default router;