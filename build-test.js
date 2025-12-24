const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Testing build process...');

try {
  // Test backend build
  console.log('Building backend...');
  const backendPath = path.join(__dirname, 'backend');
  
  // Change to backend directory and run build
  process.chdir(backendPath);
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('✅ Backend build successful!');
  
  // Change back to root
  process.chdir(__dirname);
  
  // Test frontend typecheck
  console.log('Checking frontend TypeScript...');
  const frontendPath = path.join(__dirname, 'frontend');
  
  process.chdir(frontendPath);
  execSync('npm run typecheck', { stdio: 'inherit' });
  
  console.log('✅ Frontend TypeScript check successful!');
  
  console.log('🎉 All builds completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}