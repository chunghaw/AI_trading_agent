import { NextRequest, NextResponse } from "next/server";
import { RunRequestSchema } from "@/lib/schemas";
import { mockData } from "@/lib/fetcher";

const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = RunRequestSchema.parse(body);
    
    // If no worker URL, return mock data
    if (!WORKER_BASE_URL) {
      // Simulate a mock run
      const mockRunId = `run_${Date.now()}`;
      const mockState = {
        run_id: mockRunId,
        symbol: validatedData.symbol,
        timeframe: validatedData.timeframe,
        status: "WAITING_APPROVAL" as const,
        opinions: {
          technical: {
            score: 0.75,
            action: "BUY" as const,
            rationale: "Strong technical indicators showing bullish momentum with RSI at 65 and MACD crossing above signal line.",
            citations: ["ta://rsi", "ta://macd"],
          },
          news: {
            score: 0.68,
            action: "BUY" as const,
            rationale: "Positive news sentiment with recent earnings beat and analyst upgrades.",
            citations: ["news://earnings", "news://analyst"],
          },
          risk: {
            score: 0.45,
            action: "FLAT" as const,
            rationale: "Risk assessment indicates moderate volatility. Position sizing should be conservative.",
            citations: ["risk://volatility"],
            red_flags: ["High market volatility", "Earnings announcement pending"],
          },
        },
        decision: {
          symbol: validatedData.symbol,
          action: "BUY" as const,
          size_pct: 0.25,
          entry: {
            type: "market" as const,
            price: null,
          },
          sl: 150.0,
          tp: [180.0, 200.0],
          confidence: 0.72,
          citations: ["ta://rsi", "news://earnings"],
        },
      };
      
      return NextResponse.json({ run_id: mockRunId, state: mockState });
    }

    // Forward to worker
    const response = await fetch(`${WORKER_BASE_URL}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("x-idempotency-key") && {
          "x-idempotency-key": request.headers.get("x-idempotency-key")!,
        }),
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          error: "Worker API error", 
          details: errorData 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
