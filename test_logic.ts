
import { queryMilvus } from "./apps/web/lib/screen/news";
import fs from "fs";
import path from "path";

// Manual env parsing
const loadEnv = (p: string) => {
    if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf-8");
        content.split("\n").forEach(line => {
            const parts = line.split("=");
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join("=").trim().replace(/^"|"$/g, "");
                process.env[key] = val;
            }
        });
    }
};
loadEnv(".env");
loadEnv("apps/web/.env.local");

const ETFS = new Set(["SPY", "QQQ", "IWM", "DIA", "GLD", "SLV", "ARKK", "SMH", "XLF", "XLE", "XLK", "VTI", "VOO", "VEA", "VWO", "EFA", "IEFA", "AGG", "BND", "IVV"]);

function determineSecurityType(ticker: string): string {
    const t = ticker.toUpperCase();
    if (t.includes("-") || t.includes("BTC") || t.includes("ETH")) return "Crypto";
    if (ETFS.has(t)) return "ETF";
    return "Stock";
}

async function testLogic() {
    console.log("--- 1. Testing Security Type Classification ---");
    ["SPY", "BTC-USD", "AAPL", "NVDA"].forEach(t => {
        console.log(`${t} -> ${determineSecurityType(t)}`);
    });

    console.log("\n--- 2. Testing News Fallback (SPY) ---");
    try {
        // We expect this to use the fallback "S&P 500" internally
        const articles = await queryMilvus("SPY", 7, 5);
        console.log(`Found ${articles.length} articles for SPY`);
        if (articles.length > 0) {
            console.log("✅ Success! Articles found:");
            articles.forEach(a => console.log(`  - ${a.title}`));
        } else {
            console.log("❌ Failed: No articles found.");
        }
    } catch (e) {
        console.error("News search failed:", e);
    }
}

testLogic();
