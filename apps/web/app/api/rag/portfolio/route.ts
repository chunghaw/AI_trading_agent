import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'NVDA';

  const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

  // Mock response
  const mockResponse = {
    rationale: "Current exposure is well-sized at 12.5% of portfolio. Position is profitable with room for additional allocation. Risk-reward ratio is favorable for adding on pullbacks.",
    positions: [
      { symbol: "NVDA", qty: 100, px: 475.50 }
    ],
    citations: [
      "https://portfolio.example.com/positions",
      "https://risk.example.com/exposure"
    ]
  };

  if (!WORKER_BASE_URL) {
    return NextResponse.json(mockResponse);
  }

  try {
    const response = await fetch(`${WORKER_BASE_URL}/rag/portfolio?symbol=${symbol}`, {
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
