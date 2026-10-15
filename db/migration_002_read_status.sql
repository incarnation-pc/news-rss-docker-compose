-- Safe idempotent schema extension. Retains all existing news articles.
ALTER TABLE saved_articles
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
