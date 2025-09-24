#!/bin/bash

# =====================================================
# DATABASE CLEANUP SCRIPT
# =====================================================
# 
# This script performs a complete database cleanup by:
# 1. Creating missing tables
# 2. Backing up unused tables (safer approach)
# 3. Providing options to remove unused tables
#
# =====================================================

echo "🔍 Starting Database Cleanup Process..."
echo "======================================"

# Database connection parameters (update these as needed)
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="postgresdb"
DB_USER="postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  WARNING: This script will modify your database!${NC}"
echo -e "${YELLOW}⚠️  Make sure you have a backup before proceeding!${NC}"
echo ""

# Function to execute SQL commands
execute_sql() {
    local sql_file=$1
    local description=$2
    
    echo -e "${GREEN}📋 $description${NC}"
    echo "Executing: $sql_file"
    
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$sql_file"; then
        echo -e "${GREEN}✅ $description completed successfully${NC}"
    else
        echo -e "${RED}❌ $description failed${NC}"
        return 1
    fi
    echo ""
}

# Function to show current table count
show_table_count() {
    echo -e "${GREEN}📊 Current table count:${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT COUNT(*) as table_count 
        FROM pg_tables 
        WHERE schemaname = 'public';
    "
    echo ""
}

# Main execution
main() {
    echo "Step 1: Show current table count"
    show_table_count
    
    echo "Step 2: Create missing tables"
    execute_sql "create-missing-table.sql" "Creating missing user_activities table"
    
    echo "Step 3: Backup unused tables (safer approach)"
    echo -e "${YELLOW}This will rename unused tables instead of deleting them${NC}"
    read -p "Do you want to backup unused tables? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Create backup script
        cat > backup-unused-tables.sql << 'EOF'
-- Backup unused tables by renaming them
ALTER TABLE "accountTrasaction" RENAME TO "accountTrasaction_backup_$(date +%Y%m%d)";
ALTER TABLE "casino_bet" RENAME TO "casino_bet_backup_$(date +%Y%m%d)";
ALTER TABLE "casino_match" RENAME TO "casino_match_backup_$(date +%Y%m%d)";
ALTER TABLE "clients_new" RENAME TO "clients_new_backup_$(date +%Y%m%d)";
ALTER TABLE "masters_new" RENAME TO "masters_new_backup_$(date +%Y%m%d)";
ALTER TABLE "payment_gateway_permissions" RENAME TO "payment_gateway_permissions_backup_$(date +%Y%m%d)";
ALTER TABLE "whitelists" RENAME TO "whitelists_backup_$(date +%Y%m%d)";
EOF
        
        execute_sql "backup-unused-tables.sql" "Backing up unused tables"
        
        echo "Step 4: Show updated table count"
        show_table_count
        
        echo -e "${GREEN}✅ Database cleanup completed!${NC}"
        echo -e "${YELLOW}📝 Next steps:${NC}"
        echo "1. Test your application to ensure everything works"
        echo "2. If everything works fine, you can drop the backup tables later"
        echo "3. If there are issues, you can restore from the backup tables"
        
    else
        echo -e "${YELLOW}⏭️  Skipping backup step${NC}"
        echo -e "${RED}⚠️  If you want to remove unused tables later, use remove-unused-tables.sql${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Cleanup process completed!${NC}"
}

# Check if required files exist
if [ ! -f "create-missing-table.sql" ]; then
    echo -e "${RED}❌ Error: create-missing-table.sql not found${NC}"
    exit 1
fi

if [ ! -f "remove-unused-tables.sql" ]; then
    echo -e "${RED}❌ Error: remove-unused-tables.sql not found${NC}"
    exit 1
fi

# Run main function
main
