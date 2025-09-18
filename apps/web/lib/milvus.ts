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
    console.log(`🔗 Milvus URI: ${MILVUS_CONFIG.uri}`);
    console.log(`👤 Milvus User: ${MILVUS_CONFIG.user}`);
    
    // Get embedding for the query
    const v = await embed(query);
    
    // Build filter expression
    const syms = SYN(symbol);
    const filter = `ticker in [${syms.map(s=>`"${s}"`).join(",")}] && published_utc >= "${sinceIso}"`;

    // Search using REST API
    const searchBody = {
      collection_name: MILVUS_CONFIG.collection,
      vector: v,
      output_fields: ["text","url","published_utc","ticker","source"],
      metric_type: "COSINE",
      limit: k,
      filter: filter,
      params: { ef: 128 }
    };

    const res = await milvusRequest('/vector/search', 'POST', searchBody);
    
    let out: any[] = [];
    if (res.results && res.results.length > 0) {
      for (const result of res.results) {
        if (result.fields_data) {
          const fields = result.fields_data;
          const scores = result.scores || [];
          
          for (let i = 0; i < scores.length; i++) {
            const get = (key: string) => {
              const field = fields.find((f: any) => f.field_name === key);
              return field?.data?.[i] || "";
            };
            
            out.push({
              title: get("source") || "News",
              url: get("url") || "",
              published_utc: get("published_utc") || "",
              snippet: String(get("text") || "").slice(0, 500),
            });
          }
        }
      }
    }

    // If no results, try a wider search (30 days)
    if (out.length === 0) {
      const d30 = new Date(Date.now() - 30 * 86400_000).toISOString();
      const widerFilter = `ticker in [${syms.map(s=>`"${s}"`).join(",")}] && published_utc >= "${d30}"`;
      
      const widerSearchBody = {
        ...searchBody,
        filter: widerFilter
      };
      
      const widerRes = await milvusRequest('/vector/search', 'POST', widerSearchBody);
      
      if (widerRes.results && widerRes.results.length > 0) {
        for (const result of widerRes.results) {
          if (result.fields_data) {
            const fields = result.fields_data;
            const scores = result.scores || [];
            
            for (let i = 0; i < scores.length; i++) {
              const get = (key: string) => {
                const field = fields.find((f: any) => f.field_name === key);
                return field?.data?.[i] || "";
              };
              
              out.push({
                title: get("source") || "News",
                url: get("url") || "",
                published_utc: get("published_utc") || "",
                snippet: String(get("text") || "").slice(0, 500),
              });
            }
          }
        }
      }
    }

    return out.slice(0, k);
  } catch (error) {
    console.error(`❌ Milvus search failed for ${symbol}:`, error);
    console.error(`Error details:`, {
      message: error.message,
      stack: error.stack,
      milvusUri: MILVUS_CONFIG.uri,
      milvusUser: MILVUS_CONFIG.user,
      collection: MILVUS_CONFIG.collection
    });
    // Return empty array instead of throwing to allow the app to continue
    return [];
  }
}
