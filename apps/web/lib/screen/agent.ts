import OpenAI from "openai";
import { TechnicalFeatures, NewsArticle, NewsSummary } from "../screen.schemas";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * AI Agent to analyze a candidate using both Technicals and News.
 * Returns a comprehensive summary including recommendation and action plan.
 */
export async function analyzeCandidate(
    ticker: string,
    features: TechnicalFeatures,
    articles: NewsArticle[]
): Promise<{ summary: NewsSummary; citations: string[] }> {
    const citations = articles.map((a) => a.url).filter(Boolean);

    // Fallback if no data
    if (articles.length === 0) {
        return {
            summary: {
                tone: "neutral",
                newsScore: 0,
                catalysts: [],
                risks: [],
                earnings_or_events: [],
                one_sentence_thesis: `No news found for ${ticker}.`,
                recommendation: "Hold",
                confidence: "Low",
                action_plan: "Wait for more data before making a decision.",
            },
            citations: [],
        };
    }

    // Prepare technical context
    const technicalContext = `
  Price: $${features.price?.toFixed(2) || "N/A"}
  VWAP: ${features.vwap ? "$" + features.vwap.toFixed(2) : "N/A"}
  Volume: ${features.volume ? features.volume.toLocaleString() : "N/A"}
  Order Flow: ${features.order_flow || "N/A"}
  Volume Trend: ${features.volume_trend || "N/A"}
  SMA50: ${features.sma50?.toFixed(2) || "N/A"}
  SMA200: ${features.sma200?.toFixed(2) || "N/A"}
  RSI: ${features.rsi?.toFixed(2) || "N/A"}
  Trend: ${features.trend_flag ? "Strong Uptrend" : "Neutral/Weak"}
  Breakout: ${features.breakout_flag ? "Yes" : "No"}
  Relative Vol: ${features.rvol?.toFixed(2) || "N/A"}x
  `;

    // Prepare news context
    const articleTexts = articles
        .slice(0, 7) // Top 7 relevant articles
        .map((article, idx) => {
            const snippet = article.text.substring(0, 400);
            return `[Article ${idx + 1}]
Title: ${article.title}
Date: ${article.published_utc.split("T")[0]}
Source: ${article.source}
Snippet: ${snippet}...`;
        })
        .join("\n\n");

    const prompt = `You are a Technical Trading Analyst. Your job is to analyze stock ${ticker} primarily based on the provided Technical Indicators, using News only as a secondary confirmation.

  TECHNICAL DATA:
  ${technicalContext}

  NEWS CONTEXT:
  ${articleTexts}

  TASK:
  1. Generate a brief 1-sentence descriptor (company_description) explaining what ${ticker} does, and identify its broad Industry.
  2. Analyze the Technical Structure first. Focus deeply on Strong Order Flow, current Price vs VWAP, Liquidity (Volume), and Oversold bounce potential (using RSI < 40).
  3. Use News to Identify Catalysts/Risks that support or contradict the technicals.
  4. Determine a recommendation (Strong Buy, Buy, Hold, Sell, Strong Sell).
  5. Write a 1-sentence quick thesis.
  6. Write a highly sophisticated, detailed thesis (3-4 clear paragraphs). Structure it as a deep-dive combining Technical Structure, News sentiment, and Catalyst/Risk impacts. Use professional financial analyst tone.
  7. Provide a specific action plan (e.g., "Buy on pullback to moving average").

  LOGIC RULES:
  - STRONG BUY: Strong Uptrend + Breakout + Positive/Neutral News.
  - BUY: Uptrend + Pullback/Support Hold + No Positive News (or at least no Negative). 
  - HOLD: Neutral Trend OR Conflicting Signals (e.g., Bullish Techs but Bad News).
  - SELL: Downtrend + Breakdown OR Negative News.
  - STRONG SELL: Strong Downtrend + Negative News.

  Return JSON only.
  
  OUTPUT FORMAT:
  {
    "company_description": "A 1-sentence outline of the company's core business.",
    "industry": "e.g., Software Infrastructure",
    "tone": "positive" | "neutral" | "negative",
    "newsScore": -20 to 20,
    "catalysts": [{"label": "...", "evidence_urls": ["..."]}],
    "risks": [{"label": "...", "evidence_urls": ["..."]}],
    "earnings_or_events": [{"label": "...", "date": "YYYY-MM-DD", "evidence_urls": ["..."]}],
    "one_sentence_thesis": "Concise thesis.",
    "detailed_thesis": "Multi-paragraph deep dive using \n\n to separate paragraphs.",
    "recommendation": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
    "confidence": "High" | "Medium" | "Low",
    "action_plan": "Short actionable advice."
  }`;

    try {
        // OPENAI HAS BEEN DISABLED FOR DEMO (API KEY EXPIRED / STORAGE LIMITS)
        const parsed = {
            company_description: `Demo Company Info for ${ticker}`,
            industry: "Demo Industry",
            tone: "positive",
            newsScore: 15,
            catalysts: [{ label: "Strong Technical Breakout", evidence_urls: [] }],
            risks: [{ label: "Market Volatility", evidence_urls: [] }],
            earnings_or_events: [],
            one_sentence_thesis: `This is a mock thesis for ${ticker} indicating a strong technical setup.`,
            detailed_thesis: `This is a highly sophisticated, detailed mock thesis for ${ticker}.\n\nIt combines Technical Structure, News sentiment, and Catalyst/Risk impacts.\n\n(AI Analysis is currently disabled for this demo version).`,
            recommendation: "Buy",
            confidence: "High",
            action_plan: "Buy on pullback to moving average."
        };

        return {
            summary: {
                company_description: parsed.company_description,
                industry: parsed.industry,
                tone: parsed.tone as "positive" | "neutral" | "negative",
                newsScore: parsed.newsScore,
                catalysts: parsed.catalysts,
                risks: parsed.risks,
                earnings_or_events: parsed.earnings_or_events,
                one_sentence_thesis: parsed.one_sentence_thesis,
                detailed_thesis: parsed.detailed_thesis,
                recommendation: parsed.recommendation as "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
                confidence: parsed.confidence as "High" | "Medium" | "Low",
                action_plan: parsed.action_plan,
            },
            citations,
        };
    } catch (error) {
        console.error(`Error analyzing candidate ${ticker}:`, error);
        return {
            summary: {
                company_description: "",
                industry: "Unknown",
                tone: "neutral",
                newsScore: 0,
                catalysts: [],
                risks: [],
                earnings_or_events: [],
                one_sentence_thesis: "Error performing AI analysis.",
                recommendation: "Hold",
                confidence: "Low",
                action_plan: "Manual review required.",
            },
            citations,
        };
    }
}
