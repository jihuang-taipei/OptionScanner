import { TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Stats Card Component
export const StatCard = ({ label, value, icon: Icon, isLoading }) => (
  <div className="glass-card p-5 hover:border-white/20 transition-all duration-300">
    <div className="flex items-center justify-between mb-2">
      <span className="text-zinc-500 text-sm">{label}</span>
      <Icon className="w-4 h-4 text-zinc-600" />
    </div>
    {isLoading ? (
      <div className="h-7 w-24 bg-zinc-800 rounded animate-pulse" />
    ) : (
      <p className="font-mono text-xl text-white font-medium">
        {typeof value === 'number' 
          ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : value}
      </p>
    )}
  </div>
);

// Period Selector Button
export const PeriodButton = ({ period, currentPeriod, onClick, label }) => (
  <button
    onClick={() => onClick(period)}
    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
      currentPeriod === period
        ? 'bg-white text-black'
        : 'text-zinc-400 hover:text-white hover:bg-white/10'
    }`}
    data-testid={`period-${period}`}
  >
    {label}
  </button>
);

// Custom Tooltip for Chart
export const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    // Format label based on whether it's intraday or daily data
    let displayLabel = label;
    if (label && label.includes(' ')) {
      // Intraday: "2025-12-29 14:30" -> "Dec 29, 14:30"
      const [datePart, timePart] = label.split(' ');
      const date = new Date(datePart);
      displayLabel = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timePart}`;
    } else if (label) {
      // Daily: "2025-12-29" -> "Dec 29, 2025"
      const date = new Date(label);
      displayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    return (
      <div className="custom-tooltip bg-zinc-900 border border-white/10 rounded-lg p-3">
        <p className="text-zinc-400 text-sm mb-1">{displayLabel}</p>
        <p className="font-mono text-lg text-white font-medium">
          ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

export default { StatCard, PeriodButton, CustomTooltip };
