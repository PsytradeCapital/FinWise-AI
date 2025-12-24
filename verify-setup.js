const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying FinWise AI project setup...\n');

// Check required directories
const requiredDirs = [
  'frontend',
  'backend', 
  'shared',
  'docs',
  '.kiro/specs/finwise-ai-app'
];

console.log('📁 Checking directory structure:');
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}`);
  } else {
    console.log(`❌ ${dir} - MISSING`);
  }
});

// Check required files
const requiredFiles = [
  'package.json',
  'README.md',
  '.gitignore',
  '.eslintrc.js',
  '.prettierrc',
  'firebase.json',
  'firestore.rules',
  'backend/package.json',
  'backend/src/index.ts',
  'frontend/package.json',
  'frontend/src/App.tsx',
  'shared/package.json',
  'shared/src/types/index.ts',
  '.kiro/specs/finwise-ai-app/requirements.md',
  '.kiro/specs/finwise-ai-app/design.md',
  '.kiro/specs/finwise-ai-app/tasks.md'
];

console.log('\n📄 Checking required files:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
  }
});

// Check package.json contents
console.log('\n📦 Checking package configurations:');

try {
  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ Root package: ${rootPkg.name}@${rootPkg.version}`);
} catch (e) {
  console.log('❌ Root package.json - INVALID');
}

try {
  const backendPkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
  console.log(`✅ Backend package: ${backendPkg.name}@${backendPkg.version}`);
} catch (e) {
  console.log('❌ Backend package.json - INVALID');
}

try {
  const frontendPkg = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
  console.log(`✅ Frontend package: ${frontendPkg.name}@${frontendPkg.version}`);
} catch (e) {
  console.log('❌ Frontend package.json - INVALID');
}

try {
  const sharedPkg = JSON.parse(fs.readFileSync('shared/package.json', 'utf8'));
  console.log(`✅ Shared package: ${sharedPkg.name}@${sharedPkg.version}`);
} catch (e) {
  console.log('❌ Shared package.json - INVALID');
}

console.log('\n🎉 Project structure verification complete!');
console.log('\n📋 Next steps:');
console.log('1. Install dependencies in each package:');
console.log('   - cd shared && npm install');
console.log('   - cd backend && npm install');
console.log('   - cd frontend && npm install');
console.log('2. Set up Firebase configuration');
console.log('3. Configure environment variables');
console.log('4. Start development servers');
console.log('\nSee docs/SETUP.md for detailed instructions.');