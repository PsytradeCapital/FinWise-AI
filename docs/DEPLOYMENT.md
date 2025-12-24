# FinWise AI - Production Deployment Guide

## 🚀 Overview

This guide covers deploying the FinWise AI application to production environments. The application consists of:
- **Backend**: Node.js API server (Firebase Functions or Cloud Run)
- **Frontend**: React Native mobile app (Android/iOS)
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth

## 📋 Prerequisites

### Required Accounts & Tools
- [ ] Google Cloud Platform account with billing enabled
- [ ] Firebase project created
- [ ] Google Play Console account (for Android)
- [ ] Apple Developer account (for iOS)
- [ ] M-Pesa Developer account
- [ ] Nabo Capital API access
- [ ] Banking API credentials

### Development Environment
- [ ] Node.js 18+ installed
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] React Native CLI installed
- [ ] Android Studio (for Android builds)
- [ ] Xcode (for iOS builds, macOS only)

## 🔧 Step 1: Firebase Project Setup

### 1.1 Create Production Firebase Project

```bash
# Login to Firebase
firebase login

# Create new project (or use existing)
firebase projects:create finwise-ai-prod

# Initialize Firebase in your project
firebase init
```

Select the following services:
- ✅ Firestore
- ✅ Functions
- ✅ Hosting
- ✅ Storage
- ✅ Emulators

### 1.2 Configure Firebase Project

```bash
# Set the project as default
firebase use finwise-ai-prod

# Enable required APIs
gcloud services enable firestore.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable storage-api.googleapis.com
```

### 1.3 Update Firebase Configuration

Update `firebase.json` to include Functions:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": {
    "source": "backend",
    "runtime": "nodejs18",
    "predeploy": ["npm run build"],
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log",
      "*.local"
    ]
  },
  "hosting": {
    "public": "frontend/build",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      }
    ]
  }
}
```

## 🔐 Step 2: Environment Configuration

### 2.1 Backend Environment Variables

Create `backend/.env.production`:

```bash
# Copy from example and update with production values
cp backend/.env.example backend/.env.production
```

Update with production values:

```env
NODE_ENV=production
PORT=8080

# Firebase Configuration (from Firebase Console)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_DATABASE_URL=https://finwise-ai-prod-default-rtdb.firebaseio.com/
FIREBASE_STORAGE_BUCKET=finwise-ai-prod.appspot.com

# JWT Configuration (generate secure keys)
JWT_SECRET=your-production-jwt-secret-256-bits
JWT_EXPIRES_IN=7d

# M-Pesa Production API
MPESA_CONSUMER_KEY=your-production-mpesa-consumer-key
MPESA_CONSUMER_SECRET=your-production-mpesa-consumer-secret
MPESA_PASSKEY=your-production-mpesa-passkey
MPESA_SHORTCODE=your-production-mpesa-shortcode
MPESA_ENVIRONMENT=production

# Nabo Capital Production API
NABO_CAPITAL_API_KEY=your-production-nabo-capital-api-key
NABO_CAPITAL_BASE_URL=https://api.nabocapital.com

# Banking APIs
EQUITY_BANK_API_KEY=your-equity-bank-api-key
KCB_BANK_API_KEY=your-kcb-bank-api-key
COOP_BANK_API_KEY=your-coop-bank-api-key

# Security
ENCRYPTION_KEY=your-256-bit-encryption-key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=warn
```

### 2.2 Firebase Functions Environment

Set environment variables for Firebase Functions:

```bash
# Set production environment variables
firebase functions:config:set \
  app.jwt_secret="your-production-jwt-secret" \
  mpesa.consumer_key="your-mpesa-key" \
  mpesa.consumer_secret="your-mpesa-secret" \
  nabo.api_key="your-nabo-api-key"

