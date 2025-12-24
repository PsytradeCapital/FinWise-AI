import admin from 'firebase-admin';
import { logger } from '../utils/logger';

export const initializeFirebase = (): void => {
  try {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : undefined;

      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
        logger.info('Firebase Admin SDK initialized successfully');
      } else {
        logger.warn('Firebase service account key not found. Using default credentials.');
        admin.initializeApp();
      }
    }
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
};

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

export default admin;