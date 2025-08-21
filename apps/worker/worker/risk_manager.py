"""Risk Manager for trading proposals and portfolio constraints."""

import asyncio
from typing import Dict, Any, List
from datetime import datetime, timedelta
from loguru import logger

from .models import TradingDecision, RiskAssessment, RiskLevel


class RiskManager:
    """Risk Manager for assessing trading risks and enforcing constraints."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logger.bind(component="RiskManager")
        
        # Risk thresholds
        self.max_position_risk = config.get("max_position_risk", 0.1)
        self.max_market_risk = config.get("max_market_risk", 0.2)
        self.max_liquidity_risk = config.get("max_liquidity_risk", 0.15)
        self.max_concentration_risk = config.get("max_concentration_risk", 0.25)
        
        # Portfolio state (simplified for demo)
        self.portfolio_state = {
            "total_value": 1000000,
            "positions": {},
            "daily_pnl": 0,
            "daily_trades": 0,
            "last_updated": datetime.now()
        }
    
    async def assess_risk(self, decision: TradingDecision) -> RiskAssessment:
        """Assess risk for a trading decision."""
        self.logger.info(f"Assessing risk for {decision.symbol}")
        
        try:
            # Calculate individual risk components
            position_risk = await self._calculate_position_risk(decision)
            market_risk = await self._calculate_market_risk(decision)
            liquidity_risk = await self._calculate_liquidity_risk(decision)
            concentration_risk = await self._calculate_concentration_risk(decision)
            
            # Calculate total risk (weighted average)
            total_risk = (
                position_risk * 0.3 +
                market_risk * 0.3 +
                liquidity_risk * 0.2 +
                concentration_risk * 0.2
            )
            
            # Determine risk level
            risk_level = self._determine_risk_level(total_risk)
            
            risk_assessment = RiskAssessment(
                position_risk=position_risk,
                market_risk=market_risk,
                liquidity_risk=liquidity_risk,
                concentration_risk=concentration_risk,
                total_risk=total_risk,
                risk_level=risk_level
            )
            
            self.logger.info(f"Risk assessment completed: {risk_level.value} ({total_risk:.2f})")
            return risk_assessment
            
        except Exception as e:
            self.logger.error(f"Risk assessment failed: {e}")
            # Return conservative risk assessment on error
            return RiskAssessment(
                position_risk=0.5,
                market_risk=0.5,
                liquidity_risk=0.5,
                concentration_risk=0.5,
                total_risk=0.5,
                risk_level=RiskLevel.HIGH
            )
    
    async def _calculate_position_risk(self, decision: TradingDecision) -> float:
        """Calculate position-specific risk."""
        # Factors: position size, volatility, confidence
        size_risk = decision.size_pct * 2  # Larger positions = higher risk
        confidence_risk = 1.0 - decision.confidence  # Lower confidence = higher risk
        
        # Simulate volatility (in real implementation, get from market data)
        volatility_risk = 0.2  # 20% volatility assumption
        
        position_risk = (size_risk + confidence_risk + volatility_risk) / 3
        return min(position_risk, 1.0)
    
    async def _calculate_market_risk(self, decision: TradingDecision) -> float:
        """Calculate market-wide risk."""
        # Factors: market volatility, sector performance, economic indicators
        
        # Simulate market conditions (in real implementation, get from market data)
        market_volatility = 0.15  # 15% market volatility
        sector_performance = 0.1  # 10% sector performance impact
        economic_risk = 0.1  # 10% economic risk
        
        market_risk = (market_volatility + sector_performance + economic_risk) / 3
        return min(market_risk, 1.0)
    
    async def _calculate_liquidity_risk(self, decision: TradingDecision) -> float:
        """Calculate liquidity risk."""
        # Factors: trading volume, bid-ask spread, market depth
        
        # Simulate liquidity metrics (in real implementation, get from market data)
        trading_volume = 0.1  # Low volume = higher risk
        bid_ask_spread = 0.05  # Wide spread = higher risk
        market_depth = 0.1  # Low depth = higher risk
        
        liquidity_risk = (trading_volume + bid_ask_spread + market_depth) / 3
        return min(liquidity_risk, 1.0)
    
    async def _calculate_concentration_risk(self, decision: TradingDecision) -> float:
        """Calculate concentration risk."""
        # Factors: portfolio concentration, sector exposure, correlation
        
        # Check current portfolio concentration
        current_exposure = self.portfolio_state["positions"].get(decision.symbol, 0)
        portfolio_concentration = current_exposure / self.portfolio_state["total_value"]
        
        # Add new position
        new_concentration = portfolio_concentration + decision.size_pct
        
        # Sector concentration (simplified)
        sector_concentration = 0.1  # Assume 10% sector concentration
        
        concentration_risk = (new_concentration + sector_concentration) / 2
        return min(concentration_risk, 1.0)
    
    def _determine_risk_level(self, total_risk: float) -> RiskLevel:
        """Determine risk level based on total risk score."""
        if total_risk < 0.3:
            return RiskLevel.LOW
        elif total_risk < 0.6:
            return RiskLevel.MEDIUM
        elif total_risk < 0.8:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL
    
    async def check_portfolio_constraints(self, decision: TradingDecision) -> Dict[str, Any]:
        """Check if decision meets portfolio constraints."""
        constraints = {
            "max_exposure_per_symbol": 0.1,  # 10% max per symbol
            "daily_loss_cap": 0.05,  # 5% daily loss cap
            "max_daily_trades": 10,
            "min_confidence_threshold": 0.7,
            "kill_switch_enabled": False
        }
        
        violations = []
        
        # Check symbol exposure
        current_exposure = self.portfolio_state["positions"].get(decision.symbol, 0)
        new_exposure = current_exposure + (decision.size_pct * self.portfolio_state["total_value"])
        if new_exposure > constraints["max_exposure_per_symbol"] * self.portfolio_state["total_value"]:
            violations.append("Exceeds maximum symbol exposure")
        
        # Check daily loss cap
        if self.portfolio_state["daily_pnl"] < -constraints["daily_loss_cap"] * self.portfolio_state["total_value"]:
            violations.append("Daily loss cap exceeded")
        
        # Check daily trade limit
        if self.portfolio_state["daily_trades"] >= constraints["max_daily_trades"]:
            violations.append("Daily trade limit exceeded")
        
        # Check confidence threshold
        if decision.confidence < constraints["min_confidence_threshold"]:
            violations.append("Below minimum confidence threshold")
        
        # Check kill switch
        if constraints["kill_switch_enabled"]:
            violations.append("Kill switch is enabled")
        
        return {
            "constraints_met": len(violations) == 0,
            "violations": violations,
            "constraints": constraints
        }
    
    async def update_portfolio_state(self, trade_execution: Dict[str, Any]) -> None:
        """Update portfolio state after trade execution."""
        if trade_execution.get("executed", False):
            symbol = trade_execution.get("symbol")
            quantity = trade_execution.get("quantity", 0)
            price = trade_execution.get("price", 0)
            
            if symbol and quantity and price:
                # Update position
                current_position = self.portfolio_state["positions"].get(symbol, 0)
                self.portfolio_state["positions"][symbol] = current_position + (quantity * price)
                
                # Update daily metrics
                self.portfolio_state["daily_trades"] += 1
                self.portfolio_state["last_updated"] = datetime.now()
                
                self.logger.info(f"Portfolio updated: {symbol} position = {self.portfolio_state['positions'][symbol]}")
    
    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get portfolio summary."""
        total_positions_value = sum(self.portfolio_state["positions"].values())
        cash_balance = self.portfolio_state["total_value"] - total_positions_value
        
        return {
            "total_value": self.portfolio_state["total_value"],
            "cash_balance": cash_balance,
            "positions_value": total_positions_value,
            "num_positions": len(self.portfolio_state["positions"]),
            "daily_trades": self.portfolio_state["daily_trades"],
            "daily_pnl": self.portfolio_state["daily_pnl"],
            "positions": self.portfolio_state["positions"],
            "last_updated": self.portfolio_state["last_updated"].isoformat()
        }
    
    def reset_daily_metrics(self) -> None:
        """Reset daily metrics (call at start of trading day)."""
        self.portfolio_state["daily_pnl"] = 0
        self.portfolio_state["daily_trades"] = 0
        self.portfolio_state["last_updated"] = datetime.now()
        self.logger.info("Daily metrics reset")
