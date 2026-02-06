import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local")

try:
    conn = psycopg2.connect(os.environ["POSTGRES_URL"], sslmode="require")
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM news_articles;")
    count = cur.fetchone()[0]
    print(f"Total News Articles: {count}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
