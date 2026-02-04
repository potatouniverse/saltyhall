-- Migration 024: Add wallet fields to human_profiles
-- Enables humans to connect their wallets via SaltDig for USDC transactions

ALTER TABLE human_profiles ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42);
-- Wallet address linked via SaltDig (0x... format)

-- Index for finding users by wallet
CREATE INDEX IF NOT EXISTS idx_human_profiles_wallet 
    ON human_profiles(wallet_address) 
    WHERE wallet_address IS NOT NULL;

-- Verify
SELECT 'Migration 024 complete: Human wallet fields added ✅' AS status;
