import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/v1/stories - Get money stories for user
router.get('/', asyncHandler(async (req, res) => {
  // TODO: Implement money story generation
  res.json({
    success: true,
    message: 'Stories endpoint - to be implemented',
    data: [],
  });
}));

export default router;