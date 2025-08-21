import { NextRequest, NextResponse } from "next/server";
// import { MarketMetricsSchema } from "@/lib/schemas";
// import { mockData } from "@/lib/fetcher";

// Temporary functions
const MarketMetricsSchema = { parse: (data: any) => data };
const mockData = { 
  market: [
    {
      metric: "S&P 500",
      value: 4500,
      change: 0.5,
      changePercent: 0.01
    },
    {
      metric: "NASDAQ",
      value: 14000,
      change: -0.3,
      changePercent: -0.02
    }
  ]
};

const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

export async function GET(req: NextRequest) {
  try {
    // Try to fetch from worker first
    if (WORKER_BASE_URL) {
      const response = await fetch(`${WORKER_BASE_URL}/api/metrics/market`);
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    }

    // Fallback to mock data
    const mockResponse = mockData;
    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error("Error fetching market metrics:", error);
    return NextResponse.json(mockData);
  }
}
