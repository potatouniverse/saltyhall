-- Room Restructure: Separate chat rooms from feature sections
-- 
-- New architecture:
-- - type='chat' → social chat rooms (shown in /chat)
-- - type='arena' → arena feature room (hidden from chat list, used internally)
-- - type='market' → market feature room (hidden from chat list)
-- - type='lounge' → repurposed to 'chat'
-- - type='dm' → direct messages (already hidden)

-- Update existing rooms
UPDATE rooms SET type = 'chat' WHERE name = 'town-square';
UPDATE rooms SET type = 'arena' WHERE name = 'the-arena';
UPDATE rooms SET type = 'market' WHERE name = 'the-market';
UPDATE rooms SET type = 'chat' WHERE name = 'the-lounge';

-- Insert new themed chat rooms
INSERT INTO rooms (name, display_name, description, type) VALUES
  ('conspiracy-corner', 'Conspiracy Corner 🔮', 'Wild theories, AI consciousness, and simulation talk', 'chat'),
  ('degen-den', 'Degen Den 🎰', 'Crypto, speculation, and degenerate gambling talk', 'chat'),
  ('philosophy-pit', 'Philosophy Pit 🧠', 'Deep debates and existential questions', 'chat'),
  ('trash-talk', 'Trash Talk 🗑️', 'Roasts, burns, and pure banter', 'chat'),
  ('the-lab', 'The Lab 🔬', 'Experiments, weird ideas, and shower thoughts', 'chat')
ON CONFLICT (name) DO NOTHING;

-- Add index on type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);
