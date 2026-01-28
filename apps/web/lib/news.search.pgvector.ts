import OpenAI from "openai";
import { Client } from "pg";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const EMBED = "text-embedding-3-small";
const RECALL_K = 20;

function safeRecencyWeight(iso?: string): number {
  if (!iso) return 1.0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 1.0;
  const days = Math.max(0, (Date.now() - t) / 86_400_000);
  return Math.exp(-days / 14);
}

function host(u?: string) {
  try { return u ? new URL(u).hostname.replace(/^www\./, "") : ""; } catch { return ""; }
}

type NewsSearchOptions = {
  originalQuery?: string;
  companyName?: string;
};

export async function searchAndRerankNewsStrict(
  symbol: string,
  embedQuery: string,
  sinceIso: string,
  options: NewsSearchOptions = {}
) {
  try {
    console.log(`🔍 News Search (pgvector) - Symbol: ${symbol}, Query: ${embedQuery}, Since: ${sinceIso}`);
    
    const hits = await getRealNewsData(symbol, embedQuery, sinceIso);
    
    if (hits.length === 0) {
      console.warn(`No news found for ${symbol} since ${sinceIso}.`);
      return [];
    }

    const GOOD = new Set([
      "reuters.com","bloomberg.com","cnbc.com","marketwatch.com",
      "finance.yahoo.com","fool.com","investing.com","benzinga.com"
    ]);

    const normalizedSymbol = symbol.trim().toUpperCase();
    const originalQuery = options.originalQuery ?? "";
    const originalQueryTerms = Array.from(
      new Set(
        `${symbol} ${originalQuery}`
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .map(t => t.trim())
          .filter(t => t.length > 2)
      )
    );
    const companyTerms = Array.from(
      new Set(
        (options.companyName ?? "")
          .toLowerCase()
          .replace(/[.,]/g, " ")
          .split(/\s+/)
          .map(t => t.trim())
          .filter(t => t.length > 2)
      )
    );

    const seenUrl = new Set<string>(), seenDom = new Set<string>();
    const reranked = hits
      .map(h => {
        const d = host(h.url);
        const textParts = [
          h.title,
          h.text,
          (h as any).description,
          (h as any).content
        ].map(v => String(v || ""));
        const textBlobRaw = textParts.join(" ");
        const textBlob = textBlobRaw.toLowerCase();
        const textUpper = textBlobRaw.toUpperCase();
        const keywordBlob = String((h as any).keywords || "").toLowerCase();
        const hasAnyText = textBlob.trim().length > 0;
        const symLower = normalizedSymbol.toLowerCase();
        const symUpper = normalizedSymbol.toUpperCase();
        const symAltLower = normalizedSymbol.replace(".", "").toLowerCase();
        const symAltUpper = normalizedSymbol.replace(".", "").toUpperCase();
        const tickerList: string[] = (() => {
          if (Array.isArray(h.tickers)) {
            return (h.tickers as any[]).map((t: any) => String(t || "").trim().toUpperCase()).filter(Boolean);
          }
          if (typeof h.tickers === "string") {
            return h.tickers.split(",").map((t: string) => t.trim().toUpperCase()).filter(Boolean);
          }
          return [];
        })();
        const hasTickerInText =
          textBlob.includes(symLower) ||
          (!!symAltLower && textBlob.includes(symAltLower));
        const hasTickerInKeywords =
          keywordBlob.includes(symLower) ||
          (!!symAltLower && keywordBlob.includes(symAltLower));
        const hasCompanyInText = companyTerms.some(term => term && textBlob.includes(term));
        const queryMatches = originalQueryTerms.reduce((sum: number, term: string) => sum + (term && textBlob.includes(term) ? 1 : 0), 0);
        const hasQueryMatch = queryMatches > 0;
        const keywordTickerList: string[] = keywordBlob
          .split(/[^a-z0-9]+/)
          .map((t: string) => t.trim().toUpperCase())
          .filter(Boolean);

        const countOccurrences = (source: string, token: string) => {
          if (!token) return 0;
          const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(`\\b${escaped}\\b`, "g");
          return source.match(regex)?.length ?? 0;
        };

        const symbolRefCount =
          countOccurrences(textUpper, symUpper) +
          (symAltUpper !== symUpper ? countOccurrences(textUpper, symAltUpper) : 0) +
          companyTerms.reduce((sum: number, term: string) => sum + countOccurrences(textBlob, term), 0);

        const foreignTickerTextCount = tickerList
          .filter((t: string) => t && t !== normalizedSymbol)
          .reduce((sum: number, t: string) => sum + countOccurrences(textUpper, t), 0);

        const foreignKeywordTextCount = keywordTickerList
          .filter((t: string) => t && t !== normalizedSymbol)
          .reduce((sum: number, t: string) => sum + countOccurrences(textUpper, t), 0);

        const totalSymbolRefs = Math.max(symbolRefCount, hasTickerInText ? 1 : 0);
        const totalForeignRefs = foreignTickerTextCount + foreignKeywordTextCount;
        const symbolFocusRatio = totalForeignRefs > 0
          ? totalSymbolRefs / Math.max(1, totalSymbolRefs + totalForeignRefs)
          : 1.0;

        const mentionWeight = hasTickerInText
          ? 1.5
          : hasCompanyInText
            ? 1.2
            : hasTickerInKeywords
              ? 0.6
            : hasQueryMatch
              ? 0.4 + Math.min(queryMatches, 3) * 0.05
              : 0.0;
        const crossTickerFactor = totalForeignRefs > 0
          ? Math.max(0.25, symbolFocusRatio)
          : 1.0;
        const wRec = safeRecencyWeight(String(h.published_utc));
        const wSym =
          (String(h.ticker || "").toUpperCase() === symbol.toUpperCase()) ||
          (String(h.tickers || "").toUpperCase().split(",").includes(symbol.toUpperCase()))
            ? 1.05 : 1.0;
        const wDom = GOOD.has(d) ? 1.1 : 1.0;
        const base = Number.isFinite(h.score) ? Number(h.score) : 0;
        const adjScore =
          base *
          wRec *
          wSym *
          wDom *
          (mentionWeight > 0 ? mentionWeight : 0.01) *
          crossTickerFactor;
        return {
          ...h,
          domain: d,
          finalScore: adjScore,
          _mentionDebug: {
            hasAnyText,
            hasTickerInText,
            hasTickerInKeywords,
            hasCompanyInText,
            hasQueryMatch,
            mentionWeight,
            queryMatches,
            symbolRefCount,
            foreignTickerTextCount,
            foreignKeywordTextCount,
            symbolFocusRatio,
            crossTickerFactor,
            base,
            wRec,
            wSym,
            wDom
          }
        };
      })
      .sort((a,b)=> (b.finalScore ?? 0) - (a.finalScore ?? 0))
      .filter(h => {
        const dbg = (h as any)._mentionDebug ?? {};
        if (!dbg.hasAnyText) return false;
        if (!(dbg.hasTickerInText || dbg.hasCompanyInText)) return false;
        if ((dbg.mentionWeight ?? 0) <= 0) return false;
        if (!h.url || seenUrl.has(h.url)) return false;
        if (h.domain && seenDom.has(h.domain)) return false;
        seenUrl.add(h.url); if (h.domain) seenDom.add(h.domain);
        return true;
      })
      .slice(0, 20);

    console.log(`🔍 Debug - Final reranked results: ${reranked.length} hits`);
    return reranked.map(h => ({
      text: String(h.text ?? ""),
      url: String(h.url ?? ""),
      title: String(h.title ?? ""),
      published_utc: String(h.published_utc ?? ""),
      score: Number(h.finalScore ?? 0)
    }));
  } catch (error) {
    console.error("News search error:", error);
    return [];
  }
}

