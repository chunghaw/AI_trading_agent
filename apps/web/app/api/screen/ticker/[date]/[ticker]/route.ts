import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function GET(
  req: NextRequest,
  { params }: { params: { date: string; ticker: string } }
) {
  let client: Client | null = null;

  try {
    const { date, ticker } = params;

    client = new Client({
      connectionString: process.env.POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // Get run for this date
    const runResult = await client.query(
      "SELECT id FROM screen_runs WHERE run_date = $1 AND status = 'completed' ORDER BY finished_at DESC LIMIT 1",
      [date]
    );

    if (runResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `No completed run found for date ${date}` },
        { status: 404 }
      );
    }

    const runId = runResult.rows[0].id;

    // Get candidate
    const candidateResult = await client.query(
      `SELECT * FROM screen_candidates WHERE run_id = $1 AND ticker = $2`,
      [runId, ticker.toUpperCase()]
    );

    if (candidateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Candidate ${ticker} not found for run ${date}` },
        { status: 404 }
      );
    }

    const candidate = candidateResult.rows[0];

    // Get features
    const featuresResult = await client.query(
      `SELECT * FROM candidate_features WHERE run_id = $1 AND ticker = $2`,
      [runId, ticker.toUpperCase()]
    );
    const features = featuresResult.rows[0] || null;

    // Get news
    const newsResult = await client.query(
      `SELECT * FROM candidate_news WHERE run_id = $1 AND ticker = $2 ORDER BY published_at DESC`,
      [runId, ticker.toUpperCase()]
    );
    const news = newsResult.rows;

    // Get summary
    const summaryResult = await client.query(
      `SELECT * FROM candidate_summary WHERE run_id = $1 AND ticker = $2`,
      [runId, ticker.toUpperCase()]
    );
    const summary = summaryResult.rows[0] || null;

    // Get scoring reasons from raw_json if available
    let reasons: any[] = [];
    if (features?.raw_json) {
      try {
        const rawData = typeof features.raw_json === 'string' 
          ? JSON.parse(features.raw_json) 
          : features.raw_json;
        reasons = Array.isArray(rawData.reasons) ? rawData.reasons : [];
      } catch (e) {
        console.error("Error parsing reasons:", e);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        candidate: {
          ...candidate,
          tags_json: Array.isArray(candidate.tags_json) 
            ? candidate.tags_json 
            : (candidate.tags_json ? JSON.parse(candidate.tags_json) : []),
        },
        features: features ? {
          ...features,
          raw_json: features.raw_json ? (typeof features.raw_json === 'string' ? JSON.parse(features.raw_json) : features.raw_json) : null,
        } : null,
        news: news.map((n) => ({
          ...n,
          published_at: n.published_at.toISOString(),
          milvus_ids_json: n.milvus_ids_json ? (typeof n.milvus_ids_json === 'string' ? JSON.parse(n.milvus_ids_json) : n.milvus_ids_json) : [],
        })),
        summary: summary ? {
          ...summary,
          summary_json: summary.summary_json ? (typeof summary.summary_json === 'string' ? JSON.parse(summary.summary_json) : summary.summary_json) : null,
          citations_json: summary.citations_json ? (typeof summary.citations_json === 'string' ? JSON.parse(summary.citations_json) : summary.citations_json) : [],
        } : null,
        reasons,
      },
    });
  } catch (error: any) {
    console.error("Get ticker details error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch ticker details",
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}
