import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Milvus REST API configuration
const MILVUS_CONFIG = {
  uri: process.env.MILVUS_URI || process.env.MILVUS_ADDRESS || "localhost:19530",
  user: process.env.MILVUS_USER || process.env.MILVUS_USERNAME || "",
  password: process.env.MILVUS_PASSWORD || "",
  collection: process.env.MILVUS_COLLECTION_NEWS || "polygon_news_data"
};

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
    console.log(`🔧 Milvus Config Debug:`, {
      uri: MILVUS_CONFIG.uri,
      user: MILVUS_CONFIG.user,
      collection: MILVUS_CONFIG.collection
    });
    
    // Check if Milvus is configured
    if (!MILVUS_CONFIG.uri) {
      console.warn("⚠️ Milvus not configured. Skipping news search.");
      return [];
    }

    console.log(`🔍 News Search Debug - Creating embedding for: ${symbol} ${userQuery}`);
    const vec = await openai.embeddings.create({ 
      model: EMBED, 
      input: `${symbol} ${userQuery}`.trim() 
    });
    const qv = vec.data[0].embedding as number[];

    // Build search expression
    const clauses: string[] = [];
    clauses.push(`ticker == "${symbol.toUpperCase()}"`);
    if (sinceIso) {
      clauses.push(`published_utc >= "${sinceIso}"`);
    }
    const expr = clauses.join(" && ");
    console.log(`🔍 Debug - Search expression:`, expr);

    console.log(`🔍 News Search Debug - Searching Milvus with vector...`);
    const OUT_FIELDS = ["text","url","published_utc","tickers","ticker","title","source","sentiment"];
    
    const searchBody = {
      collection_name: MILVUS_CONFIG.collection,
      vector: qv,
      output_fields: OUT_FIELDS,
      metric_type: "COSINE",
      limit: RECALL_K,
      filter: expr,
      params: { nprobe: 16 }
    };

    const res = await milvusRequest('/vector/search', 'POST', searchBody);
    console.log(`🔍 News Search Debug - Search completed, found ${res?.results?.length || 0} hits`);

    const groups = res?.results ?? [];
    const hits: any[] = [];
    
    for (const g of groups) {
      if (g.fields_data && g.scores) {
        const fields = g.fields_data;
        const scores = g.scores;
        
        for (let i = 0; i < scores.length; i++) {
          const get = (key: string) => {
            const field = fields.find((f: any) => f.field_name === key);
            return field?.data?.[i] || "";
          };
          
          hits.push({
            text: get("text"),
            url: get("url"),
            published_utc: get("published_utc"),
            ticker: get("ticker"),
            tickers: get("tickers"),
            title: get("title"),
            source: get("source"),
            sentiment: get("sentiment"),
            score: scores[i] ?? 0
          });
        }
      }
    }

    if (hits.length === 0) {
      console.warn(`No news found in '${MILVUS_CONFIG.collection}' for ${symbol} since ${sinceIso}.`);
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
      .slice(0, 5);

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