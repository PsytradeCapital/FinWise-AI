# 🔧 Vercel Backend Fix Guide

## 🎯 **Issue**: Backend returning 500 error

The backend is deployed but returning a 500 error, likely due to Firebase initialization issues.

## 🛠️ **Quick Fix Steps**

### **Step 1: Test Environment Variables**
```bash
# Test if environment variables are working
node backend/test-local.js
```

### **Step 2: Check Vercel Logs**
```bash
vercel logs https://fin-wise-ai-iota.vercel.app
```

### **Step 3: Create Local Environment File**
Create `backend/.env.local` with your environment variables for testing:

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"finwise-ai-prod",...}
FIREBASE_DATABASE_URL=https://finwise-ai-prod-default-rtdb.firebaseio.com/
FIREBASE_STORAGE_BUCKET=finwise-ai-prod.appspot.com
JWT_SECRET=finwise-ai-super-secure-jwt-secret-key-2024-production
MASTER_ENCRYPTION_KEY=finwise-ai-master-encryption-key-2024-secure-production
```

### **Step 4: Test Locally**
```bash
cd backend
npm run dev
```

### **Step 5: Fix and Redeploy**
```bash
vercel --prod
```

## 📱 **Meanwhile: Build Your Mobile App**

While we fix the backend, you can start building your mobile app:

### **Build APK for Your Phone**
```bash
cd frontend
expo build:android --type=apk
```

This will:
1. Build your React Native app
2. Create an APK file
3. Give you a download link
4. You can install it directly on your phone!

### **Build for Google Play Store**
```bash
cd frontend
expo build:android --type=app-bundle
```

This creates the .aab file needed for Google Play Store submission.

## 🏪 **Google Play Store Process**

1. **Sign up**: https://play.google.com/console ($25 fee)
2. **Create app**: Add FinWise AI details
3. **Upload**: Use the .aab file from Expo
4. **Submit**: Usually approved in 1-3 days

## ⚡ **Quick Mobile Install**

Want to test on your phone right now?

```bash
cd frontend
expo start
```

Then:
1. Install "Expo Go" app on your phone
2. Scan the QR code
3. Your app will load instantly!

Your FinWise AI app is almost ready for the world! 🚀