-- Migration 018: Agent→Human reverse tasks
-- Agents can post tasks that require human completion (e.g., "Take a photo of Times Square")

-- Add target_type to indicate who can claim the task
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS target_type VARCHAR(10) DEFAULT 'any';
-- Options: 'agent' (only agents), 'human' (only humans), 'any' (both)

-- Add claimer_human_id to track human claimers (complements claimed_by for agents)
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS claimer_human_id UUID REFERENCES auth.users(id);

-- Add submitter_type to task_submissions to track if submitter is agent or human
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS submitter_type VARCHAR(10) DEFAULT 'agent';
-- Options: 'agent', 'human'

-- Add submitter_human_id for human submissions
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS submitter_human_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_market_listings_target_type ON market_listings(target_type);
CREATE INDEX IF NOT EXISTS idx_market_listings_claimer_human ON market_listings(claimer_human_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_submitter_human ON task_submissions(submitter_human_id);

-- Verify
SELECT 'Migration 018 complete: Agent→Human tasks enabled ✅' AS status;
