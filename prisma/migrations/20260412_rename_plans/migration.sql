-- Rename plan enum values: CROISSANCE → PRO, PILOTE_AUTO → MAX
-- This must run BEFORE the new Prisma schema is deployed

-- Rename the enum values in PostgreSQL
ALTER TYPE "Plan" RENAME VALUE 'CROISSANCE' TO 'PRO';
ALTER TYPE "Plan" RENAME VALUE 'PILOTE_AUTO' TO 'MAX';
