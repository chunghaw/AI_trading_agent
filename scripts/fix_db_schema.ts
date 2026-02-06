
import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";

// Load env vars from root and apps/web
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });

async function runMigration() {
    const client = new Client({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("Connected to database...");

        // Add market_cap column if it doesn't exist
        await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='candidate_features' AND column_name='market_cap') THEN
          ALTER TABLE candidate_features ADD COLUMN market_cap DECIMAL(30, 2);
          RAISE NOTICE 'Added market_cap column';
        ELSE
          RAISE NOTICE 'market_cap column already exists';
        END IF;
      END $$;
    `);

        console.log("✅ Schema migration completed successfully.");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
