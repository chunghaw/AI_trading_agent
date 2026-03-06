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

url = os.environ.get("POSTGRES_URL")
if not url:
    print("No POSTGRES_URL")
    exit(1)

conn = psycopg2.connect(url, sslmode="require")
cur = conn.cursor()

print("--- Checking News Article Dates ---")
cur.execute("SELECT MIN(published_utc), MAX(published_utc), COUNT(*) FROM news_articles")
res = cur.fetchone()
print(f"Total articles: {res[2]} | Oldest: {res[0]} | Newest: {res[1]}")

cur.execute("SELECT ticker, COUNT(*) FROM news_articles WHERE published_utc >= current_date - interval '14 days' GROUP BY ticker ORDER BY count DESC LIMIT 5")
print("\nTop 5 tickers with news in last 14 days:")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} articles")

cur.close()
conn.close()
