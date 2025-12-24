@echo off
echo Checking FinWise AI Setup...
echo ================================

echo.
echo Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please restart your terminal after installing Node.js 20+
    goto :end
)

echo.
echo Checking npm...
npm --version
if %errorlevel% neq 0 (
    echo ❌ npm not found
    goto :end
)

echo.
echo Checking Firebase CLI...
firebase --version
if %errorlevel% neq 0 (
    echo ❌ Firebase CLI not found. Run: npm install -g firebase-tools
    goto :end
)

echo.
echo ✅ All tools are installed!
echo.
echo Next steps:
echo 1. Run: firebase login
echo 2. Run: firebase init
echo 3. Run: firebase deploy

:end
pause