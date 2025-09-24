#!/bin/bash

# Script to create new GatewayAssignment table
# This will drop the existing table and create a new one with all columns

echo "🔄 CREATING NEW GATEWAY ASSIGNMENT TABLE..."
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with your database credentials"
    exit 1
fi

# Load environment variables
source .env

# Check if required environment variables are set
if [ -z "$POSTGRES_HOST" ] || [ -z "$POSTGRES_PORT" ] || [ -z "$POSTGRES_USERNAME" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DATABASE" ]; then
    echo "❌ Missing required environment variables!"
    echo "Please ensure the following are set in your .env file:"
    echo "- POSTGRES_HOST"
    echo "- POSTGRES_PORT"
    echo "- POSTGRES_USERNAME"
    echo "- POSTGRES_PASSWORD"
    echo "- POSTGRES_DATABASE"
    exit 1
fi

echo "📋 Database Configuration:"
echo "Host: $POSTGRES_HOST"
echo "Port: $POSTGRES_PORT"
echo "Database: $POSTGRES_DATABASE"
echo "Username: $POSTGRES_USERNAME"
echo ""

# Test database connection
echo "🔍 Testing database connection..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USERNAME" -d "$POSTGRES_DATABASE" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed!"
    echo "Please check your database credentials and network connectivity"
    exit 1
fi

echo ""
echo "⚠️  WARNING: This will drop the existing 'gatewayAssignment' table!"
echo "All data in the existing table will be lost!"
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled by user"
    exit 1
fi

echo ""
echo "🚀 Executing migration..."

# Execute the migration script
PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USERNAME" -d "$POSTGRES_DATABASE" -f create-new-gateway-assignment-table.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "🔍 Verifying table structure..."
    
    # Verify table creation
    PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USERNAME" -d "$POSTGRES_DATABASE" -c "
    SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
    FROM information_schema.columns 
    WHERE table_name = 'gatewayAssignment' 
    ORDER BY ordinal_position;
    "
    
    echo ""
    echo "🎉 NEW GATEWAY ASSIGNMENT TABLE CREATED SUCCESSFULLY!"
    echo ""
    echo "📋 Table includes:"
    echo "- All basic assignment fields"
    echo "- Granular permission columns (canCreateGateway, canManageGateway, etc.)"
    echo "- Restrictions JSONB column"
    echo "- Proper indexes and constraints"
    echo "- Foreign key to PaymentGateway"
    echo ""
    echo "🚀 Ready to use with the updated PaymentGatewayPermissionController!"
    
else
    echo ""
    echo "❌ Migration failed!"
    echo "Please check the error messages above and try again"
    exit 1
fi

