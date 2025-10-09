import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Get actual column names from gold_ohlcv_daily_metrics
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gold_ohlcv_daily_metrics' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    await pool.end();
    
    return NextResponse.json({
      success: true,
      table: 'gold_ohlcv_daily_metrics',
      columns: schemaResult.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}