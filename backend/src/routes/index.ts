import { Router } from 'express';
import userRoutes from './users';
import transactionRoutes from './transactions';
import goalRoutes from './goals';
import categoryRoutes from './categories';
import adviceRoutes from './advice';
import storyRoutes from './stories';
import notificationRoutes from './notifications';
import reportRoutes from './reports';

const router = Router();

// API version prefix
const API_VERSION = '/v1';

// Mount routes
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/transactions`, transactionRoutes);
router.use(`${API_VERSION}/goals`, goalRoutes);
router.use(`${API_VERSION}/categories`, categoryRoutes);
router.use(`${API_VERSION}/advice`, adviceRoutes);
router.use(`${API_VERSION}/stories`, storyRoutes);
router.use(`${API_VERSION}/notifications`, notificationRoutes);
router.use(`${API_VERSION}/reports`, reportRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'FinWise AI API',
    version: '1.0.0',
    description: 'AI-powered financial management API',
    endpoints: {
      users: `${API_VERSION}/users`,
      transactions: `${API_VERSION}/transactions`,
      goals: `${API_VERSION}/goals`,
      categories: `${API_VERSION}/categories`,
      advice: `${API_VERSION}/advice`,
      stories: `${API_VERSION}/stories`,
      notifications: `${API_VERSION}/notifications`,
      reports: `${API_VERSION}/reports`,
    },
  });
});

export default router;