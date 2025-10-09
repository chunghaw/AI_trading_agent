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
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    await client.connect();
    
    console.log(`🔍 Fetching real OHLCV data from Postgres for ${detectedSymbol}`);
    const sqlQuery = `
      SELECT 
        g.date, g.open, g.high, g.low, g.close, g.total_volume as volume,
        COALESCE(c.name, g.company_name) as company_name,
        COALESCE(c.market, g.market) as market,
        COALESCE(c.type, g.stock_type) as stock_type,
        COALESCE(c.primary_exchange, g.primary_exchange) as primary_exchange,
        COALESCE(c.currency_name, g.currency) as currency,
        COALESCE(c.total_employees, g.total_employees) as total_employees,
        COALESCE(c.description, g.description) as description,
        g.rsi_14 as rsi, g.ma_5, g.ma_20, g.ma_50, g.ma_200,
        g.ema_20, g.ema_50, g.ema_200, g.macd_line, g.macd_signal, g.macd_histogram,
        g.vwap, g.atr_14 as atr,
        g.volume_trend, g.volume_price_relationship
      FROM gold_ohlcv_daily_metrics g
      LEFT JOIN company_info_cache c ON g.symbol = c.symbol
      WHERE g.symbol = $1
      ORDER BY g.date DESC
      LIMIT 1
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
    try {
      const hits = await searchAndRerankNewsStrict(detectedSymbol, query, dayjs().subtract(since_days, "day").toISOString());
      if (hits.length > 0) {
        newsAnalysis = {
          rationale: hits.slice(0, 3).map(h => h.title || "News article"),
          citations: hits.slice(0, 3).map(h => h.url).filter(Boolean)
        };
      } else {
        console.warn(`No news found for ${detectedSymbol} in the last ${since_days} days`);
        newsAnalysis = {
          rationale: [`No recent news found for ${detectedSymbol}`],
          citations: []
        };
      }
    } catch (error: any) {
      console.warn("News search failed, continuing with technical analysis only:", error.message);
      newsAnalysis = {
        rationale: [`News analysis unavailable for ${detectedSymbol}`],
        citations: []
      };
    }
    
    console.log(`✅ News analysis prepared with ${newsAnalysis.rationale.length} articles`);
    
    // Step 3: Compute technical indicators
    console.log(`📊 STEP 3: Computing technical indicators for ${detectedSymbol}`);
    const indicators = computeIndicators(bars, [dbData]);
    const currentPrice = parseFloat(dbData.close);
    
    console.log(`✅ STEP 3 SUCCESS: Indicators calculated - RSI: ${indicators.rsi14}, MACD: ${indicators.macd?.macd}, Price: $${currentPrice}, Source: gold_table_precalculated`);
    
    // Step 4: Generate analysis using GPT
    console.log(`🎯 STAGE C: Generating final answer for user's question`);
    const newsPrompt = getNewsAnalystPrompt({ symbol: detectedSymbol, newsDocs: newsAnalysis.rationale, userQuery: query });
    const techPrompt = getTechnicalAnalystPrompt({ symbol: detectedSymbol, indicators, currentPrice, userQuery: query });
    const synthesisPrompt = getSynthesisPrompt({ symbol: detectedSymbol, newsAnalysis: newsAnalysis.rationale, technicalAnalysis: `RSI: ${indicators.rsi14}, MACD: ${indicators.macd?.macd}`, userQuery: query });
    
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
    
    // Build response
    const response = {
      ticker: detectedSymbol,
      header: {
        name: dbData.company_name || `${detectedSymbol} Inc.`,
        market: dbData.market || "stocks",
        type: dbData.stock_type || "CS",
        exchange: dbData.primary_exchange || "XNAS",
        currency: dbData.currency || "usd",
        employees: dbData.total_employees || null,
        description: dbData.description || `${detectedSymbol} is a publicly traded company.`
      },
      news: {
        sentiment: newsResult.sentiment || "neutral",
        key_points: newsAnalysis.rationale,
        analysis: newsResult.analysis || `News analysis for ${detectedSymbol}`,
        sources: newsAnalysis.citations,
        status: mapNewsSentimentToStatus(newsResult.sentiment || "neutral"),
        no_data: newsAnalysis.rationale.length === 0
      },
      technical: {
        overall_bias: techResult.overall_bias || "neutral",
        key_levels: techResult.key_levels || [],
        momentum_assessment: techResult.momentum_assessment || "neutral",
        trading_outlook: techResult.trading_outlook || `Technical analysis for ${detectedSymbol}`
      },
      portfolio: {
        size_suggestion_pct: finalResult.size_suggestion_pct || 5
      },
      price: {
        current: currentPrice,
        previous: currentPrice, // Could be improved with previous day data
        change: 0, // Could be improved with previous day data
        changePercent: 0, // Could be improved with previous day data
        date: dayjs().format('YYYY-MM-DD')
      },
      timeframe,
      newsStatus: mapNewsSentimentToStatus(newsResult.sentiment || "neutral"),
      technicalStatus: mapTechnicalSentimentToStatus(techResult.overall_bias || "neutral"),
      overallStatus: mapOverallStatus(newsResult.sentiment || "neutral", techResult.overall_bias || "neutral")
    };
    
    console.log(`🎉 === ANALYSIS COMPLETED SUCCESSFULLY ===`);
    console.log(`🔍 Final response structure:`, {
      ticker: response.ticker,
      newsStatus: response.newsStatus,
      technicalStatus: response.technicalStatus,
      overallStatus: response.overallStatus
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
    const prompt = `Extract the stock ticker symbol from this question. Return only the ticker symbol (e.g., AAPL, NVDA, TSLA) or null if no symbol is found.

Question: "${question}"

Response format: {"symbol": "AAPL" or null}`;

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