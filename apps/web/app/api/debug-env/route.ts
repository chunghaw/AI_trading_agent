import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Only show non-sensitive environment variables for debugging
  const envDebug = {
    MILVUS_URI: process.env.MILVUS_URI ? 'SET' : 'NOT SET',
    MILVUS_USER: process.env.MILVUS_USER ? 'SET' : 'NOT SET',
    MILVUS_PASSWORD: process.env.MILVUS_PASSWORD ? 'SET' : 'NOT SET',
    MILVUS_SSL: process.env.MILVUS_SSL || 'NOT SET',
    MILVUS_COLLECTION_NEWS: process.env.MILVUS_COLLECTION_NEWS || 'NOT SET',
    MILVUS_ADDRESS: process.env.MILVUS_ADDRESS ? 'SET' : 'NOT SET',
    MILVUS_USERNAME: process.env.MILVUS_USERNAME ? 'SET' : 'NOT SET',
  };
  
  return NextResponse.json({
    message: "Environment variables status",
    env: envDebug,
    timestamp: new Date().toISOString()
  });
}
