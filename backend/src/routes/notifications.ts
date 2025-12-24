import { Router, Request, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { authMiddleware } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';
import { ApiResponse } from '@finwise-ai/shared';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Get notifications for user
 * GET /api/v1/notifications?userId=:userId
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, limit = '50', offset = '0' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      } as ApiResponse<null>);
    }

    const notifications = await notificationService.getNotifications(
      userId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    return res.status(200).json({
      success: true,
      data: notifications,
      message: 'Notifications retrieved successfully',
    } as ApiResponse<typeof notifications>);
  } catch (error) {
    logger.error('Get notifications error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications',
    } as ApiResponse<null>);
  }
});

/**
 * Mark notification as read
 * PUT /api/v1/notifications/:id/read
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Notification ID is required',
      } as ApiResponse<null>);
    }

    await notificationService.markAsRead(id);

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    } as ApiResponse<null>);
  } catch (error) {
    logger.error('Mark notification read error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    } as ApiResponse<null>);
  }
});

/**
 * Mark all notifications as read for user
 * PUT /api/v1/notifications/read-all
 */
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      } as ApiResponse<null>);
    }

    await notificationService.markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    } as ApiResponse<null>);
  } catch (error) {
    logger.error('Mark all notifications read error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    } as ApiResponse<null>);
  }
});

/**
 * Send test notification
 * POST /api/v1/notifications/test
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { userId, type = 'alert', title, message } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'User ID, title, and message are required',
      } as ApiResponse<null>);
    }

    const notification = await notificationService.sendNotification(userId, {
      type,
      title,
      message,
      data: { test: true },
    });

    return res.status(201).json({
      success: true,
      data: notification,
      message: 'Test notification sent successfully',
    } as ApiResponse<typeof notification>);
  } catch (error) {
    logger.error('Send test notification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
    } as ApiResponse<null>);
  }
});

/**
 * Get notification preferences
 * GET /api/v1/notifications/preferences?userId=:userId
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      } as ApiResponse<null>);
    }

    const preferences = await notificationService.getPreferences(userId as string);

    return res.status(200).json({
      success: true,
      data: preferences,
      message: 'Notification preferences retrieved successfully',
    } as ApiResponse<typeof preferences>);
  } catch (error) {
    logger.error('Get notification preferences error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification preferences',
    } as ApiResponse<null>);
  }
});

/**
 * Update notification preferences
 * PUT /api/v1/notifications/preferences
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const { userId, preferences } = req.body;

    if (!userId || !preferences) {
      return res.status(400).json({
        success: false,
        error: 'User ID and preferences are required',
      } as ApiResponse<null>);
    }

    const updatedPreferences = await notificationService.updatePreferences(userId, preferences);

    return res.status(200).json({
      success: true,
      data: updatedPreferences,
      message: 'Notification preferences updated successfully',
    } as ApiResponse<typeof updatedPreferences>);
  } catch (error) {
    logger.error('Update notification preferences error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences',
    } as ApiResponse<null>);
  }
});

export default router;