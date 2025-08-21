import fs from 'fs';
import path from 'path';

export class DatabricksExporter {
  private workspaceUrl: string;
  private token: string;
  private headers: Record<string, string>;

  constructor(workspaceUrl: string, token: string) {
    this.workspaceUrl = workspaceUrl.replace(/\/$/, '');
    this.token = token;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async listFiles(dbfsPath: string): Promise<any[]> {
    const url = `${this.workspaceUrl}/api/2.0/dbfs/list`;
    const params = new URLSearchParams({ path: dbfsPath });
    
    try {
      const response = await fetch(`${url}?${params}`, {
        headers: this.headers
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.files || [];
      } else {
        console.error(`❌ Error listing files: ${response.statusText}`);
        return [];
      }
    } catch (error) {
      console.error('❌ Error listing files:', error);
      return [];
    }
  }

  async downloadFile(dbfsPath: string, localPath: string): Promise<boolean> {
    const url = `${this.workspaceUrl}/api/2.0/dbfs/read`;
    const params = new URLSearchParams({ path: dbfsPath });
    
    try {
      const response = await fetch(`${url}?${params}`, {
        headers: this.headers
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.bytes_read > 0) {
          // Decode base64 content
          const fileContent = Buffer.from(result.data, 'base64');
          
          // Ensure local directory exists
          const dir = path.dirname(localPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Write file
          fs.writeFileSync(localPath, fileContent);
          
          console.log(`✅ Downloaded: ${dbfsPath} -> ${localPath}`);
          return true;
        } else {
          console.log(`⚠️ Empty file: ${dbfsPath}`);
          return false;
        }
      } else {
        console.error(`❌ Error downloading ${dbfsPath}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error downloading ${dbfsPath}:`, error);
      return false;
    }
  }

  async exportAndDownload(symbols: string[] = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL"]): Promise<boolean> {
    const localExportDir = path.join(process.cwd(), 'data', 'export');
    
    console.log('🚀 Starting automated export and download...');
    
    // 1. Download symbol summary
    console.log('📊 Downloading symbol summary...');
    const summaryDbfs = "/Workspace/Users/chunghawtan@gmail.com/AI-Trading-Pipeline/webapp_export/symbol_summary.json";
    const summaryLocal = path.join(localExportDir, 'symbol_summary.json');
    
    const summarySuccess = await this.downloadFile(summaryDbfs, summaryLocal);
    
    if (summarySuccess) {
      try {
        const summaryContent = fs.readFileSync(summaryLocal, 'utf8');
        const summaryData = JSON.parse(summaryContent);
        console.log(`📈 Summary contains ${summaryData.symbols?.length || 0} symbols`);
      } catch (error) {
        console.log(`⚠️ Error reading summary: ${error}`);
      }
    }
    
    // 2. Download OHLCV files
    console.log('📈 Downloading OHLCV data...');
    let downloadedCount = 0;
    
    for (const symbol of symbols) {
      const ohlcvDbfs = `/Workspace/Users/chunghawtan@gmail.com/AI-Trading-Pipeline/webapp_export/ohlcv_${symbol}.json`;
      const ohlcvLocal = path.join(localExportDir, `ohlcv_${symbol}.json`);
      
      const success = await this.downloadFile(ohlcvDbfs, ohlcvLocal);
      if (success) {
        downloadedCount++;
        const stats = fs.statSync(ohlcvLocal);
        console.log(`   📄 ${symbol}: ${stats.size} bytes`);
      }
    }
    
    console.log(`\n🎉 Download completed! ${downloadedCount} OHLCV files downloaded`);
    console.log(`📁 Files saved to: ${localExportDir}`);
    
    return downloadedCount > 0;
  }
}
