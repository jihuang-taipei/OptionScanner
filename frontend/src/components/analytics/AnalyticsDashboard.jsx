import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, Award, Target, Calendar, Download } from "lucide-react";

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

const formatCurrency = (value) => {
  if (value === undefined || value === null) return '$0.00';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value) => {
  if (value === undefined || value === null) return '0%';
  return `${value.toFixed(1)}%`;
};

/**
 * Analytics Dashboard component
 * Shows trade journal and performance metrics
 */
export const AnalyticsDashboard = memo(({
  analyticsPeriod,
  setAnalyticsPeriod,
  winRateStats,
  pnlByStrategy,
  pnlByHoldingPeriod,
  monthlyPerformance,
  topTrades,
  overallStats,
  onExport,
}) => {
  const periods = [
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
    { value: "all", label: "All Time" },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          Performance Analytics
        </h3>
        <div className="flex items-center gap-2">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setAnalyticsPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                analyticsPeriod === p.value
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={onExport}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors ml-2"
            title="Export Report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Total P/L</div>
          <div className={`text-xl font-bold ${overallStats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(overallStats.totalPnL)}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Win Rate</div>
          <div className="text-xl font-bold text-white flex items-center gap-1">
            {formatPercent(winRateStats.winRate)}
            <span className="text-xs text-zinc-500">({winRateStats.wins}W/{winRateStats.losses}L)</span>
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Avg P/L</div>
          <div className={`text-xl font-bold ${overallStats.avgPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(overallStats.avgPnL)}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Profit Factor</div>
          <div className={`text-xl font-bold ${overallStats.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
            {overallStats.profitFactor.toFixed(2)}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Best Trade</div>
          <div className="text-xl font-bold text-green-400">
            {formatCurrency(overallStats.maxWin)}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Worst Trade</div>
          <div className="text-xl font-bold text-red-400">
            {formatCurrency(overallStats.maxLoss)}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win Rate Pie Chart */}
        <div className="bg-zinc-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-4">Win/Loss Distribution</h4>
          {winRateStats.totalTrades > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Wins', value: winRateStats.wins },
                      { name: 'Losses', value: winRateStats.losses },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-zinc-500">No trades in this period</div>
          )}
        </div>

        {/* P/L by Strategy */}
        <div className="bg-zinc-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-4">P/L by Strategy Type</h4>
          {pnlByStrategy.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlByStrategy} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="type" tick={{ fill: '#71717a', fontSize: 10 }} width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                    formatter={(value) => [formatCurrency(value), 'P/L']}
                  />
                  <Bar dataKey="totalPnL" fill="#3b82f6">
                    {pnlByStrategy.map((entry, index) => (
                      <Cell key={index} fill={entry.totalPnL >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-zinc-500">No data available</div>
          )}
        </div>
      </div>

      {/* Monthly Performance */}
      {monthlyPerformance.length > 0 && (
        <div className="bg-zinc-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Monthly Performance
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyPerformance}>
                <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 10 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                  formatter={(value, name) => [formatCurrency(value), 'P/L']}
                />
                <Bar dataKey="pnl">
                  {monthlyPerformance.map((entry, index) => (
                    <Cell key={index} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* P/L by Holding Period */}
      <div className="bg-zinc-800/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-4">P/L by Holding Period</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pnlByHoldingPeriod}>
              <XAxis dataKey="period" tick={{ fill: '#71717a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                formatter={(value) => [formatCurrency(value), 'P/L']}
                labelFormatter={(label) => `Holding: ${label}`}
              />
              <Bar dataKey="totalPnL">
                {pnlByHoldingPeriod.map((entry, index) => (
                  <Cell key={index} fill={entry.totalPnL >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Trades */}
        <div className="bg-zinc-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Best Trades
          </h4>
          {topTrades.best.length > 0 ? (
            <div className="space-y-2">
              {topTrades.best.map((trade, idx) => (
                <div key={trade.id || idx} className="flex items-center justify-between py-2 border-b border-zinc-700/50">
                  <div>
                    <div className="text-sm text-white">{trade.strategy_name}</div>
                    <div className="text-xs text-zinc-500">{trade.symbol} • {new Date(trade.closed_at || trade.opened_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-green-400 font-mono font-medium">
                    +{formatCurrency(trade.realized_pnl)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-zinc-500 text-sm">No winning trades</div>
          )}
        </div>

        {/* Worst Trades */}
        <div className="bg-zinc-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            Worst Trades
          </h4>
          {topTrades.worst.length > 0 ? (
            <div className="space-y-2">
              {topTrades.worst.map((trade, idx) => (
                <div key={trade.id || idx} className="flex items-center justify-between py-2 border-b border-zinc-700/50">
                  <div>
                    <div className="text-sm text-white">{trade.strategy_name}</div>
                    <div className="text-xs text-zinc-500">{trade.symbol} • {new Date(trade.closed_at || trade.opened_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-red-400 font-mono font-medium">
                    {formatCurrency(trade.realized_pnl)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-zinc-500 text-sm">No losing trades</div>
          )}
        </div>
      </div>
    </div>
  );
});

AnalyticsDashboard.displayName = 'AnalyticsDashboard';

export default AnalyticsDashboard;
