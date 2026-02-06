
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

def fix_security_types():
    url = os.environ.get("POSTGRES_URL")
    if not url: return

    conn = psycopg2.connect(url, sslmode="require")
    cur = conn.cursor()

    print("🔧 Patching Security Types...")
    
    # 1. ETFs
    etfs = ["SPY", "QQQ", "IWM", "DIA", "GLD", "SLV", "ARKK", "SMH", "XLF", "XLE", "XLK", "VTI", "VOO", "VEA", "VWO", "EFA", "IEFA", "AGG", "BND", "IVV"]
    cur.execute(f"UPDATE candidate_features SET security_type = 'ETF' WHERE ticker = ANY(%s)", (etfs,))
    print(f"✅ Updated ETFs (Rows affected: {cur.rowcount})")

    # 2. Crypto
    cur.execute("UPDATE candidate_features SET security_type = 'Crypto' WHERE ticker LIKE '%-%' OR ticker IN ('BTC', 'ETH')")
    print(f"✅ Updated Crypto (Rows affected: {cur.rowcount})")

    # 3. Default Stock (where missing)
    cur.execute("UPDATE candidate_features SET security_type = 'Stock' WHERE security_type IS NULL OR security_type = ''")
    print(f"✅ Updated Stocks (Rows affected: {cur.rowcount})")

    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    fix_security_types()
