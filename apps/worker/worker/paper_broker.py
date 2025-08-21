"""Paper Broker for immediate fills of approved proposals."""

import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from loguru import logger

from .models import TradingDecision, ApprovalStatus


class PaperBroker:
    """Paper broker that immediately fills approved proposals."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.logger = logger.bind(component="PaperBroker")
        
        # Paper trading state
        self.positions: Dict[str, Dict[str, Any]] = {}
        self.trades: list = []
        self.cash_balance = self.config.get("initial_cash", 100000)
        self.commission_rate = self.config.get("commission_rate", 0.001)  # 0.1%
        
        self.logger.info(f"Paper broker initialized with ${self.cash_balance:,.2f}")
    
    def fill_proposal(self, proposal_id: str, decision: TradingDecision, 
                     fill_price: Optional[float] = None) -> Dict[str, Any]:
        """Fill an approved proposal immediately."""
        try:
            # Generate fill price if not provided (simulate market price)
            if fill_price is None:
                fill_price = self._generate_fill_price(decision.symbol, decision.action)
            
            # Calculate position size
            position_value = self.cash_balance * decision.size_pct
            shares = position_value / fill_price
            
            # Calculate commission
            commission = position_value * self.commission_rate
            
            # Create trade record
            trade_id = str(uuid.uuid4())
            trade = {
                "trade_id": trade_id,
                "proposal_id": proposal_id,
                "symbol": decision.symbol,
                "action": decision.action,
                "shares": shares,
                "price": fill_price,
                "value": position_value,
                "commission": commission,
                "timestamp": datetime.now().isoformat(),
                "status": "FILLED"
            }
            
            # Update positions
            if decision.action in ["BUY", "SELL"]:
                self._update_position(decision.symbol, decision.action, shares, fill_price, commission)
            
            # Update cash balance
            if decision.action == "BUY":
                self.cash_balance -= (position_value + commission)
            elif decision.action == "SELL":
                self.cash_balance += (position_value - commission)
            
            # Record trade
            self.trades.append(trade)
            
            self.logger.info(
                f"Filled {decision.action} {shares:.2f} shares of {decision.symbol} "
                f"at ${fill_price:.2f} (${position_value:,.2f})"
            )
            
            return {
                "success": True,
                "trade_id": trade_id,
                "fill_price": fill_price,
                "shares": shares,
                "commission": commission,
                "cash_balance": self.cash_balance,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Failed to fill proposal {proposal_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _generate_fill_price(self, symbol: str, action: str) -> float:
        """Generate a realistic fill price (simulate market conditions)."""
        # In a real implementation, this would fetch current market price
        # For now, use a simple simulation
        
        # Base prices for common symbols
        base_prices = {
            "AAPL": 150.0,
            "GOOGL": 2800.0,
            "MSFT": 300.0,
            "TSLA": 200.0,
            "NVDA": 400.0,
            "BTCUSDT": 50000.0,
            "ETHUSDT": 3000.0,
        }
        
        base_price = base_prices.get(symbol, 100.0)
        
        # Add some price movement based on action
        import random
        price_change = random.uniform(-0.02, 0.02)  # ±2%
        
        if action == "BUY":
            # Slight upward pressure for buys
            price_change += random.uniform(0, 0.01)
        elif action == "SELL":
            # Slight downward pressure for sells
            price_change -= random.uniform(0, 0.01)
        
        return base_price * (1 + price_change)
    
    def _update_position(self, symbol: str, action: str, shares: float, 
                        price: float, commission: float):
        """Update position tracking."""
        if symbol not in self.positions:
            self.positions[symbol] = {
                "shares": 0,
                "avg_price": 0,
                "total_cost": 0,
                "last_update": datetime.now().isoformat()
            }
        
        position = self.positions[symbol]
        
        if action == "BUY":
            # Add to position
            total_shares = position["shares"] + shares
            total_cost = position["total_cost"] + (shares * price) + commission
            
            position["shares"] = total_shares
            position["total_cost"] = total_cost
            position["avg_price"] = total_cost / total_shares if total_shares > 0 else 0
            
        elif action == "SELL":
            # Reduce position
            position["shares"] -= shares
            if position["shares"] <= 0:
                # Position closed
                del self.positions[symbol]
            else:
                # Update average price (simplified - in reality would use FIFO/LIFO)
                position["total_cost"] = position["shares"] * position["avg_price"]
        
        position["last_update"] = datetime.now().isoformat()
    
    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get current portfolio summary."""
        total_value = self.cash_balance
        positions_summary = {}
        
        for symbol, position in self.positions.items():
            # Estimate current value (in real implementation, fetch current prices)
            current_price = self._generate_fill_price(symbol, "HOLD")
            market_value = position["shares"] * current_price
            unrealized_pnl = market_value - position["total_cost"]
            
            positions_summary[symbol] = {
                "shares": position["shares"],
                "avg_price": position["avg_price"],
                "current_price": current_price,
                "market_value": market_value,
                "unrealized_pnl": unrealized_pnl,
                "unrealized_pnl_pct": (unrealized_pnl / position["total_cost"]) * 100 if position["total_cost"] > 0 else 0
            }
            
            total_value += market_value
        
        return {
            "cash_balance": self.cash_balance,
            "total_value": total_value,
            "positions": positions_summary,
            "num_positions": len(self.positions),
            "num_trades": len(self.trades),
            "last_update": datetime.now().isoformat()
        }
    
    def get_trade_history(self, limit: int = 100) -> list:
        """Get recent trade history."""
        return self.trades[-limit:] if self.trades else []
    
    def get_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get specific position details."""
        return self.positions.get(symbol)
    
    def reset_portfolio(self, initial_cash: float = 100000):
        """Reset portfolio to initial state."""
        self.positions = {}
        self.trades = []
        self.cash_balance = initial_cash
        self.logger.info(f"Portfolio reset to ${initial_cash:,.2f}")
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Calculate performance metrics."""
        if not self.trades:
            return {
                "total_trades": 0,
                "win_rate": 0,
                "total_pnl": 0,
                "avg_trade_size": 0
            }
        
        # Calculate basic metrics
        total_trades = len(self.trades)
        total_pnl = 0
        winning_trades = 0
        
        for trade in self.trades:
            # Simplified PnL calculation
            if trade["action"] == "SELL":
                # Find corresponding buy trade for PnL calculation
                # This is simplified - in reality would track individual lots
                pass
        
        return {
            "total_trades": total_trades,
            "win_rate": (winning_trades / total_trades) * 100 if total_trades > 0 else 0,
            "total_pnl": total_pnl,
            "avg_trade_size": sum(t["value"] for t in self.trades) / total_trades if total_trades > 0 else 0,
            "commission_paid": sum(t["commission"] for t in self.trades)
        }
