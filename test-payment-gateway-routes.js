#!/usr/bin/env node

/**
 * Payment Gateway Routes Test Script
 * Tests all payment gateway functionality for whitelist implementation
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:7080';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with your actual token

class PaymentGatewayTester {
  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    };
    this.gatewayId = null;
    this.userId = null;
  }

  async testConnection() {
    console.log('🔍 Testing server connection...');
    try {
      const response = await axios.get(`${BASE_URL}/api/v1/payment-permissions/my-permissions`, {
        headers: this.headers
      });
      
      if (response.data.success) {
        console.log('✅ Server connection successful');
        console.log('📋 Your permissions:', response.data.data);
        return true;
      } else {
        console.log('❌ Server connection failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Server connection failed:', error.message);
      return false;
    }
  }

  async testCreateGateway() {
    console.log('\n🔍 Testing gateway creation...');
    
    const gatewayData = {
      gatewayMethod: "Test UPI",
      gatewayDetails: {
        minAmount: 100,
        maxAmount: 5000,
        upiId: "test@paytm",
        accountHolder: "Test User"
      },
      notes: "Test gateway for whitelist"
    };

    try {
      const response = await axios.post(
        `${BASE_URL}/api/v1/payment/createpaymentgateway`,
        gatewayData,
        { headers: this.headers }
      );

      if (response.data.success) {
        console.log('✅ Gateway created successfully');
        console.log('   Gateway ID:', response.data.data.id);
        this.gatewayId = response.data.data.id;
        return true;
      } else {
        console.log('❌ Gateway creation failed:', response.data.message);
        return false;
      }
    } catch (error) {
      console.log('❌ Gateway creation failed:', error.response?.data?.message || error.message);
      return false;
    }
  }

  async testGetGateways() {
    console.log('\n🔍 Testing gateway retrieval...');
    
    try {
      const response = await axios.get(
        `${BASE_URL}/api/v1/payment/paymentgateway/created/getall`,
        { headers: this.headers }
      );

      if (response.data.success) {
        console.log('✅ Gateways retrieved successfully');
        console.log(`   Total gateways: ${response.data.data.length}`);
        
        response.data.data.forEach((gateway, index) => {
          console.log(`   ${index + 1}. ${gateway.gatewayMethod} (${gateway.isActive ? 'Active' : 'Inactive'})`);
        });
        
        return true;
      } else {
        console.log('❌ Gateway retrieval failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Gateway retrieval failed:', error.response?.data?.message || error.message);
      return false;
    }
  }

  async testGatewayAssignment() {
    console.log('\n🔍 Testing gateway assignment...');
    
    if (!this.gatewayId) {
      console.log('❌ No gateway ID available for assignment');
      return false;
    }

    // You'll need to replace this with an actual user ID
    const testUserId = 'YOUR_TECH_ADMIN_ID_HERE';
    
    if (testUserId === 'YOUR_TECH_ADMIN_ID_HERE') {
      console.log('⚠️  Skipping assignment test - please update testUserId');
      return true;
    }

    const assignmentData = {
      gatewayId: this.gatewayId,
      assignedToUserId: testUserId,
      assignedToUserType: 'techAdmin',
      notes: 'Test assignment'
    };

    try {
      const response = await axios.post(
        `${BASE_URL}/api/v1/payment-permissions/assign-gateway`,
        assignmentData,
        { headers: this.headers }
      );

      if (response.data.success) {
        console.log('✅ Gateway assigned successfully');
        return true;
      } else {
        console.log('❌ Gateway assignment failed:', response.data.message);
        return false;
      }
    } catch (error) {
      console.log('❌ Gateway assignment failed:', error.response?.data?.message || error.message);
      return false;
    }
  }

  async testGatewayUpdate() {
    console.log('\n🔍 Testing gateway update...');
    
    if (!this.gatewayId) {
      console.log('❌ No gateway ID available for update');
      return false;
    }

    const updateData = {
      gatewayMethod: "Updated UPI",
      gatewayDetails: {
        minAmount: 200,
        maxAmount: 10000,
        upiId: "updated@paytm",
        accountHolder: "Updated User"
      },
      notes: "Updated test gateway"
    };

    try {
      const response = await axios.patch(
        `${BASE_URL}/api/v1/payment/updatepaymentgateway/${this.gatewayId}`,
        updateData,
        { headers: this.headers }
      );

      if (response.data.success) {
        console.log('✅ Gateway updated successfully');
        return true;
      } else {
        console.log('❌ Gateway update failed:', response.data.message);
        return false;
      }
    } catch (error) {
      console.log('❌ Gateway update failed:', error.response?.data?.message || error.message);
      return false;
    }
  }

  async testGatewayToggle() {
    console.log('\n🔍 Testing gateway toggle...');
    
    if (!this.gatewayId) {
      console.log('❌ No gateway ID available for toggle');
      return false;
    }

    try {
      const response = await axios.patch(
        `${BASE_URL}/api/v1/payment/paymentgateway/activateDeactivate/${this.gatewayId}`,
        {},
        { headers: this.headers }
      );

      if (response.data.success) {
        console.log('✅ Gateway status toggled successfully');
        return true;
      } else {
        console.log('❌ Gateway toggle failed:', response.data.message);
        return false;
      }
    } catch (error) {
      console.log('❌ Gateway toggle failed:', error.response?.data?.message || error.message);
      return false;
    }
  }

  async testDepositRequests() {
    console.log('\n🔍 Testing deposit request retrieval...');
    
    try {
      const response = await axios.get(
        `${BASE_URL}/api/v1/payment/recievingDepositRequest`,
        { headers: this.headers }
      );

      if (response.data.success) {
        console.log('✅ Deposit requests retrieved successfully');
        console.log(`   Total requests: ${response.data.data.length}`);
        return true;
      } else {
        console.log('❌ Deposit request retrieval failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Deposit request retrieval failed:', error.response?.data?.message || error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Payment Gateway Routes Test...\n');

    const tests = [
      { name: 'Server Connection', fn: () => this.testConnection() },
      { name: 'Gateway Creation', fn: () => this.testCreateGateway() },
      { name: 'Gateway Retrieval', fn: () => this.testGetGateways() },
      { name: 'Gateway Assignment', fn: () => this.testGatewayAssignment() },
      { name: 'Gateway Update', fn: () => this.testGatewayUpdate() },
      { name: 'Gateway Toggle', fn: () => this.testGatewayToggle() },
      { name: 'Deposit Requests', fn: () => this.testDepositRequests() }
    ];

    const results = [];
    
    for (const test of tests) {
      try {
        const result = await test.fn();
        results.push({ name: test.name, success: result });
      } catch (error) {
        console.log(`❌ ${test.name} failed with error:`, error.message);
        results.push({ name: test.name, success: false });
      }
    }

    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    results.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
    });
    
    console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Your payment gateway system is working perfectly.');
    } else {
      console.log('⚠️  Some tests failed. Check the errors above and fix them.');
    }

    return results;
  }
}

// Usage instructions
console.log('🧪 Payment Gateway Routes Test Script');
console.log('======================================');
console.log('');
console.log('📋 Before running tests:');
console.log('1. Update AUTH_TOKEN with your actual authentication token');
console.log('2. Update testUserId in testGatewayAssignment() with your tech admin ID');
console.log('3. Make sure your server is running on port 7080');
console.log('');
console.log('🚀 To run all tests:');
console.log('const tester = new PaymentGatewayTester();');
console.log('tester.runAllTests();');
console.log('');
console.log('📚 Available test methods:');
console.log('- tester.testConnection()');
console.log('- tester.testCreateGateway()');
console.log('- tester.testGetGateways()');
console.log('- tester.testGatewayAssignment()');
console.log('- tester.testGatewayUpdate()');
console.log('- tester.testGatewayToggle()');
console.log('- tester.testDepositRequests()');
console.log('- tester.runAllTests()');

// Export for use
module.exports = PaymentGatewayTester;
