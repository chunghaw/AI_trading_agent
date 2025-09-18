import { NextRequest, NextResponse } from "next/server";
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { symbol, query, sinceIso, k = 12 } = await request.json();
    
    console.log(`🔍 Milvus search request: ${symbol}, ${query}, ${sinceIso}`);
    
    // Use Python script to search Milvus
    const pythonScript = path.join(process.cwd(), 'milvus_search.py');
    
    return new Promise((resolve) => {
      const python = spawn('python3', [pythonScript, 'search', symbol, query, sinceIso, k.toString()]);
      
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
            const results = JSON.parse(output);
            resolve(NextResponse.json({
              success: true,
              results: results || [],
              message: `Found ${results?.length || 0} news articles`
            }));
          } catch (parseError) {
            console.error("❌ Failed to parse Python output:", parseError);
            console.error("Raw output:", output);
            resolve(NextResponse.json({
              success: false,
              error: "Failed to parse search results",
              results: []
            }));
          }
        } else {
          console.error("❌ Python script failed:", errorOutput);
          resolve(NextResponse.json({
            success: false,
            error: `Python script failed: ${errorOutput}`,
            results: []
          }));
        }
      });
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
