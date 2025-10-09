# How to Fix Vercel Authentication Protection Error

## Problem
The `/api/analyze` endpoint is returning a 500 error because Vercel's deployment protection is requiring authentication for ALL routes, including API endpoints.

## Solution

### Option 1: Disable Deployment Protection (Recommended for Testing)

1. Go to your Vercel project: https://vercel.com/chung-haws-projects/ai-trading-agent-web
2. Click **Settings** → **Deployment Protection**
3. Find "Protection Bypass for Automation" or "Deployment Protection"
4. **Disable** protection OR set it to "No Protection" for Production deployments
5. Click **Save**
6. Redeploy your app (push a new commit or click "Redeploy" in Vercel dashboard)

### Option 2: Configure API Routes to Bypass Protection

Add `vercel.json` configuration to allow public access to API routes:

```json
{
  "functions": {
    "app/api/**": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

### Option 3: Add API Route to Allowed Paths

If you want to keep protection for the frontend but allow API access:

1. Go to **Settings** → **Deployment Protection**
2. Look for "Bypass Protection" or "Allowed Paths"
3. Add `/api/*` to the allowed paths
4. Save and redeploy

## Quick Fix Command

Run this to create a vercel.json that excludes API routes from protection:

```bash
cd AI_trading_agent
cat > vercel.json << 'EOF'
{
  "version": 2,
  "public": true,
  "functions": {
    "app/api/**": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
EOF
git add vercel.json
git commit -m "Add vercel.json to allow public API access"
git push
```

## Why This Happened

Vercel's deployment protection was enabled for your entire project, which blocks all routes (including API routes) behind an authentication page. This is useful for preview deployments but should be disabled or configured to bypass API routes for production.

