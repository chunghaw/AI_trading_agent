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
    key_points: z.array(z.string()).min(3).max(7),
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
    overall_status: z.enum(["Green", "Amber", "Red"])
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

export const mapOverallStatus = (newsStatus: "Positive" | "Balanced" | "Adverse", techStatus: "Constructive" | "Neutral" | "Weak"): "Green" | "Amber" | "Red" => {
  // If both green → "Green"
  if (newsStatus === "Positive" && techStatus === "Constructive") return "Green";
  
  // If one red → "Red"
  if (newsStatus === "Adverse" || techStatus === "Weak") return "Red";
  
  // If one green and one amber → "Amber"
  if ((newsStatus === "Positive" && techStatus === "Neutral") || 
      (newsStatus === "Balanced" && techStatus === "Constructive")) return "Amber";
  
  // If both amber → "Amber"
  if (newsStatus === "Balanced" && techStatus === "Neutral") return "Amber";
  
  // Default to amber for other combinations
  return "Amber";
};
