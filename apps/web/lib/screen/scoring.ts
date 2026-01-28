import { TechnicalFeatures, TechnicalScore } from "../screen.schemas";

/**
 * Deterministic technical scoring engine
 * Returns score 0-100 with tags and reasons
 * 
 * Rules:
 * - Gate: price > sma200 (hard requirement, already filtered)
 * - Trend points: sma50>sma200 (+10), price>sma50 (+5), higher-high proxy (+5)
 * - Momentum points: macd hist rising (+8), macd cross recency (+10)
 * - Volume points: rvol > threshold (+5), dollar volume (+5)
 * - Breakout points: close above N-day high with volume (+15) OR compression (+10)
 */
export function scoreTechnical(features: TechnicalFeatures): TechnicalScore {
  const reasons: Array<{ rule: string; points: number; description: string }> = [];
  const tags: string[] = [];
  let totalScore = 0;

  // ========================================================================
  // GATE: Price > SMA200 (already filtered, but verify)
  // ========================================================================
  if (!features.sma200 || features.price <= features.sma200) {
    return {
      technicalScore: 0,
      tags: ["rejected"],
      reasons: [{ rule: "price_above_sma200", points: 0, description: "Price must be above SMA200" }],
    };
  }

  // ========================================================================
  // TREND POINTS (Max 20 points)
  // ========================================================================
  
  // Rule 1: SMA50 > SMA200 (+10 points)
  if (features.sma50 && features.sma200 && features.sma50 > features.sma200) {
    const points = 10;
    totalScore += points;
    reasons.push({
      rule: "sma50_above_sma200",
      points,
      description: `SMA50 (${features.sma50.toFixed(2)}) > SMA200 (${features.sma200.toFixed(2)}) - Bullish trend`,
    });
    tags.push("trend_bullish");
  }

  // Rule 2: Price > SMA50 (+5 points)
  if (features.sma50 && features.price > features.sma50) {
    const points = 5;
    totalScore += points;
    reasons.push({
      rule: "price_above_sma50",
      points,
      description: `Price (${features.price.toFixed(2)}) > SMA50 (${features.sma50.toFixed(2)}) - Short-term uptrend`,
    });
    tags.push("price_above_sma50");
  }

  // Rule 3: Higher-high proxy - price > 20-day high (+5 points)
  if (features.high_20d && features.price > features.high_20d) {
    const points = 5;
    totalScore += points;
    reasons.push({
      rule: "higher_high",
      points,
      description: `Price (${features.price.toFixed(2)}) > 20-day high (${features.high_20d.toFixed(2)}) - New high`,
    });
    tags.push("higher_high");
  }

  // ========================================================================
  // MOMENTUM POINTS (Max 18 points)
  // ========================================================================
  
  // Rule 4: MACD histogram rising (+8 points)
  if (
    features.macd_hist !== null &&
    features.prev_macd_hist !== null &&
    features.macd_hist > features.prev_macd_hist &&
    features.macd_hist > 0
  ) {
    const points = 8;
    totalScore += points;
    reasons.push({
      rule: "macd_histogram_rising",
      points,
      description: `MACD histogram rising (${features.macd_hist.toFixed(4)} > ${features.prev_macd_hist.toFixed(4)}) - Momentum building`,
    });
    tags.push("momentum_rising");
  }

  // Rule 5: MACD line > Signal (bullish crossover) (+10 points)
  if (
    features.macd !== null &&
    features.macd_signal !== null &&
    features.macd > features.macd_signal
  ) {
    const points = 10;
    totalScore += points;
    reasons.push({
      rule: "macd_bullish_cross",
      points,
      description: `MACD line (${features.macd.toFixed(4)}) > Signal (${features.macd_signal.toFixed(4)}) - Bullish momentum`,
    });
    tags.push("macd_bullish");
  } else if (features.macd !== null && features.macd_signal !== null) {
    // Bearish MACD - no points, but note it
    tags.push("macd_bearish");
  }

  // ========================================================================
  // VOLUME POINTS (Max 10 points)
  // ========================================================================
  
  // Rule 6: Relative volume > 1.5 (+5 points)
  if (features.rvol !== null && features.rvol > 1.5) {
    const points = 5;
    totalScore += points;
    reasons.push({
      rule: "high_relative_volume",
      points,
      description: `Relative volume ${features.rvol.toFixed(2)}x average - Strong interest`,
    });
    tags.push("high_volume");
  }

  // Rule 7: High dollar volume (> 50M daily) (+5 points)
  if (features.dollar_volume !== null && features.dollar_volume > 50_000_000) {
    const points = 5;
    totalScore += points;
    reasons.push({
      rule: "high_dollar_volume",
      points,
      description: `Dollar volume $${(features.dollar_volume / 1_000_000).toFixed(1)}M - High liquidity`,
    });
    tags.push("high_liquidity");
  }

  // ========================================================================
  // BREAKOUT POINTS (Max 15 points)
  // ========================================================================
  
  // Rule 8: Price breakout above 20-day high with volume (+15 points)
  if (
    features.high_20d !== null &&
    features.price > features.high_20d &&
    features.rvol !== null &&
    features.rvol > 1.2
  ) {
    const points = 15;
    totalScore += points;
    reasons.push({
      rule: "breakout_with_volume",
      points,
      description: `Price broke above 20-day high (${features.high_20d.toFixed(2)}) with ${features.rvol.toFixed(2)}x volume - Strong breakout`,
    });
    tags.push("breakout");
  }

  // Rule 9: ATR compression (low volatility before potential breakout) (+10 points)
  if (features.atrp !== null && features.atrp < 2.0) {
    const points = 10;
    totalScore += points;
    reasons.push({
      rule: "atr_compression",
      points,
      description: `ATR ${features.atrp.toFixed(2)}% of price - Low volatility compression (potential breakout setup)`,
    });
    tags.push("compression");
  }

  // ========================================================================
  // ADDITIONAL FACTORS (Bonus points, Max 12 points)
  // ========================================================================
  
  // Rule 10: RSI in healthy range (40-70) (+5 points)
  if (features.rsi !== null && features.rsi >= 40 && features.rsi <= 70) {
    const points = 5;
    totalScore += points;
    reasons.push({
      rule: "healthy_rsi",
      points,
      description: `RSI ${features.rsi.toFixed(1)} in healthy range (40-70) - Not overbought/oversold`,
    });
    tags.push("healthy_rsi");
  }

  // Rule 11: Price > VWAP (+3 points)
  if (features.vwap !== null && features.price > features.vwap) {
    const points = 3;
    totalScore += points;
    reasons.push({
      rule: "price_above_vwap",
      points,
      description: `Price (${features.price.toFixed(2)}) > VWAP (${features.vwap.toFixed(2)}) - Above average price`,
    });
    tags.push("above_vwap");
  }

  // Rule 12: Strong trend flag (+4 points)
  if (features.trend_flag) {
    const points = 4;
    totalScore += points;
    reasons.push({
      rule: "strong_trend",
      points,
      description: "Strong uptrend confirmed (price > SMA50 > SMA200)",
    });
    tags.push("strong_trend");
  }

  // Cap score at 100
  totalScore = Math.min(100, totalScore);

  // Add overall tags based on score ranges
  if (totalScore >= 70) {
    tags.push("high_score");
  } else if (totalScore >= 50) {
    tags.push("medium_score");
  } else {
    tags.push("low_score");
  }

  return {
    technicalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimals
    tags: Array.from(new Set(tags)), // Remove duplicates
    reasons,
  };
}

