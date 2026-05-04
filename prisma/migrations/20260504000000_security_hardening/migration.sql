-- ============================================================
-- security_hardening
-- ============================================================

-- 1. Enum UserRole
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- 2. Campo role em User
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'ADMIN';

-- 3. Criar SkinAnalysis com a mesma estrutura de LeadAnalise
CREATE TABLE "SkinAnalysis" (
    "id"           TEXT         NOT NULL,
    "leadId"       TEXT         NOT NULL,
    "imageUrl"     TEXT         NOT NULL,
    "resultado"    JSONB        NOT NULL,
    "emailEnviado" BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkinAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SkinAnalysis_leadId_key" ON "SkinAnalysis"("leadId");

-- 4. Copiar todos os dados para SkinAnalysis
INSERT INTO "SkinAnalysis" ("id", "leadId", "imageUrl", "resultado", "emailEnviado", "createdAt")
SELECT "id", "leadId", "imageUrl", "resultado", "emailEnviado", "createdAt"
FROM "LeadAnalise";

-- 5. FK SkinAnalysis → Lead com CASCADE
ALTER TABLE "SkinAnalysis"
    ADD CONSTRAINT "SkinAnalysis_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Dropar LeadAnalise (FK dropada automaticamente)
DROP TABLE "LeadAnalise";

-- 7. Atualizar onDelete nas FKs existentes
ALTER TABLE "Analise"  DROP CONSTRAINT "Analise_userId_fkey";
ALTER TABLE "Analise"  ADD CONSTRAINT  "Analise_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Analysis" DROP CONSTRAINT "Analysis_userId_fkey";
ALTER TABLE "Analysis" ADD CONSTRAINT  "Analysis_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead"     DROP CONSTRAINT "Lead_tokenId_fkey";
ALTER TABLE "Lead"     ADD CONSTRAINT  "Lead_tokenId_fkey"
    FOREIGN KEY ("tokenId") REFERENCES "CampaignToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product"  DROP CONSTRAINT "Product_clinicId_fkey";
ALTER TABLE "Product"  ADD CONSTRAINT  "Product_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User"     DROP CONSTRAINT "User_clinicId_fkey";
ALTER TABLE "User"     ADD CONSTRAINT  "User_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. Índices
CREATE INDEX "SkinAnalysis_leadId_idx"      ON "SkinAnalysis"("leadId");
CREATE INDEX "SkinAnalysis_emailEnviado_idx" ON "SkinAnalysis"("emailEnviado");
CREATE INDEX "SkinAnalysis_createdAt_idx"   ON "SkinAnalysis"("createdAt");
CREATE INDEX "User_clinicId_idx"            ON "User"("clinicId");
CREATE INDEX "Analysis_userId_idx"          ON "Analysis"("userId");
CREATE INDEX "Analysis_createdAt_idx"       ON "Analysis"("createdAt");
CREATE INDEX "Analise_userId_idx"           ON "Analise"("userId");
CREATE INDEX "Analise_createdAt_idx"        ON "Analise"("createdAt");
CREATE INDEX "Product_clinicId_idx"         ON "Product"("clinicId");
CREATE INDEX "CampaignToken_createdAt_idx"  ON "CampaignToken"("createdAt");
CREATE INDEX "Lead_tokenId_idx"             ON "Lead"("tokenId");
CREATE INDEX "Lead_createdAt_idx"           ON "Lead"("createdAt");
