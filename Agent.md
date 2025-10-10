AI Trading Agent – Execution Contract
Purpose

Produce analyst‑grade, actionable output without mock data, guesswork, or filler.
Strictly use database and curated news inputs; never fabricate values or price levels.
Non‑Negotiables

No mock/hardcoded data, ever. If DB is unavailable, return a clear error.
No support/resistance or Fibonacci levels. No “levels to watch”.
No generic boilerplate. No “docs/sources/+1/−0”, no bull/bear case boxes, no generic “analysis completed” lines.
News citations must be real URLs from inputs. No invented links.
## Data Pipeline Architecture

### Bronze Layer
- Raw Polygon API data ingestion
- Minimal processing, direct API response storage
- Used for backup and reprocessing

### Silver Layer
- Cleaned, validated OHLCV time series data
- Standardized formats and data types
- Historical data storage (3-year retention)
- Required fields: date, open, high, low, close, volume, symbol

### Gold Layer
- Aggregated indicators and company information
- Latest row per ticker with pre-calculated technical indicators
- Company metadata from company_info_cache
- Required fields: rsi, macd_line, macd_signal, macd_hist, ema20, ema50, ema200, vwap, atr, volume_trend, volume_price_relationship
- Price data: current price, previous close, daily change, change percentage, date

### News Layer
- Milvus vector database for semantic search
- Curated article list with embeddings
- Fields: title, body, url, source, published_at, tickers[], embedding_vector

## DAG Requirements

### OHLCV DAG (polygon_ohlcv_dag.py)
- **Schedule**: Twice daily at 5am SGT (21:00 UTC) and 5pm SGT (09:00 UTC)
- **Scope**: Top 1000 US stocks by market cap
- **Data Retrieval**: Latest 10 days OHLCV data from Polygon API (merge strategy)
- **Retention**: 3 years (1095 days) of historical data
- **Processing**: Bronze → Silver → Gold transformation
- **Error Handling**: Retry logic with exponential backoff, alerting on failures

### News DAG (polygon_news_milvus_managed.py)
- **Schedule**: Daily at 5am SGT (21:00 UTC)
- **Scope**: 20 popular tickers: NVDA, GOOGL, MSFT, AMZN, TSLA, META, PLTR, PDD, IONQ, AAPL, NFLX, AMD, INTC, ORCL, CRM, ADBE, PYPL, INTC, QCOM, MU
- **Data Retrieval**: Latest news articles from Polygon API
- **Retention**: 30 days of news data
- **Processing**: News ingestion → OpenAI embeddings → Milvus storage
- **Error Handling**: Connection retry logic, Milvus cleanup on failures

## Data Quality Requirements

### Technical Indicators Validation
- **RSI**: Must be 0-100 range
- **MACD Line**: Realistic range -50 to +50 (typical for most stocks)
- **MACD Signal**: Realistic range -50 to +50, should be close to MACD line
- **MACD Histogram**: Realistic range -5 to +5 (difference between line and signal)
- **EMAs (20/50/200)**: Must be positive values, typically within 50% of current price
- **VWAP**: Must be positive, typically within 10% of current price
- **ATR**: Must be positive, typically 1-10% of stock price
- **Volume**: Must be non-negative integers, typically > 0 for trading days
- **Volume Trend**: Must be "rising", "falling", or "flat"
- **Volume-Price Relationship**: Must be "accumulation", "distribution", or "neutral"

### Company Information Validation
- **Name**: Non-empty string, company legal name
- **Market**: Must be "stocks" for equity securities
- **Type**: Must be "CS" (Common Stock) for most equities
- **Exchange**: Valid exchange codes (XNAS, XNYS, etc.)
- **Currency**: Valid currency codes (USD, EUR, etc.)
- **Employees**: Non-negative integer
- **Description**: Non-empty text, company business description

### Data Contracts

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

## Data Validation & Error Handling

### API Route Validation
- **Missing Company Info**: Return HTTP 424 with error "Company information unavailable for {ticker}"
- **Missing Gold Data**: Return HTTP 424 with error "Technical indicators unavailable for {ticker}"
- **Missing Silver Data**: Return HTTP 424 with error "Historical data unavailable for {ticker}"
- **Missing News Data**: Continue with technical analysis only, set news.no_data = true
- **Database Connection Failure**: Return HTTP 503 with error "Database connection failed"

### Data Quality Checks
- **Indicator Validation**: All technical indicators must pass realistic range validation
- **Company Info Validation**: All required company fields must be non-empty
- **News Validation**: All news articles must have valid URLs and non-empty content
- **Timestamp Validation**: All timestamps must be valid ISO8601 format

### Error Recovery
- **Retry Logic**: Exponential backoff for transient failures (3 retries max)
- **Graceful Degradation**: Continue analysis with available data when possible
- **Logging**: Comprehensive error logging with context for debugging
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
"key_insights": ["string", "..."],
"overall_status": "bullish" | "neutral" | "bearish",
"answer": "string (2-3 sentence direct answer to user's question)"
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

