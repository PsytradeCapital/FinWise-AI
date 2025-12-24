@echo off
echo FinWise AI Deployment Script for Windows
echo ========================================

echo.
echo Step 1: Installing Firebase CLI...
npm install -g firebase-tools

echo.
echo Step 2: Building all packages...
call npm run build:all

echo.
echo Step 3: Logging into Firebase...
firebase login

echo.
echo Step 4: Setting up Firebase project...
firebase use --add

echo.
echo Step 5: Deploying to Firebase...
firebase deploy

echo.
echo Deployment complete!
echo Your backend is now live on Firebase Functions
echo Check the Firebase Console for your function URLs
pause