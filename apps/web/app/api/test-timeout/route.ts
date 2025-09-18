import { NextRequest, NextResponse } from "next/server";
import { spawn } from 'child_process';
import path from 'path';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log("🧪 Testing timeout debug...");
    
    // Test Python script execution time
    const pythonScript = path.join(process.cwd(), 'test_timeout_debug.py');
    
    return new Promise((resolve) => {
      const python = spawn('python3', [pythonScript]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        const executionTime = Date.now() - startTime;
        
        if (code === 0) {
          resolve(NextResponse.json({
            success: true,
            executionTime: `${executionTime}ms`,
            output: output,
            message: "Timeout debug completed successfully"
          }));
        } else {
          resolve(NextResponse.json({
            success: false,
            executionTime: `${executionTime}ms`,
            error: errorOutput,
            output: output,
            message: "Timeout debug failed"
          }));
        }
      });
      
      // Set a timeout to kill the process if it takes too long
      setTimeout(() => {
        python.kill();
        resolve(NextResponse.json({
          success: false,
          executionTime: `${Date.now() - startTime}ms`,
          error: "Process killed due to timeout",
          message: "Process exceeded time limit"
        }));
      }, 60000); // 60 second timeout
    });
    
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error("❌ Timeout test failed:", error);
    return NextResponse.json({
      success: false,
      executionTime: `${executionTime}ms`,
      error: error.message,
      message: "Timeout test failed"
    });
  }
}
