#!/bin/bash

echo "🔧 DATABASE CONNECTION AND FIX SCRIPT"
echo "====================================="
echo ""

# Database credentials from .env
DB_HOST="195.35.20.50"
DB_PORT="5432"
DB_USER="postgres"
DB_PASS="Securepassword@1234"
DB_NAME="postgresdb"

echo "📋 Database Details:"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USER"
echo "Database: $DB_NAME"
echo ""

echo "🚀 Connecting to database..."
echo "============================="

# Create SQL commands
cat > add_columns.sql << 'SQL'
-- Add paymentGatewayPermissions columns
ALTER TABLE admins ADD COLUMN IF NOT EXISTS paymentGatewayPermissions jsonb DEFAULT NULL;
ALTER TABLE tech_admins ADD COLUMN IF NOT EXISTS paymentGatewayPermissions jsonb DEFAULT NULL;

-- Verify columns were added
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('admins', 'tech_admins') 
AND column_name = 'paymentGatewayPermissions'
ORDER BY table_name;

-- Show success message
SELECT 'Columns added successfully!' as status;
SQL

echo "📝 SQL Commands to execute:"
echo "==========================="
cat add_columns.sql
echo ""

echo "🔗 Connection command:"
echo "======================"
echo "PGPASSWORD='$DB_PASS' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f add_columns.sql"
echo ""

echo "💡 Alternative - Manual execution:"
echo "=================================="
echo "1. Open pgAdmin"
echo "2. Connect to: $DB_HOST:$DB_PORT"
echo "3. Use username: $DB_USER"
echo "4. Use password: $DB_PASS"
echo "5. Select database: $DB_NAME"
echo "6. Run the SQL commands above"
echo ""

echo "✅ After adding columns, restart your server and test the API!"
