import os
import psycopg2
from dotenv import load_dotenv
import json

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

print("--- Checking Top Candidates from Latest Run ---")
cur.execute("SELECT id FROM screen_runs ORDER BY id DESC LIMIT 1")
run_id = cur.fetchone()[0]

cur.execute("""
    SELECT c.ticker, c.final_score, s.summary_json, c.news_score
    FROM screen_candidates c
    LEFT JOIN candidate_summary s ON c.run_id = s.run_id AND c.ticker = s.ticker
    WHERE c.run_id = %s
    ORDER BY c.final_score DESC
    LIMIT 5
""", (run_id,))

rows = cur.fetchall()
for r in rows:
    ticker = r[0]
    score = r[1]
    summary = r[2]
    news_score = r[3]
    has_summary = "YES" if summary else "NO"
    print(f"Ticker: {ticker} | Score: {score} | News Score: {news_score} | Has Summary: {has_summary}")
    if not summary:
        print(f"  -> Missing summary. Let's check candidate_news count:")
        cur.execute("SELECT count(*) FROM candidate_news WHERE run_id = %s AND ticker = %s", (run_id, ticker))
        news_count = cur.fetchone()[0]
        print(f"  -> News count: {news_count}")

cur.close()
conn.close()