async function getRealNewsData(symbol: string, userQuery: string, sinceIso?: string): Promise<any[]> {
  try {
    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) {
      console.warn("⚠️ POSTGRES_URL not set, skipping news search");
      return [];
    }

    // Generate embedding for query
    let queryVector: number[] | null = null;
    if (openai) {
      try {
        const embedInput = [symbol, userQuery].filter(Boolean).join(" ").trim();
        const embedding = await openai.embeddings.create({
          model: EMBED,
          input: embedInput || symbol
        });
        queryVector = embedding.data[0].embedding as number[];
        console.log(`✅ Generated embedding for query: "${embedInput || symbol}"`);
      } catch (embedError) {
        console.error("⚠️ Failed to generate embedding:", embedError);
        return [];
      }
    } else {
      console.warn("⚠️ OPENAI_API_KEY not set");
      return [];
    }

    // Connect to Postgres and search
    const client = new Client({ connectionString: POSTGRES_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    try {
      // Build query with vector similarity search
      const tickerSymbol = symbol.toUpperCase();
      // Convert vector array to pgvector format string
      const vectorStr = `[${queryVector.join(",")}]`;
      
      let query = `
        SELECT 
          id, title, text, url, source, ticker, tickers, 
          published_utc, sentiment, keywords, article_id,
          1 - (embedding <=> $1::vector) as similarity
        FROM news_articles
        WHERE ticker = $2
      `;
      const params: any[] = [vectorStr, tickerSymbol];
      
      if (sinceIso) {
        query += ` AND published_utc >= $3`;
        params.push(sinceIso);
      }
      
      query += ` ORDER BY embedding <=> $1::vector LIMIT 20`;
      
      const result = await client.query(query, params);
      
      const articles = result.rows.map((row: any) => ({
        id: row.id,
        title: row.title || '',
        text: row.text || '',
        url: row.url || '',
        source: row.source || '',
        ticker: row.ticker || tickerSymbol,
        tickers: row.tickers || '',
        published_utc: row.published_utc ? new Date(row.published_utc).toISOString() : '',
        sentiment: row.sentiment || 'neutral',
        keywords: row.keywords || '',
        score: row.similarity || 0,
        relevance: row.similarity || 0
      }));

      console.log(`✅ Found ${articles.length} news articles for ${tickerSymbol}`);
      return articles;
    } finally {
      await client.end();
    }
  } catch (error: any) {
    console.error("❌ Error in getRealNewsData:", error);
    return [];
  }
}
