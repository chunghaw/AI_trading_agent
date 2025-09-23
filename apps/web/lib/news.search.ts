// Removed OpenAI import - using pure JavaScript implementation

// Milvus REST API configuration
const MILVUS_CONFIG = {
  uri: process.env.MILVUS_URI || process.env.MILVUS_ADDRESS || "localhost:19530",
  user: process.env.MILVUS_USER || process.env.MILVUS_USERNAME || "",
  password: process.env.MILVUS_PASSWORD || "",
  collection: process.env.MILVUS_COLLECTION_NEWS || "polygon_news_data"
};

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
  const url = `${MILVUS_CONFIG.uri}/v1${endpoint}`;
  const headers: any = {
    'Content-Type': 'application/json',
  };
  
  // Add basic auth if credentials are provided
  if (MILVUS_CONFIG.user && MILVUS_CONFIG.password) {
    const auth = Buffer.from(`${MILVUS_CONFIG.user}:${MILVUS_CONFIG.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    throw new Error(`Milvus API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
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

export async function searchAndRerankNewsStrict(
  symbol: string,
  userQuery: string,
  sinceIso: string
) {
  try {
    console.log(`🔍 News Search Debug - Symbol: ${symbol}, Query: ${userQuery}, Since: ${sinceIso}`);
    
    // Pure JavaScript implementation - NO Python dependency
    const hits = await getRealNewsData(userQuery);
    
    if (hits.length === 0) {
      console.warn(`No news found for ${symbol} since ${sinceIso}.`);
      return [];
    }

    const GOOD = new Set([
      "reuters.com","bloomberg.com","cnbc.com","marketwatch.com",
      "finance.yahoo.com","fool.com","investing.com","benzinga.com"
    ]);

    const seenUrl = new Set<string>(), seenDom = new Set<string>();
    const reranked = hits
      .map(h => {
        const d = host(h.url);
        const wRec = safeRecencyWeight(String(h.published_utc));
        const wSym =
          (String(h.ticker || "").toUpperCase() === symbol.toUpperCase()) ||
          (String(h.tickers || "").toUpperCase().split(",").includes(symbol.toUpperCase()))
            ? 1.05 : 1.0;
        const wDom = GOOD.has(d) ? 1.1 : 1.0;
        const base = Number.isFinite(h.score) ? Number(h.score) : 0;
        return { ...h, domain: d, finalScore: base * wRec * wSym * wDom };
      })
      .sort((a,b)=> (b.finalScore ?? 0) - (a.finalScore ?? 0))
      .filter(h => {
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

async function getRealNewsData(query: string): Promise<any[]> {
  try {
    console.log(`🔍 Searching Milvus collection: ${MILVUS_CONFIG.collection} for query: ${query}`);
    
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
      // First, check if collection exists and get stats
      const stats = await milvusRequest('/vector/collections/stats', 'POST', {
        collectionName: MILVUS_CONFIG.collection
      });
      
      console.log(`✅ Collection stats:`, stats);
      
      // For now, return empty results since we need to implement vector search
      // This requires generating embeddings for the query first
      console.log("⚠️ Vector search not yet implemented - need OpenAI embeddings");
      console.log("⚠️ Returning empty results until vector search is implemented");
      return [];
      
    } catch (milvusError) {
      console.error("❌ Milvus API error:", milvusError);
      return [];
    }
    
  } catch (error) {
    console.error("❌ Error in getRealNewsData:", error);
    return [];
  }
}