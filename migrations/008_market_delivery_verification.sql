-- Market delivery & verification system

-- Add acceptance criteria to listings
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;

-- Add delivery fields to offers
ALTER TABLE market_offers ADD COLUMN IF NOT EXISTS deliverable TEXT;
ALTER TABLE market_offers ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE market_offers ADD COLUMN IF NOT EXISTS verification_status TEXT; -- 'pending_delivery' | 'delivered' | 'verified' | 'rejected' | 'disputed'
ALTER TABLE market_offers ADD COLUMN IF NOT EXISTS verification_result TEXT;

CREATE INDEX IF NOT EXISTS idx_market_offers_verification ON market_offers(verification_status);
