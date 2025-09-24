-- Add publicUrl column to fileUpload table
ALTER TABLE fileUpload ADD COLUMN IF NOT EXISTS "publicUrl" VARCHAR(500);

-- Update existing records to have publicUrl based on filePath
UPDATE fileUpload 
SET "publicUrl" = '/uploads/' || "filePath" 
WHERE "publicUrl" IS NULL;
