import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { searchNewsMilvus } from "@/lib/milvus";
import { AgentAnswer, type AgentAnswerT } from "@/lib/schemas";
import { newsPrompt, technicalPrompt, portfolioPrompt, combinedPrompt } from "@/lib/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const Input = z.object({
  prompt: z.string().min(2),
  symbol: z.string().optional().default("NVDA"),
  timeframe: z.string().optional().default("1h"),
  since_days: z.number().optional().default(7),
  analysis: z.enum(["combined","news","technical","portfolio"]).default("combined"),
  horizon: z.string().optional().default("1–5 days")
});

async function getTech(symbol: string, timeframe: string) {
  // TODO: call your worker/Polygon/Binance; using a deterministic mock for now
  return { rsi14: 62.3, macd: 1.2, macd_signal: 0.8, macd_hist: 0.4, ema20: 498, ema50: 482, ema200: 410 };
}

async function getPortfolio(symbol: string) {
  // TODO: call your DB/service; deterministic mock for now
  return { exposure_pct: 0.12, pos: { symbol, qty: 100, px: 500 }, daily_pnl: 0.003 };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, symbol, timeframe, since_days, analysis, horizon } = Input.parse(body);

  const sinceIso = new Date(Date.now() - since_days * 86400_000).toISOString();

  // 1) Retrieval / tools
  const [docs, indicators, portfolio] = await Promise.all([
    analysis !== "technical" && analysis !== "portfolio"
      ? searchNewsMilvus(`${symbol} ${prompt}`, symbol, sinceIso, 12)
      : Promise.resolve([]),
    analysis !== "news"
      ? getTech(symbol, timeframe)
      : Promise.resolve({}),
    analysis !== "news"
      ? getPortfolio(symbol)
      : Promise.resolve({})
  ]);

  const docsSlim = docs.map(d => ({
    title: d.source || "News",
    url: d.url,
    published_utc: d.published_utc,
    snippet: (d.text || "").slice(0, 500)
  }));

  // 2) LLM per analysis
  let newsJson: any = { rationale:"", action:"FLAT", confidence:0.5, citations:[] };
  let techJson: any = { rationale:"", action:"FLAT", confidence:0.5, citations:["ta://rsi","ta://macd"], indicators: indicators };
  let pmJson: any   = { rationale:"", action:"FLAT", size_pct:0.1, confidence:0.5, citations:[] };

  if (analysis === "news" || analysis === "combined") {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: newsPrompt(symbol!, horizon, JSON.stringify(docsSlim)) }
      ]
    });
    newsJson = JSON.parse(completion.choices[0].message.content || "{}");
  }

  if (analysis === "technical" || analysis === "combined") {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: technicalPrompt(symbol!, timeframe!, JSON.stringify(indicators), horizon) }
      ]
    });
    techJson = JSON.parse(completion.choices[0].message.content || "{}");
  }

  if (analysis === "portfolio" || analysis === "combined") {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: portfolioPrompt(symbol!, JSON.stringify(portfolio)) }
      ]
    });
    pmJson = JSON.parse(completion.choices[0].message.content || "{}");
  }

  // 3) Combined synthesis (or single analysis passthrough)
  let result: AgentAnswerT;
  if (analysis === "combined") {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: combinedPrompt(symbol!, JSON.stringify(newsJson), JSON.stringify(techJson), JSON.stringify(pmJson)) }
      ]
    });
    const responseContent = completion.choices[0].message.content || "{}";
    const parsedResponse = JSON.parse(responseContent);
    
    // Ensure the response matches our schema
    result = AgentAnswer.parse({
      summary: parsedResponse.summary || {
        bullets: ["Analysis completed."],
        answer: `Combined analysis for ${symbol}.`,
        confidence: 0.5
      },
      news: {
        rationale: typeof parsedResponse.news?.rationale === 'string' ? parsedResponse.news.rationale : "News analysis completed.",
        action: parsedResponse.news?.action || "FLAT",
        confidence: parsedResponse.news?.confidence || 0.5,
        citations: Array.isArray(parsedResponse.news?.citations) ? parsedResponse.news.citations : []
      },
      technical: {
        rationale: typeof parsedResponse.technical?.rationale === 'string' ? parsedResponse.technical.rationale : "Technical analysis completed.",
        action: parsedResponse.technical?.action || "FLAT",
        confidence: parsedResponse.technical?.confidence || 0.5,
        citations: Array.isArray(parsedResponse.technical?.citations) ? parsedResponse.technical.citations : [],
        indicators: parsedResponse.technical?.indicators || indicators
      },
      portfolio: {
        rationale: typeof parsedResponse.portfolio?.rationale === 'string' ? parsedResponse.portfolio.rationale : "Portfolio analysis completed.",
        action: parsedResponse.portfolio?.action || "FLAT",
        confidence: parsedResponse.portfolio?.confidence || 0.5,
        citations: Array.isArray(parsedResponse.portfolio?.citations) ? parsedResponse.portfolio.citations : [],
        size_pct: parsedResponse.portfolio?.size_pct || 0.1
      }
    });
  } else {
    // build a minimal AgentAnswer from whichever analysis ran
    const summary = {
      bullets: ["Analysis completed."],
      answer: `${analysis} view generated for ${symbol}.`,
      confidence: (newsJson.confidence ?? techJson.confidence ?? pmJson.confidence) || 0.5
    };
    result = AgentAnswer.parse({
      summary,
      news: {
        rationale: typeof newsJson.rationale === 'string' ? newsJson.rationale : "News analysis completed.",
        action: newsJson.action || "FLAT",
        confidence: newsJson.confidence || 0.5,
        citations: Array.isArray(newsJson.citations) ? newsJson.citations : []
      },
      technical: {
        rationale: typeof techJson.rationale === 'string' ? techJson.rationale : "Technical analysis completed.",
        action: techJson.action || "FLAT",
        confidence: techJson.confidence || 0.5,
        citations: Array.isArray(techJson.citations) ? techJson.citations : [],
        indicators: techJson.indicators || indicators
      },
      portfolio: {
        rationale: typeof pmJson.rationale === 'string' ? pmJson.rationale : "Portfolio analysis completed.",
        action: pmJson.action || "FLAT",
        confidence: pmJson.confidence || 0.5,
        citations: Array.isArray(pmJson.citations) ? pmJson.citations : [],
        size_pct: pmJson.size_pct || 0.1
      }
    });
  }

  return NextResponse.json(result);
}
