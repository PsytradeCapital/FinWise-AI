@echo off
echo ========================================
echo FinWise AI - Android Environment Setup
echo ========================================
echo.

echo This script will help you configure your Android development environment.
echo Please follow the instructions carefully.
echo.

echo Step 1: Checking if Android Studio is installed...
if exist "C:\Program Files\Android\Android Studio\bin\studio64.exe" (
    echo ✓ Android Studio found at: C:\Program Files\Android\Android Studio\
) else (
    echo ✗ Android Studio not found in default location.
    echo Please install Android Studio from: https://developer.android.com/studio
    echo After installation, run this script again.
    pause
    exit /b 1
)

echo.
echo Step 2: Checking for Android SDK...
set "DEFAULT_SDK_PATH=%LOCALAPPDATA%\Android\Sdk"
if exist "%DEFAULT_SDK_PATH%" (
    echo ✓ Android SDK found at: %DEFAULT_SDK_PATH%
    set "ANDROID_SDK_PATH=%DEFAULT_SDK_PATH%"
) else (
    echo ✗ Android SDK not found in default location: %DEFAULT_SDK_PATH%
    echo.
    echo Please open Android Studio and:
    echo 1. Go to File → Settings → Appearance & Behavior → System Settings → Android SDK
    echo 2. Note the SDK Location path
    echo 3. Install Android SDK Platform 33 and Android SDK Build-Tools 33.0.0
    echo 4. Run this script again
    pause
    exit /b 1
)

echo.
echo Step 3: Setting up environment variables...
echo Setting ANDROID_HOME to: %ANDROID_SDK_PATH%
setx ANDROID_HOME "%ANDROID_SDK_PATH%" /M

echo Setting JAVA_HOME...
if exist "C:\Program Files\Android\Android Studio\jre" (
    setx JAVA_HOME "C:\Program Files\Android\Android Studio\jre" /M
    echo ✓ JAVA_HOME set to Android Studio JRE
) else (
    echo ✗ Android Studio JRE not found. Please check your Android Studio installation.
)

echo.
echo Step 4: Adding Android tools to PATH...
set "NEW_PATH=%ANDROID_SDK_PATH%\platform-tools;%ANDROID_SDK_PATH%\tools;%ANDROID_SDK_PATH%\tools\bin"

echo Adding to PATH: %NEW_PATH%
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "CURRENT_PATH=%%B"

echo %CURRENT_PATH% | findstr /C:"%ANDROID_SDK_PATH%\platform-tools" >nul
if errorlevel 1 (
    setx PATH "%CURRENT_PATH%;%NEW_PATH%" /M
    echo ✓ Android tools added to PATH
) else (
    echo ✓ Android tools already in PATH
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo IMPORTANT: You must restart your computer or at minimum:
echo 1. Close all command prompts and IDEs
echo 2. Restart your development environment
echo.
echo After restart, run the following commands to verify:
echo   adb version
echo   npx react-native doctor
echo.
echo If you see any errors, please:
echo 1. Open Android Studio
echo 2. Go to SDK Manager and install:
echo    - Android SDK Platform 33
echo    - Android SDK Build-Tools 33.0.0
echo    - Android SDK Command-line Tools
echo    - Android SDK Platform-Tools
echo.
pause