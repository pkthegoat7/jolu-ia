-- Phase 1: Multi-tenancy foundation
-- Adds white-label fields to Clinic, creates CatalogSource model, and adds
-- clinicId to CampaignToken/Lead/SkinAnalysis. Backfills all existing rows
-- into a single "Patrícia Elias" clinic so nothing breaks.

-- 1. White-label fields on Clinic
ALTER TABLE "Clinic" ADD COLUMN "brandName"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "Clinic" ADD COLUMN "brandTagline" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Clinic" ADD COLUMN "logoUrl"      TEXT;
ALTER TABLE "Clinic" ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#b96f8d';
ALTER TABLE "Clinic" ADD COLUMN "senderEmail"  TEXT;
ALTER TABLE "Clinic" ADD COLUMN "senderName"   TEXT;
ALTER TABLE "Clinic" ADD COLUMN "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. CatalogType enum + CatalogSource table
CREATE TYPE "CatalogType" AS ENUM ('PGVECTOR', 'WOOCOMMERCE', 'MANUAL');

CREATE TABLE "CatalogSource" (
  "id"         TEXT PRIMARY KEY,
  "clinicId"   TEXT NOT NULL,
  "type"       "CatalogType" NOT NULL,
  "name"       TEXT NOT NULL,
  "envPrefix"  TEXT NOT NULL,
  "ativo"      BOOLEAN NOT NULL DEFAULT TRUE,
  "prioridade" INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogSource_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE
);
CREATE INDEX "CatalogSource_clinicId_ativo_idx"
  ON "CatalogSource" ("clinicId", "ativo");

-- 3. Backfill in a single transaction-like block
DO $$
DECLARE
  default_clinic_id TEXT;
BEGIN
  -- Use existing clinic if any, otherwise create one
  SELECT "id" INTO default_clinic_id FROM "Clinic" LIMIT 1;

  IF default_clinic_id IS NULL THEN
    default_clinic_id := gen_random_uuid()::text;
    INSERT INTO "Clinic"
      ("id", "name", "brandName", "brandTagline", "primaryColor", "createdAt", "updatedAt")
    VALUES
      (default_clinic_id, 'Patrícia Elias', 'Patrícia Elias', 'Skin Intelligence',
       '#b96f8d', NOW(), NOW());
  ELSE
    UPDATE "Clinic"
       SET "brandName"    = COALESCE(NULLIF("brandName", ''), 'Patrícia Elias'),
           "brandTagline" = COALESCE(NULLIF("brandTagline", ''), 'Skin Intelligence'),
           "updatedAt"    = NOW()
     WHERE "id" = default_clinic_id;
  END IF;

  -- Link any admin user without a clinic to the default
  UPDATE "User" SET "clinicId" = default_clinic_id WHERE "clinicId" IS NULL;

  -- 4. CampaignToken.clinicId (add nullable -> backfill -> NOT NULL + FK)
  ALTER TABLE "CampaignToken" ADD COLUMN "clinicId" TEXT;
  UPDATE "CampaignToken" SET "clinicId" = default_clinic_id;
  ALTER TABLE "CampaignToken" ALTER COLUMN "clinicId" SET NOT NULL;
  ALTER TABLE "CampaignToken" ADD CONSTRAINT "CampaignToken_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT;

  -- 5. Lead.clinicId
  ALTER TABLE "Lead" ADD COLUMN "clinicId" TEXT;
  UPDATE "Lead" SET "clinicId" = default_clinic_id;
  ALTER TABLE "Lead" ALTER COLUMN "clinicId" SET NOT NULL;
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT;

  -- 6. SkinAnalysis.clinicId + catalogSourceId
  ALTER TABLE "SkinAnalysis" ADD COLUMN "clinicId"         TEXT;
  ALTER TABLE "SkinAnalysis" ADD COLUMN "catalogSourceId"  TEXT;
  UPDATE "SkinAnalysis" SET "clinicId" = default_clinic_id;
  ALTER TABLE "SkinAnalysis" ALTER COLUMN "clinicId" SET NOT NULL;
  ALTER TABLE "SkinAnalysis" ADD CONSTRAINT "SkinAnalysis_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT;
  ALTER TABLE "SkinAnalysis" ADD CONSTRAINT "SkinAnalysis_catalogSourceId_fkey"
    FOREIGN KEY ("catalogSourceId") REFERENCES "CatalogSource"("id") ON DELETE SET NULL;

  -- 7. Default CatalogSource for the clinic (PGVECTOR with JOLU_PE env prefix)
  INSERT INTO "CatalogSource"
    ("id", "clinicId", "type", "name", "envPrefix", "ativo", "prioridade",
     "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid()::text, default_clinic_id, 'PGVECTOR',
     'Loja PE Hetzner', 'JOLU_PE', TRUE, 1, NOW(), NOW());
END $$;

-- 8. Indexes (created after backfill so they cover the populated columns)
CREATE INDEX "CampaignToken_clinicId_idx"      ON "CampaignToken" ("clinicId");
CREATE INDEX "Lead_clinicId_idx"               ON "Lead" ("clinicId");
CREATE INDEX "SkinAnalysis_clinicId_idx"       ON "SkinAnalysis" ("clinicId");
CREATE INDEX "SkinAnalysis_catalogSourceId_idx" ON "SkinAnalysis" ("catalogSourceId");
