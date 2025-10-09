import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("🔍 COMPREHENSIVE DATABASE TEST");
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    };
    
    try {
      // Test 1: Basic connection
      console.log("1️⃣ Testing database connection...");
      await pool.query('SELECT 1');
      results.tests.connection = { status: 'SUCCESS', message: 'Database connection successful' };
      
      // Test 2: Check required tables
      console.log("2️⃣ Checking required tables...");
      const tables = ['gold_ohlcv_daily_metrics', 'silver_ohlcv', 'company_info_cache'];
      const tableChecks: any = {};
      
      for (const table of tables) {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [table]);
        tableChecks[table] = result.rows[0].exists;
      }
      
      results.tests.tables = {
        status: Object.values(tableChecks).every(Boolean) ? 'SUCCESS' : 'PARTIAL',
        details: tableChecks
      };
      
      // Test 3: Gold table analysis
      if (tableChecks.gold_ohlcv_daily_metrics) {
        console.log("3️⃣ Gold Table Analysis...");
        
        // Count records
        const countResult = await pool.query('SELECT COUNT(*) FROM gold_ohlcv_daily_metrics');
        const totalRecords = parseInt(countResult.rows[0].count);
        
        // Check symbols
        const symbolsResult = await pool.query(`
          SELECT symbol, COUNT(*) as count, MAX(date) as latest_date
          FROM gold_ohlcv_daily_metrics 
          GROUP BY symbol 
          ORDER BY count DESC 
          LIMIT 10
        `);
        
        // Test specific symbols for data quality
        const testSymbols = ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'TSLA'];
        const symbolData: any = {};
        
        for (const symbol of testSymbols) {
          const result = await pool.query(`
            SELECT 
              symbol, date, close, total_volume,
              rsi_14, ma_20, ma_50, ma_200,
              ema_20, ema_50, ema_200,
              macd_line, macd_signal, macd_histogram,
              vwap, atr_14,
              company_name, market, stock_type
            FROM gold_ohlcv_daily_metrics 
            WHERE symbol = $1
            ORDER BY date DESC
            LIMIT 1
          `, [symbol]);
          
          if (result.rows.length > 0) {
            const data = result.rows[0];
            
            // Check for NULL values
            const nullFields = [];
            if (data.rsi_14 === null) nullFields.push('rsi_14');
            if (data.ema_20 === null) nullFields.push('ema_20');
            if (data.ema_50 === null) nullFields.push('ema_50');
            if (data.ema_200 === null) nullFields.push('ema_200');
            if (data.ma_20 === null) nullFields.push('ma_20');
            if (data.ma_50 === null) nullFields.push('ma_50');
            if (data.ma_200 === null) nullFields.push('ma_200');
            if (data.atr_14 === null) nullFields.push('atr_14');
            
            symbolData[symbol] = {
              found: true,
              date: data.date,
              close: data.close,
              indicators: {
                rsi_14: data.rsi_14,
                ema_20: data.ema_20,
                ema_50: data.ema_50,
                ema_200: data.ema_200,
                ma_20: data.ma_20,
                ma_50: data.ma_50,
                ma_200: data.ma_200,
                macd_line: data.macd_line,
                vwap: data.vwap,
                atr_14: data.atr_14
              },
              company: {
                name: data.company_name,
                market: data.market,
                type: data.stock_type
              },
              nullFields: nullFields,
              quality: nullFields.length === 0 ? 'GOOD' : 'PARTIAL'
            };
          } else {
            symbolData[symbol] = { found: false };
          }
        }
        
        results.tests.goldTable = {
          status: 'SUCCESS',
          totalRecords: totalRecords,
          topSymbols: symbolsResult.rows,
          symbolData: symbolData,
          summary: {
            symbolsWithData: Object.values(symbolData).filter((s: any) => s.found).length,
            symbolsWithCompleteIndicators: Object.values(symbolData).filter((s: any) => s.quality === 'GOOD').length
          }
        };
      }
      
      // Test 4: Silver table check
      if (tableChecks.silver_ohlcv) {
        const silverCount = await pool.query('SELECT COUNT(*) FROM silver_ohlcv');
        const silverSymbols = await pool.query(`
          SELECT symbol, COUNT(*) as count, MIN(date) as earliest, MAX(date) as latest
          FROM silver_ohlcv 
          GROUP BY symbol 
          ORDER BY count DESC 
          LIMIT 5
        `);
        
        results.tests.silverTable = {
          status: 'SUCCESS',
          totalRecords: parseInt(silverCount.rows[0].count),
          topSymbols: silverSymbols.rows
        };
      }
      
      // Test 5: Company info cache
      if (tableChecks.company_info_cache) {
        const companyCount = await pool.query('SELECT COUNT(*) FROM company_info_cache');
        const companySample = await pool.query(`
          SELECT symbol, name, market, type, primary_exchange, currency_name, total_employees
          FROM company_info_cache 
          WHERE symbol IN ('NVDA', 'AAPL', 'GOOGL', 'MSFT', 'TSLA')
          ORDER BY symbol
        `);
        
        results.tests.companyCache = {
          status: 'SUCCESS',
          totalRecords: parseInt(companyCount.rows[0].count),
          sampleData: companySample.rows
        };
      }
      
      await pool.end();
      
      return NextResponse.json({
        success: true,
        ...results
      });
      
    } catch (error: any) {
      await pool.end();
      throw error;
    }
    
  } catch (error: any) {
    console.error("❌ Database test failed:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      errorCode: error.code,
      syscall: error.syscall,
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'NOT SET',
        POSTGRES_URL_SET: !!process.env.POSTGRES_URL,
        POSTGRES_URL_LENGTH: process.env.POSTGRES_URL?.length || 0
      }
    }, { status: 500 });
  }
}
