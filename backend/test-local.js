// Simple test to check if environment variables are working
console.log('Testing environment variables...');
console.log('FIREBASE_SERVICE_ACCOUNT_KEY:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'SET' : 'NOT SET');
console.log('FIREBASE_DATABASE_URL:', process.env.FIREBASE_DATABASE_URL ? 'SET' : 'NOT SET');
console.log('FIREBASE_STORAGE_BUCKET:', process.env.FIREBASE_STORAGE_BUCKET ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('MASTER_ENCRYPTION_KEY:', process.env.MASTER_ENCRYPTION_KEY ? 'SET' : 'NOT SET');

// Test Firebase JSON parsing
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('Firebase JSON parsed successfully');
    console.log('Project ID:', parsed.project_id);
  } catch (error) {
    console.error('Failed to parse Firebase JSON:', error.message);
  }
}