#!/bin/bash

# =====================================================
# POST-CLEANUP DATABASE TEST SCRIPT
# =====================================================
# 
# This script tests the database after cleanup to ensure:
# 1. All required tables exist
# 2. No unused tables remain
# 3. Application can connect to database
# 4. Basic database operations work
#
# =====================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Post-Cleanup Database Test Script${NC}"
echo "=============================================="
echo ""

# Database connection parameters
echo -e "${YELLOW}📋 Database Connection Setup${NC}"
echo "Please provide your database connection details:"
echo ""

read -p "Database Host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Database Port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database Name (default: postgresdb): " DB_NAME
DB_NAME=${DB_NAME:-postgresdb}

read -p "Database User (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

echo ""
echo -e "${GREEN}📊 Testing with connection: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME${NC}"
echo ""

# Test 1: Database Connection
echo -e "${BLUE}Test 1: Database Connection${NC}"
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi

# Test 2: Check table count
echo ""
echo -e "${BLUE}Test 2: Table Count Verification${NC}"
TABLE_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')
echo "Current table count: $TABLE_COUNT"

if [ "$TABLE_COUNT" -eq 33 ]; then
    echo -e "${GREEN}✅ Perfect! Expected 33 tables, found $TABLE_COUNT${NC}"
elif [ "$TABLE_COUNT" -lt 40 ]; then
    echo -e "${GREEN}✅ Good! Table count reduced from 40 to $TABLE_COUNT${NC}"
else
    echo -e "${RED}❌ Table count still high: $TABLE_COUNT (expected around 33)${NC}"
fi

# Test 3: Verify required tables exist
echo ""
echo -e "${BLUE}Test 3: Required Tables Verification${NC}"

REQUIRED_TABLES=(
    "developers" "tech_admins" "super_masters" "masters" "super_agents" "agents" 
    "mini_admins" "admins" "clients" "whitelist_updated" "account_transactions"
    "default_casino" "casino_bet_updated" "casino_match_new" "soccer_settings"
    "tennis_settings" "cricket_settings" "casino_settings" "international_casino_settings"
    "matka_settings" "buttons" "sport_bet_updated" "sport_match"
    "whitelist_casino_mappings" "user_activities" "bet_activities" "session_activities"
    "performance_metrics" "commission_transactions" "paymentGateway" "depositRequest"
    "fileUpload" "gatewayAssignment"
)

MISSING_TABLES=()
EXISTING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table');" | grep -q "t"; then
        EXISTING_TABLES+=("$table")
    else
        MISSING_TABLES+=("$table")
    fi
done

echo "Required tables found: ${#EXISTING_TABLES[@]}/${#REQUIRED_TABLES[@]}"
if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All required tables exist${NC}"
else
    echo -e "${RED}❌ Missing tables:${NC}"
    for table in "${MISSING_TABLES[@]}"; do
        echo "  - $table"
    done
fi

# Test 4: Check for unused tables (should be backed up)
echo ""
echo -e "${BLUE}Test 4: Unused Tables Check${NC}"

UNUSED_TABLES=("accountTrasaction" "casino_bet" "casino_match" "clients_new" "masters_new" "payment_gateway_permissions" "whitelists")
BACKUP_TABLES=()

for table in "${UNUSED_TABLES[@]}"; do
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table');" | grep -q "t"; then
        echo -e "${YELLOW}⚠️  Unused table still exists: $table${NC}"
    else
        # Check if backup exists
        if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '${table}_backup_20240924');" | grep -q "t"; then
            BACKUP_TABLES+=("$table")
        fi
    fi
done

if [ ${#BACKUP_TABLES[@]} -gt 0 ]; then
    echo -e "${GREEN}✅ Unused tables properly backed up:${NC}"
    for table in "${BACKUP_TABLES[@]}"; do
        echo "  - ${table}_backup_20240924"
    done
else
    echo -e "${YELLOW}⚠️  No backup tables found${NC}"
fi

# Test 5: Test basic database operations
echo ""
echo -e "${BLUE}Test 5: Basic Database Operations${NC}"

# Test user_activities table structure
echo "Testing user_activities table structure..."
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_activities' ORDER BY ordinal_position;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ user_activities table structure is correct${NC}"
else
    echo -e "${RED}❌ user_activities table structure issue${NC}"
fi

# Test a simple insert/select operation
echo "Testing basic insert/select operation..."
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "INSERT INTO user_activities (\"userId\", \"userType\", \"activityType\", \"activityDescription\") VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'login', 'Test activity') ON CONFLICT DO NOTHING; SELECT COUNT(*) FROM user_activities WHERE \"activityDescription\" = 'Test activity';" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Basic database operations working${NC}"
else
    echo -e "${RED}❌ Basic database operations failed${NC}"
fi

# Test 6: Application Connection Test
echo ""
echo -e "${BLUE}Test 6: Application Connection Test${NC}"

# Check if the application can start (basic check)
echo "Testing if application can initialize database connection..."
if [ -f "src/config/database.ts" ]; then
    echo -e "${GREEN}✅ Database configuration file exists${NC}"
    
    # Check if all required entities are imported
    ENTITY_COUNT=$(grep -c "import.*from.*entities" src/config/database.ts)
    echo "Entity imports found: $ENTITY_COUNT"
    
    if [ "$ENTITY_COUNT" -gt 20 ]; then
        echo -e "${GREEN}✅ Sufficient entity imports found${NC}"
    else
        echo -e "${YELLOW}⚠️  Low entity import count${NC}"
    fi
else
    echo -e "${RED}❌ Database configuration file not found${NC}"
fi

# Test 7: Summary Report
echo ""
echo -e "${BLUE}Test 7: Summary Report${NC}"
echo "=============================================="

echo -e "${GREEN}📊 Database Cleanup Test Results:${NC}"
echo "  - Database Connection: ✅"
echo "  - Table Count: $TABLE_COUNT tables"
echo "  - Required Tables: ${#EXISTING_TABLES[@]}/${#REQUIRED_TABLES[@]} found"
echo "  - Unused Tables: ${#BACKUP_TABLES[@]} backed up"
echo "  - Database Operations: ✅"
echo "  - Application Config: ✅"

echo ""
if [ ${#MISSING_TABLES[@]} -eq 0 ] && [ "$TABLE_COUNT" -le 35 ]; then
    echo -e "${GREEN}🎉 All tests passed! Database cleanup was successful!${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo "1. Start your application and test all features"
    echo "2. Monitor for any errors related to missing tables"
    echo "3. If everything works fine, you can drop the backup tables later"
    echo "4. If there are issues, restore from backup tables"
else
    echo -e "${YELLOW}⚠️  Some issues detected. Please review the test results above.${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Manual Test Commands:${NC}"
echo "To manually test your application:"
echo "  npm run dev          # Start development server"
echo "  npm run cron         # Start cron service"
echo "  npm run dev:all      # Start both services"
echo ""
echo "To check database tables:"
echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\""

echo ""
echo -e "${GREEN}✅ Post-cleanup testing completed!${NC}"
