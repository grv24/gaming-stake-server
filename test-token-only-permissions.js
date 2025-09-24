#!/usr/bin/env node

/**
 * Test Payment Gateway Permissions Using Token Only
 * Simple script to test permission checking with just a token
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:7080';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with your actual token

class TokenOnlyPermissionTester {
  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    };
  }

  async testTokenOnlyPermissions() {
    console.log('🔍 Testing Payment Gateway Permissions with Token Only...\n');

    try {
      // Test 1: Check permissions using token only (no userId needed)
      console.log('Test 1: Checking permissions with token only...');
      const response = await axios.get(
        `${BASE_URL}/api/v1/payment-permissions/check-permissions`,
        { headers: this.headers }
      );

      if (response.data.success) {
        console.log('✅ Token-only permission check successful!');
        console.log('📋 Your Payment Gateway Permissions:');
        console.log(`   User ID: ${response.data.data.userId}`);
        console.log(`   User Type: ${response.data.data.userType}`);
        console.log(`   User Name: ${response.data.data.userName}`);
        console.log(`   Has Permissions: ${response.data.data.hasPaymentGatewayPermissions ? '✅' : '❌'}`);
        console.log('');
        console.log('🔐 Detailed Permissions:');
        console.log(`   - Can Create Gateways: ${response.data.data.permissions.canCreateGateways ? '✅' : '❌'}`);
        console.log(`   - Can Manage Gateways: ${response.data.data.permissions.canManageGateways ? '✅' : '❌'}`);
        console.log(`   - Can Assign Gateways: ${response.data.data.permissions.canAssignGateways ? '✅' : '❌'}`);
        console.log(`   - Can Process Requests: ${response.data.data.permissions.canProcessRequests ? '✅' : '❌'}`);
        console.log('');
        console.log('📊 Gateway Statistics:');
        console.log(`   - Assigned Gateways: ${response.data.data.gatewayStats.assignedGatewaysCount}`);
        console.log(`   - Created Gateways: ${response.data.data.gatewayStats.createdGatewaysCount}`);
        
        return response.data.data;
      } else {
        console.log('❌ Token-only permission check failed:', response.data.message);
        return null;
      }

    } catch (error) {
      console.log('❌ Error testing token-only permissions:');
      console.log(`   ${error.response?.data?.message || error.message}`);
      return null;
    }
  }

  async testMyPermissions() {
    console.log('\n🔍 Testing "My Permissions" endpoint...');

    try {
      const response = await axios.get(
        `${BASE_URL}/api/v1/payment-permissions/my-permissions`,
        { headers: this.headers }
      );

      if (response.data.success) {
        console.log('✅ My permissions check successful!');
        console.log('📋 My Payment Gateway Permissions:');
        console.log(`   User ID: ${response.data.data.userId}`);
        console.log(`   User Type: ${response.data.data.userType}`);
        console.log('🔐 Permissions:');
        Object.entries(response.data.data.permissions).forEach(([key, value]) => {
          console.log(`   - ${key}: ${value ? '✅' : '❌'}`);
        });
        
        return response.data.data;
      } else {
        console.log('❌ My permissions check failed:', response.data.message);
        return null;
      }

    } catch (error) {
      console.log('❌ Error testing my permissions:');
      console.log(`   ${error.response?.data?.message || error.message}`);
      return null;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Token-Only Permission Tests...\n');

    const results = [];
    
    // Test 1: Token-only permissions
    const tokenResult = await this.testTokenOnlyPermissions();
    results.push({ test: 'Token-Only Permissions', success: !!tokenResult });

    // Test 2: My permissions
    const myResult = await this.testMyPermissions();
    results.push({ test: 'My Permissions', success: !!myResult });

    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    results.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.test}`);
    });
    
    console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All token-only permission tests passed!');
      console.log('\n💡 You can now use these simple endpoints:');
      console.log('   - GET /api/v1/payment-permissions/check-permissions (token only)');
      console.log('   - GET /api/v1/payment-permissions/my-permissions (token only)');
    } else {
      console.log('⚠️  Some tests failed. Check your token and server connection.');
    }

    return results;
  }
}

// Usage instructions
console.log('🔐 Token-Only Payment Gateway Permission Tester');
console.log('===============================================');
console.log('');
console.log('📋 Before running tests:');
console.log('1. Update AUTH_TOKEN with your actual authentication token');
console.log('2. Make sure your server is running on port 7080');
console.log('');
console.log('🚀 To run all tests:');
console.log('const tester = new TokenOnlyPermissionTester();');
console.log('tester.runAllTests();');
console.log('');
console.log('📚 Available test methods:');
console.log('- tester.testTokenOnlyPermissions()');
console.log('- tester.testMyPermissions()');
console.log('- tester.runAllTests()');
console.log('');
console.log('🔗 Simple API Usage:');
console.log('curl -X GET http://localhost:7080/api/v1/payment-permissions/check-permissions \\');
console.log('  -H "Authorization: Bearer YOUR_TOKEN"');
console.log('');
console.log('curl -X GET http://localhost:7080/api/v1/payment-permissions/my-permissions \\');
console.log('  -H "Authorization: Bearer YOUR_TOKEN"');

// Export for use
module.exports = TokenOnlyPermissionTester;
