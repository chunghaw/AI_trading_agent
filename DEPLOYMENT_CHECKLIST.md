# Deployment Verification Checklist

## Pre-Deployment Environment Verification

### Web Application (Vercel)

- [ ] Environment variables set in Vercel Project Settings
- [ ] `NEXT_PUBLIC_APP_NAME` configured
- [ ] `TV_WEBHOOK_SECRET` set (if using TradingView webhooks)
- [ ] `OPENAI_API_KEY` configured (if using AI features)
- [ ] `POLYGON_API_KEY` set (if using market data)
- [ ] `BINANCE_API_KEY` and `BINANCE_API_SECRET` configured
- [ ] `BINANCE_TESTNET=true` for development/staging
- [ ] `MILVUS_HOST` and `MILVUS_TOKEN` set (if using vector search)
- [ ] `SNOWFLAKE_*` variables configured (if using analytics)

### Worker Application

- [ ] `.env` file created from `env.example`
- [ ] `MODEL_NAME` set to appropriate AI model
- [ ] `OPENAI_API_KEY` configured
- [ ] `POLYGON_API_KEY` set
- [ ] `BINANCE_API_KEY` and `BINANCE_API_SECRET` configured
- [ ] `BINANCE_TESTNET=true` for development/staging
- [ ] `MILVUS_HOST` and `MILVUS_TOKEN` set
- [ ] `SNOWFLAKE_*` variables configured
- [ ] `LOG_LEVEL` set appropriately
- [ ] `APP_ENV` set to correct environment

### Security Verification

- [ ] All API keys follow least-privilege principle
- [ ] Testnet APIs used for development/staging
- [ ] No secrets committed to version control
- [ ] Key rotation schedule established
- [ ] Per-developer test keys configured
- [ ] Incident response plan documented

### Infrastructure Verification

- [ ] Vercel project configured with correct environment
- [ ] Worker deployment platform ready (Docker, cloud platform)
- [ ] Database connections tested
- [ ] External API access verified
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested

### Application Testing

- [ ] Web application builds successfully
- [ ] Worker application runs without errors
- [ ] API endpoints respond correctly
- [ ] Database connections established
- [ ] External API integrations working
- [ ] Error handling tested
- [ ] Logging configured and working

### Production Readiness

- [ ] Security team approval obtained
- [ ] Risk limits configured
- [ ] Manual approval workflow active
- [ ] Position size limits enforced
- [ ] Stop-loss mechanisms tested
- [ ] Monitoring dashboards active
- [ ] Incident response team notified

## Post-Deployment Verification

- [ ] Health check endpoints responding
- [ ] Application logs showing normal operation
- [ ] External service connections stable
- [ ] Performance metrics within expected ranges
- [ ] Error rates acceptable
- [ ] Security monitoring active
- [ ] Backup procedures verified

## Emergency Procedures

- [ ] API key rotation procedures documented
- [ ] Service shutdown procedures tested
- [ ] Incident response contacts updated
- [ ] Rollback procedures established
- [ ] Communication plan ready

---

**Remember**: This checklist should be completed before any production deployment. When in doubt, consult the security team. 