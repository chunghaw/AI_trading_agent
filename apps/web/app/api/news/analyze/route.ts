import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
// import { searchAndRerankNewsStrict } from "@/lib/news.search";
// import { newsAnalysisPrompt } from "@/lib/news.prompts";

// Temporary functions
const searchAndRerankNewsStrict = async () => [];
const newsAnalysisPrompt = () => "";

const Body = z.object({
  symbol: z.string().min(1),
  query: z.string().min(1)
});

export async function POST(req: NextRequest) {
  try {
    const { symbol, query } = Body.parse(await req.json());
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago

    // Search for news
    const hits = await searchAndRerankNewsStrict(symbol, query, sinceIso);
    
    if (hits.length === 0) {
      return NextResponse.json({
        error: `No news found for ${symbol} in the last 7 days`,
        code: "NO_NEWS_DATA",
        symbol,
        query
      }, { status: 404 });
    }

    // Return news analysis
    return NextResponse.json({
      symbol,
      query,
      newsCount: hits.length,
      news: hits.slice(0, 5).map(hit => ({
        title: hit.title,
        url: hit.url,
        source: hit.source,
        published: hit.published_utc,
        relevance: hit.score
      })),
      summary: `Found ${hits.length} relevant news articles for ${symbol}`,
      _metadata: {
        dataSource: "milvus_polygon_news_data",
        searchQuery: query,
        timeWindow: "7 days",
        collection: process.env.MILVUS_COLLECTION_NEWS || "polygon_news_data"
      }
    });

  } catch (error: any) {
    console.error("News analysis error:", error);
    
    if (error.message?.includes("No news")) {
      return NextResponse.json({ 
        error: error.message,
        code: "NO_NEWS_DATA"
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: "Failed to analyze news",
      details: error.message 
    }, { status: 500 });
  }
}
