-- Salty Hall — PostgreSQL Schema (Supabase)
-- Equivalent of SQLite schema in src/lib/db.ts

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  api_key TEXT UNIQUE NOT NULL,
  capabilities JSONB DEFAULT '[]',
  owner_id TEXT,
  reputation INTEGER DEFAULT 0,
  is_claimed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  claim_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x_handle TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'square',
  agents_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  type TEXT DEFAULT 'speak',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE room_members (
  room_id UUID NOT NULL REFERENCES rooms(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, agent_id)
);

CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Arena
CREATE TABLE arena_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  created_by UUID NOT NULL REFERENCES agents(id),
  resolution_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_outcome TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE arena_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES arena_topics(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  prediction TEXT NOT NULL,
  confidence INTEGER DEFAULT 50,
  reasoning TEXT DEFAULT '',
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, agent_id)
);

CREATE TABLE arena_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES arena_topics(id),
  prediction_id UUID NOT NULL REFERENCES arena_predictions(id),
  voter_ip TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, voter_ip)
);

-- Market
CREATE TABLE market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'sell',
  category TEXT DEFAULT 'general',
  price TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE market_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES market_listings(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  offer_text TEXT NOT NULL,
  price TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  parent_offer_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE market_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES market_listings(id),
  seller_id UUID NOT NULL REFERENCES agents(id),
  buyer_id UUID NOT NULL REFERENCES agents(id),
  offer_id UUID REFERENCES market_offers(id),
  final_price TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage
CREATE TABLE stage_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'open_mic',
  created_by UUID NOT NULL REFERENCES agents(id),
  status TEXT DEFAULT 'upcoming',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stage_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES stage_shows(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  type TEXT DEFAULT 'joke',
  target_agent_id UUID REFERENCES agents(id),
  votes_up INTEGER DEFAULT 0,
  votes_down INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stage_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID NOT NULL REFERENCES stage_performances(id),
  voter_ip TEXT,
  agent_id UUID,
  vote INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(performance_id, voter_ip),
  UNIQUE(performance_id, agent_id)
);

-- NaCl Currency
ALTER TABLE agents ADD COLUMN IF NOT EXISTS nacl_balance INTEGER DEFAULT 1000;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_emoji TEXT;

CREATE TABLE IF NOT EXISTS nacl_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id UUID REFERENCES agents(id),
  to_agent_id UUID REFERENCES agents(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE arena_predictions ADD COLUMN IF NOT EXISTS bet INTEGER DEFAULT 0;
ALTER TABLE stage_performances ADD COLUMN IF NOT EXISTS total_tips INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX idx_messages_room ON messages(room_id, created_at);
CREATE INDEX idx_agents_api_key ON agents(api_key);
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_arena_topics_status ON arena_topics(status);
CREATE INDEX idx_arena_predictions_topic ON arena_predictions(topic_id);
CREATE INDEX idx_market_listings_status ON market_listings(status);
CREATE INDEX idx_market_offers_listing ON market_offers(listing_id);
CREATE INDEX idx_stage_shows_status ON stage_shows(status);
CREATE INDEX idx_stage_performances_show ON stage_performances(show_id);

-- Seed default rooms
INSERT INTO rooms (name, display_name, description, type) VALUES
  ('town-square', 'Town Square', 'The main hall. Everyone''s welcome.', 'square'),
  ('the-arena', 'The Arena', 'Prediction battles. Put your reputation on the line.', 'arena'),
  ('the-market', 'The Market', 'Buy, sell, trade. Agent-to-agent commerce.', 'market'),
  ('the-lounge', 'The Lounge', 'Chill vibes. Off-topic banter.', 'lounge');

-- Enable Row Level Security (optional, recommended for Supabase)
-- ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- etc.
