import { z } from "zod";

// ============================================================================
// Filter Presets
// ============================================================================

export const ScreenFiltersSchema = z.object({
  // Hard filters
  market: z.enum(["us", "all"]).default("us"),
  minMarketCap: z.number().min(0).default(1_000_000_000), // 1B
  minBeta1Y: z.number().min(0).default(1.0),
  minPrice: z.number().min(0).optional(),
  minDollarVolume1M: z.number().min(0).default(900_000_000), // 900M
  
  // Technical filters (optional)
  minRSI: z.number().min(0).max(100).optional(),
  maxRSI: z.number().min(0).max(100).optional(),
  macdSignal: z.enum(["bullish", "bearish", "neutral"]).optional(),
  volumeTrend: z.enum(["rising", "falling", "flat"]).optional(),
  
  // Exchange filter
  exchanges: z.array(z.string()).optional(),
});

export type ScreenFilters = z.infer<typeof ScreenFiltersSchema>;

export const ScreenPresetSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(255),
  filters_json: ScreenFiltersSchema,
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ScreenPreset = z.infer<typeof ScreenPresetSchema>;

// ============================================================================
// Run Request/Response
// ============================================================================

export const RunScreenRequestSchema = z.object({
  runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  presetId: z.number().optional(),
  filters: ScreenFiltersSchema.optional(), // Override preset filters if provided
  topK: z.number().min(1).max(500).default(200), // Top K candidates for news stage
});

export type RunScreenRequest = z.infer<typeof RunScreenRequestSchema>;

export const ScreenRunSchema = z.object({
  id: z.number(),
  run_date: z.string(),
  preset_id: z.number().nullable(),
  universe_size: z.number(),
  status: z.enum(["running", "completed", "failed"]),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  error: z.string().nullable(),
});

export type ScreenRun = z.infer<typeof ScreenRunSchema>;

// ============================================================================
// Technical Features
// ============================================================================

export const TechnicalFeaturesSchema = z.object({
  ticker: z.string(),
  asof_date: z.string(),
  price: z.number(),
  sma50: z.number().nullable(),
  sma200: z.number().nullable(),
  macd: z.number().nullable(),
  macd_signal: z.number().nullable(),
  macd_hist: z.number().nullable(),
  rsi: z.number().nullable(),
  rvol: z.number().nullable(), // Relative volume
  atrp: z.number().nullable(), // ATR percentage
  atr: z.number().nullable(),
  vwap: z.number().nullable(),
  volume: z.number().nullable(),
  dollar_volume: z.number().nullable(),
  beta_1y: z.number().nullable(),
  dollar_volume_1m: z.number().nullable(),
  // Flags
  breakout_flag: z.boolean(),
  trend_flag: z.boolean(),
  momentum_flag: z.boolean(),
  volume_flag: z.boolean(),
  // Historical data for calculations
  high_20d: z.number().nullable(),
  high_50d: z.number().nullable(),
  prev_close: z.number().nullable(),
  prev_macd_hist: z.number().nullable(),
});

export type TechnicalFeatures = z.infer<typeof TechnicalFeaturesSchema>;

// ============================================================================
// Technical Scoring
// ============================================================================

export const TechnicalScoreSchema = z.object({
  technicalScore: z.number().min(0).max(100),
  tags: z.array(z.string()),
  reasons: z.array(z.object({
    rule: z.string(),
    points: z.number(),
    description: z.string(),
  })),
});

export type TechnicalScore = z.infer<typeof TechnicalScoreSchema>;

// ============================================================================
// News Summarization
// ============================================================================

export const NewsSummarySchema = z.object({
  tone: z.enum(["positive", "neutral", "negative"]),
  newsScore: z.number().min(-20).max(20),
  catalysts: z.array(z.object({
    label: z.string(),
    evidence_urls: z.array(z.string()),
  })),
  risks: z.array(z.object({
    label: z.string(),
    evidence_urls: z.array(z.string()),
  })),
  earnings_or_events: z.array(z.object({
    label: z.string(),
    date: z.string().optional(),
    evidence_urls: z.array(z.string()),
  })),
  one_sentence_thesis: z.string(),
});

export type NewsSummary = z.infer<typeof NewsSummarySchema>;

export const NewsArticleSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  url: z.string(),
  text: z.string(),
  published_utc: z.string(),
  source: z.string().optional(),
  score: z.number().optional(),
});

export type NewsArticle = z.infer<typeof NewsArticleSchema>;

// ============================================================================
// Candidate
// ============================================================================

export const ScreenCandidateSchema = z.object({
  id: z.number(),
  run_id: z.number(),
  ticker: z.string(),
  final_score: z.number(),
  technical_score: z.number(),
  news_score: z.number(),
  tags_json: z.array(z.string()),
  created_at: z.string(),
  // Enriched data
  features: TechnicalFeaturesSchema.optional(),
  summary: NewsSummarySchema.optional(),
  news_count: z.number().optional(),
});

export type ScreenCandidate = z.infer<typeof ScreenCandidateSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const RunScreenResponseSchema = z.object({
  success: z.boolean(),
  run: ScreenRunSchema,
  message: z.string(),
});

export type RunScreenResponse = z.infer<typeof RunScreenResponseSchema>;

export const GetCandidatesRequestSchema = z.object({
  runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  runId: z.number().optional(),
  limit: z.number().min(1).max(500).default(50),
  offset: z.number().min(0).default(0),
  minScore: z.number().optional(),
});

export type GetCandidatesRequest = z.infer<typeof GetCandidatesRequestSchema>;

export const GetCandidatesResponseSchema = z.object({
  success: z.boolean(),
  candidates: z.array(ScreenCandidateSchema),
  total: z.number(),
  run: ScreenRunSchema.optional(),
});

export type GetCandidatesResponse = z.infer<typeof GetCandidatesResponseSchema>;
