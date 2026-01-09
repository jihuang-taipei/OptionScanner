import { memo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Shield, AlertTriangle, AlertCircle, Info, DollarSign, TrendingDown, Clock } from "lucide-react";
import { Input } from "../ui/input";

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const formatCurrency = (value) => {
  if (value === undefined || value === null) return '$0';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

/**
 * Risk Management Dashboard component
 * Shows portfolio risk metrics and alerts
 */
export const RiskDashboard = memo(({
  tradingCapital,
  setTradingCapital,
  riskMetrics,
  symbolConcentration,
  strategyConcentration,
  riskAlerts,
  expirationRisk,
}) => {
  const getRiskColor = (percent) => {
    if (percent < 25) return 'text-green-400';
    if (percent < 50) return 'text-yellow-400';
    if (percent < 75) return 'text-orange-400';
    return 'text-red-400';
  };

  const getAlertIcon = (level) => {
    switch (level) {
      case 'danger': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Capital Input */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Risk Management
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-sm">Trading Capital:</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
            <Input
              type="number"
              min="1000"
              step="1000"
              value={tradingCapital}
              onChange={(e) => setTradingCapital(Math.max(1000, parseInt(e.target.value) || 100000))}
              className="w-32 pl-7 bg-zinc-800 border-zinc-700 text-white text-sm h-9 font-mono"
              data-testid="trading-capital-input"
            />
          </div>
        </div>
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="space-y-2">
          {riskAlerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                alert.level === 'danger' ? 'bg-red-500/10 border-red-500/30' :
                alert.level === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              {getAlertIcon(alert.level)}
              <span className="text-sm text-white">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Key Risk Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <DollarSign className="w-3 h-3" />
            Capital at Risk
          </div>
          <div className={`text-2xl font-bold ${getRiskColor(riskMetrics.capitalAtRiskPercent)}`}>
            {formatCurrency(riskMetrics.totalCapitalAtRisk)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {riskMetrics.capitalAtRiskPercent.toFixed(1)}% of capital
          </div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <TrendingDown className="w-3 h-3" />
            Max Potential Loss
          </div>
          <div className="text-2xl font-bold text-red-400">
            {formatCurrency(riskMetrics.maxPotentialLoss)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Worst case scenario
          </div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Shield className="w-3 h-3" />
            Margin Utilization
          </div>
          <div className={`text-2xl font-bold ${getRiskColor(riskMetrics.marginUtilization)}`}>
            {riskMetrics.marginUtilization.toFixed(1)}%
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Est. margin used
          </div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <DollarSign className="w-3 h-3" />
            Available Capital
          </div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrency(tradingCapital - riskMetrics.totalCapitalAtRisk)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {(100 - riskMetrics.capitalAtRiskPercent).toFixed(1)}% remaining
          </div>
        </div>
      </div>

      {/* Risk Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Symbol Concentration */}
        <div className="bg-zinc-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-4">Risk by Symbol</h4>
          {symbolConcentration.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={symbolConcentration}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={50}
                      dataKey="percent"
                    >
                      {symbolConcentration.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `${value.toFixed(1)}%`}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {symbolConcentration.slice(0, 5).map((s, idx) => (
                  <div key={s.symbol} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-sm text-white">{s.symbol}</span>
                    </div>
                    <div className="text-sm">
                      <span className={s.percent > 50 ? 'text-yellow-400' : 'text-zinc-400'}>
                        {s.percent.toFixed(1)}%
                      </span>
                      <span className="text-zinc-600 ml-2">({s.positions})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-zinc-500">No open positions</div>
          )}
        </div>

        {/* Strategy Concentration */}
        <div className="bg-zinc-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-4">Risk by Strategy</h4>
          {strategyConcentration.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={strategyConcentration}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={50}
                      dataKey="percent"
                    >
                      {strategyConcentration.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `${value.toFixed(1)}%`}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {strategyConcentration.slice(0, 5).map((s, idx) => (
                  <div key={s.strategy} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-sm text-white capitalize">{s.strategy.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-zinc-400">{s.percent.toFixed(1)}%</span>
                      <span className="text-zinc-600 ml-2">({s.positions})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-zinc-500">No open positions</div>
          )}
        </div>
      </div>

      {/* Expiration Timeline */}
      <div className="bg-zinc-800/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Expiration Timeline
        </h4>
        {expirationRisk.some(e => e.count > 0) ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expirationRisk}>
                <XAxis dataKey="period" tick={{ fill: '#71717a', fontSize: 10 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                  formatter={(value, name) => [
                    name === 'count' ? `${value} positions` : formatCurrency(value),
                    name === 'count' ? 'Positions' : 'Risk'
                  ]}
                />
                <Bar dataKey="count" fill="#3b82f6" name="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-zinc-500">No expiring positions</div>
        )}
      </div>

      {/* Capital Utilization Bar */}
      <div className="bg-zinc-800/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-3">Capital Utilization</h4>
        <div className="h-6 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              riskMetrics.capitalAtRiskPercent > 75 ? 'bg-red-500' :
              riskMetrics.capitalAtRiskPercent > 50 ? 'bg-orange-500' :
              riskMetrics.capitalAtRiskPercent > 25 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, riskMetrics.capitalAtRiskPercent)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-zinc-500">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
});

RiskDashboard.displayName = 'RiskDashboard';

export default RiskDashboard;
