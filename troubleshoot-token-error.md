# 🔧 Troubleshooting Token Error: "Invalid user type: "

## 🚨 Problem
You're getting this error when using the token-only permission check:
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Invalid user type: "
}
```

## 🔍 Root Cause
The error "Invalid user type: " (with empty string) indicates that:
1. Your token is being decoded successfully
2. But the `userType` field in the token is empty or undefined
3. The system can't determine which user table to query

## 🛠️ Troubleshooting Steps

### Step 1: Debug Your Token
First, let's see what's in your token:

```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/debug-token" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "debug": {
    "hasUser": true,
    "userId": "your-user-uuid",
    "userType": "techAdmin",  // This should NOT be empty
    "userObject": { ... },
    "headers": {
      "authorization": "Present",
      "contentType": "Not set"
    }
  }
}
```

### Step 2: Check Your Token Generation
The issue is likely in how your JWT token is created. Check your login/authentication code:

```javascript
// When creating the token, make sure userType is included
const token = jwt.sign({
  userId: user.id,
  userType: user.userType,  // This should be 'techAdmin', 'admin', etc.
  // ... other fields
}, secretKey);
```

### Step 3: Verify User Type Values
Make sure your user types match the expected values:

**Valid User Types:**
- `developer`
- `techAdmin`
- `admin`
- `miniAdmin`
- `superMaster`
- `master`
- `superAgent`
- `agent`
- `client`

### Step 4: Check Your Authentication Middleware
Verify that your authentication middleware is properly extracting the user info:

```javascript
// In your auth middleware
const decoded = jwt.verify(token, secretKey);
req.user = {
  userId: decoded.userId,
  userType: decoded.userType,  // Make sure this is set
  // ... other fields
};
```

## 🔧 Quick Fixes

### Fix 1: Update Token Generation
If you're generating tokens manually, make sure to include userType:

```javascript
// Login controller
const generateToken = (user) => {
  return jwt.sign({
    userId: user.id,
    userType: user.userType || 'client',  // Default to 'client' if not set
    groupId: user.groupID,
    // ... other fields
  }, process.env.JWT_SECRET, { expiresIn: '24h' });
};
```

### Fix 2: Update User Entity
Make sure your user entities have the correct userType field:

```typescript
// In your user entity
@Column({ type: 'varchar', length: 50 })
userType!: string;  // Make sure this field exists
```

### Fix 3: Update Login Response
Ensure your login response includes the userType:

```javascript
// Login response
res.json({
  success: true,
  data: {
    user: {
      id: user.id,
      userType: user.userType,  // Include this
      // ... other fields
    },
    token: generateToken(user)
  }
});
```

## 🧪 Test Your Fix

### Test 1: Debug Token
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/debug-token" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 2: Check Permissions
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 3: Check My Permissions
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/my-permissions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📋 Common Issues & Solutions

### Issue 1: Token Missing userType
**Problem:** Token doesn't contain userType field
**Solution:** Update token generation to include userType

### Issue 2: userType is null/undefined
**Problem:** userType exists but is null
**Solution:** Set default userType or fix user data

### Issue 3: Wrong userType value
**Problem:** userType has invalid value (e.g., 'TechAdmin' instead of 'techAdmin')
**Solution:** Use correct case-sensitive values

### Issue 4: Authentication middleware not setting req.user
**Problem:** Middleware not properly extracting token data
**Solution:** Fix authentication middleware

## 🚀 Working Example

### Correct Token Generation:
```javascript
const loginUser = async (req, res) => {
  const { loginId, password } = req.body;
  
  // Find user
  const user = await findUserByLoginId(loginId);
  
  // Generate token with userType
  const token = jwt.sign({
    userId: user.id,
    userType: user.userType,  // This is crucial!
    groupId: user.groupID,
    loginId: user.loginId
  }, process.env.JWT_SECRET, { expiresIn: '24h' });
  
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        userType: user.userType,
        loginId: user.loginId
      },
      token
    }
  });
};
```

### Correct Authentication Middleware:
```javascript
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    
    req.user = {
      userId: decoded.userId,
      userType: decoded.userType,  // Make sure this is set
      groupId: decoded.groupId,
      loginId: decoded.loginId
    };
    
    next();
  });
};
```

## ✅ Success Indicators

When fixed, you should see:
1. **Debug token** shows valid userType
2. **Permission check** returns success with permissions
3. **No more "Invalid user type"** errors

## 🆘 Still Having Issues?

If you're still getting errors:
1. Check the server logs for the debug output
2. Verify your JWT secret is correct
3. Make sure your user entities have userType field
4. Test with a fresh token after fixing the issue

The key is ensuring your token contains a valid `userType` field! 🔑
