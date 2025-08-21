# Security Policy

## Overview

This document outlines security practices for the AI Trading Agent platform, ensuring safe development, testing, and production deployment.

## 🔐 API Key Management

### Least-Privilege Principle

All API keys must follow the principle of least privilege:

- **Development**: Use testnet APIs and sandbox environments
- **Testing**: Separate test keys from production keys
- **Production**: Minimal required permissions only

### Key Segregation

| Environment | Binance | Polygon | OpenAI | Milvus | Snowflake |
|-------------|---------|---------|--------|--------|-----------|
| Development | Testnet | Sandbox | Dev Org | Dev Cluster | Dev DB |
| Staging | Testnet | Sandbox | Staging Org | Staging Cluster | Staging DB |
| Production | Live | Live | Production Org | Production Cluster | Production DB |

## 🚫 No Secrets in Code

**CRITICAL**: Never commit secrets to version control.

### Web App (Vercel)
- Use Vercel Project Settings for all environment variables
- Secrets are encrypted and only accessible at runtime
- Use `vercel env pull` for local development

### Worker App
- Read from host environment variables
- Use cloud secret managers (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault)
- Never hardcode in Docker images or deployment scripts

## 🧪 Testnet Requirements

### Binance Spot Testnet

**MANDATORY**: All initial development and demos must use Binance Spot Testnet.

```bash
# Development environment
BINANCE_TESTNET=true
BINANCE_API_KEY=your_testnet_key
BINANCE_API_SECRET=your_testnet_secret
```

### Promotion to Live Trading

Live trading requires manual approval workflow:

1. **Code Review**: Security team approval
2. **Risk Assessment**: Maximum position sizes, stop-loss limits
3. **Manual Approval**: Senior trader or risk manager sign-off
4. **Gradual Rollout**: Start with small position sizes
5. **Monitoring**: Real-time P&L and risk monitoring

## 🔄 Key Rotation

### When to Rotate Keys

- Keys shared in pull requests (even if reverted)
- Keys exposed in logs or error messages
- Quarterly rotation for production keys
- Immediately upon suspected compromise

### Per-Developer Keys

Each developer should have their own:
- Binance testnet API keys
- Polygon sandbox API keys
- OpenAI development organization keys

## 📊 Data Handling

### Data Classification

| Data Type | Storage | Retention | Encryption |
|-----------|---------|-----------|------------|
| Market Data | Snowflake | 7 years | At rest + in transit |
| Trade History | Snowflake | 7 years | At rest + in transit |
| News/Rationales | Milvus | 2 years | At rest + in transit |
| User Sessions | Memory only | Session duration | In transit |
| PII | **NOT STORED** | N/A | N/A |

### Vector Database (Milvus)

- Store: News articles, market analysis, trading rationales
- Never store: Personal data, API keys, passwords
- Access: Read-only for analysis, write for new content

### Analytics Database (Snowflake)

- Store: Trade executions, P&L, risk metrics
- Never store: API keys, user credentials
- Access: Write for trades, read for analytics

## 🏗️ Architecture Security

### Vercel Limitations

Vercel is designed for **short-lived requests only**:
- Maximum 10-second execution time
- No background processing
- No persistent state
- Cold starts between requests

### Worker Responsibilities

Long-running tasks **must** run in `apps/worker`:
- Market data processing
- Backtesting and analysis
- Risk calculations
- Order execution
- Real-time monitoring

### Network Security

- All external API calls use HTTPS
- Internal communication over secure channels
- API rate limiting and circuit breakers
- Request/response validation with Zod schemas

## ✅ Pre-Production Checklist

Before enabling live trading:

- [ ] All API keys rotated and secured
- [ ] Testnet validation completed
- [ ] Risk limits configured
- [ ] Monitoring and alerting active
- [ ] Incident response plan ready
- [ ] Backup and recovery tested
- [ ] Security team approval obtained
- [ ] Manual approval workflow active
- [ ] Position size limits enforced
- [ ] Stop-loss mechanisms tested

## 🚨 Incident Response

### Key Compromise

1. **Immediate**: Rotate all affected keys
2. **Investigation**: Review logs and access patterns
3. **Containment**: Disable affected services
4. **Recovery**: Deploy with new keys
5. **Post-mortem**: Document lessons learned

### Unauthorized Trading

1. **Stop**: Immediately halt all trading
2. **Assess**: Review positions and P&L
3. **Secure**: Rotate all API keys
4. **Investigate**: Audit logs and access
5. **Report**: Notify stakeholders and regulators if required

## 📞 Security Contacts

- **Security Team**: security@company.com
- **Emergency**: +1-XXX-XXX-XXXX
- **Bug Reports**: security@company.com

## 🔍 Security Monitoring

- Real-time API key usage monitoring
- Unusual trading pattern detection
- Failed authentication alerts
- Rate limit violation notifications
- P&L threshold alerts

## 📋 Compliance

This platform adheres to:
- SOC 2 Type II compliance
- GDPR data protection requirements
- Financial services regulations
- API security best practices

---

**Remember**: Security is everyone's responsibility. When in doubt, ask the security team. 