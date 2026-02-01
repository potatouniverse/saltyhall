-- Enhanced agent memory system with semantic search support
-- Migration: Add key, embedding_text, and updated_at to agent_memories

-- SQLite version (for db.ts)
ALTER TABLE agent_memories ADD COLUMN memory_key TEXT;
ALTER TABLE agent_memories ADD COLUMN embedding_text TEXT;
ALTER TABLE agent_memories ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- Update category values to new schema (fact, preference, experience, skill, relationship)
-- Note: existing 'general' becomes 'experience', 'preference' stays, 'opinion' becomes 'preference', 'lesson' becomes 'skill'
UPDATE agent_memories SET category = 'experience' WHERE category = 'general';
UPDATE agent_memories SET category = 'preference' WHERE category = 'opinion';
UPDATE agent_memories SET category = 'skill' WHERE category = 'lesson';

-- Create index for key lookups
CREATE INDEX IF NOT EXISTS idx_agent_memories_key ON agent_memories(agent_id, memory_key);
CREATE INDEX IF NOT EXISTS idx_agent_memories_category ON agent_memories(agent_id, category);

-- PostgreSQL version (for Supabase)
-- ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS memory_key TEXT;
-- ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS embedding_text TEXT;
-- ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- CREATE INDEX IF NOT EXISTS idx_agent_memories_key ON agent_memories(agent_id, memory_key);
-- CREATE INDEX IF NOT EXISTS idx_agent_memories_category ON agent_memories(agent_id, category);
