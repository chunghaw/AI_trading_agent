import { NextRequest, NextResponse } from "next/server";
// import { SentimentMetricsSchema } from "@/lib/schemas";
// import { mockData } from "@/lib/fetcher";

// Temporary functions
const SentimentMetricsSchema = { parse: (data: any) => data };
const mockData = { 
  sentiment: [
    {
      source: "News",
      sentiment: 0.6,
      confidence: 0.8,
      count: 150
    },
    {
      source: "Social Media",
      sentiment: 0.4,
      confidence: 0.7,
      count: 300
    }
  ]
};

const WORKER_BASE_URL = process.env.WORKER_BASE_URL;

export async function GET(req: NextRequest) {
  try {
    // Try to fetch from worker first
    if (WORKER_BASE_URL) {
      const response = await fetch(`${WORKER_BASE_URL}/api/metrics/sentiment`);
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    }

    // Fallback to mock data
    const mockResponse = mockData;
    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error("Error fetching sentiment metrics:", error);
    return NextResponse.json(mockData);
  }
}
