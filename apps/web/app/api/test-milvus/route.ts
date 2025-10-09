import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("🔍 Testing Milvus connection...");
    
    // Check environment variables
    const envVars = {
      MILVUS_URI: process.env.MILVUS_URI ? "SET" : "MISSING",
      MILVUS_USER: process.env.MILVUS_USER ? "SET" : "MISSING", 
      MILVUS_PASSWORD: process.env.MILVUS_PASSWORD ? "SET" : "MISSING",
      MILVUS_COLLECTION_NEWS: process.env.MILVUS_COLLECTION_NEWS ? "SET" : "MISSING"
    };
    
    console.log("🔍 Environment variables:", envVars);
    
    // Test Milvus connection
    const MILVUS_URI = process.env.MILVUS_URI;
    const MILVUS_USER = process.env.MILVUS_USER;
    const MILVUS_PASSWORD = process.env.MILVUS_PASSWORD;
    
    if (!MILVUS_URI || !MILVUS_USER || !MILVUS_PASSWORD) {
      return NextResponse.json({
        error: "Missing Milvus environment variables",
        envVars,
        details: "Required: MILVUS_URI, MILVUS_USER, MILVUS_PASSWORD"
      }, { status: 500 });
    }
    
    // Test API call
    const url = `${MILVUS_URI}/v2/vectordb/collections/list`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${MILVUS_USER}:${MILVUS_PASSWORD}`
    };
    
    console.log("🔍 Testing URL:", url);
    console.log("🔍 Headers:", { ...headers, Authorization: "Bearer [HIDDEN]" });
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    console.log("🔍 Response status:", response.status);
    console.log("🔍 Response headers:", Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Milvus API error:", errorText);
      return NextResponse.json({
        error: "Milvus API connection failed",
        status: response.status,
        statusText: response.statusText,
        details: errorText,
        url,
        headers: { ...headers, Authorization: "Bearer [HIDDEN]" }
      }, { status: 500 });
    }
    
    const data = await response.json();
    console.log("✅ Milvus connection successful:", data);
    
    return NextResponse.json({
      success: true,
      message: "Milvus connection working",
      collections: data.data || [],
      envVars
    });
    
  } catch (error: any) {
    console.error("❌ Milvus test error:", error);
    return NextResponse.json({
      error: "Milvus connection test failed",
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
