
import os
import psycopg2
from dotenv import load_dotenv

# Load envs
load_dotenv(".env")
load_dotenv(".env.local")
load_dotenv("apps/web/.env.local") # Try specific app env if root fails

def run_migration():
    url = os.getenv("POSTGRES_URL")
    if not url:
        print("❌ POSTGRES_URL is missing!")
        return

    try:
        conn = psycopg2.connect(url, sslmode="require")
        cur = conn.cursor()
        
        print("🔌 Connected to DB. Checking schema...")
        
        # Check column
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='candidate_features' AND column_name='market_cap';
        """)
        
        if cur.fetchone():
            print("✅ 'market_cap' column already exists.")
        else:
            print("⚠️ 'market_cap' missing. Adding it...")
            cur.execute("ALTER TABLE candidate_features ADD COLUMN market_cap DECIMAL(30, 2);")
            conn.commit()
            print("✅ Added 'market_cap' column.")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
