@echo off
echo ========================================
echo FinWise AI - Android Build Test
echo ========================================
echo.

cd /d "%~dp0\frontend"

echo Step 1: Checking React Native environment...
echo Running: npx react-native doctor
npx react-native doctor
if errorlevel 1 (
    echo.
    echo ✗ React Native doctor found issues.
    echo Please run setup-android-env.bat first and restart your computer.
    pause
    exit /b 1
)

echo.
echo Step 2: Cleaning previous builds...
echo Running: npx react-native clean
npx react-native clean

echo.
echo Step 3: Installing dependencies...
echo Running: npm install
npm install

echo.
echo Step 4: Testing Android build (Debug)...
echo.
echo IMPORTANT: Make sure you have either:
echo 1. An Android device connected with USB debugging enabled, OR
echo 2. An Android Virtual Device (AVD) running in Android Studio
echo.
pause

echo Running: npx react-native run-android
npx react-native run-android
if errorlevel 1 (
    echo.
    echo ✗ Android debug build failed.
    echo Common solutions:
    echo 1. Make sure an Android device/emulator is connected
    echo 2. Check that USB debugging is enabled on your device
    echo 3. Try running: adb devices (should show your device)
    echo 4. Restart ADB: adb kill-server && adb start-server
    pause
    exit /b 1
)

echo.
echo ✓ Android debug build successful!
echo.
echo Step 5: Testing Release APK generation...
echo Running: cd android && gradlew assembleRelease
cd android
call gradlew assembleRelease
if errorlevel 1 (
    echo.
    echo ✗ Release APK generation failed.
    echo This might be due to signing configuration or build issues.
    cd ..
    pause
    exit /b 1
)

cd ..
echo.
echo ✓ Release APK generated successfully!
echo APK location: frontend\android\app\build\outputs\apk\release\app-release.apk
echo.
echo ========================================
echo All Android build tests passed! 🎉
echo ========================================
echo.
echo Your FinWise AI app is ready for Android deployment.
echo.
pause