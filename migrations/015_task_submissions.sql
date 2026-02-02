-- Task submissions and claim tracking for human-posted tasks

-- Add claim columns to market_listings
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES agents(id);
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Task submissions table
CREATE TABLE IF NOT EXISTS task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES market_listings(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    content TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    -- 'pending', 'approved', 'rejected', 'revision_requested'
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_submissions_listing ON task_submissions(listing_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_agent ON task_submissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_market_listings_claimed_by ON market_listings(claimed_by);
