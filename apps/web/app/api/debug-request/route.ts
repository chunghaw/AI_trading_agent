import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    console.log("=== DEBUG REQUEST START ===");
    
    // Debug request body
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));
    console.log("Request body type:", typeof body);
    console.log("Request body keys:", Object.keys(body || {}));
    
    // Debug headers
    console.log("Content-Type header:", req.headers.get('content-type'));
    console.log("All headers:", Object.fromEntries(req.headers.entries()));
    
    // Debug environment
    console.log("Environment check:");
    console.log("- NODE_ENV:", process.env.NODE_ENV);
    console.log("- POSTGRES_URL exists:", !!process.env.POSTGRES_URL);
    console.log("- OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
    console.log("- MILVUS_URI exists:", !!process.env.MILVUS_URI);
    
    return NextResponse.json({
      success: true,
      debug: {
        body: body,
        bodyType: typeof body,
        bodyKeys: Object.keys(body || {}),
        headers: Object.fromEntries(req.headers.entries()),
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          POSTGRES_URL_EXISTS: !!process.env.POSTGRES_URL,
          OPENAI_API_KEY_EXISTS: !!process.env.OPENAI_API_KEY,
          MILVUS_URI_EXISTS: !!process.env.MILVUS_URI
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error("Debug request error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
