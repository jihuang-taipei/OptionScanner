import math
from scipy.stats import norm
from typing import Tuple, Optional


def calculate_greeks(
    S: float, K: float, T: float, r: float, sigma: float, option_type: str = 'call'
) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    """
    Calculate option Greeks using Black-Scholes model
    
    Args:
        S: Current stock price
        K: Strike price
        T: Time to expiration (in years)
        r: Risk-free rate (annual)
        sigma: Implied volatility (as decimal, e.g., 0.20 for 20%)
        option_type: 'call' or 'put'
    
    Returns:
        Tuple of (delta, gamma, theta, vega)
    """
    if T <= 0 or sigma <= 0:
        return None, None, None, None
    
    try:
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        
        # Delta
        if option_type == 'call':
            delta = norm.cdf(d1)
        else:
            delta = norm.cdf(d1) - 1
        
        # Gamma (same for calls and puts)
        gamma = norm.pdf(d1) / (S * sigma * math.sqrt(T))
        
        # Theta (per day)
        if option_type == 'call':
            theta = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T)) 
                     - r * K * math.exp(-r * T) * norm.cdf(d2)) / 365
        else:
            theta = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T)) 
                     + r * K * math.exp(-r * T) * norm.cdf(-d2)) / 365
        
        # Vega (per 1% change in volatility)
        vega = S * norm.pdf(d1) * math.sqrt(T) / 100
        
        return round(delta, 4), round(gamma, 6), round(theta, 4), round(vega, 4)
    except Exception:
        return None, None, None, None
