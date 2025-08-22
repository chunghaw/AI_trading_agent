import { z } from "zod";

export const Opinion = z.object({
  rationale: z.string(),
  action: z.enum(["BUY","SELL","FLAT"]),
  confidence: z.number().min(0).max(1),
  citations: z.array(z.string())
});

export const Technical = Opinion.extend({
  indicators: z.record(z.number()).optional()
});

export const Portfolio = Opinion.extend({
  size_pct: z.number().min(0).max(1).optional(),
  positions: z.array(z.object({ symbol: z.string(), qty: z.number(), px: z.number() })).optional()
});

export const AgentAnswer = z.object({
  summary: z.object({
    bullets: z.array(z.string()),
    answer: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  news: Opinion,
  technical: Technical,
  portfolio: Portfolio
});

export type AgentAnswerT = z.infer<typeof AgentAnswer>;

// Single output schema for the new analyze endpoint
export const SingleAnalysisSchema = z.object({
  symbol: z.string(),
  answer: z.string(),
  bullets: z.array(z.string()),
  action: z.enum(["BUY", "SELL", "FLAT"]),
  confidence: z.number().min(0).max(1),
  citations: z.array(z.string()),
  indicators: z.object({
    rsi14: z.number().optional(),
    macd: z.number().optional(),
    macd_signal: z.number().optional(),
    macd_hist: z.number().optional(),
    ema20: z.number().optional(),
    ema50: z.number().optional(),
    ema200: z.number().optional(),
  }).optional(),
});

export type SingleAnalysisT = z.infer<typeof SingleAnalysisSchema>;

// Input schema for the analyze endpoint
export const AnalyzeInputSchema = z.object({
  prompt: z.string(),
  symbol: z.string().optional().default("NVDA"),
  timeframe: z.string().optional().default("1h"),
  since_days: z.number().optional().default(7),
  horizon: z.string().optional().default("1–5 days"),
  k: z.number().optional().default(12),
});

export type AnalyzeInputT = z.infer<typeof AnalyzeInputSchema>;
