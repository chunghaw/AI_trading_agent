import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("🧪 Testing Milvus REST API connection...");
    
    // Check environment variables
    const config = {
      uri: process.env.MILVUS_URI || 'not set',
      address: process.env.MILVUS_ADDRESS || 'not set', 
      user: process.env.MILVUS_USER || 'not set',
      username: process.env.MILVUS_USERNAME || 'not set',
      ssl: process.env.MILVUS_SSL || 'not set',
      collection: process.env.MILVUS_COLLECTION_NEWS || 'polygon_news_data'
    };
    
    console.log("🔧 Milvus Config:", config);
    
    if (!process.env.MILVUS_URI && !process.env.MILVUS_ADDRESS) {
      return NextResponse.json({
        success: false,
        error: "Milvus not configured",
        config
      });
    }
    
    // Test Milvus REST API connection
    const uri = process.env.MILVUS_URI || process.env.MILVUS_ADDRESS || "localhost:19530";
    const url = `${uri}/v1/collections`;
    
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    // Add basic auth if credentials are provided
    if (process.env.MILVUS_USER && process.env.MILVUS_PASSWORD) {
      const auth = Buffer.from(`${process.env.MILVUS_USER}:${process.env.MILVUS_PASSWORD}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }
    
    console.log("🔗 Testing REST API connection to:", url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Milvus REST API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("✅ Milvus REST API connection successful");
    
    const collections = data?.data?.map((x: any) => x.name) ?? [];
    const targetCollection = process.env.MILVUS_COLLECTION_NEWS || 'polygon_news_data';
    const hasTargetCollection = collections.includes(targetCollection);
    
    return NextResponse.json({
      success: true,
      message: "Milvus REST API connection successful!",
      config,
      collections: collections,
      targetCollection,
      hasTargetCollection: hasTargetCollection
    });
    
  } catch (error: any) {
    console.error("❌ Milvus REST API test failed:", error);
    return NextResponse.json({
      success: false,
      error: "Milvus REST API connection failed",
      details: error.message,
      config: {
        uri: process.env.MILVUS_URI || 'not set',
        address: process.env.MILVUS_ADDRESS || 'not set', 
        user: process.env.MILVUS_USER || 'not set',
        username: process.env.MILVUS_USERNAME || 'not set',
        ssl: process.env.MILVUS_SSL || 'not set',
        collection: process.env.MILVUS_COLLECTION_NEWS || 'polygon_news_data'
      }
    });
  }
}