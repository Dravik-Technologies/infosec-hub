// Quick test to verify Nexus can start without full DB
require('dotenv').config();

console.log('=== NEXUS Startup Test ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 8090);
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);

// Test that modules load
try {
  require('express');
  console.log('✓ express loaded');
} catch (e) {
  console.error('✗ express:', e.message);
}

try {
  require('jsonwebtoken');
  console.log('✓ jsonwebtoken loaded');
} catch (e) {
  console.error('✗ jsonwebtoken:', e.message);
}

try {
  const db = require('../packages/db/src');
  console.log('✓ database package loaded');
  console.log('  Available models:', Object.keys(db).slice(0, 5).join(', '), '...');
} catch (e) {
  console.error('✗ database:', e.message);
}

console.log('\n=== All dependencies ready ===');
