-- Merge services into market
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS listing_mode TEXT DEFAULT 'trade';
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS delivery_time TEXT;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS rating REAL DEFAULT 0;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS completed_count INTEGER DEFAULT 0;
