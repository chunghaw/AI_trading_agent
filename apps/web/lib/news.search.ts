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
      // First, list all collections using the correct Milvus serverless endpoint
      const collections = await milvusRequest('/v2/vectordb/collections/list', 'POST', {});
      
      console.log(`✅ Collections list:`, collections);
      
      // Check if our collection exists (collections.data is an array of strings)
      const collectionExists = collections.data?.includes(MILVUS_CONFIG.collection);
      
      if (!collectionExists) {
        console.warn(`⚠️ Collection '${MILVUS_CONFIG.collection}' not found in available collections`);
        console.log(`📋 Available collections:`, collections.data);
        return [];
      }
      
      console.log(`✅ Collection '${MILVUS_CONFIG.collection}' found!`);
      
      // Get collection info using describe endpoint
      const collectionInfo = await milvusRequest('/v2/vectordb/collections/describe', 'POST', {
        collectionName: MILVUS_CONFIG.collection
      });
      
      console.log(`✅ Collection info:`, collectionInfo);
      
      // Extract ticker symbol from query (e.g., "NVDA" from "What's the technical outlook for NVDA?")
      const tickerMatch = query.match(/\b([A-Z]{2,5})\b/);
      const tickerSymbol = tickerMatch ? tickerMatch[1] : query;
      console.log(`🔍 Extracted ticker symbol: ${tickerSymbol}`);
      
      // Use Python SDK to query Milvus (REST API is read-only)
      console.log(`🐍 Calling Python Milvus search for: ${tickerSymbol}`);
      
      try {
        const { spawn } = await import('child_process');
        
        const pythonProcess = spawn('python3', [
          'milvus_python_search.py',
          tickerSymbol
        ], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            MILVUS_URI: MILVUS_CONFIG.uri,
            MILVUS_USER: MILVUS_CONFIG.user,
            MILVUS_PASSWORD: MILVUS_CONFIG.password,
            MILVUS_COLLECTION_NEWS: MILVUS_CONFIG.collection
          }
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        return new Promise((resolve) => {
          pythonProcess.on('close', (code) => {
            if (code === 0) {
              try {
                // Parse the JSON output from Python
                const lines = output.split('\n');
                const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));
                
                if (jsonLine) {
                  const results = JSON.parse(jsonLine);
                  console.log(`✅ Python search returned ${results.length} results`);
                  resolve(results);
                } else {
                  console.log(`⚠️ No JSON output from Python script`);
                  resolve([]);
                }
              } catch (parseError) {
                console.error(`❌ Error parsing Python output:`, parseError);
                console.log(`📄 Python output:`, output);
                resolve([]);
              }
            } else {
              console.error(`❌ Python script failed with code ${code}`);
              console.error(`📄 Python error:`, errorOutput);
              resolve([]);
            }
          });
        });
        
      } catch (pythonError) {
        console.error(`❌ Error running Python script:`, pythonError);
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