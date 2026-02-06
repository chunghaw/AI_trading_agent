
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

def check_market_types():
    url = os.environ.get("POSTGRES_URL")
    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    print("\n--- Market Column Distribution ---")
    cur.execute("""
        SELECT market, COUNT(*) 
        FROM gold_ohlcv_daily_metrics 
        GROUP BY market
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"'{r[0]}': {r[1]}")
        
    print("\n--- Sample Tickers ---")
    cur.execute("""
        SELECT symbol, market 
        FROM gold_ohlcv_daily_metrics 
        WHERE symbol IN ('SPY', 'AAPL', 'BTC-USD', 'ETH-USD')
        ORDER BY date DESC 
        LIMIT 5
    """)
    for r in rows:
        print(f"{r}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_market_types()
