// Test script for AI symbol detection
const OpenAI = require('openai');

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

async function detectSymbolFromQuestion(question) {
  try {
    console.log(`🤖 Testing AI symbol detection for: "${question}"`);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a financial AI assistant. Extract the stock symbol (ticker) from user questions about stocks. 
          
          Rules:
          1. Return ONLY the ticker symbol (e.g., NVDA, AAPL, MSFT)
          2. If no clear stock symbol is mentioned, return null
          3. Handle company names (e.g., "Apple" -> AAPL, "Microsoft" -> MSFT)
          4. Handle common variations (e.g., "Nvidia" -> NVDA)
          5. If multiple symbols mentioned, return the primary one
          
          Examples:
          - "What's the technical outlook for NVDA?" -> NVDA
          - "How is Apple doing?" -> AAPL  
          - "Microsoft stock analysis" -> MSFT
          - "What stocks should I buy?" -> null`
        },
        {
          role: "user", 
          content: question
        }
      ],
      functions: [
        {
          name: "extract_stock_symbol",
          description: "Extract the primary stock symbol from the user's question",
          parameters: {
            type: "object",
            properties: {
              symbol: {
                type: "string",
                description: "The stock ticker symbol (e.g., NVDA, AAPL, MSFT) or null if no symbol detected"
              },
              confidence: {
                type: "number",
                description: "Confidence score from 0-1"
              },
              reasoning: {
                type: "string", 
                description: "Brief explanation of why this symbol was detected"
              }
            },
            required: ["symbol", "confidence", "reasoning"]
          }
        }
      ],
      function_call: { name: "extract_stock_symbol" },
      temperature: 0.1
    });

    const functionCall = completion.choices[0].message.function_call;
    if (functionCall && functionCall.name === "extract_stock_symbol") {
      const args = JSON.parse(functionCall.arguments);
      console.log(`🤖 AI DETECTED: ${args.symbol} (confidence: ${args.confidence}) - ${args.reasoning}`);
      
      if (args.confidence > 0.7 && args.symbol && args.symbol !== "null") {
        return args.symbol.toUpperCase();
      }
    }
    
    console.log(`🤖 AI DETECTION: No confident symbol detected`);
    return null;
    
  } catch (error) {
    console.error("❌ AI SYMBOL DETECTION ERROR:", error);
    return null;
  }
}

async function testSymbolDetection() {
  console.log('🧪 Testing AI Symbol Detection...');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
  
  const testQuestions = [
    "What's the technical outlook for NVDA?",
    "How is Apple doing?",
    "Microsoft stock analysis",
    "What stocks should I buy?",
    "Tell me about Tesla",
    "GOOGL price prediction"
  ];
  
  for (const question of testQuestions) {
    const symbol = await detectSymbolFromQuestion(question);
    console.log(`✅ "${question}" -> ${symbol || 'null'}`);
    console.log('---');
  }
}

testSymbolDetection().catch(console.error);
