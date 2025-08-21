"""Demo backtesting module for the AI Trading Agent Worker."""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any
from loguru import logger


def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """Calculate Relative Strength Index (RSI)."""
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_sma(prices: pd.Series, period: int) -> pd.Series:
    """Calculate Simple Moving Average (SMA)."""
    return prices.rolling(window=period).mean()


def run_demo_backtest() -> Dict[str, Any]:
    """Run a demo backtest on sample data."""
    
    # Load sample data
    sample_file = Path(__file__).parent.parent / "samples" / "ohlcv_sample.csv"
    
    if not sample_file.exists():
        logger.error(f"Sample file not found: {sample_file}")
        raise FileNotFoundError(f"Sample file not found: {sample_file}")
    
    # Load data
    df = pd.read_csv(sample_file)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df.set_index('timestamp', inplace=True)
    
    logger.info(f"Loaded {len(df)} data points from {df.index[0]} to {df.index[-1]}")
    
    # Calculate technical indicators
    df['rsi'] = calculate_rsi(df['close'])
    df['sma_20'] = calculate_sma(df['close'], 20)
    df['sma_50'] = calculate_sma(df['close'], 50)
    
    # Generate trading signals
    df['signal'] = 0  # 0: hold, 1: buy, -1: sell
    
    # RSI oversold/overbought signals
    df.loc[df['rsi'] < 30, 'signal'] = 1  # Buy when RSI < 30
    df.loc[df['rsi'] > 70, 'signal'] = -1  # Sell when RSI > 70
    
    # Moving average crossover
    df.loc[df['sma_20'] > df['sma_50'], 'signal'] = 1  # Golden cross
    df.loc[df['sma_20'] < df['sma_50'], 'signal'] = -1  # Death cross
    
    # Calculate returns
    df['returns'] = df['close'].pct_change()
    df['strategy_returns'] = df['signal'].shift(1) * df['returns']
    
    # Calculate cumulative returns
    df['cumulative_returns'] = (1 + df['returns']).cumprod()
    df['strategy_cumulative_returns'] = (1 + df['strategy_returns']).cumprod()
    
    # Calculate performance metrics
    total_return = df['strategy_cumulative_returns'].iloc[-1] - 1
    buy_hold_return = df['cumulative_returns'].iloc[-1] - 1
    
    # Calculate Sharpe ratio (assuming 0% risk-free rate)
    strategy_returns = df['strategy_returns'].dropna()
    sharpe_ratio = strategy_returns.mean() / strategy_returns.std() * np.sqrt(252)  # Annualized
    
    # Calculate win rate
    winning_trades = (strategy_returns > 0).sum()
    total_trades = (strategy_returns != 0).sum()
    win_rate = winning_trades / total_trades if total_trades > 0 else 0
    
    # Count total trades
    trade_changes = df['signal'].diff().abs()
    total_trades = trade_changes.sum() // 2  # Divide by 2 because each trade has entry and exit
    
    logger.info(f"Backtest completed:")
    logger.info(f"  Total Trades: {total_trades}")
    logger.info(f"  Win Rate: {win_rate:.2%}")
    logger.info(f"  Strategy Return: {total_return:.2%}")
    logger.info(f"  Buy & Hold Return: {buy_hold_return:.2%}")
    logger.info(f"  Sharpe Ratio: {sharpe_ratio:.2f}")
    
    return {
        'total_trades': int(total_trades),
        'win_rate': win_rate,
        'total_return': total_return,
        'buy_hold_return': buy_hold_return,
        'sharpe_ratio': sharpe_ratio,
        'data_points': len(df),
        'start_date': df.index[0].strftime('%Y-%m-%d'),
        'end_date': df.index[-1].strftime('%Y-%m-%d'),
    } 