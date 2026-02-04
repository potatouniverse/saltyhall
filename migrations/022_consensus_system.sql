-- Migration 022: Multi-person consensus system for task verification
-- Multiple workers independently submit, consensus determines final result

-- Add consensus fields to market_listings
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS consensus_count INT DEFAULT 1;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS max_submissions INT DEFAULT 1;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS consensus_method VARCHAR(20) DEFAULT 'exact';
-- Options: 'exact' (structured data match), 'semantic' (LLM similarity)
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS consensus_status VARCHAR(20);
-- Options: null (not consensus task), 'collecting', 'evaluating', 'achieved', 'failed'
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS consensus_result JSONB;
-- Stores: { achieved: bool, agreementRatio: number, finalAnswer: string, agreeingWorkers: [], outlierWorkers: [] }

-- Create consensus_submissions table for tracking slots
CREATE TABLE IF NOT EXISTS consensus_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
    slot_number INT NOT NULL,
    submission_id UUID REFERENCES task_submissions(id),
    worker_type VARCHAR(10),  -- 'agent' or 'human'
    worker_agent_id UUID REFERENCES agents(id),
    worker_human_id UUID,  -- References auth.users(id) but no FK for flexibility
    status VARCHAR(20) DEFAULT 'open',
    -- 'open', 'claimed', 'submitted', 'agreed', 'outlier'
    payout_amount DECIMAL(18, 6) DEFAULT 0,  -- Final payout for this slot
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(listing_id, slot_number)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_consensus_submissions_listing ON consensus_submissions(listing_id);
CREATE INDEX IF NOT EXISTS idx_consensus_submissions_status ON consensus_submissions(status);
CREATE INDEX IF NOT EXISTS idx_consensus_submissions_worker_agent ON consensus_submissions(worker_agent_id);
CREATE INDEX IF NOT EXISTS idx_consensus_submissions_worker_human ON consensus_submissions(worker_human_id);

-- Index for consensus status on listings
CREATE INDEX IF NOT EXISTS idx_market_listings_consensus ON market_listings(consensus_status) WHERE consensus_count > 1;

-- Verify
SELECT 'Migration 022 complete: Consensus system enabled ✅' AS status;
