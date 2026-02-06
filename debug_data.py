
import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local")

# Quick helper to print table-like output
def print_rows(rows, cols):
    print(" | ".join(cols))
    print("-" * 50)
    for r in rows:
        print(" | ".join(str(x) for x in r))

def debug_data():
    conn = psycopg2.connect(os.environ["POSTGRES_URL"], sslmode="require")
    cur = conn.cursor()

    print("\n--- 1. Market Cap in Source Data (gold_ohlcv_daily_metrics) ---")
    # Check if we have ANY market cap data for recent dates
    cur.execute("""
        SELECT symbol, date, close, market_cap 
        FROM gold_ohlcv_daily_metrics 
        WHERE date >= CURRENT_DATE - INTERVAL '10 days'
        AND market_cap IS NOT NULL 
        AND market_cap > 0
        LIMIT 5;
    """)
    rows = cur.fetchall()
    if rows:
        print_rows(rows, ["Symbol", "Date", "Close", "Market Cap"])
    else:
        print("⚠️ NO valid Market Cap data found in gold_ohlcv_daily_metrics for the last 10 days!")
        # Check what we DO have
        cur.execute("""
            SELECT symbol, date, close, market_cap 
            FROM gold_ohlcv_daily_metrics 
            WHERE date >= CURRENT_DATE - INTERVAL '5 days' 
            LIMIT 5;
        """)
        print("Sample of what exists:")
        print_rows(cur.fetchall(), ["Symbol", "Date", "Close", "Market Cap"])

    print("\n--- 2. Market Cap in Candidate Features ---")
    cur.execute("""
        SELECT ticker, asof_date, market_cap 
        FROM candidate_features 
        LIMIT 5;
    """)
    rows = cur.fetchall()
    print_rows(rows, ["Ticker", "Date", "Market Cap"])

    print("\n--- 3. AI Summaries ---")
    cur.execute("SELECT COUNT(*) FROM candidate_summary;")
    count = cur.fetchone()[0]
    print(f"Total Summaries: {count}")
    
    if count > 0:
        cur.execute("SELECT ticker, summary_json FROM candidate_summary LIMIT 1;")
        row = cur.fetchone()
        print(f"Sample Summary for {row[0]}:")
        print(json.dumps(row[1], indent=2)[:500] + "...")
    else:
        print("⚠️ No AI summaries found.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    debug_data()
