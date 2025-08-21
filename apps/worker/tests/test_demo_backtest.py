"""Unit tests for demo backtest module."""

import pytest
import pandas as pd
import numpy as np
from pathlib import Path
from worker.demo_backtest import calculate_rsi, calculate_sma, run_demo_backtest


def test_calculate_rsi():
    """Test RSI calculation."""
    # Create test data
    prices = pd.Series([100, 101, 102, 101, 100, 99, 98, 97, 96, 95])
    
    rsi = calculate_rsi(prices, period=3)
    
    # Check that RSI values are between 0 and 100
    rsi_clean = rsi.dropna()
    assert all((rsi_clean >= 0) & (rsi_clean <= 100))
    assert len(rsi) == len(prices)


def test_calculate_sma():
    """Test Simple Moving Average calculation."""
    # Create test data
    prices = pd.Series([100, 101, 102, 103, 104, 105])
    
    sma = calculate_sma(prices, period=3)
    
    # Check first few values
    assert pd.isna(sma.iloc[0])  # First value should be NaN
    assert pd.isna(sma.iloc[1])  # Second value should be NaN
    assert sma.iloc[2] == 101.0  # Third value should be average of first 3
    assert sma.iloc[3] == 102.0  # Fourth value should be average of 2nd, 3rd, 4th


def test_run_demo_backtest():
    """Test demo backtest execution."""
    # Run the backtest
    results = run_demo_backtest()
    
    # Check that results contain expected keys
    expected_keys = [
        'total_trades', 'win_rate', 'total_return', 
        'buy_hold_return', 'sharpe_ratio', 'data_points',
        'start_date', 'end_date'
    ]
    
    for key in expected_keys:
        assert key in results
    
    # Check data types
    assert isinstance(results['total_trades'], int)
    assert isinstance(results['win_rate'], float)
    assert isinstance(results['total_return'], float)
    assert isinstance(results['buy_hold_return'], float)
    assert isinstance(results['sharpe_ratio'], float)
    assert isinstance(results['data_points'], int)
    assert isinstance(results['start_date'], str)
    assert isinstance(results['end_date'], str)
    
    # Check value ranges
    assert results['total_trades'] >= 0
    assert 0 <= results['win_rate'] <= 1
    assert results['data_points'] > 0


def test_run_demo_backtest_missing_file():
    """Test backtest with missing sample file."""
    # Temporarily rename the sample file
    sample_file = Path(__file__).parent.parent / "samples" / "ohlcv_sample.csv"
    backup_file = sample_file.with_suffix('.csv.backup')
    
    if sample_file.exists():
        sample_file.rename(backup_file)
    
    try:
        with pytest.raises(FileNotFoundError):
            run_demo_backtest()
    finally:
        # Restore the file
        if backup_file.exists():
            backup_file.rename(sample_file) 