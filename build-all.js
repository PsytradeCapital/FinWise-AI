#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting comprehensive build process...\n');

// Helper function to run commands
function runCommand(command, cwd = process.cwd()) {
  try {
    console.log(`📁 Running in: ${cwd}`);
    console.log(`⚡ Command: ${command}`);
    
    const result = execSync(command, { 
      cwd, 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    
    console.log('✅ Success!\n');
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    return false;
  }
}

// Check if directory exists
function dirExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

async function buildAll() {
  const rootDir = process.cwd();
  
  // 1. Build shared package
  console.log('📦 Building shared package...');
  const sharedDir = path.join(rootDir, 'shared');
  if (dirExists(sharedDir)) {
    if (!runCommand('npm run build', sharedDir)) {
      console.error('Failed to build shared package');
      process.exit(1);
    }
  } else {
    console.log('⚠️  Shared directory not found, skipping...');
  }

  // 2. Build backend
  console.log('🔧 Building backend...');
  const backendDir = path.join(rootDir, 'backend');
  if (dirExists(backendDir)) {
    if (!runCommand('npm run build', backendDir)) {
      console.error('Failed to build backend');
      process.exit(1);
    }
  } else {
    console.log('⚠️  Backend directory not found, skipping...');
  }

  // 3. TypeCheck frontend (React Native doesn't need compilation)
  console.log('🔍 Type-checking frontend...');
  const frontendDir = path.join(rootDir, 'frontend');
  if (dirExists(frontendDir)) {
    if (!runCommand('npm run typecheck', frontendDir)) {
      console.error('Frontend type check failed');
      process.exit(1);
    }
  } else {
    console.log('⚠️  Frontend directory not found, skipping...');
  }

  console.log('🎉 All builds completed successfully!');
}

async function testAll() {
  const rootDir = process.cwd();
  
  console.log('\n🧪 Running all tests...\n');

  // 1. Test shared package
  console.log('🔬 Testing shared package...');
  const sharedDir = path.join(rootDir, 'shared');
  if (dirExists(sharedDir)) {
    if (!runCommand('npm test', sharedDir)) {
      console.log('⚠️  Shared tests failed, continuing...');
    }
  }

  // 2. Test backend
  console.log('🔬 Testing backend...');
  const backendDir = path.join(rootDir, 'backend');
  if (dirExists(backendDir)) {
    if (!runCommand('npm test', backendDir)) {
      console.log('⚠️  Backend tests failed, continuing...');
    }
  }

  // 3. Test frontend
  console.log('🔬 Testing frontend...');
  const frontendDir = path.join(rootDir, 'frontend');
  if (dirExists(frontendDir)) {
    if (!runCommand('npm test', frontendDir)) {
      console.log('⚠️  Frontend tests failed, continuing...');
    }
  }

  console.log('🎉 Test suite completed!');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test-only')) {
    await testAll();
  } else if (args.includes('--build-only')) {
    await buildAll();
  } else {
    await buildAll();
    await testAll();
  }
}

main().catch(console.error);