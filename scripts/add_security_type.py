
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

def add_security_type():
    url = os.environ.get("POSTGRES_URL")
    if not url: return

    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()
    
    print("🔌 Checking schema for 'security_type'...")
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'candidate_features' AND column_name = 'security_type';
    """)
    if cur.fetchone():
        print("✅ 'security_type' already exists.")
    else:
        print("⚠️ Adding 'security_type' column...")
        cur.execute("ALTER TABLE candidate_features ADD COLUMN security_type VARCHAR(50);")
        conn.commit()
        print("✅ Column added.")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    add_security_type()
