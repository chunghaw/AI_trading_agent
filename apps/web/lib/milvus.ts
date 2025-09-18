import OpenAI from "openai";

const EMBED="text-embedding-3-small";
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

async function embed(q:string){ const r = await openai.embeddings.create({ model: EMBED, input: q }); return r.data[0].embedding as number[]; }

const SYN = (sym:string) => {
  const s = sym.toUpperCase();
  if (s==="GOOGL") return ["GOOGL","GOOG","Alphabet"];
  if (s==="META") return ["META","Facebook"];
  return [s];
};

export async function searchNews(symbol:string, query:string, sinceIso:string, k=12){
  try {
    console.log(`🔍 Searching Milvus collection: ${MILVUS_CONFIG.collection} for symbol: ${symbol}`);
    
    // Call our internal API endpoint that will handle Milvus connection
    const response = await fetch('/api/milvus-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol,
        query,
        sinceIso,
        k
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.warn(`⚠️ Milvus search failed: ${data.error}`);
      return [];
    }
    
    return data.results || [];
    
  } catch (error) {
    console.error(`❌ Milvus search failed for ${symbol}:`, error);
    // Return empty array instead of throwing to allow the app to continue
    return [];
  }
}
