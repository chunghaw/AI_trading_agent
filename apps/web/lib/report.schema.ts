import { z } from "zod";

// New schema that matches the API response format
export const ApiResponseSchema = z.object({
  ticker: z.string(),
  newsStatus: z.string(),
  technicalStatus: z.string(),
  overallStatus: z.enum(["bullish", "neutral", "bearish"]),
  answer: z.string().optional() // Direct answer to user's question
});

// Legacy schema for backward compatibility
export const ReportSchema = z.object({
  symbol: z.string(),
  timeframe: z.string().default("1d"),
  answer: z.string(),
  action: z.enum(["BUY","SELL","FLAT"]),
  confidence: z.number().min(0).max(1),
  bullets: z.array(z.string()).min(3).max(6),
  price: z.object({
    current: z.number(),
    previous: z.number(),
    change: z.number(),
    changePercent: z.number(),
    date: z.string()
  }),
  indicators: z.object({
    rsi14: z.number(),
    macd: z.number(),
    macd_signal: z.number(),
    macd_hist: z.number(),
    ema20: z.number(),
    ema50: z.number(),
    ema200: z.number(),
    atr14: z.number(),
  }),
  levels: z.object({
    support: z.array(z.string()).or(z.array(z.number())).default([]),
    resistance: z.array(z.string()).or(z.array(z.number())).default([]),
    breakout_trigger: z.string().or(z.number()).default("")
  }),
  news: z.object({
    summary: z.array(z.string()).min(1),
    citations: z.array(z.string()).default([])
  }),
  technical: z.object({
    summary: z.array(z.string()).min(1),
    chart_notes: z.array(z.string()).optional(),
    image_used: z.boolean().optional()
  }),
  portfolio: z.object({
    size_suggestion_pct: z.number().min(0).max(1).default(0.05),
    tp: z.array(z.string()).optional(),
    sl: z.string().optional()
  }).optional()
});

export type Report = z.infer<typeof ReportSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
