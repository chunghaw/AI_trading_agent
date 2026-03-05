import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { RunScreenRequestSchema, RunScreenResponseSchema, RunScreenResponse } from "@/lib/screen.schemas";
import { buildUniverseSQL } from "@/lib/screen/universe";
import { computeFeaturesFromRow } from "@/lib/screen/features";
import { scoreTechnical, calculateFinalScore, calculateLiquidityBonus, calculateRiskPenalty } from "@/lib/screen/scoring";
import { queryMilvus } from "@/lib/screen/news";
import { analyzeCandidate } from "@/lib/screen/agent";
import { ScreenFiltersSchema, ScreenFilters } from "@/lib/screen.schemas";
import { ensureTablesExist } from "@/lib/screen/db";

const DEFAULT_FILTERS: ScreenFilters = {
  market: "us",
  minMarketCap: 0,
  minBeta1Y: 0,
  minDollarVolume1M: 0,
};

export async function POST(req: NextRequest) {
  let client: Client | null = null;
  let runId: number | null = null;

  // When x-cron-secret is sent (e.g. by GitHub Actions), require it to match CRON_SECRET
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret != null && headerSecret !== "") {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || headerSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await req.json();
    const request = RunScreenRequestSchema.parse(body);

    // Get filters (from preset or request)
    let filters: ScreenFilters = request.filters || DEFAULT_FILTERS;

    if (request.presetId) {
      // Load preset filters
      client = new Client({
        connectionString: process.env.POSTGRES_URL!,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();

      const presetResult = await client.query(
        "SELECT filters_json FROM screen_presets WHERE id = $1",
        [request.presetId]
      );

      if (presetResult.rows.length > 0) {
        filters = ScreenFiltersSchema.parse(presetResult.rows[0].filters_json);
      }
    }

    if (!client) {
      client = new Client({
        connectionString: process.env.POSTGRES_URL!,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
    }

    // Run migration if tables don't exist (idempotent)
    await ensureTablesExist(client);

    // Check if run already exists - DELETE and re-run to allow filter changes
    const existingRun = await client.query(
      `SELECT id, status, universe_size FROM screen_runs 
       WHERE run_date = $1 AND (preset_id = $2 OR (preset_id IS NULL AND $2 IS NULL))`,
      [request.runDate, request.presetId || null]
    );

    if (existingRun.rows.length > 0) {
      const existing = existingRun.rows[0];
      console.log(`Found existing run ${existing.id} with ${existing.universe_size} tickers, status: ${existing.status}`);
      console.log(`Deleting and re-running to apply new filters...`);
      // Delete existing run and start fresh (allows filter updates)
      runId = existing.id;
      await client.query("DELETE FROM screen_runs WHERE id = $1", [runId]);
    }

    // Create new run record
    const runResult = await client.query(
      `INSERT INTO screen_runs (run_date, preset_id, status, started_at)
       VALUES ($1, $2, 'running', CURRENT_TIMESTAMP)
       RETURNING id`,
      [request.runDate, request.presetId || null]
    );
    runId = runResult.rows[0].id;

    console.log(`🚀 Starting screen run ${runId} for date ${request.runDate}`);

    // Step 1: Build universe
    console.log("📊 Step 1: Building universe...");
    console.log(`   Filters:`, JSON.stringify(filters, null, 2));
    console.log(`   Run date: ${request.runDate}`);

    const { sql: universeSQL, params: universeParams } = buildUniverseSQL(filters, request.runDate);
    console.log(`   SQL query length: ${universeSQL.length} chars`);
    console.log(`   Params: ${universeParams.length} parameters:`, universeParams);

    // Log full SQL for debugging (first 1000 chars)
    console.log(`   Full SQL (first 1000 chars):\n${universeSQL.substring(0, 1000)}`);

    let universeResult;
    try {
      universeResult = await client.query(universeSQL, universeParams);
    } catch (sqlError: any) {
      console.error(`   ❌ SQL Error:`, sqlError.message);
      console.error(`   SQL: ${universeSQL}`);
      console.error(`   Params:`, universeParams);
      throw sqlError;
    }
    const universe = universeResult.rows;
    const universeSize = universe.length;

    console.log(`✅ Universe built: ${universeSize} tickers`);
    console.log(`   Filters used:`, JSON.stringify(filters));

    if (universeSize === 0) {
      console.log(`⚠️  ZERO TICKERS - Debugging universe query...`);
      // Debug: Check what data exists
      const debugQuery = `
        SELECT 
          COUNT(*) as total_rows,
          COUNT(DISTINCT symbol) as unique_symbols,
          MAX(date) as latest_date,
          MIN(date) as earliest_date
        FROM gold_ohlcv_daily_metrics
        WHERE date >= $1::date - INTERVAL '60 days'
          AND date <= $1::date
      `;
      const debugResult = await client.query(debugQuery, [request.runDate]);
      console.log(`   📊 Debug - Total rows in date range: ${JSON.stringify(debugResult.rows[0])}`);

      // How many have RSI + close + volume (no MACD required)
      const basicQuery = `
        WITH latest_data AS (
          SELECT g.*,
            ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
          FROM gold_ohlcv_daily_metrics g
          WHERE g.date >= $1::date - INTERVAL '60 days'
            AND g.date <= $1::date
            AND g.close > 0
            AND g.total_volume > 0
            AND g.rsi_14 IS NOT NULL
            AND (g.market IS NULL OR g.market = 'stocks' OR g.market != 'etf')
        )
        SELECT COUNT(*) as count
        FROM latest_data
        WHERE rn = 1
      `;
      const basicResult = await client.query(basicQuery, [request.runDate]);
      console.log(`   📊 Basic (RSI+close+vol, no MACD): ${basicResult.rows[0].count}`);

      // Check Price > SMA200
      const smaQuery = `
        WITH latest_data AS (
          SELECT g.*,
            ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
          FROM gold_ohlcv_daily_metrics g
          WHERE g.date >= $1::date - INTERVAL '60 days'
            AND g.date <= $1::date
            AND g.close > 0
            AND g.total_volume > 0
            AND g.rsi_14 IS NOT NULL
            AND g.macd_line IS NOT NULL
            AND g.ma_200 IS NOT NULL
            AND g.ma_200 > 0
            AND g.ma_50 IS NOT NULL
            AND (g.market IS NULL OR g.market = 'stocks' OR g.market != 'etf')
        )
        SELECT COUNT(*) as count
        FROM latest_data
        WHERE rn = 1
          AND close > ma_200
      `;
      const smaResult = await client.query(smaQuery, [request.runDate]);
      console.log(`   📊 Price > SMA200 count: ${smaResult.rows[0].count}`);

      // Check market cap filter
      const mcapQuery = `
        WITH latest_data AS (
          SELECT g.*,
            ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
          FROM gold_ohlcv_daily_metrics g
          WHERE g.date >= $1::date - INTERVAL '60 days'
            AND g.date <= $1::date
            AND g.close > 0
            AND g.total_volume > 0
            AND g.rsi_14 IS NOT NULL
            AND g.macd_line IS NOT NULL
            AND g.ma_200 IS NOT NULL
            AND g.ma_200 > 0
            AND g.ma_50 IS NOT NULL
            AND g.close > g.ma_200
            AND (g.market IS NULL OR g.market = 'stocks' OR g.market != 'etf')
        )
        SELECT COUNT(*) as count
        FROM latest_data
        WHERE rn = 1
          AND (market_cap IS NULL OR market_cap >= $2)
      `;
      const mcapResult = await client.query(mcapQuery, [request.runDate, filters.minMarketCap]);
      console.log(`   📊 With market cap >= ${filters.minMarketCap} filter: ${mcapResult.rows[0].count}`);

      // Check dollar volume filter
      const dollarVolQuery = `
        WITH latest_data AS (
          SELECT g.*,
            ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
          FROM gold_ohlcv_daily_metrics g
          WHERE g.date >= $1::date - INTERVAL '60 days'
            AND g.date <= $1::date
            AND g.close > 0
            AND g.total_volume > 0
            AND g.rsi_14 IS NOT NULL
            AND g.macd_line IS NOT NULL
            AND g.ma_200 IS NOT NULL
            AND g.ma_200 > 0
            AND g.ma_50 IS NOT NULL
            AND g.close > g.ma_200
            AND (g.market IS NULL OR g.market = 'stocks' OR g.market != 'etf')
            AND (g.market_cap IS NULL OR g.market_cap >= $2)
        )
        SELECT COUNT(*) as count
        FROM latest_data
        WHERE rn = 1
          AND (total_dollar_volume IS NULL OR total_dollar_volume >= $3)
      `;
      const minDailyDollarVolume = filters.minDollarVolume1M / 20;
      const dollarVolResult = await client.query(dollarVolQuery, [request.runDate, filters.minMarketCap, minDailyDollarVolume]);
      console.log(`   📊 With dollar volume >= ${minDailyDollarVolume} filter: ${dollarVolResult.rows[0].count}`);

      // Also try a simpler query to see if ANY data exists with Price > SMA200
      const simpleTestQuery = `
        SELECT COUNT(*) as count, MAX(date) as max_date, MIN(date) as min_date
        FROM gold_ohlcv_daily_metrics
        WHERE date >= $1::date - INTERVAL '60 days'
          AND date <= $1::date
          AND close > ma_200
          AND ma_200 IS NOT NULL
          AND ma_200 > 0
      `;
      const simpleTestResult = await client.query(simpleTestQuery, [request.runDate]);
      console.log(`   📊 Simple Price > SMA200 test (any date in range): ${JSON.stringify(simpleTestResult.rows[0])}`);
    }

    // Update run with universe size
    await client.query("UPDATE screen_runs SET universe_size = $1 WHERE id = $2", [universeSize, runId]);

    if (universeSize === 0) {
      await client.query(
        "UPDATE screen_runs SET status = 'completed', finished_at = CURRENT_TIMESTAMP WHERE id = $1",
        [runId]
      );
      return NextResponse.json({
        success: true,
        run: {
          id: runId,
          run_date: request.runDate,
          preset_id: request.presetId || null,
          universe_size: 0,
          status: "completed",
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          error: null,
        },
        message: "No tickers found matching filters.",
      } as RunScreenResponse);
    }

    // Step 2: Compute features and technical scores for all tickers
    console.log("🔧 Step 2: Computing features and technical scores...");
    const candidatesWithScores: Array<{
      ticker: string;
      features: any;
      technicalScore: number;
      tags: string[];
      reasons: any[];
      newsScore?: number;
    }> = [];

    // Skip per-ticker Beta/DollarVolume queries (N+1) — use NULL; filter only when we have values
    for (const row of universe) {
      try {
        let features = computeFeaturesFromRow(row, request.runDate);
        // Beta/DollarVolume left as null for speed; app-layer filter only excludes when value present and below threshold

        if (filters.minMarketCap > 0 && features.market_cap != null && features.market_cap < filters.minMarketCap) continue;
        if (filters.minDollarVolume1M > 0 && features.dollar_volume_1m != null && features.dollar_volume_1m < filters.minDollarVolume1M) continue;
        if (filters.minBeta1Y > 0 && features.beta_1y != null && features.beta_1y < filters.minBeta1Y) continue;

        // Score technical
        const scoreResult = scoreTechnical(features);

        candidatesWithScores.push({
          ticker: features.ticker,
          features,
          technicalScore: scoreResult.technicalScore,
          tags: scoreResult.tags,
          reasons: scoreResult.reasons,
          newsScore: 0, // Will be updated after news analysis
        });
      } catch (error) {
        console.error(`Error processing ${row.symbol}:`, error);
        // Continue with next ticker
      }
    }

    // Split by security type to process Top 30 Stocks AND Top 30 ETFs independently
    const stockCandidates = candidatesWithScores.filter(c => c.features.security_type !== 'ETF').sort((a, b) => b.technicalScore - a.technicalScore);
    const etfCandidates = candidatesWithScores.filter(c => c.features.security_type === 'ETF').sort((a, b) => b.technicalScore - a.technicalScore);

    // Take Top X of each (defaulting to 30)
    const AI_ANALYSIS_LIMIT = 30; // Per category
    const topStocks = stockCandidates.slice(0, AI_ANALYSIS_LIMIT);
    const topETFs = etfCandidates.slice(0, AI_ANALYSIS_LIMIT);

    // Merge them back together for processing
    const candidatesToProcess = [...topStocks, ...topETFs];

    // Create a set of tickers that actually get AI analysis so we can efficiently skip the rest
    const aiAnalyzedTickers = new Set(candidatesToProcess.map(c => c.ticker));

    console.log(`✅ Computed scores. Selected Top ${topStocks.length} Stocks and Top ${topETFs.length} ETFs for AI analysis (${candidatesToProcess.length} total)`);

    // Step 3: Retrieve news and summarize for top candidates
    console.log("📰 Step 3: Retrieving news and generating summaries...");

    const BATCH_SIZE = 10;

    // We process candidates in batches to achieve parallel speedup without overloading the connection pool or rate limits
    for (let i = 0; i < candidatesWithScores.length; i += BATCH_SIZE) {
      const batch = candidatesWithScores.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (candidate) => {
        // Skip AI for candidates not in the Top 30 Stocks or Top 30 ETFs
        if (!aiAnalyzedTickers.has(candidate.ticker)) {
          // Basic save without AI
          await client!.query(
            `INSERT INTO screen_candidates (run_id, ticker, final_score, technical_score, news_score, tags_json)
                  VALUES ($1, $2, $3, $4, 0, $5)
                  ON CONFLICT (run_id, ticker) DO UPDATE SET
                    final_score = EXCLUDED.final_score,
                    technical_score = EXCLUDED.technical_score,
                    news_score = 0,
                    tags_json = EXCLUDED.tags_json`,
            [runId, candidate.ticker, candidate.technicalScore, candidate.technicalScore, JSON.stringify(candidate.tags)]
          );

          /* We still need to save features for them to appear in the dashboard with stats */
          const featuresWithReasons = { ...candidate.features, reasons: candidate.reasons };
          await client!.query(
            `INSERT INTO candidate_features 
                     (run_id, ticker, asof_date, sma50, sma200, macd, macd_signal, macd_hist, rvol, atrp, 
                      breakout_flag, trend_flag, momentum_flag, volume_flag, beta_1y, dollar_volume_1m, market_cap, raw_json, security_type)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                     ON CONFLICT(run_id, ticker) DO UPDATE SET
                        market_cap = EXCLUDED.market_cap,
                        security_type = EXCLUDED.security_type,
                        raw_json = EXCLUDED.raw_json`, /* Only updating key fields for speed on non-analyzed ones */
            [
              runId,
              candidate.ticker,
              request.runDate,
              candidate.features.sma50,
              candidate.features.sma200,
              candidate.features.macd,
              candidate.features.macd_signal,
              candidate.features.macd_hist,
              candidate.features.rvol,
              candidate.features.atrp,
              candidate.features.breakout_flag,
              candidate.features.trend_flag,
              candidate.features.momentum_flag,
              candidate.features.volume_flag,
              candidate.features.beta_1y,
              candidate.features.dollar_volume_1m,
              candidate.features.market_cap,
              JSON.stringify(featuresWithReasons),
              candidate.features.security_type,
            ]
          );
          return;
        }

        try {
          // Query Milvus for news, anchoring the 7-day lookback to the historical run date, not the current clock.
          const articles = await queryMilvus(
            candidate.ticker,
            7,
            20,
            candidate.features.company_name,
            request.runDate // Important: anchor to historical run date
          );

          // Store news articles
          if (articles.length > 0) {
            // Insert news articles one by one (simpler and more reliable)
            for (const article of articles) {
              await client!.query(
                `INSERT INTO candidate_news 
                 (run_id, ticker, published_at, title, url, source, sentiment_label, sentiment_score, milvus_ids_json)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT DO NOTHING`,
                [
                  runId,
                  candidate.ticker,
                  article.published_utc,
                  article.title,
                  article.url,
                  article.source || null,
                  null, // sentiment_label
                  null, // sentiment_score
                  JSON.stringify([article.id]), // milvus_ids_json
                ]
              );
            }

            // Analyze with AI Agent (Technicals + News)
            console.log(`   🤖 Analyzing ${candidate.ticker} with AI Agent...`);
            const { summary, citations } = await analyzeCandidate(candidate.ticker, candidate.features, articles);

            // Store summary
            await client!.query(
              `INSERT INTO candidate_summary (run_id, ticker, summary_json, citations_json, model)
               VALUES ($1, $2, $3, $4, 'gpt-4o-mini')
               ON CONFLICT (run_id, ticker) DO UPDATE SET
                 summary_json = EXCLUDED.summary_json,
                 citations_json = EXCLUDED.citations_json,
                 created_at = CURRENT_TIMESTAMP`,
              [runId, candidate.ticker, JSON.stringify(summary), JSON.stringify(citations)]
            );

            // Update candidate with news score
            candidate.newsScore = summary.newsScore;
          } else {
            candidate.newsScore = 0;
          }

          // Calculate final score
          const liquidityBonus = calculateLiquidityBonus(candidate.features.dollar_volume_1m);
          const riskPenalty = calculateRiskPenalty(candidate.features.rsi, candidate.features.atrp);
          const finalScore = calculateFinalScore(
            candidate.technicalScore,
            candidate.newsScore || 0,
            liquidityBonus,
            riskPenalty
          );

          // Store candidate
          await client!.query(
            `INSERT INTO screen_candidates (run_id, ticker, final_score, technical_score, news_score, tags_json)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (run_id, ticker) DO UPDATE SET
               final_score = EXCLUDED.final_score,
               technical_score = EXCLUDED.technical_score,
               news_score = EXCLUDED.news_score,
               tags_json = EXCLUDED.tags_json`,
            [runId, candidate.ticker, finalScore, candidate.technicalScore, candidate.newsScore || 0, JSON.stringify(candidate.tags)]
          );

          // Store features with reasons
          const featuresWithReasons = {
            ...candidate.features,
            reasons: candidate.reasons, // Store scoring reasons
          };

          await client!.query(
            `INSERT INTO candidate_features 
             (run_id, ticker, asof_date, sma50, sma200, macd, macd_signal, macd_hist, rvol, atrp, 
              breakout_flag, trend_flag, momentum_flag, volume_flag, beta_1y, dollar_volume_1m, market_cap, raw_json, security_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             ON CONFLICT (run_id, ticker) DO UPDATE SET
               asof_date = EXCLUDED.asof_date,
               sma50 = EXCLUDED.sma50,
               sma200 = EXCLUDED.sma200,
               macd = EXCLUDED.macd,
               macd_signal = EXCLUDED.macd_signal,
               macd_hist = EXCLUDED.macd_hist,
               rvol = EXCLUDED.rvol,
               atrp = EXCLUDED.atrp,
               breakout_flag = EXCLUDED.breakout_flag,
               trend_flag = EXCLUDED.trend_flag,
               momentum_flag = EXCLUDED.momentum_flag,
               volume_flag = EXCLUDED.volume_flag,
               beta_1y = EXCLUDED.beta_1y,
               dollar_volume_1m = EXCLUDED.dollar_volume_1m,
               market_cap = EXCLUDED.market_cap,
               raw_json = EXCLUDED.raw_json,
               security_type = EXCLUDED.security_type`,
            [
              runId,
              candidate.ticker,
              request.runDate,
              candidate.features.sma50,
              candidate.features.sma200,
              candidate.features.macd,
              candidate.features.macd_signal,
              candidate.features.macd_hist,
              candidate.features.rvol,
              candidate.features.atrp,
              candidate.features.breakout_flag,
              candidate.features.trend_flag,
              candidate.features.momentum_flag,
              candidate.features.volume_flag,
              candidate.features.beta_1y,
              candidate.features.dollar_volume_1m,
              candidate.features.market_cap,
              JSON.stringify(featuresWithReasons),
              candidate.features.security_type,
            ]
          );
        } catch (error) {
          console.error(`Error processing news for ${candidate.ticker}:`, error);
          // Continue with next candidate
        }
      }));
      console.log(`  Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(candidatesWithScores.length / BATCH_SIZE)}...`);
    }

    // Step 4: Mark run as completed
    await client.query(
      "UPDATE screen_runs SET status = 'completed', finished_at = CURRENT_TIMESTAMP WHERE id = $1",
      [runId]
    );

    console.log(`✅ Screen run ${runId} completed successfully`);

    // Fetch final run record
    const finalRun = await client.query("SELECT * FROM screen_runs WHERE id = $1", [runId]);

    return NextResponse.json({
      success: true,
      run: {
        id: finalRun.rows[0].id,
        run_date: finalRun.rows[0].run_date,
        preset_id: finalRun.rows[0].preset_id,
        universe_size: finalRun.rows[0].universe_size,
        status: finalRun.rows[0].status,
        started_at: finalRun.rows[0].started_at.toISOString(),
        finished_at: finalRun.rows[0].finished_at?.toISOString() || null,
        error: finalRun.rows[0].error,
      },
      message: `Screen run completed. ${candidatesToProcess.length} candidates analyzed.`,
    } as RunScreenResponse);
  } catch (error: any) {
    console.error("Screen run error:", error);

    // Mark run as failed if it exists
    if (runId && client) {
      try {
        await client.query(
          "UPDATE screen_runs SET status = 'failed', error = $1, finished_at = CURRENT_TIMESTAMP WHERE id = $2",
          [error.message || "Unknown error", runId]
        );
      } catch (updateError) {
        console.error("Error updating failed run:", updateError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to run screen",
        details: error.stack,
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}

