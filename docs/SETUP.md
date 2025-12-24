# FinWise AI Setup Guide

This guide will help you set up the FinWise AI development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **React Native CLI**: `npm install -g react-native-cli`
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Firebase CLI**: `npm install -g firebase-tools`

## Project Structure

```
finwise-ai/
├── frontend/          # React Native mobile application
├── backend/           # Node.js API server
├── shared/            # Shared types and utilities
├── docs/              # Documentation
└── .kiro/             # Kiro specifications
```

## Installation Steps

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install shared package dependencies
cd shared && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication, Firestore, and Storage
3. Download the service account key JSON file
4. Copy `backend/.env.example` to `backend/.env`
5. Update the Firebase configuration in `.env`

### 3. Environment Configuration

#### Backend (.env)
```bash
cp backend/.env.example backend/.env
```

Update the following variables:
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Your Firebase service account JSON
- `FIREBASE_DATABASE_URL`: Your Firestore database URL
- `FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket
- `JWT_SECRET`: A secure random string
- External API keys (M-Pesa, Nabo Capital, etc.)

### 4. Database Setup

```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 5. Development

#### Start Backend Server
```bash
npm run dev:backend
# or
cd backend && npm run dev
```

#### Start React Native Metro
```bash
npm run dev:frontend
# or
cd frontend && npm start
```

#### Run on Device/Emulator
```bash
# Android
cd frontend && npm run android

# iOS (macOS only)
cd frontend && npm run ios
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Backend Tests
```bash
npm run test:backend
```

### Run Frontend Tests
```bash
npm run test:frontend
```

### Run Tests with Coverage
```bash
cd backend && npm run test:coverage
cd frontend && npm run test:coverage
```

## Code Quality

### Linting
```bash
npm run lint
```

### Formatting
```bash
npm run format
```

## Troubleshooting

### Common Issues

1. **Metro bundler issues**: Run `npm run reset-cache` in frontend directory
2. **Android build issues**: Clean and rebuild with `cd frontend && npm run clean`
3. **iOS build issues**: Clean Xcode build folder and rebuild
4. **Firebase connection issues**: Verify service account key and permissions

### Development Tools

- **Firebase Emulator**: Run `firebase emulators:start` for local development
- **React Native Debugger**: For debugging React Native apps
- **Flipper**: For advanced debugging and profiling

## Next Steps

After setup is complete:

1. Review the requirements document: `.kiro/specs/finwise-ai-app/requirements.md`
2. Check the design document: `.kiro/specs/finwise-ai-app/design.md`
3. Follow the implementation plan: `.kiro/specs/finwise-ai-app/tasks.md`

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the project documentation in the `docs/` directory
- Consult the Kiro specifications in `.kiro/specs/finwise-ai-app/`