# Deploy configuration
firebase functions:config:get > backend/.runtimeconfig.json
```

## 🏗️ Step 3: Backend Deployment

### 3.1 Prepare Backend for Functions

Update `backend/package.json` for Firebase Functions:

```json
{
  "name": "functions",
  "engines": {
    "node": "18"
  },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  }
}
```

### 3.2 Update Backend Entry Point

Update `backend/src/index.ts` for Firebase Functions:

```typescript
import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://finwise-ai-prod.web.app', 'https://finwise-ai-prod.firebaseapp.com']
    : true,
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// Export for Firebase Functions
export const api = functions.https.onRequest(app);
```

### 3.3 Deploy Backend

```bash
# Build the backend
npm run build:backend

# Deploy to Firebase Functions
firebase deploy --only functions

# Verify deployment
firebase functions:log
```

## 📱 Step 4: Mobile App Deployment

### 4.1 Update App Configuration

Update `frontend/src/config/environment.ts`:

```typescript
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3000/api',
    FIREBASE_CONFIG: {
      // Development config
    }
  },
  production: {
    API_BASE_URL: 'https://us-central1-finwise-ai-prod.cloudfunctions.net/api',
    FIREBASE_CONFIG: {
      apiKey: "your-production-api-key",
      authDomain: "finwise-ai-prod.firebaseapp.com",
      projectId: "finwise-ai-prod",
      storageBucket: "finwise-ai-prod.appspot.com",
      messagingSenderId: "your-sender-id",
      appId: "your-app-id"
    }
  }
};

export default config[process.env.NODE_ENV || 'development'];
```

### 4.2 Android Deployment

#### Generate Signing Key

```bash
# Generate release keystore
keytool -genkeypair -v -storetype PKCS12 -keystore finwise-release-key.keystore -alias finwise-key-alias -keyalg RSA -keysize 2048 -validity 10000

# Move to android/app directory
mv finwise-release-key.keystore frontend/android/app/
```

#### Configure Gradle

Update `frontend/android/gradle.properties`:

```properties
MYAPP_RELEASE_STORE_FILE=finwise-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=finwise-key-alias
MYAPP_RELEASE_STORE_PASSWORD=your-keystore-password
MYAPP_RELEASE_KEY_PASSWORD=your-key-password
```

Update `frontend/android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

#### Build Android APK

```bash
cd frontend

# Clean previous builds
npm run clean

# Build release APK
npm run build:android

# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

### 4.3 iOS Deployment

#### Configure Xcode Project

1. Open `frontend/ios/FinWiseAI.xcworkspace` in Xcode
2. Select the project in navigator
3. Update Bundle Identifier: `com.finwise.ai`
4. Set Team and Signing Certificate
5. Update Info.plist with production Firebase config

#### Build iOS Archive

```bash
cd frontend

# Build iOS archive
npm run build:ios

# Or use Xcode:
# Product → Archive → Distribute App → App Store Connect
```

## 🗄️ Step 5: Database & Storage Setup

### 5.1 Deploy Firestore Rules

```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy Storage rules
firebase deploy --only storage
```

### 5.2 Initialize Production Data

Create `scripts/init-production-data.js`:

```javascript
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://finwise-ai-prod-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function initializeProductionData() {
  // Create default categories
  const categories = [
    { id: 'food', name: 'Food & Dining', icon: 'restaurant' },
    { id: 'transport', name: 'Transportation', icon: 'directions-car' },
    { id: 'utilities', name: 'Utilities', icon: 'flash-on' },
    { id: 'entertainment', name: 'Entertainment', icon: 'movie' },
    { id: 'shopping', name: 'Shopping', icon: 'shopping-cart' },
    { id: 'healthcare', name: 'Healthcare', icon: 'local-hospital' },
    { id: 'education', name: 'Education', icon: 'school' },
    { id: 'savings', name: 'Savings', icon: 'account-balance' }
  ];

  for (const category of categories) {
    await db.collection('categories').doc(category.id).set(category);
  }

  console.log('Production data initialized successfully');
}

