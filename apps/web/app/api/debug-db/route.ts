import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("🔍 Debug database connection...");
    
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: process.env.POSTGRES_URL,
    });
    
    await client.connect();
    
    // Test the exact query that's failing
    const testQuery = `
      SELECT 
        g.date, g.open, g.high, g.low, g.close, g.total_volume as volume,
        g.rsi_14 as rsi, g.ma_5, g.ma_20, g.ma_50, g.ma_200,
        g.ema_20, g.ema_50, g.ema_200, g.macd_line, g.macd_signal, g.macd_histogram,
        g.vwap, g.atr_14,
        g.volume_trend, g.volume_price_relationship
      FROM gold_ohlcv_daily_metrics g
      WHERE g.symbol = $1
      ORDER BY g.date DESC
      LIMIT 1
    `;
    
    const result = await client.query(testQuery, ['AAPL']);
    
    await client.end();
    
    return NextResponse.json({
      success: true,
      message: "Database query successful",
      data: result.rows[0] || null,
      rowCount: result.rowCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("❌ Database debug error:", error);
    return NextResponse.json({
      error: "Database debug failed",
      message: error.message,
      code: error.code,
      details: error.details || "No additional details",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
