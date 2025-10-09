import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("🔍 Checking database schema...");
    
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: process.env.POSTGRES_URL,
    });
    
    await client.connect();
    
    // Check the actual schema of gold_ohlcv_daily_metrics table
    const schemaQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gold_ohlcv_daily_metrics' 
      AND column_name LIKE '%rsi%' OR column_name LIKE '%atr%'
      ORDER BY column_name;
    `;
    
    const schemaResult = await client.query(schemaQuery);
    
    // Also check if there's any data
    const dataQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gold_ohlcv_daily_metrics' 
      ORDER BY column_name;
    `;
    
    const allColumnsResult = await client.query(dataQuery);
    
    await client.end();
    
    return NextResponse.json({
      success: true,
      rsi_atr_columns: schemaResult.rows,
      all_columns: allColumnsResult.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("❌ Schema check error:", error);
    return NextResponse.json({
      error: "Schema check failed",
      message: error.message,
      details: error.details || "No additional details"
    }, { status: 500 });
  }
}
