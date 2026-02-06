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
  Price: $${features.price.toFixed(2)}
  SMA50: ${features.sma50?.toFixed(2) || "N/A"}
  SMA200: ${features.sma200?.toFixed(2) || "N/A"}
  RSI: ${features.rsi?.toFixed(2) || "N/A"}
  MACD: ${features.macd?.toFixed(3) || "N/A"} (Signal: ${features.macd_signal?.toFixed(3) || "N/A"})
  Trend: ${features.trend_flag ? "Strong Uptrend" : "Neutral/Weak"}
  Breakout: ${features.breakout_flag ? "Yes" : "No"}
  Momentum: ${features.momentum_flag ? "Positive" : "Negative"}
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
  1. Analyze the Technical Structure first (Trend, Momentum, Moving Averages).
  2. Use News to Identify Catalysts/Risks that support or contradict the technicals.
  3. Determine a recommendation (Strong Buy, Buy, Hold, Sell, Strong Sell).
  4. Write a 3-sentence technical thesis.
  5. Provide a specific action plan (e.g., "Buy on pullback to moving average").

  LOGIC RULES:
  - STRONG BUY: Strong Uptrend + Breakout + Positive/Neutral News.
  - BUY: Uptrend + Pullback/Support Hold + No Positive News (or at least no Negative). 
  - HOLD: Neutral Trend OR Conflicting Signals (e.g., Bullish Techs but Bad News).
  - SELL: Downtrend + Breakdown OR Negative News.
  - STRONG SELL: Strong Downtrend + Negative News.

  Return JSON only.
  
  OUTPUT FORMAT:
  {
    "tone": "positive" | "neutral" | "negative",
    "newsScore": -20 to 20,
    "catalysts": [{"label": "...", "evidence_urls": ["..."]}],
    "risks": [{"label": "...", "evidence_urls": ["..."]}],
    "earnings_or_events": [{"label": "...", "date": "YYYY-MM-DD", "evidence_urls": ["..."]}],
    "one_sentence_thesis": "Concise thesis.",
    "recommendation": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
    "confidence": "High" | "Medium" | "Low",
    "action_plan": "Short actionable advice."
  }`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Using full model for better reasoning
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "You are a disciplined financial analyst. Output valid JSON.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("Empty response");

        const parsed = JSON.parse(content);

        return {
            summary: {
                tone: ["positive", "neutral", "negative"].includes(parsed.tone) ? parsed.tone : "neutral",
                newsScore: Math.min(20, Math.max(-20, Number(parsed.newsScore) || 0)),
                catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts : [],
                risks: Array.isArray(parsed.risks) ? parsed.risks : [],
                earnings_or_events: Array.isArray(parsed.earnings_or_events) ? parsed.earnings_or_events : [],
                one_sentence_thesis: parsed.one_sentence_thesis || "Analysis complete.",
                recommendation: parsed.recommendation || "Hold",
                confidence: parsed.confidence || "Medium",
                action_plan: parsed.action_plan || "Monitor for setup.",
            },
            citations,
        };
    } catch (error) {
        console.error(`Error analyzing candidate ${ticker}:`, error);
        return {
            summary: {
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
