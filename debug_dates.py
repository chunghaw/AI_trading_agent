
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

def check_dates():
    url = os.environ.get("POSTGRES_URL")
    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    print("\n--- News Dates Check ---")
    cur.execute("""
        SELECT ticker, title, published_utc 
        FROM news_articles 
        WHERE ticker IN ('AAPL', 'AMD', 'NVDA', 'SPY')
        ORDER BY published_utc DESC
        LIMIT 10
    """)
    rows = cur.fetchall()
    if rows:
        print(f"{'Ticker':<6} | {'Date':<25} | {'Title'}")
        print("-" * 60)
        for r in rows:
            print(f"{r[0]:<6} | {str(r[2]):<25} | {r[1][:40]}...")
    else:
        print("No articles found.")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_dates()
