import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'NVDA';
  const tf = searchParams.get('tf') || '1h';

  const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

  // Mock response
  const mockResponse = {
    rationale: "Price is above both 50-day and 200-day moving averages. RSI indicates strong momentum without being overbought. MACD shows bullish crossover with increasing volume.",
    indicators: {
      rsi: 68.5,
      macd: 12.3,
      sma_50: 465.2,
      sma_200: 420.1
    },
    citations: [
      "https://www.tradingview.com/symbols/NASDAQ-NVDA/",
      "https://finviz.com/quote.ashx?t=NVDA"
    ]
  };

  if (!WORKER_BASE_URL) {
    return NextResponse.json(mockResponse);
  }

  try {
    const response = await fetch(`${WORKER_BASE_URL}/rag/tech?symbol=${symbol}&tf=${tf}`, {
      timeout: 5000,
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Worker API error:", error);
  }

  return NextResponse.json(mockResponse);
}
