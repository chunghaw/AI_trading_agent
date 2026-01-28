#!/usr/bin/env python3
"""Quick test script to verify pipeline results"""
import os
import sys
import psycopg2
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

POSTGRES_URL = os.getenv("POSTGRES_URL")
if not POSTGRES_URL:
    print("❌ POSTGRES_URL not set")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
cursor = conn.cursor()

print("=" * 60)
print("📊 Pipeline Results Check")
print("=" * 60)

# Check news articles
print("\n📰 News Articles (pgvector):")
cursor.execute("SELECT COUNT(*) FROM news_articles")
news_count = cursor.fetchone()[0]
print(f"   Total news articles: {news_count}")

if news_count > 0:
    cursor.execute("""
        SELECT ticker, COUNT(*) as count, MAX(published_utc) as latest
        FROM news_articles 
        GROUP BY ticker 
        ORDER BY count DESC 
        LIMIT 10
    """)
    print("\n   Top tickers by news count:")
    for row in cursor.fetchall():
        print(f"   - {row[0]}: {row[1]} articles (latest: {row[2]})")

# Check screener runs
print("\n🔍 Screener Runs:")
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
        print(f"   - Run #{run[0]}: {run[1]} | Status: {run[2]} | Universe: {run[3]} | Started: {run[4]}")
else:
    print("   No screener runs found yet")

# Check candidates
print("\n🎯 Screen Candidates:")
cursor.execute("""
    SELECT COUNT(*) FROM screen_candidates
""")
candidate_count = cursor.fetchone()[0]
print(f"   Total candidates: {candidate_count}")

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

print("\n" + "=" * 60)
cursor.close()
conn.close()
