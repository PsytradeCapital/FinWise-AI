import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/v1/categories - Get categories
router.get('/', asyncHandler(async (req, res) => {
  // TODO: Implement categories listing
  res.json({
    success: true,
    message: 'Categories endpoint - to be implemented',
    data: [],
  });
}));

// POST /api/v1/categories - Create custom category
router.post('/', asyncHandler(async (req, res) => {
  // TODO: Implement category creation
  res.status(201).json({
    success: true,
    message: 'Category creation - to be implemented',
    data: null,
  });
}));

export default router;