
import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local")
try:
    with open("apps/web/.env.local", "r") as f:
        for line in f:
            if line.startswith("POSTGRES_URL="):
                os.environ["POSTGRES_URL"] = line.strip().split("=", 1)[1].strip('"')
except:
    pass

def check_spy():
    url = os.environ.get("POSTGRES_URL")
    if not url: return

    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    print("\n--- SPY Feature Data ---")
    cur.execute("""
        SELECT ticker, security_type, market_cap 
        FROM candidate_features 
        WHERE ticker = 'SPY' 
        ORDER BY asof_date DESC 
        LIMIT 1
    """)
    row = cur.fetchone()
    if row:
        print(f"Ticker: {row[0]}")
        print(f"Security Type: {row[1]}") # Should be 'ETF'
        print(f"Market Cap: {row[2]}")
    else:
        print("SPY not found in candidate_features")

    print("\n--- SPY News Data ---")
    cur.execute("""
        SELECT COUNT(*) FROM candidate_news WHERE ticker = 'SPY'
    """)
    count = cur.fetchone()[0]
    print(f"News Articles Linked: {count}")

    print("\n--- SPY AI Summary ---")
    cur.execute("""
        SELECT summary_json FROM candidate_summary WHERE ticker = 'SPY' ORDER BY created_at DESC LIMIT 1
    """)
    row = cur.fetchone()
    if row and row[0]:
        print("Summary JSON found:")
        print(json.dumps(row[0], indent=2)[:500] + "...")
    else:
        print("❌ No AI Summary found for SPY")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_spy()
