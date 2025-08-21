import { NextRequest, NextResponse } from "next/server";
import { MarketMetricsSchema } from "@/lib/schemas";
import { mockData } from "@/lib/fetcher";

const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

export async function GET(request: NextRequest) {
  try {
    // If no worker URL, return mock data
    if (!WORKER_BASE_URL) {
      return NextResponse.json(mockData.marketMetrics);
    }

    // Forward to worker
    const response = await fetch(`${WORKER_BASE_URL}/metrics/market`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // Return mock data if worker is not available
      return NextResponse.json(mockData.marketMetrics);
    }

    const data = await response.json();
    
    // Validate response
    const validatedData = MarketMetricsSchema.parse(data);
    return NextResponse.json(validatedData);
  } catch (error: any) {
    // Return mock data on any error
    return NextResponse.json(mockData.marketMetrics);
  }
}
