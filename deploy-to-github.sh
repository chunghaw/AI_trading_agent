#!/bin/bash

# 🚀 GitHub Deployment Script for AI Trading Agent
# This script helps prepare and deploy your project to GitHub

echo "🚀 Preparing AI Trading Agent for GitHub deployment..."

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "apps" ]; then
    echo "❌ Error: Please run this script from the AI_trading_agent root directory"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Check git status
echo "📋 Checking git status..."
git status

# Add all files
echo "📦 Adding files to git..."
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "ℹ️ No changes to commit"
else
    # Create commit with descriptive message
    echo "💾 Creating commit..."
    git commit -m "🚀 Deploy AI Trading Agent with enhanced features

✨ Features Added:
- Enhanced dashboard with real market data
- Databricks DLT integration for OHLCV data processing
- Airflow Milvus pipeline for news data
- Technical analysis with RSI, MACD, EMA, ATR indicators
- Real-time sentiment analysis and market insights
- Vercel deployment configuration
- Comprehensive documentation updates

🔧 Technical Improvements:
- Updated README.md with Databricks DLT and Airflow Milvus setup
- Enhanced API routes for dashboard data
- Improved symbol detection logic
- Fixed color scheme for analyst recommendations
- Added production-ready configuration files
- Cleaned up unnecessary files and scripts

📊 Data Infrastructure:
- Databricks DLT for real-time market data processing
- Airflow Milvus for automated news ingestion and embedding
- Vector search capabilities for semantic analysis
- Technical indicator computation in Databricks
- Delta Lake storage with ACID guarantees

🚀 Deployment Ready:
- Vercel configuration for web frontend
- Production environment templates
- Comprehensive deployment documentation
- Optimized build configuration

📚 Documentation:
- Updated README.md with clear setup instructions
- Vercel deployment guide
- Environment configuration templates
- Architecture diagrams and data flow explanations"
fi

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🌐 No remote repository configured."
    echo "📋 To add a remote repository:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo ""
    echo "📋 Then push to GitHub:"
    echo "   git push -u origin main"
else
    echo "🌐 Remote repository found:"
    git remote get-url origin
    
    # Ask if user wants to push
    read -p "🚀 Do you want to push to GitHub now? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Pushing to GitHub..."
        git push origin main
        
        if [ $? -eq 0 ]; then
            echo "✅ Successfully pushed to GitHub!"
            echo ""
            echo "🎉 Next steps:"
            echo "1. Go to your GitHub repository"
            echo "2. Set up GitHub Pages or connect to Vercel"
            echo "3. Configure environment variables in your deployment platform"
            echo "4. Deploy your application"
            echo ""
            echo "📚 See VERCEL_DEPLOYMENT.md for detailed deployment instructions"
        else
            echo "❌ Failed to push to GitHub. Please check your credentials and try again."
        fi
    else
        echo "📋 To push manually:"
        echo "   git push origin main"
    fi
fi

echo "🎉 GitHub deployment preparation complete!"





