CREATE TABLE IF NOT EXISTS saved_articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    description TEXT,
    published_at TIMESTAMP,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO saved_articles
(title, url, source, description)
VALUES
(
    'Демонстрационная новость',
    'https://example.com/demo-news',
    'Тестовый источник',
    'Пример записи для проверки работы базы данных'
)
ON CONFLICT (url) DO NOTHING;
-- Safe idempotent schema extension. Retains all existing news articles.
ALTER TABLE saved_articles
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
