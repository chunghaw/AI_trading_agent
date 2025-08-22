import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
import { MilvusClient } from "@zilliz/milvus2-sdk-node";

function client(){
  return new MilvusClient({
    address: process.env.MILVUS_URI || process.env.MILVUS_ADDRESS || "localhost:19530",
    ssl: (process.env.MILVUS_SSL||"false")==="true",
    username: process.env.MILVUS_USER || process.env.MILVUS_USERNAME || "",
    password: process.env.MILVUS_PASSWORD || "",
  });
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
  const coll = process.env.MILVUS_COLLECTION_NEWS || "polygon_news_data";
  
  // Check if Milvus is configured
  if (!process.env.MILVUS_URI && !process.env.MILVUS_ADDRESS) {
    console.warn("⚠️ Milvus not configured. Skipping news search.");
    return [];
  }
  
  const c = client();

  try {
    console.log(`🔍 News Search Debug - Symbol: ${symbol}, Query: ${userQuery}, Since: ${sinceIso}`);
    
    // Test Milvus connection
    try {
      const list = await c.showCollections?.();
      console.log(`🔍 Debug - Milvus showCollections response:`, JSON.stringify(list, null, 2));
      
      const names: string[] = list?.collection_names ?? list?.data?.map((x:any)=>x.name) ?? [];
      console.log(`🔍 Debug - Available collections:`, names);
      console.log(`🔍 Debug - Looking for collection: ${coll}`);
      
      if (!names.includes(coll)) {
        console.warn(`Milvus collection '${coll}' not found. Returning empty news results.`);
        return [];
      }
    } catch (connectionError) {
      console.error("❌ Milvus connection failed:", connectionError);
      console.warn("⚠️ Skipping news search due to Milvus connection failure");
      return [];
    }

    if (c.loadCollection) {
      try { 
        await c.loadCollection({ collection_name: coll }); 
        console.log(`🔍 Debug - Collection ${coll} loaded successfully`);
      } catch (e) {
        console.log(`🔍 Debug - Collection load error (non-critical):`, e);
      }
    }

    console.log(`🔍 News Search Debug - Creating embedding for: ${symbol} ${userQuery}`);
    const vec = await openai.embeddings.create({ 
      model: EMBED, 
      input: `${symbol} ${userQuery}`.trim() 
    });
    const qv = vec.data[0].embedding as number[];

    const desc = await c.describeCollection({ collection_name: coll });
    const fields: string[] = (desc.schema?.fields || []).map((f: any) => f.name);
    console.log(`🔍 Debug - Collection fields:`, fields);

    const hasTicker = fields.includes("ticker");
    const hasTickers = fields.includes("tickers");
    const hasPub = fields.includes("published_utc");

    const clauses: string[] = [];
    if (hasTicker) {
      clauses.push(`ticker == "${symbol.toUpperCase()}"`);
    } else if (hasTickers) {
      clauses.push(`tickers like "%${symbol.toUpperCase()}%"`);
    }
    if (hasPub && sinceIso) {
      clauses.push(`published_utc >= "${sinceIso}"`);
    }
    const expr = clauses.length ? clauses.join(" && ") : undefined;
    console.log(`🔍 Debug - Search expression:`, expr);

    console.log(`🔍 News Search Debug - Searching Milvus with vector...`);
    const OUT_FIELDS = ["text","url","published_utc","tickers","ticker","title","source","sentiment"];
    const res = await c.search({
      collection_name: coll,
      anns_field: "embedding",
      vector: [qv],
      metric_type: "COSINE",
      limit: RECALL_K,
      expr,
      params: { nprobe: 16 },
      output_fields: OUT_FIELDS
    });

    console.log(`🔍 News Search Debug - Search completed, found ${res?.results?.length || 0} hits`);
    console.log(`🔍 News Search Debug - Filter: ${expr}`);
    console.log(`🔍 News Search Debug - Search query: ${symbol} ${userQuery}`);

    const groups = res?.results ?? res?.data ?? [];
    const hits: any[] = [];
    for (const g of groups) {
      if (g.fields) {
        hits.push({ ...g.fields, score: g.score ?? 0 });
      } else if (g.fields_data && g.scores) {
        for (let i = 0; i < g.scores.length; i++) {
          const row = g.fields_data[i] ?? {};
          hits.push({ ...row, score: g.scores[i] ?? 0 });
        }
      } else {
        hits.push({ ...g, score: g.score ?? 0 });
      }
    }

    if (hits.length === 0 && expr && c.query) {
      console.log(`🔍 Debug - Vector search returned 0 hits, trying scalar query fallback...`);
      const q = await c.query({
        collection_name: coll,
        expr,
        output_fields: OUT_FIELDS,
        limit: RECALL_K * 2,
        order_by: "published_utc",
        order: "desc"
      });
      const rows = q?.data ?? q ?? [];
      console.log(`🔍 Debug - Scalar query returned ${rows.length} hits`);
      for (const r of rows) hits.push({ ...r, score: 0.5 });
    }

    if (hits.length === 0) {
      console.warn(`No news found in '${coll}' for ${symbol} since ${sinceIso}.`);
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