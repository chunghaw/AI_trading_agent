import { z } from "zod";

export const ReportSchema = z.object({
  symbol: z.string(),
  timeframe: z.string().default("1d"),
  answer: z.string(),
  action: z.enum(["BUY","SELL","FLAT"]),
  confidence: z.number().min(0).max(1),
  bullets: z.array(z.string()).min(3).max(6),
  indicators: z.object({
    rsi14: z.number(),
    macd: z.number(),
    macd_signal: z.number(),
    macd_hist: z.number(),
    ema20: z.number(),
    ema50: z.number(),
    ema200: z.number(),
    atr14: z.number(),
    fibonacci_support: z.array(z.number()).default([]),
    fibonacci_resistance: z.array(z.number()).default([]),
    vwap: z.number().default(0),
    atr: z.number().default(0),
    volume_trend: z.string().default("insufficient_data"),
    volume_price_relationship: z.string().default("insufficient_data")
  }),
  levels: z.object({
    support: z.array(z.string()).or(z.array(z.number())).default([]),
    resistance: z.array(z.string()).or(z.array(z.number())).default([]),
    breakout_trigger: z.string().or(z.number()).default("")
  }),
  news: z.object({
    summary: z.array(z.string()).default(["No material news available in window."]),
    citations: z.array(z.string()).default([]),
    metrics: z.object({
      docs: z.number().default(0),
      sources: z.number().default(0),
      pos: z.number().default(0),
      neg: z.number().default(0),
      neu: z.number().default(0),
      net_sentiment: z.number().default(0)
    }).optional(),
    catalysts: z.array(z.string()).default([]),
    risks: z.array(z.string()).default([]),
    confidence_reasons: z.array(z.string()).default([])
  }),
  technical: z.object({
    summary: z.array(z.string()).default([]),
    chart_notes: z.string().default("Analysis based on current indicators"),
    scenarios: z.object({
      bull_case: z.string().optional(),
      bear_case: z.string().optional()
    }).optional(),
    risk_box: z.object({
      atr_pct: z.string().optional(),
      suggested_stop: z.string().optional(),
      position_hint: z.string().optional()
    }).optional()
  })
});

export type Report = z.infer<typeof ReportSchema>;
