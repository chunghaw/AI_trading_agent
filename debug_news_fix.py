
import os
import psycopg2
import openai
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

def test_news_fallback():
    url = os.environ.get("POSTGRES_URL")
    api_key = os.environ.get("OPENAI_API_KEY")
    
    if not url or not api_key:
        print("❌ Missing keys")
        return

    openai.api_key = api_key
    client = openai.OpenAI(api_key=api_key)

    # Simulate: Ticker="SPY", Company="S&P 500"
    ticker = "SPY"
    company_name = "S&P 500"
    query_text = f"{ticker} {company_name} news"
    
    print(f"\n--- Searching for: '{query_text}' ---")

    try:
        resp = client.embeddings.create(input=query_text, model="text-embedding-3-small")
        embedding = resp.data[0].embedding
    except Exception as e:
        print(f"❌ Embedding failed: {e}")
        return

    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    # The strict query used by the app (approximate)
    vector_str = "[" + ",".join(map(str, embedding)) + "]"
    
    # We want to see if this vector finds articles
    sql = """
        SELECT ticker, title, published_utc, 1 - (embedding <=> %s::vector) as similarity
        FROM news_articles
        ORDER BY embedding <=> %s::vector
        LIMIT 5
    """
    cur.execute(sql, (vector_str, vector_str))
    rows = cur.fetchall()
    
    if rows:
        print("✅ Found related articles:")
        for r in rows:
            print(f"  [{r[0]}] {r[1][:60]}... ({r[3]:.4f})")
    else:
        print("❌ No articles found.")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    test_news_fallback()