1. Combine the News and Technical narratives into 3–6 sentences.
2. Resolve conflicts explicitly (e.g., "News is Positive but technicals are Neutral; bias slightly positive with lower confidence").
3. Extract 3-5 key insights in bullet point format for quick reference.
4. Map sentiment to statuses via the table above; do not invent price levels.
5. **Answer the user's question directly** based on all provided data (news + technical analysis) in 2-3 sentences.

Output:
{
  "summary": "string (3-6 sentences)",
  "key_insights": ["string", "string", "string"],
  "overall_status": "bullish|neutral|bearish",
  "answer": "string (direct answer to user's question in 2-3 sentences)"
}

Output fields to fill in final_answer.summary, overall_status, and answer.
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
If indicators are stale (gold_time older than N minutes), include a small "as of" note via meta.as_of.

## UI Components

### Main Interface (Agents Page)
- **Design**: Cursor-style dark theme interface with modern aesthetics
- **Layout**: Centered container with max-width 1200px
- **Background**: Dark theme with proper contrast ratios
- **Responsive**: Mobile-friendly design with proper spacing

### Chat Input Component
- **Style**: Cursor-style chat interface with rounded corners
- **Background**: Dark gray (#3a3a3a) with subtle borders
- **Textarea**: Large input area (h-20) with transparent background
- **Placeholder**: "Ask Trading AI to analyze markets, optimize strategies, explore opportunities... (Press Enter to submit)"
- **Send Button**: Circular button with Send icon, accent color background
- **Keyboard Shortcuts**: 
  - Enter: Submit query
  - Shift+Enter: New line
- **Footer**: Instructions and Combined Analysis pill

### Progress Messages
- **Loading State**: Animated spinner with step-by-step progress
- **Messages**: 
  - "🤖 Detecting stock symbol from your question..."
  - "📊 Loading OHLCV data from database..."
  - "📰 Searching for relevant news articles..."
  - "🔍 Analyzing technical indicators..."
  - "🧠 Processing news sentiment analysis..."
  - "📈 Computing technical analysis..."
  - "🎯 Generating final investment recommendation..."
  - "✅ Analysis complete! Processing results..."

### Example Prompts
- **Location**: Below chat input, centered
- **Style**: Pill-shaped buttons with hover effects
- **Examples**:
  - "What's the technical outlook for NVDA?"
  - "Should I buy GOOGL based on recent news?"
  - "Analyze AAPL's portfolio positioning"
  - "What's the market sentiment for TSLA?"
  - "Should I sell my MSFT position?"
  - "What's the risk profile for AMZN?"

### Analysis Results Display
- **Component**: ReportCard with full Agent.md specification
- **Debug Mode**: Collapsible raw JSON response for troubleshooting
- **Sections**:
  - Company header with description
  - News analysis with key points and sources
  - Technical indicators table (RSI, MACD, EMAs, etc.)
  - Technical analysis paragraph
  - Final answer with key insights and overall status

### Error Handling
- **Alert System**: Browser alerts for specific error types
- **Error Types**:
  - SYMBOL_NOT_SUPPORTED: "Symbol not supported. Only NVDA is currently supported with real data."
  - DATA_NOT_AVAILABLE: "Real-time data for this symbol is not available yet. We're working on adding more symbols soon!"
  - Schema validation errors with console logging
- **Console Logging**: Comprehensive error details for debugging

### Price Indicator Component
- **Location**: Header section beside ticker symbol (TradingView style)
- **Display**: Current price, daily change, change percentage, date
- **Styling**: Green for gains (+), red for losses (-), gray for unchanged
- **Data Source**: Real-time price data from gold table via API
- **Format**: $XXX.XX (+/-X.XX (+/-X.XX%))
- **Icons**: TrendingUp for gains, TrendingDown for losses
- **Implementation**: Integrated directly in ReportCard header component

### Sentiment Indicators
- **Location**: Analysis section headers (News Analysis, Technical Analysis, Overall Analysis)
- **Display**: Colored badges showing sentiment (BULLISH/NEUTRAL/BEARISH)
- **Color Scheme**:
  - 🟢 **BULLISH**: Green background with emerald text and border
  - 🟡 **NEUTRAL**: Yellow background with yellow text and border  
  - 🔴 **BEARISH**: Red background with red text and border
- **Data Source**: Sentiment values from API analysis results
- **Implementation**: Dynamic badges in ReportCard analysis sections

### User Question Display
- **Location**: Bottom section of Overall Analysis
- **Format**: User's question displayed with quotes for clarity
- **Example**: "What is the technical analysis for NVDA?"
- **Styling**: Consistent with overall dark theme

### Color Scheme & Styling
- **Primary Background**: Dark theme (#3a3a3a, #2a2a2a)
- **Text Colors**: var(--text), var(--muted) for proper contrast
- **Accent Color**: var(--accent) for buttons and highlights
- **Borders**: White/10 opacity for subtle borders
- **Hover Effects**: White/10 background on interactive elements
- **Shadows**: Proper shadow hierarchy for depth