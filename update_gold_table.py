#!/usr/bin/env python3
"""
Update gold table with latest data and technical indicators
"""

import psycopg2
import os
from sqlalchemy import create_engine, text
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def update_gold_table():
    """Update gold table with latest data and technical indicators"""
    
    POSTGRES_URL = os.environ.get('POSTGRES_URL', 'postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require')
    
    try:
        engine = create_engine(POSTGRES_URL)
        
        with engine.begin() as conn:
            logger.info("🚀 Updating gold table with latest data and indicators")
            
            # Step 1: Clear existing gold table
            conn.execute(text("DELETE FROM gold_ohlcv_daily_metrics"))
            logger.info("🗑️  Cleared existing gold table")
            
            # Step 2: Insert latest record per symbol with COALESCE for technical indicators
            conn.execute(text("""
                WITH latest_prices AS (
                    -- Get the absolute latest record per symbol (for price data)
                    SELECT DISTINCT ON (symbol)
                        symbol,
                        date,
                        open,
                        high,
                        low,
                        close,
                        volume as total_volume,
                        vwap as avg_vwap,
                        dollar_volume as total_dollar_volume,
                        daily_range as max_range,
                        daily_return_pct,
                        daily_range as intraday_range,
                        transactions as total_transactions,
                        ingestion_time as last_updated,
                        company_name,
                        market,
                        stock_type,
                        primary_exchange,
                        currency,
                        locale,
                        list_date,
                        total_employees,
                        description,
                        shares_outstanding,
                        market_cap
                    FROM silver_ohlcv
                    WHERE is_valid = true
                      AND date >= CURRENT_DATE - INTERVAL '30 days'
                    ORDER BY symbol, date DESC
                ),
                latest_indicators AS (
                    -- Get the most recent non-NULL value for each technical indicator per symbol
                    SELECT DISTINCT ON (symbol)
                        symbol,
                        (SELECT rsi FROM silver_ohlcv WHERE symbol = s.symbol AND rsi IS NOT NULL ORDER BY date DESC LIMIT 1) as rsi_14,
                        (SELECT ma_5 FROM silver_ohlcv WHERE symbol = s.symbol AND ma_5 IS NOT NULL ORDER BY date DESC LIMIT 1) as ma_5,
                        (SELECT ma_20 FROM silver_ohlcv WHERE symbol = s.symbol AND ma_20 IS NOT NULL ORDER BY date DESC LIMIT 1) as ma_20,
                        (SELECT ma_50 FROM silver_ohlcv WHERE symbol = s.symbol AND ma_50 IS NOT NULL ORDER BY date DESC LIMIT 1) as ma_50,
                        (SELECT ma_200 FROM silver_ohlcv WHERE symbol = s.symbol AND ma_200 IS NOT NULL ORDER BY date DESC LIMIT 1) as ma_200,
                        (SELECT ema_20 FROM silver_ohlcv WHERE symbol = s.symbol AND ema_20 IS NOT NULL ORDER BY date DESC LIMIT 1) as ema_20,
                        (SELECT ema_50 FROM silver_ohlcv WHERE symbol = s.symbol AND ema_50 IS NOT NULL ORDER BY date DESC LIMIT 1) as ema_50,
                        (SELECT ema_200 FROM silver_ohlcv WHERE symbol = s.symbol AND ema_200 IS NOT NULL ORDER BY date DESC LIMIT 1) as ema_200,
                        (SELECT macd_line FROM silver_ohlcv WHERE symbol = s.symbol AND macd_line IS NOT NULL ORDER BY date DESC LIMIT 1) as macd_line,
                        (SELECT macd_signal FROM silver_ohlcv WHERE symbol = s.symbol AND macd_signal IS NOT NULL ORDER BY date DESC LIMIT 1) as macd_signal,
                        (SELECT macd_histogram FROM silver_ohlcv WHERE symbol = s.symbol AND macd_histogram IS NOT NULL ORDER BY date DESC LIMIT 1) as macd_histogram,
                        (SELECT atr FROM silver_ohlcv WHERE symbol = s.symbol AND atr IS NOT NULL ORDER BY date DESC LIMIT 1) as atr_14,
                        (SELECT vwap FROM silver_ohlcv WHERE symbol = s.symbol AND vwap IS NOT NULL ORDER BY date DESC LIMIT 1) as vwap
                    FROM silver_ohlcv s
                    WHERE is_valid = true
                      AND date >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY symbol
                )
                INSERT INTO gold_ohlcv_daily_metrics (
                    symbol, date, open, high, low, close, total_volume, avg_vwap,
                    total_dollar_volume, max_range, daily_return_pct, intraday_range,
                    total_transactions, last_updated,
                    rsi_14, ma_5, ma_20, ma_50, ma_200,
                    ema_20, ema_50, ema_200,
                    macd_line, macd_signal, macd_histogram,
                    atr_14, vwap,
                    company_name, market, stock_type, primary_exchange,
                    currency, locale, list_date, total_employees,
                    description, shares_outstanding, market_cap
                )
                SELECT 
                    lp.symbol, lp.date, lp.open, lp.high, lp.low, lp.close, 
                    lp.total_volume, lp.avg_vwap, lp.total_dollar_volume, lp.max_range, 
                    lp.daily_return_pct, lp.intraday_range, lp.total_transactions, lp.last_updated,
                    li.rsi_14, li.ma_5, li.ma_20, li.ma_50, li.ma_200,
                    li.ema_20, li.ema_50, li.ema_200,
                    li.macd_line, li.macd_signal, li.macd_histogram,
                    li.atr_14, li.vwap,
                    lp.company_name, lp.market, lp.stock_type, lp.primary_exchange,
                    lp.currency, lp.locale, lp.list_date, lp.total_employees,
                    lp.description, lp.shares_outstanding, lp.market_cap
                FROM latest_prices lp
                LEFT JOIN latest_indicators li ON lp.symbol = li.symbol;
            """))
            
            # Get counts for logging
            result = conn.execute(text("SELECT COUNT(*) FROM gold_ohlcv_daily_metrics"))
            gold_count = result.fetchone()[0]
            
            logger.info(f"✅ Gold table updated with {gold_count} records (1 per symbol)")
            logger.info("✅ Each record has LATEST price data + most recent valid technical indicators")
            
            # Show sample data
            result = conn.execute(text("""
                SELECT symbol, date, close, rsi_14, ema_20, macd_line, atr_14
                FROM gold_ohlcv_daily_metrics
                WHERE symbol IN ('TSLA', 'NVDA', 'AAPL')
                ORDER BY symbol
            """))
            
            logger.info("\n📊 Sample Gold Table Data:")
            logger.info("Symbol | Date       | Close   | RSI    | EMA20     | MACD     | ATR")
            logger.info("-------+------------+---------+--------+-----------+----------+--------")
            for row in result.fetchall():
                symbol, date, close, rsi, ema20, macd, atr = row
                rsi_str = f"{rsi:.2f}" if rsi else "NULL"
                ema20_str = f"{ema20:.2f}" if ema20 else "NULL"
                macd_str = f"{macd:.2f}" if macd else "NULL"
                atr_str = f"{atr:.2f}" if atr else "NULL"
                logger.info(f"{symbol:6} | {date} | {close:7.2f} | {rsi_str:6} | {ema20_str:9} | {macd_str:8} | {atr_str:6}")
            
            return f"Gold table updated successfully - {gold_count} symbols"
            
    except Exception as e:
        logger.error(f"❌ Error updating gold table: {e}")
        raise

if __name__ == "__main__":
    update_gold_table()

