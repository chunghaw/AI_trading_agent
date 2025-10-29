// Structured prompt builders used across the trading analysis pipeline.

type NewsPromptInput = {
  symbol: string;
  newsDocs: string[];
  userQuery: string;
  citations?: string[];
};

type TechnicalIndicators = {
  rsi14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  vwap: number | null;
  atr: number | null;
};

type TechnicalPromptInput = {
  symbol: string;
  userQuery: string;
  indicators: TechnicalIndicators;
  currentPrice: number | null;
  volumeTrend?: string | null;
  volumePriceRelation?: string | null;
};

type SynthesisPromptInput = {
  symbol: string;
  userQuery: string;
  newsSummary: string[];
  indicators: TechnicalIndicators;
  currentPrice: number | null;
  volumeTrend?: string | null;
  volumePriceRelation?: string | null;
};

type TechnicalFacts = ReturnType<typeof deriveTechnicalFacts>;

const fmt = (value: number | null | undefined, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return value.toFixed(digits);
};

const deriveTechnicalFacts = ({
  indicators,
  currentPrice,
  volumeTrend,
  volumePriceRelation
}: Pick<TechnicalPromptInput, "indicators" | "currentPrice" | "volumeTrend" | "volumePriceRelation">) => {
  const { macd, macd_signal, macd_hist, ema20, ema50, ema200, rsi14, vwap, atr } = indicators;

  const macdRelation =
    macd === null || macd_signal === null
      ? "unknown"
      : macd > macd_signal
      ? "macd_above_signal"
      : macd < macd_signal
      ? "macd_below_signal"
      : "macd_equal_signal";

  const macdHistState =
    macd_hist === null
      ? "unknown"
      : macd_hist > 0
      ? "positive"
      : macd_hist < 0
      ? "negative"
      : "flat";

  const priceVs = (benchmark: number | null) => {
    if (benchmark === null || currentPrice === null) return "unknown";
    if (currentPrice > benchmark) return "above";
    if (currentPrice < benchmark) return "below";
    return "equal";
  };

  const priceVsEma20 = priceVs(ema20);
  const priceVsEma50 = priceVs(ema50);
  const priceVsEma200 = priceVs(ema200);
  const priceVsVwap = priceVs(vwap);

  let emaStackStatus: "bullish_stack" | "bearish_stack" | "mixed" | "unknown" = "unknown";
  if (ema20 !== null && ema50 !== null && ema200 !== null) {
    if (ema20 > ema50 && ema50 > ema200) {
      emaStackStatus = "bullish_stack";
    } else if (ema20 < ema50 && ema50 < ema200) {
      emaStackStatus = "bearish_stack";
    } else {
      emaStackStatus = "mixed";
    }
  }

  let rsiState: "oversold" | "neutral" | "overbought" | "unknown" = "unknown";
  if (rsi14 !== null) {
    if (rsi14 <= 30) rsiState = "oversold";
    else if (rsi14 >= 70) rsiState = "overbought";
    else rsiState = "neutral";
  }

  return {
    indicators,
    currentPrice,
    volumeTrend: (volumeTrend || "unknown").toLowerCase(),
    volumePriceRelation: (volumePriceRelation || "unknown").toLowerCase(),
    macdRelation,
    macdHistState,
    priceVsEma20,
    priceVsEma50,
    priceVsEma200,
    priceVsVwap,
    emaStackStatus,
    rsiState,
    atr: atr === null ? null : atr
  };
};

export const getNewsAnalystPrompt = ({
  symbol,
  newsDocs,
  userQuery,
  citations = []
}: NewsPromptInput) => {
  const articlesSection = newsDocs.length
    ? newsDocs.map((doc, idx) => `${idx + 1}. ${doc}`).join("\n")
    : "None";
  const citationSection = citations.length
    ? citations.map((url) => `- ${url}`).join("\n")
    : "None";

  return `
System:
You are an equity news analyst. Base every conclusion strictly on the provided ARTICLES. Do not fabricate facts, numbers, or URLs.

Context:
- Symbol: ${symbol}
- User question: ${userQuery}
- Articles (most recent first):
${articlesSection}
- Candidate citations:
${citationSection}

Task:
1. Summarize the 2–5 most material headlines (short, factual bullet points).
2. Determine sentiment toward ${symbol}: bullish, neutral, or bearish. If articles conflict, pick the dominant tone and note the split.
3. Provide a 3–5 sentence narrative covering catalysts, risks, and market tone.
4. List the exact URLs you relied on. Use only URLs from the candidate list; if none apply, return an empty list.
5. If ARTICLES == "None", set no_data=true, sentiment="neutral", key_points=[] and explain the lack of coverage.

Return valid JSON only:
{
  "sentiment": "bullish|neutral|bearish",
  "key_points": ["string"],
  "analysis": "string",
  "sources": ["url"],
  "no_data": boolean
}
`.trim();
};

