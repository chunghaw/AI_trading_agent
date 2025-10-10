import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'GOOGL';
    
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    await client.connect();
    
    // Check silver table for technical indicators
    const silverResult = await client.query(`
      SELECT 
        symbol, date, close,
        rsi, ma_5, ma_20, ma_50, ma_200,
        ema_20, ema_50, ema_200,
        macd_line, macd_signal, macd_histogram,
        atr, vwap, is_valid
      FROM silver_ohlcv 
      WHERE symbol = $1 
      ORDER BY date DESC 
      LIMIT 5
    `, [symbol]);
    
    // Check gold table
    const goldResult = await client.query(`
      SELECT 
        symbol, date, close,
        rsi_14, ma_5, ma_20, ma_50, ma_200,
        ema_20, ema_50, ema_200,
        macd_line, macd_signal, macd_histogram,
        atr_14, vwap
      FROM gold_ohlcv_daily_metrics 
      WHERE symbol = $1 
      ORDER BY date DESC 
      LIMIT 3
    `, [symbol]);
    
    await client.end();
    
    return NextResponse.json({
      symbol,
      silver_records: silverResult.rows.length,
      gold_records: goldResult.rows.length,
      silver_data: silverResult.rows,
      gold_data: goldResult.rows
    });
    
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
