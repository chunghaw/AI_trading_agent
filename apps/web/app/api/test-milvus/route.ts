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
    
    // Test different Milvus API endpoints
    const uri = process.env.MILVUS_URI || process.env.MILVUS_ADDRESS || "localhost:19530";
    
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    // Add basic auth if credentials are provided
    if (process.env.MILVUS_USER && process.env.MILVUS_PASSWORD) {
      const auth = Buffer.from(`${process.env.MILVUS_USER}:${process.env.MILVUS_PASSWORD}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }
    
    // Try different possible endpoints
    const endpoints = [
      '/v1/collections',
      '/collections',
      '/v1/vector/collections',
      '/api/v1/collections',
      '/health',
      '/'
    ];
    
    let workingEndpoint = null;
    let collections = [];
    let data = null;
    
    for (const endpoint of endpoints) {
      const url = `${uri}${endpoint}`;
      console.log(`🔗 Testing endpoint: ${url}`);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
        });
        
        console.log(`📊 Response status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          workingEndpoint = endpoint;
          data = await response.json();
          console.log(`✅ Working endpoint found: ${endpoint}`);
          console.log(`📄 Response data:`, JSON.stringify(data, null, 2));
          
          // Try to extract collections from different response formats
          if (data?.data?.map) {
            collections = data.data.map((x: any) => x.name || x);
          } else if (data?.collections) {
            collections = data.collections;
          } else if (Array.isArray(data)) {
            collections = data;
          }
          break;
        } else {
          console.log(`❌ Endpoint ${endpoint} failed: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Endpoint ${endpoint} error:`, error.message);
      }
    }
    
    if (!workingEndpoint) {
      throw new Error(`No working Milvus API endpoint found. Tried: ${endpoints.join(', ')}`);
    }
    
    const targetCollection = process.env.MILVUS_COLLECTION_NEWS || 'polygon_news_data';
    const hasTargetCollection = collections.includes(targetCollection);
    
    return NextResponse.json({
      success: true,
      message: "Milvus REST API connection successful!",
      config,
      workingEndpoint,
      collections: collections,
      targetCollection,
      hasTargetCollection: hasTargetCollection,
      responseData: data
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