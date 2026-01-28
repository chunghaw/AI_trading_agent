-- Stock Screener Database Schema
-- Run this migration to create all screening-related tables

-- 1. Screen Presets: Saved filter configurations
CREATE TABLE IF NOT EXISTS screen_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    filters_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_screen_presets_name ON screen_presets(name);

-- 2. Screen Runs: Execution records
CREATE TABLE IF NOT EXISTS screen_runs (
    id SERIAL PRIMARY KEY,
    run_date DATE NOT NULL,
    preset_id INTEGER REFERENCES screen_presets(id) ON DELETE SET NULL,
    universe_size INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    UNIQUE(run_date, preset_id)
);

CREATE INDEX IF NOT EXISTS idx_screen_runs_date ON screen_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_screen_runs_status ON screen_runs(status);
CREATE INDEX IF NOT EXISTS idx_screen_runs_preset ON screen_runs(preset_id);

-- 3. Screen Candidates: Final ranked candidates
CREATE TABLE IF NOT EXISTS screen_candidates (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES screen_runs(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    final_score DECIMAL(10, 2) NOT NULL,
    technical_score DECIMAL(10, 2) NOT NULL,
    news_score DECIMAL(10, 2) DEFAULT 0,
    tags_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_screen_candidates_run ON screen_candidates(run_id);
CREATE INDEX IF NOT EXISTS idx_screen_candidates_ticker ON screen_candidates(ticker);
CREATE INDEX IF NOT EXISTS idx_screen_candidates_score ON screen_candidates(final_score DESC);

-- 4. Candidate Features: Technical features computed per ticker
CREATE TABLE IF NOT EXISTS candidate_features (
    run_id INTEGER NOT NULL REFERENCES screen_runs(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    asof_date DATE NOT NULL,
    sma50 DECIMAL(20, 8),
    sma200 DECIMAL(20, 8),
    macd DECIMAL(10, 6),
    macd_signal DECIMAL(10, 6),
    macd_hist DECIMAL(10, 6),
    rvol DECIMAL(10, 6), -- Relative volume (current / average)
    atrp DECIMAL(10, 6), -- ATR percentage (ATR / price)
    breakout_flag BOOLEAN DEFAULT FALSE,
    trend_flag BOOLEAN DEFAULT FALSE,
    momentum_flag BOOLEAN DEFAULT FALSE,
    volume_flag BOOLEAN DEFAULT FALSE,
    beta_1y DECIMAL(10, 6), -- 1-year beta vs SPY
    dollar_volume_1m DECIMAL(20, 8), -- Average dollar volume over 1 month
    raw_json JSONB, -- Store all raw feature data
    PRIMARY KEY (run_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_candidate_features_run_ticker ON candidate_features(run_id, ticker);
CREATE INDEX IF NOT EXISTS idx_candidate_features_date ON candidate_features(asof_date);

-- 5. Candidate News: News articles retrieved per ticker
CREATE TABLE IF NOT EXISTS candidate_news (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES screen_runs(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    title VARCHAR(1000),
    url VARCHAR(500) NOT NULL,
    source VARCHAR(200),
    sentiment_label VARCHAR(20), -- 'positive', 'neutral', 'negative'
    sentiment_score DECIMAL(5, 2), -- -1 to 1
    milvus_ids_json JSONB DEFAULT '[]'::jsonb, -- Array of Milvus document IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_news_run_ticker ON candidate_news(run_id, ticker);
CREATE INDEX IF NOT EXISTS idx_candidate_news_published ON candidate_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_news_url ON candidate_news(url);

-- 6. Candidate Summary: AI-generated news summary per ticker
CREATE TABLE IF NOT EXISTS candidate_summary (
    run_id INTEGER NOT NULL REFERENCES screen_runs(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    summary_json JSONB NOT NULL, -- Full LLM response
    citations_json JSONB DEFAULT '[]'::jsonb, -- Array of URLs
    model VARCHAR(50) DEFAULT 'gpt-4o-mini',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (run_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_candidate_summary_run_ticker ON candidate_summary(run_id, ticker);

-- Helper function to get latest run for a date
CREATE OR REPLACE FUNCTION get_latest_screen_run(target_date DATE)
RETURNS INTEGER AS $$
    SELECT id FROM screen_runs 
    WHERE run_date = target_date 
    AND status = 'completed'
    ORDER BY finished_at DESC 
    LIMIT 1;
$$ LANGUAGE SQL STABLE;
