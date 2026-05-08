-- Change default role from ADMIN to VIEWER (principle of least privilege)
-- Existing users are NOT affected — only new users created after this migration
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
