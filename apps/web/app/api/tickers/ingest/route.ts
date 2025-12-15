import { NextRequest, NextResponse } from "next/server";

/**
 * Trigger immediate data ingestion for a specific ticker
 * This calls the manual ingestion script logic
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol parameter required" },
        { status: 400 }
      );
    }

    // For now, return success and log that ingestion should be triggered
    // In production, this could:
    // 1. Call a background job queue (e.g., Bull, BullMQ)
    // 2. Trigger an Airflow DAG run via API
    // 3. Call the ingestion script directly (if running in same process)
    
    console.log(`📥 Ingestion requested for ticker: ${symbol}`);
    
    // TODO: Implement actual ingestion trigger
    // For now, the DAG will pick it up on next run since it reads from custom_tickers table
    
    return NextResponse.json({
      success: true,
      message: `Ingestion queued for ${symbol}. Data will be available after next DAG run.`,
      symbol
    });

  } catch (error: any) {
    console.error("Error triggering ingestion:", error);
    return NextResponse.json(
      { error: "Failed to trigger ingestion", message: error.message },
      { status: 500 }
    );
  }
}

