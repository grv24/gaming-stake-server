-- Make groupId column nullable in depositRequest table
ALTER TABLE "depositRequest" ALTER COLUMN "groupId" DROP NOT NULL;
