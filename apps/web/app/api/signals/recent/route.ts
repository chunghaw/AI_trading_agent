import { NextRequest, NextResponse } from "next/server";
import { RecentSignalsSchema } from "@/lib/schemas";
import { mockData } from "@/lib/fetcher";

const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

export async function GET(request: NextRequest) {
  try {
    // If no worker URL, return mock data
    if (!WORKER_BASE_URL) {
      return NextResponse.json(mockData.recentSignals);
    }

    // Forward to worker
    const response = await fetch(`${WORKER_BASE_URL}/signals/recent`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // Return mock data if worker is not available
      return NextResponse.json(mockData.recentSignals);
    }

    const data = await response.json();
    
    // Validate response
    const validatedData = RecentSignalsSchema.parse(data);
    return NextResponse.json(validatedData);
  } catch (error: any) {
    // Return mock data on any error
    return NextResponse.json(mockData.recentSignals);
  }
}
