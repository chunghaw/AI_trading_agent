// Import Milvus with error handling
let MilvusClient: any;
try {
  MilvusClient = require("@zilliz/milvus2-sdk-node").MilvusClient;
} catch (error) {
  console.error("❌ Failed to import MilvusClient:", error);
  MilvusClient = null;
}

import OpenAI from "openai";

const EMBED="text-embedding-3-small";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function client(){
  if (!MilvusClient) {
    throw new Error("MilvusClient not available - import failed");
  }
  return new MilvusClient({
    address: process.env.MILVUS_URI || process.env.MILVUS_ADDRESS || "localhost:19530",
    ssl: (process.env.MILVUS_SSL||"false")==="true",
    username: process.env.MILVUS_USER || process.env.MILVUS_USERNAME || "",
    password: process.env.MILVUS_PASSWORD || "",
  });
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
    // Check if MilvusClient is available
    if (!MilvusClient) {
      console.warn("⚠️ MilvusClient not available. Skipping news search.");
      return [];
    }
    
    const c = client();
    const coll = process.env.MILVUS_COLLECTION_NEWS || "polygon_news_data";
    const v = await embed(query);
    
    console.log(`🔍 Searching Milvus collection: ${coll} for symbol: ${symbol}`);
    console.log(`🔗 Milvus URI: ${process.env.MILVUS_URI || 'not set'}`);
    console.log(`👤 Milvus User: ${process.env.MILVUS_USER || 'not set'}`);
    
    const desc = await c.describeCollection({ collection_name: coll });
  const fields = (desc.schema?.fields||[]).map(f=> f.name);
  const hasTicker = fields.includes("ticker");
  const hasDate = fields.includes("published_utc");

  const syms = SYN(symbol);
  const filter = hasTicker || hasDate
    ? [
        hasTicker ? `ticker in [${syms.map(s=>`"${s}"`).join(",")}]` : "",
        hasDate ? `published_utc >= "${sinceIso}"` : ""
      ].filter(Boolean).join(" && ")
    : undefined;

  let res = await c.search({
    collection_name: coll,
    vector: [v],
    output_fields: ["text","url","published_utc","ticker","source"],
    metric_type: "COSINE",
    limit: k,
    filter,
    params: { ef: 128 }
  } as any);

  let out:any[]=[];
  for (const g of (res.results||[])){
    const scores = g.scores||[];
    const rows = g.fields_data||[];
    for (let i=0;i<scores.length;i++){
      const r:any = rows[i] || {};
      const get=(key:string)=> r?.[key]?.Data?.[0] ?? r?.[key];
      out.push({
        title: get("source") || "News",
        url: get("url") || "",
        published_utc: get("published_utc") || "",
        snippet: String(get("text")||"").slice(0,500),
      });
    }
  }

  // Widen if empty: 30d and synonyms already considered
  if (out.length===0 && hasDate){
    const d30 = new Date(Date.now()-30*86400_000).toISOString();
    const wider = await c.search({
      collection_name: coll,
      vector: [v],
      output_fields: ["text","url","published_utc","ticker","source"],
      metric_type:"COSINE",
      limit:k,
      filter: [
        hasTicker ? `ticker in [${syms.map(s=>`"${s}"`).join(",")}]` : "",
        `published_utc >= "${d30}"`
      ].filter(Boolean).join(" && "),
      params:{ ef:128 }
    } as any);
    out=[];
    for (const g of (wider.results||[])){
      const scores = g.scores||[];
      const rows = g.fields_data||[];
      for (let i=0;i<scores.length;i++){
        const r:any = rows[i] || {};
        const get=(key:string)=> r?.[key]?.Data?.[0] ?? r?.[key];
        out.push({
          title: get("source") || "News",
          url: get("url") || "",
          published_utc: get("published_utc") || "",
          snippet: String(get("text")||"").slice(0,500),
        });
      }
    }
  }

  return out.slice(0,k);
  } catch (error) {
    console.error(`❌ Milvus search failed for ${symbol}:`, error);
    console.error(`Error details:`, {
      message: error.message,
      stack: error.stack,
      milvusUri: process.env.MILVUS_URI,
      milvusUser: process.env.MILVUS_USER,
      collection: process.env.MILVUS_COLLECTION_NEWS || "polygon_news_data"
    });
    throw new Error(`Milvus connection failed: ${error.message}`);
  }
}
