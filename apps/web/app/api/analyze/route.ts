import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import OpenAI from "openai";
import { z } from "zod";
import { AgentReportSchema, mapNewsSentimentToStatus, mapTechnicalSentimentToStatus, mapOverallStatus } from "../../../lib/agent.schema";
import { getNewsAnalystPrompt, getTechnicalAnalystPrompt, getSynthesisPrompt } from "../../../lib/prompts";
import { searchAndRerankNewsStrict } from "@/lib/news.search";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const Body = z.object({
  symbol: z.string().optional(),
  query: z.string().default("trading analysis"),
  prompt: z.string().optional(), // Support old frontend format
  timeframe: z.string().default("1d"),
  since_days: z.number().default(7)
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol');
  
  if (!symbol) {
    return NextResponse.json({ 
      error: "Symbol parameter required",
      code: "MISSING_SYMBOL"
    }, { status: 400 });
  }
  
  // Convert GET request to POST format
  const mockReq = new NextRequest(req.url, {
    method: 'POST',
    body: JSON.stringify({
      symbol,
      query: "trading analysis",
      timeframe: "1d",
      since_days: 7
    })
  });
  
  return POST(mockReq);
}

export async function POST(req: NextRequest) {
  try {
    console.log(`🚀 === ANALYSIS REQUEST START === v3.0 - NUCLEAR CACHE BUST - ${new Date().toISOString()}`);
    
    // Debug request body parsing
    let requestBody;
    try {
      requestBody = await req.json();
      console.log(`📝 Raw request body:`, JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error(`❌ JSON parse error:`, parseError);
      return NextResponse.json({ 
        error: "Invalid JSON in request body",
        details: parseError.message
      }, { status: 400 });
    }
    
    // Validate request body
    if (!requestBody || typeof requestBody !== 'object') {
      console.error(`❌ Invalid request body:`, requestBody);
      return NextResponse.json({ 
        error: "Request body must be a JSON object",
        received: typeof requestBody
      }, { status: 400 });
    }
    
    const { symbol, query, prompt, timeframe, since_days } = Body.parse(requestBody);
    
    // Handle both old and new frontend formats
    const actualQuery = prompt || query;
    console.log(`📝 Parsed request: ${actualQuery}, symbol: ${symbol}, timeframe: ${timeframe}, since_days: ${since_days}`);
    
    // Use provided symbol or detect from query
    let detectedSymbol = symbol;
    if (!detectedSymbol && actualQuery) {
      detectedSymbol = await detectSymbolFromQuestion(actualQuery, openai);
    }
    if (!detectedSymbol) {
      console.log(`❌ AI SYMBOL DETECTION FAILED`);
      return NextResponse.json({ 
        error: "Symbol parameter required",
        code: "MISSING_SYMBOL"
      }, { status: 400 });
    }

    console.log(`✅ AI SYMBOL DETECTED: "${detectedSymbol}" from query: "${query}"`);
    
    // Step 1: Load OHLCV data from gold table
    console.log(`📊 STEP 1: Loading OHLCV data for ${detectedSymbol}`);
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    console.log(`🔍 Fetching real OHLCV data from Postgres for ${detectedSymbol}`);
    const sqlQuery = `
      WITH latest_data AS (
        SELECT 
          g.date, g.open, g.high, g.low, g.close, g.total_volume as volume,
          COALESCE(c.name, g.company_name) as company_name,
          COALESCE(c.market, g.market) as market,
          COALESCE(c.type, g.stock_type) as stock_type,
          COALESCE(c.primary_exchange, g.primary_exchange) as primary_exchange,
          COALESCE(c.currency_name, g.currency) as currency,
          COALESCE(c.total_employees, g.total_employees) as total_employees,
          COALESCE(c.description, g.description) as description,
        g.rsi_14, g.ma_5, g.ma_20, g.ma_50, g.ma_200,
        g.ema_20, g.ema_50, g.ema_200, g.macd_line, g.macd_signal, g.macd_histogram,
        g.vwap, g.atr_14,
          g.volume_trend, g.volume_price_relationship,
          ROW_NUMBER() OVER (ORDER BY g.date DESC) as rn
        FROM gold_ohlcv_daily_metrics g
        LEFT JOIN company_info_cache c ON g.symbol = c.symbol
        WHERE g.symbol = $1
      )
      SELECT 
        current.*,
        prev.close as prev_close,
        (current.close - prev.close) as price_change,
        CASE 
          WHEN prev.close > 0 THEN ((current.close - prev.close) / prev.close) * 100
          ELSE NULL 
        END as price_change_percent
      FROM latest_data current
      LEFT JOIN latest_data prev ON prev.rn = current.rn + 1
      WHERE current.rn = 1
    `;
    
    const result = await client.query(sqlQuery, [detectedSymbol]);
    await client.end();
    
    if (result.rows.length === 0) {
      console.log(`❌ No data found for ${detectedSymbol}`);
      return NextResponse.json({ 
        error: `Database connection failed. Cannot fetch OHLCV data for ${detectedSymbol}.`,
        code: "DATABASE_CONNECTION_ERROR",
        symbol: detectedSymbol,
        details: "No data found in gold table"
      }, { status: 500 });
    }
    
    const dbData = result.rows[0];
    console.log(`📊 Symbol data found: ${result.rows.length} records from Postgres GOLD TABLE`);
    console.log(`🔍 DEBUG - First record from gold table:`, dbData);
    console.log(`🔍 DEBUG - Technical indicators from DB:`, {
      rsi_14: dbData.rsi_14,
      macd_line: dbData.macd_line,
      macd_signal: dbData.macd_signal,
      macd_histogram: dbData.macd_histogram,
      ema_20: dbData.ema_20,
      ema_50: dbData.ema_50,
      ema_200: dbData.ema_200,
      vwap: dbData.vwap,
      atr_14: dbData.atr_14
    });
    
    // Create bars object from database data
    const bars = {
      date: [new Date(dbData.date)],
      open: [parseFloat(dbData.open)],
      high: [parseFloat(dbData.high)],
      low: [parseFloat(dbData.low)],
      close: [parseFloat(dbData.close)],
      volume: [parseInt(dbData.volume)]
    };
    
    console.log(`✅ REAL DATA: Loaded ${result.rows.length} ${detectedSymbol} bars, latest close: $${dbData.close}`);
    
    // Step 2: Search for news
    console.log(`📰 STEP 2: Searching for news for ${detectedSymbol} since ${dayjs().subtract(since_days, "day").toISOString()}`);
    let newsAnalysis = { rationale: [], citations: [] };
    const embeddingTerms = [
      detectedSymbol,
      actualQuery,
      dbData?.company_name,
      dbData?.stock_type,
      dbData?.market,
      "earnings outlook",
      "guidance",
      "risk factors",
      "analyst commentary",
      "news update"
    ]
      .filter(Boolean)
      .map(term => term!.toString().trim())
      .filter(term => term.length > 1);
    const embeddingQuery = Array.from(new Set(embeddingTerms)).join(" ");
    try {
      const hits = await searchAndRerankNewsStrict(
        detectedSymbol,
        embeddingQuery,
        dayjs().subtract(since_days, "day").toISOString(),
        {
          originalQuery: actualQuery,
          companyName: dbData?.company_name
        }
      );
      if (hits.length > 0) {
        const makeSnippet = (rawText: string, focusTerms: string[]) => {
          const text = String(rawText || "").replace(/\s+/g, " " ).trim();
          if (!text) return "";
          const lower = text.toLowerCase();
          for (const term of focusTerms) {
            if (!term) continue;
            const idx = lower.indexOf(term);
            if (idx !== -1) {
              const start = Math.max(0, idx - 160);
              const end = Math.min(text.length, idx + term.length + 160);
              const slice = text.slice(start, end).trim();
              const needsEllipsis = slice.length < text.length;
              return needsEllipsis && !slice.endsWith('.') ? `${slice}…` : slice;
            }
          }
          const fallback = text.slice(0, 320).trim();
          const needsEllipsis = fallback.length < text.length;
          return needsEllipsis && !fallback.endsWith('.') ? `${fallback}…` : fallback;
        };

        const focusTerms = Array.from(
          new Set(
            [
              detectedSymbol,
              detectedSymbol.replace('.', ''),
              (dbData.company_name || '').toString(),
              ...(actualQuery || '').split(/[^a-z0-9]+/i)
            ]
              .map((t) => t?.trim().toLowerCase())
              .filter((t) => t && t.length > 2)
          )
        );

        const topHits = hits.slice(0, 3);
        console.log('News debug: selected top hits', topHits.map((h, idx) => ({
          rank: idx + 1,
          title: h.title,
          url: h.url,
          score: h.score,
          published_utc: h.published_utc
        })));

        newsAnalysis = {
          rationale: topHits.map(h => {
            const title = h.title || 'News article';
            const snippet = makeSnippet((h as any).text || (h as any).content || (h as any).description || '', focusTerms);
            return snippet ? `${title} — ${snippet}` : title;
          }),
          citations: topHits.map(h => h.url).filter(Boolean)
        };
      } else {
        console.warn(`No news found for ${detectedSymbol} in the last ${since_days} days`);
        newsAnalysis = {
          rationale: [`No recent news found for ${detectedSymbol}`],
          citations: []
        };
      }
    } catch (error: any) {
      console.warn('News search failed, continuing with technical analysis only:', error.message);
      newsAnalysis = {
        rationale: [`News analysis unavailable for ${detectedSymbol}`],
        citations: []
      };
    }
    
    console.log(`✅ News analysis prepared with ${newsAnalysis.rationale.length} articles`);
    
    // Step 3: Use pre-calculated technical indicators from gold table
    console.log(`📊 STEP 3: Using pre-calculated technical indicators for ${detectedSymbol}`);
    // Helper function to safely parse numeric values
    const safeParseFloat = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    const indicators = {
      rsi14: safeParseFloat(dbData.rsi_14),
      macd: safeParseFloat(dbData.macd_line),
      macd_signal: safeParseFloat(dbData.macd_signal),
      macd_hist: safeParseFloat(dbData.macd_histogram),
      ema20: safeParseFloat(dbData.ema_20),
      ema50: safeParseFloat(dbData.ema_50),
      ema200: safeParseFloat(dbData.ema_200),
      vwap: safeParseFloat(dbData.vwap),
      atr: safeParseFloat(dbData.atr_14)
    };
    const currentPrice = parseFloat(dbData.close);
    const volumeTrend = dbData.volume_trend || "flat";
    const volumePriceRelation = dbData.volume_price_relationship || "neutral";
    
    console.log(`✅ STEP 3 SUCCESS: Using pre-calculated indicators - RSI: ${indicators.rsi14}, MACD: ${indicators.macd}, Price: $${currentPrice}, Source: gold_table_precalculated`);
    console.log(`🔍 DEBUG - Raw database values:`, {
      rsi_14: dbData.rsi_14,
      macd_line: dbData.macd_line,
      macd_signal: dbData.macd_signal,
      macd_histogram: dbData.macd_histogram,
      ema_20: dbData.ema_20,
      ema_50: dbData.ema_50,
      ema_200: dbData.ema_200,
      atr_14: dbData.atr_14,
      vwap: dbData.vwap
    });
    console.log(`🔍 DEBUG - Parsed indicators:`, indicators);
    
    // Step 4: Generate analysis using GPT
    console.log(`🎯 STAGE C: Generating final answer for user's question`);
    const newsPrompt = getNewsAnalystPrompt({
      symbol: detectedSymbol,
      newsDocs: newsAnalysis.rationale,
      userQuery: actualQuery,
      citations: newsAnalysis.citations
    });
    const techPrompt = getTechnicalAnalystPrompt({
      symbol: detectedSymbol,
      indicators,
      currentPrice,
      volumeTrend,
      volumePriceRelation,
      userQuery: actualQuery
    });
    const synthesisPrompt = getSynthesisPrompt({
      symbol: detectedSymbol,
      newsSummary: newsAnalysis.rationale,
      indicators,
      currentPrice,
      volumeTrend,
      volumePriceRelation,
      userQuery: actualQuery
    });
    
    // Call GPT for news analysis
    console.log(`📰 STAGE A1: Calling News QA for ${detectedSymbol}`);
    const newsCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: newsPrompt }]
    });
    
    const newsResult = JSON.parse(newsCompletion.choices[0].message.content || "{}");
    console.log(`✅ News analysis completed`);
    
    // Call GPT for technical analysis
    console.log(`📊 STAGE A2: Calling Technical QA for ${detectedSymbol}`);
    const techCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: techPrompt }]
    });
    
    const techResult = JSON.parse(techCompletion.choices[0].message.content || "{}");
    console.log(`✅ Technical analysis completed`);
    
    // Generate final synthesis
    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: synthesisPrompt }]
    });
    
    const finalResult = JSON.parse(finalCompletion.choices[0].message.content || "{}");
    console.log(`✅ Final synthesis completed`);
    
    // Build response according to Agent.md specification
    const response = {
      header: {
        name: dbData.company_name || `${detectedSymbol} Inc.`,
        market: dbData.market || "stocks",
        type: dbData.stock_type || "CS",
        exchange: dbData.primary_exchange || "XNAS",
        currency: dbData.currency || "usd",
        employees: dbData.total_employees || null,
        description: (dbData.description || `${detectedSymbol} is a publicly traded company.`).substring(0, 200),
        price: {
          current: parseFloat(dbData.close) || null,
          change: parseFloat(dbData.price_change) || null,
          change_percent: parseFloat(dbData.price_change_percent) || null,
          as_of_date: dbData.date || null
        }
      },
      news: {
        sentiment: newsResult.sentiment || "neutral",
        key_points: newsResult.key_points || newsAnalysis.rationale,
        analysis: newsResult.analysis || `News analysis for ${detectedSymbol}`,
        sources: newsAnalysis.citations,
        status: mapNewsSentimentToStatus(newsResult.sentiment || "neutral"),
        no_data: newsAnalysis.rationale.length === 0
      },
      technical: {
      indicators: {
        rsi: indicators.rsi14,
        macd_line: indicators.macd,
        macd_signal: indicators.macd_signal,
        macd_hist: indicators.macd_hist,
        ema20: indicators.ema20,
        ema50: indicators.ema50,
        ema200: indicators.ema200,
        vwap: indicators.vwap,
        atr: indicators.atr,
        volume_trend: volumeTrend,
        vol_price_relation: volumePriceRelation
      },
        analysis: techResult.analysis || `Technical analysis for ${detectedSymbol}`,
        sentiment: techResult.sentiment || "neutral",
        status: mapTechnicalSentimentToStatus(techResult.sentiment || "neutral")
      },
      final_answer: {
        summary: finalResult.summary || `Analysis summary for ${detectedSymbol}`,
        key_insights: finalResult.key_insights || [],
        overall_status: finalResult.overall_status || "neutral",
        answer: finalResult.answer || `Based on the analysis, ${detectedSymbol} shows ${finalResult.overall_status || 'neutral'} outlook.`
      },
      meta: {
        ticker: detectedSymbol,
        as_of: dayjs().toISOString(),
        horizon: since_days <= 1 ? "intraday" : since_days <= 3 ? "1–3 days" : "1 week",
        user_question: query
      }
    };
    
    console.log(`🎉 === ANALYSIS COMPLETED SUCCESSFULLY ===`);
    console.log(`🔍 Final response structure:`, {
      ticker: response.meta.ticker,
      newsStatus: response.news.status,
      technicalStatus: response.technical.status,
      overallStatus: response.final_answer.overall_status
    });
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error("❌ === ANALYSIS ERROR ===");
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error details:", {
      name: error.name,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
      port: error.port
    });
    
    return NextResponse.json({ 
      error: "Failed to analyze data",
      details: error.message,
      errorType: error.name,
      code: error.code || "UNKNOWN_ERROR"
    }, { status: 500 });
  }
}

