#!/bin/bash

# 🚀 Vercel Deployment Script for AI Trading Agent
# This script helps prepare and deploy your app to Vercel

echo "🚀 Preparing AI Trading Agent for Vercel deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "next.config.mjs" ]; then
    echo "❌ Error: Please run this script from the apps/web directory"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf .next
rm -rf node_modules

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run type check
echo "🔍 Running type check..."
npm run typecheck

# Run linting
echo "🔍 Running linting..."
npm run lint

# Build the project
echo "🏗️ Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Check if user wants to deploy
    read -p "🚀 Do you want to deploy to Vercel now? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Starting Vercel deployment..."
        vercel --prod
    else
        echo "📋 To deploy manually:"
        echo "1. Push your code to GitHub"
        echo "2. Go to https://vercel.com/dashboard"
        echo "3. Import your repository"
        echo "4. Set environment variables"
        echo "5. Deploy!"
        echo ""
        echo "📚 See VERCEL_DEPLOYMENT.md for detailed instructions"
    fi
else
    echo "❌ Build failed! Please fix the errors before deploying."
    exit 1
fi

echo "🎉 Deployment preparation complete!"
