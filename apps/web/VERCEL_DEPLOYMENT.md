# 🚀 Vercel Deployment Guide for AI Trading Agent

## 📋 Prerequisites

- [Vercel Account](https://vercel.com/signup)
- [GitHub Account](https://github.com)
- OpenAI API Key
- Milvus Database (Cloud or Self-hosted)
- Market Data Source (S3, HTTP API, or local files)

## 🔧 Step 1: Prepare Your Repository

### 1.1 Push to GitHub
```bash
# From your project root
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 1.2 Ensure Clean Build
```bash
cd apps/web
npm run build
```

## 🌐 Step 2: Deploy to Vercel

### 2.1 Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Select the `apps/web` directory as the root

### 2.2 Configure Build Settings
- **Framework Preset**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 2.3 Environment Variables
Add these environment variables in Vercel:

#### Required Variables:
```bash
OPENAI_API_KEY=your_actual_openai_api_key
NODE_ENV=production
```

#### Milvus Configuration:
```bash
MILVUS_ADDRESS=your_milvus_host:19530
MILVUS_SSL=true
MILVUS_USERNAME=your_username
MILVUS_PASSWORD=your_password
MILVUS_DB=your_database
MILVUS_COLLECTION_NEWS=news_chunks
```

#### Data Source Configuration:
```bash
# Choose one of these:
OHLCV_PARQUET_URI=s3://your-bucket/ohlcv/
# OR
OHLCV_PARQUET_URI=https://your-api.com/ohlcv/data.parquet
# OR
OHLCV_LOCAL_DIR=./data/ohlcv
```

#### App Configuration:
```bash
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## 📊 Step 3: Handle Data Files

### 3.1 Option A: Cloud Storage (Recommended)
- Upload your market data to S3, Google Cloud Storage, or similar
- Update `OHLCV_PARQUET_URI` to point to your cloud storage
- Ensure proper CORS and access permissions

### 3.2 Option B: API Endpoint
- Create a simple API to serve your market data
- Update `OHLCV_PARQUET_URI` to point to your API
- Ensure the API can handle the data format

### 3.3 Option C: Local Data (Demo Only)
- Include data files in your repository
- Update `OHLCV_LOCAL_DIR` to `./data/ohlcv`
- Note: This increases build time and repository size

## 🔒 Step 4: Security & Performance

### 4.1 API Rate Limiting
- Vercel automatically provides rate limiting
- Consider adding additional rate limiting for your API routes

### 4.2 Environment Variables
- Never commit sensitive keys to your repository
- Use Vercel's environment variable management
- Consider using Vercel's secret management for sensitive data

### 4.3 CORS Configuration
- Update CORS settings if needed for your domain
- Ensure Milvus connection allows your Vercel domain

## 🚀 Step 5: Deploy & Test

### 5.1 Initial Deployment
1. Click "Deploy" in Vercel
2. Wait for build to complete
3. Check build logs for any errors

### 5.2 Test Your App
1. Visit your deployed URL
2. Test the dashboard functionality
3. Verify API endpoints are working
4. Check data loading and display

### 5.3 Monitor Performance
- Use Vercel Analytics
- Monitor API response times
- Check for any build or runtime errors

## 🔧 Step 6: Post-Deployment

### 6.1 Custom Domain (Optional)
1. Go to your project settings in Vercel
2. Add your custom domain
3. Configure DNS records
4. Update `NEXT_PUBLIC_APP_URL` if needed

### 6.2 Environment Updates
- Update environment variables as needed
- Redeploy after environment variable changes
- Consider using Vercel's preview deployments for testing

### 6.3 Monitoring & Maintenance
- Set up Vercel notifications
- Monitor your app's performance
- Keep dependencies updated
- Regular security audits

## 🐛 Troubleshooting

### Common Issues:

#### Build Failures
```bash
# Check build logs in Vercel
# Ensure all dependencies are in package.json
# Verify TypeScript compilation
npm run typecheck
```

#### Environment Variable Issues
- Verify all required variables are set in Vercel
- Check variable names match exactly
- Ensure no extra spaces or quotes

#### Data Loading Issues
- Verify Milvus connection settings
- Check data source URI format
- Ensure proper CORS configuration

#### API Route Issues
- Check Vercel function timeout settings
- Verify API route structure
- Check for any server-side only code

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Functions](https://vercel.com/docs/concepts/functions)

## 🎯 Next Steps

After successful deployment:
1. Set up monitoring and alerts
2. Configure custom domain if desired
3. Set up CI/CD pipeline
4. Plan for scaling and optimization
5. Consider implementing caching strategies

---

**Need Help?** Check the Vercel documentation or reach out to the Vercel community for support.