initializeProductionData().catch(console.error);
```

Run initialization:

```bash
node scripts/init-production-data.js
```

## 🔒 Step 6: Security Configuration

### 6.1 API Security

Update `backend/src/middleware/security.ts`:

```typescript
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
  }),
];
```

### 6.2 Firebase Security Rules

Update `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Transactions belong to authenticated users
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Goals belong to authenticated users
    match /goals/{goalId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Categories are read-only for all authenticated users
    match /categories/{categoryId} {
      allow read: if request.auth != null;
      allow write: if false; // Only admin can modify
    }
  }
}
```

## 📊 Step 7: Monitoring & Analytics

### 7.1 Firebase Analytics

Add to `frontend/src/services/analytics.ts`:

```typescript
import analytics from '@react-native-firebase/analytics';

export const trackEvent = async (eventName: string, parameters?: any) => {
  if (__DEV__) return; // Don't track in development
  
  await analytics().logEvent(eventName, parameters);
};

export const setUserProperties = async (properties: any) => {
  if (__DEV__) return;
  
  await analytics().setUserProperties(properties);
};
```

### 7.2 Error Monitoring

Add Crashlytics to `frontend/src/utils/errorHandler.ts`:

```typescript
import crashlytics from '@react-native-firebase/crashlytics';

export const logError = (error: Error, context?: string) => {
  if (__DEV__) {
    console.error(error);
    return;
  }
  
  crashlytics().recordError(error);
  if (context) {
    crashlytics().log(context);
  }
};
```

## 🚀 Step 8: Final Deployment

### 8.1 Deploy All Services

```bash
# Deploy everything
firebase deploy

# Verify deployment
firebase hosting:channel:list
firebase functions:list
```

### 8.2 App Store Submission

#### Google Play Store

1. Upload APK to Google Play Console
2. Fill out store listing information
3. Set up pricing and distribution
4. Submit for review

#### Apple App Store

1. Upload archive to App Store Connect
2. Fill out app information
3. Submit for review

### 8.3 Production Verification

Create `scripts/verify-production.js`:

```javascript
const axios = require('axios');

const API_BASE_URL = 'https://us-central1-finwise-ai-prod.cloudfunctions.net/api';

async function verifyProduction() {
  try {
    // Test health endpoint
    const health = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ API Health:', health.data);

    // Test authentication endpoint
    const auth = await axios.post(`${API_BASE_URL}/auth/register`, {
      email: 'test@example.com',
      password: 'testpassword123',
      name: 'Test User'
    });
    console.log('✅ Auth working');

    console.log('🎉 Production deployment verified!');
  } catch (error) {
    console.error('❌ Production verification failed:', error.message);
  }
}

verifyProduction();
```

## 📋 Post-Deployment Checklist

- [ ] Backend API responding correctly
- [ ] Firebase services configured
- [ ] Mobile apps built and uploaded
- [ ] Security rules deployed
- [ ] Monitoring and analytics active
- [ ] Production data initialized
- [ ] External API integrations tested
- [ ] Performance monitoring enabled
- [ ] Backup strategy implemented
- [ ] Documentation updated

## 🔧 Troubleshooting

### Common Issues

1. **Firebase Functions timeout**
   - Increase timeout in `firebase.json`
   - Optimize cold start performance

2. **CORS errors**
   - Verify origin configuration
   - Check Firebase hosting rewrites

3. **Mobile app crashes**
   - Check native dependencies
   - Verify signing certificates

4. **API rate limiting**
   - Adjust rate limits
   - Implement request queuing

### Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Documentation](https://reactnative.dev/docs)
- [M-Pesa API Documentation](https://developer.safaricom.co.ke)

## 🎯 Next Steps

After successful deployment:

1. **Monitor Performance**: Set up alerts and monitoring
2. **User Feedback**: Implement feedback collection
3. **A/B Testing**: Test different features
4. **Scaling**: Plan for user growth
5. **Updates**: Set up CI/CD pipeline

---

**🎉 Congratulations! Your FinWise AI application is now live in production!**