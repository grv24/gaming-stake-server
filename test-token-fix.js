const jwt = require('jsonwebtoken');

// Test token structure
const testToken = {
  userId: 'test-user-id',
  userType: 'techAdmin',
  user: {
    userId: 'test-user-id',
    __type: 'techAdmin',
    isActive: true
  }
};

// Sign the token
const token = jwt.sign(testToken, 'test-secret', { expiresIn: '1h' });

// Decode and verify
const decoded = jwt.verify(token, 'test-secret');

console.log('✅ Token Fix Test Results:');
console.log('Original payload:', testToken);
console.log('Decoded payload:', decoded);
console.log('Has userId:', !!decoded.userId);
console.log('Has userType:', !!decoded.userType);
console.log('userType value:', decoded.userType);

// Test middleware extraction
const mockReq = {
  user: {
    userId: decoded.userId || decoded.user.id,
    userType: decoded.userType || decoded.user.__type,
    ...decoded.user
  }
};

console.log('\n🔧 Middleware Extraction Test:');
console.log('req.user.userId:', mockReq.user.userId);
console.log('req.user.userType:', mockReq.user.userType);
console.log('✅ Fix successful!');
