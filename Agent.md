# AI Trading Agent Requirements

## 🚫 CRITICAL - NEVER DO THESE:

### 1. **NEVER Use Mock/Hardcoded Data**
- **NO** hardcoded symbols, RSI, MACD calculations
- **NO** mock data - always use real data from database
- **NO** fallback to fake data when database fails
- **REQUIREMENT**: Database connection must work or show error

### 2. **NEVER Show Support/Resistance Levels**
- **NO** fibonacci support/resistance levels
- **NO** support/resistance arrays in output
- **NO** price levels or breakout triggers
- **REMOVE** all fibonacci calculations from code

### 3. **NEVER Show Generic/Useless Information**
- **NO** generic technical analysis summaries
- **NO** useless metrics like "docs", "sources", "+1", "-0"
- **NO** generic scenarios (bull_case, bear_case)
- **NO** risk_box with generic stop losses
- **NO** chart_notes with generic text

## ✅ REQUIRED Output Structure:

### Company Information (Header)
- **Name**: Company name from `company_info_cache`
- **Market**: Market type (stocks, etc.)
- **Type**: Stock type (CS, etc.)
- **Exchange**: Primary exchange (XNAS, etc.)
- **Currency**: Currency (USD, etc.)
- **Employees**: Total employees count
- **Description**: Company description (truncated to 200 chars)

### News Analysis Section
- **ONLY** AI-generated rationale from news analysis
- **NO** useless metrics or generic summaries
- **SHOW** actual AI analysis in sentences

### Technical Analysis Section
- **ONLY** AI-generated rationale from technical analysis
- **SHOW** actual AI analysis in sentences
- **INCLUDE** proper technical indicators (RSI, MACD, EMAs, VWAP, ATR)

### Final Output
- **ONLY** AI-generated overall analysis
- **NO** portfolio sections
- **NO** risk assessment sections

## 🔧 Technical Requirements:

### Data Sources
- **Gold Table**: Latest aggregated data and indicators (RSI, MACD, EMAs, VWAP, ATR)
- **Silver Table**: Historical OHLCV data only
- **Company Info**: From `company_info_cache` table

### Technical Indicators (Must Work Correctly)
- **RSI**: Should show actual calculated value (not 0 or 100)
- **MACD**: Line, signal, histogram
- **EMAs**: 20, 50, 200 periods
- **VWAP**: Volume-weighted average price
- **ATR**: Average True Range
- **Volume Analysis**: Trend and price relationship

### AI Analysis Quality
- **News Analysis**: Specific, actionable insights with citations
- **Technical Analysis**: Detailed interpretation of indicators
- **Final Output**: Comprehensive synthesis of both analyses

## 🚨 Error Handling:
- **Database Connection**: Must work or show clear error
- **Missing Data**: Show specific error, not generic fallback
- **API Failures**: Clear error messages, no mock data

## 📋 Output Order:
1. **Company Information** (header)
2. **News Analysis** (AI rationale only)
3. **Technical Analysis** (AI rationale only)
4. **Final Output** (AI synthesis)

## 🎯 Success Criteria:
- VWAP shows correct value (e.g., 136.27 for NVDA)
- ATR shows correct value (e.g., 2.84 for NVDA)
- RSI shows actual calculated value (not 0 or 100)
- Company information displays in header
- NO support/resistance levels anywhere
- NO generic summaries or useless metrics
- ONLY AI-generated analysis content

## 📝 Notes:
- User has been very clear about removing support/resistance levels
- User wants complete picture, not simplified version
- User rejects any mock data or hardcoded values
- User wants proper AI analysis, not generic summaries
- User has repeatedly emphasized these requirements

---
**Last Updated**: Current session
**Status**: Active requirements
