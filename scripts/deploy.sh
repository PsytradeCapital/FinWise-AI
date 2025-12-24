#!/bin/bash

# FinWise AI Deployment Script
# This script automates the deployment process

set -e  # Exit on any error

echo "🚀 Starting FinWise AI Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    print_error "Please login to Firebase first:"
    echo "firebase login"
    exit 1
fi

# Step 1: Clean and build all packages
print_status "Cleaning and building all packages..."
npm run clean
npm run build

# Step 2: Run tests
print_status "Running tests..."
npm test

if [ $? -ne 0 ]; then
    print_error "Tests failed. Please fix them before deploying."
    exit 1
fi

# Step 3: Deploy Firestore rules and indexes
print_status "Deploying Firestore rules and indexes..."
firebase deploy --only firestore

# Step 4: Deploy Storage rules
print_status "Deploying Storage rules..."
firebase deploy --only storage

# Step 5: Deploy Functions
print_status "Deploying Firebase Functions..."
firebase deploy --only functions

# Step 6: Deploy Hosting (if applicable)
if [ -d "frontend/build" ]; then
    print_status "Deploying Frontend to Firebase Hosting..."
    firebase deploy --only hosting
fi

# Step 7: Verify deployment
print_status "Verifying deployment..."
sleep 5  # Wait for deployment to propagate

# Get the function URL
FUNCTION_URL=$(firebase functions:list | grep "api" | awk '{print $4}' | head -1)

if [ -n "$FUNCTION_URL" ]; then
    # Test health endpoint
    if curl -f -s "${FUNCTION_URL}/health" > /dev/null; then
        print_status "Backend API is responding correctly"
    else
        print_warning "Backend API health check failed"
    fi
else
    print_warning "Could not determine function URL for verification"
fi

print_status "Deployment completed successfully! 🎉"

echo ""
echo "📋 Next Steps:"
echo "1. Test the deployed application thoroughly"
echo "2. Update mobile app configuration with production URLs"
echo "3. Build and deploy mobile apps to app stores"
echo "4. Monitor logs and performance"
echo ""
echo "🔗 Useful Commands:"
echo "  View logs: firebase functions:log"
echo "  View console: https://console.firebase.google.com"
echo ""