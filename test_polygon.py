import os
import requests
from dotenv import load_dotenv
import json

load_dotenv()
key = os.getenv("POLYGON_API_KEY")

url = f"https://api.polygon.io/v3/reference/tickers/AAPL?apiKey={key}"
r = requests.get(url)

print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(json.dumps(data, indent=2))
else:
    print(r.text)
