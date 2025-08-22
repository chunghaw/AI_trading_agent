export interface Signal {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  strength: 'STRONG' | 'MEDIUM' | 'WEAK'
  price: number
  timestamp: string
  confidence: number
  strategy: string
}

export interface OrderProposal {
  id: string
  signalId: string
  symbol: string
  type: 'BUY' | 'SELL'
  quantity: number
  price: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED'
  timestamp: string
}

export interface Verdict {
  id: string
  orderId: string
  decision: 'APPROVE' | 'REJECT'
  reason: string
  timestamp: string
  riskScore: number
} 