AI Trading Agent – Execution Contract
Purpose

Produce analyst‑grade, actionable output without mock data, guesswork, or filler.
Strictly use database and curated news inputs; never fabricate values or price levels.
Non‑Negotiables

No mock/hardcoded data, ever. If DB is unavailable, return a clear error.
No support/resistance or Fibonacci levels. No “levels to watch”.
No generic boilerplate. No “docs/sources/+1/−0”, no bull/bear case boxes, no generic “analysis completed” lines.
News citations must be real URLs from inputs. No invented links.
Data Contracts

Required sources

Company info: table company_info_cache
Required fields: name, market, type, exchange, currency, employees, description
Gold (aggregated indicators): latest row per ticker
Required fields: rsi, macd_line, macd_signal, macd_hist, ema20, ema50, ema200, vwap, atr, volume, time
Silver (historical OHLCV): time series
Required fields: time, open, high, low, close, volume
News: curated article list
Fields: title, body, url, source, published_at, tickers[]
Minimal validation (route.ts must enforce)

If any required table is unavailable or empty for the ticker:
Return JSON with { error: "<specific_reason>", stage: "company|gold|silver|news" } and HTTP 503/424.
No fallback or zero/100 placeholders (e.g., RSI cannot be 0 or 100 unless truly so).
Timestamps should be ISO8601.
Pipeline (Route Responsibilities)

Fetch + Validate
Get company_info_cache row for ticker.
Get latest gold row and last N silver bars (e.g., 100–250).
Get news list (0..N).
If anything missing → return explicit error; do not fabricate.
News Analyst (LLM)
Input: { ticker, horizon, articles[] }
Deduplicate by url/title; keep credible/complete and most recent.
Output (strict):
sentiment: bullish | neutral | bearish
key_points: 3–7 bullets, non‑overlapping, concrete; include numeric facts/units/time where present.
analysis: 3–6 sentences; horizon‑aware; cite drivers and risks only if sourced.
sources: 1–5 unique URLs from articles actually used (no invented links).
no_data: boolean if nothing materially relevant.
Guardrails:
Use only provided articles; no macro or RSI/TA unless present in articles.
If rumor/unconfirmed appears, state it and temper tone.
Technical Analyst (LLM)
Input: { ticker, goldIndicators, silverOHLCV (compact array), peer_hint? }
Output (strict):
indicators (verbatim from gold): rsi, macd_line, macd_signal, macd_hist, ema20, ema50, ema200, vwap, atr, volume_trend (“rising|falling|flat”), vol_price_relation (“accumulation|distribution|neutral”)
analysis: 4–8 sentences interpreting the indicators in plain English (e.g., “RSI 56.8 is moderately strong…”, “MACD>signal with positive hist…”, “Price vs EMAs suggests trend bias…”). If you compare peers, make it qualitative (“relative to mega‑cap tech peers”)—do not invent peer numbers.
sentiment: bullish | neutral | bearish
Forbidden:
No support/resistance, no price targets, no “levels to watch”, no Fibonacci.
Synthesis (Final Answer)
Combine News + Technical into 3–6 sentence narrative with a clear stance.
Include 3 “traffic light” badges:
news_status: Positive (green) | Balanced (amber) | Adverse (red)
technical_status: Constructive (green) | Neutral (amber) | Weak (red)
overall_status: Aligns with the weighted combination (do not average blindly—if news no_data, rely on technical, and vice versa).
UI Output Shape (Response Model)

Route should return this single normalized object (front end consumes it directly):

{
"header": {
"name": "string",
"market": "string",
"type": "string",
"exchange": "string",
"currency": "string",
"employees": number,
"description": "string (≤200 chars)"
},
"news": {
"sentiment": "bullish" | "neutral" | "bearish",
"key_points": ["string", "..."],
"analysis": "string",
"sources": ["https://...", "..."],
"status": "Positive" | "Balanced" | "Adverse",
"no_data": boolean
},
"technical": {
"indicators": {
"rsi": number,
"macd_line": number,
"macd_signal": number,
"macd_hist": number,
"ema20": number,
"ema50": number,
"ema200": number,
"vwap": number,
"atr": number,
"volume_trend": "rising" | "falling" | "flat",
"vol_price_relation": "accumulation" | "distribution" | "neutral"
},
"analysis": "string",
"sentiment": "bullish" | "neutral" | "bearish",
"status": "Constructive" | "Neutral" | "Weak"
},
"final_answer": {
"summary": "3–6 sentence synthesis",
"overall_status": "Green" | "Amber" | "Red"
},
"meta": {
"ticker": "string",
"as_of": "ISO8601",
"horizon": "intraday|1–3 days|1 week"
}
}

Status Mapping

