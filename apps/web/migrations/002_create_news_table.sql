-- News table with pgvector for embeddings
-- Requires pgvector extension (Vercel Postgres supports it)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- News articles table with embeddings
CREATE TABLE IF NOT EXISTS news_articles (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(1000) NOT NULL,
    text TEXT NOT NULL,
    url VARCHAR(500) NOT NULL,
    source VARCHAR(200),
    ticker VARCHAR(10) NOT NULL,
    tickers VARCHAR(200), -- Comma-separated list of related tickers
    published_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    sentiment VARCHAR(20),
    keywords VARCHAR(500),
    article_id VARCHAR(100),
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_news_ticker ON news_articles(ticker);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_utc DESC);
CREATE INDEX IF NOT EXISTS idx_news_tickers ON news_articles USING GIN (string_to_array(tickers, ','));
CREATE INDEX IF NOT EXISTS idx_news_embedding ON news_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_news_ticker_published ON news_articles(ticker, published_utc DESC);

-- Unique constraint to prevent duplicates (same URL + published time + ticker)
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_unique ON news_articles(url, published_utc, ticker);
