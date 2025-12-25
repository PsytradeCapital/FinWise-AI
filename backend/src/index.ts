import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Import routes
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import categoryRoutes from './routes/categories';
import goalRoutes from './routes/goals';
import userRoutes from './routes/users';

// Use routes
app.use('/auth', authRoutes);
app.use('/transactions', transactionRoutes);
app.use('/categories', categoryRoutes);
app.use('/goals', goalRoutes);
app.use('/users', userRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'FinWise AI Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Export the Express app as a Firebase Function
export const api = functions.https.onRequest(app);

// Export app as default for testing
export default app;