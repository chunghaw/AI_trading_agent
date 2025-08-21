import { z } from 'zod'

// Signal schema
export const SignalSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  type: z.enum(['BUY', 'SELL']),
  strength: z.enum(['STRONG', 'MEDIUM', 'WEAK']),
  price: z.number().positive(),
  timestamp: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  strategy: z.string(),
})

// Order proposal schema
export const OrderProposalSchema = z.object({
  id: z.string(),
  signalId: z.string(),
  symbol: z.string(),
  type: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED']),
  timestamp: z.string().datetime(),
})

// Verdict schema
export const VerdictSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string(),
  timestamp: z.string().datetime(),
  riskScore: z.number().min(0).max(1),
})

// Market data schema
export const MarketDataSchema = z.object({
  symbol: z.string(),
  timestamp: z.string().datetime(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
})

// Backtest result schema
export const BacktestResultSchema = z.object({
  totalTrades: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(1),
  totalReturn: z.number(),
  buyHoldReturn: z.number(),
  sharpeRatio: z.number(),
  dataPoints: z.number().int().positive(),
  startDate: z.string(),
  endDate: z.string(),
})

// Export types
export type Signal = z.infer<typeof SignalSchema>
export type OrderProposal = z.infer<typeof OrderProposalSchema>
export type Verdict = z.infer<typeof VerdictSchema>
export type MarketData = z.infer<typeof MarketDataSchema>
export type BacktestResult = z.infer<typeof BacktestResultSchema> 