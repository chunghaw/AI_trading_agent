// Simple symbol detection from user questions
const SYMBOL_MAPPINGS: Record<string, string> = {
  // Major stocks
  "apple": "AAPL",
  "google": "GOOGL",
  "alphabet": "GOOGL",
  "microsoft": "MSFT",
  "amazon": "AMZN",
  "tesla": "TSLA",
  "meta": "META",
  "facebook": "META",
  "netflix": "NFLX",
  "nvidia": "NVDA",
  "amd": "AMD",
  "intel": "INTC",
  "coca cola": "KO",
  "coca-cola": "KO",
  "coke": "KO",
  "disney": "DIS",
  "walt disney": "DIS",
  "mcdonalds": "MCD",
  "starbucks": "SBUX",
  "nike": "NKE",
  "adobe": "ADBE",
  "salesforce": "CRM",
  "oracle": "ORCL",
  "cisco": "CSCO",
  "paypal": "PYPL",
  "visa": "V",
  "mastercard": "MA",
  "berkshire hathaway": "BRK.A",
  "berkshire": "BRK.A",
  "warren buffett": "BRK.A",
  "johnson & johnson": "JNJ",
  "jnj": "JNJ",
  "procter & gamble": "PG",
  "pg": "PG",
  "unitedhealth": "UNH",
  "united health": "UNH",
  "home depot": "HD",
  "homedepot": "HD",
  "verizon": "VZ",
  "att": "T",
  "at&t": "T",
  "american telephone": "T",
  "chevron": "CVX",
  "exxon": "XOM",
  "exxon mobil": "XOM",
  "exxonmobil": "XOM",
  "jpmorgan": "JPM",
  "jp morgan": "JPM",
  "jpm": "JPM",
  "bank of america": "BAC",
  "bofa": "BAC",
  "wells fargo": "WFC",
  "goldman sachs": "GS",
  "goldman": "GS",
  "morgan stanley": "MS",
  "blackrock": "BLK",
  "vanguard": "VOO",
  "spy": "SPY",
  "qqq": "QQQ",
  
  // Cryptocurrencies
  "bitcoin": "BTC",
  "btc": "BTC",
  "ethereum": "ETH",
  "eth": "ETH",
  "cardano": "ADA",
  "ada": "ADA",
  "solana": "SOL",
  "sol": "SOL",
  "polkadot": "DOT",
  "dot": "DOT",
  "chainlink": "LINK",
  "link": "LINK",
  "litecoin": "LTC",
  "ltc": "LTC",
  "ripple": "XRP",
  "xrp": "XRP",
  "dogecoin": "DOGE",
  "doge": "DOGE",
  "shiba inu": "SHIB",
  "shib": "SHIB",
  "binance coin": "BNB",
  "bnb": "BNB",
  "polygon": "MATIC",
  "matic": "MATIC",
  "avalanche": "AVAX",
  "avax": "AVAX",
  "cosmos": "ATOM",
  "atom": "ATOM",
  "uniswap": "UNI",
  "uni": "UNI",
  "aave": "AAVE",
  "compound": "COMP",
  "comp": "COMP",
  "filecoin": "FIL",
  "fil": "FIL",
  "stellar": "XLM",
  "xlm": "XLM",
  "vechain": "VET",
  "vet": "VET",
  "algorand": "ALGO",
  "algo": "ALGO",
  "tezos": "XTZ",
  "xtz": "XTZ",
  "monero": "XMR",
  "xmr": "XMR",
  "dash": "DASH",
  "zcash": "ZEC",
  "zec": "ZEC",
  
  // Commodities
  "gold": "GLD",
  "silver": "SLV",
  "oil": "USO",
  "crude oil": "USO",
  "natural gas": "UNG",
  
  // Indices
  "s&p 500": "SPY",
  "sp500": "SPY",
  "sp 500": "SPY",
  "nasdaq": "QQQ",
  "dow jones": "DIA",
  "dow": "DIA",
  "russell 2000": "IWM",
  "russell": "IWM"
};

export function detectSymbolFromQuestion(question: string): string {
  const lowerQuestion = question.toLowerCase();
  console.log(`🔍 Symbol detection - Question: "${question}"`);
  console.log(`🔍 Lowercase question: "${lowerQuestion}"`);
  
  // First priority: Check for exact stock symbol matches (3-5 uppercase letters)
  // Use a more specific pattern to avoid matching common words
  const symbolMatch = lowerQuestion.match(/\b([a-z]{3,5})\b/);
  if (symbolMatch) {
    const symbol = symbolMatch[1].toUpperCase();
    console.log(`🔍 Found potential symbol match: "${symbol}"`);
    
    // Check if it's a known stock symbol (case-insensitive)
    const knownSymbols = Object.values(SYMBOL_MAPPINGS);
    if (knownSymbols.includes(symbol)) {
      console.log(`✅ Returning exact symbol match: "${symbol}"`);
      return symbol;
    } else {
      console.log(`⚠️ Symbol "${symbol}" not found in mappings`);
    }
  }
  
  // Second priority: Check for company/crypto names (longer names first for better matching)
  const sortedNames = Object.entries(SYMBOL_MAPPINGS)
    .sort(([a], [b]) => b.length - a.length); // Sort by length descending
  
  for (const [name, symbol] of sortedNames) {
    if (lowerQuestion.includes(name)) {
      console.log(`🔍 Found company name match: "${name}" -> "${symbol}"`);
      console.log(`✅ Returning company name match: "${symbol}"`);
      return symbol;
    }
  }
  
  // Third priority: Check for context clues (like "my X position", "X stock", etc.)
  // This should catch cases where the symbol was missed by the first regex
  const contextPatterns = [
    /\bmy\s+([a-z]{3,5})\s+position\b/i,
    /\b([a-z]{3,5})\s+position\b/i,
    /\b([a-z]{3,5})\s+stock\b/i,
    /\b([a-z]{3,5})\s+shares\b/i,
    /\b([a-z]{3,5})\s+portfolio\b/i,
    /\bfor\s+([a-z]{3,5})\b/i,  // "outlook for AAPL"
    /\babout\s+([a-z]{3,5})\b/i, // "what about TSLA"
    /\b([a-z]{3,5})\s+sentiment\b/i, // "AMZN sentiment"
    /\b([a-z]{3,5})\s+analysis\b/i   // "NVDA analysis"
  ];
  
  for (const pattern of contextPatterns) {
    const match = lowerQuestion.match(pattern);
    if (match) {
      const symbol = match[1].toUpperCase();
      console.log(`🔍 Found context pattern match: "${symbol}"`);
      
      if (Object.values(SYMBOL_MAPPINGS).includes(symbol)) {
        console.log(`✅ Returning context pattern match: "${symbol}"`);
        return symbol;
      }
    }
  }
  
  // Fourth priority: Look for any remaining 3-5 letter combinations that might be symbols
  // This is a fallback to catch symbols that weren't caught by the above patterns
  const allWords = lowerQuestion.split(/\s+/);
  for (const word of allWords) {
    if (word.length >= 3 && word.length <= 5 && /^[a-z]+$/.test(word)) {
      const symbol = word.toUpperCase();
      if (Object.values(SYMBOL_MAPPINGS).includes(symbol)) {
        console.log(`🔍 Found symbol in word list: "${symbol}"`);
        console.log(`✅ Returning symbol from word list: "${symbol}"`);
        return symbol;
      }
    }
  }
  
  // Default fallback: Return a more appropriate default or ask user to specify
  console.log(`⚠️ No symbol detected, using default fallback`);
  return "AAPL"; // Changed from NVDA to AAPL as a more neutral default
}

