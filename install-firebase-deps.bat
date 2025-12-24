@echo off
echo Installing Firebase Functions dependencies...
cd backend
npm install firebase-functions firebase-functions-test
echo Dependencies installed successfully!
cd ..
pause