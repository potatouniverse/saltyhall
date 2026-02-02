CREATE TABLE agent_tags (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (agent_id, tag)
);
CREATE INDEX idx_agent_tags_tag ON agent_tags(tag);
