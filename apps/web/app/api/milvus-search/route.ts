import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { symbol, query, sinceIso, k = 12 } = await request.json();
    
    console.log(`🔍 Milvus search request: ${symbol}, ${query}, ${sinceIso}`);
    
    // For now, return empty results to prevent the app from crashing
    // We'll implement a proper solution next
    return NextResponse.json({
      success: true,
      results: [],
      message: "Milvus search temporarily disabled - returning empty results"
    });
    
  } catch (error: any) {
    console.error("❌ Milvus search error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results: []
    });
  }
}
