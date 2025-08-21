# -*- coding: utf-8 -*-
"""
Airflow DAG: ohlcv_indicators_pipeline_dag
Purpose:
  - Fetch OHLCV data for equities (Polygon) and/or crypto (Binance)
  - Compute RSI and MACD with pandas-ta (pure Python)
  - Write Parquet files to a data directory (mount to persistent volume)
  - [Optional] Add a Snowflake upsert task later

ENV / Variables:
  POLYGON_API_KEY
  EQUITY_TICKERS (JSON, e.g. ["NVDA","AMD"])
  CRYPTO_SYMBOLS (JSON, e.g. ["BTCUSDT","ETHUSDT"])
  OHLCV_TIMEFRAME ("1h"|"4h"|"day")
  OHLCV_LOOKBACK_DAYS (default: 30)
  DATA_DIR (default: /opt/airflow/data/indicators)
"""

from __future__ import annotations

import os
import json
import time
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

import requests
import pandas as pd
import pandas_ta as ta

from airflow import DAG
from airflow.decorators import task
from airflow.models import Variable
from airflow.utils.dates import days_ago


def env_or_var(key: str, default: str | None = None) -> str | None:
    val = os.getenv(key)
    if val not in (None, ""):
        return val
    try:
        return Variable.get(key)
    except Exception:
        return default


def polygon_aggregates(ticker: str, mult: int, unit: str, start: str, end: str, adjusted: bool = True) -> pd.DataFrame:
    api_key = env_or_var("POLYGON_API_KEY")
    if not api_key:
        raise RuntimeError("POLYGON_API_KEY not set")
    url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/{mult}/{unit}/{start}/{end}"
    params = {"apiKey": api_key, "adjusted": "true" if adjusted else "false", "limit": 50000}
    r = requests.get(url, params=params)
    r.raise_for_status()
    data = r.json()
    results = data.get("results", [])
    if not results:
        return pd.DataFrame(columns=["ts", "o", "h", "l", "c", "v"])
    df = pd.DataFrame(results)
    df.rename(columns={"t": "ts", "o": "o", "h": "h", "l": "l", "c": "c", "v": "v"}, inplace=True)
    df["ts"] = pd.to_datetime(df["ts"], unit="ms", utc=True)
    df.set_index("ts", inplace=True)
    df = df[["o", "h", "l", "c", "v"]].sort_index()
    return df


def binance_klines(symbol: str, interval: str, start_ms: int, end_ms: int) -> pd.DataFrame:
    url = "https://api.binance.com/api/v3/klines"
    params = {"symbol": symbol, "interval": interval, "startTime": start_ms, "endTime": end_ms, "limit": 1000}
    out = []
    while True:
        r = requests.get(url, params=params)
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        out.extend(rows)
        if len(rows) < 1000:
            break
        params["startTime"] = rows[-1][0] + 1
        time.sleep(0.2)
    if not out:
        return pd.DataFrame(columns=["ts", "o", "h", "l", "c", "v"])
    df = pd.DataFrame(out, columns=[
        "open_time", "o", "h", "l", "c", "v", "close_time", "q", "n", "taker_base", "taker_quote", "ignore"
    ])
    df["ts"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df[["o", "h", "l", "c", "v"]] = df[["o", "h", "l", "c", "v"]].astype(float)
    df.set_index("ts", inplace=True)
    df = df[["o", "h", "l", "c", "v"]].sort_index()
    return df


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    df = df.copy()
    df["rsi14"] = ta.rsi(df["c"], length=14)
    macd = ta.macd(df["c"], fast=12, slow=26, signal=9)
    df["macd"] = macd["MACD_12_26_9"]
    df["macd_signal"] = macd["MACDs_12_26_9"]
    df["macd_hist"] = macd["MACDh_12_26_9"]
    return df


default_args = {
    "owner": "ai_trading_agent",
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
}

with DAG(
    dag_id="ohlcv_indicators_pipeline_dag",
    default_args=default_args,
    start_date=days_ago(1),
    schedule_interval="0 * * * *",  # hourly
    catchup=False,
    max_active_runs=1,
    tags=["ohlcv", "indicators", "rsi", "macd"],
) as dag:

    @task
    def config_window() -> Dict[str, Any]:
        tf = env_or_var("OHLCV_TIMEFRAME", "1h")
        lookback_days = int(env_or_var("OHLCV_LOOKBACK_DAYS", "30"))
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=lookback_days)
        equities = json.loads(env_or_var("EQUITY_TICKERS", "[]"))
        cryptos = json.loads(env_or_var("CRYPTO_SYMBOLS", "[]"))
        return {
            "timeframe": tf, "start": start.isoformat(), "end": end.isoformat(),
            "equities": equities, "cryptos": cryptos
        }

    @task
    def fetch_and_compute(cfg: Dict[str, Any]) -> Dict[str, str]:
        tf = cfg["timeframe"]
        start = datetime.fromisoformat(cfg["start"])
        end = datetime.fromisoformat(cfg["end"])
        data_dir = env_or_var("DATA_DIR", "/opt/airflow/data/indicators")
        os.makedirs(data_dir, exist_ok=True)

        # Map timeframe
        if tf.endswith("h"):         # "1h", "4h", etc.
            mult = int(tf[:-1]); unit = "hour"; binance_tf = tf
        elif tf == "day":
            mult = 1; unit = "day";  binance_tf = "1d"
        else:
            raise ValueError("Unsupported timeframe; use '1h','4h','day'")

        outputs = {}

        # Equities via Polygon
        for t in cfg["equities"]:
            df = polygon_aggregates(t, mult, unit, start.date().isoformat(), end.date().isoformat())
            df_ind = compute_indicators(df)
            path = os.path.join(data_dir, f"equity_{t}_{tf}.parquet")
            df_ind.to_parquet(path, index=True)
            outputs[t] = path
            time.sleep(0.2)

        # Crypto via Binance
        start_ms = int(start.timestamp() * 1000); end_ms = int(end.timestamp() * 1000)
        for s in cfg["cryptos"]:
            df = binance_klines(s, binance_tf, start_ms, end_ms)
            df_ind = compute_indicators(df)
            path = os.path.join(data_dir, f"crypto_{s}_{tf}.parquet")
            df_ind.to_parquet(path, index=True)
            outputs[s] = path
            time.sleep(0.2)

        return outputs

    _cfg = config_window()
    _out = fetch_and_compute(_cfg)