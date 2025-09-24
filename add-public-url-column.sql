-- Add publicUrl column to fileUpload table
-- This migration adds a publicUrl column to store public URLs for serving uploaded files

-- Add the new column
ALTER TABLE "fileUpload" 
ADD COLUMN IF NOT EXISTS "publicUrl" varchar(500) DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN "fileUpload"."publicUrl" IS 'Public URL for serving the uploaded file';

-- Verification query
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'fileUpload' AND table_schema = current_schema()
ORDER BY ordinal_position;

