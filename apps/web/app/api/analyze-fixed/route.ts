import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { searchAndRerankNewsStrict } from "@/lib/news.search";
import { AgentReportSchema } from "@/lib/report.schema";
import { generateReportPrompt } from "@/lib/report.prompts";

const Body = z.object({
  symbol: z.string().min(1),
  query: z.string().default("trading analysis"),
  timeframe: z.string().default("1d"),
  since_days: z.number().default(7)
});

export async function POST(req: NextRequest) {
  try {
    console.log(`🚀 === NEW FIXED API v1.0 - ${new Date().toISOString()}`);
    const { symbol, query, timeframe, since_days } = Body.parse(await req.json());
    console.log(`📝 Request: ${query}, symbol: ${symbol}, timeframe: ${timeframe}, since_days: ${since_days}`);
    
    // Use provided symbol or detect from query
    let detectedSymbol = symbol;
    if (!detectedSymbol && query) {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Simple symbol detection from query
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Extract the stock ticker symbol from the user query. Return only the ticker symbol in uppercase (e.g., AAPL, NVDA, TSLA). If no symbol found, return 'AAPL'."
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: 10,
        temperature: 0
      });
      
      detectedSymbol = response.choices[0].message.content?.trim() || 'AAPL';
    }
    
    console.log(`🎯 Detected symbol: ${detectedSymbol}`);
    
    // Calculate date range
    const sinceIso = new Date(Date.now() - since_days * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch OHLCV data from PostgreSQL
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    await pool.connect();
    
    console.log(`🔍 Fetching OHLCV data for ${detectedSymbol}`);
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
        g.rsi, g.ma_5, g.ma_20, g.ma_50, g.ma_200,
        g.ema_20, g.ema_50, g.ema_200, g.macd_line, g.macd_signal, g.macd_histogram,
        g.vwap, g.atr,
        g.volume_trend, g.volume_price_relationship
      FROM gold_ohlcv_daily_metrics g
      LEFT JOIN company_info_cache c ON g.symbol = c.symbol
      WHERE g.symbol = $1
      ORDER BY g.date DESC
      LIMIT 1
    `;
    
    const result = await pool.query(sqlQuery, [detectedSymbol]);
    await pool.end();
    
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: `No data found for symbol ${detectedSymbol}`,
        symbol: detectedSymbol
      }, { status: 404 });
    }
    
    const row = result.rows[0];
    console.log(`✅ Found data for ${detectedSymbol}: ${row.date}`);
    
    // Prepare OHLCV data
    const currentPrice = row.close;
    const bars = {
      open: [row.open],
      high: [row.high], 
      low: [row.low],
      close: [row.close],
      volume: [row.volume]
    };
    
    // Calculate price data
    const priceData = {
      current: currentPrice,
      previous: currentPrice, // For now, use same price
      change: 0,
      changePercent: 0,
      date: row.date
    };
    
    // Prepare technical indicators
    const indicators = {
      rsi: row.rsi,
      ma_5: row.ma_5,
      ma_20: row.ma_20,
      ma_50: row.ma_50,
      ma_200: row.ma_200,
      ema_20: row.ema_20,
      ema_50: row.ema_50,
      ema_200: row.ema_200,
      macd_line: row.macd_line,
      macd_signal: row.macd_signal,
      macd_histogram: row.macd_histogram,
      vwap: row.vwap,
      atr: row.atr,
      volume_trend: row.volume_trend,
      volume_price_relationship: row.volume_price_relationship
    };
    
    // Search for news
    let newsAnalysis = {
      rationale: [`No recent news found for ${detectedSymbol}`],
      citations: []
    };
    
    try {
      const hits = await searchAndRerankNewsStrict(detectedSymbol, query, sinceIso);
      if (hits.length > 0) {
        newsAnalysis = {
          rationale: hits.slice(0, 3).map(h => h.title || "News article"),
          citations: hits.slice(0, 3).map(h => h.url).filter(Boolean)
        };
      }
    } catch (error: any) {
      console.warn("News search failed:", error.message);
    }
    
    // Generate AI analysis
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const prompt = generateReportPrompt({
      symbol: detectedSymbol,
      timeframe,
      query,
      bars,
      indicators,
      newsAnalysis
    });
    
    console.log(`🤖 Generating AI analysis for ${detectedSymbol}`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.7
    });
    
    const aiResponse = completion.choices[0].message.content || "";
    console.log(`✅ AI analysis completed for ${detectedSymbol}`);
    
    // Parse AI response
    let agentResponse;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        agentResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      agentResponse = {
        header: {
          name: row.company_name || detectedSymbol,
          market: row.market || "Unknown",
          type: row.stock_type || "Stock",
          exchange: row.primary_exchange || "Unknown",
          currency: row.currency || "USD",
          employees: row.total_employees,
          description: row.description || `Analysis for ${detectedSymbol}`
        },
        news: {
          sentiment: "neutral" as const,
          key_points: newsAnalysis.rationale,
          analysis: "News analysis unavailable",
          sources: newsAnalysis.citations,
          status: "Balanced" as const,
          no_data: newsAnalysis.rationale.length === 0
        },
        technical: {
          sentiment: "neutral" as const,
          key_points: ["Technical analysis completed"],
          analysis: "Technical indicators processed",
          indicators: indicators
        },
        portfolio: {
          size_suggestion_pct: 5
        }
      };
    }
    
    // Validate response
    const validatedResponse = AgentReportSchema.parse(agentResponse);
    
    // Add price data
    const responseData = {
      ...validatedResponse,
      price: priceData
    };
    
    console.log(`🎉 Analysis completed successfully for ${detectedSymbol}`);
    return NextResponse.json(responseData);
    
  } catch (error: any) {
    console.error("❌ Analysis error:", error.message);
    return NextResponse.json({ 
      error: "Failed to analyze data",
      details: error.message,
      symbol: req.body?.symbol || "unknown"
    }, { status: 500 });
  }
}
