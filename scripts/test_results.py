#!/usr/bin/env python3
"""Quick test script to verify pipeline results - OHLCV and News"""
import os
import sys
import psycopg2
from datetime import datetime, timedelta

try:
    from dotenv import load_dotenv
    for path in ['.env', '../.env', '../../apps/web/.env.local']:
        if os.path.exists(path):
            load_dotenv(path)
            break
except ImportError:
    pass

POSTGRES_URL = os.getenv("POSTGRES_URL")
if not POSTGRES_URL:
    print("❌ POSTGRES_URL not set")
    sys.exit(1)

print("=" * 70)
print("📊 Pipeline Results Check - OHLCV & News Data")
print("=" * 70)

# Check OHLCV Data (Bronze)
print("\n📈 OHLCV Data (Bronze Layer):")
try:
    conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM bronze_ohlcv")
    bronze_count = cursor.fetchone()[0]
    print(f"   ✅ Bronze records: {bronze_count:,}")
    
    if bronze_count > 0:
        # Check date range
        cursor.execute("SELECT MIN(date) as earliest, MAX(date) as latest FROM bronze_ohlcv")
        date_range = cursor.fetchone()
        print(f"   Date range: {date_range[0]} to {date_range[1]}")
        
        cursor.execute("""
            SELECT symbol, COUNT(*) as count, MAX(date) as latest_date, MIN(date) as earliest_date
            FROM bronze_ohlcv 
            GROUP BY symbol 
            ORDER BY count DESC 
            LIMIT 5
        """)
        print("\n   Top 5 tickers by record count:")
        for row in cursor.fetchall():
            print(f"   - {row[0]}: {row[1]} records | Latest: {row[2]} | Earliest: {row[3]}")
        
        # Check how many days of data per ticker
        cursor.execute("""
            SELECT AVG(count) as avg_days, MIN(count) as min_days, MAX(count) as max_days
            FROM (
                SELECT symbol, COUNT(*) as count
                FROM bronze_ohlcv
                GROUP BY symbol
            ) subq
        """)
        stats = cursor.fetchone()
        print(f"\n   Data coverage: Avg {stats[0]:.1f} days per ticker | Min: {stats[1]} | Max: {stats[2]}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"   ❌ Error: {e}")

# Check OHLCV Data (Silver)
print("\n📊 OHLCV Data (Silver Layer):")
try:
    conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM silver_ohlcv")
    silver_count = cursor.fetchone()[0]
    print(f"   ✅ Silver records: {silver_count:,}")
    
    if silver_count > 0:
        cursor.execute("""
            SELECT symbol, COUNT(*) as count, MAX(date) as latest_date
            FROM silver_ohlcv 
            WHERE is_valid = true
            GROUP BY symbol 
            ORDER BY count DESC 
            LIMIT 5
        """)
        print("\n   Top 5 tickers (valid records):")
        for row in cursor.fetchall():
            print(f"   - {row[0]}: {row[1]} records | Latest: {row[2]}")
            
        # Check technical indicators
        cursor.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE rsi IS NOT NULL) as has_rsi,
                COUNT(*) FILTER (WHERE macd_line IS NOT NULL) as has_macd,
                COUNT(*) FILTER (WHERE ma_200 IS NOT NULL) as has_ma200
            FROM silver_ohlcv
            WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        """)
        indicators = cursor.fetchone()
        print(f"\n   Technical Indicators (last 30 days):")
        print(f"   - RSI: {indicators[0]:,} records")
        print(f"   - MACD: {indicators[1]:,} records")
        print(f"   - MA200: {indicators[2]:,} records")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"   ❌ Error: {e}")

# Check OHLCV Data (Gold)
print("\n🏆 OHLCV Data (Gold Layer):")
try:
    conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM gold_ohlcv_daily_metrics")
    gold_count = cursor.fetchone()[0]
    print(f"   ✅ Gold records: {gold_count:,}")
    
    if gold_count > 0:
        cursor.execute("""
            SELECT symbol, date, close, rsi_14, ma_200
            FROM gold_ohlcv_daily_metrics
            ORDER BY date DESC, symbol
            LIMIT 5
        """)
        print("\n   Latest 5 records:")
        for row in cursor.fetchall():
            symbol, date, close, rsi, ma200 = row
            close_str = f"${close:.2f}" if close is not None else "N/A"
            rsi_str = f"{rsi:.1f}" if rsi is not None else "N/A"
            ma200_str = f"${ma200:.2f}" if ma200 is not None else "N/A"
            print(f"   - {symbol} ({date}): Close={close_str} | RSI={rsi_str} | MA200={ma200_str}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"   ❌ Error: {e}")

# Check news articles
print("\n📰 News Articles (pgvector):")
try:
    conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM news_articles")
    news_count = cursor.fetchone()[0]
    print(f"   ✅ Total news articles: {news_count:,}")

    if news_count > 0:
        cursor.execute("""
            SELECT ticker, COUNT(*) as count, MAX(published_utc) as latest
            FROM news_articles 
            GROUP BY ticker 
            ORDER BY count DESC 
            LIMIT 10
        """)
        print("\n   Top 10 tickers by news count:")
        for row in cursor.fetchall():
            print(f"   - {row[0]}: {row[1]} articles | Latest: {row[2]}")
        
        # Check recent news (last 7 days)
        cursor.execute("""
            SELECT COUNT(*) 
            FROM news_articles 
            WHERE published_utc >= CURRENT_DATE - INTERVAL '7 days'
        """)
        recent_news = cursor.fetchone()[0]
        print(f"\n   Recent news (last 7 days): {recent_news:,} articles")
        
        # Check embeddings
        cursor.execute("""
            SELECT COUNT(*) 
            FROM news_articles 
            WHERE embedding IS NOT NULL
        """)
        with_embeddings = cursor.fetchone()[0]
        print(f"   Articles with embeddings: {with_embeddings:,}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"   ❌ Error: {e}")

# Check screener runs
print("\n🔍 Screener Runs:")
try:
    conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, run_date, status, universe_size, started_at, finished_at
        FROM screen_runs 
        ORDER BY run_date DESC 
        LIMIT 5
    """)
    runs = cursor.fetchall()
    if runs:
        print(f"   Found {len(runs)} recent runs:")
        for run in runs:
            duration = ""
            if run[4] and run[5]:
                duration = f" | Duration: {(run[5] - run[4]).total_seconds():.0f}s"
            print(f"   - Run #{run[0]}: {run[1]} | Status: {run[2]} | Universe: {run[3]}{duration}")
    else:
        print("   No screener runs found yet")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"   ❌ Error: {e}")

# Check candidates
print("\n🎯 Screen Candidates:")
try:
    conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM screen_candidates")
    candidate_count = cursor.fetchone()[0]
    print(f"   ✅ Total candidates: {candidate_count:,}")

    if candidate_count > 0:
        cursor.execute("""
            SELECT ticker, final_score, technical_score, news_score
            FROM screen_candidates
            ORDER BY final_score DESC
            LIMIT 10
        """)
        print("\n   Top 10 candidates:")
        for row in cursor.fetchall():
            print(f"   - {row[0]}: Final={row[1]:.1f} | Tech={row[2]:.1f} | News={row[3]:.1f}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 70)
print("✅ Check complete!")
print("=" * 70)