export const getTechnicalAnalystPrompt = (input: TechnicalPromptInput) => {
  const facts = deriveTechnicalFacts(input);
  const { indicators } = facts;

  const indicatorsSection = [
    `RSI(14): ${fmt(indicators.rsi14, 1)} (${facts.rsiState})`,
    `MACD line: ${fmt(indicators.macd, 3)}`,
    `MACD signal: ${fmt(indicators.macd_signal, 3)}`,
    `MACD histogram: ${fmt(indicators.macd_hist, 3)} (${facts.macdHistState})`,
    `EMA20: ${fmt(indicators.ema20)}`,
    `EMA50: ${fmt(indicators.ema50)}`,
    `EMA200: ${fmt(indicators.ema200)}`,
    `VWAP: ${fmt(indicators.vwap)}`,
    `ATR(14): ${fmt(indicators.atr)}`
  ].join("\n");

  const relationships = [
    `Price vs EMA20: ${facts.priceVsEma20}`,
    `Price vs EMA50: ${facts.priceVsEma50}`,
    `Price vs EMA200: ${facts.priceVsEma200}`,
    `EMA stack status: ${facts.emaStackStatus}`,
    `Price vs VWAP: ${facts.priceVsVwap}`,
    `MACD relation: ${facts.macdRelation}`,
    `Histogram state: ${facts.macdHistState}`,
    `Volume trend: ${facts.volumeTrend}`,
    `Volume/price relationship: ${facts.volumePriceRelation}`
  ].join("\n");

  return `
System:
You are a disciplined technical analyst. Only use the numeric facts provided. Never infer a relationship that contradicts the explicit data or derived tags.

Symbol: ${input.symbol}
User question: ${input.userQuery}
Latest close: ${fmt(input.currentPrice)}

Indicators:
${indicatorsSection}

Derived relationships:
${relationships}

Task:
1. Write 4–6 plain-English sentences synthesising the indicator readings and relationships above. Reference the explicit tags (e.g., "MACD below signal") instead of guessing.
2. State the technical sentiment as one of: bullish, neutral, bearish. Base this on the confluence of the relationships; if mixed, default to neutral.
3. If any value is "N/A" or "unknown", acknowledge the missing data rather than speculating.

Return valid JSON only:
{
  "indicators": {
    "rsi": ${indicators.rsi14 ?? "null"},
    "macd_line": ${indicators.macd ?? "null"},
    "macd_signal": ${indicators.macd_signal ?? "null"},
    "macd_hist": ${indicators.macd_hist ?? "null"},
    "ema20": ${indicators.ema20 ?? "null"},
    "ema50": ${indicators.ema50 ?? "null"},
    "ema200": ${indicators.ema200 ?? "null"},
    "vwap": ${indicators.vwap ?? "null"},
    "atr": ${indicators.atr ?? "null"},
    "volume_trend": "${facts.volumeTrend}",
    "vol_price_relation": "${facts.volumePriceRelation}"
  },
  "analysis": "string",
  "sentiment": "bullish|neutral|bearish"
}

Rules:
- Do not claim the inverse of the provided relationships (e.g., if MACD relation = macd_below_signal, you must describe it as below).
- No price targets, support/resistance levels, or invented indicators.
`.trim();
};

export const getSynthesisPrompt = (input: SynthesisPromptInput) => {
  const facts: TechnicalFacts = deriveTechnicalFacts({
    indicators: input.indicators,
    currentPrice: input.currentPrice,
    volumeTrend: input.volumeTrend,
    volumePriceRelation: input.volumePriceRelation
  });

  const newsSection = input.newsSummary.length
    ? input.newsSummary.map((item, idx) => `${idx + 1}. ${item}`).join("\n")
    : "No notable news supplied.";

  return `
System:
You are a portfolio strategist combining news insight with technical structure to advise on ${input.symbol}.

User question: ${input.userQuery}

News summary:
${newsSection}

Technical snapshot:
- RSI(14): ${fmt(facts.indicators.rsi14, 1)} (${facts.rsiState})
- MACD relation: ${facts.macdRelation} (histogram ${facts.macdHistState})
- Price vs EMA20/50/200: ${facts.priceVsEma20} / ${facts.priceVsEma50} / ${facts.priceVsEma200}
- EMA stack status: ${facts.emaStackStatus}
- Volume trend: ${facts.volumeTrend}; Volume/price relation: ${facts.volumePriceRelation}
- Price vs VWAP: ${facts.priceVsVwap}

Task:
1. Produce a 3–5 sentence summary reconciling the news tone with this technical snapshot. Call out conflicts (e.g., bullish news but bearish technicals) explicitly.
2. Provide 3–5 bullet insights that an investment committee would care about.
3. Decide the overall stance: bullish, neutral, or bearish. Be conservative if signals conflict.
4. Answer the user's question directly in 2–3 sentences referencing the evidence above.

Return valid JSON only:
{
  "summary": "string",
  "key_insights": ["string"],
  "overall_status": "bullish|neutral|bearish",
  "answer": "string"
}
`.trim();
};

export type { TechnicalIndicators, TechnicalPromptInput, TechnicalFacts };
