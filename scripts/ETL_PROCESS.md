# ETL Process & Data Retention Policy

## Current Pipeline Overview

### Data Extraction
- **Daily Incremental**: Fetches **10 days** of OHLCV data per run
- **Frequency**: 2x daily (5am SGT, 5pm SGT)
- **Source**: Polygon.io API
- **Tickers**: Top 1000 US stocks by volume + popular ETFs (~84 base tickers)

### Data Retention
- **Retention Period**: **1095 days (3 years)**
- **Cleanup**: Old data beyond 3 years is automatically deleted
- **Storage**: All data kept in Postgres (bronze/silver/gold tables)

## Data Architecture (Bronze → Silver → Gold)

### 1. Bronze Layer (`bronze_ohlcv`)
- **Purpose**: Raw ingested data
- **Schema**: symbol, date, open, high, low, close, volume, vwap, transactions
- **Strategy**: UPSERT (ON CONFLICT DO UPDATE)
- **Retention**: 3 years

### 2. Silver Layer (`silver_ohlcv`)
- **Purpose**: Enriched data with technical indicators
- **Calculations**:
  - Moving Averages: MA5, MA20, MA50, MA200
  - EMAs: EMA20, EMA50, EMA200
  - MACD: 12-day EMA - 26-day EMA, 9-day signal, histogram
  - ATR: 14-day Average True Range
  - RSI: 14-day Relative Strength Index
  - Volatility: 20-day rolling standard deviation
- **Recalculation**: SQL window functions recalculate indicators using full history
- **Retention**: 3 years

### 3. Gold Layer (`gold_ohlcv_daily_metrics`)
- **Purpose**: Aggregated daily metrics (1 row per symbol per date)
- **Content**: Best technical indicator coverage per symbol
- **Retention**: 3 years

## Technical Indicator Requirements

| Indicator | Minimum Days Required | Calculation Method |
|-----------|----------------------|-------------------|
| MACD | 26+ days | 12-day EMA - 26-day EMA, 9-day signal |
| MACD Signal | 35+ days | 9-day EMA of MACD line |
| SMA50 | 50 days | Simple Moving Average |
| SMA200 | 200 days | Simple Moving Average |
| EMA20 | 20 days | Exponential Moving Average |
| EMA50 | 50 days | Exponential Moving Average |
| EMA200 | 200 days | Exponential Moving Average |
| ATR | 14 days | Average True Range |
| RSI | 14 days | Relative Strength Index |

**Note**: For accurate MACD calculation, **200 days** of history is recommended.

## Initial Historical Load

For first-time setup, run the historical load script to populate 200 days of data:

```bash
# Activate Python 3.11 venv
source venv311/bin/activate  # or your venv

# Run historical load
cd scripts
python load_historical_data.py
```

This will:
1. Fetch 200 days of historical data for all tickers
2. Load directly into `bronze_ohlcv` table
3. Then run regular pipeline to process bronze → silver → gold

## Regular Pipeline Flow

1. **Fetch OHLCV** (10 days) → Bronze
2. **Process & Enrich** → Calculate indicators → Silver
3. **Recalculate Indicators** (SQL, using full history) → Silver
4. **Calculate Gold Metrics** → Gold
5. **Cleanup** (remove data > 3 years old)

## Running the Pipelines

### Initial Setup (One-time)
```bash
# 1. Load 200 days historical data
python scripts/load_historical_data.py

# 2. Run regular pipeline to process bronze → silver → gold
python scripts/run_ohlcv_pipeline.py
```

### Regular Runs (Daily)
- **Automated**: GitHub Actions runs 2x daily
- **Manual**: `python scripts/run_ohlcv_pipeline.py`

## News Pipeline

- **Frequency**: Daily (5am SGT)
- **Data Source**: Polygon News API
- **Storage**: Postgres with pgvector (embeddings)
- **Retention**: 90 days
- **Tickers**: Same as OHLCV pipeline + custom tickers
