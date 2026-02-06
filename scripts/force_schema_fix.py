
import os
import psycopg2
from dotenv import load_dotenv

# Load env from root
load_dotenv(".env")
load_dotenv(".env.local")

# Also try loading from apps/web/.env.local directly, just in case
try:
    with open("apps/web/.env.local", "r") as f:
        for line in f:
            if line.startswith("POSTGRES_URL="):
                os.environ["POSTGRES_URL"] = line.strip().split("=", 1)[1].strip('"')
except FileNotFoundError:
    pass

def force_fix():
    url = os.getenv("POSTGRES_URL")
    if not url:
        print("❌ POSTGRES_URL not found!")
        return

    print(f"🔌 Connecting to: {url.split('@')[1] if '@' in url else 'DB'}")

    try:
        conn = psycopg2.connect(url, sslmode="require")
        cur = conn.cursor()

        # 1. Check if table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'candidate_features'
            );
        """)
        exists = cur.fetchone()[0]
        
        if not exists:
            print("⚠️ Table 'candidate_features' DOES NOT EXIST. Creating it...")
            create_sql = """
            CREATE TABLE IF NOT EXISTS candidate_features (
                run_id INTEGER NOT NULL REFERENCES screen_runs(id) ON DELETE CASCADE,
                ticker VARCHAR(20) NOT NULL,
                asof_date DATE NOT NULL,
                sma50 DECIMAL(20, 8),
                sma200 DECIMAL(20, 8),
                macd DECIMAL(10, 6),
                macd_signal DECIMAL(10, 6),
                macd_hist DECIMAL(10, 6),
                rvol DECIMAL(10, 6),
                atrp DECIMAL(10, 6),
                breakout_flag BOOLEAN DEFAULT FALSE,
                trend_flag BOOLEAN DEFAULT FALSE,
                momentum_flag BOOLEAN DEFAULT FALSE,
                volume_flag BOOLEAN DEFAULT FALSE,
                beta_1y DECIMAL(10, 6),
                dollar_volume_1m DECIMAL(20, 8),
                market_cap DECIMAL(30, 2),
                raw_json JSONB,
                PRIMARY KEY (run_id, ticker)
            );
            """
            cur.execute(create_sql)
            conn.commit()
            print("✅ Table created successfully.")
        else:
            print("✅ Table 'candidate_features' exists.")
            
            # 2. Check if column exists
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='candidate_features' AND column_name='market_cap';
            """)
            col = cur.fetchone()
            
            if col:
                print("✅ Column 'market_cap' already exists.")
            else:
                print("⚠️ Column 'market_cap' missing. Adding it...")
                cur.execute("ALTER TABLE candidate_features ADD COLUMN market_cap DECIMAL(30, 2);")
                conn.commit()
                print("✅ Column added successfully.")
        
        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    force_fix()
