import OpenAI from "openai";
import { searchAndRerankNewsStrict } from "../news.search.pgvector";
import { NewsArticle, NewsSummary } from "../screen.schemas";
import dayjs from "dayjs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * Query Postgres (pgvector) for ticker-specific news
 * Reuses existing news.search.pgvector.ts implementation
 */
const TICKER_TO_NAME: Record<string, string> = {
  "AAPL": "Apple",
  "MSFT": "Microsoft",
  "NVDA": "Nvidia",
  "GOOGL": "Alphabet",
  "GOOG": "Alphabet",
  "AMZN": "Amazon",
  "META": "Meta",
  "TSLA": "Tesla",
  "AMD": "Advanced Micro Devices",
  "SPY": "S&P 500",
  "QQQ": "Nasdaq",
  "IWM": "Russell 2000",
  "NFLX": "Netflix",
  "INTC": "Intel",
  "BABA": "Alibaba",
};

export async function queryMilvus(
  ticker: string,
  daysBack: number = 7,
  topK: number = 20,
  companyName?: string
): Promise<NewsArticle[]> {
  const resolvedCompanyName = companyName || TICKER_TO_NAME[ticker.toUpperCase()] || undefined;
  try {
    const sinceIso = dayjs().subtract(daysBack, "day").toISOString();

    // Build query string for semantic search
    const query = `${ticker} stock news earnings guidance analyst`;

    // Use existing search function
    const results = await searchAndRerankNewsStrict(
      ticker,
      query,
      sinceIso,
      {
        originalQuery: query,
        companyName: resolvedCompanyName,
      }
    );

    // Transform to NewsArticle format
    const articles: NewsArticle[] = results.slice(0, topK).map((hit, index) => ({
      id: `milvus_${index}_${hit.url}`,
      title: hit.title || "News article",
      url: hit.url || "",
      text: hit.text || "",
      published_utc: hit.published_utc || dayjs().toISOString(),
      source: extractSource(hit.url),
      score: hit.score || 0,
    }));

    return articles;
  } catch (error: any) {
    console.error(`Error querying Postgres for ${ticker}:`, error);
    return [];
  }
}

/**
 * Summarize news articles using LLM with strict JSON output
 * Returns structured summary with tone, score, catalysts, risks, etc.
 */
export async function summarizeNews(
  ticker: string,
  articles: NewsArticle[]
): Promise<{ summary: NewsSummary; citations: string[] }> {
  if (articles.length === 0) {
    return {
      summary: {
        tone: "neutral",
        newsScore: 0,
        catalysts: [],
        risks: [],
        earnings_or_events: [],
        one_sentence_thesis: `No recent news found for ${ticker}.`,
      },
      citations: [],
    };
  }

  // Prepare article summaries for LLM
  const articleTexts = articles
    .slice(0, 10) // Limit to top 10 for token efficiency
    .map((article, idx) => {
      const snippet = article.text.substring(0, 500); // First 500 chars
      return `[Article ${idx + 1}]
Title: ${article.title}
URL: ${article.url}
Published: ${article.published_utc}
Content: ${snippet}...`;
    })
    .join("\n\n");

  const citations = articles.map((a) => a.url).filter(Boolean);

  const prompt = `You are a financial analyst summarizing news articles for stock ticker ${ticker}.

Analyze the following news articles and provide a structured summary. Focus on:
1. Overall sentiment (positive/neutral/negative)
2. Key catalysts (product launches, partnerships, earnings beats, upgrades, etc.)
3. Risks (downgrades, misses, regulatory issues, competition, etc.)
4. Earnings or events (upcoming earnings, conferences, product launches with dates)
5. One-sentence investment thesis

IMPORTANT RULES:
- Only use information from the provided articles
- Cite specific URLs for each catalyst/risk/event
- Be objective and factual
- If articles are mixed, reflect that in tone
- NewsScore: -20 (very negative) to +20 (very positive), 0 = neutral

Articles:
${articleTexts}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "tone": "positive" | "neutral" | "negative",
  "newsScore": -20 to 20,
  "catalysts": [
    {
      "label": "Brief description",
      "evidence_urls": ["url1", "url2"]
    }
  ],
  "risks": [
    {
      "label": "Brief description",
      "evidence_urls": ["url1"]
    }
  ],
  "earnings_or_events": [
    {
      "label": "Event description",
      "date": "YYYY-MM-DD or null",
      "evidence_urls": ["url1"]
    }
  ],
  "one_sentence_thesis": "One clear sentence summarizing the news impact"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a financial analyst. Return only valid JSON, no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw parseError;
      }
    }

    // Validate and normalize response
    const summary: NewsSummary = {
      tone: parsed.tone === "positive" || parsed.tone === "negative" ? parsed.tone : "neutral",
      newsScore: Math.max(-20, Math.min(20, Number(parsed.newsScore) || 0)),
      catalysts: Array.isArray(parsed.catalysts)
        ? parsed.catalysts.map((c: any) => ({
          label: String(c.label || ""),
          evidence_urls: Array.isArray(c.evidence_urls) ? c.evidence_urls.map(String) : [],
        }))
        : [],
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.map((r: any) => ({
          label: String(r.label || ""),
          evidence_urls: Array.isArray(r.evidence_urls) ? r.evidence_urls.map(String) : [],
        }))
        : [],
      earnings_or_events: Array.isArray(parsed.earnings_or_events)
        ? parsed.earnings_or_events.map((e: any) => ({
          label: String(e.label || ""),
          date: e.date ? String(e.date) : undefined,
          evidence_urls: Array.isArray(e.evidence_urls) ? e.evidence_urls.map(String) : [],
        }))
        : [],
      one_sentence_thesis: String(parsed.one_sentence_thesis || `News analysis for ${ticker}`),
    };

    return { summary, citations };
  } catch (error) {
    console.error(`Error summarizing news for ${ticker}:`, error);

    // Fallback: return neutral summary
    return {
      summary: {
        tone: "neutral",
        newsScore: 0,
        catalysts: [],
        risks: [],
        earnings_or_events: [],
        one_sentence_thesis: `Unable to analyze news for ${ticker} due to processing error.`,
      },
      citations,
    };
  }
}

/**
 * Extract source domain from URL
 */
function extractSource(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
