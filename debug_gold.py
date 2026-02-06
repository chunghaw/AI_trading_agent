
import os
import psycopg2
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

def check_gold():
    url = os.environ.get("POSTGRES_URL")
    if not url: 
        print("No URL")
        return

    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    print("\n--- Company Name Check ---")
    cur.execute("""
        SELECT symbol, date, company_name, market 
        FROM gold_ohlcv_daily_metrics 
        WHERE symbol IN ('SPY', 'AAPL', 'NVDA', 'AMD')
        ORDER BY date DESC 
        LIMIT 5
    """)
    rows = cur.fetchall()
    
    col_width = 25
    print(f"{'Symbol':<6} | {'Date':<10} | {'Company Name':<30} | {'Market'}")
    print("-" * 65)
    for r in rows:
        cname = r[2] if r[2] else "NULL"
        print(f"{r[0]:<6} | {str(r[1]):<10} | {cname:<30} | {r[3]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_gold()
