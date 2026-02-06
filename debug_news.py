
import os
import psycopg2
import asyncio
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

def debug_news_search():
    url = os.environ.get("POSTGRES_URL")
    if not url:
        print("❌ No POSTGRES_URL")
        return

    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    print("\n--- 1. News Articles Ticker Check ---")
    cur.execute("SELECT ticker, count(*) FROM news_articles GROUP BY ticker LIMIT 10")
    rows = cur.fetchall()
    if rows:
        print("Found tickers in DB:")
        for r in rows:
            print(f"  '{r[0]}': {r[1]} articles")
    else:
        print("❌ No articles found in news_articles table.")

    # Pick a ticker that exists
    target_ticker = rows[0][0] if rows else "AAPL"
    print(f"\n--- 2. Simulating Search for {target_ticker} ---")

    # Check approximate count without vector search first (fallback)
    cur.execute("SELECT COUNT(*) FROM news_articles WHERE ticker = %s", (target_ticker,))
    exact_match = cur.fetchone()[0]
    print(f"Exact match count for '{target_ticker}': {exact_match}")

    cur.execute("SELECT COUNT(*) FROM news_articles WHERE ticker = %s", (target_ticker.lower(),))
    lower_match = cur.fetchone()[0]
    print(f"Lowercase match count for '{target_ticker.lower()}': {lower_match}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    debug_news_search()
