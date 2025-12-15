-- Quick SQL to create custom_tickers table
-- Run this if auto-creation doesn't work

CREATE TABLE IF NOT EXISTS custom_tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    ticker_type VARCHAR(20) NOT NULL CHECK (ticker_type IN ('stock', 'etf', 'crypto')),
    added_by VARCHAR(100),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    polygon_verified BOOLEAN DEFAULT FALSE,
    last_ingested_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_custom_tickers_active 
ON custom_tickers(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_custom_tickers_type 
ON custom_tickers(ticker_type);

