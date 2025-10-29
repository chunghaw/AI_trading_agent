import OpenAI from "openai";

// Milvus REST API configuration
const MILVUS_CONFIG = {
  uri: process.env.MILVUS_URI || process.env.MILVUS_ADDRESS || "localhost:19530",
  user: process.env.MILVUS_USER || process.env.MILVUS_USERNAME || "",
  password: process.env.MILVUS_PASSWORD || "",
  // Force correct collection name - was causing 500 errors on Vercel with old "news_chunks" value
  collection: "polygon_news_data"
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
// Debug Milvus configuration
console.log("🔍 Milvus Config Debug:", {
  uri: MILVUS_CONFIG.uri,
  user: MILVUS_CONFIG.user,
  hasPassword: !!MILVUS_CONFIG.password,
  passwordLength: MILVUS_CONFIG.password?.length || 0,
  collection: MILVUS_CONFIG.collection
});

// REST API helper functions
async function milvusRequest(endpoint: string, method: string = 'GET', body?: any) {
  // Milvus serverless uses different API format - don't add /v1 prefix
  const url = `${MILVUS_CONFIG.uri}${endpoint}`;
  const headers: any = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  // Add authentication for Milvus serverless (Bearer token with username:password)
  if (MILVUS_CONFIG.user && MILVUS_CONFIG.password) {
    headers['Authorization'] = `Bearer ${MILVUS_CONFIG.user}:${MILVUS_CONFIG.password}`;
  }
  
  console.log(`🔍 Making Milvus request to: ${url}`);
  console.log(`🔍 Headers:`, { ...headers, Authorization: headers.Authorization ? 'Bearer [HIDDEN]' : 'None' });
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Milvus API error: ${response.status} ${response.statusText}`);
      console.error(`❌ Error details:`, errorText);
      throw new Error(`Milvus API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Milvus request failed:`, error);
    throw error;
  }
}

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
    console.log(`🔍 News Search Debug - Symbol: ${symbol}, Embed Query: ${embedQuery}, Since: ${sinceIso}`);
    
    // Pure JavaScript implementation - NO Python dependency
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
        const keywordBlob = String((h as any).keywords || "").toLowerCase();
        const hasAnyText = textBlob.trim().length > 0;
        const symLower = normalizedSymbol.toLowerCase();
        const symAltLower = normalizedSymbol.replace(".", "").toLowerCase();
        const tickerList = (() => {
          if (Array.isArray(h.tickers)) {
            return h.tickers.map((t: any) => String(t || "").trim().toUpperCase()).filter(Boolean);
          }
          if (typeof h.tickers === "string") {
            return h.tickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
          }
          return [] as string[];
        })();
        const hasTickerInText =
          textBlob.includes(symLower) ||
          (!!symAltLower && textBlob.includes(symAltLower));
        const hasTickerInKeywords =
          keywordBlob.includes(symLower) ||
          (!!symAltLower && keywordBlob.includes(symAltLower));
        const hasCompanyInText = companyTerms.some(term => term && textBlob.includes(term));
        const queryMatches = originalQueryTerms.reduce((sum, term) => sum + (term && textBlob.includes(term) ? 1 : 0), 0);
        const hasQueryMatch = queryMatches > 0;
        const symbolMatchCount = tickerList.filter(t => t === normalizedSymbol).length;
        const foreignTickerCount = tickerList.filter(t => t && t !== normalizedSymbol).length;
        const keywordTickerList = keywordBlob
          .split(/[^a-z0-9]+/)
          .map(t => t.trim().toUpperCase())
          .filter(Boolean);
        const foreignKeywordCount = keywordTickerList.filter(t => t && t !== normalizedSymbol).length;
        const totalSymbolRefs = symbolMatchCount + (hasTickerInText ? 1 : 0);
        const totalForeignRefs = foreignTickerCount + foreignKeywordCount;
        const totalRefs = totalSymbolRefs + totalForeignRefs;
        const symbolFocusRatio = totalRefs > 0
          ? totalSymbolRefs / totalRefs
          : (hasTickerInText ? 1 : 0);

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
            symbolMatchCount,
            foreignTickerCount,
            foreignKeywordCount,
            totalRefs,
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
    console.log(`🔍 Searching Milvus collection: ${MILVUS_CONFIG.collection} for symbol: ${symbol}`);
    
    // Check if we have proper Milvus configuration
    if (!MILVUS_CONFIG.uri || MILVUS_CONFIG.uri === "localhost:19530") {
      console.warn("⚠️ Milvus URI not properly configured, skipping news search");
      return [];
    }
    
    if (!MILVUS_CONFIG.password) {
      console.warn("⚠️ MILVUS_PASSWORD not set, skipping news search");
      return [];
    }
    
    if (!MILVUS_CONFIG.collection) {
      console.warn("⚠️ Milvus collection not specified, using default");
      MILVUS_CONFIG.collection = "polygon_news_data";
    }
    
    console.log("✅ Milvus configuration looks good, attempting search...");
    
    // Try to search Milvus collection
    try {
      // First, list all collections using the correct Milvus serverless endpoint
      const collections = await milvusRequest('/v2/vectordb/collections/list', 'POST', {});
      
      console.log(`✅ Collections list:`, collections);
      
      // Latest Zilliz/Milvus serverless nests collections under data.collections.
      const availableCollections = (() => {
        const raw = collections?.data;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.collections)) return raw.collections;
        if (Array.isArray(raw?.collection_names)) return raw.collection_names;
        if (Array.isArray(raw?.data)) return raw.data;
        return [];
      })();

      const normalizedNames = availableCollections.map((c: any) => {
        if (typeof c === "string") return c;
        return c?.collectionName || c?.name || "";
      }).filter(Boolean);
      
      const collectionExists = normalizedNames.includes(MILVUS_CONFIG.collection);
      
      if (!collectionExists) {
        console.warn(`⚠️ Collection '${MILVUS_CONFIG.collection}' not found in available collections`);
        console.log(`📋 Available collections:`, normalizedNames);
        return [];
      }
      
      console.log(`✅ Collection '${MILVUS_CONFIG.collection}' found!`);
      
      // Get collection info using describe endpoint
      const collectionInfo = await milvusRequest('/v2/vectordb/collections/describe', 'POST', {
        collectionName: MILVUS_CONFIG.collection
      });
      
      console.log(`✅ Collection info:`, collectionInfo);
      
      // Use the symbol directly (passed from the API call)
      const tickerSymbol = symbol;
      console.log(`🔍 Using ticker symbol: ${tickerSymbol}`);
      
      // Use the CORRECT Milvus REST API endpoints that actually work!
      console.log(`🔍 Using Milvus vector search for: ${tickerSymbol}`);
      
      try {
        // Generate an embedding vector for the query (fallback to dummy if embedding fails)
        let queryVector: number[] | null = null;
        if (openai) {
          try {
            const embedInput = [tickerSymbol, userQuery].filter(Boolean).join(" ").trim();
            const embedding = await openai.embeddings.create({
              model: EMBED,
              input: embedInput || tickerSymbol
            });
            const vec = embedding.data?.[0]?.embedding;
            if (Array.isArray(vec) && vec.length > 0) {
              queryVector = vec as number[];
            }
            console.log(`✅ Generated embedding using OpenAI for query: "${embedInput || tickerSymbol}"`);
          } catch (embedError) {
            console.error("⚠️ Failed to generate embedding via OpenAI, falling back to dummy vector:", embedError);
          }
        } else {
          console.warn("⚠️ OPENAI_API_KEY not set; falling back to dummy vector for search ranking.");
        }

        if (!queryVector) {
          queryVector = new Array(1536).fill(0.1);
        }
        
        // Build Milvus filter to ensure we only retrieve rows for this ticker/time window
        const filterClauses: string[] = [`ticker == "${tickerSymbol}"`];
        if (sinceIso) {
          filterClauses.push(`published_utc >= "${sinceIso}"`);
        }
        const filter = filterClauses.join(" && ");
        
        // Use the working search endpoint
        const searchResults = await milvusRequest('/v1/vector/search', 'POST', {
          collectionName: MILVUS_CONFIG.collection,
          vector: queryVector,
          limit: 20,
          outputFields: ["*"],
          filter
        });
        
        console.log(`📊 Milvus search results:`, searchResults);
        
        const successCode = searchResults?.code ?? searchResults?.status?.code;
        const resultRows = (() => {
          if (Array.isArray(searchResults?.data)) return searchResults.data;
          if (Array.isArray(searchResults?.data?.results)) return searchResults.data.results;
          if (Array.isArray(searchResults?.data?.data)) return searchResults.data.data;
          return [];
        })();
        const isSuccess = resultRows.length > 0 || successCode === 0 || successCode === 200;
        
        if (isSuccess && resultRows.length > 0) {
          console.log(`✅ Found ${resultRows.length} news articles`);
          
          // Filter results by ticker symbol (and shared tickers string)
          const tickerResults = resultRows.filter((article: any) => {
            if (article.ticker && String(article.ticker).toUpperCase() === tickerSymbol.toUpperCase()) {
              return true;
            }
            if (typeof article.tickers === "string") {
              return article.tickers.split(",").map((t: string) => t.trim().toUpperCase()).includes(tickerSymbol.toUpperCase());
            }
            if (Array.isArray(article.tickers)) {
              return article.tickers.map((t: any) => String(t).toUpperCase()).includes(tickerSymbol.toUpperCase());
            }
            return false;
          });
          
          if (tickerResults.length > 0) {
            const symbolLower = tickerSymbol.toLowerCase();
            const userTerms = (userQuery || "")
              .toLowerCase()
              .split(/[^a-z0-9]+/i)
              .filter(term => term && term.length > 2);
            
            const mentionResults = tickerResults.filter((article: any) => {
              const textBlob = [
                article.title,
                article.text,
                article.content,
                article.description
              ].map(v => String(v || "")).join(" ").toLowerCase();
              
              if (!textBlob) return false;
              if (textBlob.includes(symbolLower)) return true;
              
              const companyName = String(article.company_name || article.company || "").toLowerCase();
              if (companyName && textBlob.includes(companyName)) return true;
              
              for (const term of userTerms) {
                if (textBlob.includes(term)) return true;
              }
              return false;
            });

            const resultsToUse = mentionResults.length > 0 ? mentionResults : tickerResults;
            if (mentionResults.length === 0) {
              console.log(`⚠️ No matching text mention for ${tickerSymbol}; falling back to ticker-filtered results (${tickerResults.length})`);
            }

            console.log(`✅ Filtered to ${resultsToUse.length} articles for ${tickerSymbol}`);
            
            // Transform results to expected format
            const transformedResults = resultsToUse.map((article: any, index: number) => ({
              id: article.id || article.article_id || `news_${index}`,
              title: article.title || '',
              text: article.text || '',
              url: article.url || '',
              source: article.source || '',
              ticker: article.ticker || tickerSymbol,
              published_utc: article.published_utc || '',
              sentiment: article.sentiment || 'neutral',
              keywords: article.keywords || '',
              score: 1 - (article.distance || 0), // Convert distance to score
              relevance: 1 - (article.distance || 0)
            }));
            
            console.log(`✅ Returning ${transformedResults.length} transformed news articles`);
            return transformedResults;
          }
          
          console.log(`⚠️ Vector search results did not contain ticker ${tickerSymbol}.`);
        }
        
        console.log(`⚠️ No search results found from vector search. Trying scalar query fallback.`);
        
        const queryPayload: any = {
          collectionName: MILVUS_CONFIG.collection,
          filter: `ticker == "${tickerSymbol}"`,
          limit: 50,
          outputFields: ["*"]
        };
        if (sinceIso) {
          queryPayload.filter += ` && published_utc >= "${sinceIso}"`;
        }
        
        const fallback = await milvusRequest('/v1/vector/query', 'POST', queryPayload);
        const fallbackRows: any[] = Array.isArray(fallback?.data) ? fallback.data : [];
        console.log(`🔍 Fallback query returned ${fallbackRows.length} rows.`);

        const filteredFallback = fallbackRows.filter((article: any) => {
          const textBlob = [
            article.title,
            article.text,
            article.content,
            article.description
          ].map(v => String(v || "")).join(" ").toLowerCase();
          if (!textBlob) return false;
          if (textBlob.includes(tickerSymbol.toLowerCase())) return true;
          const companyName = String(article.company_name || article.company || "").toLowerCase();
          if (companyName && textBlob.includes(companyName)) return true;
          const terms = (userQuery || "")
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(term => term && term.length > 2);
          for (const term of terms) {
            if (textBlob.includes(term)) return true;
          }
          return false;
        });

        const fallbackToUse = filteredFallback.length > 0 ? filteredFallback : fallbackRows;
        if (filteredFallback.length === 0 && fallbackRows.length > 0) {
          console.log(`⚠️ Fallback results lacked explicit mentions; returning ${fallbackRows.length} ticker matches.`);
        }
        
        return fallbackToUse.map((article: any, index: number) => ({
          id: article.id || article.article_id || `news_${index}`,
          title: article.title || '',
          text: article.text || '',
          url: article.url || '',
          source: article.source || '',
          ticker: article.ticker || tickerSymbol,
          published_utc: article.published_utc || '',
          sentiment: article.sentiment || 'neutral',
          keywords: article.keywords || '',
          score: 1 - (article.distance || 0),
          relevance: 1 - (article.distance || 0)
        }));
        
      } catch (searchError) {
        console.error(`❌ Milvus search error:`, searchError);
        return [];
      }
      
    } catch (milvusError) {
      console.error("❌ Milvus API error:", milvusError);
      return [];
    }
    
  } catch (error) {
    console.error("❌ Error in getRealNewsData:", error);
    return [];
  }
}
