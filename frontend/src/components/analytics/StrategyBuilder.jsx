import { memo } from "react";
import { Plus, Trash2, Save, FolderOpen, Zap, LineChart } from "lucide-react";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";

const formatCurrency = (value) => {
  if (value === undefined || value === null) return '$0';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

/**
 * Strategy Builder component
 * Multi-leg custom strategy creation with real-time P/L
 */
export const StrategyBuilder = memo(({
  legs,
  builderName,
  setBuilderName,
  savedStrategies,
  addLeg,
  updateLeg,
  removeLeg,
  clearLegs,
  saveStrategy,
  loadStrategy,
  deleteStrategy,
  addCommonStrategy,
  netPremium,
  profitLoss,
  strategyType,
  selectedExpiration,
  onTrade,
  symbol,
}) => {
  const commonStrategies = [
    { type: 'bull_put', label: 'Bull Put Spread' },
    { type: 'bear_call', label: 'Bear Call Spread' },
    { type: 'iron_condor', label: 'Iron Condor' },
    { type: 'straddle', label: 'Straddle' },
    { type: 'strangle', label: 'Strangle' },
  ];

  const handleTrade = () => {
    if (legs.length === 0 || !builderName) return;
    
    const strategyLegs = legs.map(l => ({
      option_type: l.option_type,
      action: l.action,
      strike: l.strike,
      price: l.price,
      quantity: l.quantity,
    }));
    
    onTrade(null, strategyType, builderName, strategyLegs, netPremium);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Strategy Builder
        </h3>
        <div className="flex items-center gap-2">
          {/* Quick Templates */}
          <Select onValueChange={(v) => addCommonStrategy(v)}>
            <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white text-sm h-9">
              <SelectValue placeholder="Quick Add..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              {commonStrategies.map(s => (
                <SelectItem key={s.type} value={s.type} className="text-white hover:bg-zinc-800">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Leg Builder */}
        <div className="space-y-4">
          {/* Strategy Name */}
          <div>
            <label className="text-zinc-400 text-sm block mb-1">Strategy Name</label>
            <Input
              value={builderName}
              onChange={(e) => setBuilderName(e.target.value)}
              placeholder="e.g., Bull Put 6900/6895"
              className="bg-zinc-800 border-zinc-700 text-white"
              data-testid="strategy-name-input"
            />
          </div>

          {/* Legs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Legs ({legs.length})</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addLeg()}
                className="h-8 text-xs"
                data-testid="add-leg-btn"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Leg
              </Button>
            </div>

            {legs.length === 0 ? (
              <div className="bg-zinc-800/30 rounded-lg p-8 text-center text-zinc-500">
                <p>No legs added yet.</p>
                <p className="text-sm mt-1">Click "Add Leg" or use Quick Add templates</p>
              </div>
            ) : (
              <div className="space-y-2">
                {legs.map((leg, idx) => (
                  <div key={leg.id} className="bg-zinc-800/50 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-zinc-500 text-sm w-6">#{idx + 1}</span>
                    
                    {/* Action */}
                    <Select
                      value={leg.action}
                      onValueChange={(v) => updateLeg(leg.id, { action: v })}
                    >
                      <SelectTrigger className="w-20 bg-zinc-900 border-zinc-700 text-white text-sm h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="buy" className="text-green-400 hover:bg-zinc-800">BUY</SelectItem>
                        <SelectItem value="sell" className="text-red-400 hover:bg-zinc-800">SELL</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Quantity */}
                    <Input
                      type="number"
                      min="1"
                      value={leg.quantity}
                      onChange={(e) => updateLeg(leg.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-16 bg-zinc-900 border-zinc-700 text-white text-sm h-8 text-center"
                    />

                    {/* Option Type */}
                    <Select
                      value={leg.option_type}
                      onValueChange={(v) => updateLeg(leg.id, { option_type: v })}
                    >
                      <SelectTrigger className="w-20 bg-zinc-900 border-zinc-700 text-white text-sm h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="call" className="text-white hover:bg-zinc-800">CALL</SelectItem>
                        <SelectItem value="put" className="text-white hover:bg-zinc-800">PUT</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Strike */}
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 text-xs">@</span>
                      <Input
                        type="number"
                        step="5"
                        value={leg.strike}
                        onChange={(e) => updateLeg(leg.id, { strike: parseFloat(e.target.value) || 0 })}
                        className="w-24 bg-zinc-900 border-zinc-700 text-white text-sm h-8 text-center font-mono"
                      />
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 text-xs">$</span>
                      <span className="text-white text-sm font-mono w-16">
                        {leg.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeLeg(leg.id)}
                      className="text-red-400 hover:text-red-300 p-1"
                      title="Remove Leg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={clearLegs}
              variant="outline"
              size="sm"
              disabled={legs.length === 0}
              className="text-xs"
            >
              Clear All
            </Button>
            <Button
              onClick={saveStrategy}
              variant="outline"
              size="sm"
              disabled={legs.length === 0 || !builderName}
              className="text-xs"
            >
              <Save className="w-3 h-3 mr-1" />
              Save Template
            </Button>
            <Button
              onClick={handleTrade}
              size="sm"
              disabled={legs.length === 0 || !builderName}
              className="text-xs bg-emerald-600 hover:bg-emerald-500"
              data-testid="execute-custom-trade-btn"
            >
              Paper Trade
            </Button>
          </div>

          {/* Saved Strategies */}
          {savedStrategies.length > 0 && (
            <div className="pt-4 border-t border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Saved Templates
              </h4>
              <div className="space-y-2">
                {savedStrategies.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-zinc-800/30 rounded px-3 py-2">
                    <div>
                      <span className="text-white text-sm">{s.name}</span>
                      <span className="text-zinc-500 text-xs ml-2">({s.legs.length} legs)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadStrategy(s)}
                        className="text-blue-400 hover:text-blue-300 text-xs"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteStrategy(s.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: P/L Preview */}
        <div className="space-y-4">
          {/* Strategy Summary */}
          <div className="bg-zinc-800/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Strategy Summary</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-zinc-500 text-xs">Strategy Type</div>
                <div className="text-white font-medium capitalize">{strategyType.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-xs">Expiration</div>
                <div className="text-white font-medium">{selectedExpiration || 'N/A'}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-xs">Net Premium</div>
                <div className={`font-medium font-mono ${netPremium >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netPremium >= 0 ? '+' : ''}{formatCurrency(netPremium * 100)}
                </div>
              </div>
              <div>
                <div className="text-zinc-500 text-xs">Symbol</div>
                <div className="text-white font-medium font-mono">{symbol}</div>
              </div>
            </div>
          </div>

          {/* Max Profit/Loss */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <div className="text-green-400 text-xs mb-1">Max Profit</div>
              <div className="text-green-400 font-bold font-mono">
                {profitLoss.maxProfit === Infinity ? 'Unlimited' : formatCurrency(profitLoss.maxProfit)}
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="text-red-400 text-xs mb-1">Max Loss</div>
              <div className="text-red-400 font-bold font-mono">
                {profitLoss.maxLoss === -Infinity ? 'Unlimited' : formatCurrency(profitLoss.maxLoss)}
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-zinc-400 text-xs mb-1">Breakevens</div>
              <div className="text-white font-mono text-sm">
                {profitLoss.breakevens.length > 0 
                  ? profitLoss.breakevens.map(b => `$${b}`).join(', ')
                  : 'N/A'
                }
              </div>
            </div>
          </div>

          {/* P/L Chart */}
          <div className="bg-zinc-800/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <LineChart className="w-4 h-4" />
              P/L at Expiration
            </h4>
            {profitLoss.plData && profitLoss.plData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={profitLoss.plData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis
                      dataKey="price"
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                      formatter={(value) => [formatCurrency(value), 'P/L']}
                      labelFormatter={(label) => `Price: $${label}`}
                    />
                    <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="pl"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-zinc-500">
                Add legs to see P/L chart
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

StrategyBuilder.displayName = 'StrategyBuilder';

export default StrategyBuilder;
