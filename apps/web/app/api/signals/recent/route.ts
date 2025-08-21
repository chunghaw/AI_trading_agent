import { NextRequest, NextResponse } from "next/server";
// import { RecentSignalsSchema } from "@/lib/schemas";
// import { mockData } from "@/lib/fetcher";

// Temporary functions
const RecentSignalsSchema = { parse: (data: any) => data };
const mockData = { 
  signals: [
    {
      id: "1",
      symbol: "NVDA",
      signal: "BUY",
      confidence: 0.8,
      timestamp: new Date().toISOString(),
      reason: "Strong technical indicators"
    },
    {
      id: "2",
      symbol: "AAPL",
      signal: "HOLD",
      confidence: 0.6,
      timestamp: new Date().toISOString(),
      reason: "Mixed signals"
    }
  ]
};

const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

export async function GET(req: NextRequest) {
  try {
    // Try to fetch from worker first
    if (WORKER_BASE_URL) {
      const response = await fetch(`${WORKER_BASE_URL}/api/signals/recent`);
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    }

    // Fallback to mock data
    const mockResponse = mockData;
    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error("Error fetching recent signals:", error);
    return NextResponse.json(mockData);
  }
}
