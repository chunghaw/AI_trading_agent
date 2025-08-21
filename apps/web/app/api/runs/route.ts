import { NextRequest, NextResponse } from "next/server";
// import { RunRequestSchema } from "@/lib/schemas";
// import { mockData } from "@/lib/fetcher";

// Temporary functions
const RunRequestSchema = { parse: (data: any) => data };
const mockData = { 
  runs: [
    {
      id: "1",
      status: "completed",
      symbol: "NVDA",
      timestamp: new Date().toISOString(),
      result: "BUY"
    }
  ]
};

const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try to forward to worker first
    if (WORKER_BASE_URL) {
      const response = await fetch(`${WORKER_BASE_URL}/api/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    }

    // Fallback to mock data
    return NextResponse.json(mockData);
  } catch (error) {
    console.error("Error processing run request:", error);
    return NextResponse.json(mockData);
  }
}
