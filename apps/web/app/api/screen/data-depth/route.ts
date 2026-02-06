import { NextResponse } from "next/server";
import { Client } from "pg";

/**
 * Returns max historical data depth for the screener.
 * Used to show: "MACD available (26+ days)", "MA200 available after 200 days".
 * Data depth grows daily as CI/CD runs (e.g. 138 → 200).
 */
export async function GET() {
  let client: Client | null = null;
  try {
    client = new Client({
      connectionString: process.env.POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // Max calendar days of data in gold (per symbol we take min/max over all symbols)
    const depthResult = await client.query(`
      SELECT
        COALESCE(EXTRACT(days FROM (MAX(date) - MIN(date)))::int + 1, 0) AS max_days,
        COUNT(*) FILTER (WHERE macd_line IS NOT NULL AND macd_signal IS NOT NULL) AS rows_with_macd,
        COUNT(*) FILTER (WHERE ma_200 IS NOT NULL AND ma_200 > 0) AS rows_with_ma200,
        COUNT(DISTINCT symbol) AS symbol_count
      FROM gold_ohlcv_daily_metrics
      WHERE date >= CURRENT_DATE - INTERVAL '400 days'
    `);

    const row = depthResult.rows[0];
    const maxDays = Math.min(Number(row?.max_days ?? 0), 400);
    const rowsWithMacd = Number(row?.rows_with_macd ?? 0);
    const rowsWithMa200 = Number(row?.rows_with_ma200 ?? 0);
    const symbolCount = Number(row?.symbol_count ?? 0);

    return NextResponse.json({
      maxDays,
      macdAvailable: maxDays >= 26 && rowsWithMacd > 0,
      ma200Available: maxDays >= 200 && rowsWithMa200 > 0,
      symbolCount,
      message:
        maxDays >= 200
          ? "Full history: MACD and MA200 filters available."
          : maxDays >= 26
            ? `~${maxDays} days: MACD filter available. MA200 after 200 days (run pipeline daily).`
            : `~${maxDays} days: Run historical load + pipeline for MACD/MA200.`,
    });
  } catch (e) {
    console.error("data-depth error:", e);
    return NextResponse.json(
      { maxDays: 0, macdAvailable: false, ma200Available: false, symbolCount: 0, error: String(e) },
      { status: 500 }
    );
  } finally {
    await client?.end();
  }
}