/**
 * Calculate final score combining technical and news scores
 */
export function calculateFinalScore(
  technicalScore: number,
  newsScore: number,
  liquidityBonus: number = 0,
  riskPenalty: number = 0
): number {
  // Technical score: 0-100 (weight: 70%)
  // News score: -20 to +20 (weight: 20%)
  // Liquidity bonus: 0-10 (weight: 10%)
  // Risk penalty: 0-10 (subtracted)
  
  const weightedTechnical = technicalScore * 0.7;
  const weightedNews = (newsScore + 20) * 0.5; // Normalize -20..20 to 0..20, then scale to 0-10
  const weightedLiquidity = liquidityBonus * 0.1;
  
  const finalScore = weightedTechnical + weightedNews + weightedLiquidity - riskPenalty;
  
  return Math.max(0, Math.min(100, Math.round(finalScore * 100) / 100));
}

/**
 * Calculate liquidity bonus based on dollar volume
 */
export function calculateLiquidityBonus(dollarVolume1M: number | null): number {
  if (!dollarVolume1M) return 0;
  
  // Bonus scale:
  // > 2B: +10 points
  // > 1B: +7 points
  // > 500M: +5 points
  // > 200M: +3 points
  // > 100M: +1 point
  
  if (dollarVolume1M >= 2_000_000_000) return 10;
  if (dollarVolume1M >= 1_000_000_000) return 7;
  if (dollarVolume1M >= 500_000_000) return 5;
  if (dollarVolume1M >= 200_000_000) return 3;
  if (dollarVolume1M >= 100_000_000) return 1;
  
  return 0;
}

/**
 * Calculate risk penalty based on RSI and volatility
 */
export function calculateRiskPenalty(rsi: number | null, atrp: number | null): number {
  let penalty = 0;
  
  // Overbought RSI (> 80): +5 penalty
  if (rsi !== null && rsi > 80) {
    penalty += 5;
  }
  
  // High volatility (ATR > 5%): +3 penalty
  if (atrp !== null && atrp > 5.0) {
    penalty += 3;
  }
  
  // Oversold RSI (< 20): +2 penalty (contrarian risk)
  if (rsi !== null && rsi < 20) {
    penalty += 2;
  }
  
  return Math.min(10, penalty);
}
