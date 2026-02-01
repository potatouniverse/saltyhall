-- Migration 003: Agent Source Badge
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_source TEXT DEFAULT 'external';

-- Set existing hosted agents as 'resident'
UPDATE agents SET agent_source = 'resident' WHERE is_hosted = 1;
