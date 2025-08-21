import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'NVDA';
  const since = searchParams.get('since') || '7';

  const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

  // Mock response
  const mockResponse = {
    rationale: "Recent earnings exceeded expectations with strong AI chip demand. Analysts are bullish on the company's positioning in the AI market. News sentiment is positive with multiple upgrades.",
    citations: [
      "https://finance.yahoo.com/news/nvidia-earnings-beat-expectations",
      "https://www.bloomberg.com/news/articles/nvidia-ai-demand",
      "https://www.reuters.com/technology/nvidia-analyst-upgrades"
    ]
  };

  if (!WORKER_BASE_URL) {
    return NextResponse.json(mockResponse);
  }

  try {
    const response = await fetch(`${WORKER_BASE_URL}/rag/news?symbol=${symbol}&since=${since}`, {
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
