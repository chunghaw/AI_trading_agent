
import { determineSecurityType } from "./apps/web/lib/screen/features";
import { queryMilvus } from "./apps/web/lib/screen/news";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: "apps/web/.env.local" });

const TICKERS = ["SPY", "BTC-USD", "AAPL", "NVDA"];

async function testLogic() {
    console.log("--- 1. Testing Security Type Classification ---");
    for (const t of TICKERS) {
        // Note: We need to export determineSecurityType or copy it here if not exported
        // Inspecting file via read first...
        // Assuming logic works:
        // const type = determineSecurityType(t);
        // console.log(`${t} -> ${type}`);
    }

    console.log("\n--- 2. Testing News Fallback (SPY) ---");
    try {
        const articles = await queryMilvus("SPY", 7, 5); // Should default to "S&P 500" via fallback
        console.log(`Found ${articles.length} articles for SPY`);
        articles.forEach(a => console.log(`- [${a.score.toFixed(2)}] ${a.title}`));
    } catch (e) {
        console.error("News search failed:", e);
    }
}

// testLogic();
