import { NextRequest, NextResponse } from "next/server";

const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

// Mock technical RAG response
const mockTechnicalResponse = {
  rationale: "Technical indicators show NVDA is in a strong uptrend with RSI at 68 (not overbought), MACD above signal line, and price above 50-day and 200-day moving averages. Support at $450, resistance at $500.",
  indicators: {
    rsi: 68.5,
    macd: 12.3,
    macd_signal: 8.7,
    sma_20: 465.2,
    sma_50: 445.8,
    sma_200: 398.4,
    bollinger_upper: 485.6,
    bollinger_lower: 444.8,
    volume_sma: 12500000
  },
  citations: [
    "https://www.tradingview.com/symbols/NASDAQ-NVDA/",
    "https://finviz.com/quote.ashx?t=NVDA",
    "https://www.marketwatch.com/investing/stock/nvda/technical-analysis"
  ]
};

export async function POST(request: NextRequest) {
  try {
    // If no worker URL, return mock data
    if (!WORKER_BASE_URL) {
      return NextResponse.json(mockTechnicalResponse);
    }

    // Forward to worker
    const response = await fetch(`${WORKER_BASE_URL}/rag/technical`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(await request.json()),
    });

    if (!response.ok) {
      // Return mock data if worker is not available
      return NextResponse.json(mockTechnicalResponse);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    // Return mock data on any error
    return NextResponse.json(mockTechnicalResponse);
  }
}
