import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function GET(
  req: NextRequest,
  { params }: { params: { ticker: string } }
) {
  let client: Client | null = null;

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "90");
    const ticker = params.ticker.toUpperCase();

    client = new Client({
      connectionString: process.env.POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // Fetch OHLCV + indicators from silver layer (more complete data)
    const result = await client.query(
      `SELECT 
        date,
        open,
        high,
        low,
        close,
        volume as volume,
        vwap,
        ma_5,
        ma_20,
        ma_50,
        ma_200,
        ema_20,
        ema_50,
        ema_200,
        rsi,
        macd_line,
        macd_signal,
        macd_histogram,
        atr,
        volatility_20,
        daily_return_pct
      FROM silver_ohlcv
      WHERE symbol = $1
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
        AND is_valid = true
      ORDER BY date ASC`,
      [ticker]
    );

    const chartData = result.rows.map((row) => ({
      date: row.date,
      open: row.open ? parseFloat(row.open) : null,
      high: row.high ? parseFloat(row.high) : null,
      low: row.low ? parseFloat(row.low) : null,
      close: row.close ? parseFloat(row.close) : null,
      volume: row.volume ? parseFloat(row.volume) : null,
      vwap: row.vwap ? parseFloat(row.vwap) : null,
      ma_5: row.ma_5 ? parseFloat(row.ma_5) : null,
      ma_20: row.ma_20 ? parseFloat(row.ma_20) : null,
      ma_50: row.ma_50 ? parseFloat(row.ma_50) : null,
      ma_200: row.ma_200 ? parseFloat(row.ma_200) : null,
      ema_20: row.ema_20 ? parseFloat(row.ema_20) : null,
      ema_50: row.ema_50 ? parseFloat(row.ema_50) : null,
      ema_200: row.ema_200 ? parseFloat(row.ema_200) : null,
      rsi: row.rsi ? parseFloat(row.rsi) : null,
      macd_line: row.macd_line ? parseFloat(row.macd_line) : null,
      macd_signal: row.macd_signal ? parseFloat(row.macd_signal) : null,
      macd_histogram: row.macd_histogram ? parseFloat(row.macd_histogram) : null,
      atr: row.atr ? parseFloat(row.atr) : null,
      volatility_20: row.volatility_20 ? parseFloat(row.volatility_20) : null,
      daily_return_pct: row.daily_return_pct ? parseFloat(row.daily_return_pct) : null,
    }));

    await client.end();

    return NextResponse.json({
      success: true,
      ticker,
      days,
      data: chartData,
    });
  } catch (error: any) {
    console.error(`Error fetching chart data for ${params.ticker}:`, error);
    if (client) await client.end();
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch chart data",
      },
      { status: 500 }
    );
  }
}
