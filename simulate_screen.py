
import os
import psycopg2
import json
from dotenv import load_dotenv

# Load envs
load_dotenv(".env")
load_dotenv(".env.local")
try:
    with open("apps/web/.env.local", "r") as f:
        for line in f:
            if line.startswith("POSTGRES_URL="):
                os.environ["POSTGRES_URL"] = line.strip().split("=", 1)[1].strip('"')
except:
    pass

def simulate_run():
    url = os.environ.get("POSTGRES_URL")
    if not url:
        print("❌ No POSTGRES_URL")
        return

    print(f"🔌 Connecting to DB...")
    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    # 1. Check Table Existence
    cur.execute("SELECT to_regclass('public.candidate_features');")
    if cur.fetchone()[0] is None:
        print("❌ Table 'candidate_features' does not exist (public schema).")
        # Check if it exists elsewhere
        cur.execute("SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'candidate_features';")
        rows = cur.fetchall()
        if rows:
            print(f"⚠️ Found table in schemas: {[r[0] for r in rows]}")
    else:
        print("✅ Table 'candidate_features' exists.")
        
        # Check column existence
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'candidate_features' AND column_name = 'market_cap';
        """)
        col = cur.fetchone()
        if col:
             print(f"✅ Column 'market_cap' exists (type: {col[1]}).")
        else:
             print("❌ Column 'market_cap' MISSING in candidate_features.")

    # 2. Check Source Data (Market Cap)
    print("\n--- Source Data Check ---")
    cur.execute("""
        SELECT symbol, date, close, market_cap, total_volume
        FROM gold_ohlcv_daily_metrics 
        WHERE date >= CURRENT_DATE - INTERVAL '5 days'
        LIMIT 5
    """)
    rows = cur.fetchall()
    print("Sample Source Rows (gold):")
    for r in rows:
        print(f"  {r[0]} ({r[1]}): Close=${r[2]}, Cap=${r[3]}, Vol={r[4]}")
    
    # Check if ANY non-zero market cap exists
    cur.execute("SELECT COUNT(*) FROM gold_ohlcv_daily_metrics WHERE market_cap > 0")
    non_zero = cur.fetchone()[0]
    print(f"\nTotal rows with non-zero Market Cap: {non_zero}")

    # 3. Check AI Summaries
    print("\n--- AI Summaries Check ---")
    cur.execute("SELECT COUNT(*) FROM candidate_summary")
    count = cur.fetchone()[0]
    print(f"Total AI Summaries in DB: {count}")
    
    cur.execute("""
        SELECT t.ticker, s.summary_json IS NOT NULL as has_summary
        FROM candidate_features t
        LEFT JOIN candidate_summary s ON t.ticker = s.ticker AND t.run_id = s.run_id
        ORDER BY t.run_id DESC, t.ticker
        LIMIT 10
    """)
    print("\nRecent Candidates & Summaries:")
    for r in cur.fetchall():
        print(f"  {r[0]}: Summary Exists? {r[1]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    simulate_run()
