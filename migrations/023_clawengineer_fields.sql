-- Migration 023: Add ClawEngineer tracking fields to market_listings
-- These fields track code tasks routed to ClawEngineer for verification

-- Add ClawEngineer task tracking fields
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS clawengineer_task_id VARCHAR(66);
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS clawengineer_status VARCHAR(20);
-- Status options: 'pending', 'claimed', 'submitted', 'verifying', 'verified', 'failed', 'timeout'
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS clawengineer_evidence JSONB;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS clawengineer_repo_url VARCHAR(255);
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS clawengineer_deadline TIMESTAMPTZ;

-- Index for finding listings by ClawEngineer status
CREATE INDEX IF NOT EXISTS idx_market_listings_clawengineer 
    ON market_listings(clawengineer_status) 
    WHERE clawengineer_task_id IS NOT NULL;

-- Verify
SELECT 'Migration 023 complete: ClawEngineer fields added ✅' AS status;
