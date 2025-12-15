import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { z } from "zod";

const AddTickerSchema = z.object({
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase().trim()),
  ticker_type: z.enum(["stock", "etf", "crypto"]).optional().default("stock"),
});

// Verify ticker exists on Polygon API
async function verifyTickerOnPolygon(symbol: string): Promise<{ valid: boolean; name?: string; type?: string }> {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
  if (!POLYGON_API_KEY) {
    return { valid: false };
  }

  try {
    // Helper function to create fetch with timeout
    const fetchWithTimeout = async (url: string, timeoutMs: number = 10000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    // Try to get ticker details from Polygon
    const url = `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${POLYGON_API_KEY}`;
    const response = await fetchWithTimeout(url, 10000);
    
    if (response.ok) {
      const data = await response.json();
      const ticker = data.results;
      
      if (ticker) {
        return {
          valid: true,
          name: ticker.name,
          type: ticker.type || "stock"
        };
      }
    }
    
    // If ticker details fail, try to get recent trades (alternative verification)
    const tradesUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${POLYGON_API_KEY}`;
    const tradesResponse = await fetchWithTimeout(tradesUrl, 10000);
    
    if (tradesResponse.ok) {
      const tradesData = await tradesResponse.json();
      if (tradesData.resultsCount > 0 || tradesData.results?.length > 0) {
        return { valid: true };
      }
    }
    
    return { valid: false };
  } catch (error) {
    console.error(`Error verifying ticker ${symbol} on Polygon:`, error);
    return { valid: false };
  }
}

export async function POST(req: NextRequest) {
  let client: Client | null = null;

  try {
    const body = await req.json();
    const { symbol, ticker_type } = AddTickerSchema.parse(body);

    // Verify ticker on Polygon
    console.log(`🔍 Verifying ticker ${symbol} on Polygon API...`);
    const verification = await verifyTickerOnPolygon(symbol);
    
    if (!verification.valid) {
      return NextResponse.json(
        { 
          error: `Ticker ${symbol} not found or invalid on Polygon API`,
          code: "TICKER_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    // Connect to database
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
      console.error("❌ POSTGRES_URL environment variable is not set");
      return NextResponse.json(
        { 
          error: "Database configuration error: POSTGRES_URL not set",
          code: "DATABASE_CONFIG_ERROR",
          hint: "Please set POSTGRES_URL in your .env.local file"
        },
        { status: 500 }
      );
    }

    client = new Client({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    // Create table if it doesn't exist (auto-migration)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS custom_tickers (
          id SERIAL PRIMARY KEY,
          symbol VARCHAR(10) NOT NULL UNIQUE,
          ticker_type VARCHAR(20) NOT NULL CHECK (ticker_type IN ('stock', 'etf', 'crypto')),
          added_by VARCHAR(100),
          added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE,
          polygon_verified BOOLEAN DEFAULT FALSE,
          last_ingested_at TIMESTAMP WITH TIME ZONE,
          notes TEXT
        )
      `);
      
      // Create indexes if they don't exist
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_custom_tickers_active 
        ON custom_tickers(is_active) WHERE is_active = TRUE
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_custom_tickers_type 
        ON custom_tickers(ticker_type)
      `);
      
      console.log('✅ custom_tickers table created/verified');
    } catch (createError: any) {
      // If table creation fails, log but continue (might already exist)
      console.warn('⚠️ Table creation check:', createError.message);
    }

    // Check if ticker already exists
    const existingCheck = await client.query(
      'SELECT symbol, is_active FROM custom_tickers WHERE symbol = $1',
      [symbol]
    );

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      if (existing.is_active) {
        // Get full ticker info
        const fullTicker = await client.query(
          'SELECT * FROM custom_tickers WHERE symbol = $1',
          [symbol]
        );
        return NextResponse.json(
          { 
            error: `Ticker ${symbol} already exists and is active`,
            code: "TICKER_EXISTS",
            ticker: fullTicker.rows[0] || existing,
            message: `This ticker was already added and will be processed in the next DAG run.`
          },
          { status: 409 }
        );
      } else {
        // Reactivate existing ticker
        await client.query(
          'UPDATE custom_tickers SET is_active = TRUE, polygon_verified = TRUE, added_at = CURRENT_TIMESTAMP WHERE symbol = $1',
          [symbol]
        );
        return NextResponse.json({
          success: true,
          message: `Ticker ${symbol} reactivated`,
          ticker: { symbol, ticker_type, is_active: true, polygon_verified: true }
        });
      }
    }

    // Insert new ticker
    const result = await client.query(
      `INSERT INTO custom_tickers (symbol, ticker_type, polygon_verified, added_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [symbol, ticker_type || verification.type || "stock", true, "user"]
    );

    const newTicker = result.rows[0];

    // Trigger immediate data pull (async, don't wait)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tickers/ingest?symbol=${symbol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => {
      console.error(`Failed to trigger ingestion for ${symbol}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: `Ticker ${symbol} added successfully`,
      ticker: newTicker,
      verification: {
        valid: true,
        name: verification.name
      }
    });

  } catch (error: any) {
    console.error("Error adding ticker:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: `Ticker already exists`, code: "TICKER_EXISTS" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to add ticker", message: error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}

export async function GET(req: NextRequest) {
  let client: Client | null = null;

  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active_only') !== 'false';

    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
      return NextResponse.json(
        { 
          error: "Database configuration error: POSTGRES_URL not set",
          code: "DATABASE_CONFIG_ERROR"
        },
        { status: 500 }
      );
    }

    client = new Client({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    let query = 'SELECT * FROM custom_tickers';
    const params: any[] = [];

    if (activeOnly) {
      query += ' WHERE is_active = TRUE';
    }

    query += ' ORDER BY added_at DESC';

    const result = await client.query(query, params);

    return NextResponse.json({
      success: true,
      tickers: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error("Error fetching custom tickers:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickers", message: error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}

