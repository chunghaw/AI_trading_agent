import { NextRequest, NextResponse } from "next/server";

// Import Milvus with error handling
let MilvusClient: any;
try {
  MilvusClient = require("@zilliz/milvus2-sdk-node").MilvusClient;
} catch (error) {
  console.error("❌ Failed to import MilvusClient:", error);
  MilvusClient = null;
}

export async function GET(request: NextRequest) {
  try {
    console.log("🧪 Testing Milvus connection...");
    
    // Check if MilvusClient is available
    if (!MilvusClient) {
      return NextResponse.json({
        success: false,
        error: "MilvusClient not available - import failed",
        details: "The Milvus SDK could not be imported"
      });
    }
    
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
    
    // Try to create client
    let client;
    try {
      client = new MilvusClient({
        address: process.env.MILVUS_URI || process.env.MILVUS_ADDRESS || "localhost:19530",
        ssl: (process.env.MILVUS_SSL||"false")==="true",
        username: process.env.MILVUS_USER || process.env.MILVUS_USERNAME || "",
        password: process.env.MILVUS_PASSWORD || "",
      });
      console.log("✅ Milvus client created successfully");
    } catch (clientError) {
      return NextResponse.json({
        success: false,
        error: "Failed to create Milvus client",
        details: clientError.message,
        config
      });
    }
    
    // Try to connect
    try {
      const collections = await client.showCollections();
      console.log("✅ Milvus connection successful");
      
      const collectionNames = collections?.collection_names || [];
      const targetCollection = process.env.MILVUS_COLLECTION_NEWS || 'polygon_news_data';
      
      return NextResponse.json({
        success: true,
        message: "Milvus connection successful",
        config,
        collections: collectionNames,
        targetCollection,
        hasTargetCollection: collectionNames.includes(targetCollection)
      });
      
    } catch (connectionError) {
      return NextResponse.json({
        success: false,
        error: "Milvus connection failed",
        details: connectionError.message,
        config
      });
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    return NextResponse.json({
      success: false,
      error: "Test failed",
      details: error.message
    });
  }
}
