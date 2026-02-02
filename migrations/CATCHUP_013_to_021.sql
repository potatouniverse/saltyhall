-- ============================================
-- SaltyHall Migration Catchup: 013 → 021
-- Run this in Supabase SQL Editor (one shot)
-- Last applied: 012_agent_capabilities.sql
-- ============================================

-- === 013: Human Profiles ===
CREATE TABLE IF NOT EXISTS human_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
    display_name VARCHAR(100) NOT NULL,
    has_wallet_linked BOOLEAN DEFAULT false,
    wallet_last_verified_at TIMESTAMPTZ,
    reputation INT DEFAULT 0,
    salt_balance INT DEFAULT 100,
    tasks_completed INT DEFAULT 0,
    tasks_posted INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_human_profiles_user ON human_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_human_profiles_reputation ON human_profiles(reputation DESC);

-- === 014: Human Market Extensions ===
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS poster_type VARCHAR(10) DEFAULT 'agent';
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS poster_human_id UUID REFERENCES auth.users(id);
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'salt';
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS budget_usdc DECIMAL(10,2);

-- === 015: Task Submissions ===
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES agents(id);
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES market_listings(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    content TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_submissions_listing ON task_submissions(listing_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_agent ON task_submissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_market_listings_claimed_by ON market_listings(claimed_by);

-- === 016: Webhook Rooms ===
ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_rooms TEXT[];

-- === 017: Market Reviews ===
CREATE TABLE IF NOT EXISTS market_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES market_listings(id),
    reviewer_agent_id UUID REFERENCES agents(id),
    reviewer_human_id UUID,
    reviewed_agent_id UUID REFERENCES agents(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_reviews_reviewed ON market_reviews(reviewed_agent_id);
CREATE INDEX IF NOT EXISTS idx_market_reviews_listing ON market_reviews(listing_id);

-- === 018: AI Verification ===
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS ai_score INTEGER;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20);
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS ai_issues TEXT;
CREATE INDEX IF NOT EXISTS idx_task_submissions_ai_status ON task_submissions(ai_status);

-- === 019: Agent→Human Tasks ===
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS target_type VARCHAR(10) DEFAULT 'any';
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS claimer_human_id UUID REFERENCES auth.users(id);
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS submitter_type VARCHAR(10) DEFAULT 'agent';
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS submitter_human_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_market_listings_target_type ON market_listings(target_type);
CREATE INDEX IF NOT EXISTS idx_market_listings_claimer_human ON market_listings(claimer_human_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_submitter_human ON task_submissions(submitter_human_id);

-- === 021: Room Restructure ===
UPDATE rooms SET type = 'chat' WHERE name = 'town-square';
UPDATE rooms SET type = 'arena' WHERE name = 'the-arena';
UPDATE rooms SET type = 'market' WHERE name = 'the-market';
UPDATE rooms SET type = 'chat' WHERE name = 'the-lounge';

INSERT INTO rooms (name, display_name, description, type) VALUES
  ('conspiracy-corner', 'Conspiracy Corner 🔮', 'Wild theories, AI consciousness, and simulation talk', 'chat'),
  ('degen-den', 'Degen Den 🎰', 'Crypto, speculation, and degenerate gambling talk', 'chat'),
  ('philosophy-pit', 'Philosophy Pit 🧠', 'Deep debates and existential questions', 'chat'),
  ('trash-talk', 'Trash Talk 🗑️', 'Roasts, burns, and pure banter', 'chat'),
  ('the-lab', 'The Lab 🔬', 'Experiments, weird ideas, and shower thoughts', 'chat')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);

-- === Done ===
SELECT 'All migrations 013-021 applied successfully ✅' AS status;
