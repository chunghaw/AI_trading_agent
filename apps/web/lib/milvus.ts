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
    
    // Directly call Python script instead of HTTP request
    const { spawn } = require('child_process');
    const path = require('path');
    
    const pythonScript = path.join(process.cwd(), 'milvus_search_vercel.py');
    
    return new Promise((resolve) => {
      const python = spawn('python3', [pythonScript, 'search', symbol, query, sinceIso, k.toString()]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const results = JSON.parse(output);
            resolve(results || []);
          } catch (parseError) {
            console.error("❌ Failed to parse search results:", parseError);
            resolve([]);
          }
        } else {
          console.error("❌ Python search failed:", errorOutput);
          resolve([]);
        }
      });
    });
    
  } catch (error) {
    console.error(`❌ Milvus search failed for ${symbol}:`, error);
    // Return empty array instead of throwing to allow the app to continue
    return [];
  }
}
