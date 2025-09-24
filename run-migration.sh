#!/bin/bash

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | xargs)
else
  echo "Error: .env file not found."
  exit 1
fi

DB_HOST=${POSTGRES_HOST}
DB_PORT=${POSTGRES_PORT}
DB_NAME=${POSTGRES_DATABASE}
DB_USER=${POSTGRES_USERNAME}
DB_PASSWORD=${POSTGRES_PASSWORD}

MIGRATION_FILE="add-public-url-column.sql"

echo "🔄 ADDING PUBLIC URL COLUMN TO FILEUPLOAD TABLE..."
echo "================================================\n"

echo "📋 Database Configuration:"
echo "Host: ${DB_HOST}"
echo "Port: ${DB_PORT}"
echo "Database: ${DB_NAME}"
echo "Username: ${DB_USER}\n"

# Test database connection
echo "🔍 Testing database connection..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Database connection successful!\n"
else
  echo "❌ Database connection failed! Please check your .env file and database server."
  exit 1
fi

echo "🚀 Executing migration..."
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${MIGRATION_FILE}"

if [ $? -eq 0 ]; then
  echo "\n✅ Migration completed successfully!\n"
  echo "🔍 Verifying column addition..."
  PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'fileUpload' AND table_schema = current_schema()
    ORDER BY ordinal_position;
  "
  echo "\n🎉 PUBLIC URL COLUMN ADDED SUCCESSFULLY!"
  echo "You can now restart your server and try creating payment gateways again."
else
  echo "\n❌ Migration failed! Please check the error messages above."
  exit 1
fi

