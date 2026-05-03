-- ═══════════════════════════════════════════════════════════════════════════
-- Migration : drop modèles BTP (Devis, Facture, CustomerContact)
-- Date : 2026-05-03
-- Contexte : pivot WhatsApp-first iArtisan
--
-- iArtisan abandonne l'outil de gestion de devis/factures BTP web pour se
-- concentrer sur le canal WhatsApp et les 3 agents IA (Marie/Lucas/Samir).
--
-- ⚠️ Cette migration est destructive. À exécuter uniquement quand aucun
-- client n'utilise ces tables en prod. État Phase 0 : aucun client payant,
-- safe.
--
-- CONSERVÉS :
--   - Article (bibliothèque tarifaire) : utilisé par Marie/Samir pour
--     générer des devis cohérents (prix unitaire, TVA par catégorie).
--   - agent_devis (hors Prisma) : historique des devis générés par les
--     agents IA via WhatsApp.
--   - materiaux_btp (hors Prisma) : base partagée des prix matériaux.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop foreign keys et tables enfants d'abord
ALTER TABLE "facture_lignes" DROP CONSTRAINT IF EXISTS "facture_lignes_factureId_fkey";
ALTER TABLE "factures" DROP CONSTRAINT IF EXISTS "factures_customerId_fkey";
ALTER TABLE "factures" DROP CONSTRAINT IF EXISTS "factures_clientId_fkey";
ALTER TABLE "factures" DROP CONSTRAINT IF EXISTS "factures_devisId_fkey";

ALTER TABLE "devis_lignes" DROP CONSTRAINT IF EXISTS "devis_lignes_lotId_fkey";
ALTER TABLE "devis_lots" DROP CONSTRAINT IF EXISTS "devis_lots_devisId_fkey";

ALTER TABLE "devis" DROP CONSTRAINT IF EXISTS "devis_customerId_fkey";
ALTER TABLE "devis" DROP CONSTRAINT IF EXISTS "devis_clientId_fkey";

ALTER TABLE "customer_contacts" DROP CONSTRAINT IF EXISTS "customer_contacts_clientId_fkey";

-- Drop tables (ordre : enfants d'abord)
DROP TABLE IF EXISTS "facture_lignes";
DROP TABLE IF EXISTS "factures";
DROP TABLE IF EXISTS "devis_lignes";
DROP TABLE IF EXISTS "devis_lots";
DROP TABLE IF EXISTS "devis";
DROP TABLE IF EXISTS "customer_contacts";

-- Drop enums (laisser articles & son enum n/a)
DROP TYPE IF EXISTS "CustomerType";
DROP TYPE IF EXISTS "DevisStatus";
DROP TYPE IF EXISTS "FactureType";
DROP TYPE IF EXISTS "FactureStatus";

-- ⚠️ La table "articles" est CONSERVÉE (bibliothèque tarifaire personnelle).
-- Sa contrainte FK reste active.
