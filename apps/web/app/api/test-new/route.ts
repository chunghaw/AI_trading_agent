import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: "NEW API ENDPOINT TEST",
    version: "v2.3 - CACHE CLEAR",
    timestamp: new Date().toISOString(),
    success: true
  });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    message: "NEW API ENDPOINT POST TEST",
    version: "v2.3 - CACHE CLEAR", 
    timestamp: new Date().toISOString(),
    success: true,
    body: await req.json()
  });
}
