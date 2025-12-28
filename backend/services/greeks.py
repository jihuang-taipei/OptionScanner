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


def calculate_probability_between(
    S: float, lower: float, upper: float, T: float, r: float, sigma: float
) -> Optional[float]:
    """
    Calculate probability that stock price will be between lower and upper at expiration.
    Uses log-normal distribution assumption from Black-Scholes.
    
    P(lower < S_T < upper) = N(d2_upper) - N(d2_lower)
    
    Where d2 = (ln(S/K) + (r - σ²/2)T) / (σ√T)
    
    Args:
        S: Current stock price
        lower: Lower bound (e.g., lower breakeven)
        upper: Upper bound (e.g., upper breakeven)
        T: Time to expiration (in years)
        r: Risk-free rate (annual)
        sigma: Implied volatility (as decimal)
    
    Returns:
        Probability as decimal (0-1), or None if calculation fails
    """
    if T <= 0 or sigma <= 0 or lower <= 0 or upper <= 0 or lower >= upper:
        return None
    
    try:
        sqrt_T = math.sqrt(T)
        drift = (r - 0.5 * sigma ** 2) * T
        vol_sqrt_T = sigma * sqrt_T
        
        # d2 for upper bound (probability of being below upper)
        d2_upper = (math.log(S / upper) + drift) / vol_sqrt_T
        prob_below_upper = norm.cdf(-d2_upper)  # N(-d2) = P(S_T < K)
        
        # d2 for lower bound (probability of being below lower)
        d2_lower = (math.log(S / lower) + drift) / vol_sqrt_T
        prob_below_lower = norm.cdf(-d2_lower)
        
        # Probability of being between lower and upper
        prob_between = prob_below_upper - prob_below_lower
        
        return max(0, min(1, prob_between))  # Clamp to [0, 1]
    except Exception:
        return None


def calculate_probability_otm(
    S: float, K: float, T: float, r: float, sigma: float, option_type: str = 'call'
) -> Optional[float]:
    """
    Calculate probability that option expires out of the money.
    
    For calls: P(S_T < K) = N(-d2)
    For puts: P(S_T > K) = N(d2) = 1 - N(-d2)
    
    Args:
        S: Current stock price
        K: Strike price
        T: Time to expiration (in years)
        r: Risk-free rate (annual)
        sigma: Implied volatility (as decimal)
        option_type: 'call' or 'put'
    
    Returns:
        Probability as decimal (0-1), or None if calculation fails
    """
    if T <= 0 or sigma <= 0 or K <= 0:
        return None
    
    try:
        d2 = (math.log(S / K) + (r - 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        
        if option_type == 'call':
            # Call is OTM if S_T < K
            return norm.cdf(-d2)
        else:
            # Put is OTM if S_T > K
            return norm.cdf(d2)
    except Exception:
        return None
