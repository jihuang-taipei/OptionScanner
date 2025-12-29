import { memo } from 'react';
import { LineChart as LineChartIcon, Plus } from 'lucide-react';

const StrangleTable = memo(({ strangles, currentPrice, strikeRange, onSelectStrategy, onTrade, maxRiskAmount, minRewardAmount }) => {
  if (!strangles || strangles.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Strangles available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  const calculatePositionSize = (totalCost) => {
    const maxLoss = totalCost * 100;
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    return { contracts: Math.max(1, contracts), maxLoss };
  };

  const rangePct = strikeRange / 100;
  const minStrike = currentPrice * (1 - rangePct);
  const maxStrike = currentPrice * (1 + rangePct);
  
  const filteredStrangles = strangles.filter(s => 
    s.put_strike >= minStrike && s.call_strike <= maxStrike
  );

  if (filteredStrangles.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Strangles match your filter</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the strike range %</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredStrangles.length} of {strangles.length} strangles
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Put Strike</th>
            <th className="text-left py-3 px-2 font-medium">Call Strike</th>
            <th className="text-right py-3 px-2 font-medium">Width</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Total Cost</th>
            <th className="text-right py-3 px-2 font-medium">Breakevens</th>
            <th className="text-right py-3 px-2 font-medium text-amber-400">Move to B/E</th>
            <th className="text-right py-3 px-2 font-medium text-purple-400">Avg IV</th>
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredStrangles.map((s, idx) => {
            const posSize = calculatePositionSize(s.total_cost);
            return (
            <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="py-2.5 px-2">
                <div className="font-mono font-medium text-white">${s.put_strike.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">${s.put_price.toFixed(2)}</div>
              </td>
              <td className="py-2.5 px-2">
                <div className="font-mono font-medium text-white">${s.call_strike.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">${s.call_price.toFixed(2)}</div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                ${s.width.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400 font-medium">
                ${s.total_cost.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2">
                <div className="font-mono text-white text-xs">
                  ${s.lower_breakeven.toFixed(0)} - ${s.upper_breakeven.toFixed(0)}
                </div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-amber-400">
                ±{s.breakeven_move_pct.toFixed(1)}%
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-purple-400">
                {s.avg_iv.toFixed(1)}%
              </td>
              <td className="text-center py-2.5 px-2">
                <div className="font-mono font-medium text-green-400">
                  {posSize.contracts}
                </div>
                <div className="text-xs text-zinc-500">
                  ${posSize.maxLoss.toFixed(0)}
                </div>
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onSelectStrategy({
                    type: 'strangle',
                    name: `Strangle ${s.put_strike}/${s.call_strike}`,
                    call_strike: s.call_strike,
                    put_strike: s.put_strike,
                    total_cost: s.total_cost
                  })}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                  title="View P/L Chart"
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    s,
                    'strangle',
                    `Strangle ${s.put_strike}/${s.call_strike}`,
                    [
                      { option_type: 'call', action: 'buy', strike: s.call_strike, price: s.call_price, quantity: 1 },
                      { option_type: 'put', action: 'buy', strike: s.put_strike, price: s.put_price, quantity: 1 }
                    ],
                    -s.total_cost
                  )}
                  className="text-green-400 hover:text-green-300 transition-colors"
                  title="Paper Trade"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
});

export default StrangleTable;
