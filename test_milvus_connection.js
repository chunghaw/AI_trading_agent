const { MilvusClient } = require("@zilliz/milvus2-sdk-node");
require('dotenv').config();

async function testMilvusConnection() {
  console.log("🧪 Testing Milvus Connection...\n");
  
  // Check environment variables
  const config = {
    uri: process.env.MILVUS_URI || 'not set',
    address: process.env.MILVUS_ADDRESS || 'not set', 
    user: process.env.MILVUS_USER || 'not set',
    username: process.env.MILVUS_USERNAME || 'not set',
    ssl: process.env.MILVUS_SSL || 'not set',
    collection: process.env.MILVUS_COLLECTION_NEWS || 'polygon_news_data'
  };
  
  console.log("🔧 Configuration:");
  console.log(JSON.stringify(config, null, 2));
  console.log();
  
  if (!process.env.MILVUS_URI && !process.env.MILVUS_ADDRESS) {
    console.log("❌ No Milvus URI configured");
    return;
  }
  
  let client;
  try {
    console.log("🔗 Creating Milvus client...");
    client = new MilvusClient({
      address: process.env.MILVUS_URI || process.env.MILVUS_ADDRESS,
      ssl: (process.env.MILVUS_SSL || "false") === "true",
      username: process.env.MILVUS_USER || process.env.MILVUS_USERNAME || "",
      password: process.env.MILVUS_PASSWORD || "",
    });
    console.log("✅ Milvus client created successfully");
  } catch (error) {
    console.log("❌ Failed to create Milvus client:");
    console.log("Error:", error.message);
    return;
  }
  
  try {
    console.log("🔍 Testing connection...");
    const collections = await client.showCollections();
    console.log("✅ Connection successful!");
    
    const collectionNames = collections?.collection_names || [];
    console.log(`📁 Found ${collectionNames.length} collections:`, collectionNames);
    
    const targetCollection = process.env.MILVUS_COLLECTION_NEWS || 'polygon_news_data';
    const hasTarget = collectionNames.includes(targetCollection);
    console.log(`🎯 Target collection '${targetCollection}': ${hasTarget ? '✅ Found' : '❌ Not found'}`);
    
    if (hasTarget) {
      try {
        console.log(`🔍 Testing collection '${targetCollection}'...`);
        const desc = await client.describeCollection({ collection_name: targetCollection });
        const fields = desc.schema?.fields || [];
        console.log(`📊 Collection has ${fields.length} fields:`, fields.map(f => f.name));
        
        // Test a simple search
        console.log("🔍 Testing search capability...");
        const searchResult = await client.search({
          collection_name: targetCollection,
          vector: [new Array(1536).fill(0.1)], // Dummy vector
          limit: 1,
          output_fields: ["*"]
        });
        console.log("✅ Search test successful!");
        
      } catch (collectionError) {
        console.log("❌ Collection test failed:");
        console.log("Error:", collectionError.message);
      }
    }
    
  } catch (error) {
    console.log("❌ Connection failed:");
    console.log("Error:", error.message);
    console.log("Error type:", error.constructor.name);
    if (error.stack) {
      console.log("Stack trace:");
      console.log(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
  
  try {
    await client.closeConnection();
    console.log("🔒 Connection closed");
  } catch (closeError) {
    console.log("⚠️ Error closing connection:", closeError.message);
  }
}

testMilvusConnection().catch(console.error);

