import { z } from "zod";

const NumOrNull = z.number().nullable().optional();
const StrOrNum = z.union([z.string(), z.number()]);

export const ReportSchema = z.object({
  symbol: z.string(),
  timeframe: z.string().default("1d"),

  // Freeform top-line answer; no rigid analyst format required
  answer: z.string().min(1),

  // Action can map from sentence endings; allow HOLD explicitly
  action: z.enum(["BUY","SELL","HOLD","FLAT"]).default("FLAT"),

  confidence: z.number().min(0).max(1).default(0.5),

  // Allow flexible bullet counts
  bullets: z.array(z.string()).min(2).max(10).default([]),

  indicators: z.object({
    // Make KPIs nullable/optional so missing data doesn’t hard-fail
    rsi14: NumOrNull,
    macd: NumOrNull,
    macd_signal: NumOrNull,
    macd_hist: NumOrNull,
    ema20: NumOrNull,
    ema50: NumOrNull,
    ema200: NumOrNull,
    atr14: NumOrNull,
  }).default({}),

  levels: z.object({
    support: z.array(StrOrNum).default([]),
    resistance: z.array(StrOrNum).default([]),
    breakout_trigger: z.union([z.string(), z.number(), z.null()]).default(null)
  }).default({ support: [], resistance: [], breakout_trigger: null }),

  news: z.object({
    // Accept either "summary" or "bullets"
    summary: z.array(z.string()).default([]),
    bullets: z.array(z.string()).default([]),
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
  }).default({ summary: [], bullets: [], citations: [] }),

  technical: z.object({
    summary: z.array(z.string()).default([]),
    bullets: z.array(z.string()).default([]),
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
  }).default({ summary: [], bullets: [] }),

  portfolio: z.object({
    size_suggestion_pct: z.number().min(0).max(1).default(0.1),
    tp: z.array(StrOrNum).optional(),
    sl: z.union([z.string(), z.number()]).optional()
  }).default({ size_suggestion_pct: 0.1 })
});

export type Report = z.infer<typeof ReportSchema>;