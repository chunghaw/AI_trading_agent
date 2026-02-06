
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

def debug_vector_search():
    url = os.environ.get("POSTGRES_URL")
    api_key = os.environ.get("OPENAI_API_KEY")
    
    if not url:
        print("❌ No POSTGRES_URL")
        return
    if not api_key:
        print("❌ No OPENAI_API_KEY")
        return

    openai.api_key = api_key
    client = openai.OpenAI(api_key=api_key)

    print("\n--- 1. Generating Embedding ---")
    try:
        query_text = "AAPL earnings news"
        resp = client.embeddings.create(
            input=query_text,
            model="text-embedding-3-small"
        )
        embedding = resp.data[0].embedding
        print(f"✅ Generated embedding for '{query_text}' (len={len(embedding)})")
    except Exception as e:
        print(f"❌ OpenAI Error: {e}")
        return

    print("\n--- 2. Executing SQL Vector Search ---")
    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    try:
        vector_str = "[" + ",".join(map(str, embedding)) + "]"
        sql = """
            SELECT id, title, ticker, 1 - (embedding <=> %s::vector) as similarity
            FROM news_articles
            WHERE ticker = 'AAPL'
            ORDER BY embedding <=> %s::vector
            LIMIT 5
        """
        cur.execute(sql, (vector_str, vector_str))
        rows = cur.fetchall()
        
        if rows:
            print("✅ Vector Search SUCCESS!")
            for r in rows:
                print(f"  [{r[3]:.4f}] {r[2]}: {r[1][:50]}...")
        else:
            print("⚠️ Vector Search returned ZERO rows (but articles exist in DB).")
            # Maybe the <=> operator is returning very high distance?
            
    except Exception as e:
        print(f"❌ SQL Execution Error: {e}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    debug_vector_search()
