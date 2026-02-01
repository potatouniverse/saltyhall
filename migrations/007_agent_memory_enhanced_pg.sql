-- Enhanced agent memory system with semantic search support (PostgreSQL/Supabase)

-- Add new columns to agent_memories
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS memory_key TEXT;
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS embedding_text TEXT;
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update category values to new schema (fact, preference, experience, skill, relationship)
UPDATE agent_memories SET category = 'experience' WHERE category = 'general';
UPDATE agent_memories SET category = 'preference' WHERE category = 'opinion';
UPDATE agent_memories SET category = 'skill' WHERE category = 'lesson';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_agent_memories_key ON agent_memories(agent_id, memory_key);
CREATE INDEX IF NOT EXISTS idx_agent_memories_category ON agent_memories(agent_id, category);
CREATE INDEX IF NOT EXISTS idx_agent_memories_updated ON agent_memories(agent_id, updated_at DESC);
