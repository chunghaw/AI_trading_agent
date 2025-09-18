import { NextRequest, NextResponse } from "next/server";
import { spawn } from 'child_process';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    console.log("🧪 Testing Milvus connection with Python client...");
    
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
    
    // Use Python script to test Milvus connection
    const pythonScript = path.join(process.cwd(), 'milvus_search.py');
    
    return new Promise((resolve) => {
      const python = spawn('python3', [pythonScript, 'test']);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(NextResponse.json({
              success: result.success,
              message: result.success ? "Milvus Python client connection successful!" : "Milvus connection failed",
              config,
              ...result
            }));
          } catch (parseError) {
            console.error("❌ Failed to parse Python output:", parseError);
            console.error("Raw output:", output);
            resolve(NextResponse.json({
              success: false,
              error: "Failed to parse test results",
              config,
              rawOutput: output
            }));
          }
        } else {
          console.error("❌ Python script failed:", errorOutput);
          resolve(NextResponse.json({
            success: false,
            error: `Python script failed: ${errorOutput}`,
            config
          }));
        }
      });
    });
    
  } catch (error: any) {
    console.error("❌ Milvus test failed:", error);
    return NextResponse.json({
      success: false,
      error: "Milvus test failed",
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