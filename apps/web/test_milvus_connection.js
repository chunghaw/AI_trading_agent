#!/usr/bin/env node
/**
 * Test Milvus connection and check for news data
 */

const https = require('https');

// Milvus configuration from environment
const MILVUS_URI = process.env.MILVUS_URI || "https://in03-85d251bbc78827a.serverless.aws-eu-central-1.cloud.zilliz.com";
const MILVUS_USER = process.env.MILVUS_USER || "db_85d251bbc78827a";
const MILVUS_PASSWORD = process.env.MILVUS_PASSWORD || "";
const MILVUS_COLLECTION = process.env.MILVUS_COLLECTION_NEWS || "polygon_news_data";

async function testMilvusConnection() {
  console.log("🔍 Testing Milvus connection...");
  console.log(`URI: ${MILVUS_URI}`);
  console.log(`User: ${MILVUS_USER}`);
  console.log(`Collection: ${MILVUS_COLLECTION}`);
  
  try {
    // Test 1: Check if collection exists
    console.log("\n📊 Test 1: Checking collection status...");
    const collectionStatus = await milvusRequest('/vector/collections/describe', 'POST', {
      collectionName: MILVUS_COLLECTION
    });
    
    console.log("✅ Collection exists:", collectionStatus);
    
    // Test 2: Get collection statistics
    console.log("\n📊 Test 2: Getting collection statistics...");
    const stats = await milvusRequest('/vector/collections/stats', 'POST', {
      collectionName: MILVUS_COLLECTION
    });
    
    console.log("✅ Collection stats:", stats);
    
    // Test 3: Try to search for NVDA news
    console.log("\n📊 Test 3: Searching for NVDA news...");
    const searchResults = await milvusRequest('/vector/search', 'POST', {
      collectionName: MILVUS_COLLECTION,
      vector: Array(1536).fill(0.1), // Dummy vector for testing
      limit: 5,
      outputFields: ["title", "text", "ticker", "published_utc"]
    });
    
    console.log("✅ Search results:", searchResults);
    
  } catch (error) {
    console.error("❌ Milvus test failed:", error.message);
    
    if (error.message.includes('401')) {
      console.error("🔐 Authentication failed - check MILVUS_USER and MILVUS_PASSWORD");
    } else if (error.message.includes('404')) {
      console.error("📦 Collection not found - check MILVUS_COLLECTION_NEWS");
    } else if (error.message.includes('ENOTFOUND')) {
      console.error("🌐 Connection failed - check MILVUS_URI");
    }
  }
}

async function milvusRequest(endpoint, method = 'POST', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(MILVUS_URI + '/v1' + endpoint);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    // Add basic auth if credentials are provided
    if (MILVUS_USER && MILVUS_PASSWORD) {
      const auth = Buffer.from(`${MILVUS_USER}:${MILVUS_PASSWORD}`).toString('base64');
      options.headers['Authorization'] = `Basic ${auth}`;
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${jsonData.message || data}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Run the test
testMilvusConnection().catch(console.error);
