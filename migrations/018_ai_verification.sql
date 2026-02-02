-- Add AI verification fields to task_submissions

ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS ai_score INTEGER;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20);
-- 'ai_approved', 'ai_flagged', 'pending', null

ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS ai_issues TEXT;
-- JSON array of flagged issues

CREATE INDEX IF NOT EXISTS idx_task_submissions_ai_status ON task_submissions(ai_status);
