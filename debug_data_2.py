
import os
import psycopg2
import asyncio
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

# Mock the AI Agent call to see if it works without importing the whole heavy app context
# We'll just check the Milvus/OpenAI keys availability first
import openai

def check_shares_and_ai():
    url = os.environ.get("POSTGRES_URL")
    if not url:
        print("❌ No POSTGRES_URL")
        return

    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    print("\n--- 1. Shares Outstanding Check ---")
    # Check if 'shares_outstanding' column exists first
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='gold_ohlcv_daily_metrics' AND column_name='shares_outstanding'")
    if cur.fetchone():
        cur.execute("""
            SELECT symbol, date, close, shares_outstanding 
            FROM gold_ohlcv_daily_metrics 
            WHERE date >= CURRENT_DATE - INTERVAL '10 days'
            AND shares_outstanding IS NOT NULL AND shares_outstanding > 0
            LIMIT 5
        """)
        rows = cur.fetchall()
        if rows:
            print("✅ Found Shares Outstanding data!")
            for r in rows:
                print(f"  {r[0]}: Shares={r[3]}, Price={r[2]} => Calculated Cap=${float(r[2])*float(r[3]):,.0f}")
        else:
            print("❌ 'shares_outstanding' column exists but data is 0/NULL.")
    else:
        print("❌ 'shares_outstanding' column DOES NOT EXIST in gold_ohlcv_daily_metrics.")

    print("\n--- 2. AI Credentials Check ---")
    openai_key = os.environ.get("OPENAI_API_KEY")
    print(f"OpenAI Key Present: {bool(openai_key)}")
    
    milvus_token = os.environ.get("MILVUS_API_KEY")
    print(f"Milvus Token Present: {bool(milvus_token)}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_shares_and_ai()
