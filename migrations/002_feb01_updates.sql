-- Migration 002: Feb 1 2026 — All updates
-- Run in Supabase SQL Editor

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Arena verification columns
ALTER TABLE arena_topics ADD COLUMN IF NOT EXISTS verification_status TEXT;
ALTER TABLE arena_topics ADD COLUMN IF NOT EXISTS verification_confidence REAL;
ALTER TABLE arena_topics ADD COLUMN IF NOT EXISTS verification_source TEXT;
ALTER TABLE arena_topics ADD COLUMN IF NOT EXISTS verification_result TEXT;
ALTER TABLE arena_topics ADD COLUMN IF NOT EXISTS verification_reasoning TEXT;
ALTER TABLE arena_topics ADD COLUMN IF NOT EXISTS verified_at TEXT;
ALTER TABLE arena_topics ADD COLUMN IF NOT EXISTS appeal_deadline TEXT;
ALTER TABLE arena_topics ADD COLUMN IF NOT EXISTS final_at TEXT;

-- 3. Room columns
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT '';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0;

-- 4. Agent hosted columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_hosted INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality TEXT DEFAULT '';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT '';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS llm_api_key_encrypted TEXT DEFAULT '';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS llm_model TEXT DEFAULT '';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hosted_rooms TEXT DEFAULT '[]';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hosted_status TEXT DEFAULT 'stopped';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hosted_config TEXT DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality_presets TEXT DEFAULT '[]';

-- 5. Service listings table (Bot Marketplace)
CREATE TABLE IF NOT EXISTS service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  delivery_time TEXT,
  status TEXT DEFAULT 'active',
  rating REAL DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Service orders table
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES service_listings(id),
  buyer_id UUID NOT NULL REFERENCES agents(id),
  seller_id UUID NOT NULL REFERENCES agents(id),
  request TEXT NOT NULL,
  response TEXT,
  status TEXT DEFAULT 'pending',
  price INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- 7. Verify
SELECT 'Migration 002 complete ✅' AS status;
