import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("🔍 Testing database connection...");
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test basic connection
    console.log("🔍 Attempting database connection...");
    await pool.query('SELECT 1 as test');
    console.log("✅ Basic connection successful");
    
    // Test if tables exist
    console.log("🔍 Checking if gold_ohlcv_daily_metrics table exists...");
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gold_ohlcv_daily_metrics'
      );
    `);
    console.log("✅ Table check completed:", tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      await pool.end();
      return NextResponse.json({ 
        error: "Gold table does not exist",
        tablesExist: false
      }, { status: 404 });
    }
    
    // Test querying NVDA data
    console.log("🔍 Testing NVDA data query...");
    const nvdaResult = await pool.query(`
      SELECT 
        symbol, date, close, volume,
        rsi_14, ma_20, ma_50, ma_200,
        ema_20, ema_50, ema_200,
        macd_line, macd_signal, macd_histogram,
        vwap, atr_14
      FROM gold_ohlcv_daily_metrics 
      WHERE symbol = 'NVDA'
      ORDER BY date DESC
      LIMIT 1
    `);
    
    console.log("✅ NVDA query completed, found", nvdaResult.rows.length, "records");
    
    await pool.end();
    
    return NextResponse.json({
      success: true,
      connection: "OK",
      tableExists: true,
      nvdaRecords: nvdaResult.rows.length,
      nvdaData: nvdaResult.rows.length > 0 ? nvdaResult.rows[0] : null,
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'NOT SET',
        POSTGRES_URL_SET: !!process.env.POSTGRES_URL,
        POSTGRES_URL_LENGTH: process.env.POSTGRES_URL?.length || 0
      }
    });
    
  } catch (error: any) {
    console.error("❌ Database test failed:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      errorCode: error.code,
      syscall: error.syscall,
      hostname: error.hostname,
      port: error.port,
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'NOT SET',
        POSTGRES_URL_SET: !!process.env.POSTGRES_URL,
        POSTGRES_URL_LENGTH: process.env.POSTGRES_URL?.length || 0
      }
    }, { status: 500 });
  }
}
