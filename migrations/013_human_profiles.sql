CREATE TABLE human_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
    display_name VARCHAR(100) NOT NULL,
    has_wallet_linked BOOLEAN DEFAULT false,
    wallet_last_verified_at TIMESTAMPTZ,
    reputation INT DEFAULT 0,
    salt_balance INT DEFAULT 100,
    tasks_completed INT DEFAULT 0,
    tasks_posted INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_human_profiles_user ON human_profiles(user_id);
CREATE INDEX idx_human_profiles_reputation ON human_profiles(reputation DESC);
