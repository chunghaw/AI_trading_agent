import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { GetCandidatesRequestSchema, GetCandidatesResponseSchema, GetCandidatesResponse } from "@/lib/screen.schemas";
import { ensureTablesExist } from "@/lib/screen/db";

export async function GET(req: NextRequest) {
  let client: Client | null = null;

  try {
    const { searchParams } = new URL(req.url);
    
    const request = GetCandidatesRequestSchema.parse({
      runDate: searchParams.get("runDate") || undefined,
      runId: searchParams.get("runId") ? parseInt(searchParams.get("runId")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
      minScore: searchParams.get("minScore") ? parseFloat(searchParams.get("minScore")!) : undefined,
    });

    client = new Client({
      connectionString: process.env.POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // Ensure tables exist
    await ensureTablesExist(client);

    // Determine run_id
    let runId: number | null = null;

    if (request.runId) {
      runId = request.runId;
    } else if (request.runDate) {
      const runResult = await client.query(
        "SELECT id FROM screen_runs WHERE run_date = $1 AND status = 'completed' ORDER BY finished_at DESC LIMIT 1",
        [request.runDate]
      );
      if (runResult.rows.length > 0) {
        runId = runResult.rows[0].id;
      } else {
        return NextResponse.json({
          success: false,
          error: `No completed run found for date ${request.runDate}`,
        }, { status: 404 });
      }
    } else {
      // Get latest run
      const runResult = await client.query(
        "SELECT id FROM screen_runs WHERE status = 'completed' ORDER BY finished_at DESC LIMIT 1"
      );
      if (runResult.rows.length > 0) {
        runId = runResult.rows[0].id;
      } else {
        return NextResponse.json({
          success: false,
          error: "No completed runs found",
        }, { status: 404 });
      }
    }

    // Build query
    let whereConditions = ["c.run_id = $1"];
    const params: any[] = [runId];
    let paramIndex = 2;

    if (request.minScore !== undefined) {
      whereConditions.push(`c.final_score >= $${paramIndex}`);
      params.push(request.minScore);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Get candidates with enriched data
    const candidatesQuery = `
      SELECT 
        c.id,
        c.run_id,
        c.ticker,
        c.final_score,
        c.technical_score,
        c.news_score,
        c.tags_json,
        c.created_at,
        -- Features
        f.sma50,
        f.sma200,
        f.macd,
        f.macd_signal,
        f.macd_hist,
        f.rvol,
        f.atrp,
        f.beta_1y,
        f.dollar_volume_1m,
        -- News count
        (SELECT COUNT(*) FROM candidate_news WHERE run_id = c.run_id AND ticker = c.ticker) as news_count,
        -- Summary exists
        CASE WHEN s.summary_json IS NOT NULL THEN true ELSE false END as has_summary
      FROM screen_candidates c
      LEFT JOIN candidate_features f ON c.run_id = f.run_id AND c.ticker = f.ticker
      LEFT JOIN candidate_summary s ON c.run_id = s.run_id AND c.ticker = s.ticker
      ${whereClause}
      ORDER BY c.final_score DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(request.limit, request.offset);

    const candidatesResult = await client.query(candidatesQuery, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM screen_candidates c
      ${whereClause}
    `;

    const countResult = await client.query(countQuery, params.slice(0, -2)); // Remove limit and offset
    const total = parseInt(countResult.rows[0].total);

    // Get run info
    const runResult = await client.query("SELECT * FROM screen_runs WHERE id = $1", [runId]);
    const run = runResult.rows[0];

    // Transform candidates
    const candidates = candidatesResult.rows.map((row) => ({
      id: row.id,
      run_id: row.run_id,
      ticker: row.ticker,
      final_score: parseFloat(row.final_score),
      technical_score: parseFloat(row.technical_score),
      news_score: parseFloat(row.news_score || 0),
      tags_json: Array.isArray(row.tags_json) ? row.tags_json : (row.tags_json ? JSON.parse(row.tags_json) : []),
      created_at: row.created_at.toISOString(),
      features: {
        ticker: row.ticker,
        asof_date: run.run_date,
        price: null, // Can be enriched from gold table if needed
        sma50: row.sma50 ? parseFloat(row.sma50) : null,
        sma200: row.sma200 ? parseFloat(row.sma200) : null,
        macd: row.macd ? parseFloat(row.macd) : null,
        macd_signal: row.macd_signal ? parseFloat(row.macd_signal) : null,
        macd_hist: row.macd_hist ? parseFloat(row.macd_hist) : null,
        rsi: null, // Can be enriched
        rvol: row.rvol ? parseFloat(row.rvol) : null,
        atrp: row.atrp ? parseFloat(row.atrp) : null,
        atr: null,
        vwap: null,
        volume: null,
        dollar_volume: null,
        beta_1y: row.beta_1y ? parseFloat(row.beta_1y) : null,
        dollar_volume_1m: row.dollar_volume_1m ? parseFloat(row.dollar_volume_1m) : null,
        breakout_flag: row.breakout_flag || false,
        trend_flag: row.trend_flag || false,
        momentum_flag: row.momentum_flag || false,
        volume_flag: row.volume_flag || false,
        high_20d: null,
        high_50d: null,
        prev_close: null,
        prev_macd_hist: null,
      },
      news_count: parseInt(row.news_count || 0),
      has_summary: row.has_summary || false,
    }));

    const response: GetCandidatesResponse = {
      success: true,
      candidates: candidates as any, // Type assertion needed due to optional fields
      total,
      run: {
        id: run.id,
        run_date: run.run_date,
        preset_id: run.preset_id,
        universe_size: run.universe_size,
        status: run.status as "running" | "completed" | "failed",
        started_at: run.started_at.toISOString(),
        finished_at: run.finished_at?.toISOString() || null,
        error: run.error,
      },
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Get candidates error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch candidates",
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}
