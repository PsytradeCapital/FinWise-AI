import express from 'express';
import cors from 'cors';

// For Vercel deployment, we don't need Firebase Functions wrapper
// but we keep Firebase Admin for database access

// Initialize Firebase Admin (but not Functions)
import './config/firebase';

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Import all routes
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import categoryRoutes from './routes/categories';
import goalRoutes from './routes/goals';
import userRoutes from './routes/users';
import adviceRoutes from './routes/advice';
import storiesRoutes from './routes/stories';
import reportsRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';
import mpesaRoutes from './routes/mpesa';
import bankingRoutes from './routes/banking';
import naboCapitalRoutes from './routes/naboCapital';
import localizationRoutes from './routes/localization';
import syncRoutes from './routes/sync';
import integrationRoutes from './routes/integration';

// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler';
import { securityHeaders, requestLogger } from './middleware/authMiddleware';

// Apply security middleware
app.use(securityHeaders);
app.use(requestLogger);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/advice', adviceRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/nabo-capital', naboCapitalRoutes);
app.use('/api/localization', localizationRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/integration', integrationRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'FinWise AI Backend is running on Vercel',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    platform: 'vercel',
    services: {
      firebase: 'connected',
      database: 'ready',
      auth: 'enabled'
    }
  });
});

// API info endpoint
app.get('/api', (_req, res) => {
  res.json({
    name: 'FinWise AI API',
    version: '1.0.0',
    description: 'AI-powered financial management backend',
    platform: 'vercel',
    endpoints: {
      auth: '/api/auth',
      transactions: '/api/transactions',
      categories: '/api/categories',
      goals: '/api/goals',
      users: '/api/users',
      advice: '/api/advice',
      stories: '/api/stories',
      reports: '/api/reports',
      notifications: '/api/notifications',
      mpesa: '/api/mpesa',
      banking: '/api/banking',
      naboCapital: '/api/nabo-capital',
      localization: '/api/localization',
      sync: '/api/sync',
      integration: '/api/integration'
    },
    health: '/health'
  });
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// For Vercel, export the Express app directly
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 FinWise AI Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 API info: http://localhost:${PORT}/api`);
  });
}