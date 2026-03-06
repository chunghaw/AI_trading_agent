"""
AI Trading Pipeline - Polygon Fundamentals Data Ingestion
Fetches essential financial data (P/E ratio components, Net Income, etc.) 
and updates a dedicated table for the Screener UI.
"""

import os
import time
import requests
import psycopg2
from sqlalchemy import create_engine, text
import logging
from datetime import datetime, timezone
import json
import base64
from dotenv import load_dotenv

load_dotenv()

# Configuration
POLYGON_API_KEY = os.environ.get('POLYGON_API_KEY')
POSTGRES_URL = os.environ.get('POSTGRES_URL')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_table():
    logger.info("Setting up silver_fundamentals table...")
    engine = create_engine(POSTGRES_URL)
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS silver_fundamentals (
                symbol VARCHAR(20) PRIMARY KEY,
                basic_eps DECIMAL(20, 8),
                net_income BIGINT,
                revenues BIGINT,
                last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

def fetch_tickers():
    logger.info("Fetching ticker list from gold_ohlcv_daily_metrics...")
    # Get all active tickers from the gold table
    engine = create_engine(POSTGRES_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT DISTINCT symbol FROM gold_ohlcv_daily_metrics")).fetchall()
    return [row[0] for row in result]

def fetch_financials(tickers):
    if not POLYGON_API_KEY:
        logger.error("Missing POLYGON_API_KEY")
        return []

    fundamentals = []
    logger.info(f"Fetching financial data for {len(tickers)} tickers. This may take some time...")

    batch_size = 100
    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:min(i+batch_size, len(tickers))]
        logger.info(f"Processing batch {i//batch_size + 1}: {len(batch)} tickers")

        for symbol in batch:
            try:
                url = f"https://api.polygon.io/vX/reference/financials?ticker={symbol}&limit=1&apiKey={POLYGON_API_KEY}"
                resp = requests.get(url)
                
                if resp.status_code == 429:
                    logger.warning(f"Rate limited on {symbol}! Pausing...")
                    time.sleep(1) # Backoff
                    resp = requests.get(url) # Retry once
                
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if results:
                        financials = results[0].get("financials", {})
                        income_statement = financials.get("income_statement", {})
                        
                        basic_eps = income_statement.get("basic_earnings_per_share", {}).get("value", None)
                        net_income = income_statement.get("net_income_loss", {}).get("value", None)
                        revenues = income_statement.get("revenues", {}).get("value", None)

                        fundamentals.append({
                            'symbol': symbol,
                            'basic_eps': basic_eps,
                            'net_income': net_income,
                            'revenues': revenues
                        })
                        # logger.info(f"✓ {symbol}: EPS: {basic_eps}")
                    else:
                        pass # No financials on record (common for ETFs)
                        # logger.debug(f"⚠ {symbol}: No financials found")
            except Exception as e:
                logger.error(f"❌ Error fetching {symbol}: {e}")
            
            # API rate limit delay (adjusted for potentially thousands of symbols without breaking rate limit)
            time.sleep(0.02) 

    return fundamentals

def load_data(data):
    if not data:
        logger.warning("No fundamental data to load.")
        return

    logger.info(f"Upserting {len(data)} fundamental records into DB...")
    engine = create_engine(POSTGRES_URL)
    
    with engine.begin() as conn:
        for record in data:
            conn.execute(text("""
                INSERT INTO silver_fundamentals (symbol, basic_eps, net_income, revenues, last_updated)
                VALUES (:symbol, :basic_eps, :net_income, :revenues, CURRENT_TIMESTAMP)
                ON CONFLICT (symbol) DO UPDATE 
                SET basic_eps = EXCLUDED.basic_eps,
                    net_income = EXCLUDED.net_income,
                    revenues = EXCLUDED.revenues,
                    last_updated = EXCLUDED.last_updated;
            """), record)

    logger.info("✅ Database upsert complete.")

def main():
    logger.info("🚀 Starting Polygon Fundamentals Pipeline")
    
    create_table()
    tickers = fetch_tickers()
    
    # Just grab a sample subset if testing, or all. 
    # To prevent blowing rate limits today, we'll try grabbing them all!
    fund_data = fetch_financials(tickers)
    
    load_data(fund_data)
    
    logger.info("🎉 Pipeline finished.")

if __name__ == "__main__":
    main()
