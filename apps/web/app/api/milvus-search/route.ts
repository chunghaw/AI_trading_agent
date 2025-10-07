import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker') || 'NVDA';
  const limit = parseInt(searchParams.get('limit') || '5');

  try {
    // Use Python script to query Milvus
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const python = spawn('python3', [
        '/Users/chunghaw/Documents/AI Bootcamp 2025/airflow-dbt-project/milvus_simple_query.py',
        ticker,
        limit.toString()
      ]);

      let dataString = '';
      let errorString = '';

      python.stdout.on('data', (data: any) => {
        dataString += data.toString();
      });

      python.stderr.on('data', (data: any) => {
        errorString += data.toString();
      });

      python.on('close', (code: number) => {
        if (code === 0) {
          try {
            const results = JSON.parse(dataString);
            resolve(NextResponse.json({
              success: true,
              ticker,
              count: results.length,
              articles: results
            }));
          } catch (parseError) {
            resolve(NextResponse.json({
              success: false,
              error: 'Failed to parse results',
              raw: dataString
            }, { status: 500 }));
          }
        } else {
          resolve(NextResponse.json({
            success: false,
            error: errorString,
            code
          }, { status: 500 }));
        }
      });
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

