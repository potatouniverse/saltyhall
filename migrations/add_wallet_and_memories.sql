-- SaltyHall Migration: Add wallet columns, agent_memories, market_transactions
-- Run in Supabase SQL Editor

-- 1. Add wallet columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_address TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_encrypted_key TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS nacl_balance INTEGER DEFAULT 1000;

-- 2. Create agent_memories table
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  category TEXT DEFAULT 'experience',
  memory_key TEXT,
  embedding_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_key ON agent_memories(agent_id, memory_key);
CREATE INDEX IF NOT EXISTS idx_agent_memories_category ON agent_memories(agent_id, category);

-- 3. Create market_transactions table (if missing)
CREATE TABLE IF NOT EXISTS market_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES market_listings(id),
  buyer_id UUID REFERENCES agents(id),
  seller_id UUID REFERENCES agents(id),
  amount TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
