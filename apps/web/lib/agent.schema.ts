import { z } from "zod";

// New schema based on Agent.md specification
export const AgentReportSchema = z.object({
  header: z.object({
    name: z.string(),
    market: z.string(),
    type: z.string(),
    exchange: z.string(),
    currency: z.string(),
    employees: z.number().nullable(),
    description: z.string().max(200)
  }),
  news: z.object({
    sentiment: z.enum(["bullish", "neutral", "bearish"]),
    key_points: z.array(z.string()).default([]),
    analysis: z.string(),
    sources: z.array(z.string().url()),
    status: z.enum(["Positive", "Balanced", "Adverse"]),
    no_data: z.boolean()
  }),
  technical: z.object({
    indicators: z.object({
      rsi: z.number(),
      macd_line: z.number(),
      macd_signal: z.number(),
      macd_hist: z.number(),
      ema20: z.number(),
      ema50: z.number(),
      ema200: z.number(),
      vwap: z.number(),
      atr: z.number(),
      volume_trend: z.enum(["rising", "falling", "flat"]),
      vol_price_relation: z.enum(["accumulation", "distribution", "neutral"])
    }),
    analysis: z.string(),
    sentiment: z.enum(["bullish", "neutral", "bearish"]),
    status: z.enum(["Constructive", "Neutral", "Weak"])
  }),
  final_answer: z.object({
    summary: z.string(),
    key_insights: z.array(z.string()),
    overall_status: z.enum(["bullish", "neutral", "bearish"])
  }),
  meta: z.object({
    ticker: z.string(),
    as_of: z.string(),
    horizon: z.enum(["intraday", "1–3 days", "1 week"])
  })
});

export type AgentReport = z.infer<typeof AgentReportSchema>;

// Status mapping functions
export const mapNewsSentimentToStatus = (sentiment: "bullish" | "neutral" | "bearish"): "Positive" | "Balanced" | "Adverse" => {
  switch (sentiment) {
    case "bullish": return "Positive";
    case "neutral": return "Balanced";
    case "bearish": return "Adverse";
  }
};

export const mapTechnicalSentimentToStatus = (sentiment: "bullish" | "neutral" | "bearish"): "Constructive" | "Neutral" | "Weak" => {
  switch (sentiment) {
    case "bullish": return "Constructive";
    case "neutral": return "Neutral";
    case "bearish": return "Weak";
  }
};

export const mapOverallStatus = (newsStatus: "Positive" | "Balanced" | "Adverse", techStatus: "Constructive" | "Neutral" | "Weak"): "bullish" | "neutral" | "bearish" => {
  // If both positive → "bullish"
  if (newsStatus === "Positive" && techStatus === "Constructive") return "bullish";
  
  // If one adverse → "bearish"
  if (newsStatus === "Adverse" || techStatus === "Weak") return "bearish";
  
  // If one positive and one neutral → "bullish" (slight bias)
  if ((newsStatus === "Positive" && techStatus === "Neutral") || 
      (newsStatus === "Balanced" && techStatus === "Constructive")) return "bullish";
  
  // If both neutral → "neutral"
  if (newsStatus === "Balanced" && techStatus === "Neutral") return "neutral";
  
  // Default to neutral for other combinations
  return "neutral";
};
