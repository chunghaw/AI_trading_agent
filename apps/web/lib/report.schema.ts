import { z } from "zod";

// Schema that matches Agent.md specification exactly
export const ReportSchema = z.object({
  header: z.object({
    name: z.string(),
    market: z.string(),
    type: z.string(),
    exchange: z.string(),
    currency: z.string(),
    employees: z.number().nullable(),
    description: z.string().max(200),
    price: z.object({
      current: z.number().nullable(),
      change: z.number().nullable(),
      change_percent: z.number().nullable(),
      as_of_date: z.string().nullable()
    }).nullable()
  }),
  news: z.object({
    sentiment: z.enum(["bullish", "neutral", "bearish"]),
    key_points: z.array(z.string()),
    analysis: z.string(),
    sources: z.array(z.string()),
    status: z.enum(["Positive", "Balanced", "Adverse"]),
    no_data: z.boolean()
  }),
  technical: z.object({
    indicators: z.object({
      rsi: z.number().nullable(),
      macd_line: z.number().nullable(),
      macd_signal: z.number().nullable(),
      macd_hist: z.number().nullable(),
      ema20: z.number().nullable(),
      ema50: z.number().nullable(),
      ema200: z.number().nullable(),
      vwap: z.number().nullable(),
      atr: z.number().nullable(),
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
    overall_status: z.enum(["bullish", "neutral", "bearish"]),
    answer: z.string()
  }),
  meta: z.object({
    ticker: z.string(),
    as_of: z.string(),
    horizon: z.enum(["intraday", "1–3 days", "1 week"]),
    user_question: z.string()
  })
});

export type Report = z.infer<typeof ReportSchema>;
