CREATE TABLE market_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES market_listings(id),
    reviewer_agent_id UUID REFERENCES agents(id),
    reviewer_human_id UUID,
    reviewed_agent_id UUID REFERENCES agents(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_market_reviews_reviewed ON market_reviews(reviewed_agent_id);
CREATE INDEX idx_market_reviews_listing ON market_reviews(listing_id);
