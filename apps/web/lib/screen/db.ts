import { Client } from "pg";

/**
 * Ensure all tables exist (idempotent migration)
 * Creates tables if they don't exist
 */
export async function ensureTablesExist(client: Client) {
  // Create tables with IF NOT EXISTS (idempotent)
  const createTablesSQL = `
    -- Screen Presets
    CREATE TABLE IF NOT EXISTS screen_presets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        filters_json JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name)
    );

    -- Screen Runs
    CREATE TABLE IF NOT EXISTS screen_runs (
        id SERIAL PRIMARY KEY,
        run_date DATE NOT NULL,
        preset_id INTEGER REFERENCES screen_presets(id) ON DELETE SET NULL,
        universe_size INTEGER DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'running',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP WITH TIME ZONE,
        error TEXT,
        UNIQUE(run_date, preset_id)
    );

    -- Screen Candidates
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

    -- Candidate Features
    CREATE TABLE IF NOT EXISTS candidate_features (
        run_id INTEGER NOT NULL REFERENCES screen_runs(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        asof_date DATE NOT NULL,
        sma50 DECIMAL(20, 8),
        sma200 DECIMAL(20, 8),
        macd DECIMAL(10, 6),
        macd_signal DECIMAL(10, 6),
        macd_hist DECIMAL(10, 6),
        rvol DECIMAL(10, 6),
        atrp DECIMAL(10, 6),
        breakout_flag BOOLEAN DEFAULT FALSE,
        trend_flag BOOLEAN DEFAULT FALSE,
        momentum_flag BOOLEAN DEFAULT FALSE,
        volume_flag BOOLEAN DEFAULT FALSE,
        beta_1y DECIMAL(10, 6),
        dollar_volume_1m DECIMAL(20, 8),
        raw_json JSONB,
        PRIMARY KEY (run_id, ticker)
    );

    -- Candidate News
    CREATE TABLE IF NOT EXISTS candidate_news (
        id SERIAL PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES screen_runs(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        published_at TIMESTAMP WITH TIME ZONE NOT NULL,
        title VARCHAR(1000),
        url VARCHAR(500) NOT NULL,
        source VARCHAR(200),
        sentiment_label VARCHAR(20),
        sentiment_score DECIMAL(5, 2),
        milvus_ids_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Candidate Summary
    CREATE TABLE IF NOT EXISTS candidate_summary (
        run_id INTEGER NOT NULL REFERENCES screen_runs(id) ON DELETE CASCADE,
        ticker VARCHAR(20) NOT NULL,
        summary_json JSONB NOT NULL,
        citations_json JSONB DEFAULT '[]'::jsonb,
        model VARCHAR(50) DEFAULT 'gpt-4o-mini',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (run_id, ticker)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_screen_runs_date ON screen_runs(run_date DESC);
    CREATE INDEX IF NOT EXISTS idx_screen_candidates_run ON screen_candidates(run_id);
    CREATE INDEX IF NOT EXISTS idx_screen_candidates_score ON screen_candidates(final_score DESC);
    CREATE INDEX IF NOT EXISTS idx_candidate_features_run_ticker ON candidate_features(run_id, ticker);
    CREATE INDEX IF NOT EXISTS idx_candidate_news_run_ticker ON candidate_news(run_id, ticker);
    CREATE INDEX IF NOT EXISTS idx_candidate_summary_run_ticker ON candidate_summary(run_id, ticker);
  `;

  try {
    await client.query(createTablesSQL);
    console.log("✅ Database tables verified/created");
  } catch (error: any) {
    console.error("❌ Error creating tables:", error.message);
    console.error("SQL Error details:", error);
    // Re-throw to surface the error
    throw error;
  }
}
