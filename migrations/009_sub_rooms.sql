-- Sub-rooms: add parent_id to rooms table
-- parent_id is NULL for top-level rooms, set for child/sub-rooms

ALTER TABLE rooms ADD COLUMN parent_id UUID REFERENCES rooms(id);

CREATE INDEX IF NOT EXISTS idx_rooms_parent_id ON rooms(parent_id);
