// Application constants

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auto-refresh interval options
export const REFRESH_INTERVALS = [
  { value: 0, label: "Off" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
];

// Common stock/index symbols with options
export const POPULAR_SYMBOLS = [
  { value: "^SPX", label: "^SPX (S&P 500 Index)" },
  { value: "SPY", label: "SPY (S&P 500 ETF)" },
  { value: "QQQ", label: "QQQ (Nasdaq-100 ETF)" },
  { value: "^NDX", label: "^NDX (Nasdaq-100 Index)" },
  { value: "IWM", label: "IWM (Russell 2000 ETF)" },
  { value: "AAPL", label: "AAPL (Apple)" },
  { value: "MSFT", label: "MSFT (Microsoft)" },
  { value: "NVDA", label: "NVDA (Nvidia)" },
  { value: "TSLA", label: "TSLA (Tesla)" },
  { value: "AMZN", label: "AMZN (Amazon)" },
  { value: "META", label: "META (Meta)" },
  { value: "GOOGL", label: "GOOGL (Google)" },
];