// Helper functions
function computeIndicators(bars: any, dbData?: any[]) {
  if (dbData && dbData.length > 0) {
    const latestData = dbData[0];
    
    return {
      rsi14: latestData.rsi ? parseFloat(latestData.rsi) : null,
      macd: {
        macd: latestData.macd_line ? parseFloat(latestData.macd_line) : null,
        signal: latestData.macd_signal ? parseFloat(latestData.macd_signal) : null,
        histogram: latestData.macd_histogram ? parseFloat(latestData.macd_histogram) : null
      },
      ma_20: latestData.ma_20 ? parseFloat(latestData.ma_20) : null,
      ma_50: latestData.ma_50 ? parseFloat(latestData.ma_50) : null,
      ma_200: latestData.ma_200 ? parseFloat(latestData.ma_200) : null,
      ema_20: latestData.ema_20 ? parseFloat(latestData.ema_20) : null,
      ema_50: latestData.ema_50 ? parseFloat(latestData.ema_50) : null,
      ema_200: latestData.ema_200 ? parseFloat(latestData.ema_200) : null,
      vwap: latestData.vwap ? parseFloat(latestData.vwap) : null,
      atr: latestData.atr_14 ? parseFloat(latestData.atr_14) : null
    };
  }
  
  return {
    rsi14: null,
    macd: { macd: null, signal: null, histogram: null },
    ma_20: null, ma_50: null, ma_200: null,
    ema_20: null, ema_50: null, ema_200: null,
    vwap: null, atr: null
  };
}

async function detectSymbolFromQuestion(question: string, openai: OpenAI): Promise<string | null> {
  try {
    const prompt = `Extract the stock ticker symbol from the user's query. Return only the ticker symbol (e.g., AAPL, NVDA, TSLA, META, AMZN) or null if no symbol is found. Note that Facebook ticker symbol is META and Amazon is AMZN.                                    

Question: "${question}"

Return a JSON object with the following format: {"symbol": "AAPL" or null}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: prompt }]
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return result.symbol;
  } catch (error) {
    console.error("Symbol detection error:", error);
    return null;
  }
}