news.sentiment → status:
bullish → “Positive” (green)
neutral → “Balanced” (amber)
bearish → “Adverse” (red)
technical.sentiment → status:
bullish → “Constructive” (green)
neutral → “Neutral” (amber)
bearish → “Weak” (red)
final_answer.overall_status:
If both green → “Green”
If one green and one amber → “Amber”
If one red → “Red”
If both amber → “Amber”
If no_data on one side, use the other; if both no_data → return error instead of a forced status.
LLM Instruction Blocks (Drop‑In)

News Analyst Prompt (Trading Focus contract)
System: You are a markets analyst. Analyze ARTICLES strictly; do not use information outside them. Do not invent URLs or numbers.
Task:

Deduplicate by url/title. Keep most credible/recent.
Extract 3–7 key points (short, concrete, non‑overlapping).
Decide sentiment: bullish|neutral|bearish toward ${ticker} for ${horizon}.
Write a 3–6 sentence analysis (price/flow implications, catalysts/risks if mentioned).
Return 1–5 unique source URLs used (from ARTICLES only).
If nothing material: no_data=true and empty arrays.
Output:
{
"sentiment": "bullish|neutral|bearish",
"key_drivers": ["..."], // optional internal; route can map to key_points
"key_points": ["...", "..."],
"analysis": "string",
"sources": ["url", "..."],
"no_data": boolean
}
Rules:
No TA/indicators unless present in articles.
Call out rumor/unconfirmed explicitly and temper tone.
JSON only.
Technical Analyst Prompt
System: You are a markets technician. Use only provided indicators and OHLCV. Do not compute or invent support/resistance, Fibonacci, or price levels.
Input:

goldIndicators: { rsi, macd_line, macd_signal, macd_hist, ema20, ema50, ema200, vwap, atr, volume }
silverOHLCV: compact array of bars [{ time, o, h, l, c, v }, ...]
Task:
Interpret RSI, MACD (line/signal/hist), EMA stack (20/50/200), VWAP, ATR, volume trend, and the relation between volume and price.
Produce 4–8 sentence plain‑English analysis (e.g., “RSI 56.8 is moderately strong…”, “MACD > signal with rising histogram suggests momentum building”, “Close above EMA50 and EMA200 supports constructive bias”).
Return a technical sentiment: bullish|neutral|bearish.
Forbidden:
No support/resistance, no “levels to watch”, no Fib, no price targets.
Output:
{
"indicators": { rsi, macd_line, macd_signal, macd_hist, ema20, ema50, ema200, vwap, atr, volume_trend, vol_price_relation },
"analysis": "string",
"sentiment": "bullish|neutral|bearish"
}
Synthesis Prompt
System: You are a portfolio strategist composing a final view from two analyses.
Task:

Combine the News and Technical narratives into 3–6 sentences.
Resolve conflicts explicitly (e.g., “News is Positive but technicals are Neutral; bias slightly positive with lower confidence”).
Map sentiment to statuses via the table above; do not invent price levels.
Output fields to fill in final_answer.summary and overall_status.
Rendering (ReportCard.tsx)

Order

Header (Company Information)
Show name large; market/type/exchange/currency/employees nicely; description (≤200 chars).
News Analysis
Status pill (Positive/Balanced/Adverse with green/amber/red).
Bulleted key points (3–7).
Analysis paragraph.
Clickable sources list (hostnames visible, full URL in anchor).
Technical Analysis
Status pill (Constructive/Neutral/Weak with green/amber/red).
Indicators table (RSI, MACD line/signal/hist, EMA20/50/200, VWAP, ATR).
Analysis paragraph (no numerical S/R).
Final Answer
Overall status chip (Green/Amber/Red).
3–6 sentence synthesis.
Error States

company_info_cache missing → “Company information unavailable for TICKER. Please try later.” (block rendering).
gold row missing → “Indicators unavailable. Cannot compute technical analysis.” (skip section).
silver missing → “History unavailable. Technical analysis may be limited.” (show gold only analysis).
news empty → “No recent news found for TICKER.” (set news.no_data=true; omit sources).
DB unavailable → HTTP 503 and JSON { error: "db_unavailable", stage: "fetch" }.
Observability

Log (info): { ticker, gold_time, silver_last_time, source_count, used_sources, news_sentiment, tech_sentiment, statuses, duration_ms }.
Log (warn): missing fields by stage. No secrets, no PII.
Acceptance Criteria

Company header renders from company_info_cache.
News section shows non‑generic points + real citations; status pill colored correctly.
Technical section shows live indicator values from gold; narrative references them; no S/R anywhere.
Final Answer fuses both with a clear stance (Green/Amber/Red).
No mock data or fabricated links; errors are explicit, not silent.
Implementation Hints (route.ts)

Never send “analysis completed” or “support/resistance” strings.
Map LLM outputs into the response model exactly; validate with Zod before returning.
If indicators are stale (gold_time older than N minutes), include a small “as of” note via meta.as_of.