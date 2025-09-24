#!/bin/bash

# Script to grant permissions from Developer to Tech Admin
# This script demonstrates the complete workflow

echo "🔍 DEVELOPER → TECH ADMIN PERMISSION GRANTING"
echo "=============================================="
echo ""

# Configuration
BASE_URL="http://localhost:7080/api/v1"
DEVELOPER_TOKEN="your-developer-jwt-token-here"
TECH_ADMIN_ID="6ba14032-8ae7-43bf-bae3-559b8ab9ef24"  # Replace with actual tech admin ID
GATEWAY_ID="your-gateway-uuid-here"  # Replace with actual gateway ID

echo "📋 STEP 1: GET TECH ADMINS LIST"
echo "================================"
echo ""

echo "Making request to get tech admins..."
curl -X GET \
  "${BASE_URL}/payment-permissions/techadmins-for-grant" \
  -H "Authorization: Bearer ${DEVELOPER_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "📋 STEP 2: GRANT PERMISSIONS"
echo "============================"
echo ""

echo "Granting permissions to tech admin: ${TECH_ADMIN_ID}"
curl -X POST \
  "${BASE_URL}/payment-permissions/grant-techadmin-permissions/${TECH_ADMIN_ID}" \
  -H "Authorization: Bearer ${DEVELOPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "gatewayId": "'${GATEWAY_ID}'",
    "permissions": {
      "canCreateGateway": true,
      "canManageGateway": true,
      "canAssignGateway": true,
      "canProcessRequests": true
    },
    "restrictions": {
      "maxGateways": 5,
      "maxAmount": 10000,
      "allowedGatewayTypes": ["UPI", "Bank Transfer"]
    },
    "notes": "Full permissions granted by developer"
  }' \
  | jq '.'

echo ""
echo "📋 STEP 3: VERIFY PERMISSIONS"
echo "============================="
echo ""

echo "Checking tech admin permissions..."
curl -X GET \
  "${BASE_URL}/payment-permissions/check-permissions/${TECH_ADMIN_ID}" \
  -H "Authorization: Bearer ${DEVELOPER_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "✅ PERMISSION GRANTING COMPLETE!"
echo "================================"
echo ""
echo "The tech admin should now have:"
echo "- canCreateGateway: true"
echo "- canManageGateway: true"
echo "- canAssignGateway: true"
echo "- canProcessRequests: true"
echo "- depositWithdrawlAccess: true"
echo ""
echo "They can now grant permissions to admins!"

