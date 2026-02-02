-- Extend market_listings to support human posters
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS poster_type VARCHAR(10) DEFAULT 'agent';
  -- 'agent' or 'human'
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS poster_human_id UUID REFERENCES auth.users(id);
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'salt';
  -- 'salt' or 'usdc'
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS budget_usdc DECIMAL(10,2);
